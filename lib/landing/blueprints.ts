/**
 * lib/landing/blueprints.ts — a VITRINE de blueprints da landing ("Aqui você vale o que você constrói.").
 *
 * O dono cadastra no admin (/api/admin/blueprints); a landing lê só os publicados (/api/blueprints).
 * Aqui mora a validação do que chega do formulário (pura, testada) e o formato público do card —
 * a rota pública nunca devolve rascunho nem campo interno.
 */

export const LIMITES = { titulo: 120, descricao: 400, url: 500, tags: 10, tag: 30 } as const;

/** O card como a landing recebe (sem `published`, sem datas). */
export type BlueprintPublico = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  href: string | null;
  tags: string[];
};

/** Os campos que o admin grava. */
export type BlueprintDados = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  href: string | null;
  tags: string[];
  published: boolean;
  order: number;
};

export type Validacao<T> = { ok: true; dados: T } | { ok: false; erro: string };

/** URL aceita: https/http absoluta ou caminho do próprio site ("/..."). Nada de javascript:, data: etc. */
export function urlSegura(v: unknown): string | null | undefined {
  if (v == null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  if (s.length > LIMITES.url) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const textoOpcional = (v: unknown, max: number): string | null | undefined => {
  if (v == null) return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? undefined : s;
};

function normalizarTags(v: unknown): string[] | undefined {
  if (v == null) return [];
  const lista = typeof v === "string" ? v.split(",") : Array.isArray(v) ? v : null;
  if (!lista) return undefined;
  const tags: string[] = [];
  for (const t of lista) {
    if (typeof t !== "string") return undefined;
    const s = t.trim();
    if (!s) continue;
    if (s.length > LIMITES.tag) return undefined;
    if (!tags.includes(s)) tags.push(s);
  }
  return tags.length > LIMITES.tags ? undefined : tags;
}

/**
 * Valida o corpo vindo do admin. `parcial` = PATCH: só o que veio é validado e devolvido.
 * Erros são códigos curtos (a UI mostra a mensagem).
 */
export function validarBlueprint(body: unknown, parcial: false): Validacao<BlueprintDados>;
export function validarBlueprint(body: unknown, parcial: true): Validacao<Partial<BlueprintDados>>;
export function validarBlueprint(body: unknown, parcial: boolean): Validacao<Partial<BlueprintDados>> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, erro: "corpo_invalido" };
  const b = body as Record<string, unknown>;
  const tem = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  const dados: Partial<BlueprintDados> = {};

  if (!parcial || tem("title")) {
    const t = typeof b.title === "string" ? b.title.trim() : "";
    if (!t) return { ok: false, erro: "titulo_obrigatorio" };
    if (t.length > LIMITES.titulo) return { ok: false, erro: "titulo_longo" };
    dados.title = t;
  }
  if (!parcial || tem("description")) {
    const d = textoOpcional(b.description, LIMITES.descricao);
    if (d === undefined) return { ok: false, erro: "descricao_invalida" };
    dados.description = d;
  }
  if (!parcial || tem("imageUrl")) {
    const u = urlSegura(b.imageUrl);
    if (u === undefined) return { ok: false, erro: "imagem_invalida" };
    dados.imageUrl = u;
  }
  if (!parcial || tem("href")) {
    const u = urlSegura(b.href);
    if (u === undefined) return { ok: false, erro: "link_invalido" };
    dados.href = u;
  }
  if (!parcial || tem("tags")) {
    const t = normalizarTags(b.tags);
    if (t === undefined) return { ok: false, erro: "tags_invalidas" };
    dados.tags = t;
  }
  if (!parcial || tem("published")) {
    if (b.published != null && typeof b.published !== "boolean") return { ok: false, erro: "publicado_invalido" };
    dados.published = b.published === true;
  }
  if (!parcial || tem("order")) {
    const o = b.order == null || b.order === "" ? 0 : Number(b.order);
    if (!Number.isInteger(o) || Math.abs(o) > 100_000) return { ok: false, erro: "ordem_invalida" };
    dados.order = o;
  }
  if (parcial && Object.keys(dados).length === 0) return { ok: false, erro: "nada_para_atualizar" };
  return { ok: true, dados };
}

/** O formato público do card: só o que a landing mostra. */
export function paraPublico(b: { id: string; title: string; description?: string | null; imageUrl?: string | null; href?: string | null; tags?: string[] | null }): BlueprintPublico {
  return {
    id: b.id,
    title: b.title,
    description: b.description ?? null,
    imageUrl: b.imageUrl ?? null,
    href: b.href ?? null,
    tags: b.tags ?? [],
  };
}

export const OID = /^[a-f0-9]{24}$/i;
