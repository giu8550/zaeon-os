import { describe, it, expect } from "vitest";
import { parseMentions, montarAliases, semMencoes, normalizarAlias, sugerir, mencaoAberta } from "./mention";

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
