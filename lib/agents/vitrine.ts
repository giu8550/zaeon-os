/**
 * lib/agents/vitrine.ts — os campos do CRACHÁ editáveis no Modo CEO (AgentProfile): validação e
 * links. PURO. Vale igual pra nativos e mentores; não mexe no "cérebro" (prompt/persona).
 *   área · entrega (chips) · emoji · WhatsApp · Instagram · Facebook
 * Validadores: string válida → valor limpo · "" / null → null (apagar) · inválido → undefined.
 */

export type Redes = { whatsapp?: string | null; instagram?: string | null; facebook?: string | null };

const limpar = (v: unknown) => (typeof v === "string" ? v.trim() : v);

export function validarArea(v: unknown): string | null | undefined {
  const s = limpar(v);
  if (s === null || s === "") return null;
  if (typeof s !== "string" || s.length > 40) return undefined;
  return s;
}

/** Lista ou "a, b, c" → até 4 chips de até 28 caracteres. */
export function validarEntrega(v: unknown): string[] | undefined {
  if (v === null || v === "") return [];
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : null;
  if (!lista) return undefined;
  const itens = lista.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
  if (itens.length > 4 || itens.some((x) => x.length > 28)) return undefined;
  return itens;
}

export function validarEmoji(v: unknown): string | null | undefined {
  const s = limpar(v);
  if (s === null || s === "") return null;
  if (typeof s !== "string" || [...s].length > 4) return undefined;
  return s;
}

/** Qualquer formato com 10–15 dígitos → "+<dígitos>" (o wa.me pede DDI; sem DDI assume +55). */
export function validarWhatsapp(v: unknown): string | null | undefined {
  const s = limpar(v);
  if (s === null || s === "") return null;
  if (typeof s !== "string") return undefined;
  const m = /wa\.me\/(\d+)/.exec(s);
  let d = (m ? m[1] : s).replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`; // número BR sem DDI
  if (d.length < 12 || d.length > 15) return undefined;
  return `+${d}`;
}

/** "@handle", "handle" ou link do perfil → handle (sem @). */
export function validarInstagram(v: unknown): string | null | undefined {
  const s = limpar(v);
  if (s === null || s === "") return null;
  if (typeof s !== "string") return undefined;
  const m = /instagram\.com\/([^/?#\s]+)/i.exec(s);
  const h = (m ? m[1] : s).replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : undefined;
}

/** slug da página ou link → slug. */
export function validarFacebook(v: unknown): string | null | undefined {
  const s = limpar(v);
  if (s === null || s === "") return null;
  if (typeof s !== "string") return undefined;
  const m = /facebook\.com\/([^?#\s]+)/i.exec(s);
  const slug = (m ? m[1] : s).replace(/^@/, "").replace(/\/+$/, "");
  return /^[A-Za-z0-9.\-]{1,50}$/.test(slug) ? slug : undefined;
}

export const linkWhatsapp = (n: string) => `https://wa.me/${n.replace(/\D/g, "")}`;
export const linkInstagram = (h: string) => `https://instagram.com/${h}`;
export const linkFacebook = (s: string) => `https://facebook.com/${s}`;

export const temRedes = (r?: Redes | null) => !!(r?.whatsapp || r?.instagram || r?.facebook);
