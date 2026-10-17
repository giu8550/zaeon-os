import { describe, it, expect } from "vitest";
import { montarSino, textoDoAviso, contadorDoSino, tempoRelativo, depoisDeLimpar, podeLimpar, estadoDoSino, acaoDoSino, type ConviteSino, type HistoricoSino } from "./sino";

const p = (id: string, nome: string) => ({ id, nome, avatar: null });
const cv = (id: string, nome: string, status = "pendente"): ConviteSino => ({ id, status, pessoa: p(`p-${id}`, nome) });
const h = (id: string, nome: string, direcao: "enviado" | "recebido", status: string, respondidoEm?: string): HistoricoSino =>
  ({ id, status, pessoa: p(`p-${id}`, nome), direcao, respondidoEm: respondidoEm ?? null });

describe("sino · frases", () => {
  it.each([
    ["recebido", "pendente", "Martinez quer conversar com você"],
    ["recebido", "aceito", "Você aceitou o convite de Martinez"],
    ["recebido", "recusado", "Você recusou o convite de Martinez"],
    ["enviado", "pendente", "Convite para Martinez: pendente"],
    ["enviado", "aceito", "Martinez aceitou seu convite"],
    ["enviado", "recusado", "Martinez recusou seu convite"],
  ] as const)("%s · %s → %s", (tipo, status, frase) => {
    expect(textoDoAviso(tipo, status, "Martinez")).toBe(frase);
  });
  it("sem nome vira 'Alguém'", () => {
    expect(textoDoAviso("enviado", "aceito", "")).toBe("Alguém aceitou seu convite");
  });
});

describe("sino · lista", () => {
  const dados = {
    recebidos: [cv("r1", "Martinez")],
    enviados: [cv("e1", "Ana")],
    historico: [h("h1", "Bia", "enviado", "aceito", "2026-10-05"), h("h2", "Caio", "recebido", "recusado", "2026-10-04")],
  };

  it("ordem: quem pede ação primeiro, depois os enviados pendentes, depois o histórico", () => {
    expect(montarSino(dados).map((i) => i.texto)).toEqual([
      "Martinez quer conversar com você",
      "Convite para Ana: pendente",
      "Bia aceitou seu convite",
      "Você recusou o convite de Caio",
    ]);
  });

  it("só o recebido pendente tem Aceitar/Recusar", () => {
    expect(montarSino(dados).map((i) => i.acao)).toEqual([true, false, false, false]);
  });

  it("status estranho vira 'pendente' e o mesmo convite não aparece duas vezes", () => {
    const l = montarSino({ recebidos: [cv("x", "Ana", "???")], enviados: [], historico: [h("x", "Ana", "recebido", "aceito")] });
    expect(l).toHaveLength(1);
    expect(l[0]!.status).toBe("pendente");
  });

  it("sino vazio", () => {
    expect(montarSino({ recebidos: [], enviados: [], historico: [] })).toEqual([]);
  });
});

describe("sino · bolinha", () => {
  const historico = [
    h("h1", "Bia", "enviado", "aceito", "2026-10-05T10:00:00Z"),
    h("h2", "Caio", "enviado", "recusado", "2026-10-03T10:00:00Z"),
    h("h3", "Dani", "recebido", "aceito", "2026-10-06T10:00:00Z"), // eu mesma respondi: não é novidade pra mim
  ];
  const visto = +new Date("2026-10-04T00:00:00Z");

  it("conta os recebidos pendentes + respostas aos MEUS convites depois da última visita", () => {
    expect(contadorDoSino({ recebidos: [cv("r1", "Martinez")], historico }, visto)).toBe(2); // Martinez + Bia
  });
  it("nunca abriu o sino: respostas antigas não acendem a bolinha", () => {
    expect(contadorDoSino({ recebidos: [], historico }, null)).toBe(0);
  });
  it("depois de abrir agora, só sobram os pendentes", () => {
    expect(contadorDoSino({ recebidos: [cv("r1", "M")], historico }, +new Date("2026-10-10"))).toBe(1);
  });
});

describe("sino · #425 data e hora de cada aviso", () => {
  // datas no fuso local (o sino mostra no fuso de quem olha)
  const agora = new Date(2026, 9, 16, 22, 30).getTime(); // 16/10/2026 22:30
  const em = (d: number, h: number, m = 0, mes = 9, ano = 2026) => new Date(ano, mes, d, h, m).getTime();

  it.each([
    [agora - 10_000, "agora"],
    [agora, "agora"],
    [agora + 120_000, "agora"],             // relógio adiantado: nunca "há -2 min"
    [agora - 5 * 60_000, "há 5 min"],
    [agora - 59 * 60_000, "há 59 min"],
    [em(16, 19, 10), "há 3 h"],              // ainda hoje
    [em(16, 0, 5), "há 22 h"],
    [em(15, 23, 50), "ontem"],               // 22h40 atrás, mas foi no dia anterior
    [em(15, 9), "ontem"],
    [em(14, 22), "14/10"],
    [em(3, 8, 0, 0), "03/01"],
    [em(25, 12, 0, 11, 2025), "25/12/25"],   // outro ano
  ])("%s → %s", (t, txt) => {
    expect(tempoRelativo(t as number, agora)).toBe(txt);
  });

  it("logo depois da meia-noite: 20 min atrás é 'há 20 min', não 'ontem'", () => {
    const meiaNoite = new Date(2026, 9, 16, 0, 10).getTime();
    expect(tempoRelativo(new Date(2026, 9, 15, 23, 50).getTime(), meiaNoite)).toBe("há 20 min");
    expect(tempoRelativo(new Date(2026, 9, 15, 22, 0).getTime(), meiaNoite)).toBe("ontem");
  });

  it("cada item do sino sabe quando aconteceu: pendente = convite, respondido = resposta", () => {
    const l = montarSino({
      recebidos: [{ id: "r", status: "pendente", pessoa: p("m", "M"), criadoEm: "2026-10-16T10:00:00Z" }],
      enviados: [],
      historico: [{ id: "h", status: "aceito", pessoa: p("b", "B"), direcao: "enviado", criadoEm: "2026-10-01T10:00:00Z", respondidoEm: "2026-10-02T10:00:00Z" }],
    });
    expect(l.map((i) => i.em)).toEqual([+new Date("2026-10-16T10:00:00Z"), +new Date("2026-10-02T10:00:00Z")]);
  });

  it("sem data nenhuma: em = null (a tela não mostra hora)", () => {
    expect(montarSino({ recebidos: [cv("r", "M")], enviados: [], historico: [] })[0]!.em).toBeNull();
  });
});

describe("sino · #425 clicar no aceito abre a conversa", () => {
  it("só o aceito leva a conversa; pendente e recusado não", () => {
    const l = montarSino({
      recebidos: [{ id: "r", status: "pendente", pessoa: p("m", "M"), dmCanalId: null }],
      enviados: [],
      historico: [
        { id: "a", status: "aceito", pessoa: p("b", "B"), direcao: "enviado", dmCanalId: "canal-1" },
        { id: "x", status: "recusado", pessoa: p("c", "C"), direcao: "recebido", dmCanalId: "canal-velho" },
        { id: "s", status: "aceito", pessoa: p("d", "D"), direcao: "recebido" },
      ],
    });
    expect(l.map((i) => [i.id, i.canalId])).toEqual([["r", null], ["a", "canal-1"], ["x", null], ["s", null]]);
  });
});

describe("sino · #425 Limpar", () => {
  const hist = [
    { id: "1", respondidoEm: "2026-10-05T10:00:00Z", criadoEm: "2026-10-01T10:00:00Z" },
    { id: "2", respondidoEm: "2026-10-10T10:00:00Z", criadoEm: "2026-10-09T10:00:00Z" },
    { id: "3", respondidoEm: null, criadoEm: "2026-10-12T10:00:00Z" },
  ];
  it("nunca limpou: tudo fica", () => {
    expect(depoisDeLimpar(hist, null).map((h) => h.id)).toEqual(["1", "2", "3"]);
  });
  it("limpou em 08/10: some o que foi respondido até ali; o que veio depois aparece", () => {
    expect(depoisDeLimpar(hist, +new Date("2026-10-08T00:00:00Z")).map((h) => h.id)).toEqual(["2", "3"]);
  });
  it("limpou agora: some tudo que já foi respondido", () => {
    expect(depoisDeLimpar(hist, +new Date("2026-10-16T00:00:00Z"))).toEqual([]);
  });
  it("o botão só aparece se tem algo respondido (pendente não se limpa)", () => {
    const so = montarSino({ recebidos: [cv("r", "M")], enviados: [cv("e", "A")], historico: [] });
    expect(podeLimpar(so)).toBe(false);
    expect(podeLimpar(montarSino({ recebidos: [], enviados: [], historico: [h("h", "B", "enviado", "aceito")] }))).toBe(true);
  });
});

describe("sino · #425 registro no banco", () => {
  it("datas do banco viram ms; sem registro = nada visto, nada limpo", () => {
    expect(estadoDoSino(null)).toEqual({ vistoEm: null, limpoAte: null });
    expect(estadoDoSino({ vistoEm: new Date("2026-10-16T10:00:00Z"), limpoAte: null }))
      .toEqual({ vistoEm: +new Date("2026-10-16T10:00:00Z"), limpoAte: null });
  });
  it("só aceita as ações 'visto' e 'limpar'", () => {
    expect(acaoDoSino("visto")).toBe("visto");
    expect(acaoDoSino("limpar")).toBe("limpar");
    expect(acaoDoSino("apagar")).toBeNull();
    expect(acaoDoSino(undefined)).toBeNull();
  });
});
