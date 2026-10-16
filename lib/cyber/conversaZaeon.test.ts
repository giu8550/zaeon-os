import { describe, expect, it } from "vitest";
import { ABERTURA, FALA_EXPULSAO, LIMITES, MAX_RESPOSTA, OPCOES_SITUACAO, PERGUNTAS, compromissoFixo, fallbackZaeon, fechamento, limparPerfil, limparResposta, promptZaeon, reacaoFixa, situacaoDe, validarTurnoIa, type PedidoZaeon } from "./conversaZaeon";
import { GLOBO_CAPELA, CIDADE } from "./ceu";

const pedido = (o: Partial<PedidoZaeon> = {}): PedidoZaeon => ({ perfil: { situacao: "estuda" }, historico: [], resposta: "Estudo medicina", turno: 0, foraSeguidas: 0, ...o });
const semNome = (t: string) => expect(t.toLowerCase()).not.toMatch(/te chame|seu nome|como voc[eê] se chama|\bidade\b|e-?mail|telefone/);

describe("a conversa com a Zaeon — UMA pergunta só", () => {
  it("abre com uma fala e faz uma ÚNICA pergunta: estuda, trabalha ou empreende (e os dois / começar algo novo)", () => {
    expect(ABERTURA).toHaveLength(1);
    expect(PERGUNTAS.map((p) => p.id)).toEqual(["situacao"]);
    expect(PERGUNTAS[0]!.fala).toMatch(/estuda.*trabalha.*empreende/);
    expect(PERGUNTAS[0]!.opcoes).toEqual(expect.arrayContaining(["Estudo", "Trabalho", "Empreendo", "Estudo e trabalho"]));
    for (const f of [...ABERTURA, ...fechamento(), FALA_EXPULSAO, ...PERGUNTAS.map((p) => p.fala)]) { expect(f.length).toBeLessThanOrEqual(160); semNome(f); }
    expect(LIMITES.turnosIa).toBe(1);
  });
  it("ela NÃO diz o próprio nome (saudação de quem esperava) e as respostas falam a língua dos telões (estudo → solução)", () => {
    const tudo = [...ABERTURA, ...fechamento(), ...[...OPCOES_SITUACAO.map((x) => ({ situacao: x.v })), {}].map((o) => `${reacaoFixa("situacao", "", o)} ${compromissoFixo(o)}`)];
    for (const t of tudo) expect(t).not.toMatch(/\bzaeon\b/i);
    for (const o of OPCOES_SITUACAO) expect(compromissoFixo({ situacao: o.v })).toMatch(/SOLUÇÃO|ESTUDO/);
    expect(fechamento()[0]).toMatch(/problemas/); expect(fechamento()[0]).not.toMatch(/moto/i);
  });
  it("entende a situação mesmo em texto livre", () => {
    expect(situacaoDe("Estudo")).toBe("estuda"); expect(situacaoDe("trabalho numa loja de roupas")).toBe("empreende");
    expect(situacaoDe("faço faculdade e trabalho de estagiário")).toBe("estuda_e_trabalha"); expect(situacaoDe("sou CLT")).toBe("trabalha");
    expect(situacaoDe("Quero começar algo novo")).toBe("nenhum"); expect(situacaoDe("abacate")).toBeNull();
  });
  it("cada situação tem a sua reação e o seu compromisso com o conhecimento — sem pergunta e sem pedir dado", () => {
    for (const o of [...OPCOES_SITUACAO.map((x) => ({ situacao: x.v })), {}]) {
      const t = `${reacaoFixa("situacao", "", o)} ${compromissoFixo(o)}`;
      expect(t).not.toContain("?"); semNome(t); expect(t.length).toBeLessThanOrEqual(240);
    }
  });
  it("o prompt pede reação + compromisso com o conhecimento, PROÍBE perguntas e dados, e classifica (ok/fora/abuso)", () => {
    const { system, user } = promptZaeon(pedido());
    expect(system).toMatch(/COMPROMISSO COM O CONHECIMENTO/); expect(system).toMatch(/NÃO faça nenhuma pergunta/); expect(system).toMatch(/NÃO peça nome/);
    expect(system).toMatch(/"abuso"/); expect(system).toMatch(/JSON/); expect(user).toContain("estuda");
  });
  it("valida o JSON da IA: fecha sempre; fala com pergunta não serve (volta a reserva); abuso passa; perfil só a área", () => {
    const ok = validarTurnoIa({ classe: "ok", fala: "Que demais! Estudar um pouco todo dia muda tudo.", perfil: { area: "Medicina", nome: "Ana" } }, pedido())!;
    expect(ok.concluido).toBe(true); expect(ok.opcoes).toEqual([]); expect(ok.perfil).toEqual({ situacao: "estuda", area: "Medicina" });
    expect(validarTurnoIa({ classe: "ok", fala: "Legal! O que você estuda?" }, pedido())).toBeNull();
    expect(validarTurnoIa({ classe: "abuso", fala: "" }, pedido())!.classe).toBe("abuso");
    expect(validarTurnoIa({ classe: "talvez", fala: "x" }, pedido())).toBeNull(); expect(validarTurnoIa(null, pedido())).toBeNull();
    expect(validarTurnoIa({ classe: "fora", fala: "Tudo bem! Aprender é um compromisso diário ✦" }, pedido())!.concluido).toBe(true);
  });
  it("sem IA (a reserva local): modera e fecha com a reação + o compromisso da situação", () => {
    const t = fallbackZaeon(pedido({ perfil: { situacao: "empreende" }, resposta: "Empreendo" }));
    expect(t.concluido).toBe(true); expect(t.fala).toContain(compromissoFixo({ situacao: "empreende" })); expect(t.fala).not.toContain("?");
    expect(fallbackZaeon(pedido({ resposta: "vai se foder" })).classe).toBe("abuso");
  });
  it("respostas e perfil limpos (sem HTML/controles, com teto; só as chaves conhecidas — nada de nome)", () => {
    expect(limparResposta("  Ana\n<b>Clara</b>  ")).toBe("Ana b Clara /b");
    expect(limparResposta("x".repeat(900))).toHaveLength(MAX_RESPOSTA);
    expect(limparPerfil({ nome: " Ana ", area: " Direito ", senha: "x", situacao: "estuda" })).toEqual({ situacao: "estuda", area: "Direito" });
  });
  it("o rosto sai do globo no centro da capela", () => {
    expect(GLOBO_CAPELA.y).toBeGreaterThan(GLOBO_CAPELA.r); expect(GLOBO_CAPELA.r).toBeLessThan(CIDADE.cidadela.r / 3);
  });
});
