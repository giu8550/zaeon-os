/**
 * lib/perfil/visitante.ts — o perfil de OUTRA pessoa, visto por quem divide um escritório com ela (#427). PURO.
 *
 * É a mesma página do perfil (foto, nome, curso, nível, habilidades, personagem, AURA, títulos, atestados,
 * mural), só leitura, com UMA parte privada: os CÉREBROS (pedido do Martinez). Pra eles não vazarem por outro
 * lugar, também ficam de fora:
 *   - o contador "cérebros completos";
 *   - as linhas do extrato "Recentes" que vêm dos cérebros ("Aprendido: <passo do cérebro>" etc.);
 *   - a LISTA de validações de estudo (cada item é um passo do cérebro de OUTRO aluno) — só o número aparece.
 * A fila de verificação (documentos de terceiros) também não aparece.
 */

/** Origens de AURA que nascem dos cérebros — as linhas delas citam passos do cérebro. */
export const FONTES_DE_CEREBRO: readonly string[] = ["node_learned", "node_applied", "node_validated", "brain_completed"];

export const ehDeCerebro = (source: string): boolean => FONTES_DE_CEREBRO.includes(source);

/** O extrato "Recentes" pra quem visita: sem as linhas dos cérebros, no máximo `max`. */
export function recentesSemCerebro<T extends { source: string }>(eventos: readonly T[], max = 10): T[] {
  return eventos.filter((e) => !ehDeCerebro(e.source)).slice(0, max);
}

type CanalLike = { ownerId: string; membros?: string[] | null; dmCom?: string | null };
const noCanal = (c: CanalLike, id: string) => c.ownerId === id || (c.membros ?? []).includes(id) || c.dmCom === id;

/**
 * Quem pode ver o perfil: a própria pessoa, ou quem divide algum escritório (canal) com ela. `canais` são os
 * canais de quem VISITA. Não serve pra espiar o perfil de qualquer um pelo id.
 */
export function podeVerPerfil(canaisDoVisitante: readonly CanalLike[], visitanteId: string, alvoId: string): boolean {
  if (visitanteId === alvoId) return true;
  return canaisDoVisitante.some((c) => noCanal(c, visitanteId) && noCanal(c, alvoId));
}

/** Campos do usuário que a rota lê do banco (o e-mail e o papel só pra saber se é o fundador — não saem). */
export const CAMPOS_USUARIO_VISITANTE = {
  id: true, name: true, course: true, image: true, academicLevel: true, eduVerified: true, plan: true, referredBy: true, email: true, role: true,
} as const;

/** As chaves que a resposta pode ter. Um teste garante que nada além disso (cérebros!) sai. */
export const CHAVES_PERFIL = ["pessoa", "aura", "validacoesPendentes"] as const;
export const CHAVES_AURA = ["aura", "level", "titulo", "prox", "min", "proxMin", "validatedSkills", "academicLevel", "academicas", "parede", "recent"] as const;
