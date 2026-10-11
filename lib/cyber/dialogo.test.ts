import { describe, it, expect } from "vitest";
import { ESCRITA_CPS, escritaAcabou, ondeFala, textoEscrito } from "./dialogo";

describe("diálogo do tutorial", () => {
  it("caixa antes da Zaeon e em toda cena; balão depois dela; fora do tutorial, sempre balão", () => {
    expect(ondeFala({ tutorial: true, balaoLiberado: false, emCena: false })).toBe("caixa");
    expect(ondeFala({ tutorial: true, balaoLiberado: true, emCena: false })).toBe("balao");
    expect(ondeFala({ tutorial: true, balaoLiberado: true, emCena: true })).toBe("caixa");
    expect(ondeFala({ tutorial: false, balaoLiberado: false, emCena: true })).toBe("balao");
  });
  it("a máquina de escrever revela aos poucos e não parte um emoji no meio", () => {
    const t = "Olá ✦ viajante";
    expect(textoEscrito(t, 0)).toBe("");
    expect(textoEscrito(t, 5 / ESCRITA_CPS)).toBe("Olá ✦");
    expect(textoEscrito(t, 99)).toBe(t);
    expect(escritaAcabou(t, 1 / ESCRITA_CPS)).toBe(false); expect(escritaAcabou(t, 99)).toBe(true);
    expect(textoEscrito("🚀🚀", 1 / ESCRITA_CPS)).toBe("🚀");
  });
});
