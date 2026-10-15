/**
 * lib/canal/topoPessoas.ts — QUEM aparece no topo do escritório (PURO).
 *
 * No topo ficam as pessoas reais do canal (dono, membros e você); os agentes ficam embaixo.
 * Anel verde = está online agora; cinza = é do canal mas está fora. Quem está online sem ser
 * membro (canal "aberto") também aparece, depois dos membros.
 */
export type PessoaTopo = { id: string; nome: string; avatar: string | null };

/** Quantas pessoas cabem no topo; o resto vira "+N". */
export const MAX_NO_TOPO = 6;

export type EntradaTopo = {
  /** pessoas conhecidas do canal (dono, membros, autores das mensagens). */
  pessoas: PessoaTopo[];
  /** quem está na presença do canal agora. */
  online: PessoaTopo[];
  donoId: string;
  meuId: string;
  membros: string[];
};

export type SaidaTopo = {
  /** as que cabem no topo, na ordem: dono, membros/você, visitantes online. */
  visiveis: PessoaTopo[];
  /** quantas ficaram de fora (o "+N"). */
  extras: number;
  /** total de pessoas no topo (visíveis + extras). */
  total: number;
  onlineIds: Set<string>;
};

export function montarTopoPessoas(e: EntradaTopo): SaidaTopo {
  const onlineIds = new Set(e.online.map((p) => p.id));
  const vistos = new Set<string>();
  const lista: PessoaTopo[] = [];
  const add = (p: PessoaTopo) => { if (!vistos.has(p.id)) { vistos.add(p.id); lista.push(p); } };

  // dono primeiro, depois quem é do canal (membros e você), na ordem em que vieram
  const doCanal = e.pessoas.filter((p) => p.id === e.donoId || p.id === e.meuId || e.membros.includes(p.id));
  const dono = doCanal.find((p) => p.id === e.donoId);
  if (dono) add(dono);
  for (const p of doCanal) add(p);
  // online sem ser do canal (visitante de canal aberto)
  for (const p of e.online) add(p);

  return {
    visiveis: lista.slice(0, MAX_NO_TOPO),
    extras: Math.max(0, lista.length - MAX_NO_TOPO),
    total: lista.length,
    onlineIds,
  };
}
