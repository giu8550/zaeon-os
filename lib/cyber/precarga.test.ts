import { describe, expect, it, beforeEach } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { _reiniciarPrecarga, aguentaPesados, manifesto, ouvirPrecarga, precarregarCyber, urlsDosCorpos, urlsDosSons } from "./precarga";

describe("precarga do cyberespaço", () => {
  beforeEach(() => _reiniciarPrecarga());

  it("todo arquivo do manifesto existe em public/ (sons, texturas, corpos)", () => {
    const faltando = manifesto(true).filter((i) => !existsSync(join(process.cwd(), "public", i.url)));
    expect(faltando).toEqual([]);
    expect(urlsDosSons().length).toBeGreaterThan(15);
    expect(urlsDosCorpos().length).toBeGreaterThanOrEqual(3);   // a Examiner, o Scholar (DJ) e o founder (os que saíram do mapa não baixam)
    for (const id of ["nina", "teo"]) expect(urlsDosCorpos().some((u) => u.includes(`/avatars/${id}/`))).toBe(true);   // (a Nina e o Téo voltaram: o mirante da torre de TI)
    for (const id of ["core_active", "caio", "farmacia", "quimica", "eng-civil"]) expect(urlsDosCorpos().some((u) => u.includes(`/avatars/${id}/`))).toBe(false);
  });

  it("sintetizados não entram; o fundador entra uma vez só", () => {
    expect(urlsDosSons().some((u) => /jato-sopro|baque/.test(u))).toBe(false);   // (os da moto viraram .wav de verdade: entram)
    expect(urlsDosSons().some((u) => /moto-motor/.test(u))).toBe(true);
    const corpos = urlsDosCorpos();
    expect(corpos.filter((u) => u.includes("fundador")).length).toBe(1);
    expect(manifesto(false).some((i) => i.tipo === "corpo")).toBe(false);
  });

  it("corpos só em tela grande, sem economia de dados e fora de 2g/3g", () => {
    expect(aguentaPesados({ largura: 1440 })).toBe(true);
    expect(aguentaPesados({ largura: 390 })).toBe(false);
    expect(aguentaPesados({ largura: 1440, saveData: true })).toBe(false);
    expect(aguentaPesados({ largura: 1440, effectiveType: "3g" })).toBe(false);
    expect(aguentaPesados({ largura: 1440, effectiveType: "slow-2g" })).toBe(false);
    expect(aguentaPesados({ largura: 1440, effectiveType: "4g" })).toBe(true);
  });

  it("a barra anda por bytes, chega a 1 e fica pronta; falha de arquivo não trava", async () => {
    const vistos: number[] = [];
    const baixarImpl = async (url: string, avancar: (d: number) => void, tamanho: (n: number) => void) => {
      if (url.endsWith("terra-blue-marble.jpg")) return 0;   // "falhou"
      tamanho(100); avancar(50); avancar(50); return 100;
    };
    const inicio = precarregarCyber({ importarCodigo: async () => ({}), ambiente: { largura: 390 }, baixarImpl, concorrencia: 2 });
    expect(inicio.pronto).toBe(false);
    await new Promise<void>((ok) => {
      ouvirPrecarga((e) => { vistos.push(e.progresso); if (e.pronto) ok(); });
    });
    expect(vistos[vistos.length - 1]).toBe(1);
    for (let i = 1; i < vistos.length; i++) expect(vistos[i]).toBeGreaterThanOrEqual(vistos[i - 1] - 1e-9);
    // começar de novo não reinicia (singleton)
    expect(precarregarCyber().pronto).toBe(true);
  });
});
