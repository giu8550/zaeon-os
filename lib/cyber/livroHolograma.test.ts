import { describe, it, expect } from "vitest";
import { MAX_FOLHAS, anguloDasFolhas, folhasVisiveis } from "./livroHolograma";

describe("livro-holograma", () => {
  it("1 página = a capa + 1 folha; muitas = até o teto, em leque crescente", () => {
    expect(folhasVisiveis(1)).toBe(1); expect(anguloDasFolhas(1)).toHaveLength(1);
    expect(folhasVisiveis(0)).toBe(1);
    expect(folhasVisiveis(500)).toBe(MAX_FOLHAS);
    const a = anguloDasFolhas(6); expect(a).toHaveLength(6);
    for (let i = 1; i < a.length; i++) expect(a[i]!).toBeGreaterThan(a[i - 1]!);
    expect(a[a.length - 1]!).toBeLessThan(0.75);
  });
});
