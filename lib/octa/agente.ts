/**
 * lib/octa/agente.ts — o AGENTE do Octa Code: um laço planeja → lê → edita → responde sobre o workspace do aluno.
 *
 * Toda chamada de ferramenta passa por `runOctaTool` (lib/octa/runner): guard da tarefa (modo review/change +
 * file-lock + teto de subagentes), conteúdo de arquivo vira DADO cercado (anti prompt-injection), trace com custo,
 * e o log SHIT pro juiz. O modelo é o REAL do app via gateway (lib/octa/litellm.modeloReal) — injetável no teste.
 * O workspace vive em memória durante o turno; o que mudou volta pro cliente como `edicoes`.
 */
import { registerTool, err, type ToolDef, type ToolContext } from "@/lib/agent/runtime";
import { novaSessao, runOctaTool } from "@/lib/octa/runner";
import { normalizePath, type OctaTask } from "@/lib/octa/guard";
import { detectShit, PERGUNTAS_ANTES_DE_AGIR, type ShitFlag } from "@/lib/octa/shit";
import { REGRA_DADOS_NAO_COMANDOS } from "@/lib/octa/untrusted";
import { custoDoRun, type Trace } from "@/lib/octa/trace";
import { gerarPeca, verificarDeterminismo } from "@/lib/octa/genart";

export type Workspace = Record<string, string>;
type CtxOcta = ToolContext & { octaWs?: Workspace };

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

/** Formato de ferramenta do gateway (OpenAI-compatível). */
export const FERRAMENTAS_GATEWAY = FERRAMENTAS.map((t) => ({
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
}));

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
};

export type ResultadoOcta = {
  resposta: string;
  edicoes: Record<string, string>;
  apagados: string[];
  negados: { tool: string; motivo: string }[];
  sinais: ShitFlag[];
  passos: number;
  custo: ReturnType<typeof custoDoRun>;
  trace: Trace;
};

export const MAX_PASSOS = 8;

function sistema(t: TurnoOcta): string {
  return [
    "Você é o Octa Code, o agente de código da Zaeon, operando a IDE do aluno. Responda em português, direto.",
    t.modo === "review"
      ? "MODO REVISÃO: você só LÊ. Aponte o problema com arquivo:linha e o trecho exato; proponha a correção em texto. Não tente escrever."
      : `MODO ALTERAÇÃO: você só pode escrever em: ${[...t.liberados, PASTA_ARTE].join(", ")}. Fora disso a escrita é negada. Leia antes de escrever; grave o arquivo COMPLETO com octa_escrever.`,
    "Pedido de arte/ilustração generativa → use octa_arte (determinística: mesma seed, mesma peça).",
    `Antes de qualquer coisa extra, pergunte-se: ${PERGUNTAS_ANTES_DE_AGIR.join(" ")} Se não, não faça.`,
    REGRA_DADOS_NAO_COMANDOS,
    "Nunca peça nem repita senha, token ou chave.",
    t.arquivoAtivo ? `O aluno está com ${t.arquivoAtivo} aberto.` : "",
    "No fim, diga em 1–3 linhas o que fez e em quais arquivos.",
  ].filter(Boolean).join("\n");
}

export async function rodarAgenteOcta(t: TurnoOcta, chamar: ChamarModelo, opts: { sessionId: string; userId?: string }): Promise<ResultadoOcta> {
  const antes: Workspace = { ...t.workspace };
  const vivo: Workspace = { ...t.workspace };
  const task: OctaTask = { id: opts.sessionId, mode: t.modo, fileLock: t.modo === "change" ? [...t.liberados, PASTA_ARTE] : [] };
  const s = novaSessao({ sessionId: opts.sessionId, task, ctx: { plan: "free", execMode: "auto", userId: opts.userId, octaWs: vivo } as CtxOcta });
  const negados: ResultadoOcta["negados"] = [];
  const msgs: MsgModelo[] = [
    { role: "system", content: sistema(t) },
    ...t.historico.slice(-12),
    { role: "user", content: t.pedido },
  ];
  s.tracer.registrar("prompt", { pedido: t.pedido, modo: t.modo, liberados: t.liberados });

  let resposta = "";
  let passos = 0;
  for (; passos < MAX_PASSOS; passos++) {
    const r = await chamar(msgs);
    s.tracer.registrar("modelo", { texto: (r.content ?? "").slice(0, 2000), tools: r.tool_calls?.map((c) => c.function.name) },
      r.usage ? { tokens: { entrada: r.usage.prompt_tokens, saida: r.usage.completion_tokens } } : {});
    if (!r.tool_calls?.length) { resposta = r.content ?? ""; break; }
    msgs.push({ role: "assistant", content: r.content ?? null, tool_calls: r.tool_calls });
    for (const c of r.tool_calls) {
      let args: unknown = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch { /* args inválidos → a ferramenta recusa */ }
      if (c.function.name === "octa_arte" && args && typeof args === "object") (args as any).path = caminhoDaArte(String((args as any).seed ?? ""));
      const res = await runOctaTool(c.function.name, args, s);
      if (!res.ok) negados.push({ tool: c.function.name, motivo: res.code ?? res.error ?? "negado" });
      msgs.push({ role: "tool", tool_call_id: c.id, content: res.paraModelo });
    }
  }
  if (!resposta) resposta = passos >= MAX_PASSOS ? "Parei no limite de passos deste turno. Diga se devo continuar." : "(sem resposta)";

  const edicoes: Record<string, string> = {};
  for (const [p, c] of Object.entries(vivo)) if (antes[p] !== c) edicoes[p] = c;
  const apagados = Object.keys(antes).filter((p) => !(p in vivo));
  const trace = s.tracer.encerrar();
  return { resposta, edicoes, apagados, negados, sinais: detectShit(task, s.log, { requestedPaths: t.arquivoAtivo ? [t.arquivoAtivo] : [] }), passos: passos + 1, custo: custoDoRun(trace), trace };
}
