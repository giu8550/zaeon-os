import { describe, expect, it } from "vitest";
import { ABERTURA, FALA_EXPULSAO, LIMITES, MAX_RESPOSTA, PERGUNTAS, fallbackZaeon, faltando, fechamento, limparPerfil, limparResposta, nomeDe, promptZaeon, reacaoFixa, situacaoDe, validarTurnoIa, type PedidoZaeon } from "./conversaZaeon";
import { GLOBO_CAPELA, CIDADE } from "./ceu";

const pedido = (o: Partial<PedidoZaeon> = {}): PedidoZaeon => ({ perfil: { nome: "Ana", situacao: "estuda" }, historico: [], resposta: "Medicina", turno: 0, foraSeguidas: 0, ...o });

describe("a conversa com a Zaeon — a parte FIXA (nome e situação)", () => {
  it("abre, pergunta o nome e a situação (estuda, trabalha, EMPREENDE, os dois, nenhum) — falas curtas", () => {
    expect(PERGUNTAS.map((p) => p.id)).toEqual(["nome", "situacao"]);
    expect(PERGUNTAS[1]!.opcoes).toEqual(expect.arrayContaining(["Estudo", "Trabalho", "Empreendo", "Estudo e trabalho"]));
    for (const f of [...ABERTURA, ...fechamento({ nome: "Ana" }), FALA_EXPULSAO, ...PERGUNTAS.map((p) => p.fala)]) expect(f.length).toBeLessThanOrEqual(160);
  });
  it("entende o nome e a situação mesmo em texto livre", () => {
    expect(nomeDe("me chama de Ana Clara.")).toBe("Ana Clara"); expect(nomeDe("Meu nome é João")).toBe("João"); expect(nomeDe("Bia")).toBe("Bia");
    expect(situacaoDe("Empreendo")).toBe("empreende"); expect(situacaoDe("faço faculdade de direito")).toBe("estuda");
    expect(situacaoDe("trabalho e estudo à noite")).toBe("estuda_e_trabalha"); expect(situacaoDe("tenho uma loja online")).toBe("empreende");
    expect(situacaoDe("tô desempregado")).toBe("nenhum"); expect(situacaoDe("banana")).toBeNull();
    expect(reacaoFixa("nome", "Ana", { nome: "Ana" })).toContain("Ana");
    for (const s of ["estuda", "trabalha", "empreende", "estuda_e_trabalha", "nenhum"]) expect(reacaoFixa("situacao", "x", { situacao: s }).length).toBeGreaterThan(10);
  });
});

describe("a conversa com a Zaeon — a parte GERATIVA (o contrato com a IA)", () => {
  it("o prompt carrega a missão OCULTA, a classificação (ok/fora/abuso), o formato JSON e o que falta saber", () => {
    const { system, user } = promptZaeon(pedido({ historico: [{ quem: "zaeon", texto: "O que você estuda?" }] }));
    expect(system).toMatch(/NUNCA mencione gamificação/); expect(system).toMatch(/"classe":"ok\|fora\|abuso"/); expect(system).toMatch(/abuso/);
    expect(user).toContain("Medicina"); expect(user).toContain("O que você estuda?"); expect(user).toMatch(/AINDA FALTA SABER: foco, querEstudar, objetivo/);
  });
  it("valida o JSON da IA: classe obrigatória, fala limpa, perfil só com chaves conhecidas, até 4 opções", () => {
    const t = validarTurnoIa({ classe: "ok", fala: "Medicina! Que lindo. E o que você quer aprender aqui?", perfil: { foco: "Medicina", senha: "x" }, opcoes: ["a", "b", "c", "d", "e"], concluido: false }, pedido())!;
    expect(t).toMatchObject({ classe: "ok", concluido: false, ia: true, perfil: { nome: "Ana", situacao: "estuda", foco: "Medicina" } });
    expect(t.opcoes).toHaveLength(4); expect(t.perfil).not.toHaveProperty("senha");
    expect(validarTurnoIa({ classe: "talvez", fala: "x" }, pedido())).toBeNull(); expect(validarTurnoIa({ classe: "ok", fala: "" }, pedido())).toBeNull(); expect(validarTurnoIa("lixo", pedido())).toBeNull();
    expect(validarTurnoIa({ classe: "abuso" }, pedido())).toMatchObject({ classe: "abuso", concluido: false });
  });
  it("a IA só reagiu (sem pergunta)? entra a pergunta do roteiro pro que falta — a conversa nunca fica parada", () => {
    const t = validarTurnoIa({ classe: "ok", fala: "Enfermagem, que legal, Ana!", perfil: { foco: "enfermagem" }, concluido: false }, pedido())!;
    expect(t.concluido).toBe(false); expect(t.fala).toMatch(/^Enfermagem, que legal, Ana! .+\?$/);
    const cheio = validarTurnoIa({ classe: "ok", fala: "Show!", perfil: { foco: "x", querEstudar: "y", objetivo: "z" } }, pedido())!;
    expect(cheio.concluido).toBe(true);
  });
  it("fecha sozinha: quando a IA conclui, quando estoura as trocas, ou depois de fugas de assunto seguidas", () => {
    expect(validarTurnoIa({ classe: "ok", fala: "Fechado!", concluido: true }, pedido())!.concluido).toBe(true);
    expect(validarTurnoIa({ classe: "ok", fala: "Mais uma?", concluido: false }, pedido({ turno: LIMITES.turnosIa - 1 }))!.concluido).toBe(true);
    expect(validarTurnoIa({ classe: "fora", fala: "Hm, de novo: o que você estuda?" }, pedido({ foraSeguidas: LIMITES.foraSeguidas - 1 }))!.concluido).toBe(true);
    expect(validarTurnoIa({ classe: "fora", fala: "Hm, de novo: o que você estuda?" }, pedido())!.concluido).toBe(false);
  });
  it("sem IA (a reserva local): modera, pergunta de novo o que não entendeu, preenche o que falta em ordem e fecha", () => {
    expect(fallbackZaeon(pedido({ resposta: "vai se foder" })).classe).toBe("abuso");
    expect(fallbackZaeon(pedido({ resposta: "?" }))).toMatchObject({ classe: "fora", concluido: false });
    let p = pedido({ resposta: "Medicina" }), t = fallbackZaeon(p);
    expect(t).toMatchObject({ classe: "ok", concluido: false, perfil: { foco: "Medicina" } });
    t = fallbackZaeon({ ...p, perfil: t.perfil, resposta: "Cardiologia", turno: 1 }); expect(t.perfil.querEstudar).toBe("Cardiologia");
    t = fallbackZaeon({ ...p, perfil: t.perfil, resposta: "Passar na residência", turno: 2 }); expect(t).toMatchObject({ concluido: true, perfil: { objetivo: "Passar na residência" } });
    expect(faltando({ situacao: "nenhum" })).toEqual(["querEstudar", "objetivo"]);   // quem não estuda nem trabalha: não pergunta "o que você faz"
  });
  it("respostas e perfil limpos (sem HTML/controles, com teto)", () => {
    expect(limparResposta("  Ana\n<b>Clara</b>  ")).toBe("Ana b Clara /b");
    expect(limparResposta("x".repeat(900))).toHaveLength(MAX_RESPOSTA);
    expect(limparPerfil({ nome: " Ana ", area: "", senha: "x", objetivo: "TCC" })).toEqual({ nome: "Ana", objetivo: "TCC" });
  });
  it("o rosto sai do globo no centro da capela", () => {
    expect(GLOBO_CAPELA.y).toBeGreaterThan(GLOBO_CAPELA.r); expect(GLOBO_CAPELA.r).toBeLessThan(CIDADE.cidadela.r / 3);
  });
});
