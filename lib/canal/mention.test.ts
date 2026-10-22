import { describe, it, expect } from "vitest";
import { parseMentions, montarAliases, semMencoes, normalizarAlias, sugerir, mencaoAberta, separarMencoesColadas } from "./mention";

const AGENTES = [
  { agentKey: "aura", nome: "Aura" },
  { agentKey: "medicina", nome: "Osler" },
  { agentKey: "teo", nome: "Téo" },
  { agentKey: "eng-computacao", nome: "Turing" },
];
const AL = montarAliases(AGENTES);

describe("mention · parseMentions", () => {
  it("extrai agentKeys por key e por nome (case/acento-insensível)", () => {
    expect(parseMentions("@aura me ajuda", AL)).toEqual(["aura"]);
    expect(parseMentions("Oi @Osler e @AURA", AL)).toEqual(["medicina", "aura"]);
    expect(parseMentions("@teo @Téo @TEO", AL)).toEqual(["teo"]);
    expect(parseMentions("fala @eng-computacao", AL)).toEqual(["eng-computacao"]);
  });
  it("ignora @desconhecido, emails e @ no meio de palavra", () => {
    expect(parseMentions("@ninguem @fulano", AL)).toEqual([]);
    expect(parseMentions("manda pra don@aura.com", AL)).toEqual([]);
    expect(parseMentions("", AL)).toEqual([]);
    expect(parseMentions("@aura, @medicina! (@teo)", AL)).toEqual(["aura", "medicina", "teo"]);
  });
  it("único na ordem de aparição", () => {
    expect(parseMentions("@medicina depois @aura e de novo @Osler", AL)).toEqual(["medicina", "aura"]);
  });
});

describe("mention · helpers", () => {
  it("normalizarAlias", () => {
    expect(normalizarAlias("Téo")).toBe("teo");
    expect(normalizarAlias(" Eng Computação ")).toBe("engcomputacao");
  });
  it("semMencoes remove só os conhecidos", () => {
    expect(semMencoes("@aura resume isso @fulano", AL)).toBe("resume isso @fulano");
    expect(semMencoes("@Osler", AL)).toBe("");
  });
  it("sugerir filtra por prefixo", () => {
    expect(sugerir("os", AGENTES).map((a) => a.agentKey)).toEqual(["medicina"]);
    expect(sugerir("t", AGENTES).map((a) => a.agentKey)).toEqual(["teo", "eng-computacao"]);
    expect(sugerir("", AGENTES, 2)).toHaveLength(2);
  });
  it("mencaoAberta detecta @ sendo digitado", () => {
    expect(mencaoAberta("oi @au")).toEqual({ inicio: 3, prefixo: "au" });
    expect(mencaoAberta("oi @")).toEqual({ inicio: 3, prefixo: "" });
    expect(mencaoAberta("oi @aura ")).toBeNull();
    expect(mencaoAberta("don@aura")).toBeNull();
  });
});

describe("menções · #468 coladas", () => {
  const al = montarAliases([{ agentKey: "aura", nome: "Aura" }, { agentKey: "teo", nome: "Téo" }]);
  it("'@aura@teo pode sair' reconhece as duas", () => {
    expect(parseMentions("@aura@teo pode sair, aura continua comigo", al)).toEqual(["aura", "teo"]);
  });
  it("e-mail não vira menção nem é cortado", () => {
    expect(separarMencoesColadas("me manda em giulia@gmail.com")).toBe("me manda em giulia@gmail.com");
    expect(parseMentions("me manda em aura@gmail.com", al)).toEqual([]);
  });
  it("tira as duas do texto do pedido", () => {
    expect(semMencoes("@aura@teo me ajudem", al)).toBe("me ajudem");
  });
});

describe("menções · #551 separadas por barra", () => {
  const al = montarAliases([{ agentKey: "aura", nome: "Aura" }, { agentKey: "teo", nome: "Téo" }]);
  it("'@teo/@aura o que acham?' chama as duas", () => {
    expect(parseMentions("@teo/@aura o que acham?", al)).toEqual(["teo", "aura"]);
  });
  it("barra solta no texto continua como está", () => {
    expect(separarMencoesColadas("1/2 de @aura")).toBe("1/2 de @aura");
  });
});
