#!/usr/bin/env node
/**
 * scripts/provar-chaves.mjs — prova de vida de chave de provedor de LLM (e do gateway).
 * Spec: docs/VERIFICACAO_CHAVES_GATEWAY.md §3. Zero dependências (Node 18+, fetch global).
 *
 *   node scripts/provar-chaves.mjs                       # tudo que tiver chave no ambiente
 *   node scripts/provar-chaves.mjs groq openrouter       # só estes
 *   node scripts/provar-chaves.mjs --json                # para CI / dashboard
 *   node scripts/provar-chaves.mjs --gateway http://litellm:4000/v1 --key sk-... [--model zaeon-flash]
 *
 * Quatro provas por chave: autentica · responde · tool · usage. Nunca imprime a chave.
 * Exit 1 se algum provedor COM chave configurada não ficou APTO.
 * Vereditos: APTO · SEM_CHAVE · SEM_CONFIG · FALHOU:<classe> · RESPOSTA_VAZIA · SEM_TOOL_CALLING · SEM_USAGE · RESPOSTA_NAO_JSON
 * Uma conta por provedor (handoff §8.11): o script lê UMA env por provedor, de propósito.
 */
import { readFileSync, existsSync } from "node:fs";

// ── .env (só preenche o que não está no ambiente; nunca sobrescreve) ──
for (const f of [".env", ".env.secrets", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const linha of readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linha);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const JSON_OUT = args.includes("--json");
const GATEWAY = flag("--gateway");
const GATEWAY_KEY = flag("--key") ?? process.env.GATEWAY_MASTER_KEY ?? process.env.GATEWAY_KEY_DEFAULT ?? null;
const GATEWAY_MODEL = flag("--model") ?? "zaeon-flash";
const TIMEOUT_MS = Number(flag("--timeout") ?? 25_000);
const pedidos = args.filter((a, i) => !a.startsWith("--") && !["--gateway", "--key", "--model", "--timeout"].includes(args[i - 1]));

// ── catálogo: UMA env por provedor ──
const PROVEDORES = {
  groq:       { env: "GROQ_API_KEY",        base: "https://api.groq.com/openai/v1",  model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b" },
  openrouter: { env: "OPENROUTER_API_KEY",  base: "https://openrouter.ai/api/v1",   model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free", headers: { "HTTP-Referer": "https://zaeon.com.br", "X-Title": "Zaeon provar-chaves" } },
  gemini:     { env: "GEMINI_FREE_API_KEY", base: "https://generativelanguage.googleapis.com/v1beta/openai", model: process.env.GEMINI_FREE_MODEL ?? "gemini-2.5-flash-lite" },
  cloudflare: { env: "CLOUDFLARE_API_KEY",  base: () => process.env.CLOUDFLARE_ACCOUNT_ID ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1` : null, model: process.env.CLOUDFLARE_MODEL ?? "@cf/meta/llama-3.1-8b-instruct", precisa: ["CLOUDFLARE_ACCOUNT_ID"] },
  glm:        { env: "ZHIPU_API_KEY",       base: "https://open.bigmodel.cn/api/paas/v4", model: process.env.GLM_MODEL ?? "glm-4-flash" },
  mistral:    { env: "MISTRAL_API_KEY",     base: "https://api.mistral.ai/v1",      model: process.env.MISTRAL_MODEL ?? "mistral-small-latest" },
  github:     { env: "GITHUB_MODELS_TOKEN", base: "https://models.github.ai/inference", model: process.env.GITHUB_MODEL ?? "openai/gpt-4o-mini" },
};

const mascara = (k) => (!k ? "—" : k.length <= 10 ? "…" : `${k.slice(0, 6)}…${k.slice(-4)}`);

// Classificação mínima, alinhada com lib/llm/usage.ts (o script é standalone; a fonte da verdade é o .ts).
function classificar(status, texto) {
  const s = String(texto ?? "").toLowerCase();
  if (s.includes("no deployments available") || /all fallbacks? failed|routerratelimiterror/.test(s)) return "pool_esgotado";
  if (/budget (has been |)exceeded|exceededbudget|max_budget/.test(s)) return "teto";
  if (status === 401 || status === 403 || /invalid api key|unauthorized|api key not valid/.test(s)) return "auth";
  if (status === 402 || /insufficient_quota|insufficient credits|billing/.test(s)) return "credito";
  if (status === 404 || /model.*not.*found|does not exist/.test(s)) return "modelo_inexistente";
  if (status === 429 || /rate.?limit|resource.?exhausted/.test(s)) return /per minute|per_minute|\brpm\b|\btpm\b/.test(s) ? "rate_limit" : /per day|daily|month|4006|allocation/.test(s) ? "cota_esgotada" : "rate_limit";
  if (status >= 500) return "provedor_fora";
  return "outro";
}

async function chamar(base, key, body, extraHeaders = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const ini = Date.now();
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...extraHeaders },
      body: JSON.stringify(body),
    });
    const texto = await r.text();
    let json = null; try { json = JSON.parse(texto); } catch { /* não-JSON: tratado pelo chamador */ }
    return { status: r.status, headers: r.headers, texto, json, ms: Date.now() - ini };
  } catch (e) {
    return { status: 0, headers: new Headers(), texto: String(e?.cause?.code ?? e?.name ?? e?.message ?? e), json: null, ms: Date.now() - ini, erro: e };
  } finally { clearTimeout(t); }
}

/** No 404, lista o que a chave enxerga (ajuda a escolher o <PROVEDOR>_MODEL certo). */
async function modelosDisponiveis(base, key, extra) {
  try {
    const r = await fetch(`${base.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${key}`, ...extra }, signal: AbortSignal.timeout(8000) });
    const j = await r.json(); const ids = (j?.data ?? []).map((m) => m.id).filter((id) => !/whisper|guard|tts|embed|orpheus/i.test(id)).sort();
    return ids.length ? ` · modelos disponíveis: ${ids.slice(0, 8).join(", ")}${ids.length > 8 ? ` (+${ids.length - 8})` : ""}` : "";
  } catch { return ""; }
}

const telemetria = (h) => {
  const out = {};
  for (const k of ["x-litellm-model-id", "x-litellm-model-group", "x-litellm-response-cost", "x-litellm-attempted-fallbacks", "x-litellm-call-id", "x-omniroute-model", "x-omniroute-provider",
    "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens", "retry-after"]) {
    const v = h.get(k); if (v != null) out[k] = v;
  }
  return out;
};

async function provar(nome, cfg, key, base) {
  const res = { provedor: nome, chave: mascara(key), modelo: cfg.model, provas: { autentica: null, responde: null, tool: null, usage: null }, veredito: null, detalhe: null, ms: 0, telemetria: {} };
  const extra = cfg.headers ?? {};

  // 1+2+4 — autentica, responde, usage (uma chamada)
  const r1 = await chamar(base, key, { model: cfg.model, temperature: 0, max_tokens: 40, messages: [
    { role: "system", content: "Responda SEMPRE em português do Brasil, em uma frase curta." },
    { role: "user", content: "Qual é a capital do Brasil?" }] }, extra);
  res.ms += r1.ms; res.telemetria = telemetria(r1.headers);
  if (r1.status === 0) { res.provas.autentica = false; res.veredito = `FALHOU:${/abort/i.test(r1.texto) ? "timeout" : "provedor_fora"}`; res.detalhe = r1.texto.slice(0, 160); return res; }
  if (r1.json == null) { res.provas.autentica = null; res.veredito = "RESPOSTA_NAO_JSON"; res.detalhe = `HTTP ${r1.status} corpo não-JSON (${JSON.stringify(r1.texto.slice(0, 40))}) — provavelmente um proxy de egress/allowlist no caminho, não a chave`; return res; }
  if (r1.status >= 400) {
    const msg = r1.json?.error?.message ?? r1.json?.message ?? r1.texto;
    const classe = classificar(r1.status, msg);
    res.provas.autentica = classe !== "auth";
    res.veredito = `FALHOU:${classe}`; res.detalhe = `HTTP ${r1.status}: ${String(msg).slice(0, 200)}`;
    if (classe === "modelo_inexistente") res.detalhe += await modelosDisponiveis(base, key, extra);
    return res;
  }
  res.provas.autentica = true;
  const txt = (r1.json?.choices?.[0]?.message?.content ?? "").trim();
  const emPt = /bras[ií]lia/i.test(txt) && !/\b(the|is|capital of)\b/i.test(txt);
  res.provas.responde = Boolean(txt) && emPt;
  if (!txt) { res.veredito = "RESPOSTA_VAZIA"; res.detalhe = "200 sem conteúdo em choices[0].message.content"; return res; }
  const u = r1.json?.usage;
  res.provas.usage = Boolean(u && (u.prompt_tokens > 0 || u.total_tokens > 0));
  res.usage = u ?? null;

  // 3 — tool calling com schema obrigatório E enum
  const r2 = await chamar(base, key, { model: cfg.model, temperature: 0, max_tokens: 80,
    messages: [{ role: "user", content: "Classifique o sentimento desta frase usando a ferramenta: 'O atendimento foi péssimo e demorado.'" }],
    tools: [{ type: "function", function: { name: "classificar_sentimento", description: "Classifica o sentimento de uma frase.", parameters: { type: "object", required: ["sentimento", "confianca"], properties: { sentimento: { type: "string", enum: ["positivo", "negativo", "neutro"] }, confianca: { type: "number", minimum: 0, maximum: 1 } } } } }],
    tool_choice: "required" }, extra);
  res.ms += r2.ms;
  let toolOk = false, toolDetalhe = null;
  if (r2.json && r2.status < 400) {
    const tc = r2.json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) toolDetalhe = "sem tool_calls na resposta";
    else {
      try {
        const a = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function?.arguments;
        if (tc.function?.name !== "classificar_sentimento") toolDetalhe = `chamou ${tc.function?.name}`;
        else if (!["positivo", "negativo", "neutro"].includes(a?.sentimento)) toolDetalhe = `enum violado: sentimento=${JSON.stringify(a?.sentimento)}`;
        else if (typeof a?.confianca !== "number") toolDetalhe = "campo obrigatório 'confianca' ausente/não numérico";
        else toolOk = true;
      } catch { toolDetalhe = "arguments não é JSON"; }
    }
  } else toolDetalhe = r2.json ? `HTTP ${r2.status}: ${String(r2.json?.error?.message ?? r2.texto).slice(0, 120)}` : `HTTP ${r2.status} não-JSON`;
  res.provas.tool = toolOk;

  if (!res.provas.responde) { res.veredito = "RESPOSTA_VAZIA"; res.detalhe = `respondeu mas não obedeceu idioma/conteúdo: ${JSON.stringify(txt.slice(0, 80))}`; return res; }
  if (!res.provas.tool) { res.veredito = "SEM_TOOL_CALLING"; res.detalhe = toolDetalhe; return res; }
  if (!res.provas.usage) { res.veredito = "SEM_USAGE"; res.detalhe = "200 sem bloco usage — o ledger fica cego e o orçamento não freia"; return res; }
  res.veredito = "APTO"; return res;
}

async function main() {
  const resultados = [];
  if (GATEWAY) {
    if (!GATEWAY_KEY) { resultados.push({ provedor: "gateway", chave: "—", modelo: GATEWAY_MODEL, veredito: "SEM_CHAVE", detalhe: "passe --key ou GATEWAY_MASTER_KEY/GATEWAY_KEY_DEFAULT", provas: {} }); }
    else resultados.push(await provar("gateway", { model: GATEWAY_MODEL }, GATEWAY_KEY, GATEWAY));
  } else {
    const nomes = pedidos.length ? pedidos : Object.keys(PROVEDORES);
    for (const nome of nomes) {
      const cfg = PROVEDORES[nome];
      if (!cfg) { resultados.push({ provedor: nome, chave: "—", veredito: "SEM_CONFIG", detalhe: `provedor desconhecido (conheço: ${Object.keys(PROVEDORES).join(", ")})`, provas: {} }); continue; }
      const key = process.env[cfg.env]?.trim();
      if (!key) { resultados.push({ provedor: nome, chave: "—", modelo: cfg.model, veredito: "SEM_CHAVE", detalhe: `env ${cfg.env} vazia`, provas: {} }); continue; }
      const base = typeof cfg.base === "function" ? cfg.base() : cfg.base;
      if (!base) { resultados.push({ provedor: nome, chave: mascara(key), modelo: cfg.model, veredito: "SEM_CONFIG", detalhe: `falta ${(cfg.precisa ?? []).join(", ")}`, provas: {} }); continue; }
      resultados.push(await provar(nome, cfg, key, base));
    }
  }

  const falhou = resultados.filter((r) => r.veredito !== "APTO" && r.veredito !== "SEM_CHAVE");
  if (JSON_OUT) { console.log(JSON.stringify({ at: new Date().toISOString(), resultados, ok: falhou.length === 0 }, null, 2)); }
  else {
    const col = (s, w) => String(s ?? "").padEnd(w);
    console.log(col("provedor", 11) + col("chave", 14) + col("autentica", 10) + col("responde", 9) + col("tool", 6) + col("usage", 6) + col("ms", 6) + "veredito");
    for (const r of resultados) {
      const p = r.provas ?? {}; const b = (v) => (v === true ? "✓" : v === false ? "✗" : "·");
      console.log(col(r.provedor, 11) + col(r.chave, 14) + col(b(p.autentica), 10) + col(b(p.responde), 9) + col(b(p.tool), 6) + col(b(p.usage), 6) + col(r.ms ?? "", 6) + r.veredito + (r.detalhe ? `  — ${r.detalhe}` : ""));
      if (r.telemetria && Object.keys(r.telemetria).length) console.log("           " + Object.entries(r.telemetria).map(([k, v]) => `${k}=${v}`).join("  "));
    }
    console.log(falhou.length ? `\n${falhou.length} com problema. A coluna que decide pro pool é "tool".` : "\nTudo que tem chave está APTO.");
  }
  process.exit(falhou.length ? 1 : 0);
}
main().catch((e) => { console.error("provar-chaves: erro inesperado:", e?.message ?? e); process.exit(2); });
