import { describe, it, expect } from "vitest";
import { CATALOGO, filtrarVitrine } from "./vitrine";

describe("Octa Code no Marketplace", () => {
  it("é um blueprint grátis de agente que vira agente no seletor (não plug de chat)", () => {
    const octa = CATALOGO.find((i) => i.id === "octa-code")!;
    expect(octa).toMatchObject({ titulo: "Octa Code", tipo: "agente", execucao: "agente", preco: 0, plugavel: "octa-code" });
    expect(octa.entrega[0]).toMatch(/IDE/);
    expect(filtrarVitrine(CATALOGO, "gratis", "").map((i) => i.id)).toContain("octa-code");
  });
});
