/**
 * lib/agent/aura-harness.ts — o ADAPTADOR `HarnessDeps` (executor PASSO 1).
 *
 * Liga o motor puro (`runTrajectory`) ao mundo real: router (classify), runtime (runTool),
 * examiner (critique) e Gemini (plan/reason/draft). `plan`/`reason`/`draft` são as ÚNICAS
 * chamadas de geração. Aditivos de pesquisa embutidos:
 *   A1 · erro-como-observação: falha de tool volta ao contexto do próximo reason/draft.
 *   A2 · retry numa camada só: 1 retry (backoff) para tool_timeout/network/rate_limited — NUNCA
 *        para tool_denied/needs_approval/validação. Vive SÓ aqui (adaptador).
 *   A5 · evidence-gate no draft de criar_trabalho (baseia-se na evidência; sinaliza se falta).
 *   A6 · perspectivas/sub-perguntas no plan de criar_trabalho (mode research).
 * As chamadas de modelo são INJETÁVEIS (`opts.genJson`) → o adaptador é testável SEM rede.
 * Gemini é a IA única (§ guardrail). Flash por padrão; Pro só quando `deepThink` e fase pesada.
 */
import { GEMINI_MODEL_FLASH, GEMINI_MODEL_PRO } from "@/lib/ai/model";
import { classify } from "@/lib/agent/router";
import { STUDIO_KINDS } from "@/lib/agent/tools";
import { runToolByName, type ToolContext, type ApproveFn } from "@/lib/agent/runtime";
import { critiqueForState } from "@/lib/agent/examiner";
import { nullMemory } from "@/lib/agent/memory";
import { messageForError, classifyError } from "@/lib/agent/errors";
import type { AgentStep } from "@/lib/agent/actions";
import type { HarnessDeps, TrajectoryState, Step } from "@/lib/agent/trajectory";
import { normalizeStudioKind } from "@/lib/agent/tools";
import type { StructuredAnswer, Source } from "@/lib/agent/contracts";

type GenJson = <T>(system: string, user: string, opts?: { temperature?: number; model?: string; timeoutMs?: number }) => Promise<T>;

export type HarnessOpts = {
  deepThink?: boolean;
  approve?: ApproveFn;
  onStep?: (step: AgentStep) => void;
  retryDelayMs?: number;
  history?: { role: string; text: string }[]; // continuidade entre turnos (paridade com o legado)
  systemContext?: string;                      // contexto injetado (PDF/estudo em foco, admin…)
  genJson?: GenJson;            // injeção p/ teste (default = Gemini real, import tardio)
  runToolImpl?: typeof runToolByName; // injeção p/ teste
};

type Observation = { tool: string; code?: string; error?: string };

// ───────────────────────────── A2 · retry só nesta camada ─────────────────────────────
const RETRYABLE = new Set(["tool_timeout", "network", "rate_limited"]);
export const isRetryableCode = (code?: string): boolean => !!code && RETRYABLE.has(code);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ───────────────────────────── Gemini (import tardio) ─────────────────────────────
const defaultGenJson: GenJson = async (system, user, opts) => {
  const { geminiJson } = await import("@/lib/scholar/gemini");
  return geminiJson(system, user, opts);
};

// ───────────────────────────── helpers de prompt ─────────────────────────────
/** infere o kind do Studio a partir do pedido (gerar_artefato). */
export function pickStudioKind(objective: string): string {
  const t = (objective || "").toLowerCase();
  if (/mapa mental|mindmap/.test(t)) return "mindmap";
  if (/flashcard|cart[õo]es/.test(t)) return "flashcards";
  if (/linha do tempo|timeline|cronologia/.test(t)) return "timeline";
  if (/podcast|áudio|audio/.test(t)) return "podcast";
  if (/v[íi]deo/.test(t)) return "video";
  if (/\bfaq\b|perguntas e respostas/.test(t)) return "faq";
  // Molécula ANTES de imagem: esta linha já capturava "molécula" e devolvia "image",
  // de quando o viewer 3D não existia. Agora existe (PubChem + 3Dmol), e uma estrutura
  // química desenhada por modelo de imagem é bonita e errada.
  if (/mol[eé]cula|estrutura (molecular|qu[ií]mica)|f[oó]rmula estrutural/.test(t)) return "molecule";
  if (/imagem|figura|ilustra|diagrama|esquema|desenh|gr[aá]fico|f[oó]rmula/.test(t)) return "image";
  return normalizeStudioKind(t); // default "guide"
}

const isGatherTool = (t: string) => t === "memory_search" || t === "literature_search";

function evidenceBlock(st: TrajectoryState): string {
  if (!st.evidence.length) return "(nenhuma evidência reunida)";
  return st.evidence
    .slice(0, 12)
    .map((f, i) => `(${i + 1}) ${f.claim}${f.source ? ` — ${f.source.title}${f.source.url ? ` <${f.source.url}>` : ""}` : ""}`)
    .join("\n");
}

function obsBlock(obs: Observation[]): string {
  if (!obs.length) return "";
  return `\n\nFerramentas que FALHARAM (contorne — NÃO invente o que elas dariam):\n${obs
    .map((o) => `- ${o.tool}: ${o.code ?? o.error ?? "erro"}`)
    .join("\n")}`;
}

/** Bloco de contexto (systemContext + histórico recente) — dá paridade com o caminho legado. */
function preambleBlock(opts: HarnessOpts): string {
  const bits: string[] = [];
  if (opts.systemContext) bits.push(`Contexto do sistema:\n${String(opts.systemContext).slice(0, 4000)}`);
  if (opts.history?.length) {
    const recent = opts.history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Usuário" : "Aura"}: ${String(h.text ?? "").slice(0, 500)}`)
      .join("\n");
    if (recent) bits.push(`Conversa recente:\n${recent}`);
  }
  return bits.length ? bits.join("\n\n") + "\n\n" : "";
}

function asArray(v: unknown): any[] { return Array.isArray(v) ? v : v == null ? [] : [v]; }

/** garante o contrato mínimo do StructuredAnswer (nunca deixa o cliente sem `nucleo`). */
export function normalizeAnswer(out: Partial<StructuredAnswer> | null | undefined, st: TrajectoryState): StructuredAnswer {
  const o = out ?? {};
  const answer: StructuredAnswer = {
    nucleo: typeof o.nucleo === "string" && o.nucleo.trim() ? o.nucleo.trim() : (st.objective ? "" : ""),
  };
  if (typeof o.desenvolvimento === "string") answer.desenvolvimento = o.desenvolvimento;
  if (o.conceitos) answer.conceitos = asArray(o.conceitos).map(String).filter(Boolean);
  if (o.proximos_passos) answer.proximos_passos = asArray(o.proximos_passos).map(String).filter(Boolean);
  if (o.evidencia) answer.evidencia = asArray(o.evidencia).filter((e) => e && e.claim && e.source);
  if (o.sources) answer.sources = asArray(o.sources).filter((s: Source) => s && s.title);
  if (o.work && typeof o.work === "object") answer.work = o.work;
  // `artifacts` vinha sendo DESCARTADO aqui — por isso artefato citado no meio de uma
  // explicação nunca nascia: nem o prompt pedia, nem a normalização deixava passar.
  // Teto de 2 pra resposta não virar galeria, e só kinds que o Studio sabe montar.
  if (o.artifacts) {
    const refs = asArray(o.artifacts)
      .filter((a: any) => a && typeof a.studioKind === "string" && STUDIO_KINDS.includes(a.studioKind))
      .slice(0, 2)
      .map((a: any) => ({ studioKind: String(a.studioKind), title: a.title ? String(a.title) : undefined }));
    if (refs.length) answer.artifacts = refs as StructuredAnswer["artifacts"];
  }
  if (!answer.nucleo) answer.nucleo = "Não consegui elaborar uma resposta completa agora.";
  return answer;
}

// ───────────────────────────── o adaptador ─────────────────────────────
export function buildHarnessDeps(ctx: ToolContext, opts: HarnessOpts = {}): HarnessDeps {
  const genJson = opts.genJson ?? defaultGenJson;
  const runTool = opts.runToolImpl ?? runToolByName;
  const retryDelay = opts.retryDelayMs ?? 400;
  const modelFor = (heavy: boolean) => (opts.deepThink && heavy ? GEMINI_MODEL_PRO : GEMINI_MODEL_FLASH);
  const observations: Observation[] = []; // A1 · buffer de erros-como-observação
  const preamble = preambleBlock(opts); // systemContext + histórico (paridade com o legado)

  return {
    classify: (objective, c) => classify(objective, c),

    async plan(st) {
      const gather = st.spec.tools.filter(isGatherTool);
      if (st.intent === "gerar_artefato") {
        return [{ tool: "studio_generate", args: { kind: pickStudioKind(st.objective), topic: st.objective } }];
      }
      if (st.intent === "criar_trabalho" && st.mode === "research") {
        // A6 · 2–3 perspectivas/sub-perguntas antes de fechar os steps.
        let subs: string[] = [st.objective];
        try {
          const r = await genJson<{ subquestions?: string[] }>(
            "Você planeja a pesquisa. Gere 2 a 3 SUB-PERGUNTAS/perspectivas distintas que cubram o tema com abrangência. Responda JSON {\"subquestions\":[\"...\"]}.",
            `Tema: ${st.objective}`,
            { temperature: 0.3, model: modelFor(true), timeoutMs: 15_000 },
          );
          if (Array.isArray(r?.subquestions) && r.subquestions.length) subs = r.subquestions.slice(0, 3);
        } catch { /* fallback: só o objetivo */ }
        const steps: Step[] = [];
        for (const t of gather) for (const q of subs) steps.push({ tool: t, args: { query: q } });
        return steps.length ? steps : [{ tool: gather[0] ?? "memory_search", args: { query: st.objective } }];
      }
      return gather.map((t) => ({ tool: t, args: { query: st.objective } }));
    },

    async runTool(name, args, c) {
      // A2 · 1 retry (backoff) SÓ para timeout/network/rate — nunca p/ deny/approval/validação.
      let res = await runTool(name, args, c as ToolContext, { approve: opts.approve });
      if (!res.ok && isRetryableCode(res.code)) {
        await sleep(retryDelay);
        res = await runTool(name, args, c as ToolContext, { approve: opts.approve });
      }
      if (!res.ok) observations.push({ tool: name, code: res.code, error: res.error }); // A1
      return res;
    },

    async reason(st) {
      const sys = "Você é a Aura raciocinando ANTES de redigir. Conecte a evidência ao objetivo em 2–4 frases. Se faltou evidência, seja honesto — NUNCA invente fontes. Responda JSON {\"reasoning\":\"...\"}.";
      const user = `${preamble}Objetivo: ${st.objective}\nModo: ${st.mode} · Acadêmico: ${st.academicMode}\nEvidência:\n${evidenceBlock(st)}${obsBlock(observations)}`;
      try {
        const r = await genJson<{ reasoning?: string }>(sys, user, { temperature: 0.3, model: modelFor(false), timeoutMs: 15_000 });
        return String(r?.reasoning ?? "").trim();
      } catch {
        return ""; // reasoning é auxiliar — nunca derruba o laço
      }
    },

    async draft(st) {
      const req = st.spec.required.join(", ");
      const academic = st.academicMode === "enforced"
        ? "MODO ACADÊMICO: use SÓ fontes acadêmicas reais reunidas; se não houver evidência suficiente, diga isso e não fabrique."
        : "ESCOPO FLEXÍVEL: conhecimento geral é ok; cite quando útil, sem exigir fonte acadêmica.";
      const a5 = st.intent === "criar_trabalho"
        ? "\nBaseie CADA afirmação de `work`/`evidencia` na evidência reunida; se a evidência for insuficiente, produza um rascunho enxuto e sinalize a limitação em `nucleo`."
        : "";
      const sys = [
        "Você é a Aura, parceira de estudo/pesquisa — calorosa, direta, PT-BR. Redija a resposta final.",
        "NUNCA diga que você é uma IA incapaz de gerar imagem/representação visual — você TEM o Studio (imagem/diagrama/molécula). Se o pedido for visual e nenhuma tool o cobriu, afirme que dá pra gerar e sugira em proximos_passos, jamais negue capacidade.",
        "Responda SOMENTE JSON válido.",
        `Campos obrigatórios: ${req}. Preencha TODOS. Schema: {nucleo, desenvolvimento?, conceitos?[], evidencia?[{claim,source:{title,url?}}], proximos_passos?[], sources?[{title,url?}], work?{kind,sections:[{title,body}]}, artifacts?[{studioKind,title}]}.`,
        // Artefato NASCE da explicação, não só de um pedido. Se a resposta gira em torno
        // de uma substância química, a estrutura dela entra junto — o aluno não devia ter
        // que pedir pra ver a molécula da cafeína numa resposta sobre cafeína.
        'Se a resposta for SOBRE uma substância química específica (ex.: cafeína, glicose, etanol), inclua artifacts: [{"studioKind":"molecule","title":"<nome da substância>"}]. ' +
        'O título deve ser SÓ o nome da substância, sem "molécula de". No máximo 1 molécula por resposta, e só quando a substância for o assunto — não cite de passagem. ' +
        'Não invente substância: se não tiver certeza de que existe, deixe artifacts de fora.',
        academic + a5,
      ].join("\n");
      const user = `${preamble}Objetivo: ${st.objective}\nRaciocínio: ${st.reasoning ?? ""}\nEvidência:\n${evidenceBlock(st)}${obsBlock(observations)}`;
      try {
        const out = await genJson<Partial<StructuredAnswer>>(sys, user, { temperature: 0.4, model: modelFor(true), timeoutMs: 30_000 });
        return normalizeAnswer(out, st);
      } catch (e: any) {
        // degradado: núcleo honesto via messageForError (nunca string à mão), laço segue.
        return { nucleo: messageForError(classifyError(String(e?.message ?? e))) };
      }
    },

    critique: (st) => Promise.resolve(critiqueForState(st)),

    emit(step) { opts.onStep?.(step); },

    async persistMemory(drawers) {
      try { await nullMemory.write(drawers); } catch { /* memória nunca derruba a resposta */ }
    },
  };
}

// ───────────────────────────── mapeamento p/ o protocolo do cliente ─────────────────────────────
export type HarnessOutput =
  | { mode: "text"; text: string }
  | { mode: "structured"; answer: StructuredAnswer }   // resposta rica (carrega artifacts[] inline)
  | { mode: "studio"; kind: string; topic: string; text: string }
  | { mode: "research"; kind: string; topic: string; text: string };

/** Serializa o StructuredAnswer em texto markdown (o caminho SEM sentinela). */
export function renderStructuredAnswer(a: StructuredAnswer): string {
  const parts: string[] = [];
  if (a.nucleo) parts.push(a.nucleo.trim());
  if (a.desenvolvimento) parts.push(a.desenvolvimento.trim());
  if (a.conceitos?.length) parts.push("**Conceitos-chave:** " + a.conceitos.join(" · "));
  if (a.evidencia?.length) {
    parts.push(a.evidencia.map((e) => `- ${e.claim}${e.source ? ` (${e.source.title})` : ""}`).join("\n"));
  }
  if (a.sources?.length) {
    parts.push("**Fontes:**\n" + a.sources.map((s) => `- ${s.title}${s.url ? ` — ${s.url}` : ""}`).join("\n"));
  }
  if (a.proximos_passos?.length) {
    parts.push("**Próximos passos:**\n" + a.proximos_passos.map((p) => `- ${p}`).join("\n"));
  }
  return parts.join("\n\n").trim() || "Sem resposta agora.";
}

/**
 * Decide a saída no MESMO protocolo do cliente (StudyCoworkChat/ResearchChat):
 *   research → sentinela (trabalho no documento) · studio → sentinela (artefato PURO)
 *   · structured → sentinela com o StructuredAnswer inteiro (texto + artifacts[] na mesma bolha).
 * `topic` cai no `prompt` do cliente se vier vazio (o cliente usa `topic || prompt`).
 * `renderStructuredAnswer` segue exportado: é o fallback texto (cliente antigo / AURA_HARNESS=0).
 */
export function resolveHarnessOutput(
  state: Pick<TrajectoryState, "intent" | "kind" | "artifacts">,
  answer: StructuredAnswer,
  surface: string | null | undefined,
  objective: string,
): HarnessOutput {
  const arts = answer.artifacts ?? state.artifacts ?? [];
  const studioArt = arts.find((a) => a.studioKind && !a.studioKind.startsWith("research:"));
  const lead = (answer.nucleo && answer.nucleo.trim()) || "Já te mostro aqui.";

  // Sala de Pesquisa: pedido de TRABALHO → sentinela research (o cliente gera no documento).
  if (state.intent === "criar_trabalho" && surface === "pesquisa") {
    return { mode: "research", kind: state.kind ?? "artigo", topic: objective, text: lead };
  }
  // ARTEFATO PURO ("gera um mapa"): gerar_artefato com studioArt → sentinela studio (inalterado).
  if (studioArt && state.intent === "gerar_artefato") {
    return { mode: "studio", kind: studioArt.studioKind, topic: objective, text: lead };
  }
  // Tudo mais (conversa, dúvida, explicação, fontes, revisão) → estruturado, carregando o
  // answer COMPLETO — se vier artifacts[] (ex.: image), o cliente embute na mesma bolha.
  return { mode: "structured", answer: arts.length && !answer.artifacts ? { ...answer, artifacts: arts } : answer };
}
