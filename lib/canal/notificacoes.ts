/**
 * lib/canal/notificacoes.ts — regras PURAS das notificações "fora da tela" do canal.
 *
 * Quando o usuário NÃO está olhando (aba em background ou canal fechado), uma mensagem
 * nova avisa: Web Notification + badge de não-lidas (canal e título da aba). Nunca para a
 * própria mensagem; @mention a mim e resposta do MEU agente = prioridade alta; agrupa pra
 * não virar spam. O DOM (Notification API, document.title) fica no hook; aqui é só decisão.
 */
export type Prioridade = "alta" | "normal" | "nenhuma";

export type MensagemLike = {
  autorTipo: "humano" | "agente" | string;
  autorId: string;
  texto: string;
  mencoes?: string[];
};

export type ContextoNotif = {
  meuId: string | null | undefined;
  /** agentes que EU convoquei neste canal (resposta deles = prioridade alta). */
  meusAgentes?: string[];
  /** aliases (@eu / @meu-nome normalizado) que apontam pra mim no texto. */
  meusAliases?: string[];
};

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Prioridade da mensagem pra MIM. Minha própria mensagem = "nenhuma". */
export function prioridadeDe(m: MensagemLike, ctx: ContextoNotif): Prioridade {
  // minha mensagem, ou o aviso de que EU entrei (#423, autorTipo "sistema"), não me notifica
  if ((m.autorTipo === "humano" || m.autorTipo === "sistema") && ctx.meuId && m.autorId === ctx.meuId) return "nenhuma";
  if (m.autorTipo === "agente" && (ctx.meusAgentes ?? []).includes(m.autorId)) return "alta";
  const t = norm(m.texto);
  for (const a of ctx.meusAliases ?? []) {
    const n = norm(a);
    if (n && t.includes(`@${n}`)) return "alta";
  }
  return "normal";
}

/** Dispara notificação do SO? Só fora da tela (aba escondida OU canal não aberto) e nunca pra mim mesmo. */
export function deveNotificar(args: { prioridade: Prioridade; abaVisivel: boolean; canalAberto: boolean }): boolean {
  if (args.prioridade === "nenhuma") return false;
  return !args.abaVisivel || !args.canalAberto;
}

/** Conta como não-lida? Mesma regra do aviso, sem a parte de permissão. */
export const contaNaoLida = deveNotificar;

/** "(3) Zaeon" — e zera de volta pro título limpo quando n = 0. */
export function tituloComBadge(base: string, naoLidas: number): string {
  const limpo = tituloBase(base);
  return naoLidas > 0 ? `(${naoLidas > 99 ? "99+" : naoLidas}) ${limpo}` : limpo;
}
export function tituloBase(t: string): string {
  return (t || "").replace(/^\(\d+\+?\)\s*/, "");
}

/** Trecho curto do texto pro corpo da notificação (sem quebras, com reticência). */
export function trecho(texto: string, max = 90): string {
  const t = (texto || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Agrupa: no máximo 1 notificação do SO por canal a cada `janelaMs` (prioridade alta fura 1x). */
export class Agrupador {
  private ultimo = new Map<string, number>();
  constructor(private janelaMs = 4000) {}
  deveDisparar(canalId: string, prioridade: Prioridade, agora = Date.now()): boolean {
    const u = this.ultimo.get(canalId);
    const passou = u === undefined || agora - u >= this.janelaMs;
    if (!passou && prioridade !== "alta") return false;
    this.ultimo.set(canalId, agora);
    return true;
  }
}
