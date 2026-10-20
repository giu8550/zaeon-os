import { afterEach, describe, expect, it } from "vitest";
import { ALTURA_LOUNGE, CIDADE, alturaNaCidade, daSala, mundo, naIlhaPrincipal, pisoNoAr, salaEm } from "./ceu";
import { NOS } from "./buracos";
import { PRACA } from "./praca";
import { PLATAFORMAS } from "./plataformas";
import { definirNivel, NIVEIS_SEPARADOS } from "./nivelAtivo";
import { nivelDoPonto, proximoNivel } from "./niveis";

const YS = CIDADE.pisoY + ALTURA_LOUNGE;
afterEach(() => definirNivel(null));

describe("níveis separados", () => {
  it("cada lugar é o nível dele: a central, cada sala (no alto), a praça e a Solana", () => {
    expect(nivelDoPonto(mundo({ x: 0, z: 0 }), CIDADE.pisoY)).toBe("zaeon");
    for (const s of ["lounge", "garagem", "biblioteca", "jardim"] as const) expect(nivelDoPonto(NOS[s].chegada, YS)).toBe(s);
    expect(nivelDoPonto({ x: PRACA.x, z: PRACA.z }, PRACA.y)).toBe("praca");
    expect(nivelDoPonto(PLATAFORMAS.solana.centro, PLATAFORMAS.solana.y)).toBe("solana");
    // (o templo do lounge e a garagem das motos dele são do nível do lounge)
    expect(nivelDoPonto(mundo(daSala(CIDADE.salas.lounge, 60, -40)), YS + 4)).toBe("lounge");
  });
  it("numa sala só se sai por teleporte; nos abertos, troca voando (mas não entra numa sala voando)", () => {
    const fora = mundo({ x: 0, z: 0 });
    expect(proximoNivel("lounge", fora, CIDADE.pisoY, false)).toBe("lounge");
    expect(proximoNivel("lounge", fora, CIDADE.pisoY, true)).toBe("zaeon");
    expect(proximoNivel("zaeon", NOS.lounge.chegada, YS, false)).toBe("zaeon");
    expect(proximoNivel("zaeon", { x: PRACA.x, z: PRACA.z }, PRACA.y, false)).toBe("praca");
  });
  it("só o nível ativo é chão: na central, as salas não existem; numa sala, a central não existe", () => {
    if (!NIVEIS_SEPARADOS) return;
    const l = { x: NOS.biblioteca.chegada.x - CIDADE.centro.x, z: NOS.biblioteca.chegada.z - CIDADE.centro.z };
    definirNivel("zaeon");
    expect(salaEm(l)).toBeNull(); expect(alturaNaCidade(NOS.biblioteca.chegada)).toBe(0); expect(naIlhaPrincipal(mundo({ x: 0, z: 0 }))).toBe(true);
    definirNivel("biblioteca");
    expect(salaEm(l)).toBe("biblioteca"); expect(alturaNaCidade(NOS.biblioteca.chegada)).toBe(ALTURA_LOUNGE);
    expect(naIlhaPrincipal(mundo({ x: 0, z: 0 }))).toBe(false); expect(pisoNoAr(mundo({ x: 0, z: 0 }), 0)).toBeNull();
    definirNivel(null);
    expect(salaEm(l)).toBe("biblioteca");   // (sem nível — a frota, os testes antigos: o mapa inteiro)
  });
});
