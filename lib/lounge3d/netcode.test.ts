import { describe, expect, it } from "vitest";
import { ATRASO_MS, MAX_EXTRAP_MS, Trilha } from "./netcode";
import { servidoresIce, STUN_PUBLICO } from "./ice";
import { createHmac } from "node:crypto";

describe("netcode dos remotos (interpolação + dead reckoning)", () => {
  it("desenha ATRASO_MS no passado, interpolando entre as amostras em volta", () => {
    const t = new Trilha();
    t.empurrar({ t: 1000, x: 0, z: 0, facing: 0 }); t.empurrar({ t: 1050, x: 1, z: 0, facing: 0 }); t.empurrar({ t: 1100, x: 2, z: 0, facing: 0 });
    expect(t.amostrar(1075 + ATRASO_MS)!.x).toBeCloseTo(1.5, 6);   // meio do caminho entre 1050 e 1100
  });
  it("pacote atrasado: extrapola pela última velocidade, mas só até o teto", () => {
    const t = new Trilha();
    t.empurrar({ t: 0, x: 0, z: 0, facing: 0 }); t.empurrar({ t: 100, x: 1, z: 0, facing: 0 });   // 10 m/s
    expect(t.amostrar(100 + ATRASO_MS + 50)!.x).toBeCloseTo(1.5, 6);
    expect(t.amostrar(100 + ATRASO_MS + MAX_EXTRAP_MS)!.x).toBeCloseTo(1 + MAX_EXTRAP_MS / 100, 6);   // no teto
    expect(t.amostrar(100 + ATRASO_MS + 5000)!.x).toBeCloseTo(1, 6);   // sem pacote novo: volta pra última posição real (não fica à frente)
  });
  it("parou (moving: false): não extrapola — fica exatamente onde parou", () => {
    const t = new Trilha();
    t.empurrar({ t: 0, x: 0, z: 0, facing: 0, moving: true }); t.empurrar({ t: 100, x: 1, z: 0, facing: 0, moving: false });
    expect(t.amostrar(100 + ATRASO_MS + 80)!.x).toBe(1);
  });
  it("rumo gira pelo caminho curto; teleporte não é arrastado", () => {
    const t = new Trilha();
    t.empurrar({ t: 0, x: 0, z: 0, facing: 3.0 }); t.empurrar({ t: 100, x: 0, z: 0, facing: -3.0 });
    expect(Math.abs(t.amostrar(50 + ATRASO_MS)!.facing)).toBeGreaterThan(3);   // passa por ±π, não por 0
    t.empurrar({ t: 200, x: 300, z: 0, facing: 0 });
    expect(t.amostrar(150 + ATRASO_MS)!.x).toBe(300);   // trilha recomeçou no destino
  });
});

describe("ICE da voz", () => {
  it("sem TURN: só o STUN público; com TURN: credencial temporária do coturn (HMAC-SHA1)", () => {
    expect(servidoresIce("u1", {})).toEqual([STUN_PUBLICO]);
    const s = servidoresIce("u1", { TURN_URLS: "turn:t.zaeon:3478?transport=udp, lixo, turns:t.zaeon:5349", TURN_SECRET: "seg" }, 1_000_000_000_000);
    const turn = s[1]!;
    expect(turn.urls).toEqual(["turn:t.zaeon:3478?transport=udp", "turns:t.zaeon:5349"]);
    expect(turn.username).toBe(`${1_000_000_000 + 12 * 3600}:u1`);
    expect(turn.credential).toBe(createHmac("sha1", "seg").update(turn.username!).digest("base64"));
  });
});
