import { describe, expect, it } from "vitest";
import { BANCO, ESPERA_S, NOTA_MINIMA, TOTAL_PERGUNTAS, corrigir, podeTentar, publica, sanearRespostas, sortearDoBanco, validarPerguntasDaIA } from "./dueloIngles";

describe("o duelo de linguagem da Examiner", () => {
  it("o banco fixo é bem formado: 4 opções distintas, a certa no intervalo, os 3 níveis", () => {
    for (const p of BANCO) { expect(p.opcoes).toHaveLength(4); expect(new Set(p.opcoes).size).toBe(4); expect(p.certa).toBeGreaterThanOrEqual(0); expect(p.certa).toBeLessThan(4); }
    for (const n of [1, 2, 3] as const) expect(BANCO.filter((p) => p.nivel === n).length).toBeGreaterThanOrEqual(3);
  });
  it("sorteia 7 em nível crescente, sem repetir, e embaralhar as opções não perde a certa", () => {
    const ps = sortearDoBanco(42);
    expect(ps).toHaveLength(TOTAL_PERGUNTAS); expect(new Set(ps.map((p) => p.enunciado)).size).toBe(TOTAL_PERGUNTAS);
    expect(ps.map((p) => p.nivel)).toEqual([1, 1, 2, 2, 2, 3, 3]);
    for (const p of ps) { const orig = BANCO.find((b) => b.enunciado === p.enunciado)!; expect(p.opcoes[p.certa]).toBe(orig.opcoes[orig.certa]); }
    expect(sortearDoBanco(42)).toEqual(ps);   // determinístico pela semente
  });
  it("o cliente não recebe o gabarito", () => {
    const p = publica(sortearDoBanco(1)[0]!, 0);
    expect(Object.keys(p).sort()).toEqual(["enunciado", "i", "nivel", "opcoes"]);
  });
  it("corrige: passa com 6 de 7, e o erro medido diz o que deu e o que era", () => {
    const ps = sortearDoBanco(7), certas = ps.map((p) => p.certa);
    expect(corrigir(ps, certas)).toMatchObject({ acertos: 7, passou: true, erros: [] });
    const umErro = certas.map((c, i) => (i === 3 ? (c + 1) % 4 : c));
    const r1 = corrigir(ps, umErro); expect(r1.acertos).toBe(NOTA_MINIMA); expect(r1.passou).toBe(true); expect(r1.erros[0]!.certa).toBe(ps[3]!.opcoes[ps[3]!.certa]);
    const doisErros = umErro.map((c, i) => (i === 0 ? null : c)); const r2 = corrigir(ps, doisErros);
    expect(r2.passou).toBe(false); expect(r2.erros).toHaveLength(2); expect(r2.erros[0]!.deu).toBeNull();
  });
  it("saneia as respostas do cliente e valida o JSON da IA (rejeita o malformado)", () => {
    expect(sanearRespostas([0, 1, "x", 9, -1, 2.5])).toEqual([0, 1, null, null, null, null, null]);
    const boa = { perguntas: sortearDoBanco(3).map((p) => ({ enunciado: p.enunciado, opcoes: p.opcoes, certa: p.certa, nivel: p.nivel })) };
    expect(validarPerguntasDaIA(boa)).toHaveLength(7);
    expect(validarPerguntasDaIA({ perguntas: boa.perguntas.slice(0, 5) })).toBeNull();
    expect(validarPerguntasDaIA({ perguntas: boa.perguntas.map((p, i) => (i === 2 ? { ...p, opcoes: ["a", "a", "b", "c"] } : p)) })).toBeNull();
    expect(validarPerguntasDaIA({ perguntas: boa.perguntas.map((p, i) => (i === 4 ? { ...p, certa: 7 } : p)) })).toBeNull();
  });
  it("espera 2 minutos pra tentar de novo", () => {
    expect(podeTentar(null, 0)).toBe(true); expect(podeTentar(1000, 1000 + ESPERA_S * 1000 - 1)).toBe(false); expect(podeTentar(1000, 1000 + ESPERA_S * 1000)).toBe(true);
  });
});
