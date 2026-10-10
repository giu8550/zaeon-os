import { describe, expect, it } from "vitest";
import { ATRASO_MS, MAX_EXTRAP_MS, RelogioRemoto, Trilha } from "./netcode";
import { juntarChat, type MensagemChat } from "./tipos";
import { servidoresIce, STUN_PUBLICO } from "./ice";
import { createHmac } from "node:crypto";

describe("netcode dos remotos (interpolação + dead reckoning)", () => {
  it("MOTO a 155 m/s com os patches em lotes de 50 ms: pelo tempo de quem MANDOU, a velocidade desenhada é constante (sem tranco)", () => {
    const V = 0.155, t = new Trilha(), rl = new RelogioRemoto();   // m/ms
    // mandadas a cada 66 ms (15 Hz); chegam na grade de 50 ms do patch (20 Hz) + 30 ms de rede
    rl.local(4934, 20_000 + 4934 + 30);   // (já tinha visto o atraso mínimo da rede: 30 ms)
    for (let k = 0; k < 20; k++) { const enviada = 5000 + k * 66, chegada = 20_000 + Math.ceil((enviada + 30) / 50) * 50; t.empurrar({ t: rl.local(enviada, chegada), x: enviada * V, z: 0, facing: 0, moving: true }); }
    const xs = Array.from({ length: 40 }, (_, i) => t.amostrar(20_000 + 5100 + i * 16 + ATRASO_MS)!.x);
    const passos = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const d of passos) expect(Math.abs(d - 16 * V)).toBeLessThan(0.1);   // ~2,5 m por quadro, sempre — nada de ir e voltar
    // pela CHEGADA (o jeito antigo) o passo variava ±50%: é o "duplicada e glitchando"
  });
  it("relógio do remetente: o atraso mínimo vale; o outro recarregou (relógio recomeçou) → recomeça a conta", () => {
    const rl = new RelogioRemoto();
    expect(rl.local(100, 1100)).toBe(1100); expect(rl.local(166, 1250)).toBeCloseTo(1166.1, 6);   // chegou atrasado: vale o melhor atraso
    expect(rl.local(10, 9000)).toBe(9000);                                             // relógio novo dele
  });
  it("moto no boost (280 m/s) com um soluço de 400 ms: não é teleporte (anda junto); portal de 600 m em 66 ms é", () => {
    const t = new Trilha();
    t.empurrar({ t: 1000, x: 0, z: 0, facing: 0, moving: true }); t.empurrar({ t: 1400, x: 112, z: 0, facing: 0, moving: true });
    expect(t.amostrar(1200 + ATRASO_MS)!.x).toBeCloseTo(56, 3);
    t.empurrar({ t: 1466, x: 712, z: 0, facing: 0, moving: true });
    expect(t.amostrar(1430 + ATRASO_MS)!.x).toBe(712);   // corta seco
  });
  it("chat: a mesma mensagem (o POST e o evento do Pusher) entra UMA vez", () => {
    const m: MensagemChat = { id: "a1", userId: "u", name: "Giulia", color: "#fff", texto: "oi", ts: 1 };
    const l = juntarChat(juntarChat([], m), { ...m });
    expect(l).toHaveLength(1); expect(juntarChat(l, { ...m, id: "a2" })).toHaveLength(2);
    expect(juntarChat(Array.from({ length: 200 }, (_, i) => ({ ...m, id: `x${i}` })), { ...m, id: "novo" })).toHaveLength(200);
  });
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
