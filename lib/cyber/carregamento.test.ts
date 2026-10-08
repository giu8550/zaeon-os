import { describe, expect, it } from "vitest";
import { DICAS, ETAPAS, carregando, progressoDe } from "./carregamento";

describe("as etapas do carregamento", () => {
  it("a barra vai de 0 a 1, sempre pra frente, etapa por etapa", () => {
    expect(progressoDe("corpo", 0)).toBe(0); expect(progressoDe("quadro", 1)).toBeCloseTo(1, 10);
    let ant = -1; for (const e of ETAPAS) for (const d of [0, 0.5, 1]) { const p = progressoDe(e.id, d); expect(p).toBeGreaterThanOrEqual(ant - 1e-12); ant = p; }
    expect(progressoDe("zaeon", 2)).toBe(progressoDe("zaeon", 1));   // não passa da etapa
  });
  it("cada etapa tem um rótulo em português que diz o que está carregando", () => {
    expect(new Set(ETAPAS.map((e) => e.id)).size).toBe(ETAPAS.length);
    for (const e of ETAPAS) expect(e.rotulo.length).toBeGreaterThan(10);
    expect(carregando("sons", 0.5, "12/40")).toMatchObject({ etapa: "sons", rotulo: "Afinando os sons do cyberespaço", detalhe: "12/40" });
    expect(DICAS.length).toBeGreaterThan(3);
  });
});
