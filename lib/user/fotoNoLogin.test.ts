/** #438 · a foto do Gmail atualiza na Zaeon a cada login com o Google — sem nunca derrubar o login. */
import { describe, it, expect, vi } from "vitest";
import { atualizarFotoDoGoogle } from "./fotoNoLogin";

const G = "https://lh3.googleusercontent.com/a/ACg8ocL-letra-g=s96-c";
const AZULA = "https://lh3.googleusercontent.com/a/ACg8ocK-azula=s96-c";
const PROPRIA = "data:image/jpeg;base64,QUJD";

function banco(fotoAtual: string | null) {
  const salvos: [string, string][] = [];
  return {
    salvos,
    deps: { lerFoto: async () => fotoAtual, salvarFoto: async (email: string, image: string) => { salvos.push([email, image]); } },
  };
}

describe("foto do Google no login", () => {
  it("a giu dev trocou a foto no Gmail → no próximo login a Zaeon pega a nova", async () => {
    const b = banco(G);
    expect(await atualizarFotoDoGoogle({ provider: "google", email: "devgiu@z.com", picture: AZULA }, b.deps)).toBe("atualizou");
    expect(b.salvos).toEqual([["devgiu@z.com", AZULA]]);
  });

  it("quem pôs foto própria na Zaeon (como o Martinez) mantém a dela", async () => {
    const b = banco(PROPRIA);
    expect(await atualizarFotoDoGoogle({ provider: "google", email: "m@z.com", picture: AZULA }, b.deps)).toBe("manteve");
    expect(b.salvos).toEqual([]);
  });

  it("mesma foto, login por e-mail ou sem foto no Google → não mexe", async () => {
    const b = banco(AZULA);
    expect(await atualizarFotoDoGoogle({ provider: "google", email: "a@z.com", picture: AZULA }, b.deps)).toBe("manteve");
    expect(await atualizarFotoDoGoogle({ provider: "credentials", email: "a@z.com", picture: G }, b.deps)).toBe("manteve");
    expect(await atualizarFotoDoGoogle({ provider: "google", email: "a@z.com", picture: undefined }, b.deps)).toBe("manteve");
    expect(b.salvos).toEqual([]);
  });

  it("banco fora do ar: o login NÃO quebra (só avisa no log)", async () => {
    const aviso = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await atualizarFotoDoGoogle(
      { provider: "google", email: "a@z.com", picture: AZULA },
      { lerFoto: async () => { throw new Error("mongo caiu"); }, salvarFoto: async () => {} },
    );
    expect(r).toBe("manteve");
    expect(aviso).toHaveBeenCalled();
    aviso.mockRestore();
  });
});
