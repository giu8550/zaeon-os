import { describe, it, expect } from "vitest";
import { limparSaidaAgente } from "./saida";

describe("limparSaidaAgente", () => {
  it("remove imagem markdown (exfiltração por URL)", () => {
    expect(limparSaidaAgente("veja ![x](https://e/p.png?d=segredo) aqui")).toBe("veja aqui");
    expect(limparSaidaAgente("![a][ref]")).toBe("");
  });
  it("remove <img> e qualquer tag HTML, inclusive script com conteúdo", () => {
    expect(limparSaidaAgente('oi <img src="https://e/p.png"> tchau')).toBe("oi tchau");
    expect(limparSaidaAgente("a<script>alert(1)</script>b")).toBe("ab");
    expect(limparSaidaAgente("<b>forte</b>")).toBe("forte");
  });
  it("mantém **negrito**, *itálico* e quebras", () => {
    const t = "**b** e *i*\nlinha 2";
    expect(limparSaidaAgente(t)).toBe(t);
  });
  it("texto limpo sai byte a byte igual (turno do canal não muda)", () => {
    const t = "Olá  mundo — veja [o artigo](https://scielo.br/x).\n\n\n fim ";
    expect(limparSaidaAgente(t)).toBe(t);
  });
  it("javascript:/data: em links viram só o rótulo; soltos somem", () => {
    expect(limparSaidaAgente("[clique](javascript:alert(1))")).toBe("clique");
    expect(limparSaidaAgente("[x](data:text/html;base64,PHN)")).toBe("x");
    expect(limparSaidaAgente("abre javascript:void(0) já")).toBe("abre já");
    expect(limparSaidaAgente("img data:image/png;base64,iVBOR fim")).toBe("img fim");
  });
  it("comparação matemática não é tag", () => {
    expect(limparSaidaAgente("se x < y e y > z")).toBe("se x < y e y > z");
  });
});
