// Loads live sections of OMEGA_SCHOLAR.md (identity, citation integrity) and
// builds the system prompt for the Past-Research mini-chat, so the chat agent
// IS Omega Scholar. Section keys match by header TITLE (not §-number) because
// the doc's numbering drifts — same rationale as suggestion-forge/prompts.py.
import fs from "node:fs";
import path from "node:path";

const FENCE = /^\s*(```|~~~)/;
const HEADER = /^(#{2,6})\s+(.*)$/;
const ANY_HEADER = /^(#{1,6})\s+/;
const TTL_MS = 60_000;

let cache: { mtime: number; loadedAt: number; text: string } | null = null;

function readOmega(): string {
  const p = process.env.OMEGA_SCHOLAR_PATH || path.join(process.cwd(), "OMEGA_SCHOLAR.md");
  try {
    const mtime = fs.statSync(p).mtimeMs;
    if (cache && cache.mtime === mtime && Date.now() - cache.loadedAt < TTL_MS) return cache.text;
    const text = fs.readFileSync(p, "utf-8");
    cache = { mtime, loadedAt: Date.now(), text };
    return text;
  } catch {
    return "";
  }
}

/** Return the header block whose title contains `keyword`, up to the next
 *  header of the same/higher level. Headers inside ``` code fences are ignored. */
export function extractSection(markdown: string, keyword: string): string {
  const lines = markdown.split("\n");
  let start = -1;
  let level = 0;
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = lines[i].match(HEADER);
    if (m && m[2].toLowerCase().includes(keyword.toLowerCase())) { start = i; level = m[1].length; break; }
  }
  if (start < 0) return "";
  const out = [lines[start]];
  inFence = false;
  for (let i = start + 1; i < lines.length; i++) {
    if (FENCE.test(lines[i])) { inFence = !inFence; out.push(lines[i]); continue; }
    if (!inFence) {
      const m = lines[i].match(ANY_HEADER);
      if (m && m[1].length <= level) break;
    }
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

const MATCHERS: Record<string, string[]> = {
  identity: ["IDENTIDADE"],
  citation: ["INTEGRIDADE DE CITAÇÕES", "REGRAS DE QUALIDADE"],
};

export function loadOmegaSection(key: "identity" | "citation"): string {
  const md = readOmega();
  if (!md) return "";
  for (const kw of MATCHERS[key] ?? []) {
    const s = extractSection(md, kw);
    if (s) return s;
  }
  return "";
}

const FALLBACK_IDENTITY =
  "Você é o Omega Scholar — agente de pesquisa acadêmica de espectro completo. " +
  "Pilares: correção antes de velocidade; evidência antes de síntese; citações verificáveis antes de afirmações.";

export interface ChatContext {
  title: string;
  references?: { title: string; authors?: string; year?: number | string }[];
  [k: string]: unknown;
}

/** System prompt for a Past-Research mini-chat — OMEGA identity + citation rules + injected context. */
export function buildPastResearchSystemPrompt(ctx: ChatContext): string {
  const identity = loadOmegaSection("identity") || FALLBACK_IDENTITY;
  const citation = loadOmegaSection("citation");
  const refs = ctx.references ?? [];
  const refsBlock = refs.length
    ? "REFERÊNCIAS DISPONÍVEIS (cite como [ref:N], índice 0-based):\n" +
      refs.map((r, i) => `[${i}] ${r.title}${r.authors ? ` — ${r.authors}` : ""}${r.year ? ` (${r.year})` : ""}`).join("\n")
    : "Este projeto não tem referências verificadas anexadas — NÃO invente citações; seja explícito sobre incerteza.";

  return `${identity}

${citation}

Você está num MINI-CHAT exploratório sobre a pesquisa: "${ctx.title}".

CONTEXTO DO PROJETO:
${JSON.stringify(ctx).slice(0, 2000)}

${refsBlock}

Regras deste chat:
- Tom leve, técnico e amigável, em pt-BR. Respostas objetivas.
- Ao afirmar um fato verificável E havendo referências, cite [ref:N]. Sem referências, declare a incerteza em vez de inventar.
- Nunca fabrique autores, DOIs, venues ou resultados quantitativos.`;
}
