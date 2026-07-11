import { describe, it, expect } from "vitest";
import { placeWord, clearSlot, bankAvailable } from "@/lib/aulas/dragPlacement";

describe("placeWord", () => {
  it("coloca em um slot vazio", () => {
    expect(placeWord([null, null], "gato", 1)).toEqual([null, "gato"]);
  });
  it("move quando a palavra já está em outro slot", () => {
    expect(placeWord(["gato", null], "gato", 1)).toEqual([null, "gato"]);
  });
  it("substitui o ocupante do slot de destino (volta pro banco)", () => {
    expect(placeWord(["x", null], "gato", 0)).toEqual(["gato", null]);
  });
});

describe("clearSlot", () => {
  it("esvazia o slot", () => { expect(clearSlot(["a", "b"], 0)).toEqual([null, "b"]); });
});

describe("bankAvailable", () => {
  it("remove os usados, respeitando duplicatas", () => {
    expect(bankAvailable(["a", "a", "b"], ["a", null])).toEqual(["a", "b"]);
    expect(bankAvailable(["a", "b"], ["a", "b"])).toEqual([]);
  });
});
