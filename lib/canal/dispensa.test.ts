/** #438 · a agente entende quando é dispensada — e não confunde com tchau pra outra pessoa. */
import { describe, it, expect } from "vitest";
import { ehDispensa, normalizar, textoDespedida, textoSaiu, textoVoltou, agentesDepois, quemFoiDispensada } from "./dispensa";

const zenita = { nomesDaAgente: ["zenita", "Zenita"], mencionada: false, humanos: 2 };

describe("dispensa · frases fortes (sempre dispensam a agente da vez)", () => {
  it.each([
    "@zenita pode ir embora, vlw",          // o caso real do Martinez
    "pode ir",
    "pode ir, valeu",
    "pode sair",
    "já pode ir",
    "Pode parar!",
    "vai embora",
    "para de responder",
    "não precisa mais responder",
    "é só isso",
    "era só isso, obrigado",
    "só isso, obrigada",
    "por hoje é só",
    "está dispensada",
  ])("%s", (t) => {
    expect(ehDispensa(t, zenita)).toBe(true);
  });
});

describe("dispensa · NÃO é dispensa", () => {
  it.each([
    "pode ir pesquisando sobre python",      // "pode ir" + verbo = continuar
    "pode ir resumindo o artigo",
    "pode sair um resumo disso?",
    "só isso que você sabe?",
    "valeu!",                                  // agradecer não é mandar embora
    "obrigada pela ajuda, agora me explica X",
    "eu quero essa gata pra mim ><",
    "o que é tchaikovsky?",                    // "tchau" dentro de palavra
  ])("%s", (t) => {
    expect(ehDispensa(t, zenita)).toBe(false);
  });
});

describe("dispensa · tchau (fraca) depende de com quem se fala", () => {
  it("conversa com outra pessoa: 'tchau' sozinho é pra pessoa, a agente fica", () => {
    expect(ehDispensa("tchau, até amanhã", zenita)).toBe(false);
    expect(ehDispensa("falou, Giulia", zenita)).toBe(false);
  });
  it("com o nome ou o @ da agente, vale", () => {
    expect(ehDispensa("tchau zenita", zenita)).toBe(true);
    expect(ehDispensa("até mais, Zenita!", zenita)).toBe(true);
    expect(ehDispensa("@zenita tchau", { ...zenita, mencionada: true })).toBe(true);
  });
  it("conversa só com a agente: 'tchau' basta", () => {
    expect(ehDispensa("tchau", { ...zenita, humanos: 1 })).toBe(true);
    expect(ehDispensa("até logo", { ...zenita, humanos: 1 })).toBe(true);
  });
});

describe("dispensa · textos", () => {
  it("normaliza acento, maiúscula e @", () => {
    expect(normalizar("@Zenita  PODE   Sair, Obrigadão")).toBe("pode sair, obrigadao");
  });
  it("despedida ensina a chamar de volta; linha de sistema com o nome", () => {
    expect(textoDespedida("zenita")).toContain("@zenita");
    expect(textoSaiu("Zenita")).toBe("Zenita saiu da conversa");
  });
});

describe("dispensa · #440 as frases da Giulia (que não tinham saído)", () => {
  it.each([
    ["não precisamos mais de você tchau", false],          // sem @ e sem o nome — mas "não precisamos mais de você" é dispensa
    ["pode sair @zenita não precisamos mais de você", true], // "pode sair" com mais texto depois
    ["pode sair, não precisamos mais de você", false],
    ["não preciso mais da sua ajuda", false],
    ["obrigada, pode deixar", false],
    ["pode ir, a gente continua depois", false],             // vírgula = outra frase: ainda é dispensa
    ["pode parar de responder", false],
  ] as const)("%s", (t, mencionada) => {
    expect(ehDispensa(t, { ...zenita, mencionada })).toBe(true);
  });

  it.each([
    "pode ir me explicando a parte 2",
    "pode sair um mapa mental disso?",
    "pode ir pra próxima questão",
    "pode ir com calma",
    "pode deixar mais curto?",
    "você não precisa mais responder em inglês, responde em português",   // instrução, não dispensa
    "para de responder assim tão longo",
  ])("NÃO dispensa: %s", (t) => {
    expect(ehDispensa(t, zenita)).toBe(false);
  });
});

describe("dispensa · #440 a barra de agentes", () => {
  it("chamados entram, dispensados saem, sem repetir", () => {
    expect(agentesDepois(["aura", "zenita"], [], ["zenita"])).toEqual(["aura"]);
    expect(agentesDepois(["aura"], ["zenita"], [])).toEqual(["aura", "zenita"]);
    expect(agentesDepois(["aura", "zenita"], ["zenita"], [])).toEqual(["aura", "zenita"]);
  });
  it("as linhas de saída e de volta", () => {
    expect(textoVoltou("Zenita")).toBe("Zenita voltou para a conversa");
  });
});

describe("dispensa · #443 frases normais NÃO tiram a agente (conversa só com a Zenita)", () => {
  const sozinha = { ...zenita, humanos: 1 };
  it.each([
    // item 1 do card: ela saía sem ser dispensada
    "pode ir em frente",
    "pode ir direto ao ponto",
    "pode sair do modo resumo e explicar melhor",
    "o professor falou que a prova é amanhã",
    "vou estudar isso até amanhã",
    "só isso? achei curto",
    // item 2: instrução virava dispensa
    "pode parar de responder em inglês",
    "pode parar de usar emoji",
    // e outras do mesmo tipo
    "pode ir mais devagar",
    "pode sair do tópico um pouco?",
    "falou muito bem, continua",
    "tchau é como se diz adeus?",
  ])("%s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(false);
  });

  it("e as despedidas de verdade continuam valendo, mesmo conversando só com ela", () => {
    for (const t of ["pode ir", "pode parar", "tchau", "até amanhã!", "falou", "valeu, pode ir embora", "pode parar de responder"]) {
      expect(ehDispensa(t, sozinha)).toBe(true);
    }
  });
});

describe("dispensa · #443 dispensar uma agente não tira as outras", () => {
  const aura = { key: "aura", nomes: ["Aura"] }, zen = { key: "zenita", nomes: ["Zenita"] };

  it("o caso do card: '@aura @zenita a zenita pode sair, aura continua comigo' → só a Zenita sai", () => {
    expect(quemFoiDispensada("@aura @zenita a zenita pode sair, aura continua comigo", [aura, zen], 1)).toEqual(["zenita"]);
  });
  it("'@zenita pode ir' com as duas na conversa → só a Zenita", () => {
    expect(quemFoiDispensada("@zenita pode ir", [aura, zen], 1)).toEqual(["zenita"]);
  });
  it("'@aura @zenita podem ir' (plural) → as duas", () => {
    expect(quemFoiDispensada("@aura @zenita podem ir, valeu", [aura, zen], 1)).toEqual(["aura", "zenita"]);
  });
  it("'@aura @zenita pode ir' → as duas foram chamadas no pedaço da despedida", () => {
    expect(quemFoiDispensada("@aura @zenita pode ir", [aura, zen], 1)).toEqual(["aura", "zenita"]);
  });
  it("'pode ir' sem dizer quem, com duas agentes → ninguém sai (melhor ficar do que sumir errado)", () => {
    expect(quemFoiDispensada("pode ir", [aura, zen], 1)).toEqual([]);
  });
  it("'tchau zenita' numa conversa com outra pessoa → só a Zenita", () => {
    expect(quemFoiDispensada("tchau zenita", [aura, zen], 2)).toEqual(["zenita"]);
  });
  it("nome escrito ganha do @: '@aura obrigada, zenita pode sair' → só a Zenita", () => {
    expect(quemFoiDispensada("@aura obrigada, zenita pode sair", [aura, zen], 1)).toEqual(["zenita"]);
  });
});

describe("dispensa · #466 despedidas com 'aqui', 'por agora', 'por favor'", () => {
  const sozinha = { ...zenita, humanos: 1 };
  it.each([
    "não precisamos mais de você aqui",
    "pode sair por agora",
    "pode ir embora por favor",
    "por favor pode sair",
    "pfv pode ir",
  ])("sai: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(true);
  });
  it.each([
    "pode ir mais fundo nisso",
    "pode sair desse assunto e falar de outro",
    "não preciso mais de você explicando isso, só me dá o resumo",
    "por favor pode explicar de novo",
  ])("fica: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(false);
  });
});

describe("dispensa · #466 'continua comigo' protege a agente", () => {
  const aura = { key: "aura", nomes: ["Aura"] }, teo = { key: "teo", nomes: ["Téo", "Teo"] };
  it("o caso do print: '@aura @teo pode sair, aura continua comigo…' → só o Téo sai", () => {
    expect(quemFoiDispensada("@aura @teo pode sair, aura continua comigo falando sobre as origens do quatros temperamentos", [aura, teo], 1)).toEqual(["teo"]);
  });
  it.each([
    "@aura @teo podem ir, fica só a aura",
    "@aura @teo pode sair, a aura pode continuar",
    "teo pode sair, aura segue comigo",
    "@aura @teo pode sair, aura fica",
  ])("só o Téo: %s", (t) => {
    expect(quemFoiDispensada(t, [aura, teo], 1)).toEqual(["teo"]);
  });
  it("sem ninguém mandado ficar, as duas marcadas saem", () => {
    expect(quemFoiDispensada("@aura @teo pode sair", [aura, teo], 1)).toEqual(["aura", "teo"]);
  });
});

describe("dispensa · #468 o verbo direto e o 'também'", () => {
  const sozinha = { ...zenita, humanos: 1 };
  it.each(["sai @zenita", "saia agora", "sai da conversa", "@zenita pode sair também", "vaza", "pode ir você também", "sai daqui"])("sai: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(true);
  });
  it.each(["sai um resumo disso?", "saiu o resultado da prova", "a aula saiu do ar", "quando sai o próximo capítulo", "saia do modo resumo e explica melhor", "saiu"])("fica: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(false);
  });
});

describe("dispensa · #468 @ colados", () => {
  it("'@aura@teo pode sair, aura continua comigo' = com espaço: só o Téo sai", () => {
    const aura = { key: "aura", nomes: ["Aura"] }, teo = { key: "teo", nomes: ["Téo", "Teo"] };
    expect(quemFoiDispensada("@aura@teo pode sair, aura continua comigo", [aura, teo], 1)).toEqual(["teo"]);
  });
});
