import { describe, it, expect } from "vitest";
import { voltarPermitido, urlDeVolta } from "./github-voltar";

describe("volta do OAuth do GitHub (open-redirect safe)", () => {
  it("só caminhos internos da lista passam", () => {
    expect(voltarPermitido("/octa/github")).toBe("/octa/github");
    for (const ruim of [
      "https://evil.com", "//evil.com", "/\\evil.com", "/octa/github/../x", "/octa/github?x=1", "/octa/github#a",
      "/qualquer", "octa/github", "", null, undefined, 42, " /octa/github",
    ]) expect(voltarPermitido(ruim as any), String(ruim)).toBeNull();
  });

  it("sem volta válida → a sala Projetos de sempre; com volta → o caminho + ?gh=motivo, sempre na base do app", () => {
    expect(urlDeVolta("https://app.zaeon.com", null, "connected").toString()).toBe("https://app.zaeon.com/research-lab?tab=projetos&gh=connected");
    expect(urlDeVolta("https://app.zaeon.com", "/octa/github", "connected").toString()).toBe("https://app.zaeon.com/octa/github?gh=connected");
    expect(urlDeVolta("https://app.zaeon.com", "https://evil.com", "state").toString()).toBe("https://app.zaeon.com/research-lab?tab=projetos&gh=state");
  });
});
