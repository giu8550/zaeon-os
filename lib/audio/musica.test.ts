import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarControladorMusica, volumeNoFade, type AudioLike } from "./musica";

function fakeAudio(): AudioLike & { pauses: number; volumes: number[] } {
  const a = {
    src: "", volume: 1, loop: false, paused: true, currentTime: 0, pauses: 0, volumes: [] as number[],
    play() { a.paused = false; return Promise.resolve(); },
    pause() { a.paused = true; a.pauses++; },
  };
  return new Proxy(a, { set(t, k, v) { if (k === "volume") t.volumes.push(v as number); (t as Record<string | symbol, unknown>)[k] = v; return true; } }) as typeof a;
}

describe("dono único da música", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("curva do fade: suave, começa e termina nos extremos", () => {
    expect(volumeNoFade(0.4, 0, 0)).toBe(0.4); expect(volumeNoFade(0.4, 0, 1)).toBe(0);
    expect(volumeNoFade(0, 1, 0.5)).toBeCloseTo(0.5, 6);
  });

  it("tocar → fade-in até o volume; parar → fade até 0 e SÓ ENTÃO pausa (nada de corte seco)", async () => {
    const a = fakeAudio(); const m = criarControladorMusica({ criarElemento: () => a });
    const t = m.tocar("/x.mp3", { loop: true }); await vi.runAllTimersAsync(); await t;
    expect(m.estado).toBe("tocando"); expect(a.volume).toBeCloseTo(0.4, 6); expect(a.loop).toBe(true);
    const p = m.parar(800);
    expect(m.estado).toBe("fade"); expect(a.paused).toBe(false);   // ainda tocando durante o fade
    await vi.runAllTimersAsync(); await p;
    expect(a.paused).toBe(true); expect(a.pauses).toBe(1); expect(m.estado).toBe("parado");
    // desceu em degraus pequenos (fade), não de uma vez
    const desc = a.volumes.slice(a.volumes.indexOf(Math.max(...a.volumes)));
    expect(desc.length).toBeGreaterThan(10);
  });

  it("o reset da home (navbar) só acontece com a música PARADA — tocando ou em fade, não corta", async () => {
    const a = fakeAudio(); const m = criarControladorMusica({ criarElemento: () => a });
    const t = m.tocar("/boot.mp3"); await vi.runAllTimersAsync(); await t;
    a.currentTime = 12;
    expect(m.rebobinarSeParado("/boot.mp3")).toBe(false); expect(a.currentTime).toBe(12);
    const p = m.parar(); expect(m.rebobinarSeParado("/boot.mp3")).toBe(false);
    await vi.runAllTimersAsync(); await p;
    expect(m.rebobinarSeParado("/boot.mp3")).toBe(true); expect(a.currentTime).toBe(0);
  });

  it("voltar a tocar no meio do fade de parada cancela a pausa", async () => {
    const a = fakeAudio(); const m = criarControladorMusica({ criarElemento: () => a });
    const t = m.tocar("/x.mp3"); await vi.runAllTimersAsync(); await t;
    const p = m.parar(800); await vi.advanceTimersByTimeAsync(200);
    const t2 = m.tocar(); await vi.runAllTimersAsync(); await Promise.all([p, t2]);
    expect(a.paused).toBe(false); expect(m.estado).toBe("tocando");
  });

  it("trocar de faixa tocando: fade-out antes de trocar (sem corte)", async () => {
    const a = fakeAudio(); const m = criarControladorMusica({ criarElemento: () => a });
    const t = m.tocar("/a.mp3"); await vi.runAllTimersAsync(); await t;
    const t2 = m.tocar("/b.mp3"); await vi.advanceTimersByTimeAsync(100);
    expect(a.src).toBe("/a.mp3"); expect(m.estado).toBe("fade");
    await vi.runAllTimersAsync(); await t2;
    expect(a.src).toBe("/b.mp3"); expect(m.estado).toBe("tocando");
  });

  it("avisa quem se inscreve (o leito do cyberespaço faz o cross-fade com isso)", async () => {
    const a = fakeAudio(); const m = criarControladorMusica({ criarElemento: () => a }); const vistos: string[] = [];
    m.inscrever((e) => vistos.push(e));
    const t = m.tocar("/x.mp3"); await vi.runAllTimersAsync(); await t; const p = m.parar(); await vi.runAllTimersAsync(); await p;
    expect(vistos).toEqual(["tocando", "fade", "parado"]);
  });
});
