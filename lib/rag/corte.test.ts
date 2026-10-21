import { describe, it, expect } from "vitest";
import type { Block } from "@/lib/scholar/types";
import { parseLoaderResponse } from "@/lib/scholar/pdf";
import { cortarEmTrechos } from "./corte";

const h = (text: string, level?: number, page = 1): Block => ({ type: "heading", level, page, text });
const p = (text: string, page = 1): Block => ({ type: "paragraph", page, text });

describe("cortarEmTrechos — caminho (árvore de títulos)", () => {
  it("usa a pilha por nível e esvazia ao voltar pro nível 1", () => {
    const out = cortarEmTrechos(
      [
        h("Cap 1", 1), p("texto cap 1"),
        h("1.1", 2), p("texto 1.1"),
        h("1.1.1", 3), p("texto 1.1.1"),
        h("Cap 2", 1), p("texto cap 2"),
      ],
      "Apostila",
    );
    expect(out).toHaveLength(4);
    expect(out[2].caminho).toBe("Apostila › Cap 1 › 1.1 › 1.1.1");
    expect(out[3].caminho).toBe("Apostila › Cap 2");
    for (const t of out) expect(t.texto.startsWith(t.caminho + "\n\n")).toBe(true);
    expect(out[2].texto).toBe("Apostila › Cap 1 › 1.1 › 1.1.1\n\ntexto 1.1.1");
  });

  it("sem level: fallback com os 3 títulos mais recentes", () => {
    const out = cortarEmTrechos(
      [h("A"), p("a"), h("B"), p("b"), h("C"), p("c"), h("D"), p("d")],
      "Apostila",
    );
    expect(out[3].caminho).toBe("Apostila › B › C › D");
  });
});

describe("cortarEmTrechos — tamanho, páginas e tabelas", () => {
  it("fecha em limite de parágrafo ao passar de ALVO_CHARS e acompanha páginas", () => {
    const x = "x".repeat(1200);
    const out = cortarEmTrechos([h("T", 1, 3), p(x, 3), p(x, 3), p(x, 4)], "Doc");
    expect(out).toHaveLength(2);
    expect(out[0].paginaIni).toBe(3);
    expect(out[0].paginaFim).toBe(3);
    expect(out[1].paginaFim).toBe(4);
  });

  it("tabela grande entra inteira num trecho próprio", () => {
    const tabela = "c".repeat(5000);
    const out = cortarEmTrechos(
      [h("T", 1), p("antes"), { type: "table", page: 1, text: tabela }, p("depois")],
      "Doc",
    );
    const comTabela = out.filter((t) => t.texto.includes(tabela));
    expect(comTabela).toHaveLength(1);
    expect(out.filter((t) => t.texto.includes("c".repeat(50)))).toHaveLength(1);
    expect(comTabela[0].texto).not.toContain("antes");
    expect(out).toHaveLength(3);
  });

  it("blocos sem página herdam a última vista (começa em 1); figure é ignorada", () => {
    const out = cortarEmTrechos(
      [{ type: "paragraph", text: "sem página" }, { type: "figure", page: 9, text: "fig" }, p("na 5", 5), { type: "paragraph", text: "herda 5" }],
      "Doc",
    );
    expect(out).toHaveLength(1);
    expect(out[0].paginaIni).toBe(1);
    expect(out[0].paginaFim).toBe(5);
    expect(out[0].texto).not.toContain("fig");
  });

  it("vazio e só figure ⇒ []", () => {
    expect(cortarEmTrechos([], "Doc")).toEqual([]);
    expect(cortarEmTrechos([{ type: "figure", page: 1, text: "f" }], "Doc")).toEqual([]);
  });

  it("ordem é 0,1,2… sem buracos", () => {
    const out = cortarEmTrechos([h("A", 1), p("a"), h("B", 1), p("b"), h("C", 1), p("c")], "Doc");
    expect(out.map((t) => t.ordem)).toEqual([0, 1, 2]);
  });
});

describe("parseLoaderResponse — level", () => {
  const base = { paragraphs: [{ text: "x" }] };
  it("repassa level numérico ≥ 1", () => {
    const out = parseLoaderResponse({ ...base, blocks: [{ type: "heading", level: 2, text: "T" }] })!;
    expect(out.blocks![0].level).toBe(2);
  });
  it("omite level inválido", () => {
    const out = parseLoaderResponse({
      ...base,
      blocks: [
        { type: "heading", level: "x", text: "T" },
        { type: "heading", level: 0, text: "T" },
      ],
    })!;
    expect(out.blocks![0].level).toBeUndefined();
    expect("level" in out.blocks![0]).toBe(false);
    expect(out.blocks![1].level).toBeUndefined();
  });
});
