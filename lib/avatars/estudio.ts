/**
 * lib/avatars/estudio.ts — o lado servidor do ESTÚDIO DE AVATAR (o mesmo nas duas etapas).
 *
 * O estúdio (components/agents/avatar/EstudioAvatar.tsx) gera PEÇA POR PEÇA pra o dono ver cada
 * estado aparecer e aprovar/rerolar: um POST por peça. Servidor sem estado — a base circula como
 * data URL WebP (~100 KB) entre o navegador e o servidor.
 *   { acao: "base", personagem, cor? }            → base nova (texto → imagem) + idle
 *   { acao: "base-de-imagem", imagem }            → usar uma imagem existente como base + idle
 *   { acao: "estado", base, estado, ajuste? }     → uma expressão (reroll = repetir)
 * Salvar: `validarSalvar` (aqui) → disco (dev, lib/avatars/disco.ts) ou banco (admin).
 */
import fs from "node:fs";
import path from "node:path";
import { isEstadoSprite, type EstadoSprite } from "./estados";
import { gerarBase, gerarQuadro, idleDaBase, normalizarBase, type QuadroGerado } from "./pipeline";

export const dataUrl = (buf: Buffer, mime = "image/webp") => `data:${mime};base64,${buf.toString("base64")}`;

/** data:image/(webp|png|jpeg);base64,… → Buffer, com teto de tamanho. Inválido → null. */
export function lerDataUrl(v: unknown, maxBytes: number): Buffer | null {
  if (typeof v !== "string") return null;
  const m = /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= maxBytes ? buf : null;
}

const COR_RE = /^#[0-9a-f]{6}$/i;
export function lerCor(v: unknown): [string, string] | undefined {
  return Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === "string" && COR_RE.test(c)) ? [v[0], v[1]] : undefined;
}

const LIMITE = { base: 900_000, entrada: 4_000_000, grande: 400_000, pequeno: 100_000 } as const;

/**
 * ÂNCORA DE ESTILO: todo personagem novo nasce desenhado em cima de um avatar JÁ APROVADO (o estilo
 * anime da casa). Homem → Caio; mulher → Aura (casa melhor proporção/cabelo). Sem o arquivo → sem
 * referência (só o prompt).
 */
export function referenciaDeEstilo(personagem: string): Buffer | null {
  const mulher = /\b(woman|girl|she|her|female|mulher|moça)\b/i.test(personagem);
  const id = mulher ? "aura" : "caio";
  try { return fs.readFileSync(path.join(process.cwd(), "public", "avatars", id, "base.webp")); } catch { return null; }
}

const quadroJson = (q: QuadroGerado) => ({ grande: dataUrl(q.grande), pequeno: dataUrl(q.pequeno) });

export type RespostaEstudio = { status: number; json: Record<string, unknown> };

export async function atenderEstudio(body: unknown): Promise<RespostaEstudio> {
  const b = (body ?? {}) as Record<string, unknown>;
  try {
    if (b.acao === "base") {
      const personagem = String(b.personagem ?? "");
      const { base, idle } = await gerarBase(personagem, lerCor(b.cor), 2, referenciaDeEstilo(personagem));
      return { status: 200, json: { base: dataUrl(base), estado: "idle", ...quadroJson(idle) } };
    }
    if (b.acao === "base-de-imagem") {
      const img = lerDataUrl(b.imagem, LIMITE.entrada);
      if (!img) return { status: 400, json: { error: "imagem inválida (data:image/* ≤ 4MB)" } };
      const base = await normalizarBase(img);
      return { status: 200, json: { base: dataUrl(base), estado: "idle", ...quadroJson(await idleDaBase(base)) } };
    }
    if (b.acao === "estado") {
      const base = lerDataUrl(b.base, LIMITE.base);
      if (!base) return { status: 400, json: { error: "base inválida — gere ou escolha a base primeiro" } };
      if (!isEstadoSprite(b.estado) || b.estado === "idle") return { status: 400, json: { error: "estado inválido" } };
      const q = await gerarQuadro(base, b.estado, typeof b.ajuste === "string" ? b.ajuste : undefined);
      return { status: 200, json: { estado: b.estado, ...quadroJson(q), fracao: q.fracao } };
    }
    return { status: 400, json: { error: "acao: base | base-de-imagem | estado" } };
  } catch (e) {
    // falha do modelo (cota, recusa, edição ruim) — o estúdio mostra no estado e oferece reroll
    return { status: 502, json: { error: (e as Error)?.message || "falhou" } };
  }
}

export type SetParaSalvar = {
  base: Buffer;
  quadros: Partial<Record<EstadoSprite, QuadroGerado>>;
  cor?: string;
};

/** Valida o POST de salvar: base + quadros APROVADOS (idle e blink obrigatórios). */
export function validarSalvar(body: unknown): { ok: true; set: SetParaSalvar } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const base = lerDataUrl(b.base, LIMITE.base);
  if (!base) return { ok: false, error: "base ausente/inválida" };
  const quadros: SetParaSalvar["quadros"] = {};
  const entrada = (b.quadros ?? {}) as Record<string, unknown>;
  for (const [estado, v] of Object.entries(entrada)) {
    if (!isEstadoSprite(estado)) return { ok: false, error: `estado desconhecido: ${estado}` };
    const q = (v ?? {}) as Record<string, unknown>;
    const grande = lerDataUrl(q.grande, LIMITE.grande);
    const pequeno = lerDataUrl(q.pequeno, LIMITE.pequeno);
    if (!grande || !pequeno) return { ok: false, error: `quadro inválido: ${estado}` };
    quadros[estado] = { grande, pequeno };
  }
  if (!quadros.idle || !quadros.blink) return { ok: false, error: "aprove pelo menos idle e blink (sem eles o avatar não pisca)" };
  const cor = typeof b.cor === "string" && COR_RE.test(b.cor) ? b.cor : undefined;
  return { ok: true, set: { base, quadros, cor } };
}
