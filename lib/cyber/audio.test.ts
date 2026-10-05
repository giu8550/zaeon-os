import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { DISTANCIA, FADE_ENTRADA, PASSOS, SONS, cadenciaPasso, criarLimiteVozes, fatorLeito, lerPrefs, urlDoSom, type NomeSom } from "./audio";

describe("áudio do cyberespaço", () => {
  it("os 20 sons existem em public/assets/sounds/cyber e cada um tem modo (posicional × 2D)", () => {
    const arquivos = readdirSync(join(process.cwd(), "public/assets/sounds/cyber")).filter((f) => f.endsWith(".ogg")).map((f) => f.replace(".ogg", "")).sort();
    expect(Object.keys(SONS).sort()).toEqual(arquivos);
    expect(arquivos).toHaveLength(20);
    expect(urlDoSom("ship-flight")).toBe("/assets/sounds/cyber/ship-flight.ogg");
  });
  it("sem fogo nem sentar: a base fica só com os cristais; entrar no cyberespaço não dispara 'sentar'", () => {
    expect(Object.keys(SONS)).not.toContain("fire");
    expect(Object.keys(SONS)).not.toContain("sit");
    expect(FADE_ENTRADA).toBeGreaterThan(0.5);
  });
  it("leito e UI são 2D; fontes do mundo e a nave são posicionais", () => {
    const d2: NomeSom[] = ["space-bed", "whoosh-hyperspace", "study-confirm", "chat-pop"];
    for (const [n, s] of Object.entries(SONS)) expect(s.modo).toBe(d2.includes(n as NomeSom) ? "2d" : "pos");
    for (const n of ["ship-flight", "ship-idle", "space-bed", "blackhole-hum", "crystals"] as NomeSom[]) expect(SONS[n].loop).toBe(true);
  });
  it("preferências: ligado por padrão, '0' desliga; volume mestre 0..1 (padrão 0,8)", () => {
    expect(lerPrefs(() => null)).toEqual({ ligado: true, volume: 0.8 });
    const m = new Map([["zaeon_sfx", "0"], ["zaeon_volume", "1.7"]]);
    expect(lerPrefs((k) => m.get(k) ?? null)).toEqual({ ligado: false, volume: 1 });
    expect(lerPrefs(() => { throw new Error("bloqueado"); })).toEqual({ ligado: true, volume: 0.8 });
  });
  it("teto de vozes: não passa de 12 one-shots simultâneos", () => {
    const v = criarLimiteVozes(12);
    for (let i = 0; i < 12; i++) expect(v.pegar()).toBe(true);
    expect(v.pegar()).toBe(false); v.soltar(); expect(v.pegar()).toBe(true);
  });
  it("distância: some longe; a nave de quem pilota quase não paneia", () => {
    expect(DISTANCIA.padrao.max).toBeGreaterThan(DISTANCIA.padrao.ref);
    expect(DISTANCIA.naveLocal.rolloff).toBeLessThan(DISTANCIA.grande.rolloff);
  });
  it("passos alternam 3 arquivos; correndo, mais rápido", () => {
    expect(PASSOS).toEqual(["step-1", "step-2", "step-3"]);
    expect(cadenciaPasso(true)).toBeLessThan(cadenciaPasso(false));
  });
  it("leito ambiente: abaixa com a música da intro tocando, sobe no fade (cross-fade)", () => {
    expect(fatorLeito("tocando")).toBeLessThan(fatorLeito("fade"));
    expect(fatorLeito("fade")).toBeLessThan(fatorLeito("parado"));
  });
});
