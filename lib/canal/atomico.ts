/**
 * lib/canal/atomico.ts — gravar as listas do canal (membros, agentes) SEM apagar o que outra pessoa gravou ao
 * mesmo tempo (#443).
 *
 * Antes, as rotas liam a lista, mexiam e regravavam ela INTEIRA. Duas pessoas entrando no mesmo instante num
 * escritório aberto (ou um clique duplo em "Entrar"): as duas liam [A], uma gravava [A, B], a outra [A, C] — e o B
 * ficava de fora; ou as duas anunciavam "entrou". Agora:
 *   - entrar como membro = UM comando no banco: "põe o id na lista, SE ainda não estiver" (push com condição).
 *     Quem chega segundo vê count 0: já estava — não duplica e não anuncia de novo;
 *   - trocas que não são só "acrescentar" (tirar agente dispensada, conversa de dois virando grupo) gravam só SE a
 *     lista ainda for a que foi lida; se mudou no meio, lê de novo e tenta outra vez.
 * O `db` é injetado (o prisma de verdade nas rotas; um banco de mentira nos testes).
 */
import { agentesDepois } from "./dispensa";
import { entrarNaConversa } from "./convite";

type Lista = string[];
type CanalLista = { id: string; membros: Lista; agentes: Lista; dmCom?: string | null; ownerId: string };

export type DbAtomico = {
  canal: {
    findUnique(a: { where: { id: string } }): Promise<CanalLista | null>;
    updateMany(a: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
};

/** Quantas vezes tenta de novo quando a lista mudou no meio (conflito de verdade é raro; isso é folga). */
export const TENTATIVAS = 5;

/**
 * Lê → calcula → grava SE a lista ainda for a lida. `calcular` devolve null quando não há o que mudar.
 * Devolve o valor gravado (ou o atual, se não precisou mudar), ou null se o canal sumiu / não conseguiu.
 */
export async function trocarComTentativas<T extends object>(
  ler: () => Promise<T | null>,
  calcular: (atual: T) => Partial<T> | null,
  gravarSe: (atual: T, novo: Partial<T>) => Promise<number>,
  tentativas = TENTATIVAS,
): Promise<{ antes: T; depois: T; mudou: boolean } | null> {
  for (let i = 0; i < tentativas; i++) {
    const atual = await ler();
    if (!atual) return null;
    const novo = calcular(atual);
    if (!novo) return { antes: atual, depois: atual, mudou: false };
    if ((await gravarSe(atual, novo)) > 0) return { antes: atual, depois: { ...atual, ...novo }, mudou: true };
  }
  return null;
}

/** Entra como membro: põe o id SE ainda não estiver. "ja-estava" = outra entrada (ou o clique duplo) chegou antes. */
export async function entrarComoMembro(db: DbAtomico, canalId: string, userId: string): Promise<"entrou" | "ja-estava"> {
  const { count } = await db.canal.updateMany({
    where: { id: canalId, NOT: { membros: { has: userId } } },
    data: { membros: { push: userId } },
  });
  return count > 0 ? "entrou" : "ja-estava";
}

/** A barra de agentes (canal.agentes) depois da mensagem: chamados entram, dispensados saem — sem perder o dos outros. */
export async function atualizarAgentes(db: DbAtomico, canalId: string, chamados: readonly string[], dispensados: readonly string[]): Promise<string[] | null> {
  const r = await trocarComTentativas<CanalLista>(
    () => db.canal.findUnique({ where: { id: canalId } }),
    (c) => {
      const novo = agentesDepois(c.agentes ?? [], chamados, dispensados);
      const igual = novo.length === (c.agentes ?? []).length && novo.every((k, i) => k === c.agentes[i]);
      return igual ? null : { agentes: novo };
    },
    async (c, novo) => (await db.canal.updateMany({ where: { id: canalId, agentes: { equals: c.agentes ?? [] } }, data: { ...novo, updatedAt: new Date() } })).count,
  );
  return r ? r.depois.agentes : null;
}

/**
 * Aceitou o convite PARA UMA CONVERSA: a pessoa entra (e a conversa de dois vira grupo privado) — sem apagar quem
 * entrou ao mesmo tempo. "ja-estava" = já fazia parte (não anuncia de novo).
 */
export async function entrarNaConversaAtomico(db: DbAtomico, canalId: string, userId: string): Promise<{ resultado: "entrou" | "ja-estava"; canal: CanalLista } | null> {
  let jaEstava = false;
  const r = await trocarComTentativas<CanalLista>(
    () => db.canal.findUnique({ where: { id: canalId } }),
    (c) => {
      jaEstava = c.ownerId === userId || (c.membros ?? []).includes(userId) || c.dmCom === userId;
      return jaEstava ? null : entrarNaConversa(c, userId);
    },
    async (c, novo) => (await db.canal.updateMany({
      where: { id: canalId, membros: { equals: c.membros ?? [] }, ...(c.dmCom ? { dmCom: c.dmCom } : {}) },
      data: novo as Record<string, unknown>,
    })).count,
  );
  if (!r) return null;
  return { resultado: jaEstava ? "ja-estava" : "entrou", canal: r.depois };
}
