import { describe, expect, it } from "vitest";
import { pcmToWav, concatWav } from "@/lib/studio/wav";
import { duracaoWav, gerarVideoDoc, type GerarDeps, type MetaVideoDoc } from "./gerar-server";
import { inicios, lerRoteiro, promptRoteiro } from "./roteiro";

const slide = (n: number) => ({ titulo: `S${n}`, topicos: [{ id: "t1", texto: "a" }, { id: "t2", texto: "b" }], frases: [{ fala: "um", legenda: "1", alvo: "t2" }, { fala: "dois", alvo: "zz" }] });
const roteiroBruto = { titulo: "Zether", slides: [slide(1), slide(2), slide(3)] };
const meta: MetaVideoDoc = { chave: "doi:10.1007/z", publico: true, blueprints: [], documento: { titulo: "Zether", tipo: "artigo" } };
/** 1 s de silêncio por frase (24 kHz, 16 bits, mono) */
const wav1s = () => pcmToWav(Buffer.alloc(48000));

describe("o roteiro", () => {
  it("poda: alvo inexistente vira 'titulo', legenda vazia vira a fala; menos de 3 slides = null", () => {
    const r = lerRoteiro(roteiroBruto)!;
    expect(r.slides).toHaveLength(3); expect(r.slides[0]!.frases[0]).toEqual({ fala: "um", legenda: "1", alvo: "t2" });
    expect(r.slides[0]!.frases[1]).toEqual({ fala: "dois", legenda: "dois", alvo: "titulo" });
    expect(lerRoteiro({ slides: [slide(1), slide(2)] })).toBeNull(); expect(lerRoteiro("x")).toBeNull();
  });
  it("corta o texto do documento e os tempos somam as durações", () => {
    expect(promptRoteiro({ titulo: "T", texto: "x".repeat(50_000) }).length).toBeLessThan(31_000);
    expect(inicios([1.5, 2, 0.5])).toEqual({ tempos: [0, 1.5, 3.5], total: 4 });
  });
});

describe("gerarVideoDoc", () => {
  const deps = (o: Partial<GerarDeps> = {}) => {
    const marcas: unknown[] = []; let gravado: Buffer | null = null;
    const d: GerarDeps = { gen: async <T,>() => roteiroBruto as T, tts: async () => wav1s(), concat: concatWav, gravar: async (_id, w) => { gravado = w; }, marcar: async (_id, data) => { marcas.push(data); }, ...o };
    return { d, marcas, gravado: () => gravado };
  };
  it("roteiro → narração frase a frase → um WAV e os tempos de cada frase", async () => {
    const x = deps();
    expect(await gerarVideoDoc("a".repeat(24), { titulo: "Zether", texto: "texto", meta }, x.d)).toBe("done");
    const fim = x.marcas.at(-1) as { status: string; meta: { tempos: number[]; duracao: number } };
    expect(fim.status).toBe("done"); expect(fim.meta.tempos).toEqual([0, 1, 2, 3, 4, 5]); expect(fim.meta.duracao).toBe(6);
    expect(duracaoWav(x.gravado()!)).toBeCloseTo(6);
  });
  it("modelo devolveu lixo → erro com motivo (não trava)", async () => {
    const x = deps({ gen: async <T,>() => ({ nada: 1 }) as T });
    expect(await gerarVideoDoc("a".repeat(24), { titulo: "Z", texto: "t", meta }, x.d)).toBe("error");
    expect(x.marcas.at(-1)).toMatchObject({ status: "error", error: expect.stringContaining("roteiro") });
  });
  it("checagem que falha mantém o roteiro original", async () => {
    let n = 0; const x = deps({ gen: async <T,>() => (n++ === 0 ? roteiroBruto : { quebrado: true }) as T });
    expect(await gerarVideoDoc("a".repeat(24), { titulo: "Z", texto: "t", meta }, x.d)).toBe("done");
  });
});

describe("posicaoNoVideo — o player sincroniza por aqui", () => {
  it("slide, frase, alvo aceso e tópicos revelados conforme o tempo", async () => {
    const { posicaoNoVideo } = await import("./roteiro");
    const r = lerRoteiro(roteiroBruto)!, tempos = [0, 1, 2, 3, 4, 5];
    expect(posicaoNoVideo(r, tempos, 0.5)).toMatchObject({ frase: 0, slide: 0, alvo: "t2", legenda: "1" });
    const p = posicaoNoVideo(r, tempos, 1.2);
    expect(p).toMatchObject({ frase: 1, slide: 0, alvo: "titulo" }); expect([...p.revelados].sort()).toEqual(["t2", "titulo"]);
    expect(posicaoNoVideo(r, tempos, 2.1)).toMatchObject({ slide: 1, frase: 2 });
    expect(posicaoNoVideo(r, tempos, 99).slide).toBe(2);
    expect(p.inicioSlide).toEqual([0, 2, 4]);
  });
});
