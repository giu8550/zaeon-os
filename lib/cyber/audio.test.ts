import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { CRISTAIS_PERTO, DISTANCIA, SINTESE, SONS_ARQUIVO, sintetizarBaque, sintetizarJetpack, FADE_ENTRADA, NAVE_DESCIDA, PASSOS, TAXA_432, fatorCristais, eventosNave, somNaveInicial, SONS, cadenciaPasso, criarLimiteVozes, fatorLeito, lerPrefs, urlDoSom, type NomeSom } from "./audio";

describe("áudio do cyberespaço", () => {
  it("os 22 sons de arquivo existem (21 .ogg + o jato .wav) e os sintetizados têm gerador em public/assets/sounds/cyber e cada um tem modo (posicional × 2D)", () => {
    const arquivos = readdirSync(join(process.cwd(), "public/assets/sounds/cyber")).filter((f) => /\.(ogg|wav)$/.test(f)).sort();
    expect(SONS_ARQUIVO.map((n) => urlDoSom(n).split("/").pop()!).sort()).toEqual(arquivos);
    expect(arquivos).toHaveLength(22);
    for (const n of Object.keys(SONS) as NomeSom[]) if (SONS[n].sintetico) expect(SINTESE[n]).toBeTypeOf("function");
    expect(Object.keys(SONS)).not.toContain("whoosh-hyperspace");   // trocado pelo cyber-enter
    expect(urlDoSom("ship-flight")).toBe("/assets/sounds/cyber/ship-flight.ogg");
  });
  it("sem fogo nem sentar: a base fica só com os cristais; entrar no cyberespaço não dispara 'sentar'", () => {
    expect(Object.keys(SONS)).not.toContain("fire");
    expect(Object.keys(SONS)).not.toContain("sit");
    expect(FADE_ENTRADA).toBeGreaterThan(0.5);
  });
  it("leito e UI são 2D; fontes do mundo e a nave são posicionais", () => {
    const d2: NomeSom[] = ["space-bed", "cyber-enter", "study-confirm", "chat-pop"];
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
  it("nave: SUBIR = decolagem; começar a DESCER = motor baixando (1×); tocar o chão = touchdown (1×)", () => {
    const dt = 1 / 60; let e = somNaveInicial(true);
    const passo = (pousado: boolean, vy: number, altura: number) => { const r = eventosNave(e, { pousado, vy, altura }, dt); e = r.e; return r; };
    expect(passo(false, 10, 1).decolou).toBe(true);
    for (let i = 0; i < 120; i++) expect(passo(false, 20, 10 + i).desceu).toBe(false);   // subindo: nada
    const des = [] as boolean[]; for (let i = 0; i < 90; i++) des.push(passo(false, -30, 60 - i * 0.5).desceu);
    expect(des.filter(Boolean)).toHaveLength(1);                                        // começou a descer: uma vez só
    expect(passo(false, -6, 10).desceu).toBe(false);                                    // histerese: ainda descendo, sem repetir
    expect(passo(true, 0, 0).pousou).toBe(true);
    expect(passo(true, 0, 0).pousou).toBe(false);                                       // o impacto é 1× só
    // pertinho do chão não dispara a "descida" (só o touchdown)
    e = somNaveInicial(false); expect(passo(false, -20, NAVE_DESCIDA.alturaMin - 1).desceu).toBe(false);
  });
  it("nave: ajustar a altura sobe/desce/sobe não repete a descida antes do intervalo", () => {
    const dt = 0.1; let e = somNaveInicial(false), n = 0;
    for (let i = 0; i < 20; i++) { const vy = i % 4 < 2 ? -20 : 15; const r = eventosNave(e, { pousado: false, vy, altura: 50 }, dt); e = r.e; if (r.desceu) n++; }
    expect(n).toBeLessThanOrEqual(Math.ceil((20 * dt) / NAVE_DESCIDA.intervalo) + 1);
  });
  it("leito em 432 Hz: a faixa (A=440) toca a 432/440 → −31,8 cents", () => {
    expect(SONS["space-bed"].taxa).toBe(TAXA_432);
    expect(1200 * Math.log2(TAXA_432)).toBeCloseTo(-31.8, 1);
  });
  it("cristais: só perto da base (somem de verdade longe); passos mais altos", () => {
    expect(fatorCristais(0)).toBe(1); expect(fatorCristais(CRISTAIS_PERTO.cheio)).toBe(1);
    expect(fatorCristais(CRISTAIS_PERTO.some)).toBe(0); expect(fatorCristais(40)).toBe(0);
    expect(fatorCristais(8)).toBeGreaterThan(0); expect(fatorCristais(8)).toBeLessThan(1);
    expect(DISTANCIA.cristais.modelo).toBe("linear");   // no "inverse" o max não corta
    expect(SONS["step-1"].volume).toBeGreaterThanOrEqual(0.6);
    expect(DISTANCIA.eu.ref).toBeGreaterThan(DISTANCIA.perto.ref);   // meus passos não somem com a câmera atrás
  });
  it("jato sintetizado: loop sem clique (a ponta casa com o começo), sem estourar", () => {
    const sr = 22050, x = sintetizarJetpack(sr, 2);
    expect(x.length).toBe(sr * 2);
    let pico = 0, soma = 0; for (const v of x) { pico = Math.max(pico, Math.abs(v)); soma += v * v; }
    expect(pico).toBeLessThanOrEqual(0.81); expect(Math.sqrt(soma / x.length)).toBeGreaterThan(0.05);
    expect(Math.abs(x[x.length - 1]! - x[0]!)).toBeLessThan(0.15);   // emenda: o último encosta no primeiro
  });
  it("baque: curto, grave, começa e termina sem clique", () => {
    const sr = 22050, x = sintetizarBaque(sr);
    expect(x.length).toBe(Math.round(sr * 0.5)); expect(Math.abs(x[0]!)).toBeLessThan(0.1); expect(Math.abs(x[x.length - 1]!)).toBeLessThan(0.01);
    let cruz = 0; for (let i = 1; i < x.length; i++) if ((x[i - 1]! < 0) !== (x[i]! < 0)) cruz++;
    expect(cruz / 0.5).toBeLessThan(400);   // grave (poucos cruzamentos por segundo)
  });
});
