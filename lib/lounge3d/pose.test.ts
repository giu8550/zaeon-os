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
