/**
 * lib/canal/presenca.ts — o que as PESSOAS estão fazendo no escritório (#423, parte 3).
 *
 *   1. "Martinez entrou no escritório": uma linha do SISTEMA no chat (gravada, todos veem, fica no histórico),
 *      só quando a pessoa é ADICIONADA (dono adiciona, entra num canal aberto, ou aceita o convite).
 *   2. "Giulia está digitando…": aviso passageiro (não grava nada). O cliente avisa no máximo a cada
 *      INTERVALO_DIGITANDO_MS; quem recebe apaga sozinho depois de TTL_DIGITANDO_MS sem aviso novo.
 *
 * Regras puras + `anunciarEntrada` com dependências injetadas (testável sem banco nem Pusher).
 */
import type { MensagemWire } from "@/lib/canal/wire";

// ───────────────────────────── 1. "fulano entrou" ─────────────────────────────

/** Tipo do autor no fio: "sistema" é a linha de aviso (#423); qualquer valor desconhecido vira "humano" (como antes). */
export function tipoDoAutor(t: unknown): MensagemWire["autorTipo"] {
  return t === "agente" ? "agente" : t === "sistema" ? "sistema" : "humano";
}

export function textoEntrou(nome: string | null | undefined, opts: { conversa?: boolean } = {}): string {
  const n = (nome || "").trim() || "Alguém";
  return opts.conversa ? `${n} aceitou o convite e entrou na conversa` : `${n} entrou no escritório`;
}

/** Quem é NOVO em `depois` (não estava em `antes` e não é o dono) — só esses ganham o aviso. */
export function novosMembros(antes: readonly string[], depois: readonly string[], donoId: string): string[] {
  const ja = new Set(antes);
  return [...new Set(depois)].filter((id) => !ja.has(id) && id !== donoId);
}

export type DepsAnuncio = {
  criar: (data: { canalId: string; autorTipo: "sistema"; autorId: string; texto: string; mencoes: string[] }) => Promise<{ id: string; createdAt: Date }>;
  publicar: (canalId: string, evento: string, payload: unknown) => Promise<unknown> | unknown;
  evento: string;
};

/**
 * Grava a linha "fulano entrou" e avisa o canal em tempo real. Best-effort: um erro aqui NUNCA derruba
 * a rota (a pessoa entra mesmo assim) — devolve null.
 */
export async function anunciarEntrada(
  deps: DepsAnuncio, canalId: string, pessoa: { id: string; nome: string | null; avatar?: string | null }, opts: { conversa?: boolean } = {},
): Promise<MensagemWire | null> {
  try {
    const texto = textoEntrou(pessoa.nome, opts);
    const row = await deps.criar({ canalId, autorTipo: "sistema", autorId: pessoa.id, texto, mencoes: [] });
    const wire: MensagemWire = {
      id: row.id, canalId, autorTipo: "sistema", autorId: pessoa.id, texto, mencoes: [],
      createdAt: new Date(row.createdAt).toISOString(), autorNome: pessoa.nome || "Alguém", autorAvatar: pessoa.avatar ?? null,
    };
    await deps.publicar(canalId, deps.evento, wire);
    return wire;
  } catch (e) {
    console.warn("[canal] aviso de entrada falhou:", (e as Error)?.message);
    return null;
  }
}

// ───────────────────────────── 2. "fulano está digitando" ─────────────────────────────

/** De quanto em quanto tempo o cliente avisa que está digitando (não a cada tecla). */
export const INTERVALO_DIGITANDO_MS = 3000;
/** Quanto tempo o aviso fica na tela sem um aviso novo. */
export const TTL_DIGITANDO_MS = 6000;
/** Limite no servidor por pessoa+canal (protege o Pusher de quem burlar o cliente). */
export const LIMITE_SERVIDOR_MS = 1500;

/** O cliente deve avisar agora? Só com texto e se já passou o intervalo desde o último aviso. */
export function deveAvisarDigitando(ultimo: number | null, agora: number, texto: string): boolean {
  if (!texto.trim()) return false;
  return ultimo == null || agora - ultimo >= INTERVALO_DIGITANDO_MS;
}

export type Digitando = Record<string, { nome: string; ate: number }>;

/** Tira quem passou do prazo. Sem nada a tirar, devolve o MESMO objeto (o React não re-renderiza à toa). */
export function podarDigitando(d: Digitando, agora: number): Digitando {
  const vivos = Object.entries(d).filter(([, v]) => v.ate > agora);
  return vivos.length === Object.keys(d).length ? d : Object.fromEntries(vivos);
}

/** "Giulia está digitando" · "Giulia e Ana estão digitando" · "Giulia, Ana e mais 2 estão digitando" · "". */
export function textoDigitando(nomes: readonly string[]): string {
  const ns = nomes.map((n) => (n || "").trim() || "Alguém");
  if (!ns.length) return "";
  if (ns.length === 1) return `${ns[0]} está digitando`;
  if (ns.length === 2) return `${ns[0]} e ${ns[1]} estão digitando`;
  return `${ns[0]}, ${ns[1]} e mais ${ns.length - 2} estão digitando`;
}

/**
 * Limite no SERVIDOR: deixa passar 1 aviso por pessoa+canal a cada LIMITE_SERVIDOR_MS. O mapa é injetado
 * (a rota usa um do módulo); entradas velhas são limpas pra não crescer sem fim.
 */
export function permitirDigitando(mapa: Map<string, number>, chave: string, agora: number, intervalo = LIMITE_SERVIDOR_MS): boolean {
  const ultimo = mapa.get(chave);
  if (ultimo != null && agora - ultimo < intervalo) return false;
  mapa.set(chave, agora);
  if (mapa.size > 5000) for (const [k, t] of mapa) if (agora - t > 60_000) mapa.delete(k);
  return true;
}
