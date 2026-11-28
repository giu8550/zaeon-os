/**
 * O teste em lote da IA (lib/eval/loteIa): as conferências, o executor e o relatório — com respostas falsas, sem rede
 * e sem gastar crédito. Quem chama o provedor de verdade é scripts/eval-ia-lote.ts (workflow manual eval-ia.yml).
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CASOS_IMAGEM, CASOS_LABS, CASOS_VOZ, aprovado, conferirBiosim, conferirCodelab, conferirImagem, conferirQuantum, conferirVoz,
  percentil, relatorioMd, resumir, rodarLote, semSegredo, type Resultado,
} from "@/lib/eval/loteIa";
import { CODELAB_SYSTEM, QUANTUM_SYSTEM, promptBiosim } from "@/lib/agentic/prompts";
import { FORMATO_VOZ, pcmToWav } from "@/lib/studio/wav";

const ler = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");

describe("conferências dos laboratórios", () => {
  it("CodeLab: precisa de 'response'; se pediu mudança, também de 'updatedCode'", () => {
    expect(conferirCodelab(false)('{"response":"Esta função soma dois números."}').ok).toBe(true);
    expect(conferirCodelab(true)('{"response":"Pronto, comentei cada linha."}')).toEqual({ ok: false, motivo: "pediu código e não veio 'updatedCode'" });
    expect(conferirCodelab(false)("texto solto")).toEqual({ ok: false, motivo: "não veio JSON" });
    expect(conferirCodelab(false)('```json\n{"response":"Explicação com cerca de markdown."}\n```').ok).toBe(true);
  });

  it("QuantumLab: vizMode válido e o esperado, com título", () => {
    expect(conferirQuantum("blochSphere")('{"vizMode":"blochSphere","title":"Qubit"}').ok).toBe(true);
    expect(conferirQuantum("blochSphere")('{"vizMode":"energyLevels","title":"x"}')).toEqual({ ok: false, motivo: "vizMode energyLevels, esperado blochSphere" });
    expect(conferirQuantum("blochSphere")('{"vizMode":"inventado","title":"x"}').ok).toBe(false);
  });

  it("BioSim: intent esperado; molécula precisa de query; descriptor precisa do descriptor", () => {
    expect(conferirBiosim("molecule")('{"intent":"molecule","query":"caffeine"}').ok).toBe(true);
    expect(conferirBiosim("molecule")('{"intent":"molecule"}')).toEqual({ ok: false, motivo: "sem 'query'" });
    expect(conferirBiosim("descriptor")('{"intent":"descriptor","descriptor":{"renderMode":"cell"}}').ok).toBe(true);
    expect(conferirBiosim("protein")('{"intent":"descriptor","descriptor":{}}').ok).toBe(false);
  });

  it("os casos usam o MESMO prompt das rotas (lib/agentic/prompts), e as rotas usam esse arquivo", () => {
    const labs = CASOS_LABS.map((c) => c.entrada);
    expect(labs.filter((e) => e.lab === "codelab").every((e) => e.system === CODELAB_SYSTEM)).toBe(true);
    expect(labs.filter((e) => e.lab === "quantum").every((e) => e.system === QUANTUM_SYSTEM)).toBe(true);
    expect(labs.find((e) => e.lab === "biosim")!.system).toBe(promptBiosim("bio"));
    expect(ler("app/api/agentic/codelab/route.ts")).toMatch(/CODELAB_SYSTEM, mensagemCodelab/);
    expect(ler("app/api/agentic/quantum/route.ts")).toMatch(/QUANTUM_SYSTEM, mensagemQuantum/);
    expect(ler("app/api/agentic/biosim/route.ts")).toMatch(/promptBiosim\(courseRoom\)/);
    for (const p of ["codelab", "quantum"]) expect(ler(`app/api/agentic/${p}/route.ts`)).not.toMatch(/const SYSTEM_PROMPT/);
  });
});

describe("conferências da voz e da imagem", () => {
  const wav = (segundos: number, fmt = FORMATO_VOZ) => pcmToWav(Buffer.alloc(Math.round(segundos * fmt.sampleRate) * 2 * fmt.channels, 1), fmt);

  it("voz: WAV 24 kHz mono e com a duração mínima", () => {
    expect(conferirVoz(1)(wav(2)).ok).toBe(true);
    expect(conferirVoz(15)(wav(2))).toMatchObject({ ok: false, motivo: expect.stringMatching(/áudio curto demais/) });
    expect(conferirVoz(1)(wav(2, { sampleRate: 22050, bitsPerSample: 16, channels: 1 })).ok).toBe(false);
    expect(conferirVoz(1)(Buffer.from("não é wav"))).toEqual({ ok: false, motivo: "não é WAV" });
  });

  it("imagem: PNG de verdade, não um pixel", () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(30_000, 7)]);
    expect(conferirImagem({ data: png.toString("base64"), mimeType: "image/png" }).ok).toBe(true);
    expect(conferirImagem({ data: png.subarray(0, 100).toString("base64"), mimeType: "image/png" }).ok).toBe(false);
    expect(conferirImagem({ data: png.toString("base64"), mimeType: "image/jpeg" }).ok).toBe(false);
  });

  it("tem caso de cada tipo: voz curta, masculina e longa (vários trechos); 3 imagens", () => {
    expect(CASOS_VOZ.map((c) => c.entrada.voz)).toEqual(expect.arrayContaining(["leda", "Charon"]));
    expect(CASOS_VOZ.some((c) => c.entrada.texto.length > 450)).toBe(true);
    expect(CASOS_IMAGEM).toHaveLength(3);
  });
});

describe("executor e relatório", () => {
  it("roda cada caso N vezes; erro vira falha com motivo, sem o token", async () => {
    let t = 0;
    const chamar = vi.fn(async (c: (typeof CASOS_LABS)[number]) => {
      if (c.id.includes("python")) throw new Error("fal-ai 402 com Bearer hf_ABCDEFGH123 e token hf_ZZZZZZZZ9");
      if (c.entrada.lab === "codelab") return '{"response":"Explicação curta e certa.","updatedCode":"x"}';
      if (c.entrada.lab === "quantum") return JSON.stringify({ vizMode: c.id.includes("qubit") ? "blochSphere" : c.id.includes("níveis") ? "energyLevels" : c.id.includes("fenda") ? "doubleSlit" : "waveFunction", title: "t" });
      return c.id.includes("cafeína") ? '{"intent":"molecule","query":"caffeine"}' : c.id.includes("hemoglobina") ? '{"intent":"protein","query":"hemoglobin"}' : '{"intent":"descriptor","descriptor":{"renderMode":"cell"}}';
    });
    const rs = await rodarLote(CASOS_LABS, chamar, { vezes: 2, agora: () => (t += 100) });
    expect(chamar).toHaveBeenCalledTimes(CASOS_LABS.length * 2);
    const py = rs.filter((r) => r.id.includes("python"));
    expect(py.every((r) => !r.ok)).toBe(true);
    expect(py[0]!.motivo).toContain("hf_***");
    expect(py[0]!.motivo).not.toMatch(/ABCDEFGH|ZZZZZZZZ/);
    expect(rs.filter((r) => r.ok)).toHaveLength((CASOS_LABS.length - 1) * 2);
  });

  it("aprovado só com acerto >= mínimo; percentil e resumo por caso", () => {
    const rs: Resultado[] = [
      ...Array.from({ length: 9 }, (_, i) => ({ area: "voz" as const, id: "voz · a", ok: true, ms: (i + 1) * 1000 })),
      { area: "voz", id: "voz · a", ok: false, ms: 10_000, motivo: "fal-ai 500" },
    ];
    expect(aprovado(rs, 0.9)).toBe(true);
    expect(aprovado(rs, 0.95)).toBe(false);
    expect(aprovado([], 0.9)).toBe(false);
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(resumir(rs)[0]).toMatchObject({ total: 10, acertos: 9, motivos: ["fal-ai 500"] });
  });

  it("o relatório diz se passou, o acerto de cada área e o motivo de cada falha", () => {
    const rs: Resultado[] = [
      { area: "labs", id: "quantum · qubit", ok: true, ms: 800 },
      { area: "labs", id: "quantum · qubit", ok: false, ms: 900, motivo: "vizMode a|b" },
      { area: "imagem", id: "imagem · vulcão", ok: true, ms: 4000 },
    ];
    const md = relatorioMd(rs, { vezes: 2, minimo: 0.9 });
    expect(md).toContain("❌ Não passou");
    expect(md).toContain("2 de 3 pedidos certos (67%");
    expect(md).toContain("## Laboratórios: 1/2 (50%)");
    expect(md).toContain("| quantum · qubit | 1/2 |");
    expect(md).toContain("vizMode a/b");   // o | não quebra a tabela
    expect(md).toContain("## Imagem: 1/1 (100%)");
    expect(md).not.toContain("## Voz");
  });

  it("semSegredo tira token do HF e Bearer", () => {
    expect(semSegredo("Authorization: Bearer abc.def hf_1234567890")).toBe("Authorization: Bearer *** hf_***");
  });
});

describe("o workflow só roda à mão e não vaza o token", () => {
  const wf = ler(".github/workflows/eval-ia.yml");
  it("só workflow_dispatch (gasta créditos do HF), com o token dos secrets e as entradas por env", () => {
    expect(wf).toMatch(/on:\s*\n\s*workflow_dispatch:/);
    expect(wf).not.toMatch(/^\s*(push|pull_request|schedule):/m);
    expect(wf).toContain("HF_TOKEN: ${{ secrets.HF_TOKEN }}");
    expect(wf).not.toMatch(/run:[^\n]*\$\{\{\s*github\.event\.inputs/);   // entrada só por env (sem injeção no shell)
    expect(wf).toContain("scripts/eval-ia-lote.ts");
  });
});
