/**
 * O CORPO PRÓPRIO de cada usuário (e quem é da tripulação da nave) no cyberespaço (um VRM feito sob medida — lib/cyber/estiloAvatar CORPOS_DE_JOGADOR),
 * decidido no SERVIDOR pelo id da conta (como o `fundador`): o cliente só recebe o id do corpo e o pinta. Por id e
 * não por e-mail: nada de dado pessoal no código.
 */
import { ehAdminDoMapa } from "@/lib/cyber/adminMapa";

export const CORPO_POR_USUARIO: Readonly<Record<string, string>> = {
  "6aca9995a2cd0932105a06a8": "giulia",
};
export const corpoDoUsuario = (userId: string): string | undefined => CORPO_POR_USUARIO[userId];

/** quem PILOTA a nave-QG (e se teleporta pra dentro dela com o M — components/cyber/PortalViagem): SÓ o dono
 *  (pedido dele, out/2026: a tripulação acabou — "só eu"). Pelo e-mail, decidido no servidor */
export const pilotaANave = (email: string | null | undefined): boolean => ehAdminDoMapa(email);
