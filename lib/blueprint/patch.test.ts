import { describe, expect, it } from "vitest";
import { aplicarPatchCliente, textoDaResposta } from "./patch";
import { docVazio, type DocBlueprint } from "./tipos";

const doc = (o: Partial<DocBlueprint> = {}): DocBlueprint => ({ ...docVazio("T", 0), fase: 2, ...o });

describe("aplicarPatchCliente — o cliente só mexe no arranjo e nas notas dele", () => {
  it("ignora críticos, fase e avaliações vindos do cliente", () => {
    const r = aplicarPatchCliente(doc(), { fase: 4, aguardandoMentor: true, criticos: [{ id: "r1", status: "provado" }], avaliacoes: [{}] }, "u1");
    expect(r.fase).toBe(2); expect(r.criticos).toEqual([]); expect(r.avaliacoes).toEqual([]); expect(r.aguardandoMentor).toBe(false);
  });
  it("arrastar fixa a posição; números ruins não entram", () => {
    const r = aplicarPatchCliente(doc(), { fixos: { set: { repos: { x: 10, y: -4 }, "passo:p1": { x: NaN, y: 1 } } } }, "u1");
    expect(r.fixos).toEqual({ repos: { x: 10, y: -4 } });
  });
  it("reorganizar solta tudo", () => {
    expect(aplicarPatchCliente(doc({ fixos: { repos: { x: 1, y: 1 } } }), { reorganizar: true }, "u1").fixos).toEqual({});
  });
  it("nota nova recebe o autor da sessão (não o do corpo); remover apaga", () => {
    const r = aplicarPatchCliente(doc({ notas: [{ id: "n0", corpo: "velha" }] }), { notas: { upsert: [{ id: "n1", corpo: "minha ideia", autor: "outro" }], remove: ["n0"] } }, "u1");
    expect(r.notas).toEqual([{ id: "n1", corpo: "minha ideia", autor: "u1" }]);
  });
});

describe("textoDaResposta", () => {
  it("junta núcleo, conceitos, evidências com a fonte e próximos passos", () => {
    const t = textoDaResposta({ nucleo: "N", conceitos: ["zk", "elgamal"], evidencia: [{ claim: "C", source: { title: "Zether", url: "https://x.org" } }], proximos_passos: ["fazer"] });
    expect(t).toContain("N"); expect(t).toContain("zk, elgamal"); expect(t).toContain("Zether https://x.org"); expect(t).toContain("fazer");
    expect(textoDaResposta(null)).toBe("");
  });
});
