import { describe, expect, it } from "vitest";
import { aplicarAvaliacao, aprovada, criticosAbertos, precisaAvaliar, prontaPraAvaliar, registrarEntrega } from "./fases";
import { docVazio, type Critico, type DocBlueprint, type Rubrica } from "./tipos";

const c = (id: string, o: Partial<Critico> = {}): Critico => ({ id, fase: 2, titulo: id, prova: "p", tipoProva: "repo", abertoEm: 0, status: "aberto", ...o });
const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("T", 0), fase: 2, ...o });
const entrega = { url: "https://github.com/voce/x", em: 9, detalhe: "repo público" };
const nota = (n: number, o: Partial<Rubrica> = {}): Rubrica => ({ rigor: n, originalidade: n, usabilidade: n, viabilidade: n, impacto: n, ...o });

describe("fases — só destrava com entrega real + Zaeon", () => {
  it("registrar a entrega marca provado e é idempotente; crítico de outra fase não muda", () => {
    const d = doc({ criticos: [c("r1"), c("r9", { fase: 3 })] });
    const um = registrarEntrega(d, "r1", entrega), dois = registrarEntrega(um, "r1", { ...entrega, em: 99 });
    expect(um.criticos[0]).toMatchObject({ status: "provado", entrega }); expect(dois).toEqual(um);
    expect(registrarEntrega(d, "r9", entrega)).toEqual(d); expect(registrarEntrega(d, "nada", entrega)).toEqual(d);
  });
  it("pronta pra avaliar só com todos os críticos da fase provados (e pelo menos um)", () => {
    expect(prontaPraAvaliar(doc())).toBe(false);
    const d = doc({ criticos: [c("r1"), c("r2")] });
    expect(prontaPraAvaliar(registrarEntrega(d, "r1", entrega))).toBe(false);
    expect(prontaPraAvaliar(registrarEntrega(registrarEntrega(d, "r1", entrega), "r2", entrega))).toBe(true);
    expect(criticosAbertos(d, 2)).toHaveLength(2);
  });
  it("aprovada = média ≥ 60 e nenhuma dimensão < 40", () => {
    expect(aprovada(nota(70))).toBe(true); expect(aprovada(nota(80, { impacto: 30 }))).toBe(false); expect(aprovada(nota(55))).toBe(false);
  });
  it("aprovada na fase 2 → fase 3; reprovada fica; nunca regride", () => {
    const d = doc();
    expect(aplicarAvaliacao(d, { fase: 2, em: 1, nota: nota(70), parecer: "ok" })).toMatchObject({ fase: 3 });
    const r = aplicarAvaliacao(d, { fase: 2, em: 1, nota: nota(30), parecer: "falta" });
    expect(r.fase).toBe(2); expect(r.avaliacoes.at(-1)).toMatchObject({ aprovada: false });
    expect(aplicarAvaliacao(doc({ fase: 3 }), { fase: 2, em: 1, nota: nota(90), parecer: "velha" }).fase).toBe(3);
  });
  it("aprovada na fase 4 → aguardando mentor (fase continua 4)", () => {
    expect(aplicarAvaliacao(doc({ fase: 4 }), { fase: 4, em: 1, nota: nota(80), parecer: "pronto" })).toMatchObject({ fase: 4, aguardandoMentor: true });
  });
});

describe("precisaAvaliar — a fase nunca fica presa", () => {
  const provada = (em: number) => c("r1", { status: "provado", entrega: { ...entrega, em } });
  it("todas provadas e sem veredito: precisa (ex.: a chamada da Zaeon falhou)", () => {
    expect(precisaAvaliar(doc({ criticos: [provada(5)] }))).toBe(true);
  });
  it("reprovada: só volta a avaliar depois de uma prova nova", () => {
    const reprovada = { fase: 2 as const, em: 10, nota: nota(30), parecer: "falta", aprovada: false };
    expect(precisaAvaliar(doc({ criticos: [provada(5)], avaliacoes: [reprovada] }))).toBe(false);
    expect(precisaAvaliar(doc({ criticos: [provada(5), c("r2", { status: "provado", entrega: { ...entrega, em: 20 } })], avaliacoes: [reprovada] }))).toBe(true);
  });
});
