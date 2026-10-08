import { describe, expect, it } from "vitest";
import { FALAS_DROID, HABILIDADES, habilidadeDaTecla, habilidadesDe, prontaPraUsar, sortear, teclaDoRadio } from "./habilidades";

const ctx = (o: Partial<Parameters<typeof habilidadeDaTecla>[1]> = {}) => ({ fundador: true, digitando: false, repetida: false, modificador: false, ...o });

describe("habilidades por tecla", () => {
  it("G invoca/dispensa o Droid companheiro — só o founder, por enquanto", () => {
    expect(habilidadeDaTecla("g", ctx())?.id).toBe("droid-companheiro");
    expect(habilidadeDaTecla("G", ctx())?.id).toBe("droid-companheiro");
    expect(habilidadeDaTecla("g", ctx({ fundador: false }))).toBeNull();
    expect(habilidadesDe(false)).toHaveLength(0); expect(habilidadesDe(true).length).toBe(HABILIDADES.length);
  });
  it("não dispara digitando, com a tecla repetindo ou com Ctrl/⌘/Alt", () => {
    for (const o of [{ digitando: true }, { repetida: true }, { modificador: true }]) expect(habilidadeDaTecla("g", ctx(o))).toBeNull();
    expect(habilidadeDaTecla("h", ctx())).toBeNull();
  });
  it("recarga: não dá pra spammar", () => {
    const h = HABILIDADES[0]!;
    expect(prontaPraUsar(h, undefined, 0)).toBe(true); expect(prontaPraUsar(h, 10, 10.5)).toBe(false); expect(prontaPraUsar(h, 10, 10 + h.recarga)).toBe(true);
  });
  it("o rádio (push-to-talk) sai do G pro V só pra quem tem habilidade no G", () => {
    expect(teclaDoRadio(true)).toBe("v"); expect(teclaDoRadio(false)).toBe("g");
  });
  it("as falas do Droid são curtas e sorteadas", () => {
    for (const f of [...FALAS_DROID.chega, ...FALAS_DROID.vai]) expect(f.length).toBeLessThanOrEqual(40);
    expect(sortear(FALAS_DROID.chega, 0)).toBe(FALAS_DROID.chega[0]); expect(sortear(FALAS_DROID.chega, 0.9999)).toBe(FALAS_DROID.chega.at(-1));
  });
});
