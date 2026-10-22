/**
 * lib/llm/papeis.ts — o modelo LOCAL da Contabo (CPU, sem GPU) nos papéis em que ninguém espera, com o Google
 * cobrindo o resto.
 *
 *   gerarPapel("curto", req)  → tenta `zaeon-local-lfm2` (LFM2-8B-A1B) no gateway; falhou/timeout/vazio/ocupado →
 *                               o MESMO pedido no Vertex (os modelos de `google`, em ordem). Quem chama não vê a troca.
 *
 * Papéis (medidos — docs/MODELOS_LOCAIS_PAPEIS.md):
 *   curto    → gatekeeper do cérebro (estudável + título) e juiz da árvore. LFM2: 4–10 s. Julga pior que um modelo
 *              grande (chamou uma pergunta de 5 palavras de domínio total) — os filtros de antes da chamada seguram:
 *              o gatekeeper só pergunta na zona cinzenta e o juiz só avalia tentativas de ≥ 6 palavras.
 *   artefato → o aparato pesado em segundo plano (comando /artefato da conversa). LFM2: mapa mental ~32 s.
 *
 * Desde 2026-10-22 o LFM2-8B-A1B (MoE, ~1,5B ativos) é o ÚNICO modelo local de texto: ~3× o Qwen3 30B na CPU
 * (lê 74 tok/s, escreve 15). Saíram da Contabo: qwen3 4B/30B, gpt-oss-20b e o llama-guard (moderação fora do chat).
 *
 * Regras:
 *   - Só fire-and-forget: nada aqui entra no caminho de uma resposta em streaming.
 *   - Flag por papel, LIGADA por default quando há gateway: LOCAL_CURTO / LOCAL_ARTEFATO = "0" desliga
 *     (vai direto no Google) — basta mudar o .env e recriar o web, sem build. *_MODELO troca o grupo.
 *   - Teto de chamadas em voo POR PROCESSO (o Ollama roda NUM_PARALLEL=1 e um request abortado continua lá
 *     dentro): passou do teto, o pedido vai direto pro Google em vez de enfileirar na CPU.
 *   - O ledger grava as duas tentativas (alvo "contabo" na que foi pra lá, "vertex" no fallback).
 */
import { gerar, type Deps, type GerarReq, type GerarRes } from "@/lib/llm/envelope";
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";
import { gatewayLigado } from "@/lib/llm/usage";

export type Papel = "curto" | "artefato";

type Env = Record<string, string | undefined>;

export type DefPapel = {
  /** Grupo do LiteLLM da VPS (infra/litellm.config.yaml). */
  modeloLocal: string;
  /** Env que troca o grupo local sem deploy. */
  envModelo?: string;
  /** Env que desliga o papel ("0"/"off"/"false"). */
  flag: string;
  /** Teto da tentativa local. Folgado: ninguém espera nenhum deles (frio medido: guard 52 s, qwen3 4B ~27 s, gpt-oss 112–120 s). */
  timeoutMs: number;
  /** Fallback Google, em ordem: o 1º que responder. */
  google: () => string[];
  /** Chamadas locais simultâneas por processo antes de mandar direto pro Google. */
  maxEmVoo: number;
  /** Campos extras do corpo OpenAI pro modelo local (desligar o "pensar" que a CPU não paga). */
  extra?: Record<string, unknown>;
};


export const PAPEIS: Record<Papel, DefPapel> = {
  curto: {
    modeloLocal: "zaeon-local-lfm2", envModelo: "LOCAL_CURTO_MODELO", flag: "LOCAL_CURTO", timeoutMs: 120_000, maxEmVoo: 1,
    google: () => [GEMINI_MODEL_FLASH],
  },
  // ARTEFATOS da conversa em segundo plano (comando /artefato): o LFM2 escreve enquanto o Google conversa com o
  // aluno. Mapa mental ~30 s, diagrama ~1,5–3 min na CPU; falhou/vazio/ocupado → o Google faz.
  artefato: {
    modeloLocal: "zaeon-local-lfm2", envModelo: "LOCAL_ARTEFATO_MODELO", flag: "LOCAL_ARTEFATO", timeoutMs: 300_000, maxEmVoo: 1,
    google: () => [GEMINI_MODEL_FLASH],
  },
};

const DESLIGADO = /^(0|off|false|nao|não|no)$/i;

/** Key que enxerga os grupos zaeon-local-* no gateway: GATEWAY_KEY_LOCAL > GATEWAY_MASTER_KEY. */
export function chaveLocal(env: Env = process.env): string | null {
  return env.GATEWAY_KEY_LOCAL?.trim() || env.GATEWAY_MASTER_KEY?.trim() || null;
}

/** O papel vai tentar a Contabo? (flag não desligada + gateway + key). */
export function papelLocalLigado(papel: Papel, env: Env = process.env): boolean {
  const f = env[PAPEIS[papel].flag]?.trim();
  if (f && DESLIGADO.test(f)) return false;
  return gatewayLigado(env) && Boolean(chaveLocal(env));
}

/** Qwen3/gpt-oss podem devolver o raciocínio no conteúdo — fica só a resposta. O Qwen3 thinking abre o
 *  <think> no template, então às vezes só o </think> aparece: tudo antes do último fechamento sai. */
export function limparPensamento(texto: string): string {
  let t = String(texto ?? "");
  const fim = t.toLowerCase().lastIndexOf("</think>");
  if (fim >= 0) t = t.slice(fim + "</think>".length);
  return t.replace(/<think>[\s\S]*$/i, "").trim();
}

const emVoo: Record<Papel, number> = { curto: 0, artefato: 0 };
/** Só pra teste. */
export const _emVoo = emVoo;

export type PapelRes = GerarRes & {
  papel: Papel;
  /** Por que o local não serviu (undefined = serviu). */
  fallback?: "desligado" | "ocupado" | "erro" | "vazio";
};

export type ReqPapel = Omit<GerarReq, "model" | "rota" | "extra" | "chaveGateway" | "timeoutMs"> & {
  /** Teto da chamada Google do fallback (a local usa o do papel). */
  timeoutMs?: number;
  /** Valida a resposta local além de "não vazia" (ex.: JSON parseável). false = cai pro Google. */
  aceita?: (texto: string) => boolean;
  /** System SÓ do fallback Google (quando o modelo local já sabe a tarefa sem ele). Vence `system`. */
  systemGoogle?: string;
};

export async function gerarPapel(papel: Papel, req: ReqPapel, deps: Deps = {}): Promise<PapelRes> {
  const env = deps.env ?? process.env;
  const def = PAPEIS[papel];
  const { aceita, timeoutMs, systemGoogle, ...base } = req;
  const ctx = { ...base.ctx, phase: base.ctx.phase ?? papel };

  let fallback: PapelRes["fallback"];
  if (!papelLocalLigado(papel, env)) fallback = "desligado";
  else if (emVoo[papel] >= def.maxEmVoo) fallback = "ocupado";
  else {
    emVoo[papel]++;
    try {
      const r = await gerar({
        ...base, ctx, model: (def.envModelo && env[def.envModelo]?.trim()) || def.modeloLocal, rota: "gateway", timeoutMs: def.timeoutMs,
        chaveGateway: chaveLocal(env), ...(def.extra ? { extra: def.extra } : {}),
      }, deps);
      const texto = limparPensamento(r.texto);
      if (texto && (!aceita || aceita(texto))) return { ...r, texto, papel };
      fallback = "vazio";
    } catch (e) {
      fallback = "erro";
      console.warn(`[papeis] ${papel} local falhou — Google: ${String((e as any)?.message ?? e).slice(0, 160)}`);
    } finally {
      emVoo[papel]--;
    }
  }

  // Google: o mesmo pedido, rota vertex, modelo de verdade. Erro no último modelo sobe pra quem chamou.
  const modelos = def.google();
  let ultimoErro: unknown = null;
  for (const m of modelos) {
    try {
      const r = await gerar({
        ...base, ctx, model: m, rota: "vertex", ...(timeoutMs ? { timeoutMs } : {}), ...(systemGoogle ? { system: systemGoogle } : {}),
      }, deps);
      return { ...r, papel, fallback };
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro;
}

/** = gerarPapel com json:true + parse (cercas ```json toleradas). Resposta local que não parseia cai pro Google. */
export async function gerarPapelJson<T>(papel: Papel, req: Omit<ReqPapel, "json" | "aceita">, deps: Deps = {}): Promise<{ valor: T; res: PapelRes }> {
  const res = await gerarPapel(papel, { ...req, json: true, aceita: (t) => parseJson(t) !== undefined }, deps);
  const valor = parseJson(res.texto);
  if (valor === undefined) throw new Error(`papel ${papel}: resposta sem JSON (${res.alvo ?? res.provedor})`);
  return { valor: valor as T, res };
}

function parseJson(texto: string): unknown {
  const t = String(texto ?? "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (!t) return undefined;
  try { return JSON.parse(t); } catch { /* o 4B às vezes fala antes do objeto */ }
  const m = /\{[\s\S]*\}/.exec(t);
  if (!m) return undefined;
  try { return JSON.parse(m[0]); } catch { return undefined; }
}
