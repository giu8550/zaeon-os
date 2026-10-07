/**
 * lib/llm/envelope.ts — contrato C5: a ÚNICA saída de LLM da camada autônoma (PR-G1/A1).
 *
 *   gerar(req)      → { texto, usage, modelo, provedor, finishReason, ms }
 *   gerarJson<T>()  → gerar({json:true}) + parse com os MESMOS erros diagnósticos do geminiJson legado
 *
 * Rotas: "vertex" (default; exatamente o que geminiJson/geminiText fazem hoje) e "gateway"
 * (LiteLLM OpenAI-compatible, só com GATEWAY_URL + key). Gateway caído/sem URL/sem key → cai para
 * o Vertex NA MESMA CHAMADA e grava provedor:"vertex" (é o que o health chama de degraded).
 * Erro de budget ("teto") NÃO cai para o Vertex: é indisponibilidade declarada (lei 5), relançada.
 * O ledger é fire-and-forget (void registrarTokens) ANTES do return — o turno nunca espera o banco.
 * Normalização de usage e classificação de erro vêm de lib/llm/usage.ts (puro, testado).
 */
import { usageDoVertex, usageDoOpenAI, classificarErroLlm, chaveDoAgente, gatewayLigado, type Usage, type ClasseErroLlm, USAGE_VAZIO } from "@/lib/llm/usage";
import { registrarTokens, type LedgerCtx } from "@/lib/llm/ledger";
import { GEMINI_MODEL_FLASH } from "@/lib/ai/model";

export type Rota = "vertex" | "gateway";
export type { LedgerCtx };
export type Mensagem = { role: "user" | "model"; text: string };
export type GerarReq = {
  system?: string;
  user?: string;                       // ou `messages` — um dos dois
  messages?: Mensagem[];
  json?: boolean;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  maxOutputTokens?: number;
  rota?: Rota;
  ctx: LedgerCtx;
};
export type GerarRes = {
  texto: string;
  usage: Usage;
  modelo: string;
  provedor: "vertex" | "litellm";
  rota: Rota;
  finishReason?: string;
  ms: number;
};

/** Erro de LLM já classificado (relançado pelo envelope). `classe` decide quem trata (fila × agente × admin). */
export class ErroLlm extends Error {
  readonly classe: ClasseErroLlm;
  readonly provedor: "vertex" | "litellm";
  readonly causa: unknown;
  constructor(classe: ClasseErroLlm, provedor: "vertex" | "litellm", causa: unknown) {
    super(`llm:${classe}: ${String((causa as any)?.message ?? causa).slice(0, 300)}`);
    this.name = "ErroLlm"; this.classe = classe; this.provedor = provedor; this.causa = causa;
  }
}

// ───────────────────────────── transportes (injetáveis p/ teste) ─────────────────────────────
export type RespostaBruta = { texto: string; usage: Usage; finishReason?: string; modelo: string };
export type TransporteVertex = (req: GerarReq, modelo: string) => Promise<RespostaBruta>;
export type Deps = { vertex?: TransporteVertex; fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; registrar?: typeof registrarTokens; agora?: () => number };

const DEFAULT_TIMEOUT_MS = Number(process.env.SCHOLAR_GEMINI_TIMEOUT_MS || 30_000);

/** Vertex direto: reusa makeVertex/extractText/withTimeout de lib/scholar/gemini.ts (import tardio: o SDK é pesado). */
const vertexReal: TransporteVertex = async (req, modelo) => {
  const { makeVertex, extractText, withTimeout } = await import("@/lib/scholar/gemini");
  const model = makeVertex().getGenerativeModel({
    model: modelo,
    generationConfig: {
      temperature: req.temperature ?? (req.json ? 0.2 : 0.5),
      ...(req.json ? { responseMimeType: "application/json" } : {}),
      ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
    },
    ...(req.system ? { systemInstruction: { role: "system", parts: [{ text: req.system }] } } : {}),
  });
  const contents = req.messages?.length
    ? req.messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] }))
    : [{ role: "user", parts: [{ text: req.user ?? "" }] }];
  const result: any = await withTimeout(model.generateContent({ contents }), req.timeoutMs ?? DEFAULT_TIMEOUT_MS, "Gemini");
  return {
    texto: extractText(result),
    usage: usageDoVertex(result?.response?.usageMetadata),
    finishReason: result?.response?.candidates?.[0]?.finishReason,
    modelo,
  };
};

async function viaGateway(req: GerarReq, modelo: string, url: string, key: string, f: typeof fetch): Promise<RespostaBruta> {
  const messages: { role: string; content: string }[] = [];
  if (req.system) messages.push({ role: "system", content: req.system });
  if (req.messages?.length) for (const m of req.messages) messages.push({ role: m.role === "model" ? "assistant" : "user", content: m.text });
  else messages.push({ role: "user", content: req.user ?? "" });
  const r = await f(`${url.replace(/\/+$/, "")}/v1/chat/completions`, {
    method: "POST", cache: "no-store", // o fetch do Next tem data cache; LLM nunca é cacheável
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelo, messages, temperature: req.temperature ?? (req.json ? 0.2 : 0.5),
      ...(req.maxOutputTokens ? { max_tokens: req.maxOutputTokens } : {}),
      ...(req.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  const bruto = await r.text();
  let body: any = null;
  try { body = JSON.parse(bruto); } catch { throw Object.assign(new Error(`gateway: resposta não-JSON (HTTP ${r.status}): ${bruto.slice(0, 80)}`), { status: r.status, naoJson: true }); }
  if (!r.ok) throw Object.assign(new Error(body?.error?.message ?? body?.message ?? `gateway HTTP ${r.status}`), { status: r.status, body: bruto });
  return {
    texto: String(body?.choices?.[0]?.message?.content ?? "").trim(),
    usage: usageDoOpenAI(body?.usage),
    finishReason: body?.choices?.[0]?.finish_reason,
    modelo: typeof body?.model === "string" && body.model ? body.model : modelo,
  };
}

/** Gateway caiu de um jeito que o Vertex direto resolve? (teto/cota/auth-de-agente NÃO: são declaráveis/nossos.) */
const caiParaVertex = (classe: ClasseErroLlm): boolean => classe === "provedor_fora" || classe === "timeout" || classe === "resposta_nao_json" || classe === "modelo_inexistente";

const avisouSemKey = new Set<string>();

// ───────────────────────────── gerar ─────────────────────────────
export async function gerar(req: GerarReq, deps: Deps = {}): Promise<GerarRes> {
  const env = deps.env ?? process.env;
  const agora = deps.agora ?? Date.now;
  const registrar = deps.registrar ?? registrarTokens;
  const modelo = req.model || GEMINI_MODEL_FLASH;
  const ini = agora();

  let rota: Rota = req.rota === "gateway" && gatewayLigado(env) ? "gateway" : "vertex";
  let key: string | null = null;
  if (rota === "gateway") {
    key = chaveDoAgente(req.ctx.agentKey, env) ?? env.GATEWAY_MASTER_KEY?.trim() ?? null;
    if (!key) {
      if (!avisouSemKey.has(req.ctx.agentKey)) { avisouSemKey.add(req.ctx.agentKey); console.warn(`[llm] agente ${req.ctx.agentKey} sem GATEWAY_KEY_* nem GATEWAY_KEY_DEFAULT — Vertex direto`); }
      rota = "vertex";
    }
  }

  const gravar = (provedor: "vertex" | "litellm", r: Rota, usage: Usage, ok: boolean, erro: ClasseErroLlm | null, m: string) =>
    void registrar({ ...req.ctx, model: m, provedor, rota: r, usage, ms: agora() - ini, ok, erro, alvo: "vertex", jsonValido: null }).catch(() => undefined);

  if (rota === "gateway") {
    try {
      const r = await viaGateway(req, modelo, env.GATEWAY_URL!.trim(), key!, deps.fetchImpl ?? fetch);
      gravar("litellm", "gateway", r.usage, true, null, r.modelo);
      return { ...r, provedor: "litellm", rota: "gateway", ms: agora() - ini };
    } catch (e) {
      const classe = (e as any)?.naoJson ? "resposta_nao_json" : classificarErroLlm(e);
      gravar("litellm", "gateway", USAGE_VAZIO, false, classe, modelo);
      if (!caiParaVertex(classe)) throw new ErroLlm(classe, "litellm", e);
      console.warn(`[llm] gateway ${classe} — caindo para o Vertex direto (${req.ctx.agentKey})`);
    }
  }

  try {
    const r = await (deps.vertex ?? vertexReal)(req, modelo);
    gravar("vertex", rota, r.usage, true, null, r.modelo);
    return { ...r, provedor: "vertex", rota, ms: agora() - ini };
  } catch (e) {
    const classe = classificarErroLlm(e);
    gravar("vertex", rota, USAGE_VAZIO, false, classe, modelo);
    throw new ErroLlm(classe, "vertex", e);
  }
}

/** = gerar({json:true}) + parse. Mesmos erros diagnósticos do geminiJson legado (nunca "{}" silencioso). */
export async function gerarJson<T>(req: GerarReq, deps: Deps = {}): Promise<T> {
  const r = await gerar({ ...req, json: true }, deps);
  const cleaned = r.texto.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (!cleaned) throw new ErroLlm("outro", r.provedor, new Error(`Gemini retornou resposta vazia (finishReason=${r.finishReason ?? "?"})`));
  try { return JSON.parse(cleaned) as T; }
  catch { throw new ErroLlm("resposta_nao_json", r.provedor, new Error(`Gemini retornou JSON inválido (finishReason=${r.finishReason ?? "?"}): ${cleaned.slice(0, 160)}`)); }
}

export { classificarErroLlm } from "@/lib/llm/usage";
