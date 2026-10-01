/**
 * Autorização da cartolina — PURA (sem Prisma), pra ser testada exaustivamente.
 *
 * O papel é DERIVADO: dono = ownerId; o resto vem da linha de CartolinaMembro. Quem não é
 * nem um nem outro tem papel `null` — e `null` não lê nem escreve. Toda rota passa por
 * aqui; não existe caminho que decida acesso olhando só o id do board.
 */
export type Papel = "dono" | "editor" | "leitor";

export const PAPEIS_CONVIDAVEIS = ["editor", "leitor"] as const;
export type PapelConvidavel = (typeof PAPEIS_CONVIDAVEIS)[number];
export const isPapelConvidavel = (v: unknown): v is PapelConvidavel =>
  typeof v === "string" && (PAPEIS_CONVIDAVEIS as readonly string[]).includes(v);

export function papelDe(ownerId: string, userId: string, papelMembro?: string | null): Papel | null {
  if (!userId) return null;
  if (ownerId === userId) return "dono";
  return isPapelConvidavel(papelMembro) ? papelMembro : null; // valor estranho no banco = sem acesso
}

export const podeLer = (p: Papel | null): boolean => p !== null;
export const podeEscrever = (p: Papel | null): boolean => p === "dono" || p === "editor";
/** Convidar/remover gente e apagar o board: só o dono. */
export const podeAdministrar = (p: Papel | null): boolean => p === "dono";
