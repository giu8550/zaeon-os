/**
 * lib/aura/academico.ts — regras PURAS da credencial acadêmica: quem pode verificar, hash do
 * documento, o que pode mudar de status. Sem Prisma/rede (server helpers em academico-server.ts).
 */
import { createHash } from "crypto";
import { isMetodo, type MetodoVerificacao } from "@/lib/aura/rules";

export type Verificador = {
  id: string;
  role: string | null | undefined;
  /** flag explícita (admin habilita) OU o próprio verificador tem credencial verificada. */
  verificadorHabilitado: boolean;
  temCredencialVerificada: boolean;
  isSuperAdmin?: boolean;
};

export type Elegibilidade = { ok: true; papel: "professor" | "instituicao" | "admin" } | { ok: false; motivo: "conflito" | "papel" | "nao_habilitado" | "sem_vinculo" };

const PAPEL_PROF = new Set(["teacher", "professor"]);
const PAPEL_INST = new Set(["instituicao", "institution"]);

/**
 * Quem chancela: professor vinculado (TeacherStudent) ou instituição com vínculo; nunca a própria
 * credencial; admin só MODERA (rejeitar/escalar), não verifica no fluxo normal.
 */
export function elegibilidade(v: Verificador, alvoUserId: string, vinculado: boolean): Elegibilidade {
  if (v.id === alvoUserId) return { ok: false, motivo: "conflito" };
  const role = (v.role ?? "").toLowerCase();
  if (PAPEL_INST.has(role)) return vinculado ? { ok: true, papel: "instituicao" } : { ok: false, motivo: "sem_vinculo" };
  if (PAPEL_PROF.has(role)) {
    if (!(v.verificadorHabilitado || v.temCredencialVerificada)) return { ok: false, motivo: "nao_habilitado" };
    return vinculado ? { ok: true, papel: "professor" } : { ok: false, motivo: "sem_vinculo" };
  }
  if (v.isSuperAdmin) return { ok: true, papel: "admin" };
  return { ok: false, motivo: "papel" };
}

/** Admin não verifica: só rejeita/modera. Instituição pode subir pra registry (selo ouro). */
export type PapelVerificador = "professor" | "instituicao" | "admin";
export function metodoPermitido(papel: PapelVerificador, pedido: unknown, temDoc: boolean): MetodoVerificacao | null {
  const m: MetodoVerificacao = isMetodo(pedido) ? pedido : "doc_review";
  if (papel === "admin") return null;
  if (m === "declarado" || m === "edu_email") return null; // esses não são "verificar"
  if (m === "doc_review") return temDoc ? "doc_review" : null;
  if (m === "registry" || m === "onchain") return papel === "instituicao" ? m : null;
  return null;
}

/** sha256 do CONTEÚDO (sem o header do data URL) — detecta o mesmo diploma em contas diferentes. */
export function hashDocumento(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  const payload = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return createHash("sha256").update(payload).digest("hex");
}

export const MAX_DOC_CHARS = 5_600_000; // ~4MB em base64
export function docValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_DOC_CHARS && /^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/.test(v);
}

export type StatusCred = "pendente" | "verificado" | "rejeitado";
export const isStatus = (v: unknown): v is StatusCred => v === "pendente" || v === "verificado" || v === "rejeitado";

/** Visão pública (perfil) — nunca o documento. */
export function viewPublica<T extends { id: string; nivel: string; area: string | null; instituicao: string | null; metodo: string; status: string; verifiedAt: Date | null; createdAt: Date }>(c: T) {
  return { id: c.id, nivel: c.nivel, area: c.area, instituicao: c.instituicao, metodo: c.metodo, status: c.status, verifiedAt: c.verifiedAt ? new Date(c.verifiedAt).toISOString() : null, createdAt: new Date(c.createdAt).toISOString() };
}
