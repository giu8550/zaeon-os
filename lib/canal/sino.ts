/**
 * lib/canal/sino.ts — o SINO de notificações do escritório (#423). PURO.
 *
 * Por enquanto só convites. O sino mostra:
 *   - convites RECEBIDOS pendentes (com Aceitar / Recusar) — primeiro, são os que pedem ação;
 *   - convites que você ENVIOU e ainda esperam resposta ("pendente");
 *   - o histórico do que já foi respondido, nas duas direções ("Martinez aceitou seu convite").
 * A bolinha conta: convites recebidos pendentes + respostas novas aos convites que você enviou
 * (as que chegaram depois da última vez que você abriu o sino).
 * #425: cada aviso tem data/hora ("agora", "há 5 min", "ontem", "16/10"); o "visto" e o "Limpar" ficam no
 * BANCO (CanalSino, por pessoa) — valem em qualquer aparelho. Limpar só tira o que já foi respondido.
 */
export type PessoaSino = { id: string; nome: string; avatar: string | null };
export type ConviteSino = {
  id: string; status: string; pessoa: PessoaSino; criadoEm?: string | Date | null; dmCanalId?: string | null;
  /** #425: convite PARA uma conversa — o título dela (sem = convite de contato). */
  canalTitulo?: string | null;
};
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
  /** #425: quando aconteceu (ms) — o convite (pendente) ou a resposta (aceito/recusado). */
  em: number | null;
  /** #425: a conversa que o aceite abriu — clicar no aviso leva pra ela. Só nos aceitos. */
  canalId: string | null;
};

const statusDe = (s: string): ItemSino["status"] => (s === "aceito" || s === "recusado" ? s : "pendente");

const ms = (v: string | Date | null | undefined): number | null => {
  if (v == null) return null;
  const n = +new Date(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A frase de cada aviso, do ponto de vista de quem está olhando o sino. Com `titulo` (#425), o convite é pra
 * entrar numa conversa que já existe ("Martinez te convidou para “Projeto X”").
 */
export function textoDoAviso(tipo: ItemSino["tipo"], status: ItemSino["status"], nome: string, titulo?: string | null): string {
  const n = nome || "Alguém";
  if (titulo) {
    const t = `“${titulo}”`;
    if (tipo === "recebido") {
      if (status === "pendente") return `${n} te convidou para ${t}`;
      if (status === "aceito") return `Você entrou em ${t}`;
      return `Você recusou o convite para ${t}`;
    }
    if (status === "pendente") return `Convite para ${n} entrar em ${t}: pendente`;
    if (status === "aceito") return `${n} entrou em ${t}`;
    return `${n} recusou o convite para ${t}`;
  }
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
  const item = (c: ConviteSino | HistoricoSino, tipo: ItemSino["tipo"]): ItemSino => {
    const status = statusDe(c.status);
    const em = (status !== "pendente" && "respondidoEm" in c ? ms(c.respondidoEm) : null) ?? ms(c.criadoEm);
    return { id: c.id, tipo, status, pessoa: c.pessoa, texto: textoDoAviso(tipo, status, c.pessoa?.nome, c.canalTitulo), acao: tipo === "recebido" && status === "pendente", em, canalId: status === "aceito" ? c.dmCanalId ?? null : null };
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

/**
 * #425: a data/hora de cada aviso, no fuso de quem olha — "agora" (menos de 1 min), "há 5 min", "há 3 h"
 * (ainda hoje), "ontem", "16/10" (este ano) ou "16/10/25" (outro ano). Data no futuro (relógio adiantado) = "agora".
 */
export function tempoRelativo(em: number, agora: number): string {
  const dif = agora - em;
  if (dif < 60_000) return "agora";
  if (dif < 3_600_000) return `há ${Math.floor(dif / 60_000)} min`;
  const d = new Date(em), hoje = new Date(agora);
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((meiaNoite(hoje) - meiaNoite(d)) / 86_400_000);
  if (dias <= 0) return `há ${Math.floor(dif / 3_600_000)} h`;
  if (dias === 1) return "ontem";
  const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0");
  return d.getFullYear() === hoje.getFullYear() ? `${dd}/${mm}` : `${dd}/${mm}/${String(d.getFullYear()).slice(-2)}`;
}

/**
 * #425: o "Limpar" do sino. Some do histórico o que foi respondido ATÉ `limpoAte`; o que chegar depois volta a
 * aparecer. Pendentes nunca entram aqui (ficam em recebidos/enviados) — limpar não some com convite esperando ação.
 */
export function depoisDeLimpar<T extends { respondidoEm?: string | Date | null; criadoEm?: string | Date | null }>(historico: T[], limpoAte: number | null): T[] {
  if (limpoAte == null) return historico;
  return historico.filter((h) => (ms(h.respondidoEm) ?? ms(h.criadoEm) ?? 0) > limpoAte);
}

/** Tem o que limpar? (algum aviso já respondido na lista) */
export const podeLimpar = (itens: readonly ItemSino[]): boolean => itens.some((i) => i.status !== "pendente");

/** O registro do sino de cada pessoa (CanalSino) como vai pra tela: ms ou null. */
export type EstadoSino = { vistoEm: number | null; limpoAte: number | null };
export const estadoDoSino = (r: { vistoEm?: Date | null; limpoAte?: Date | null } | null | undefined): EstadoSino =>
  ({ vistoEm: ms(r?.vistoEm), limpoAte: ms(r?.limpoAte) });

/** Ações do sino guardadas no banco: abrir (visto) e Limpar (que também conta como visto). */
export type AcaoSino = "visto" | "limpar";
export const acaoDoSino = (v: unknown): AcaoSino | null => (v === "visto" || v === "limpar" ? v : null);
