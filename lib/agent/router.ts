/**
 * lib/agent/router.ts — PR02 do runbook (§13.1). O CLASSIFICADOR barato na entrada
 * do laço: objetivo → { intent, mode, academicMode, kind? }. §11.2 do plano.
 *
 * Estratégia: 1 chamada Gemini Flash com JSON forçado (geminiJson) + FALLBACK
 * heurístico 100% local (sem rede) que também é o resultado se o modelo falhar.
 * O router NUNCA lança — sempre devolve uma classificação usável. Server-side.
 */
import {
  INTENTS, isIntentId, academicModeForSurface,
  type IntentId, type Mode, type AcademicMode, type WorkKind,
} from "@/lib/agent/contracts";
import { geminiJson } from "@/lib/scholar/gemini";

export type ClassifyCtx = { surface?: string | null };
export type Classification = { intent: IntentId; mode: Mode; academicMode: AcademicMode; kind?: WorkKind };

// ── Heurística local (barata, determinística, testável sem rede) ──────────────
const WORK_KINDS: WorkKind[] = ["estudo", "pesquisa", "artigo", "tcc", "relatorio", "aula"];
// verbos que denotam GERAR/CRIAR algo (não é conversa nem dúvida)
const GEN_VERB = /\b(ger[ae]|cri[ae]|fa[çz]|monta|elabora|escrev[ae]|redi[jg]|produz|desenvolv)\w*\b/i;
const ARTIFACT_WORD = /\b(podcast|v[íi]deo|mapa|flashcards?|linha do tempo|timeline|guia|faq|imagem|figura)\b/i;
const WORK_WORD = /\b(tcc|artigo|relat[óo]rio|monografia|paper|disserta|reda[çc][ãa]o|aula|resenha|pesquisa)\b/i;
const ASK_WORD = /\b(o que|oque|qual|quais|quem|quando|onde|por que|porqu[êe]|como|significa)\b/i;
// verbos de EXPLICAÇÃO (pedem desenvolvimento, não resposta seca) → explicar_conceito
const EXPLAIN_VERB = /\b(explica|explique|explicar|detalh\w*|defin\w*|aprofund\w*|ensina|discorre)\b/i;
const REVISE_WORD = /\b(revis[ae]|corrig|argu[ie]|critica|avalia|melhora este|revise|feedback)\b/i;

/** Detecta o WorkKind pedido (p/ criar_trabalho). Default "estudo" na sala de estudos, "pesquisa" na pesquisa. */
export function detectWorkKind(text: string, surface?: string | null): WorkKind {
  const t = (text || "").toLowerCase();
  if (/\btcc\b|monografia/.test(t)) return "tcc";
  if (/relat[óo]rio/.test(t)) return "relatorio";
  if (/\bartigo\b|\bpaper\b/.test(t)) return "artigo";
  if (/\baula\b/.test(t)) return "aula";
  if (/pesquisa|literatura|revis[ãa]o de literatura/.test(t)) return "pesquisa";
  return surface === "pesquisa" ? "pesquisa" : "estudo";
}

export function isQuickPrompt(text: string): boolean {
  return (text || "").trim().split(/\s+/).filter(Boolean).length <= 8;
}

/** Fallback puro: nunca chama rede. Também é a rede-de-segurança do classify(). */
export function heuristicClassify(objective: string, ctx: ClassifyCtx = {}): Classification {
  const t = (objective || "").trim();
  const academicMode = academicModeForSurface(ctx.surface);
  let intent: IntentId;
  let kind: WorkKind | undefined;

  if (REVISE_WORD.test(t)) {
    intent = "revisar";
  } else if (GEN_VERB.test(t) && ARTIFACT_WORD.test(t)) {
    intent = "gerar_artefato";
  } else if (GEN_VERB.test(t) && WORK_WORD.test(t)) {
    intent = "criar_trabalho";
    kind = detectWorkKind(t, ctx.surface);
  } else if (/\bfontes?\b|refer[êe]ncias?|bibliografia|cite/.test(t.toLowerCase())) {
    intent = "pesquisar_fontes";
  } else if (EXPLAIN_VERB.test(t)) {
    intent = "explicar_conceito";
  } else if (isQuickPrompt(t) && !ASK_WORD.test(t)) {
    intent = "conversa";
  } else if (isQuickPrompt(t)) {
    intent = "duvida_rapida";
  } else {
    intent = "explicar_conceito";
  }
  return { intent, mode: INTENTS[intent].mode, academicMode, kind };
}

// ── Classificador com LLM (JSON forçado) + fallback ───────────────────────────
const SYS =
  "Você classifica a intenção do usuário numa plataforma educacional. Responda SÓ JSON " +
  '{"intent": <um de: conversa|duvida_rapida|explicar_conceito|gerar_artefato|criar_trabalho|pesquisar_fontes|revisar>, ' +
  '"kind": <se intent=criar_trabalho: estudo|pesquisa|artigo|tcc|relatorio|aula, senão null>}. ' +
  "Regras: conversa=papo/saudação; duvida_rapida=pergunta curta; explicar_conceito=explicação; " +
  "gerar_artefato=pediu artefato do Studio (mapa/flashcards/podcast/vídeo/imagem/guia/faq/timeline); " +
  "criar_trabalho=pediu redigir um trabalho (estudo/pesquisa/artigo/tcc/relatório/aula); " +
  "pesquisar_fontes=pediu referências/literatura; revisar=pediu revisar/arguir material dele.";

/**
 * classify — 1 chamada Flash (JSON) com timeout curto; qualquer falha/inválido cai
 * na heurística. Nunca lança. `mode`/`academicMode` são sempre derivados dos contratos.
 */
export async function classify(objective: string, ctx: ClassifyCtx = {}): Promise<Classification> {
  const academicMode = academicModeForSurface(ctx.surface);
  try {
    const out = await geminiJson<{ intent?: string; kind?: string | null }>(
      SYS, `Superfície: ${ctx.surface ?? "estudos"}\nMensagem: ${objective}`,
      { temperature: 0, timeoutMs: 8000 },
    );
    if (out && isIntentId(out.intent)) {
      const intent = out.intent;
      const kind = intent === "criar_trabalho"
        ? ((WORK_KINDS.includes(out.kind as WorkKind) ? out.kind : detectWorkKind(objective, ctx.surface)) as WorkKind)
        : undefined;
      return { intent, mode: INTENTS[intent].mode, academicMode, kind };
    }
  } catch { /* cai na heurística */ }
  return heuristicClassify(objective, ctx);
}
