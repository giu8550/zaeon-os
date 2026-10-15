/**
 * lib/canal/seletor.ts — regras do SELETOR de escritórios (PURO): quem pode apagar e qual canal
 * fica ativo depois de apagar. A rota `DELETE /api/canal/[id]` já existe (só o dono apaga); aqui
 * está só o que a tela decide.
 */
export type CanalDoSeletor = { id: string; titulo: string; souDono: boolean };

/** Só o dono vê o botão de apagar (a rota também recusa não-dono com 403). */
export const podeApagar = (c: Pick<CanalDoSeletor, "souDono">): boolean => c.souDono === true;

/** Texto do confirm — apagar é destrutivo (mensagens somem junto). */
export function textoConfirmarApagar(titulo: string): string {
  const nome = (titulo || "").trim() || "sem nome";
  return `Apagar o escritório “${nome}” e todas as mensagens dele? Não dá pra desfazer.`;
}

export type AposApagar<T extends CanalDoSeletor> = {
  restantes: T[];
  /** canal que deve ficar aberto; null = não sobrou nenhum (a tela cria o primeiro de novo). */
  proximoAtivo: string | null;
  /** o canal ativo era o apagado? (a tela precisa trocar o detalhe e o "último aberto"). */
  eraAtivo: boolean;
};

/**
 * Tira o canal apagado da lista. Se ele era o ativo, abre o primeiro que sobrou (a lista vem
 * ordenada do mais recente); se não era, o ativo continua o mesmo.
 */
export function aposApagar<T extends CanalDoSeletor>(canais: T[], apagadoId: string, ativoId: string | null): AposApagar<T> {
  const restantes = canais.filter((c) => c.id !== apagadoId);
  const eraAtivo = ativoId === apagadoId;
  if (!eraAtivo) {
    const aindaExiste = ativoId !== null && restantes.some((c) => c.id === ativoId);
    return { restantes, proximoAtivo: aindaExiste ? ativoId : (restantes[0]?.id ?? null), eraAtivo };
  }
  return { restantes, proximoAtivo: restantes[0]?.id ?? null, eraAtivo };
}
