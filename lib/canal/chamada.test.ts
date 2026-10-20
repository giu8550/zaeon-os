/** #466 · chamar uma agente pelo NOME, sem @ — só quando é chamado de verdade. */
import { describe, it, expect } from "vitest";
import { chamadasPeloNome } from "./chamada";

const AGENTES = [
  { agentKey: "aura", nome: "Aura" }, { agentKey: "teo", nome: "Téo" }, { agentKey: "zenita", nome: "Zenita" },
  { agentKey: "caio", nome: "Caio" }, { agentKey: "zaeon", nome: "Zaeon" },
];
const chama = (t: string, pessoas: string[] = []) => chamadasPeloNome(t, AGENTES, pessoas);

describe("chamar pelo nome · conta", () => {
  it("o caso do print: 'sim continue aura pode ir em frente' → Aura (não o Téo)", () => {
    expect(chama("sim continue aura pode ir em frente")).toEqual(["aura"]);
  });
  it.each([
    ["aura, me explica isso", ["aura"]],
    ["me explica isso, aura", ["aura"]],
    ["oi aura", ["aura"]],
    ["aura me ajuda com python", ["aura"]],
    ["Téo, responde em inglês", ["teo"]],
    ["teo pode sair, aura continua comigo", ["aura", "teo"]],
    ["Zenita: o que acha?", ["zenita"]],
  ] as const)("%s", (t, esperado) => {
    expect(chama(t)).toEqual(esperado);
  });
});

describe("chamar pelo nome · NÃO conta", () => {
  it.each([
    "minha aura está pesada hoje",
    "qual é a cor da sua aura?",
    "fale sobre aura e energia",
    "a zaeon é muito legal",
    "o que é a aura de um lugar",
    "estudei a teoria do caio prado",
    "aura e energia são a mesma coisa?",
  ])("%s", (t) => {
    expect(chama(t)).toEqual([]);
  });
  it("Caio é uma PESSOA da conversa: 'Caio, você viu?' fala com ele, não chama a agente Caio", () => {
    expect(chama("Caio, você viu o resultado?", ["Caio Martins"])).toEqual([]);
    expect(chama("Caio, você viu o resultado?")).toEqual(["caio"]);
  });
  it("@ não passa por aqui (o @ já chama)", () => {
    expect(chama("@aura oi")).toEqual([]);
  });
});
