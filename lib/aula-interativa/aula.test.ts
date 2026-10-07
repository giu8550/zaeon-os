import { describe, it, expect, vi } from "vitest";
import { normalizarAula, separarMarcas, confereLacuna } from "./contrato";
import { temposDoBeat, duracaoWav, duracaoEstimada } from "./tempo";
import { momentos, legendaEm, placar } from "./momentos";
import { gerarAula } from "./gerar";
import { ROTEIRO_EXEMPLO } from "./fixture";
import { pcmToWav } from "@/lib/studio/wav";
import { pedeAula, assuntoDe } from "@/lib/agent/aprender";
import { classifyHeuristic } from "@/lib/agent/router";
import { pickStudioKind } from "@/lib/agent/aura-harness";

describe("marcas na narração", () => {
  it("tira as [[marcas]] e aponta pro começo da palavra seguinte", () => {
    const { limpa, marcas } = separarMarcas("Três coisas. [[luz]]Luz, [[agua]] água.");
    expect(limpa).toBe("Três coisas. Luz, água.");
    expect(limpa.slice(marcas.luz)).toMatch(/^Luz/);
    expect(limpa.slice(marcas.agua)).toMatch(/^água/);
  });
});

describe("normalizarAula", () => {
  it("o roteiro de exemplo passa sem problemas e ganha o placar no fim", () => {
    const { aula, problemas } = normalizarAula(ROTEIRO_EXEMPLO);
    expect(problemas).toEqual([]);
    expect(aula.beats[0].tipo).toBe("intro");
    expect(aula.beats.at(-1)).toMatchObject({ tipo: "fim", id: "fim" });
    expect(aula.beats.find((b) => b.id === "q1")?.pergunta?.id).toBe("c-q1");
    expect(aula.beats.find((b) => b.id === "p1")?.pergunta?.id).toBe("p-p1");
  });
  it("marca que a narração não diz é largada (o item entra na ordem); pergunta inválida derruba o beat", () => {
    const { aula, problemas } = normalizarAula({
      titulo: "X",
      beats: [
        { tipo: "licao", titulo: "a", narracao: "Sem marcas aqui.", cena: { layout: "passos", itens: [{ texto: "um", marca: "fantasma" }] } },
        { tipo: "checagem", titulo: "q", narracao: "?", pergunta: { tipo: "escolha", enunciado: "?", opcoes: ["a"], correta: 3 } },
      ],
    });
    const passos = aula.beats.find((b) => b.tipo === "licao")!.cena as any;
    expect(passos.itens[0].marca).toBeUndefined();
    expect(aula.beats.some((b) => b.tipo === "checagem")).toBe(false);
    expect(aula.beats[0].tipo).toBe("intro");     // moldura criada
    expect(problemas.join(" ")).toMatch(/lição/);
    expect(problemas.join(" ")).toMatch(/prática/);
  });
  it("lacuna aceita sem acento, vírgula decimal e fração equivalente", () => {
    expect(confereLacuna(" Agua ", ["água"])).toBe(true);
    expect(confereLacuna("0,5", ["1/2"])).toBe(true);
    expect(confereLacuna("2/4", ["0.5"])).toBe(true);
    expect(confereLacuna("1/0", ["0"])).toBe(false);
    expect(confereLacuna("", ["x"])).toBe(false);
  });
});

describe("tempos", () => {
  it("marcas caem proporcionalmente dentro da duração real; legendas por frase", () => {
    const t = temposDoBeat("Primeiro, [[clara]]a fase clara. Depois, [[calvin]]o ciclo de Calvin.", 6);
    expect(t.duracao).toBe(6);
    expect(t.marcas.clara).toBeGreaterThan(0.2);
    expect(t.marcas.calvin).toBeGreaterThan(t.marcas.clara);
    expect(t.marcas.calvin).toBeLessThan(6);
    expect(t.legendas.map((l) => l[1])).toEqual(["Primeiro, a fase clara.", "Depois, o ciclo de Calvin."]);
    expect(legendaEm(t, t.legendas[1][0] + 0.1)).toBe("Depois, o ciclo de Calvin.");
  });
  it("sem áudio, a duração vem da fala estimada; WAV mede pelo cabeçalho", () => {
    expect(duracaoEstimada("curto")).toBe(2.5);
    const wav = pcmToWav(Buffer.alloc(48000), { sampleRate: 24000, channels: 1, bitsPerSample: 16 } as any);
    expect(duracaoWav(wav)).toBeCloseTo(1, 2);
    expect(duracaoWav(Buffer.from("nada"))).toBe(0);
  });
  it("momentos: marca manda; sem marca entra na ordem; nunca abre vazio", () => {
    const { aula } = normalizarAula(ROTEIRO_EXEMPLO);
    const b = aula.beats.find((x) => x.id === "entradas")!;
    const t = temposDoBeat(b.narracao, 5);
    const q = momentos(b.cena, t);
    expect(q.i0).toBe(t.marcas.luz);
    expect(q.i2).toBe(t.marcas.co2);
    const semTitulo = momentos({ layout: "passos", itens: [{ texto: "a", marca: "m" }] }, { duracao: 6, marcas: { m: 3 }, legendas: [] });
    expect(semTitulo.i0).toBe(0.4); // palco vazio até 3 s → antecipa
    const semMarca = momentos({ layout: "passos", itens: [{ texto: "a" }, { texto: "b" }] }, { duracao: 4, marcas: {}, legendas: [] });
    expect(semMarca.i0).toBeLessThanOrEqual(0.4);
    expect(semMarca.i1).toBeGreaterThan(semMarca.i0);
  });
  it("placar soma só a primeira tentativa por prefixo", () => {
    expect(placar({ "c-a": { certas: 1, total: 1 }, "c-b": { certas: 0, total: 1 }, "p-x": { certas: 2, total: 3 } }, "c-")).toEqual({ certas: 1, total: 2 });
  });
});

describe("gerarAula (modelo e voz falsos)", () => {
  it("plano → roteiro → narração por beat; beat sem áudio toca no relógio estimado", async () => {
    const gerarJson = vi.fn().mockResolvedValueOnce({ titulo: "Fotossíntese", roteiro: [] }).mockResolvedValueOnce(ROTEIRO_EXEMPLO);
    const sintetizar = vi.fn(async (t: string) => (t.startsWith("Checagem") ? null : { audio: Buffer.from("x"), ext: "mp3" as const, duracao: 4 }));
    const gravados: string[] = [];
    const r = await gerarAula({ tema: "fotossíntese", sala: "estudos" }, { gerarJson: gerarJson as any, sintetizar, gravarAudio: async (id, n) => { gravados.push(id); return n.ext; } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(gerarJson).toHaveBeenCalledTimes(2);
    expect(gerarJson.mock.calls[1][1]).toContain("PLANO aprovado");
    expect(r.tempos.entradas).toMatchObject({ duracao: 4, audio: "mp3" });
    expect(r.tempos.q1.audio).toBeUndefined();
    expect(r.semAudio).toBe(false);
    expect(gravados).toContain("intro");
    expect(sintetizar.mock.calls.every(([t]) => !t.includes("[["))).toBe(true); // a voz não lê as marcas
  });
  it("estrutura faltando → 1 reparo com os problemas; sem lições nem depois → falha", async () => {
    const ruim = { titulo: "X", beats: [{ tipo: "licao", titulo: "a", narracao: "oi", cena: { layout: "resumo", itens: ["x"] } }] };
    const g = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(ruim).mockResolvedValueOnce(ROTEIRO_EXEMPLO);
    const r = await gerarAula({ tema: "x" }, { gerarJson: g as any });
    expect(r.ok).toBe(true);
    expect(g.mock.calls[2][1]).toContain("tinha estes problemas");
    const g2 = vi.fn().mockResolvedValue(ruim);
    expect((await gerarAula({ tema: "x" }, { gerarJson: g2 as any })).ok).toBe(false);
  });
  it("PDF vai junto pro modelo (o Gemini lê PDF nativo)", async () => {
    const g = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce(ROTEIRO_EXEMPLO);
    await gerarAula({ tema: "", pdf: { base64: "JVBERi0=", nome: "cap3.pdf" } }, { gerarJson: g as any });
    expect(g.mock.calls[0][2].pdf).toEqual({ base64: "JVBERi0=", nome: "cap3.pdf" });
    expect(g.mock.calls[0][1]).toContain("cap3.pdf");
  });
});

describe("gatilho da aula", () => {
  it("'me dá uma aula sobre X' vira gerar_artefato → kind aula; vídeo também vira aula", () => {
    expect(pedeAula("Me dá uma aula sobre fotossíntese")).toBe(true);
    expect(pedeAula("explica isso a fundo")).toBe(true);
    expect(pedeAula("me explica a fotossíntese")).toBe(false);
    expect(classifyHeuristic("me dá uma aula sobre fotossíntese", { activeTab: "estudos" } as any).intent).toBe("gerar_artefato");
    expect(pickStudioKind("me dá uma aula sobre fotossíntese")).toBe("aula");
    expect(pickStudioKind("faz um vídeo sobre a revolução francesa")).toBe("aula");
    expect(assuntoDe("me dá uma aula sobre fotossíntese")).toBe("fotossíntese");
  });
});
