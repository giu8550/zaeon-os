/**
 * lib/canal/perfil.ts — a pessoa vista de dentro do escritório (#425, #427). PURO.
 *
 * Clicar na foto da barra abre um menu: "Ver perfil" (a página de perfil dela — lib/perfil/visitante),
 * "Conversar"/"Convidar pra conversar" e, só pro dono, "Remover do escritório".
 */

/** Quem faz parte do canal: o dono, os membros e o outro lado de uma conversa privada. */
export function estaNoCanal(c: { ownerId: string; membros?: string[] | null; dmCom?: string | null }, userId: string): boolean {
  return c.ownerId === userId || (c.membros ?? []).includes(userId) || c.dmCom === userId;
}

/**
 * "Remover do escritório" aparece? Só pro DONO, só em quem é MEMBRO, nunca na própria foto nem na do dono, e
 * nunca numa conversa privada de dois (ali não há a quem remover — sair é apagar a conversa).
 */
export function podeRemover(e: { meuId: string | null; donoId: string; alvoId: string; conversaDeDois: boolean; membros: readonly string[] }): boolean {
  if (!e.meuId || e.meuId !== e.donoId) return false;
  if (e.conversaDeDois) return false;
  if (e.alvoId === e.meuId || e.alvoId === e.donoId) return false;
  return e.membros.includes(e.alvoId); // só quem o dono colocou (num escritório aberto, visitante não é membro)
}

export const textoConfirmarRemover = (nome: string) =>
  `Remover ${nome || "esta pessoa"} do escritório? Ela perde o acesso às mensagens na hora.`;
