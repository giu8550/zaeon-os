/**
 * lib/lounge3d/qg.ts — quem é o dono do QG (o marco andável do cyberespaço): o ANDREI BACELAR. A base dele fica no
 * centro do salão do QG e ele nasce lá. Decidido no SERVIDOR (o cliente só pinta): por e-mail, via
 * `CYBER_QG_EMAILS` (lista separada por vírgula — o jeito firme), ou, sem a env, pelo nome: "Andrei" (ou "Andrey") +
 * "Bacelar" em qualquer posição (sem acento/maiúscula; nome do meio ou sobrenome extra não atrapalham). Não é
 * privilégio: só define ONDE fica a base dele.
 */
const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");


export function ehDonoDoQG(u: { email?: string | null; name?: string | null }, envEmails: string | undefined = process.env.CYBER_QG_EMAILS): boolean {
  const lista = (envEmails ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (lista.length) return !!u.email && lista.includes(u.email.trim().toLowerCase());
  if (!u.name) return false;
  const partes = normalizar(u.name).split(" ");
  return partes.includes("bacelar") && (partes.includes("andrei") || partes.includes("andrey"));
}
