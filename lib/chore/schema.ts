/**
 * lib/chore/schema.ts — validação MÍNIMA contra um schema raso (C8). Sem lib nova.
 * Cobre: type (object|string|number|boolean|array), required, enum, properties rasas, maxLength.
 * É o que `format` e as tools LLM da chore usam para aceitar (ou não) a saída do modelo.
 */
export type SchemaMin = {
  type: "object" | "string" | "number" | "boolean" | "array";
  required?: string[];
  enum?: (string | number | boolean)[];
  properties?: Record<string, SchemaMin>;
  maxLength?: number;
  /** array: schema raso do item (opcional). */
  items?: SchemaMin;
};

export type Validacao = { ok: true } | { ok: false; erros: string[] };

function tipoDe(v: unknown): SchemaMin["type"] | "null" | "outro" {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  return t === "object" || t === "string" || t === "number" || t === "boolean" ? (t as SchemaMin["type"]) : "outro";
}

function validar(v: unknown, s: SchemaMin, caminho: string, erros: string[], profundidade: number): void {
  const t = tipoDe(v);
  if (t !== s.type) { erros.push(`${caminho || "valor"}: esperado ${s.type}, veio ${t}`); return; }
  if (s.enum && !s.enum.includes(v as any)) erros.push(`${caminho || "valor"}: fora do enum`);
  if (s.type === "string" && s.maxLength != null && (v as string).length > s.maxLength) erros.push(`${caminho || "valor"}: maior que ${s.maxLength}`);
  if (s.type === "array" && s.maxLength != null && (v as unknown[]).length > s.maxLength) erros.push(`${caminho || "valor"}: mais de ${s.maxLength} itens`);
  if (profundidade > 0) return; // "rasas": não desce além do 1º nível
  if (s.type === "object") {
    const o = v as Record<string, unknown>;
    for (const r of s.required ?? []) if (!(r in o) || o[r] === undefined) erros.push(`${caminho ? caminho + "." : ""}${r}: obrigatório`);
    for (const [k, sub] of Object.entries(s.properties ?? {})) {
      if (o[k] === undefined || o[k] === null) continue;
      validar(o[k], sub, caminho ? `${caminho}.${k}` : k, erros, profundidade + 1);
    }
  }
  if (s.type === "array" && s.items) (v as unknown[]).forEach((x, i) => validar(x, s.items!, `${caminho}[${i}]`, erros, profundidade + 1));
}

export function validarContraSchema(valor: unknown, schema: SchemaMin): Validacao {
  const erros: string[] = [];
  validar(valor, schema, "", erros, 0);
  return erros.length ? { ok: false, erros } : { ok: true };
}

/** Só as chaves do schema (campos extras da saída do modelo são DESCARTADOS — §3.B). */
export function podar<T extends Record<string, unknown>>(valor: T, schema: SchemaMin): Partial<T> {
  if (schema.type !== "object" || !schema.properties || !valor || typeof valor !== "object") return valor;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(schema.properties)) if (k in valor) out[k] = valor[k];
  return out as Partial<T>;
}
