import { describe, it, expect, afterEach } from "vitest";
import { convitesAtivos } from "./flag";

const limpa = () => {
  delete process.env.CONVITES_ATIVOS;
  delete process.env.NEXT_PUBLIC_CONVITES_ATIVOS;
};
afterEach(limpa);

describe("chave dos convites de cadastro", () => {
  it("desligado por padrão — cadastro aberto é o normal", () => {
    limpa();
    expect(convitesAtivos()).toBe(false);
  });

  it("aceita as formas que a gente realmente digita", () => {
    for (const v of ["1", "true", "TRUE", "on", "sim", " 1 "]) {
      process.env.CONVITES_ATIVOS = v;
      expect(convitesAtivos()).toBe(true);
    }
  });

  it("não liga por engano com valor vazio ou falso", () => {
    for (const v of ["", "0", "false", "off", "nao", "talvez"]) {
      process.env.CONVITES_ATIVOS = v;
      expect(convitesAtivos()).toBe(false);
    }
  });

  it("NEXT_PUBLIC vence (é o que a UI do cliente enxerga)", () => {
    process.env.CONVITES_ATIVOS = "0";
    process.env.NEXT_PUBLIC_CONVITES_ATIVOS = "1";
    expect(convitesAtivos()).toBe(true);
  });

  it("NEXT_PUBLIC vazio NÃO mascara o servidor (a pegadinha do .env)", () => {
    process.env.NEXT_PUBLIC_CONVITES_ATIVOS = "";
    process.env.CONVITES_ATIVOS = "1";
    expect(convitesAtivos()).toBe(true);
  });
});
