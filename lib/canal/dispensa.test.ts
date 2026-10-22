/** #438 · a agente entende quando é dispensada — e não confunde com tchau pra outra pessoa. */
import { describe, it, expect } from "vitest";
import { ehDispensa, normalizar, textoDespedida, textoSaiu, textoVoltou, agentesDepois, quemFoiDispensada, saidasDaMensagem } from "./dispensa";

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

describe("dispensa · #551 o 'e' entre nomes não corta a frase", () => {
  const aura = { key: "aura", nomes: ["Aura"] }, teo = { key: "teo", nomes: ["Téo", "Teo"] }, zen = { key: "zenita", nomes: ["Zenita"] };
  it.each([
    ["@aura e @teo podem ir embora", ["aura", "teo"]],
    ["aura e teo podem sair", ["aura", "teo"]],
    ["pode ir aura e zenita", ["aura", "zenita"]],
  ] as const)("%s", (t, saem) => {
    expect(quemFoiDispensada(t, [aura, teo, zen], 1)).toEqual(saem);
  });
  it("com o segundo nome mandado ficar, o 'e' continua cortando: 'pode sair teo e aura continua' → só o Téo", () => {
    expect(quemFoiDispensada("pode sair teo e aura continua", [aura, teo], 1)).toEqual(["teo"]);
  });
});

describe("dispensa · #551 'vocês duas', 'todas'", () => {
  const aura = { key: "aura", nomes: ["Aura"] }, teo = { key: "teo", nomes: ["Téo", "Teo"] };
  it.each(["vocês duas podem ir", "podem sair todas", "as duas podem ir embora", "vocês podem ir, valeu"])("tira todas: %s", (t) => {
    expect(quemFoiDispensada(t, [aura, teo], 1, ["teo"])).toEqual(["aura", "teo"]);
  });
  it("'pode ir' sem nome, com as duas na conversa → sai a da vez", () => {
    expect(quemFoiDispensada("pode ir", [aura, teo], 1, ["teo"])).toEqual(["teo"]);
  });
  it("sem saber a da vez, 'pode ir' com as duas → ninguém sai (como antes)", () => {
    expect(quemFoiDispensada("pode ir", [aura, teo], 1)).toEqual([]);
  });
});

describe("dispensa · #551 despedidas novas", () => {
  const sozinha = { ...zenita, humanos: 1 };
  it.each(["pode encerrar", "chega por hoje", "chega", "pode ir descansar", "zenita, pode se retirar", "pode encerrar por aqui", "vamos encerrar", "pode finalizar"])("sai: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(true);
  });
  it.each(["chega de exemplos, me explica a teoria", "pode encerrar o assunto anterior e explicar o novo", "vamos encerrar o capítulo 2 hoje?", "quando a aula chega ao fim?", "pode ir descansando a mente enquanto lê"])("fica: %s", (t) => {
    expect(ehDispensa(t, sozinha)).toBe(false);
  });
});

describe("dispensa · #551 saidasDaMensagem (quem está na conversa)", () => {
  const agentes = [{ agentKey: "aura", nome: "Aura" }, { agentKey: "teo", nome: "Téo" }];
  it("despedida de quem não estava é ignorada e não chama ninguém", () => {
    expect(saidasDaMensagem("tchau teo", { alvos: ["teo"], naConversa: ["aura"], agentes, humanos: 1 }))
      .toEqual({ dispensadas: [], ignoradas: ["teo"], respondem: [], chamados: [] });
  });
  it("conversa normal: ninguém sai, a da vez responde e fica na barra", () => {
    expect(saidasDaMensagem("me explica isso", { alvos: ["aura"], naConversa: ["aura", "teo"], agentes, humanos: 1 }))
      .toEqual({ dispensadas: [], ignoradas: [], respondem: ["aura"], chamados: ["aura"] });
  });
});
