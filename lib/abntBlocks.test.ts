import { describe, it, expect } from "vitest";
import { normalizeBlocks, cleanContent, insertBlock, BLOCOS } from "./abntBlocks";

// MESMAS fixtures de abnt-service/test_formatter.py — paridade editor × motor.
const DIRTY =
  "Primeiro parágrafo com quebra\nmole no meio da frase.\nSegundo parágrafo " +
  "começa aqui.\n\n\n\nTerceiro   depois de quatro quebras.\r\n\r\nQuarto com CRLF.";
const CLEAN =
  "Primeiro parágrafo com quebra mole no meio da frase.\n\nSegundo parágrafo começa aqui." +
  "\n\nTerceiro depois de quatro quebras.\n\nQuarto com CRLF.";

describe("abntBlocks · normalizeBlocks (paridade com o motor)", () => {
  it("sujo e limpo dão os mesmos parágrafos", () => {
    const esperado = [
      "Primeiro parágrafo com quebra mole no meio da frase.",
      "Segundo parágrafo começa aqui.",
      "Terceiro depois de quatro quebras.",
      "Quarto com CRLF.",
    ];
    expect(normalizeBlocks(DIRTY)).toEqual(esperado);
    expect(normalizeBlocks(CLEAN)).toEqual(esperado);
    expect(cleanContent(DIRTY)).toBe(CLEAN);
  });

  it("preserva tabela, lista, figura e citação aberta", () => {
    const content =
      "Veja os itens:\n- primeiro item\n- segundo item\n" +
      "![Mapa|própria](https://x/y.png)\n" +
      '"Uma citação longa que quebra\nde linha. E continua depois do ponto\nate fechar."\n\n' +
      "%%tabela Dados\n| a | b |\n| 1 | 2 |";
    expect(normalizeBlocks(content)).toEqual([
      "Veja os itens:",
      "- primeiro item",
      "- segundo item",
      "![Mapa|própria](https://x/y.png)",
      '"Uma citação longa que quebra de linha. E continua depois do ponto ate fechar."',
      "%%tabela Dados\n| a | b |\n| 1 | 2 |",
    ]);
  });

  it("nunca deixa \\n dentro de parágrafo que não seja tabela", () => {
    for (const b of normalizeBlocks("a\nb\nc.\n\nd​ e")) expect(b.includes("\n")).toBe(false);
  });
});

describe("abntBlocks · insertBlock", () => {
  it("insere como bloco próprio, sem acumular quebras, e seleciona o título", () => {
    const v = "Texto antes.\n\n\n";
    const r = insertBlock(v, v.length, BLOCOS.tabela.block, BLOCOS.tabela.select);
    expect(r.value).toBe("Texto antes.\n\n" + BLOCOS.tabela.block + "\n");
    expect(r.value.slice(r.start, r.end)).toBe("Título da tabela");
  });
  it("no meio do texto: uma linha em branco de cada lado", () => {
    const v = "Um.\nDois.";
    const r = insertBlock(v, 4, "## Sub");
    expect(r.value).toBe("Um.\n\n## Sub\n\nDois.");
    expect(r.start).toBe(r.end);
  });
  it("documento vazio", () => {
    expect(insertBlock("", 0, "# X").value).toBe("# X\n");
  });
});
