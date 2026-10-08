import { describe, expect, it } from "vitest";
import { FAIXAS_TOON, espessuraTinta, estiloDe, usaCorpoDoFundador } from "./estiloAvatar";

describe("estilo do corpo do jogador (experimento anime)", () => {
  it("padrão = ser de luz; a env liga pra todos; ?anime=1 / ?anime=0 manda na env", () => {
    expect(estiloDe(undefined, "")).toBe("luz");
    expect(estiloDe("anime", "")).toBe("anime");
    expect(estiloDe(undefined, "?nascer=1&anime=1")).toBe("anime");
    expect(estiloDe("anime", "?anime=0")).toBe("luz");
    expect(estiloDe("qualquer", "?anime=talvez")).toBe("luz");
  });
  it("cel shading em 3 faixas crescentes; contorno fino", () => {
    expect(FAIXAS_TOON).toHaveLength(3);
    expect([...FAIXAS_TOON].sort((a, b) => a - b)).toEqual([...FAIXAS_TOON]);
    // o traço acompanha a escala do modelo: ~1,5 cm num corpo de 1,8 m, venha ele em metros ou em centímetros
    expect(espessuraTinta(1.85)).toBeCloseTo(0.0157, 3); expect(espessuraTinta(185)).toBeCloseTo(1.57, 1);
  });
  it("o founder tem o corpo PRÓPRIO (só ele); ?founder=0 volta pro padrão", () => {
    expect(usaCorpoDoFundador(true, "")).toBe(true); expect(usaCorpoDoFundador(false, "")).toBe(false); expect(usaCorpoDoFundador(undefined, "")).toBe(false);
    expect(usaCorpoDoFundador(true, "?founder=0")).toBe(false);
  });
});
