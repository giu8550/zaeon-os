/**
 * lib/avatars/presenca.ts — a PRESENÇA de cada agente: um estado só, compartilhado por todos os
 * rostos dele na tela (aba do chat, boas-vindas, pílula da resposta…). É isso que faz o usuário
 * entender que o avatar É o chat: onde quer que a Aura apareça, ela está fazendo a mesma coisa
 * que a conversa — ouvindo enquanto ele digita, pensando, falando no stream, sorrindo ao concluir.
 *
 * Store mínimo (sem React aqui): o chat PUBLICA (`definirPresenca`), os rostos LEEM
 * (components/agents/avatar/hooks → usePresenca). Gancho do MODO VOZ: `boca` (0..1) — o TTS
 * publica o nível do áudio e a boca segue a voz em vez das sílabas sorteadas.
 */
import type { SinalAvatar } from "./estados";

export type Presenca = {
  sinal: SinalAvatar;
  /** Nível da boca vindo do áudio (modo voz); null = boca por sílabas sorteadas. */
  boca: number | null;
};

const PADRAO: Presenca = { sinal: "idle", boca: null };
const estados = new Map<string, Presenca>();
const ouvintes = new Map<string, Set<() => void>>();

export function lerPresenca(agentId: string): Presenca {
  return estados.get(agentId) ?? PADRAO;
}

export function definirPresenca(agentId: string, parcial: Partial<Presenca>): void {
  const atual = lerPresenca(agentId);
  const prox = { ...atual, ...parcial };
  if (prox.sinal === atual.sinal && prox.boca === atual.boca) return;
  estados.set(agentId, prox);
  ouvintes.get(agentId)?.forEach((f) => f());
}

export function assinarPresenca(agentId: string, f: () => void): () => void {
  let s = ouvintes.get(agentId);
  if (!s) ouvintes.set(agentId, (s = new Set()));
  s.add(f);
  return () => { s!.delete(f); };
}

/** O que o chat sabe → sinal do rosto. `digitando` = o usuário tem texto no composer. */
export function sinalDoChat(o: { pensando: boolean; falando: boolean; digitando: boolean; erro?: boolean }): SinalAvatar {
  if (o.erro) return "erro";
  if (o.pensando) return "pensando";
  if (o.falando) return "falando";
  if (o.digitando) return "ouvindo";
  return "idle";
}
