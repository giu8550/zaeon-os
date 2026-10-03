/**
 * lib/map/validacao.ts — percurso, validação & atestado (HANDOFF_CEREBRO_AURA §5, §8).
 *
 *  - aplicarNo: o aluno marca "apliquei" com evidência → nó `aplicado`. Modo HUMANA → abre uma
 *    MapaValidacao pendente pro professor/instituição vinculado (TeacherStudent). Outros modos →
 *    o gate é automático: paga AURA node_applied (pesada pelo arquétipo).
 *  - decidirValidacao: o validador aprova (nó `validado` + AURA node_validated + atestado Solana —
 *    SÓ em humana) ou rejeita (nó volta a `aprendido`). Nunca o próprio (403). Mint falha →
 *    validação segue, credencial fica `error`, reconciliável.
 *  - cérebro completo: todo o backbone no gate → brain_completed (1× por mapa).
 * Lógica pura separada do banco (tudo injetável; testável sem Mongo).
 */
import { ARQUETIPOS } from "@/lib/map/arquetipo";
import { completudes, estadoGate } from "@/lib/map/backbone";
import { setEstado } from "@/lib/map/grafo";
import type { EstadoNo, MapaNo, MapaView } from "@/lib/map/tipos";
import { auraDoNo, daAtestado } from "@/lib/aura/rules";
import { ORDEM_ESTADO } from "@/lib/map/tipos";

export type StatusValidacao = "pendente" | "aprovada" | "rejeitada";
export const isStatusValidacao = (v: unknown): v is StatusValidacao => v === "pendente" || v === "aprovada" || v === "rejeitada";

// ───────────────────────────── puro ─────────────────────────────

/** Resultado da aplicação sobre o mapa (sem banco). */
export function aplicarPuro(mapa: Pick<MapaView, "nos" | "backbone" | "modoValidacao">, noId: string):
  { ok: true; nos: MapaNo[]; abreValidacao: boolean; jaAplicado: boolean } | { ok: false; motivo: "no_inexistente" | "ja_validado" } {
  const no = mapa.nos.find((n) => n.id === noId);
  if (!no) return { ok: false, motivo: "no_inexistente" };
  if (no.estado === "validado") return { ok: false, motivo: "ja_validado" };
  const jaAplicado = no.estado === "aplicado";
  const nos = setEstado(mapa.nos, noId, "aplicado") ?? mapa.nos;
  return { ok: true, nos, abreValidacao: mapa.modoValidacao === "humana", jaAplicado };
}

/** Decisão do validador sobre o nó (sem banco). Rejeitar FORÇA a volta pra aprendido. */
export function decidirPuro(nos: MapaNo[], noId: string, status: Exclude<StatusValidacao, "pendente">): { nos: MapaNo[]; estado: EstadoNo } | null {
  const no = nos.find((n) => n.id === noId);
  if (!no) return null;
  const estado: EstadoNo = status === "aprovada" ? "validado" : "aprendido";
  const out = setEstado(nos, noId, estado, status === "rejeitada");
  return { nos: out ?? nos, estado };
}

/** Todo o backbone passou pelo gate do arquétipo? (false sem backbone — nada a concluir.) */
export function cerebroCompleto(m: Pick<MapaView, "nos" | "backbone" | "modoValidacao">): boolean {
  if (!m.backbone.length) return false;
  const gate = estadoGate(m.modoValidacao);
  const porId = new Map(m.nos.map((n) => [n.id, n]));
  return m.backbone.every((id) => { const n = porId.get(id); return !!n && ORDEM_ESTADO[n.estado] >= ORDEM_ESTADO[gate]; });
}

/** Quem pode validar: professor vinculado ao aluno (habilitado) ou instituição; nunca o próprio. */
export function podeValidar(v: { id: string; role: string | null | undefined; verificadorHabilitado: boolean; temCredencialVerificada: boolean }, alunoId: string, vinculado: boolean):
  { ok: true; papel: "teacher" | "instituicao" } | { ok: false; motivo: "conflito" | "papel" | "nao_habilitado" | "sem_vinculo" } {
  if (v.id === alunoId) return { ok: false, motivo: "conflito" };
  const role = (v.role ?? "").toLowerCase();
  if (role === "instituicao" || role === "institution") return vinculado ? { ok: true, papel: "instituicao" } : { ok: false, motivo: "sem_vinculo" };
  if (role === "teacher" || role === "professor") {
    if (!(v.verificadorHabilitado || v.temCredencialVerificada)) return { ok: false, motivo: "nao_habilitado" };
    return vinculado ? { ok: true, papel: "teacher" } : { ok: false, motivo: "sem_vinculo" };
  }
  return { ok: false, motivo: "papel" };
}

// ───────────────────────────── com banco (injetável) ─────────────────────────────

export type ValidacaoRow = { id: string; mapaId: string; noId: string; alunoId: string; validadorId: string; role: string; evidencia: string | null; status: string; comentario: string | null; credentialId: string | null; createdAt: Date };

export type ValidacaoDeps = {
  /** Reaplica uma transformação pura sobre o mapa relido (controle otimista). */
  patchMapa: (id: string, fn: (atual: MapaView) => Partial<MapaView> | null) => Promise<{ ok: true; mapa: MapaView } | { ok: false; reason: string }>;
  grantAura: (i: { userId: string; source: "node_learned" | "node_applied" | "node_validated" | "brain_completed"; refId: string; amount: number; reason?: string }) => Promise<unknown>;
  /** Atestado on-chain (padrão server-side; best-effort). Devolve o id da Credential ou null. */
  issueCredential?: (userId: string, i: { type: "skill"; refId: string; title: string; metadata?: Record<string, unknown>; standard?: "token2022-nt" }) => Promise<{ id: string } | null>;
  validacoes: {
    upsertPendente: (i: { mapaId: string; noId: string; alunoId: string; validadorId: string; role: string; evidencia: string | null }) => Promise<ValidacaoRow>;
    update: (id: string, data: { status: StatusValidacao; comentario?: string | null; credentialId?: string | null }) => Promise<ValidacaoRow>;
  };
  /** Professores vinculados ao aluno (TeacherStudent.teacherId). */
  professoresDe: (alunoId: string) => Promise<string[]>;
  auraLigada: () => boolean;
};

/** Paga as transições pesadas pelo arquétipo (no-op com AURA_ECONOMY off). Idempotente no ledger. */
async function pagar(deps: ValidacaoDeps, mapa: MapaView, userId: string, source: "node_learned" | "node_applied" | "node_validated" | "brain_completed", refId: string, reason: string) {
  if (!deps.auraLigada()) return;
  await deps.grantAura({ userId, source, refId, amount: auraDoNo(source, mapa.tipoTopico, mapa.modoValidacao), reason }).catch(() => undefined);
}

/** Após uma transição: se o cérebro fechou, bônus 1× por mapa. */
async function conferirCompleto(deps: ValidacaoDeps, mapa: MapaView) {
  if (cerebroCompleto(mapa)) await pagar(deps, mapa, mapa.ownerId, "brain_completed", mapa.id, `Cérebro completo: ${mapa.titulo}`);
}

export type AplicarResultado =
  | { ok: true; mapa: MapaView; validacao: ValidacaoRow | null; estado: "aplicado" }
  | { ok: false; motivo: "no_inexistente" | "ja_validado" | "sem_professor" | "conflito" | "not_found" };

/** O aluno aplica um nó (dono do mapa). `validadorId` opcional escolhe entre os professores vinculados. */
export async function aplicarNo(deps: ValidacaoDeps, mapaAtual: MapaView, noId: string, evidencia: string | null, validadorPedido?: string | null): Promise<AplicarResultado> {
  const pre = aplicarPuro(mapaAtual, noId);
  if (!pre.ok) return { ok: false, motivo: pre.motivo };
  let validadorId: string | null = null, role = "teacher";
  if (pre.abreValidacao) {
    const profs = await deps.professoresDe(mapaAtual.ownerId);
    validadorId = validadorPedido && profs.includes(validadorPedido) ? validadorPedido : profs[0] ?? null;
    if (!validadorId) return { ok: false, motivo: "sem_professor" };
  }
  const r = await deps.patchMapa(mapaAtual.id, (atual) => {
    const p = aplicarPuro(atual, noId);
    if (!p.ok) return null;
    const c = completudes({ nos: p.nos, backbone: atual.backbone, modoValidacao: atual.modoValidacao });
    return { nos: p.nos, completudeAprendizado: c.aprendizado, completudeConclusao: c.conclusao };
  });
  if (!r.ok) return { ok: false, motivo: r.reason === "not_found" ? "not_found" : "conflito" };
  const no = r.mapa.nos.find((n) => n.id === noId)!;
  let validacao: ValidacaoRow | null = null;
  if (validadorId) {
    validacao = await deps.validacoes.upsertPendente({ mapaId: r.mapa.id, noId, alunoId: r.mapa.ownerId, validadorId, role, evidencia });
  } else if (!pre.jaAplicado) {
    // Gate automático (rubrica/quiz/peer/cobertura): a aplicação já conta — AURA pesada pelo arquétipo.
    await pagar(deps, r.mapa, r.mapa.ownerId, "node_applied", `${r.mapa.id}:${noId}`, `Aplicado: ${no.label}`);
    await conferirCompleto(deps, r.mapa);
  }
  return { ok: true, mapa: r.mapa, validacao, estado: "aplicado" };
}

export type DecidirResultado =
  | { ok: true; mapa: MapaView; validacao: ValidacaoRow; estado: EstadoNo; credentialId: string | null }
  | { ok: false; motivo: "ja_decidida" | "no_inexistente" | "conflito" | "not_found" };

/** O validador decide. `v` já passou por `podeValidar` (a rota garante). */
export async function decidirValidacao(deps: ValidacaoDeps, v: ValidacaoRow, mapaAtual: MapaView, status: Exclude<StatusValidacao, "pendente">, comentario: string | null): Promise<DecidirResultado> {
  if (v.status !== "pendente") return { ok: false, motivo: "ja_decidida" };
  if (!mapaAtual.nos.some((n) => n.id === v.noId)) return { ok: false, motivo: "no_inexistente" };
  const r = await deps.patchMapa(mapaAtual.id, (atual) => {
    const d = decidirPuro(atual.nos, v.noId, status);
    if (!d) return null;
    const c = completudes({ nos: d.nos, backbone: atual.backbone, modoValidacao: atual.modoValidacao });
    return { nos: d.nos, completudeAprendizado: c.aprendizado, completudeConclusao: c.conclusao };
  });
  if (!r.ok) return { ok: false, motivo: r.reason === "not_found" ? "not_found" : "conflito" };
  const no = r.mapa.nos.find((n) => n.id === v.noId)!;
  let credentialId: string | null = null;
  if (status === "aprovada") {
    await pagar(deps, r.mapa, v.alunoId, "node_validated", `${r.mapa.id}:${v.noId}`, `Validação: ${no.label} — ${ARQUETIPOS[r.mapa.tipoTopico].rotulo}`);
    // Atestado on-chain SÓ com validação humana (§8). Best-effort: mint falha → validação segue.
    if (daAtestado(r.mapa.modoValidacao) && deps.issueCredential) {
      credentialId = await deps.issueCredential(v.alunoId, {
        type: "skill", refId: `${r.mapa.id}:${v.noId}`, title: `${no.label} — ${r.mapa.titulo}`, standard: "token2022-nt",
        metadata: { source: "cerebro", mapaId: r.mapa.id, noId: v.noId, validadorId: v.validadorId, role: v.role, tipoTopico: r.mapa.tipoTopico },
      }).then((c) => c?.id ?? null).catch(() => null);
    }
    await conferirCompleto(deps, r.mapa);
  }
  const atualizada = await deps.validacoes.update(v.id, { status, comentario, credentialId });
  return { ok: true, mapa: r.mapa, validacao: atualizada, estado: no.estado, credentialId };
}

/** Nós do plano realizados por um turno (planejado → aprendido): paga node_learned pesado (cap diário no ledger). */
export async function pagarRealizados(deps: Pick<ValidacaoDeps, "grantAura" | "auraLigada">, mapa: MapaView, realizados: string[]): Promise<void> {
  if (!deps.auraLigada() || !realizados.length) return;
  for (const id of realizados) {
    const no = mapa.nos.find((n) => n.id === id);
    if (!no) continue;
    await deps.grantAura({ userId: mapa.ownerId, source: "node_learned", refId: `${mapa.id}:${id}`, amount: auraDoNo("node_learned", mapa.tipoTopico, mapa.modoValidacao), reason: `Aprendido: ${no.label}` }).catch(() => undefined);
  }
}
