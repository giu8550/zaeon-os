/**
 * lib/canal/gate.ts — o AUTHOR GATE do canal (PURO). Padrão do Buzz: owner-only /
 * allowlist / anyone → aqui "privado" / "turma" / "aberto". Decide quem LÊ, quem ESCREVE
 * (= quem o agente atende) e quem GERE o canal. Toda rota de /api/canal passa por aqui.
 */
export type Acesso = "privado" | "turma" | "aberto";
export const ACESSOS: readonly Acesso[] = ["privado", "turma", "aberto"];

export function normalizarAcesso(v: unknown): Acesso {
  return ACESSOS.includes(v as Acesso) ? (v as Acesso) : "turma";
}

/** `dmCom` = conversa privada 1 a 1 (#396): o outro lado, que aceitou o convite. */
export type CanalGate = { ownerId: string; acesso: string; membros: string[]; dmCom?: string | null };

/**
 * Dono sempre pode; "turma" = dono + membros; "aberto" = qualquer logado; "privado" = só dono.
 * Conversa privada (dmCom): SÓ as duas pessoas — vale antes de qualquer acesso (nunca vira aberta).
 */
export function podeLer(canal: CanalGate, userId: string | null | undefined): boolean {
  if (!userId) return false;
  if (canal.ownerId === userId) return true;
  if (canal.dmCom) return canal.dmCom === userId;
  const acesso = normalizarAcesso(canal.acesso);
  if (acesso === "aberto") return true;
  if (acesso === "turma") return (canal.membros ?? []).includes(userId);
  return false;
}

/** Escrever (mandar mensagem / convocar agente) = mesma regra de ler. */
export const podeEscrever = podeLer;

/** Gerir (título, acesso, membros, agentes, cartolina) = só o dono. */
export function podeGerir(canal: Pick<CanalGate, "ownerId">, userId: string | null | undefined): boolean {
  return !!userId && canal.ownerId === userId;
}
