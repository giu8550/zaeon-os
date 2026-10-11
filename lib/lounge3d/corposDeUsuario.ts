/**
 * O CORPO PRÓPRIO de cada usuário no cyberespaço (um VRM feito sob medida — lib/cyber/estiloAvatar CORPOS_DE_JOGADOR),
 * decidido no SERVIDOR pelo id da conta (como o `fundador`): o cliente só recebe o id do corpo e o pinta. Por id e
 * não por e-mail: nada de dado pessoal no código.
 */
export const CORPO_POR_USUARIO: Readonly<Record<string, string>> = {
  "6aca9995a2cd0932105a06a8": "giulia",
};
export const corpoDoUsuario = (userId: string): string | undefined => CORPO_POR_USUARIO[userId];
