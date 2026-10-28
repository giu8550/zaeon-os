import { describe, it, expect } from "vitest";
import { colorirCodigo } from "./codigo";

const de = (tipo: string, codigo: string, lang?: string) =>
  colorirCodigo(codigo, lang).filter((p) => p.tipo === tipo).map((p) => p.t);

describe("colorirCodigo (#634)", () => {
  it("separa comentário, string, número e palavra-chave sem perder nenhum caractere", () => {
    const c = 'def soma(a, b):\n    # junta\n    return a + b + 10  # "fim"\nprint("oi # não é comentário")';
    const p = colorirCodigo(c, "python");
    expect(p.map((x) => x.t).join("")).toBe(c);
    expect(de("comentario", c, "python")).toEqual(["# junta", '# "fim"']);
    expect(de("string", c, "python")).toEqual(['"oi # não é comentário"']);
    expect(de("numero", c, "python")).toEqual(["10"]);
    expect(de("palavra", c, "python")).toEqual(["def", "return"]);
  });
  it("comentário pela linguagem: // e /* */ no JS, -- no SQL; # no JS não é comentário", () => {
    expect(de("comentario", "/* a */ x = 1; // b\n#priv", "js")).toEqual(["/* a */", "// b"]);
    expect(de("comentario", "SELECT 1 -- ok", "sql")).toEqual(["-- ok"]);
  });
  it("sem linguagem: # só no começo da linha", () => {
    expect(de("comentario", "# topo\nx = 1 # meio")).toEqual(["# topo"]);
  });
  it("texto/saída: sem cores", () => {
    expect(colorirCodigo("if 1 # x", "text")).toEqual([{ tipo: "texto", t: "if 1 # x" }]);
  });
});
