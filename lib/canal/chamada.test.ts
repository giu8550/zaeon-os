/** #466 · chamar uma agente pelo NOME, sem @ — só quando é chamado de verdade. */
import { describe, it, expect } from "vitest";
import { chamadasPeloNome, falaComPessoa, pedeOutraAgente } from "./chamada";

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

describe("chamar pelo nome · #468 nome próprio em qualquer posição", () => {
  it("o caso do print: 'pode seguir em frente teo com a explicação' → Téo", () => {
    expect(chama("pode seguir em frente teo com a explicação")).toEqual(["teo"]);
  });
  it.each([
    ["quero que a zenita explique isso", []],        // depois de "a": é sobre ela, não chamado
    ["acho que zenita sabe isso melhor", []],         // depois de "que": falando SOBRE ela (cauteloso)
    ["zenita sabe isso melhor?", ["zenita"]],
    ["teo e zenita, me ajudem", ["teo", "zenita"]],
    ["a história do rei davi", []],
  ] as const)("%s", (t, esperado) => {
    expect(chamadasPeloNome(t, [...AGENTES, { agentKey: "davi", nome: "Davi" }])).toEqual(esperado);
  });
  it("'aura' (palavra comum) continua com a regra rígida", () => {
    expect(chama("aura e energia são a mesma coisa?")).toEqual([]);
    expect(chama("pode seguir em frente aura com a explicação")).toEqual([]);
  });
});

describe("chamar pelo nome · #551 falar SOBRE a agente não chama", () => {
  const COM_NINA = [...AGENTES, { agentKey: "nina", nome: "Nina" }];
  it.each([
    ["teo explicou mal, explica você", []],
    ["minha amiga nina também estuda isso", []],
    ["pergunta pro teo depois", []],
    ["teo e zenita são agentes de quê?", []],
    ["o professor teo falou isso", []],
    ["teo foi ótimo ontem", []],
    ["ontem a zenita respondeu rápido", []],
  ] as const)("não chama: %s", (t, esperado) => {
    expect(chamadasPeloNome(t, COM_NINA)).toEqual(esperado);
  });
  it.each([
    ["pode seguir em frente teo com a explicação", ["teo"]],
    ["e aí teo tudo bem?", ["teo"]],
    ["teo me ajuda com isso", ["teo"]],
    ["teo, explicou bem, agora o resto", ["teo"]],
    ["teo e zenita, me ajudem", ["teo", "zenita"]],
    ["nina tem um exemplo?", ["nina"]],
  ] as const)("chama: %s", (t, esperado) => {
    expect(chamadasPeloNome(t, COM_NINA)).toEqual(esperado);
  });
});

describe("falar COM uma pessoa da conversa · #551", () => {
  it.each(["tchau martinez, até amanhã", "martinez, viu isso?", "viu isso, martinez", "valeu martinez", "oi Martínez!", "Martinez"])("fala com ela: %s", (t) => {
    expect(falaComPessoa(t, ["Martinez Silva"])).toBe(true);
  });
  it.each(["o martinez disse que a prova é amanhã, é verdade?", "me explica a parte 2", "a ana falou de martingale"])("não: %s", (t) => {
    expect(falaComPessoa(t, ["Martinez Silva", "Ana"])).toBe(false);
  });
});

describe("chamar pelo nome · #560", () => {
  it.each([
    ["teo me explicou mal, explica você", []],
    ["teo me disse que era assim", []],
    ["aura te respondeu?", []],
  ] as const)("pronome + passado é falar SOBRE: %s", (t, esperado) => {
    expect(chama(t)).toEqual(esperado);
  });
  it.each([
    ["valeu aura, agora teo me ajuda", ["teo"]],
    ["obrigada zenita! teo, sua vez", ["teo"]],
    ["valeu aura", ["aura"]],
    ["valeu aura, me explica a parte 2", ["aura"]],
    ["teo me ajuda", ["teo"]],
    ["teo me explica isso", ["teo"]],
  ] as const)("obrigado não chama quando outra é chamada: %s", (t, esperado) => {
    expect(chama(t)).toEqual(esperado);
  });
});

describe("'explica você' fala com outra agente · #560", () => {
  const teo = { agentKey: "teo", nome: "Téo" };
  it.each(["teo explicou mal, explica você", "teo me explicou mal, explica você", "o téo disse isso, vc concorda?"])("sim: %s", (t) => {
    expect(pedeOutraAgente(t, teo)).toBe(true);
  });
  it.each(["explica de novo", "você pode explicar melhor?", "teo explicou bem"])("não: %s", (t) => {
    expect(pedeOutraAgente(t, teo)).toBe(false);
  });
});
