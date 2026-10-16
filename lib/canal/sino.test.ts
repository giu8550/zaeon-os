import { describe, it, expect } from "vitest";
import { montarSino, textoDoAviso, contadorDoSino, chaveVistoSino, type ConviteSino, type HistoricoSino } from "./sino";

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
  it("chave do 'visto' é por pessoa", () => {
    expect(chaveVistoSino("abc")).not.toBe(chaveVistoSino("def"));
  });
});
