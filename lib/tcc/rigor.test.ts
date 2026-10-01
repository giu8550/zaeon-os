import { describe, it, expect, vi } from "vitest";
import {
  chamadaAutorData, citaNoTexto, criticar, fonteDe, lapidarComRigor, MAX_SUGESTOES, papersCitaveis, promptRigor, SPEC_RIGOR,
} from "@/lib/tcc/rigor";
import type { Paper } from "@/lib/scholar/types";

const paper = (x: Partial<Paper> = {}): Paper => ({
  id: "p", title: "Photosynthesis under stress", authors: ["Maria Souza", "João Lima"], year: 2021,
  venue: "Plant Journal", doi: "10.1/x", openAccess: true, sources: ["openalex"], ...x,
});
const secoes = [
  { id: "introducao", titulo: "INTRODUÇÃO", corpo: "intro" },
  { id: "metodologia", titulo: "METODOLOGIA", corpo: "" },
];

describe("contrato", () => {
  it("o rigor é o contrato `revisar` (crítico full), não um modelo novo", () => {
    expect(SPEC_RIGOR.critic).toBe("full");
  });
});

describe("ABNT", () => {
  it("chamada autor-data: sobrenome do 1º autor + ano; PubMed; et al.; sem ano", () => {
    expect(chamadaAutorData(paper())).toBe("SOUZA, 2021");
    expect(chamadaAutorData(paper({ authors: ["Doudna J"] }))).toBe("DOUDNA, 2021");
    expect(chamadaAutorData(paper({ authors: ["A B", "C D", "E F", "G H"] }))).toBe("B et al., 2021");
    expect(chamadaAutorData(paper({ authors: [], year: undefined }))).toBe("PHOTOSYNTHESIS, [s.d.]");
  });
  it("citaNoTexto ignora caixa e acento", () => {
    expect(citaNoTexto("segundo Souza (2021)", paper())).toBe(true);
    expect(citaNoTexto("segundo Souza", paper())).toBe(false);
  });
  it("fonteDe gera a referência NBR 6023 + url/doi", () => {
    const f = fonteDe(paper({ url: "https://u" }));
    expect(f.abnt).toContain("SOUZA, Maria; LIMA, João. Photosynthesis under stress. Plant Journal, 2021.");
    expect(f).toMatchObject({ doi: "10.1/x", url: "https://u", titulo: "Photosynthesis under stress" });
    expect(fonteDe(paper({ doi: undefined }))).not.toHaveProperty("doi");
  });
  it("papersCitaveis: precisa de título e (autor ou ano); teto de 8", () => {
    const ps = [paper({ title: "" }), paper({ authors: [], year: undefined }), ...Array.from({ length: 10 }, () => paper())];
    expect(papersCitaveis(ps)).toHaveLength(8);
  });
});

describe("o CRÍTICO (determinístico)", () => {
  const papers = [paper(), paper({ authors: ["Ana Reis"], year: 2019 })];

  it("derruba: sem fonte, fonte fora do intervalo, seção inexistente, remover, corpo vazio, op inválida", () => {
    const { sugestoes, descartadas } = criticar([
      { secaoId: "introducao", op: "anexar", corpo: "x", fontes: [] },
      { secaoId: "introducao", op: "anexar", corpo: "x", fontes: [9, 0, "a"] },
      { secaoId: "nao-existe", op: "substituir", corpo: "x", fontes: [1] },
      { secaoId: "introducao", op: "remover", corpo: "x", fontes: [1] },
      { secaoId: "introducao", op: "anexar", corpo: "   ", fontes: [1] },
      { secaoId: "introducao", op: "explodir", corpo: "x", fontes: [1] },
      { op: "inserir", corpo: "x", fontes: [1] }, // inserir sem título
      null,
    ], secoes, papers);
    expect(sugestoes).toEqual([]);
    expect(descartadas).toBe(8);
  });
  it("aprova com fonte; põe a chamada autor-data que faltar; dedupe de índices; anexa a referência", () => {
    const { sugestoes } = criticar([
      { secaoId: "introducao", op: "anexar", corpo: "Segundo Souza (2021), a luz limita.", fontes: [1, 1, 2], nota: " por quê " },
    ], secoes, papers);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].corpo).toBe("Segundo Souza (2021), a luz limita. (REIS, 2019).");
    expect(sugestoes[0].fontes.map((f) => f.titulo)).toEqual(["Photosynthesis under stress", "Photosynthesis under stress"]);
    expect(sugestoes[0].nota).toBe("por quê");
    expect(sugestoes[0].secaoId).toBe("introducao");
  });
  it("inserir leva o título (não secaoId); teto de sugestões", () => {
    const muitas = Array.from({ length: MAX_SUGESTOES + 2 }, () => ({ op: "inserir", titulo: " Hipóteses ", corpo: "h (SOUZA, 2021)", fontes: [1] }));
    const { sugestoes, descartadas } = criticar(muitas, secoes, papers);
    expect(sugestoes).toHaveLength(MAX_SUGESTOES);
    expect(descartadas).toBe(2);
    expect(sugestoes[0]).toMatchObject({ op: "inserir", titulo: "Hipóteses" });
    expect(sugestoes[0]).not.toHaveProperty("secaoId");
  });
  it("entrada que não é lista = nada", () => {
    expect(criticar("lixo", secoes, papers)).toEqual({ sugestoes: [], descartadas: 0 });
  });
});

describe("prompt", () => {
  it("numera as fontes, mostra ids das seções e o foco", () => {
    const { sys, user } = promptRigor(secoes, "TCC X", "fundamente a intro", [paper({ abstract: "abs" })], "introducao");
    expect(sys).toContain("SOMENTE as FONTES numeradas");
    expect(user).toContain("[introducao] # INTRODUÇÃO");
    expect(user).toContain("(vazia)");
    expect(user).toContain("1. SOUZA");
    expect(user).toContain("Resumo: abs");
    expect(user).toContain("foco na seção [introducao]");
  });
});

describe("lapidarComRigor", () => {
  it("sem fonte verificada = não propõe nada (e nem chama o modelo)", async () => {
    const gen = vi.fn();
    const r = await lapidarComRigor({ titulo: "T", secoes, pedido: "melhore" }, { retrieve: async () => [], gen });
    expect(r.sugestoes).toEqual([]);
    expect(r.texto).toMatch(/sem fonte, eu não proponho/);
    expect(gen).not.toHaveBeenCalled();
  });
  it("busca falhando também = nada (nunca inventa)", async () => {
    const r = await lapidarComRigor({ titulo: "T", secoes, pedido: "x" }, { retrieve: async () => { throw new Error("rede"); }, gen: vi.fn() });
    expect(r.sugestoes).toEqual([]);
  });
  it("busca com o pedido e o título(+seção em foco); passa no crítico; texto conta sugestões e fontes", async () => {
    const retrieve = vi.fn(async () => [paper()]);
    const gen = vi.fn(async () => ({ resumo: "Fundamentei.", edicoes: [{ secaoId: "introducao", op: "anexar", corpo: "x", fontes: [1] }, { secaoId: "introducao", op: "anexar", corpo: "y", fontes: [] }] }));
    const r = await lapidarComRigor({ titulo: "Fotossíntese", secoes, pedido: "fundamente", secaoId: "introducao" }, { retrieve, gen });
    expect(retrieve).toHaveBeenCalledWith(["fundamente", "Fotossíntese INTRODUÇÃO"]);
    expect(r.sugestoes).toHaveLength(1);
    expect(r.descartadas).toBe(1);
    expect(r.texto).toBe("Fundamentei.\n\nDeixei 1 sugestão no TCC, com 1 fonte verificada. Nada muda até você aceitar.");
    expect(r.fontes).toHaveLength(1);
  });
  it("plural e caso em que nada passa no crivo; foco inválido é ignorado", async () => {
    const dois = await lapidarComRigor({ titulo: "T", secoes, pedido: "p" }, {
      retrieve: async () => [paper(), paper({ title: "Outro", authors: ["Ana Reis"] })],
      gen: async () => ({ edicoes: [{ secaoId: "introducao", op: "anexar", corpo: "a", fontes: [1, 2] }, { secaoId: "metodologia", op: "substituir", corpo: "b", fontes: [2] }] }),
    });
    expect(dois.texto).toBe("Deixei 2 sugestões no TCC, com 2 fontes verificadas. Nada muda até você aceitar.");
    const retrieve = vi.fn(async () => [paper()]);
    const nada = await lapidarComRigor({ titulo: "T", secoes, pedido: "p", secaoId: "nao-existe" }, { retrieve, gen: async () => ({ resumo: "Não deu.", edicoes: [] }) });
    expect(retrieve).toHaveBeenCalledWith(["p", "T"]);
    expect(nada.texto).toMatch(/^Não deu\.\n\nNenhuma edição passou no crivo/);
  });
});
