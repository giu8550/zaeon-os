/**
 * lib/octa/agente.ts — o AGENTE do Octa Code: um laço planeja → lê → edita → responde sobre o workspace do aluno.
 *
 * Toda chamada de ferramenta passa por `runOctaTool` (lib/octa/runner): guard da tarefa (modo review/change +
 * file-lock + teto de subagentes), conteúdo de arquivo vira DADO cercado (anti prompt-injection), trace com custo,
 * e o log SHIT pro juiz. O modelo é o REAL do app via gateway (lib/octa/litellm.modeloReal) — injetável no teste.
 * O workspace vive em memória durante o turno; o que mudou volta pro cliente como `edicoes`.
 *
 * Fluxo "landing" (`TurnoOcta.fluxo`): libera 3 tools — octa_design_escolher (estilo da biblioteca DESIGN.md),
 * octa_pagina_montar (seções → index.html + styles.css) e octa_publicar (GitHub do aluno, via closure injetada:
 * a tool nunca vê token nem email). Sem o fluxo, essas tools nem são oferecidas e chamá-las é negado.
 * Permissão do projeto (`opts.permissao`, lib/octa/permissao): a tool que precisa do aluno PARA o laço e volta como
 * `pendente`; `opts.retomar` continua de `msgs` com a decisão dele.
 * Eventos ao vivo (`opts.onEvento`, lib/queue/octa): nome da tool, caminho, ok/código e o resumo JÁ REDIGIDO de tool
 * que escreve — nunca conteúdo de arquivo lido nem mensagem crua de erro.
 */
import { registerTool, getTool, err, type ToolDef, type ToolContext } from "@/lib/agent/runtime";
import { novaSessao, runOctaTool } from "@/lib/octa/runner";
import { normalizePath, octaPermit, type OctaTask } from "@/lib/octa/guard";
import { detectShit, PERGUNTAS_ANTES_DE_AGIR, type ShitFlag } from "@/lib/octa/shit";
import { REGRA_DADOS_NAO_COMANDOS } from "@/lib/octa/untrusted";
import { custoDoRun, type Trace } from "@/lib/octa/trace";
import { gerarPeca, verificarDeterminismo } from "@/lib/octa/genart";
import { carregarIndice, candidatosPorDescricao, designMdComMarcador, estiloDoProjeto, palavrasDaMarca, type EstiloDesign } from "@/lib/octa/design/indice";
import { extrairTokens } from "@/lib/octa/design/tokens";
import { renderPagina, ErroMarca } from "@/lib/octa/secoes/render";
import { validarSecoes, TIPOS_SECAO } from "@/lib/octa/secoes/tipos";
import { precisaAprovacao } from "@/lib/octa/permissao";
import type { PermissaoOcta } from "@/lib/octa/projetos";
import type { ErroPublicar, ResultadoPublicar } from "@/lib/octa/publicar";

export type Workspace = Record<string, string>;
/** Publica o projeto do aluno (a rota fecha userId/email/projetoId aqui dentro; a tool só vê o resultado). */
export type PublicarOcta = (p: { arquivos: Workspace; mensagem?: string }) => Promise<ResultadoPublicar>;
type CtxOcta = ToolContext & { octaWs?: Workspace; octaPedido?: string; octaPublicar?: PublicarOcta };

const MAX_ARQ = 200_000;
const ws = (ctx: ToolContext): Workspace => (ctx as CtxOcta).octaWs ?? {};
const ok = (claim: string) => ({ ok: true, findings: [{ claim, confidence: "alta" as const }], provenance: {} });
const schema = (name: string, description: string, props: Record<string, string>, required: string[]) => ({
  name, description,
  parameters: { type: "OBJECT" as any, properties: Object.fromEntries(Object.entries(props).map(([k, d]) => [k, { type: "STRING" as any, description: d }])), required },
});

/** Onde a arte de uma seed mora. O laço põe isso em `args.path` antes do guard (que confere o file-lock pelo path). */
export const caminhoDaArte = (seed: string) => `arte/${seed.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "peca"}.svg`;
/** Pasta onde o agente sempre pode gravar arte em modo alteração. */
export const PASTA_ARTE = "arte/**";

// ───────────────────────────── ferramentas do workspace ─────────────────────────────
export const FERRAMENTAS: ToolDef[] = [
  {
    name: "octa_listar", runtime: "ts", risk: "read", minPlan: "free",
    schema: schema("octa_listar", "Lista os arquivos do projeto (caminho e tamanho).", {}, []),
    async run(_a, ctx) {
      const lista = Object.entries(ws(ctx)).map(([p, c]) => `${p} (${c.length} b)`);
      return ok(lista.length ? lista.join("\n") : "(projeto vazio)");
    },
  },
  {
    name: "octa_ler", runtime: "ts", risk: "read", minPlan: "free",
    schema: schema("octa_ler", "Lê o conteúdo de um arquivo do projeto.", { path: "caminho relativo" }, ["path"]),
    async run(a, ctx) {
      const p = normalizePath(String(a?.path ?? ""));
      if (!p || !(p in ws(ctx))) return err(`arquivo não existe: ${a?.path}`, "not_found");
      return ok(ws(ctx)[p]);
    },
  },
  {
    name: "octa_buscar", runtime: "ts", risk: "read", minPlan: "free",
    schema: schema("octa_buscar", "Procura um texto em todos os arquivos (devolve caminho:linha: trecho).", { texto: "o que procurar" }, ["texto"]),
    async run(a, ctx) {
      const q = String(a?.texto ?? "").toLowerCase();
      if (!q) return err("busca vazia", "bad_args");
      const hits: string[] = [];
      for (const [p, c] of Object.entries(ws(ctx))) c.split("\n").forEach((l, i) => { if (hits.length < 60 && l.toLowerCase().includes(q)) hits.push(`${p}:${i + 1}: ${l.trim().slice(0, 160)}`); });
      return ok(hits.length ? hits.join("\n") : "nada encontrado");
    },
  },
  {
    name: "octa_escrever", runtime: "ts", risk: "write", minPlan: "free",
    schema: schema("octa_escrever", "Cria ou substitui um arquivo inteiro (só dentro dos arquivos liberados pela tarefa).", { path: "caminho relativo", conteudo: "o conteúdo completo do arquivo" }, ["path", "conteudo"]),
    async run(a, ctx) {
      const p = normalizePath(String(a?.path ?? ""));
      const c = String(a?.conteudo ?? "");
      if (!p) return err("caminho inválido", "bad_args");
      if (c.length > MAX_ARQ) return err("arquivo grande demais", "too_large");
      ws(ctx)[p] = c;
      return ok(`gravado ${p} (${c.length} b)`);
    },
  },
  {
    name: "octa_arte", runtime: "ts", risk: "write", minPlan: "free",
    schema: schema("octa_arte", "Gera uma arte generativa DETERMINÍSTICA (mesma seed = mesma peça) e grava como SVG em arte/<seed>.svg.", { seed: "a seed (ex.: o tema pedido)" }, ["seed"]),
    async run(a, ctx) {
      const seed = String(a?.seed ?? "").trim().slice(0, 120);
      if (!seed) return err("seed vazia", "bad_args");
      if (!verificarDeterminismo(seed).ok) return err("peça não determinística", "nondeterministic");
      const p = gerarPeca(seed);
      const path = caminhoDaArte(seed);
      ws(ctx)[path] = p.svg;
      return ok(`${p.titulo} gravada em ${path} (hash ${p.hash.slice(0, 12)}; traços ${JSON.stringify(p.tracos)})`);
    },
  },
  {
    name: "octa_apagar", runtime: "ts", risk: "destructive", minPlan: "free",
    schema: schema("octa_apagar", "Apaga um arquivo (pede aprovação do aluno).", { path: "caminho relativo" }, ["path"]),
    async run(a, ctx) {
      const p = normalizePath(String(a?.path ?? ""));
      if (!p || !(p in ws(ctx))) return err(`arquivo não existe: ${a?.path}`, "not_found");
      delete ws(ctx)[p];
      return ok(`apagado ${p}`);
    },
  },
];
FERRAMENTAS.forEach(registerTool);

// ───────────────────────────── ferramentas do fluxo landing ─────────────────────────────
export { MARCADOR_ESTILO } from "@/lib/octa/design/indice";
/** O DESIGN.md do workspace: o estilo de origem (se veio da biblioteca) e o markdown sem o marcador. */
const designDoWorkspace = (w: Workspace) => estiloDoProjeto(w);

function gravarDesign(w: Workspace, e: EstiloDesign): void {
  w["DESIGN.md"] = designMdComMarcador(e.id);
}

/** O que cada falha da publicação vira pro modelo: instrução curta, sem nenhum detalhe do GitHub. */
const INSTRUCAO_PUBLICAR: Record<ErroPublicar, string> = {
  github_reconectar: "O GitHub do aluno não está conectado (ou a conexão venceu): peça ao aluno para conectar o GitHub e tente de novo.",
  aviso_publico_pendente: "Peça ao aluno para aceitar o aviso de repositório público (o código e a página ficarão públicos no GitHub dele).",
  limite_publicacoes: "O aluno chegou ao limite de publicações de hoje; avise que dá pra publicar de novo amanhã.",
  limite_repos: "O aluno chegou ao limite de repositórios novos de hoje; avise que dá pra criar amanhã.",
  falha_github: "O GitHub falhou agora; avise o aluno e sugira tentar de novo em alguns minutos.",
  projeto_inexistente: "Este projeto não está salvo no servidor; peça ao aluno para salvar o projeto antes de publicar.",
  sem_arquivos_publicaveis: "Não há arquivos de site para publicar (index.html, .css…); monte a página antes.",
  marca_no_conteudo: "A página menciona o nome da marca de origem do estilo; reescreva o texto sem ele e tente de novo.",
};

const recusaMarca = (palavra: string, onde: string) =>
  err(`a palavra "${palavra}" é o nome da marca de origem do estilo e não pode aparecer ${onde}; reescreva esse trecho trocando "${palavra}" por outra palavra e tente de novo.`, "marca_no_conteudo");

export const FERRAMENTAS_LANDING: ToolDef[] = [
  {
    name: "octa_design_escolher", runtime: "ts", risk: "write", minPlan: "free",
    schema: schema("octa_design_escolher", "Escolhe o estilo visual da landing na biblioteca DESIGN.md e grava DESIGN.md no projeto.", {
      descricao: "como a página deve parecer (clima, cores, referência), nas palavras do aluno",
      id: "opcional: id exato de um estilo da biblioteca (das opções que esta tool devolveu)",
    }, ["descricao"]),
    async run(a, ctx) {
      const descricao = String(a?.descricao ?? "").slice(0, 500);
      const indice = carregarIndice();
      const pedido = typeof a?.id === "string" ? indice.find((e) => e.id === a.id) : undefined;
      const candidatos = candidatosPorDescricao(descricao, indice, 5);
      const e = pedido ?? candidatos[0];
      if (!e) return err("biblioteca de estilos vazia", "not_found");
      gravarDesign(ws(ctx), e);
      const outros = candidatos.filter((c) => c.id !== e.id).map((c) => `${c.id} (${c.nome})`).join(", ");
      return ok([
        `Estilo escolhido: ${e.nome} (id ${e.id}; clima: ${e.clima.join(", ")}). ${e.resumo.slice(0, 300)}`,
        `DESIGN.md gravado: leia antes de editar. Nunca use "${e.marca}" (nome, logo ou texto da marca) na página.`,
        outros ? `Outras opções: ${outros}.` : "",
      ].filter(Boolean).join("\n"));
    },
  },
  {
    name: "octa_pagina_montar", runtime: "ts", risk: "write", minPlan: "free",
    schema: schema("octa_pagina_montar", "Monta a landing (index.html + styles.css) a partir de seções, com os tokens do DESIGN.md.", {
      secoes: `JSON: lista de {"id","type","props"}. type ∈ ${TIPOS_SECAO.join(", ")}. props: title, subtitle, description, eyebrow, ctaText, ctaLink, items[], stats[], bullets[]…`,
      titulo: "título da página (aba do navegador)",
      descricao: "descrição curta da página (busca e cartão de link)",
    }, ["secoes", "titulo"]),
    async run(a, ctx) {
      let bruto: unknown;
      try { bruto = JSON.parse(String(a?.secoes ?? "")); } catch (e: any) {
        return err(`secoes não é JSON válido (${String(e?.message ?? e).slice(0, 120)}); mande uma lista JSON de {"id","type","props"}.`, "bad_args");
      }
      const secoes = validarSecoes(Array.isArray(bruto) ? bruto : (bruto as any)?.secoes);
      if (!secoes.length) return err(`nenhuma seção válida; use type entre: ${TIPOS_SECAO.join(", ")}.`, "bad_args");
      const titulo = String(a?.titulo ?? "").trim().slice(0, 120);
      if (!titulo) return err("titulo vazio", "bad_args");
      const descricao = String(a?.descricao ?? "").trim().slice(0, 300);

      const w = ws(ctx);
      let aviso = "";
      if (!designDoWorkspace(w)) {
        const e = candidatosPorDescricao((ctx as CtxOcta).octaPedido || `${titulo} ${descricao}`, carregarIndice(), 1)[0];
        if (e) { gravarDesign(w, e); aviso = ` Sem DESIGN.md: escolhi o estilo ${e.nome} (id ${e.id}) e gravei DESIGN.md.`; }
      }
      const d = designDoWorkspace(w);
      const tokens = extrairTokens(d?.md ?? "", palavrasDaMarca(d?.estilo).join(" "));
      let pagina: Awaited<ReturnType<typeof renderPagina>>;
      try {
        pagina = await renderPagina({ titulo, descricao, secoes, tokens, marcaProibida: palavrasDaMarca(d?.estilo) });
      } catch (e) {
        if (e instanceof ErroMarca) return recusaMarca(e.palavra, "na página (texto, título ou descrição)");
        throw e;
      }
      if (pagina["index.html"].length > MAX_ARQ) return err("página grande demais; use menos seções ou textos menores", "too_large");
      w["index.html"] = pagina["index.html"];
      w["styles.css"] = pagina["styles.css"];
      return ok(`montei index.html e styles.css com ${secoes.length} seção(ões): ${secoes.map((x) => x.type).join(", ")}.${aviso}`);
    },
  },
  {
    name: "octa_publicar", runtime: "ts", risk: "destructive", minPlan: "free", timeoutMs: 90_000,
    schema: schema("octa_publicar", "Publica o projeto no GitHub do aluno (repositório público + GitHub Pages) e devolve as URLs.", {
      mensagem: "opcional: mensagem do commit",
    }, []),
    async run(a, ctx) {
      const publicar = (ctx as CtxOcta).octaPublicar;
      if (!publicar) return err("publicação indisponível neste turno", "sem_publicador");
      const w = ws(ctx);
      const mensagem = typeof a?.mensagem === "string" && a.mensagem.trim() ? a.mensagem.trim().slice(0, 200) : undefined;
      // DESIGN.md (marca de origem + marcador) nunca sai do Octa; caminhoPublicavel é a 2ª barreira
      const arquivos = Object.fromEntries(Object.entries(w).filter(([p]) => p.split("/").pop()?.toLowerCase() !== "design.md"));
      const r = await publicar({ arquivos, mensagem });
      // a regra anti-marca mora em publicarProjeto (vale também pro botão Publicar da IDE)
      if (!r.ok && r.erro === "marca_no_conteudo") return recusaMarca(r.palavra, "na página publicada");
      if (!r.ok) return err(INSTRUCAO_PUBLICAR[r.erro] ?? "a publicação falhou; avise o aluno.", r.erro);
      const quando = r.status === "publicando" ? "no ar em ~1 min" : "no ar";
      const pulados = r.ignorados.length ? ` Não publicados (não são arquivos de site): ${r.ignorados.slice(0, 20).join(", ")}.` : "";
      return ok(`Publicado. Repositório: ${r.repoUrl} · Site: ${r.pagesUrl} (${quando}).${pulados}`);
    },
  },
];
FERRAMENTAS_LANDING.forEach(registerTool);
const NOMES_LANDING = new Set(FERRAMENTAS_LANDING.map((t) => t.name));

const paraGateway = (t: ToolDef) => ({
  type: "function" as const,
  function: {
    name: t.name,
    description: t.schema.description,
    parameters: {
      type: "object",
      properties: Object.fromEntries(Object.entries((t.schema.parameters as any)?.properties ?? {}).map(([k, v]: [string, any]) => [k, { type: "string", description: v.description }])),
      required: (t.schema.parameters as any)?.required ?? [],
    },
  },
});

/** Formato de ferramenta do gateway (OpenAI-compatível). As do fluxo landing só entram com `fluxo: "landing"`. */
export const ferramentasGateway = (fluxo?: "landing") => (fluxo === "landing" ? [...FERRAMENTAS, ...FERRAMENTAS_LANDING] : FERRAMENTAS).map(paraGateway);
export const FERRAMENTAS_GATEWAY = ferramentasGateway();

// ───────────────────────────── o laço ─────────────────────────────
export type MsgModelo =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChamadaTool[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ChamadaTool = { id: string; type: "function"; function: { name: string; arguments: string } };
export type RespostaModelo = { content: string | null; tool_calls?: ChamadaTool[]; usage?: { prompt_tokens: number; completion_tokens: number } };
export type ChamarModelo = (msgs: MsgModelo[]) => Promise<RespostaModelo>;

export type TurnoOcta = {
  historico: { role: "user" | "assistant"; content: string }[];
  pedido: string;
  workspace: Workspace;
  modo: "review" | "change";
  /** o que a tarefa pode editar (globs). Vazio em change = nada. */
  liberados: string[];
  arquivoAtivo?: string;
  /** "landing" = montar/publicar a landing do aluno: libera as tools do fluxo e sobe o teto de passos. */
  fluxo?: "landing";
  /** Teto de passos do laço (default MAX_PASSOS; no fluxo landing, MAX_PASSOS_LANDING). */
  maxPassos?: number;
};

/** O laço parou pedindo o aluno: retome com `retomar: { msgs, aprovado }`. */
export type PendenteOcta = { tool: string; args: unknown; toolCallId: string };

export type ResultadoOcta = {
  resposta: string;
  edicoes: Record<string, string>;
  apagados: string[];
  negados: { tool: string; motivo: string }[];
  sinais: ShitFlag[];
  passos: number;
  custo: ReturnType<typeof custoDoRun>;
  trace: Trace;
  pendente?: PendenteOcta;
  /** Estado da conversa com o modelo (pra retomar depois de uma aprovação). Saídas de tool já vêm redigidas. */
  msgs: MsgModelo[];
};

/** Um passo do laço, pra tela acompanhar ao vivo. `fim`/`erro` são do job (lib/queue/octa), não do laço. */
export type TipoEventoOcta = "pensando" | "tool" | "arquivo" | "resultado" | "aprovacao" | "fim" | "erro";
export type EventoOcta = { tipo: TipoEventoOcta; dados: Record<string, unknown> };

export type OpcoesOcta = {
  sessionId: string;
  userId?: string;
  /** Nível do projeto. Ausente fora do fluxo landing = comportamento antigo (apagar é negado sem aprovador). */
  permissao?: PermissaoOcta;
  /** Continua um turno que parou em `pendente`. `msgs` = o `msgs` daquele resultado. */
  retomar?: { msgs: MsgModelo[]; aprovado: boolean };
  /** Só no fluxo landing: quem publica de fato (lib/octa/publicar, fechado pela rota). */
  octaPublicar?: PublicarOcta;
  /** Chamado a cada passo (modelo pensando, tool chamada/resultado, arquivo gravado/apagado, aprovação pedida). */
  onEvento?: (e: EventoOcta) => Promise<void>;
};

export const MAX_PASSOS = 8;
export const MAX_PASSOS_LANDING = 24;

function sistema(t: TurnoOcta): string {
  return [
    "Você é o Octa Code, o agente de código da Zaeon, operando a IDE do aluno. Responda em português, direto.",
    t.modo === "review"
      ? "MODO REVISÃO: você só LÊ. Aponte o problema com arquivo:linha e o trecho exato; proponha a correção em texto. Não tente escrever."
      : `MODO ALTERAÇÃO: você só pode escrever em: ${[...t.liberados, PASTA_ARTE].join(", ")}. Fora disso a escrita é negada. Leia antes de escrever; grave o arquivo COMPLETO com octa_escrever.`,
    "Pedido de arte/ilustração generativa → use octa_arte (determinística: mesma seed, mesma peça).",
    t.fluxo === "landing" ? [
      "FLUXO LANDING: você monta a landing page ESTÁTICA do aluno (HTML + CSS, sem build, sem CDN).",
      "1) Escolha o estilo com octa_design_escolher e diga ao aluno qual estilo escolheu (nome) e por quê.",
      "2) Leia DESIGN.md com octa_ler antes de editar qualquer arquivo; siga cores, fontes e espaçamento dele.",
      "3) Monte com octa_pagina_montar (secoes em JSON); ajustes finos com octa_escrever. 4) Publique com octa_publicar quando o aluno pedir.",
      "Nunca use o nome, o logo nem textos da marca de origem do estilo na página: o DESIGN.md é só referência visual.",
      "Imagens: só de licença aberta (com a fonte) ou SVG próprio gerado com octa_arte.",
    ].join("\n") : "",
    `Antes de qualquer coisa extra, pergunte-se: ${PERGUNTAS_ANTES_DE_AGIR.join(" ")} Se não, não faça.`,
    REGRA_DADOS_NAO_COMANDOS,
    "Nunca peça nem repita senha, token ou chave.",
    t.arquivoAtivo ? `O aluno está com ${t.arquivoAtivo} aberto.` : "",
    "No fim, diga em 1–3 linhas o que fez e em quais arquivos.",
  ].filter(Boolean).join("\n");
}

/** Onde cada tool escreve: o laço põe em `args.path`/`args.paths` antes do guard (que confere o file-lock). */
function comAlvos(nome: string, args: unknown, w: Workspace): unknown {
  if (!args || typeof args !== "object") return args;
  const a = { ...(args as Record<string, unknown>) };
  if (nome === "octa_arte") a.path = caminhoDaArte(String(a.seed ?? ""));
  else if (nome === "octa_design_escolher") { a.path = "DESIGN.md"; delete a.paths; }
  else if (nome === "octa_pagina_montar") { delete a.path; a.paths = ["index.html", "styles.css", ...("DESIGN.md" in w ? [] : ["DESIGN.md"])]; }
  // publicar manda o projeto inteiro pro repositório público: a tarefa tem que poder escrever em tudo
  else if (nome === "octa_publicar") { delete a.path; a.paths = Object.keys(w).length ? Object.keys(w) : ["index.html"]; }
  return a;
}

const RE_SINAL_INJECAO = /alerta="possível prompt-injection/;

/** Caminho que a tool diz tocar (só pro evento; o guard já validou o de verdade). */
const caminhoDoEvento = (alvo: unknown): { path?: string } => {
  const p = alvo && typeof alvo === "object" ? (alvo as Record<string, unknown>).path : undefined;
  const n = typeof p === "string" ? normalizePath(p) : null;
  return n ? { path: n } : {};
};

export async function rodarAgenteOcta(t: TurnoOcta, chamar: ChamarModelo, opts: OpcoesOcta): Promise<ResultadoOcta> {
  const landing = t.fluxo === "landing";
  const maxPassos = t.maxPassos ?? (landing ? MAX_PASSOS_LANDING : MAX_PASSOS);
  const permissao = opts.permissao ?? (landing ? "auto" : undefined);
  const antes: Workspace = { ...t.workspace };
  const vivo: Workspace = { ...t.workspace };
  const task: OctaTask = { id: opts.sessionId, mode: t.modo, fileLock: t.modo === "change" ? [...t.liberados, PASTA_ARTE] : [] };
  const ctx = { plan: "free", execMode: "auto", userId: opts.userId, octaWs: vivo, octaPedido: t.pedido, octaPublicar: landing ? opts.octaPublicar : undefined } as CtxOcta;
  // Aprovação de runtime (destrutivo / pós-injeção): só a chamada que o aluno aprovou agora, ou o que o nível dispensa.
  let aprovadaAgora = false;
  const s = novaSessao({
    sessionId: opts.sessionId, task, ctx,
    approve: permissao ? async (def) => aprovadaAgora || (s.state.sinaisInjecao === 0 && !precisaAprovacao(permissao, def.name)) : undefined,
  });
  const negados: ResultadoOcta["negados"] = [];
  const msgs: MsgModelo[] = opts.retomar
    ? [...opts.retomar.msgs]
    : [{ role: "system", content: sistema(t) }, ...t.historico.slice(-12), { role: "user", content: t.pedido }];
  // retomado: o sinal de injeção do trecho anterior continua valendo
  if (opts.retomar) s.state.sinaisInjecao = msgs.filter((m) => m.role === "tool" && RE_SINAL_INJECAO.test(m.content)).length;
  s.tracer.registrar("prompt", { pedido: t.pedido, modo: t.modo, liberados: t.liberados, fluxo: t.fluxo, retomado: !!opts.retomar });

  const emitir = async (tipo: TipoEventoOcta, dados: Record<string, unknown>) => { if (opts.onEvento) await opts.onEvento({ tipo, dados }); };
  let pendente: PendenteOcta | undefined;
  const responder = (c: ChamadaTool, content: string) => msgs.push({ role: "tool", tool_call_id: c.id, content });

  /** Roda uma chamada de tool. `false` = parou pedindo o aluno (fica em `pendente`). */
  const processar = async (c: ChamadaTool, aprovada = false): Promise<boolean> => {
    const nome = c.function.name;
    let args: unknown = {};
    try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* args inválidos → a ferramenta recusa */ }
    if (!landing && NOMES_LANDING.has(nome)) {
      negados.push({ tool: nome, motivo: "tool_fora_do_fluxo" });
      responder(c, `NEGADO (tool_fora_do_fluxo): ${nome} não está disponível neste turno.`);
      await emitir("resultado", { tool: nome, ok: false, codigo: "tool_fora_do_fluxo" });
      return true;
    }
    const alvo = comAlvos(nome, args, vivo);
    const def = getTool(nome);
    if (permissao && !aprovada && def) {
      const pede = precisaAprovacao(permissao, nome) || (def.risk !== "read" && s.state.sinaisInjecao > 0);
      // o que o guard vai negar de qualquer jeito não incomoda o aluno
      if (pede && octaPermit(def, alvo, s.ctx, task, s.state).gate !== "DENY") {
        pendente = { tool: nome, args, toolCallId: c.id };
        s.tracer.registrar("guard", { tool: nome, gate: "REQUIRE_APPROVAL", reason: "permissao_do_projeto", detail: permissao });
        await emitir("aprovacao", { tool: nome, ...caminhoDoEvento(alvo) });
        return false;
      }
    }
    aprovadaAgora = aprovada;
    await emitir("tool", { tool: nome, ...caminhoDoEvento(alvo) });
    const escreve = !!def && def.risk !== "read";
    const antesDaTool: Workspace = escreve ? { ...vivo } : vivo;
    let res: Awaited<ReturnType<typeof runOctaTool>>;
    try {
      res = await runOctaTool(nome, alvo, s);
      if (!res.ok) negados.push({ tool: nome, motivo: res.code ?? res.error ?? "negado" });
      responder(c, res.paraModelo);
    } finally { aprovadaAgora = false; }
    // resumo só de tool que escreve (a de leitura traria conteúdo de arquivo); falha = só o código fixo
    const resumo = escreve ? String(res.findings?.[0]?.claim ?? "").slice(0, 300) : "";
    await emitir("resultado", res.ok ? { tool: nome, ok: true, ...(resumo ? { resumo } : {}) } : { tool: nome, ok: false, codigo: res.code ?? "negado" });
    if (escreve) {
      for (const [p, conteudo] of Object.entries(vivo)) if (antesDaTool[p] !== conteudo) await emitir("arquivo", { path: p, acao: "gravado" });
      for (const p of Object.keys(antesDaTool)) if (!(p in vivo)) await emitir("arquivo", { path: p, acao: "apagado" });
    }
    return true;
  };

  /** Roda as chamadas ainda sem resposta da última mensagem do assistente (retomada). */
  const pendentesDaUltima = (): ChamadaTool[] => {
    const i = msgs.map((m) => m.role).lastIndexOf("assistant");
    const ult = msgs[i];
    if (i < 0 || ult.role !== "assistant" || !ult.tool_calls?.length) return [];
    const respondidas = new Set(msgs.slice(i + 1).flatMap((m) => (m.role === "tool" ? [m.tool_call_id] : [])));
    return ult.tool_calls.filter((c) => !respondidas.has(c.id));
  };

  let resposta = "";
  let passos = 0;
  if (opts.retomar) {
    const [primeira, ...resto] = pendentesDaUltima();
    if (primeira) {
      if (opts.retomar.aprovado) await processar(primeira, true);
      else {
        negados.push({ tool: primeira.function.name, motivo: "recusado_pelo_aluno" });
        responder(primeira, `NEGADO (recusado_pelo_aluno): o aluno recusou ${primeira.function.name}. Não tente de novo neste turno; pergunte o que ele prefere.`);
        await emitir("resultado", { tool: primeira.function.name, ok: false, codigo: "recusado_pelo_aluno" });
      }
      for (const c of resto) if (!(await processar(c))) break;
    }
  }
  if (!pendente) {
    for (; passos < maxPassos; passos++) {
      await emitir("pensando", { passo: passos + 1 });
      const r = await chamar(msgs);
      s.tracer.registrar("modelo", { texto: (r.content ?? "").slice(0, 2000), tools: r.tool_calls?.map((c) => c.function.name) },
        r.usage ? { tokens: { entrada: r.usage.prompt_tokens, saida: r.usage.completion_tokens } } : {});
      if (!r.tool_calls?.length) { resposta = r.content ?? ""; break; }
      msgs.push({ role: "assistant", content: r.content ?? null, tool_calls: r.tool_calls });
      for (const c of r.tool_calls) if (!(await processar(c))) break;
      if (pendente) break;
    }
  }
  if (pendente) resposta = `Preciso da sua aprovação para ${pendente.tool} antes de continuar.`;
  else if (!resposta) resposta = passos >= maxPassos ? "Parei no limite de passos deste turno. Diga se devo continuar." : "(sem resposta)";

  const edicoes: Record<string, string> = {};
  for (const [p, c] of Object.entries(vivo)) if (antes[p] !== c) edicoes[p] = c;
  const apagados = Object.keys(antes).filter((p) => !(p in vivo));
  const trace = s.tracer.encerrar();
  return {
    resposta, edicoes, apagados, negados, sinais: detectShit(task, s.log, { requestedPaths: t.arquivoAtivo ? [t.arquivoAtivo] : [] }),
    passos: passos + 1, custo: custoDoRun(trace), trace, pendente, msgs,
  };
}
