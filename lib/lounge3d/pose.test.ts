import { describe, expect, it } from "vitest";
import { HEARTBEAT_MS, poseMudou } from "./pose";
import { POS_HZ, POS_HZ_FALLBACK } from "./tipos";
import { posicaoDaBase, poseNoAssento, localParaMundo } from "@/lib/cyber/bases";

describe("pose", () => {
  const p = { x: 1, z: 2, facing: 0.5, moving: false, sit: false };
  it("primeiro envio sempre", () => { expect(poseMudou(null, p)).toBe(true); });
  it("parado não reenvia", () => { expect(poseMudou(p, { ...p, x: 1.001 })).toBe(false); });
  it("andou, girou, mudou moving/sit → reenvia", () => {
    expect(poseMudou(p, { ...p, x: 1.5 })).toBe(true);
    expect(poseMudou(p, { ...p, facing: 0.9 })).toBe(true);
    expect(poseMudou(p, { ...p, moving: true })).toBe(true);
    expect(poseMudou(p, { ...p, sit: true })).toBe(true);
  });
  it("voando: altura/rumo da nave e entrar/sair da cidade contam como mudança", () => {
    expect(poseMudou({ ...p, voo: { y: 50, yaw: 0 } }, { ...p, voo: { y: 52, yaw: 0 } })).toBe(true);
    expect(poseMudou({ ...p, voo: { y: 50, yaw: 0 } }, { ...p, voo: { y: 50.01, yaw: 0 } })).toBe(false);
    expect(poseMudou(p, { ...p, voo: { y: 0, yaw: 0 } })).toBe(true);
    // mochila a jato: decolar/pousar e subir reenviam; mesma altura não
    expect(poseMudou(p, { ...p, jet: 3 })).toBe(true);
    expect(poseMudou({ ...p, jet: 3 }, p)).toBe(true);
    expect(poseMudou({ ...p, jet: 3 }, { ...p, jet: 3.5 })).toBe(true);
    expect(poseMudou({ ...p, jet: 3 }, { ...p, jet: 3.01 })).toBe(false);
    // nave pousada fora do hangar: aparecer/sumir/mover reenvia; parada igual não gasta cota
    const np = { x: 24, y: 0, z: 24, yaw: 0 };
    expect(poseMudou(p, { ...p, naveParada: np })).toBe(true);
    expect(poseMudou({ ...p, naveParada: np }, p)).toBe(true);
    expect(poseMudou({ ...p, naveParada: np }, { ...p, naveParada: { ...np, x: 30 } })).toBe(true);
    expect(poseMudou({ ...p, naveParada: np }, { ...p, naveParada: { ...np } })).toBe(false);
    expect(poseMudou(p, { ...p, ceu: true })).toBe(true);
    // moto: montar/descer e mexer a altura/rumo reenviam
    const mt = { s: 1, y: 3, yaw: 0 };
    expect(poseMudou(p, { ...p, moto: mt })).toBe(true);
    expect(poseMudou({ ...p, moto: mt }, p)).toBe(true);
    expect(poseMudou({ ...p, moto: mt }, { ...p, moto: { ...mt, y: 8 } })).toBe(true);
    expect(poseMudou({ ...p, moto: mt }, { ...p, moto: { ...mt } })).toBe(false);
  });
  it("giro pelo menor arco (±π não conta como mudança)", () => {
    expect(poseMudou({ ...p, facing: Math.PI - 0.001 }, { ...p, facing: -Math.PI + 0.001 })).toBe(false);
  });
});

describe("taxa (teto de client events do Pusher = 10/s por conexão)", () => {
  it("POS_HZ abaixo do teto, com folga pro hello/heartbeat", () => {
    expect(POS_HZ).toBeLessThanOrEqual(9);
    expect(POS_HZ + 1000 / HEARTBEAT_MS).toBeLessThan(10);
    expect(POS_HZ_FALLBACK).toBe(4);
  });
});

describe("poseNoAssento", () => {
  it("fica dentro da base, no assento, olhando pro monitor", () => {
    const b = posicaoDaBase(1); const s = poseNoAssento(b);
    expect(Math.hypot(s.x - b.x, s.z - b.z)).toBeLessThan(0.5);
    const mon = localParaMundo(b, 0, -1.44);
    const dir = Math.atan2(mon.x - s.x, mon.z - s.z);
    let d = dir - s.facing; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    expect(Math.abs(d)).toBeLessThan(0.01);
  });
});
