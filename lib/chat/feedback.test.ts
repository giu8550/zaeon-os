import { describe, it, expect } from "vitest";
import { lerVotos, votar, CHAVE_FEEDBACK } from "./feedback";

const armazem = () => {
  const dados: Record<string, string> = {};
  return { dados, getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => { dados[k] = v; } };
};

describe("feedback 👍/👎", () => {
  it("grava, troca e desfaz o voto", () => {
    const a = armazem();
    votar(a, "m1", "up");
    expect(lerVotos(a)).toEqual({ m1: "up" });
    votar(a, "m1", "down");
    expect(lerVotos(a)).toEqual({ m1: "down" });
    votar(a, "m1", null);
    expect(lerVotos(a)).toEqual({});
  });
  it("lixo no armazém não derruba", () => {
    const a = armazem();
    a.dados[CHAVE_FEEDBACK] = "{quebrado";
    expect(lerVotos(a)).toEqual({});
    expect(lerVotos(null)).toEqual({});
  });
});
