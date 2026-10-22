import { describe, it, expect } from "vitest";
import { passosDoTurno, pedidoDeAprovacao, textoErroPublicar, textoErroTurno, type EventoTurno } from "./passos";

let n = 0;
const ev = (tipo: EventoTurno["tipo"], dados: Record<string, unknown> = {}): EventoTurno => ({ seq: ++n, tipo, dados });

describe("passosDoTurno — cada evento vira um passo legível, como no Claude Code", () => {
  it("tool → resultado → arquivos: um passo só, com rótulo em português, ✓ e os arquivos gravados", () => {
    const passos = passosDoTurno([
      ev("pensando", { passo: 1 }),
      ev("tool", { tool: "octa_design_escolher", path: "DESIGN.md" }),
      ev("resultado", { tool: "octa_design_escolher", ok: true, resumo: "Estilo escolhido: Notion" }),
      ev("arquivo", { path: "DESIGN.md", acao: "gravado" }),
      ev("pensando", { passo: 2 }),
      ev("tool", { tool: "octa_pagina_montar" }),
      ev("resultado", { tool: "octa_pagina_montar", ok: true }),
      ev("arquivo", { path: "index.html", acao: "gravado" }),
      ev("arquivo", { path: "styles.css", acao: "gravado" }),
      ev("fim", { resposta: "Pronto!" }),
    ], true);
    expect(passos).toEqual([
      { tipo: "tool", chave: expect.any(String), tool: "octa_design_escolher", rotulo: "Escolhendo o estilo", path: "DESIGN.md", estado: "ok", resumo: "Estilo escolhido: Notion", arquivos: [{ path: "DESIGN.md", acao: "gravado" }] },
      { tipo: "tool", chave: expect.any(String), tool: "octa_pagina_montar", rotulo: "Montando a página", estado: "ok", arquivos: [{ path: "index.html", acao: "gravado" }, { path: "styles.css", acao: "gravado" }] },
    ]);
  });

  it("turno vivo: tool sem resultado está rodando e o último 'pensando' vira o indicador ativo", () => {
    expect(passosDoTurno([ev("pensando"), ev("tool", { tool: "octa_ler", path: "DESIGN.md" })], false).map((p) => p.tipo === "tool" && p.estado)).toEqual(["rodando"]);
    const vivo = passosDoTurno([ev("tool", { tool: "octa_ler" }), ev("resultado", { tool: "octa_ler", ok: true }), ev("pensando", { passo: 2 })], false);
    expect(vivo[vivo.length - 1]).toMatchObject({ tipo: "pensando" });
    // terminado: sem indicador
    expect(passosDoTurno([ev("pensando")], true)).toEqual([]);
  });

  it("falha mostra o motivo em português (código conhecido) ou o código cru", () => {
    const [a, b] = passosDoTurno([
      ev("tool", { tool: "octa_escrever", path: "x.html" }), ev("resultado", { tool: "octa_escrever", ok: false, codigo: "marca_no_conteudo" }),
      ev("resultado", { tool: "octa_publicar", ok: false, codigo: "algo_novo" }),
    ], true) as any[];
    expect(a).toMatchObject({ estado: "falhou", motivo: expect.stringMatching(/marca/) });
    expect(b).toMatchObject({ tool: "octa_publicar", rotulo: "Publicando no GitHub", estado: "falhou", motivo: "algo_novo" });
  });

  it("aprovação: passo aguardando; aprovado, o 'tool' seguinte continua o MESMO passo; recusado, falha 'você recusou'", () => {
    const aguardando = passosDoTurno([ev("aprovacao", { tool: "octa_publicar" })], false);
    expect(aguardando).toEqual([expect.objectContaining({ estado: "aguardando", rotulo: "Publicando no GitHub" })]);
    const aprovado = passosDoTurno([ev("aprovacao", { tool: "octa_publicar" }), ev("tool", { tool: "octa_publicar" }), ev("resultado", { tool: "octa_publicar", ok: true })], true);
    expect(aprovado).toEqual([expect.objectContaining({ estado: "ok" })]);
    const recusado = passosDoTurno([ev("aprovacao", { tool: "octa_apagar", path: "a.css" }), ev("resultado", { tool: "octa_apagar", ok: false, codigo: "recusado_pelo_aluno" })], true);
    expect(recusado).toEqual([expect.objectContaining({ estado: "falhou", motivo: "você recusou" })]);
  });

  it("erro do turno vira um passo de erro com texto fixo", () => {
    expect(passosDoTurno([ev("erro", { codigo: "tempo_esgotado" })], true)).toEqual([{ tipo: "erro", chave: expect.any(String), texto: textoErroTurno("tempo_esgotado") }]);
  });
});

describe("textos fixos", () => {
  it("pedido de aprovação diz o que o Octa quer fazer", () => {
    expect(pedidoDeAprovacao("octa_publicar")).toBe("publicar o site no seu GitHub");
    expect(pedidoDeAprovacao("octa_escrever", "index.html")).toBe("escrever index.html");
    expect(pedidoDeAprovacao("octa_apagar", "a.css")).toBe("apagar a.css");
    expect(pedidoDeAprovacao("octa_x")).toBe("usar octa_x");
  });

  it("todo código de publicação tem mensagem em português; desconhecido cai numa genérica", () => {
    for (const c of ["github_reconectar", "aviso_publico_pendente", "limite_publicacoes", "limite_repos", "falha_github", "projeto_inexistente", "sem_arquivos_publicaveis"]) {
      expect(textoErroPublicar(c)).not.toBe(textoErroPublicar("???"));
    }
    expect(textoErroPublicar("limite_publicacoes")).toMatch(/10/);
    expect(textoErroPublicar("limite_repos")).toMatch(/3/);
    // anti-marca: diz qual palavra editar
    expect(textoErroPublicar("marca_no_conteudo", "Nintendo")).toMatch(/“Nintendo”/);
    expect(textoErroPublicar("marca_no_conteudo", "Nintendo")).toMatch(/troque|edite/i);
    expect(textoErroPublicar("marca_no_conteudo")).not.toBe(textoErroPublicar("???"));
    for (const c of ["falha_modelo", "budget", "projeto_inexistente", "tempo_esgotado"]) expect(textoErroTurno(c)).not.toBe(textoErroTurno("???"));
  });
});
