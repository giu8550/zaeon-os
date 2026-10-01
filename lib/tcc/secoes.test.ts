import { describe, it, expect } from "vitest";
import {
  aplicarOp, aplicarOps, chaveTitulo, diffSecoes, idUnico, isOpTipo, isOrigem, isSecaoId, MAX_CORPO, MAX_SECOES,
  mesmoConteudo, novasSecoes, opDeDesfazer, rebasearOps, opsDeWork, palavras, readSecoes, secoesDeMarkdown, secoesParaMarkdown, slugSecao,
  type Secao,
} from "@/lib/tcc/secoes";

const doc = (): Secao[] => [
  { id: "introducao", titulo: "INTRODUÇÃO", corpo: "intro" },
  { id: "metodologia", titulo: "METODOLOGIA", corpo: "método" },
  { id: "conclusao", titulo: "CONCLUSÃO", corpo: "" },
];

describe("ids e títulos", () => {
  it("slug estável: acento, caixa e espaço não mudam o id", () => {
    expect(slugSecao("Introdução")).toBe("introducao");
    expect(slugSecao("  INTRODUCAO ")).toBe("introducao");
    expect(slugSecao("Resultados e Discussão")).toBe("resultados-e-discussao");
    expect(slugSecao("!!!")).toBe("secao");
    expect(chaveTitulo("Referências")).toBe(chaveTitulo("REFERENCIAS"));
  });
  it("idUnico não colide", () => {
    expect(idUnico("a", new Set())).toBe("a");
    expect(idUnico("a", new Set(["a", "a-2"]))).toBe("a-3");
  });
  it("guards de tipo", () => {
    expect([isOpTipo("anexar"), isOpTipo("apagar_tudo"), isOpTipo(1)]).toEqual([true, false, false]);
    expect([isOrigem("pesquisa"), isOrigem("admin")]).toEqual([true, false]);
    expect([isSecaoId("intro-2"), isSecaoId("a b"), isSecaoId("x".repeat(65)), isSecaoId(3)]).toEqual([true, false, false, false]);
  });
  it("novasSecoes deriva ids sem colisão e ignora título vazio", () => {
    const s = novasSecoes([{ titulo: "Intro" }, { titulo: "intro", corpo: "b" }, { titulo: "  " }]);
    expect(s.map((x) => x.id)).toEqual(["intro", "intro-2"]);
    expect(s[1].corpo).toBe("b");
  });
});

describe("readSecoes (Json do banco)", () => {
  it("tolera lixo sem lançar e descarta id repetido/inválido", () => {
    expect(readSecoes(null)).toEqual([]);
    expect(readSecoes({})).toEqual([]);
    const r = readSecoes([{ id: "a", titulo: "A", corpo: "x" }, { id: "a", titulo: "dup" }, { id: "b c", titulo: "B" }, { id: "c", titulo: "" }, null, { id: "d", titulo: "D", corpo: 5 }]);
    expect(r.map((s) => s.id)).toEqual(["a", "d"]);
    expect(r[1].corpo).toBe("");
  });
  it("respeita o teto de seções e de corpo", () => {
    const muitas = Array.from({ length: MAX_SECOES + 5 }, (_, i) => ({ id: `s${i}`, titulo: `S${i}`, corpo: "y".repeat(MAX_CORPO + 10) }));
    const r = readSecoes(muitas);
    expect(r).toHaveLength(MAX_SECOES);
    expect(r[0].corpo).toHaveLength(MAX_CORPO);
  });
});

describe("markdown ⇄ seções", () => {
  it("ida e volta preserva títulos, corpos e ids", () => {
    const md = secoesParaMarkdown(doc());
    expect(md).toContain("# INTRODUÇÃO\n\nintro");
    const volta = secoesDeMarkdown(md, doc());
    expect(volta.map((s) => [s.id, s.titulo, s.corpo])).toEqual(doc().map((s) => [s.id, s.titulo, s.corpo]));
  });
  it("## subseção fica no corpo (igual ao parseAbntMarkers)", () => {
    const r = secoesDeMarkdown("# REFERENCIAL\n\n## Conceitos\n\ntexto");
    expect(r).toHaveLength(1);
    expect(r[0].corpo).toBe("## Conceitos\n\ntexto");
  });
  it("texto antes do 1º título não se perde", () => {
    const r = secoesDeMarkdown("solto\n# A\nx");
    expect(r.map((s) => s.titulo)).toEqual(["TEXTO", "A"]);
  });
  it("títulos repetidos ganham ids distintos; vazio = nenhuma seção", () => {
    expect(secoesDeMarkdown("# A\n1\n# A\n2").map((s) => s.id)).toEqual(["a", "a-2"]);
    expect(secoesDeMarkdown("")).toEqual([]);
    expect(secoesParaMarkdown([])).toBe("");
  });
});

describe("aplicarOp — a edição é POR SEÇÃO", () => {
  it("substituir muda SÓ a seção alvo e devolve antes/depois", () => {
    const r = aplicarOp(doc(), { op: "substituir", secaoId: "metodologia", corpo: "novo método" });
    if (!r.ok) throw new Error(r.erro);
    expect(r.secoes.map((s) => s.corpo)).toEqual(["intro", "novo método", ""]);
    expect(r.efeito).toEqual({ op: "substituir", secaoId: "metodologia", titulo: "METODOLOGIA", antes: "método", depois: "novo método" });
  });
  it("substituir com título renomeia sem trocar o id", () => {
    const r = aplicarOp(doc(), { op: "substituir", secaoId: "conclusao", corpo: "c", titulo: "CONSIDERAÇÕES FINAIS" });
    if (!r.ok) throw new Error(r.erro);
    expect(r.secoes[2]).toEqual({ id: "conclusao", titulo: "CONSIDERAÇÕES FINAIS", corpo: "c" });
  });
  it("anexar acrescenta ao fim (com parágrafo) e em seção vazia não deixa linha em branco", () => {
    const a = aplicarOp(doc(), { op: "anexar", secaoId: "introducao", corpo: " mais " });
    const b = aplicarOp(doc(), { op: "anexar", secaoId: "conclusao", corpo: "fim" });
    if (!a.ok || !b.ok) throw new Error();
    expect(a.secoes[0].corpo).toBe("intro\n\nmais");
    expect(b.secoes[2].corpo).toBe("fim");
  });
  it("inserir depois de uma seção, no fim se aposId não existe, com id único", () => {
    const a = aplicarOp(doc(), { op: "inserir", titulo: "Objetivos", corpo: "o", aposId: "introducao" });
    const b = aplicarOp(doc(), { op: "inserir", titulo: "Introdução", aposId: "nao-existe" });
    if (!a.ok || !b.ok) throw new Error();
    expect(a.secoes.map((s) => s.id)).toEqual(["introducao", "objetivos", "metodologia", "conclusao"]);
    expect(a.efeito.antes).toBeNull();
    expect(b.secoes.at(-1)!.id).toBe("introducao-2");
  });
  it("inserir com secaoId explícito (restaurar) só se o id estiver livre e for válido", () => {
    expect(aplicarOp(doc(), { op: "inserir", titulo: "X", secaoId: "velha" }).ok).toBe(true);
    expect(aplicarOp(doc(), { op: "inserir", titulo: "X", secaoId: "metodologia" })).toEqual({ ok: false, erro: "secao_existente" });
    expect(aplicarOp(doc(), { op: "inserir", titulo: "X", secaoId: "a b" })).toEqual({ ok: false, erro: "op_invalida" });
  });
  it("remover tira a seção e guarda o corpo no antes", () => {
    const r = aplicarOp(doc(), { op: "remover", secaoId: "introducao" });
    if (!r.ok) throw new Error();
    expect(r.secoes.map((s) => s.id)).toEqual(["metodologia", "conclusao"]);
    expect(r.efeito).toMatchObject({ antes: "intro", depois: "" });
  });
  it("recusas: op desconhecida, seção inexistente, inserir sem título, teto de seções", () => {
    expect(aplicarOp(doc(), { op: "zap" as any })).toEqual({ ok: false, erro: "op_invalida" });
    expect(aplicarOp(doc(), null as any)).toEqual({ ok: false, erro: "op_invalida" });
    expect(aplicarOp(doc(), { op: "substituir", secaoId: "x", corpo: "" })).toEqual({ ok: false, erro: "secao_inexistente" });
    expect(aplicarOp(doc(), { op: "inserir", titulo: "   " })).toEqual({ ok: false, erro: "sem_titulo" });
    const cheio = Array.from({ length: MAX_SECOES }, (_, i) => ({ id: `s${i}`, titulo: `S${i}`, corpo: "" }));
    expect(aplicarOp(cheio, { op: "inserir", titulo: "mais" })).toEqual({ ok: false, erro: "limite" });
  });
});

describe("aplicarOps", () => {
  it("encadeia e não registra 'mudança' que não muda nada", () => {
    const r = aplicarOps(doc(), [
      { op: "substituir", secaoId: "introducao", corpo: "intro" }, // igual → sem efeito
      { op: "anexar", secaoId: "conclusao", corpo: "fim" },
    ]);
    if (!r.ok) throw new Error();
    expect(r.efeitos).toHaveLength(1);
    expect(r.secoes[2].corpo).toBe("fim");
  });
  it("a primeira recusa interrompe tudo (nada parcial)", () => {
    expect(aplicarOps(doc(), [{ op: "anexar", secaoId: "introducao", corpo: "x" }, { op: "remover", secaoId: "zz" }]))
      .toEqual({ ok: false, erro: "secao_inexistente", indice: 1 });
  });
});

describe("opsDeWork — work.sections da Sala de Estudos", () => {
  it("título que existe substitui; título novo insere; corpo igual/vazio e repetido são ignorados", () => {
    const ops = opsDeWork(doc(), [
      { title: "Introdução", body: "intro nova" },
      { title: "METODOLOGIA", body: "método" },       // igual
      { title: "Objetivos", body: "obj" },
      { title: "objetivos", body: "dup" },
      { title: "Vazia", body: "  " },
      null,
    ]);
    expect(ops).toEqual([
      { op: "substituir", secaoId: "introducao", corpo: "intro nova" },
      { op: "inserir", titulo: "Objetivos", corpo: "obj" },
    ]);
  });
  it("não-array = nenhuma op; aceita {titulo, corpo} também", () => {
    expect(opsDeWork(doc(), undefined)).toEqual([]);
    expect(opsDeWork([], [{ titulo: "A", corpo: "b" }])).toEqual([{ op: "inserir", titulo: "A", corpo: "b" }]);
  });
});

describe("diffSecoes — edição manual do editor", () => {
  it("só o que mudou vira op; seção sumida vira remover; nova vira inserir após a anterior", () => {
    const novas = [
      { id: "introducao", titulo: "INTRODUÇÃO", corpo: "intro editada" },
      { id: "x", titulo: "JUSTIFICATIVA", corpo: "j" },
      { id: "conclusao", titulo: "CONCLUSÃO", corpo: "" },
    ];
    expect(diffSecoes(doc(), novas)).toEqual([
      { op: "substituir", secaoId: "introducao", corpo: "intro editada", titulo: "INTRODUÇÃO" },
      { op: "inserir", titulo: "JUSTIFICATIVA", corpo: "j", aposId: "introducao" },
      { op: "remover", secaoId: "metodologia" },
    ]);
  });
  it("casa por título quando o id não bate; nada mudou = nenhuma op", () => {
    expect(diffSecoes(doc(), doc())).toEqual([]);
    const outroId = doc().map((s) => ({ ...s, id: `z-${s.id}` }));
    expect(diffSecoes(doc(), outroId)).toEqual([]);
  });
  it("aplicar o diff reproduz exatamente o documento editado", () => {
    const md = secoesParaMarkdown(doc()).replace("método", "método revisto") + "\n# APÊNDICE\n\nap";
    const novas = secoesDeMarkdown(md, doc());
    const r = aplicarOps(doc(), diffSecoes(doc(), novas));
    if (!r.ok) throw new Error();
    expect(r.secoes.map((s) => [s.titulo, s.corpo])).toEqual(novas.map((s) => [s.titulo, s.corpo]));
  });
});

describe("opDeDesfazer", () => {
  it("revisão de substituir → volta o corpo de antes", () => {
    expect(opDeDesfazer({ op: "substituir", secaoId: "introducao", antes: "velho" }, doc()))
      .toEqual({ op: "substituir", secaoId: "introducao", corpo: "velho" });
  });
  it("revisão de inserir → remove (se ainda existe), senão nada", () => {
    expect(opDeDesfazer({ op: "inserir", secaoId: "metodologia", antes: null }, doc())).toEqual({ op: "remover", secaoId: "metodologia" });
    expect(opDeDesfazer({ op: "inserir", secaoId: "sumiu", antes: null }, doc())).toBeNull();
  });
  it("revisão de remover → recria a seção com o MESMO id e título", () => {
    expect(opDeDesfazer({ op: "remover", secaoId: "apendice", titulo: "APÊNDICE", antes: "ap" }, doc()))
      .toEqual({ op: "inserir", secaoId: "apendice", titulo: "APÊNDICE", corpo: "ap" });
    expect(opDeDesfazer({ op: "remover", secaoId: "apendice", antes: "ap" }, doc())!.titulo).toBe("SEÇÃO");
  });
});

it("palavras conta tokens", () => {
  expect([palavras(""), palavras("  um  dois\ntrês ")]).toEqual([0, 3]);
});

describe("merge de 3 vias (rebasearOps / mesmoConteudo)", () => {
  it("op em seção que ainda existe passa; substituir de seção sumida vira recriar; remover sumida some; aposId sumido vai pro fim", () => {
    expect(rebasearOps([
      { op: "substituir", secaoId: "introducao", corpo: "a", titulo: "INTRODUÇÃO" },
      { op: "substituir", secaoId: "sumiu", corpo: "b", titulo: "SUMIU" },
      { op: "substituir", secaoId: "sumiu2", corpo: "c" },
      { op: "remover", secaoId: "sumiu" },
      { op: "inserir", titulo: "N", corpo: "n", aposId: "sumiu" },
      { op: "inserir", titulo: "M", corpo: "m", aposId: "metodologia" },
    ], doc())).toEqual([
      { op: "substituir", secaoId: "introducao", corpo: "a", titulo: "INTRODUÇÃO" },
      { op: "inserir", titulo: "SUMIU", corpo: "b" },
      { op: "inserir", titulo: "N", corpo: "n", aposId: null },
      { op: "inserir", titulo: "M", corpo: "m", aposId: "metodologia" },
    ]);
  });
  it("mesmoConteudo ignora formatação (linhas em branco/espaços), não conteúdo", () => {
    expect(mesmoConteudo("# A\n\n\n\nx\n\n\n# B\n", "# A\n\nx\n\n# B")).toBe(true);
    expect(mesmoConteudo("# A\n\nx", "# A\n\ny")).toBe(false);
  });
});
