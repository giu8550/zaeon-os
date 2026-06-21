/**
 * Model Router — multi-provider routing for the Projetos agentic IDE.
 *
 * Policy (objective criteria, see docs/PROJECTS_AGENTIC_IDE_SPEC.md §5):
 *   - Sonnet  → high-volume, fast edits, iteration (cheap/fast tier).
 *   - Opus    → complex reasoning, architecture, hard decisions, deep debugging.
 *   - Gemini  → long-context tasks, multimodal, and as the default/fallback in
 *               this codebase because Vertex/Gemini is the ONLY provider with
 *               credentials configured today (GOOGLE_CREDENTIALS / VERTEX).
 *
 * IMPORTANT — honest status of providers in THIS repo (do not overclaim):
 *   - GEMINI is REAL: it calls Vertex AI using the same credential pattern as
 *     app/api/agentic/codelab/route.ts, with the model centralized in
 *     lib/ai/model.ts (GEMINI_MODEL).
 *   - ANTHROPIC (Sonnet/Opus) is a PLUGGABLE STUB: there is no Anthropic SDK
 *     dependency and no ANTHROPIC_API_KEY in this environment. The provider is
 *     wired behind a capability check; when a key is present and the SDK is
 *     installed, flip ANTHROPIC_ENABLED and implement callAnthropic(). Until
 *     then, any route that selects an Anthropic model transparently FALLS BACK
 *     to Gemini and reports it via `result.fallbackFrom`.
 */

import { VertexAI } from "@google-cloud/vertexai";
import { GEMINI_MODEL, GEMINI_MODEL_FLASH, GEMINI_MODEL_PRO } from "./model";
import { runtimeMode } from "@/lib/runtime/mode";

// ─── Public types ──────────────────────────────────────────────────────────────

export type Provider = "anthropic" | "google";

export type ModelId =
  | "sonnet"   // anthropic — fast tier
  | "opus"     // anthropic — reasoning tier
  | "gemini";  // google/vertex — long context + default/fallback

/** The three IDE maturity levels drive default routing. */
export type IdeLevel = "prototype" | "implementation" | "autonomy";

/** Coarse task class the caller declares so the router can pick a model. */
export type TaskKind =
  | "chat"            // free-form Q&A, explanations
  | "diagram"         // mermaid / C4 / ER generation (prototype)
  | "doc"             // scope/requirements/roadmap summaries (prototype)
  | "edit"            // single-file surgical edit (implementation)
  | "scaffold"        // multi-file project scaffolding (one shot)
  | "filelist"        // plan ONLY the file list (paths + purpose) — small/fast
  | "genfile"         // generate ONE file's content — small/fast, fits 10s cap
  | "architecture"    // design decisions / ADRs
  | "debug"           // deep debugging / root-cause
  | "refactor"        // wide multi-file refactor (autonomy)
  | "plan";           // agentic plan step (autonomy)

export interface RouteRequest {
  level: IdeLevel;
  task: TaskKind;
  /** Approx token size of the assembled context; biases toward Gemini when large. */
  contextTokens?: number;
  /** User override — forces a specific model regardless of policy. */
  forceModel?: ModelId;
  /** Whether the user has explicitly opted into the (future) Anthropic tier. */
  allowAnthropic?: boolean;
}

export interface RouteDecision {
  model: ModelId;
  provider: Provider;
  /** Concrete model string passed to the provider SDK. */
  providerModel: string;
  reason: string;
  /** Set when the policy wanted Anthropic but we fell back to Gemini. */
  fallbackFrom?: ModelId;
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
}

export interface GenerateResult {
  text: string;
  decision: RouteDecision;
  usedProvider: Provider;
}

// ─── Capability flags ────────────────────────────────────────────────────────

/**
 * Anthropic is enabled only when a key exists. We DO NOT import the Anthropic
 * SDK unless it is installed, so the build stays green without the dependency.
 */
export const ANTHROPIC_ENABLED =
  !!process.env.ANTHROPIC_API_KEY && process.env.PROJECTS_ANTHROPIC === "on";

// Concrete provider model strings. Anthropic ones are placeholders kept in env
// so they can be updated without code changes once the tier is live.
const ANTHROPIC_MODELS: Record<"sonnet" | "opus", string> = {
  sonnet: process.env.ANTHROPIC_SONNET_MODEL || "claude-sonnet-4-6",
  opus: process.env.ANTHROPIC_OPUS_MODEL || "claude-opus-4-8",
};

// ─── Routing policy ────────────────────────────────────────────────────────────

const LARGE_CONTEXT = 80_000; // tokens — above this, prefer Gemini's long window.

/**
 * Pure decision function. Deterministic and unit-testable; no I/O.
 *
 * Order of precedence:
 *   1. Explicit user override (forceModel).
 *   2. Large context → Gemini.
 *   3. Task/level policy → Sonnet vs Opus.
 *   4. Anthropic availability gate → fall back to Gemini if the chosen
 *      Anthropic model is not actually enabled.
 */
export function route(req: RouteRequest): RouteDecision {
  const decide = (): { model: ModelId; reason: string } => {
    if (req.forceModel) {
      return { model: req.forceModel, reason: `Override do usuário → ${req.forceModel}` };
    }

    if ((req.contextTokens ?? 0) > LARGE_CONTEXT) {
      return { model: "gemini", reason: `Contexto grande (>${LARGE_CONTEXT} tokens) → Gemini` };
    }

    // Reasoning-heavy work → Opus.
    if (req.task === "architecture" || req.task === "debug" || req.task === "plan") {
      return { model: "opus", reason: `Tarefa de raciocínio profundo (${req.task}) → Opus` };
    }
    if (req.level === "autonomy" && req.task === "refactor") {
      return { model: "opus", reason: "Refator amplo em modo autonomia → Opus" };
    }

    // Diagrams / docs in prototyping are well-served by Gemini (structured + cheap).
    if (req.task === "diagram" || req.task === "doc") {
      return { model: "gemini", reason: `Prototipação estruturada (${req.task}) → Gemini` };
    }

    // High-volume edits / scaffolding / chat → Sonnet (fast tier).
    return { model: "sonnet", reason: `Alto volume / iteração (${req.task}) → Sonnet` };
  };

  const { model, reason } = decide();

  // Resolve provider + apply Anthropic availability gate (fail-soft to Gemini).
  if (model === "gemini") {
    return { model, provider: "google", providerModel: GEMINI_MODEL_FLASH, reason };
  }

  const anthropicOk = ANTHROPIC_ENABLED && req.allowAnthropic !== false;
  if (!anthropicOk) {
    // Fail-soft: route reasoning-tier (opus) to the Gemini PRO build, fast-tier to flash.
    const fallbackModel = model === "opus" ? GEMINI_MODEL_PRO : GEMINI_MODEL_FLASH;
    return {
      model: "gemini",
      provider: "google",
      providerModel: fallbackModel,
      reason: `${reason} — Anthropic travado neste ambiente, fallback para Gemini (${fallbackModel})`,
      fallbackFrom: model,
    };
  }

  return {
    model,
    provider: "anthropic",
    providerModel: ANTHROPIC_MODELS[model as "sonnet" | "opus"],
    reason,
  };
}

// ─── Provider execution ──────────────────────────────────────────────────────

/**
 * Build Vertex credentials resiliently. GOOGLE_CREDENTIALS may be:
 *   - valid one-line JSON (\n-escaped key) → parses fine;
 *   - multi-line JSON with raw newlines (common in .env.local) → JSON.parse throws.
 * Either way we fall back to the discrete GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY /
 * GOOGLE_PROJECT_ID vars, and normalize \n-escaped private keys. This is what makes
 * the agent actually run locally (not just in prod).
 */
const stripQuotes = (s?: string) => (s || "").replace(/^["']|["']$/g, "");

function vertexCredentials() {
  const raw = process.env.GOOGLE_CREDENTIALS || "";
  let creds: any = {};
  if (raw) {
    try {
      creds = JSON.parse(raw);
    } catch {
      // Common in .env.local: the JSON's private_key has RAW newlines. The only
      // raw newlines in a compact service-account JSON are inside that string, so
      // escaping them makes the whole blob valid JSON again.
      try { creds = JSON.parse(raw.replace(/\r/g, "").replace(/\n/g, "\\n")); } catch { creds = {}; }
    }
  }
  const project = creds.project_id || process.env.GOOGLE_PROJECT_ID;
  const client_email = creds.client_email || stripQuotes(process.env.GOOGLE_CLIENT_EMAIL);
  let private_key = creds.private_key || stripQuotes(process.env.GOOGLE_PRIVATE_KEY) || "";
  if (private_key.includes("\\n")) private_key = private_key.replace(/\\n/g, "\n");
  return { project, client_email, private_key };
}

function getVertexModel(
  modelId: string,
  opts: { temperature?: number; maxOutputTokens?: number; json?: boolean },
) {
  const { project, client_email, private_key } = vertexCredentials();
  const v = new VertexAI({
    project,
    location: process.env.GOOGLE_LOCATION || "us-central1",
    googleAuthOptions: { credentials: { client_email, private_key } },
  });
  // No VPS (container) não há teto de 10s: deixamos o Gemini "pensar" e damos um teto
  // de saída maior → respostas melhores e completas. No modo vercel, mantemos o
  // thinking OFF e o teto baixo (senão o thinking estoura o orçamento e trunca o JSON).
  const container = runtimeMode() === "container";
  const defaultMaxTokens = container ? 8192 : 2048;
  return v.getGenerativeModel({
    model: modelId || GEMINI_MODEL,
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      maxOutputTokens: opts.maxOutputTokens ?? defaultMaxTokens,
      // container → thinking habilitado (default do modelo); vercel → desligado.
      ...(container ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    } as any,
  });
}

async function callGemini(modelId: string, opts: GenerateOptions): Promise<string> {
  const model = getVertexModel(modelId, opts);
  const result = await model.generateContent({
    ...(opts.system ? { systemInstruction: { role: "system", parts: [{ text: opts.system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
  });
  const parts = result.response?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? "").join("");
}

/**
 * Anthropic call — INTENTIONALLY not implemented against the SDK here, because
 * the SDK is not a dependency in this repo. When the tier goes live:
 *   1. `npm i @anthropic-ai/sdk`
 *   2. set ANTHROPIC_API_KEY + PROJECTS_ANTHROPIC=on
 *   3. implement this using `new Anthropic().messages.create(...)`.
 * Until then `route()` never resolves to provider "anthropic", so this throws
 * only if called directly by mistake.
 */
async function callAnthropic(_decision: RouteDecision, _opts: GenerateOptions): Promise<string> {
  throw new Error(
    "Anthropic provider não implementado neste ambiente. Instale @anthropic-ai/sdk e " +
      "defina ANTHROPIC_API_KEY + PROJECTS_ANTHROPIC=on. O router faz fallback para Gemini " +
      "automaticamente; este caminho não deve ser alcançado.",
  );
}

/** Route + execute in one call. Always resolves through an available provider. */
export async function generate(req: RouteRequest, opts: GenerateOptions): Promise<GenerateResult> {
  const decision = route(req);
  const text =
    decision.provider === "anthropic"
      ? await callAnthropic(decision, opts)
      : await callGemini(decision.providerModel, opts);
  return { text, decision, usedProvider: decision.provider };
}
