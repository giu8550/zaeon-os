import { describe, expect, it } from "vitest";
import { CORPO_POR_USUARIO, corpoDoUsuario, pilotaANave } from "./corposDeUsuario";
import { CORPOS_DE_JOGADOR, corpoProprio } from "@/lib/cyber/estiloAvatar";

describe("corpo próprio de jogador", () => {
  it("todo corpo mapeado no servidor existe no cliente (sem id órfão)", () => {
    for (const id of Object.values(CORPO_POR_USUARIO)) expect(CORPOS_DE_JOGADOR[id], id).toBeDefined();
  });
  it("conta sem corpo → nada; com corpo → o dela (com as asas, se o corpo tiver)", () => {
    expect(corpoDoUsuario("000000000000000000000000")).toBeUndefined();
    const giulia = Object.entries(CORPO_POR_USUARIO).find(([, c]) => c === "giulia")![0];
    const p = corpoProprio({ corpo: corpoDoUsuario(giulia) }, "");
    expect(p?.asas).toBe(true); expect(p?.corpo.url).toMatch(/giulia\.vrm$/);   // ela ganhou as asas
  });
  it("o founder continua com o corpo e as asas dele (e ?founder=0 desliga)", () => {
    expect(corpoProprio({ fundador: true }, "")?.asas).toBe(true);
    expect(corpoProprio({ fundador: true }, "?founder=0")).toBeNull();
    expect(corpoProprio({}, "")).toBeNull();
  });
  it("a nave: SÓ o dono pilota (a tripulação acabou); os outros super admins também não", () => {
    expect(pilotaANave("donmartinezcaiudoceu@gmail.com")).toBe(true);
    expect(pilotaANave("zaeondao@gmail.com")).toBe(false);
    expect(pilotaANave(null)).toBe(false);
  });
});
