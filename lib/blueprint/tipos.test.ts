import { describe, expect, it } from "vitest";
import { MAX_PASSOS, docVazio, sanitizarDoc } from "./tipos";

describe("o documento do blueprint", () => {
  it("nasce vazio na fase 1", () => {
    const d = docVazio("Privacy on Solana", 5);
    expect(d).toMatchObject({ v: 1, titulo: "Privacy on Solana", fase: 1, aguardandoMentor: false, compostoEm: 0, turnos: 0 });
    expect(d.passos).toEqual([]); expect(d.criticos).toEqual([]); expect(d.fixos).toEqual({});
  });

  it("não aceita o que não é um documento v1", () => {
    expect(sanitizarDoc(null)).toBeNull(); expect(sanitizarDoc({ v: 2, titulo: "x" })).toBeNull(); expect(sanitizarDoc([])).toBeNull();
  });

  it("conserta fase inválida, corta listas e derruba URL perigosa", () => {
    const raw = {
      ...docVazio("T", 1),
      passos: Array.from({ length: 14 }, (_, i) => ({ id: `p${i}`, titulo: `passo ${i}`, fase: i === 0 ? 9 : 2, fontes: [] })),
      repos: [{ nome: "x/y", url: "javascript:alert(1)" }, { nome: "a/b", url: "https://github.com/a/b", estrelas: 3 }],
    };
    const d = sanitizarDoc(raw)!;
    expect(d.passos).toHaveLength(MAX_PASSOS); expect(d.passos[0]!.fase).toBe(1); expect(d.passos[1]!.fase).toBe(2);
    expect(d.repos.map((r) => r.nome)).toEqual(["a/b"]);
  });

  it("mantém a entrega de um crítico provado", () => {
    const entrega = { url: "https://github.com/voce/privado", em: 10, detalhe: "repo público" };
    const d = sanitizarDoc({ ...docVazio("T", 1), criticos: [{ id: "r1", fase: 2, titulo: "faça", prova: "repo", tipoProva: "repo", abertoEm: 3, status: "provado", entrega }] })!;
    expect(d.criticos[0]).toMatchObject({ id: "r1", status: "provado", entrega });
  });

  it("só liga peças que existem", () => {
    const d = sanitizarDoc({ ...docVazio("T", 1), pecas: [{ id: "a", nome: "A", fase: 1 }], ligacoes: [["a", "x"], ["a", "a"]] })!;
    expect(d.ligacoes).toEqual([]);
  });
});
