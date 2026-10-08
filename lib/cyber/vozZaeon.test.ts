import { describe, expect, it } from "vitest";
import { ESPERA_VOZ, FOLGA_FALA, duracaoComAtraso, MAX_TEXTO_VOZ, REPERGUNTA_NOME, bocaDoNivel, criarCacheVoz, falasFixasZaeon, tempoDaFala, textoDaVoz } from "./vozZaeon";
import { ABERTURA, PERGUNTAS } from "./conversaZaeon";
import { HOLO_VOZ, aleatorioComSemente, respostaImpulso, DISTANCIA, VOZ_DROID, SONS, duracaoVozDroid, silabasDroid } from "./audio";

const rms = (d: Float32Array, a: number, b: number) => { let s = 0; for (let i = a; i < b; i++) s += d[i]! * d[i]!; return Math.sqrt(s / Math.max(1, b - a)); };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("voz da Zaeon — o reverb do holograma (resposta ao impulso)", () => {
  it("tem a duração pedida, começa em silêncio (pré-atraso) e o pico é 1", () => {
    const sr = 24000, ir = respostaImpulso(sr, 1.2, 7);
    expect(ir.length).toBe(Math.round(sr * 1.2));
    const pre = Math.round(sr * HOLO_VOZ.preAtraso);
    for (let i = 0; i < pre; i++) expect(ir[i]).toBe(0);
    expect(Math.max(...Array.from(ir, Math.abs))).toBeCloseTo(1, 6);
  });
  it("decai exponencialmente: o fim fica ~−60 dB abaixo do começo", () => {
    const sr = 22050, ir = respostaImpulso(sr, 1.2, 3), n = ir.length, pre = Math.round(sr * HOLO_VOZ.preAtraso);
    const comeco = rms(ir, pre, pre + Math.round(sr * 0.05)), meio = rms(ir, Math.round(n * 0.45), Math.round(n * 0.55)), fim = rms(ir, Math.round(n * 0.92), n);
    expect(meio).toBeLessThan(comeco);
    expect(fim).toBeLessThan(meio);
    expect(fim / comeco).toBeLessThan(0.005);   // < −46 dB (o −60 dB é o envelope no último ponto)
  });
  it("é determinística pela semente; sementes diferentes dão canais diferentes (reverb largo)", () => {
    const a = respostaImpulso(16000, 0.5, 11), b = respostaImpulso(16000, 0.5, 11), c = respostaImpulso(16000, 0.5, 12);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
    const r = aleatorioComSemente(5); const xs = Array.from({ length: 1000 }, r);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0); expect(Math.max(...xs)).toBeLessThan(1);
  });
  it("inteligível primeiro: o seco domina, o reverb é curto e o chorus é leve", () => {
    expect(HOLO_VOZ.molhado).toBeLessThan(0.5);
    expect(HOLO_VOZ.reverbSeg).toBeLessThanOrEqual(1.5);
    expect(HOLO_VOZ.chorusMix).toBeLessThan(0.35);
    expect(HOLO_VOZ.chorusMs - HOLO_VOZ.chorusProfMs).toBeGreaterThan(0);   // o atraso nunca fica negativo
    expect(DISTANCIA.holograma.max).toBeGreaterThan(DISTANCIA.holograma.ref);
  });
});

describe("voz da Zaeon — tempo da fala, boca e texto", () => {
  it("o tempo da fala é o maior entre o fixo e a duração do áudio + a folga", () => {
    expect(tempoDaFala(3.4, null)).toBe(3.4);
    expect(tempoDaFala(3.4, 0)).toBe(3.4);
    expect(tempoDaFala(3.4, 1.2)).toBe(3.4);
    expect(tempoDaFala(3.4, 5)).toBeCloseTo(5 + FOLGA_FALA);
    expect(tempoDaFala(2.6, Number.NaN)).toBe(2.6);
    expect(ESPERA_VOZ.fixa).toBeLessThan(ESPERA_VOZ.gerativa);
  });
  it("voz atrasada: a fala ocupa o que já passou + o áudio inteiro + a folga", () => {
    expect(tempoDaFala(3.4, duracaoComAtraso(1.2, 3))).toBeCloseTo(1.2 + 3 + FOLGA_FALA);
    expect(tempoDaFala(3.4, duracaoComAtraso(-1.5, 1))).toBe(3.4);   // (o fechamento começa com o relógio negativo)
    expect(duracaoComAtraso(Number.NaN, 2)).toBe(2);
  });
  it("a boca segue o nível: baixo fecha, médio entreabre, alto abre", () => {
    expect(bocaDoNivel(0)).toBe("idle");
    expect(bocaDoNivel(0.1)).toBe("idle");
    expect(bocaDoNivel(0.3)).toBe("talk_half");
    expect(bocaDoNivel(0.8)).toBe("talk");
    expect(bocaDoNivel(1)).toBe("talk");
  });
  it("o texto da voz não tem ✦ nem emoji e tem teto", () => {
    expect(textoDaVoz("Oi! Eu sou a Zaeon ✦")).toBe("Oi! Eu sou a Zaeon");
    expect(textoDaVoz("Voando bem! 🚀  ok")).toBe("Voando bem! ok");
    expect(textoDaVoz("x".repeat(1000))).toHaveLength(MAX_TEXTO_VOZ);
  });
  it("as falas fixas incluem a abertura, as perguntas e a repergunta do nome — sem repetição", () => {
    const f = falasFixasZaeon();
    for (const a of ABERTURA) expect(f).toContain(textoDaVoz(a));
    for (const p of PERGUNTAS) expect(f).toContain(textoDaVoz(p.fala));
    expect(f).toContain(textoDaVoz(REPERGUNTA_NOME));
    expect(new Set(f).size).toBe(f.length);
    expect(f.length).toBeGreaterThanOrEqual(10);
    expect(f.length).toBeLessThanOrEqual(24);   // cabe no limite da rota (40/min)
    for (const t of f) expect(t).not.toMatch(/✦/);
  });
});

describe("voz da Zaeon — o cache das sínteses", () => {
  it("o mesmo texto sintetiza uma vez só (o ✦ não muda a chave)", async () => {
    const pedidos: string[] = [];
    const c = criarCacheVoz(async (t) => { pedidos.push(t); return t.length; });
    const [a, b] = await Promise.all([c.pegar("Oi ✦"), c.pegar("Oi")]);
    expect(a).toBe(2); expect(b).toBe(2); expect(pedidos).toEqual(["Oi"]);
    expect(c.tem("Oi ✦")).toBe(true);
  });
  it("no máximo N ao mesmo tempo; o pedido urgente passa na frente da pré-geração", async () => {
    const abertos: { t: string; ok: (v: string) => void }[] = [], ordem: string[] = [];
    const c = criarCacheVoz((t) => new Promise<string>((ok) => { ordem.push(t); abertos.push({ t, ok }); }), { paralelo: 2 });
    c.preaquecer(["a", "b", "c", "d"]);
    await tick(); expect(ordem).toEqual(["a", "b"]);
    const urg = c.pegar("z");
    abertos.shift()!.ok("A"); await tick(); await tick();
    expect(ordem).toEqual(["a", "b", "z"]);
    const z = abertos.find((x) => x.t === "z")!; z.ok("Z");
    expect(await urg).toBe("Z");
  });
  it("falha ou null sai do cache (dá pra tentar de novo)", async () => {
    let n = 0;
    const c = criarCacheVoz(async () => { n++; if (n === 1) throw new Error("rede"); return n === 2 ? null : "ok"; });
    expect(await c.pegar("x")).toBeNull(); expect(c.tem("x")).toBe(false);
    expect(await c.pegar("x")).toBeNull();
    expect(await c.pegar("x")).toBe("ok"); expect(c.tem("x")).toBe(true);
    expect(await c.pegar("  ")).toBeNull();
  });
});

describe("a voz do Droid (sem palavras)", () => {
  it("a duração cresce com o texto, entre o mínimo e o máximo", () => {
    expect(duracaoVozDroid("")).toBe(VOZ_DROID.dur.min);
    expect(duracaoVozDroid("x".repeat(500))).toBe(VOZ_DROID.dur.max);
    expect(duracaoVozDroid("Voando bem! Agora vem comigo.")).toBeGreaterThan(duracaoVozDroid("Oi!"));
  });
  it("as ondas começam no 0, ficam dentro da fala, nos formantes, e são determinísticas pela semente", () => {
    const s = silabasDroid(2.4, 9), s2 = silabasDroid(2.4, 9);
    expect(s).toEqual(s2);
    expect(s[0]!.t).toBe(0);
    expect(s.length).toBeGreaterThanOrEqual(Math.floor(2.4 / VOZ_DROID.silaba.max));
    for (const x of s) {
      expect(x.t).toBeLessThan(2.4);
      expect(x.f1).toBeGreaterThanOrEqual(VOZ_DROID.f1[0]); expect(x.f1).toBeLessThanOrEqual(VOZ_DROID.f1[1]);
      expect(x.f2).toBeGreaterThanOrEqual(VOZ_DROID.f2[0]); expect(x.f2).toBeLessThanOrEqual(VOZ_DROID.f2[1]);
      expect(x.ganho).toBeGreaterThan(0); expect(x.ganho).toBeLessThanOrEqual(1);
    }
    const furia = silabasDroid(2.4, 9, { formantes: VOZ_DROID.furia.formantes });
    expect(furia[0]!.f1).toBeCloseTo(s[0]!.f1 * VOZ_DROID.furia.formantes);
  });
  it("soa longe e sem picotar: quase todo molhado, reverb bem longo, muitos ecos que ainda assim somem; ondas lentas", () => {
    expect(VOZ_DROID.reverb.molhado).toBeGreaterThan(0.75);
    expect(VOZ_DROID.reverb.seg).toBeGreaterThanOrEqual(5);
    expect(VOZ_DROID.silaba.min).toBeGreaterThanOrEqual(0.4);   // pouca modulação (o dono pediu)
    expect(VOZ_DROID.reverb.seg).toBeGreaterThan(HOLO_VOZ.reverbSeg);
    expect(VOZ_DROID.delay.retorno).toBeLessThan(0.7);   // o eco decai (sem realimentar pra sempre)
    expect(SONS["droid-agua"].modo).toBe("pos"); expect(SONS["droid-alien"].modo).toBe("pos");
    expect(SONS["droid-agua"].ext).toBe("wav");
  });
});
