/**
 * lib/canal/sino.ts — o SINO de notificações do escritório (#423). PURO.
 *
 * Por enquanto só convites. O sino mostra:
 *   - convites RECEBIDOS pendentes (com Aceitar / Recusar) — primeiro, são os que pedem ação;
 *   - convites que você ENVIOU e ainda esperam resposta ("pendente");
 *   - o histórico do que já foi respondido, nas duas direções ("Martinez aceitou seu convite").
 * A bolinha conta: convites recebidos pendentes + respostas novas aos convites que você enviou
 * (as que chegaram depois da última vez que você abriu o sino).
 */
export type PessoaSino = { id: string; nome: string; avatar: string | null };
export type ConviteSino = { id: string; status: string; pessoa: PessoaSino; criadoEm?: string | Date | null };
export type HistoricoSino = ConviteSino & { direcao: "enviado" | "recebido"; respondidoEm?: string | Date | null };

export type ItemSino = {
  id: string;
  tipo: "recebido" | "enviado";
  status: "pendente" | "aceito" | "recusado";
  pessoa: PessoaSino;
  /** frase pronta pra tela. */
  texto: string;
  /** pede ação (Aceitar / Recusar)? */
  acao: boolean;
};

const statusDe = (s: string): ItemSino["status"] => (s === "aceito" || s === "recusado" ? s : "pendente");

/** A frase de cada aviso, do ponto de vista de quem está olhando o sino. */
export function textoDoAviso(tipo: ItemSino["tipo"], status: ItemSino["status"], nome: string): string {
  const n = nome || "Alguém";
  if (tipo === "recebido") {
    if (status === "pendente") return `${n} quer conversar com você`;
    if (status === "aceito") return `Você aceitou o convite de ${n}`;
    return `Você recusou o convite de ${n}`;
  }
  if (status === "pendente") return `Convite para ${n}: pendente`;
  if (status === "aceito") return `${n} aceitou seu convite`;
  return `${n} recusou seu convite`;
}

/** Monta a lista do sino: recebidos pendentes → enviados pendentes → histórico (como veio, do mais recente). */
export function montarSino(d: { recebidos: ConviteSino[]; enviados: ConviteSino[]; historico: HistoricoSino[] }): ItemSino[] {
  const item = (c: ConviteSino, tipo: ItemSino["tipo"]): ItemSino => {
    const status = statusDe(c.status);
    return { id: c.id, tipo, status, pessoa: c.pessoa, texto: textoDoAviso(tipo, status, c.pessoa?.nome), acao: tipo === "recebido" && status === "pendente" };
  };
  const vistos = new Set<string>();
  const out: ItemSino[] = [];
  for (const it of [
    ...d.recebidos.map((c) => item(c, "recebido")),
    ...d.enviados.map((c) => item(c, "enviado")),
    ...d.historico.map((h) => item(h, h.direcao)),
  ]) {
    if (vistos.has(it.id)) continue; // o mesmo convite nunca aparece duas vezes
    vistos.add(it.id);
    out.push(it);
  }
  return out;
}

/**
 * Número da bolinha: recebidos pendentes + respostas aos SEUS convites que chegaram depois de `vistoEm`
 * (a última vez que você abriu o sino). Sem `vistoEm` (nunca abriu), as respostas não contam — evita
 * acender o sino com histórico antigo na primeira vez.
 */
export function contadorDoSino(d: { recebidos: ConviteSino[]; historico: HistoricoSino[] }, vistoEm: number | null): number {
  const novasRespostas = vistoEm == null
    ? 0
    : d.historico.filter((h) => h.direcao === "enviado" && h.respondidoEm && +new Date(h.respondidoEm) > vistoEm).length;
  return d.recebidos.length + novasRespostas;
}

/** Onde o navegador lembra quando o sino foi aberto pela última vez (por pessoa). */
export const chaveVistoSino = (userId: string) => `zaeon.escritorio.sino.visto.${userId}`;
