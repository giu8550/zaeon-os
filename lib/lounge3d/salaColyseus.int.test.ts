/**
 * Integração de ponta a ponta do transporte COLYSEUS: o servidor de verdade (server/colyseus) numa porta livre +
 * DOIS clientes do módulo do navegador (components/lounge/salaColyseus — o mesmo que o site usa), com o token
 * assinado como a rota /rt-token faz. Confere: os dois se veem ao entrar, a pose andando chega no outro já
 * interpolada, o signaling da voz passa, e sair remove o avatar.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Presenca } from "./tipos";

const SEGREDO = "segredo-int-teste";
process.env.REALTIME_SECRET = SEGREDO;
const SALA = "0123456789abcdef01234567", A = "a".repeat(24), B = "b".repeat(24);
const espera = async (cond: () => boolean, ms = 15000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 20)); } };

describe("transporte Colyseus (servidor + 2 clientes do site)", () => {
  let fechar: () => Promise<void> = async () => {};
  let conectar: typeof import("@/components/lounge/salaColyseus").conectarColyseus;

  beforeAll(async () => {
    const { criarServidor } = await import("../../server/colyseus/src/app");
    const { assinarToken } = await import("../../server/colyseus/src/token");
    const { servidor, httpServer } = criarServidor(SEGREDO);
    await servidor.listen(0, "127.0.0.1");
    const porta = (httpServer.address() as { port: number }).port;
    vi.stubEnv("NEXT_PUBLIC_COLYSEUS_URL", `ws://127.0.0.1:${porta}`);
    // o navegador: rAF + fetch do token (como a rota /rt-token devolve: sessão → token assinado)
    vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => setTimeout(() => cb(performance.now()), 16) as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>));
    let proximo = A;
    const fetchReal = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => !String(url).includes("/rt-token") ? fetchReal(url, init) : new Response(JSON.stringify({ token: assinarToken({ u: proximo, n: proximo === A ? "Ana" : "Bia", c: "#123456", f: proximo === A, q: false, s: SALA, exp: Date.now() + 60_000 }, SEGREDO), ice: [] }), { status: 200 }));
    (globalThis as { __proximo?: (u: string) => void }).__proximo = (u) => { proximo = u; };
    conectar = (await import("@/components/lounge/salaColyseus")).conectarColyseus;
    fechar = async () => { await Promise.race([servidor.gracefullyShutdown(false).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]); httpServer.closeAllConnections?.(); };
  });
  afterAll(async () => { await fechar(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("os dois se veem ao entrar, a pose andando chega interpolada, a voz passa e sair remove", async () => {
    const proximo = (globalThis as { __proximo?: (u: string) => void }).__proximo!;
    const remA = new Map<string, Presenca>(), remB = new Map<string, Presenca>();
    let onA: string[] = [], onB: string[] = [], estA = "", estB = "";
    proximo(A);
    const a = conectar({ salaId: SALA, euId: A, remotos: remA, onOnline: (l) => { onA = l.map((x) => x.id); }, onEstado: (e) => { estA = e; } });
    await espera(() => estA === "ok");
    proximo(B);
    const b = conectar({ salaId: SALA, euId: B, remotos: remB, onOnline: (l) => { onB = l.map((x) => x.id); }, onEstado: (e) => { estB = e; } });
    await espera(() => estB === "ok" && onA.length === 2 && onB.length === 2);   // na lista de online já ao entrar
    // a 1ª pose sai assim que conecta (o useSala3D reenvia a última pose no "ok") — parado mesmo, sem andar
    a.enviar({ x: -2, z: 1, facing: 0, moving: false, sit: false, topo: false, ceu: false });
    b.enviar({ x: 0, z: 0, facing: 0, moving: false, sit: false, topo: false, ceu: false });
    await espera(() => remA.has(B) && remB.has(A));

    // B anda em linha reta: em A, o x cresce suave (interpolado), sem pular direto pro último pacote
    const xs: number[] = [];
    for (let i = 0; i <= 20; i++) { b.enviar({ x: i * 0.5, z: 0, facing: Math.PI / 2, moving: true, sit: false, topo: false, ceu: false }); await new Promise((r) => setTimeout(r, 50)); xs.push(remA.get(B)?.x ?? 0); }
    b.enviar({ x: 10, z: 0, facing: Math.PI / 2, moving: false, sit: false, topo: false, ceu: false });   // parou (o engine manda moving: false)
    await espera(() => Math.abs((remA.get(B)?.x ?? 0) - 10) < 0.05);   // e em A ele para EXATAMENTE ali (sem passar do ponto)
    const passos = xs.slice(1).map((x, i) => x - xs[i]!);
    expect(Math.max(...passos)).toBeLessThan(2);         // sem saltos grandes
    expect(xs[xs.length - 1]).toBeGreaterThan(5);         // mas acompanhando de perto

    // regalia: B (não-fundador) mandando topo → continua fora do topo pros outros
    b.enviar({ x: 10, z: 0, facing: 0, moving: false, sit: false, topo: true, ceu: true });
    await new Promise((r) => setTimeout(r, 300));
    expect(remA.get(B)?.topo).toBe(false);

    // signaling da voz: A → B, com o remetente da sessão
    const chegou: unknown[] = [];
    const des = b.voz.assinar((from, data) => chegou.push({ from, data }));
    a.voz.enviar(B, { d: { type: "offer", sdp: "v=0" } });
    await espera(() => chegou.length === 1);
    expect(chegou[0]).toEqual({ from: A, data: { d: { type: "offer", sdp: "v=0" } } });
    a.voz.fala(true);
    await espera(() => remB.get(A)?.falando === true);
    des();

    // B sai → some pra A
    b.sair();
    await espera(() => !remA.has(B) && onA.length === 1);
    a.sair();
  }, 60_000);   // sob a carga da suíte inteira (200 arquivos em paralelo) a 1ª entrada demora mais
});
