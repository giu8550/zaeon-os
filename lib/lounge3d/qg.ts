/**
 * lib/lounge3d/qg.ts — quem é o dono do QG (o marco andável do cyberespaço): o ANDREI BACELAR. A base dele fica no
 * centro do salão do QG e ele nasce lá. Decidido no SERVIDOR (o cliente só pinta): por e-mail, via
 * `CYBER_QG_EMAILS` (lista separada por vírgula — o jeito firme), ou, sem a env, pelo nome exato "Andrei Bacelar"
 * (sem acento/maiúscula). Não é privilégio: só define ONDE fica a base dele.
 */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

export const NOME_DONO_QG = "andrei bacelar";

export function ehDonoDoQG(u: { email?: string | null; name?: string | null }, envEmails: string | undefined = process.env.CYBER_QG_EMAILS): boolean {
  const lista = (envEmails ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (lista.length) return !!u.email && lista.includes(u.email.trim().toLowerCase());
  return !!u.name && normalizar(u.name) === NOME_DONO_QG;
}
