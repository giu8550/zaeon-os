/**
 * lib/agent/examiner.ts — PR05 do runbook (§13.2) · §8.4 do plano.
 * O CRÍTICO (ScholarEval): recebe o draft + evidências e devolve um ExaminerVerdict.
 * Duas camadas: (1) checagem BARATA e determinística `sem_fonte` (cruza draft × evidência,
 * sem LLM); (2) avaliação ScholarEval via geminiJson (adaptativa por intenção). Nunca lança —
 * qualquer falha do LLM cai num veredito conservador derivado só da camada barata.
 */
import { geminiJson } from "@/lib/scholar/gemini";
import { GEMINI_MODEL_FLASH, GEMINI_MODEL_PRO } from "@/lib/ai/model";
import {
  INTENTS,
  type IntentId, type StructuredAnswer, type ExaminerVerdict, type Issue,
  type ExaminerRubric, type ScholarDim, type EvidenceLevel,
} from "@/lib/agent/contracts";

export type CritiqueInput = {
  objective: string;
  intent: IntentId;
  academicMode: "enforced" | "flexible";
  draft: StructuredAnswer;
};

// Dims do ScholarEval por intenção (adaptativo): leve usa um subconjunto; pesado usa tudo.
const DIMS_BY_INTENT: Partial<Record<IntentId, ScholarDim[]>> = {
  explicar_conceito: ["problema", "escrita", "literatura"],
  gerar_artefato: ["problema", "escrita"],
  pesquisar_fontes: ["literatura", "dados_fontes", "citacoes"],
  criar_trabalho: ["problema", "literatura", "metodologia", "dados_fontes", "analise", "resultados", "escrita", "citacoes"],
  revisar: ["problema", "literatura", "metodologia", "analise", "resultados", "escrita", "citacoes"],
};

/** Camada barata: afirmações que exigem lastro mas o draft não tem evidência com fonte. */
export function checkSemFonte(input: CritiqueInput): { issues: Issue[]; evidenceLevel: EvidenceLevel } {
  const spec = INTENTS[input.intent];
  const requiresEvidence = spec.required.includes("evidencia") || input.academicMode === "enforced";
  const ev = input.draft.evidencia ?? [];
  const withSource = ev.filter((e) => e.source && (e.source.title || e.source.url));
  const issues: Issue[] = [];
  let evidenceLevel: EvidenceLevel = withSource.length >= 3 ? 3 : withSource.length >= 1 ? 2 : 1;

  if (requiresEvidence && withSource.length === 0) {
    issues.push({
      tipo: "sem_fonte",
      onde: "corpo",
      porque: "O trabalho exige evidência com fonte, mas nenhuma afirmação está lastreada.",
      sugestao: "Rode literature_search/memory_search e ancore as afirmações centrais em fontes reais.",
    });
    evidenceLevel = 1;
  }
  return { issues, evidenceLevel };
}

const SYS =
  "Você é um examinador acadêmico SEVERO PORÉM CONSTRUTIVO (ScholarEval). Avalie o rascunho e " +
  'responda SÓ JSON: {"soundness":1-10,"contribution":1-10,"score":1-10,"decision":"aprovado|revisar|reprovado",' +
  '"rubric":{<dim>:1-5,...},"issues":[{"tipo":"sem_fonte|lacuna|impreciso|confuso|raso","onde":"...","porque":"...","sugestao":"..."}]}. ' +
  "Baixe a nota se houver afirmação sem fonte, lacuna face ao pedido, imprecisão factual, confusão ou rasura de profundidade. " +
  "Seja calibrado contra viés de positividade: não aprove por gentileza.";

function fallbackVerdict(cheap: { issues: Issue[]; evidenceLevel: EvidenceLevel }): ExaminerVerdict {
  const hasBlocker = cheap.issues.some((i) => i.tipo === "sem_fonte");
  return {
    soundness: hasBlocker ? 4 : 6, contribution: 5, score: hasBlocker ? 5 : 6,
    decision: hasBlocker ? "revisar" : "aprovado",
    rubric: {}, evidenceLevel: cheap.evidenceLevel, integrity: [], issues: cheap.issues,
  };
}

/**
 * critique — camada barata + ScholarEval via LLM. `heavy` usa o Pro (criar_trabalho/revisar).
 * Sempre devolve um veredito válido; funde os issues das duas camadas.
 */
export async function critique(input: CritiqueInput, opts?: { heavy?: boolean }): Promise<ExaminerVerdict> {
  const cheap = checkSemFonte(input);
  const dims = DIMS_BY_INTENT[input.intent] ?? ["problema", "escrita"];
  const model = opts?.heavy ? GEMINI_MODEL_PRO : GEMINI_MODEL_FLASH;

  try {
    const user =
      `Intenção: ${input.intent} · Modo acadêmico: ${input.academicMode}\n` +
      `Dimensões a pontuar (rubric): ${dims.join(", ")}\n` +
      `Pedido do usuário: ${input.objective}\n\n` +
      `RASCUNHO (JSON):\n${JSON.stringify(input.draft).slice(0, 12000)}`;
    const v = await geminiJson<Partial<ExaminerVerdict>>(SYS, user, { model, temperature: 0.2, timeoutMs: 20000 });

    const rubric: ExaminerRubric = {};
    for (const dK of dims) {
      const n = (v.rubric as any)?.[dK];
      if (typeof n === "number") rubric[dK] = Math.max(1, Math.min(5, n));
    }
    const clamp10 = (n: any, dflt: number) => (typeof n === "number" ? Math.max(1, Math.min(10, n)) : dflt);
    const issues = mergeIssues(cheap.issues, Array.isArray(v.issues) ? (v.issues as Issue[]) : []);
    const decision: ExaminerVerdict["decision"] =
      cheap.issues.some((i) => i.tipo === "sem_fonte") ? "revisar"
        : (v.decision === "aprovado" || v.decision === "revisar" || v.decision === "reprovado") ? v.decision : "revisar";

    return {
      soundness: clamp10(v.soundness, 6),
      contribution: clamp10(v.contribution, 5),
      score: clamp10(v.score, 6),
      decision,
      rubric,
      evidenceLevel: cheap.evidenceLevel,
      integrity: Array.isArray(v.integrity) ? v.integrity : [],
      issues,
    };
  } catch {
    return fallbackVerdict(cheap);
  }
}

/** Funde issues barata + LLM sem duplicar `sem_fonte`. */
function mergeIssues(cheap: Issue[], llm: Issue[]): Issue[] {
  const hasCheapSemFonte = cheap.some((i) => i.tipo === "sem_fonte");
  const llmClean = hasCheapSemFonte ? llm.filter((i) => i.tipo !== "sem_fonte") : llm;
  return [...cheap, ...llmClean].slice(0, 12);
}
