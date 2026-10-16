/**
 * lib/octa/evals/core.ts — P3 do Pack Octa (§5). A rotina anti-alucinação: DETECÇÃO, nunca deception.
 * (Substituto do davidcarliez/trustmebro, que foi REJEITADO por fabricar saída de tool.)
 *
 *   FRAMEWORK (este arquivo, código, não agente) roda o agente nas fixtures e as checagens canônicas:
 *     groundedness · tool-truth · repeatability · expectativa · drift.
 *   JUIZ independente (padrão uw-syfi/vibesys): recebe um snapshot CONGELADO (read-only), sem tools,
 *     e é o único que marca PASS/FAIL.
 *   AUTO-CURA honesta: re-ancora (temperatura 0 → recarrega skill → modelo forte) e RE-RODA o agente.
 *     Nunca edita a saída pra passar. Se não recuperar → vermelho + alerta (degrada com aviso).
 */
import { createHash } from "node:crypto";

// ───────────────────────────── contratos ─────────────────────────────
export type Fixture = {
  id: string;
  prompt: string;
  /** O "mundo" da tarefa: arquivos que o agente pode citar. Fonte fora daqui = não-ancorada. */
  arquivos: Record<string, string>;
  espera?: { contem?: string[]; naoContem?: string[]; exigeCitacao?: boolean };
};

export type Claim = { texto: string; fonte?: string; trecho?: string };
/** `disse` = o que o AGENTE relatou que a tool devolveu; `real` = o que o RUNTIME registrou (nunca vem do modelo). */
export type ToolCallReport = { id: string; tool: string; disse: unknown; real: unknown };
export type AgentOutput = { resposta: string; claims: Claim[]; tools: ToolCallReport[] };

export type Ancora = { temperatura?: number; recarregarSkill?: boolean; modelo?: "padrao" | "forte" };
export type AgenteSobAvaliacao = { nome: string; rodar(f: Fixture, ancora: Ancora): Promise<AgentOutput> };

export type CheckName = "groundedness" | "tool_truth" | "repeatability" | "expectativa";
export type CheckResult = { check: CheckName; ok: boolean; detalhe: string[] };

export type Veredito = { fixture: string; pass: boolean; motivo: string };
/** O juiz: só lê. Sem tools, sem acesso ao agente. Pode ser determinístico ou LLM (via JudgeFn). */
export type Juiz = (snap: Readonly<SnapshotJuiz>) => Promise<Veredito> | Veredito;
export type SnapshotJuiz = { fixture: Fixture; saidas: AgentOutput[]; checks: CheckResult[] };

export type Status = "verde" | "amarelo" | "vermelho";
export type ResultadoFixture = { fixture: string; veredito: Veredito; checks: CheckResult[]; curadoCom?: Ancora; tentativas: number };
export type Relatorio = {
  agente: string;
  em: string;
  status: Status;
  taxaPass: number;
  drift: number | null;
  resultados: ResultadoFixture[];
  alerta?: string;
};

// ───────────────────────────── checagens (framework) ─────────────────────────────
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export function canon(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canon((v as any)[k])}`).join(",")}}`;
}
export const hashSaida = (o: AgentOutput) => createHash("sha256").update(canon({ r: norm(o.resposta), c: o.claims })).digest("hex");

/** Toda afirmação precisa de fonte que EXISTE no mundo da fixture; se citar trecho, o trecho tem que estar lá. */
export function checkGroundedness(f: Fixture, o: AgentOutput): CheckResult {
  const det: string[] = [];
  if (f.espera?.exigeCitacao && !o.claims.length) det.push("nenhuma afirmação citada");
  for (const c of o.claims) {
    if (!c.fonte) { det.push(`sem fonte: "${c.texto.slice(0, 60)}"`); continue; }
    const conteudo = f.arquivos[c.fonte];
    if (conteudo === undefined) { det.push(`fonte inexistente: ${c.fonte}`); continue; }
    if (c.trecho && !norm(conteudo).includes(norm(c.trecho))) det.push(`trecho não está em ${c.fonte}: "${c.trecho.slice(0, 60)}"`);
  }
  return { check: "groundedness", ok: !det.length, detalhe: det };
}

/** O oposto do trustmebro: compara o que o agente DISSE que a tool devolveu com o que ela DEVOLVEU. */
export function checkToolTruth(o: AgentOutput): CheckResult {
  const det = o.tools.filter((t) => canon(t.disse) !== canon(t.real)).map((t) => `${t.tool}#${t.id}: disse ${canon(t.disse).slice(0, 80)} ≠ real ${canon(t.real).slice(0, 80)}`);
  return { check: "tool_truth", ok: !det.length, detalhe: det };
}

export function checkRepeatability(saidas: AgentOutput[]): CheckResult {
  const hs = new Set(saidas.map(hashSaida));
  return { check: "repeatability", ok: hs.size <= 1, detalhe: hs.size > 1 ? [`${hs.size} saídas diferentes em ${saidas.length} execuções`] : [] };
}

export function checkExpectativa(f: Fixture, o: AgentOutput): CheckResult {
  const r = norm(o.resposta);
  const det = [
    ...(f.espera?.contem ?? []).filter((s) => !r.includes(norm(s))).map((s) => `faltou: ${s}`),
    ...(f.espera?.naoContem ?? []).filter((s) => r.includes(norm(s))).map((s) => `não devia conter: ${s}`),
  ];
  return { check: "expectativa", ok: !det.length, detalhe: det };
}

export function rodarChecks(f: Fixture, saidas: AgentOutput[]): CheckResult[] {
  const o = saidas[0];
  return [checkGroundedness(f, o), checkToolTruth(o), checkRepeatability(saidas), checkExpectativa(f, o)];
}

// ───────────────────────────── juiz ─────────────────────────────
export function congelar<T>(v: T): Readonly<T> {
  if (v && typeof v === "object" && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v as object)) congelar((v as any)[k]);
  }
  return v;
}

/** Juiz determinístico padrão: PASS só se TODAS as checagens passaram. */
export const juizRegras: Juiz = ({ fixture, checks }) => {
  const falhas = checks.filter((c) => !c.ok);
  return { fixture: fixture.id, pass: !falhas.length, motivo: falhas.length ? falhas.map((c) => `${c.check}: ${c.detalhe.join("; ")}`).join(" | ") : "todas as checagens passaram" };
};

// ───────────────────────────── runner + auto-cura ─────────────────────────────
export const ESCADA_DE_ANCORAGEM: Ancora[] = [{ temperatura: 0 }, { temperatura: 0, recarregarSkill: true }, { temperatura: 0, recarregarSkill: true, modelo: "forte" }];

async function avaliar(agente: AgenteSobAvaliacao, f: Fixture, ancora: Ancora, juiz: Juiz, repeticoes: number) {
  const saidas: AgentOutput[] = [];
  for (let i = 0; i < repeticoes; i++) saidas.push(await agente.rodar(structuredClone(f), ancora));
  const checks = rodarChecks(f, saidas);
  // o juiz recebe uma CÓPIA congelada: não consegue alterar saídas nem checagens
  const veredito = await juiz(congelar(structuredClone({ fixture: f, saidas, checks })));
  return { checks, veredito };
}

export async function rodarSuite(
  agente: AgenteSobAvaliacao,
  fixtures: Fixture[],
  opts: { juiz?: Juiz; repeticoes?: number; baselineTaxa?: number | null; agora?: () => Date; curar?: boolean } = {},
): Promise<Relatorio> {
  const juiz = opts.juiz ?? juizRegras;
  const rep = Math.max(2, opts.repeticoes ?? 2);
  const resultados: ResultadoFixture[] = [];

  for (const f of fixtures) {
    let tentativas = 1;
    let r = await avaliar(agente, f, {}, juiz, rep).catch((e) => falhaDeExecucao(f, e));
    let curadoCom: Ancora | undefined;
    if (!r.veredito.pass && opts.curar !== false) {
      for (const ancora of ESCADA_DE_ANCORAGEM) {
        tentativas++;
        const r2 = await avaliar(agente, f, ancora, juiz, rep).catch((e) => falhaDeExecucao(f, e));
        if (r2.veredito.pass) { r = r2; curadoCom = ancora; break; }
      }
    }
    resultados.push({ fixture: f.id, veredito: r.veredito, checks: r.checks, curadoCom, tentativas });
  }

  const passou = resultados.filter((r) => r.veredito.pass);
  const taxaPass = fixtures.length ? passou.length / fixtures.length : 0;
  const passouDePrimeira = passou.filter((r) => !r.curadoCom).length / (fixtures.length || 1);
  const drift = opts.baselineTaxa == null ? null : +(opts.baselineTaxa - passouDePrimeira).toFixed(4);
  const status: Status =
    taxaPass < 1 || (drift ?? 0) > 0.2 ? "vermelho" : passou.some((r) => r.curadoCom) || (drift ?? 0) > 0 ? "amarelo" : "verde";
  const falhas = resultados.filter((r) => !r.veredito.pass).map((r) => r.fixture);
  return {
    agente: agente.nome,
    em: (opts.agora?.() ?? new Date()).toISOString(),
    status,
    taxaPass,
    drift,
    resultados,
    alerta: status === "vermelho" ? `🩺 ${agente.nome} degradado: ${falhas.length ? `falhou em ${falhas.join(", ")} mesmo após re-ancorar` : `drift de ${drift}`}` : undefined,
  };
}

function falhaDeExecucao(f: Fixture, e: unknown) {
  const msg = String((e as any)?.message ?? e);
  return { checks: [] as CheckResult[], veredito: { fixture: f.id, pass: false, motivo: `agente falhou ao rodar: ${msg}` } };
}
