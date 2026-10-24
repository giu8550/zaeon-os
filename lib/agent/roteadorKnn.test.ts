import { describe, it, expect, vi, beforeEach } from "vitest";
import { EXEMPLOS, confiante, indiceKnn, indiceSePronto, modoKnn, votar, _esquecerIndice, type IndiceKnn } from "./roteadorKnn";
import { INTENT_IDS } from "./contracts";

const e = (i: number) => Array.from({ length: 8 }, (_, k) => (k === i ? 1 : 0));
const indice: IndiceKnn = { versao: "t", itens: [
  { intent: "explicar_conceito", vetor: e(0) }, { intent: "explicar_conceito", vetor: e(0) }, { intent: "explicar_conceito", vetor: e(0) },
  { intent: "conversa", vetor: e(1) }, { intent: "conversa", vetor: e(1) }, { intent: "buscar_livro", vetor: e(2) },
] };

describe("roteador kNN — o voto (puro)", () => {
  it("todas as intenções têm exemplos", () => { for (const i of INTENT_IDS) expect(EXEMPLOS[i as keyof typeof EXEMPLOS]?.length ?? 0, i).toBeGreaterThanOrEqual(8); });
  it("pergunta perto de um grupo: decide com confiança e margem altas", () => {
    const v = votar([1, 0.05, 0, 0, 0, 0, 0, 0], indice, 3)!;
    expect(v.intent).toBe("explicar_conceito"); expect(v.confianca).toBeGreaterThan(0.99); expect(confiante(v)).toBe(true);
  });
  it("pergunta no meio de dois grupos: margem baixa → não decide (vai pro modelo)", () => {
    const v = votar([1, 1, 0, 0, 0, 0, 0, 0], indice, 5)!;
    expect(confiante(v)).toBe(false);
  });
  it("modo vem do env: off (padrão) · sombra · on", () => {
    expect(modoKnn({})).toBe("off"); expect(modoKnn({ ROTEADOR_KNN: "sombra" })).toBe("sombra"); expect(modoKnn({ ROTEADOR_KNN: "on" })).toBe("on");
  });
});

describe("roteador kNN — o índice", () => {
  beforeEach(() => _esquecerIndice());
  it("monta uma vez, com nova tentativa no 429 (a cota do embedding é por minuto)", async () => {
    let chamadas = 0;
    const embed = vi.fn(async (t: string[]) => { chamadas++; if (chamadas === 2) throw new Error("embed_http_429: RESOURCE_EXHAUSTED"); return t.map(() => e(0)); });
    const ind = await indiceKnn(embed, [1, 1, 1], 0);
    const total = Object.values(EXEMPLOS).reduce((s, x) => s + x.length, 0);
    expect(ind.itens.length).toBe(total);
    expect(await indiceKnn(embed, [1], 0)).toBe(ind);   // não remonta
  });
  it("enquanto monta, indiceSePronto devolve null (a classificação segue pelo modelo)", async () => {
    let solta!: () => void; const trava = new Promise<void>((r) => { solta = r; });
    const embed = async (t: string[]) => { await trava; return t.map(() => e(0)); };
    expect(indiceSePronto(embed, [1], 0)).toBeNull();
    solta(); await indiceKnn(embed, [1], 0);
    expect(indiceSePronto(embed, [1], 0)).not.toBeNull();
  });
  it("erro que não é de cota: desiste e a próxima tenta de novo", async () => {
    const ruim = async () => { throw new Error("embed_sem_token"); };
    await expect(indiceKnn(ruim, [1], 0)).rejects.toThrow("embed_sem_token");
    const bom = async (t: string[]) => t.map(() => e(0));
    await expect(indiceKnn(bom, [1], 0)).resolves.toBeTruthy();
  });
});

describe("confiante — limiares por env", () => {
  const v = { intent: "conversa" as const, confianca: 0.72, margem: 0.4, vizinhos: [] };
  it("padrão 0.7/0.34 aceita; env mais rígido recusa; env inválido cai no padrão", () => {
    expect(confiante(v, {})).toBe(true);
    expect(confiante(v, { ROTEADOR_KNN_CONFIANCA: "0.8" })).toBe(false);
    expect(confiante(v, { ROTEADOR_KNN_MARGEM: "0.5" })).toBe(false);
    expect(confiante(v, { ROTEADOR_KNN_CONFIANCA: "abc" })).toBe(true);
  });
});

describe("votar — o quase-idêntico manda (regressão medida em prod)", () => {
  it("1 exemplo idêntico vence 3 medianos de outra intenção (\"o que é mitose?\" × \"gera um fluxograma da mitose\")", () => {
    const ind: IndiceKnn = { versao: "t", itens: [
      { intent: "explicar_conceito", vetor: [1, 0] }, { intent: "explicar_conceito", vetor: [0.6, 0.8] },
      { intent: "gerar_artefato", vetor: [0.78, 0.626] }, { intent: "gerar_artefato", vetor: [0.78, 0.626] }, { intent: "gerar_artefato", vetor: [0.78, 0.626] },
    ] };
    const v = votar([1, 0], ind, 5)!;
    expect(v.intent).toBe("explicar_conceito"); expect(v.confianca).toBeCloseTo(1, 5); expect(confiante(v, {})).toBe(true);
  });
});
