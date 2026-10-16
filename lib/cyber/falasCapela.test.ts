import { describe, expect, it } from "vitest";
import { FRASES_CAPELA, INTERVALO_CAPELA, proximoTurno, sortearFrase } from "./falasCapela";
import { falasEmCacheNoServidor, falasFixasZaeon, textoDaVoz } from "./vozZaeon";

describe("a Zaeon na capela: frases leves, em turnos aleatórios", () => {
  it("frases curtas, sem pergunta e sem pedir dado; nenhuma repetida", () => {
    expect(FRASES_CAPELA.length).toBeGreaterThanOrEqual(25);
    expect(new Set(FRASES_CAPELA).size).toBe(FRASES_CAPELA.length);
    for (const f of FRASES_CAPELA) { expect(f.length).toBeLessThanOrEqual(110); expect(f).not.toMatch(/\?$|seu nome|e-?mail|telefone/i); }
  });
  it("o servidor guarda em cache (fixas), mas a pré-carga do tutorial não pede (o limite da rota é 40/min)", () => {
    const cache = new Set(falasEmCacheNoServidor()), tutorial = new Set(falasFixasZaeon());
    for (const f of FRASES_CAPELA) { expect(cache.has(textoDaVoz(f))).toBe(true); expect(tutorial.has(textoDaVoz(f))).toBe(false); }
  });
  it("o turno é aleatório entre o mínimo e o máximo; a próxima não repete as recentes", () => {
    expect(proximoTurno(0)).toBe(INTERVALO_CAPELA.min); expect(proximoTurno(1)).toBe(INTERVALO_CAPELA.max);
    const recentes = FRASES_CAPELA.slice(0, 5);
    for (let i = 0; i < 50; i++) expect(recentes).not.toContain(sortearFrase(i / 50, recentes));
    expect(FRASES_CAPELA).toContain(sortearFrase(0.999, FRASES_CAPELA));   // tudo recente: volta a sortear de todas
  });
});
