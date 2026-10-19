import { describe, expect, it } from "vitest";
import { coresDoGenero, lerPersonagem, paletaDoPersonagem, validarPersonagem } from "./personagem";

describe("personagem (gênero + cor)", () => {
  it("só aceita gênero conhecido e cor da lista daquele gênero", () => {
    const f = coresDoGenero("f")[0]!.cor, m = coresDoGenero("m")[0]!.cor;
    expect(validarPersonagem({ genero: "f", cor: f })).toEqual({ genero: "f", cor: f });
    expect(validarPersonagem({ genero: "m", cor: m.toUpperCase() })).toEqual({ genero: "m", cor: m });
    expect(validarPersonagem({ genero: "f", cor: m })).toBeNull();          // cor de outro gênero
    expect(validarPersonagem({ genero: "x", cor: f })).toBeNull();
    expect(validarPersonagem({ genero: "f", cor: "#123456" })).toBeNull();  // cor livre não
    expect(validarPersonagem(null)).toBeNull();
  });
  it("lê do cyberPerfil e vira a paleta da armadura", () => {
    const cor = coresDoGenero("f").find((c) => c.nome === "menta")!.cor;
    const p = lerPersonagem({ motosLiberadasEm: "x", personagem: { genero: "f", cor } })!;
    expect(paletaDoPersonagem(p)).toBe("fem:menta");
    expect(paletaDoPersonagem({ genero: "m", cor: "#2f7bff" })).toBe("#2f7bff");
    expect(lerPersonagem({})).toBeNull();
  });
});
