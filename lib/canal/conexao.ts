/**
 * lib/canal/conexao.ts — o Escritório com internet ruim (#657). PURO e isomórfico.
 *
 * O que a tela precisa saber: (1) o erro foi de REDE (sem internet, caiu no meio) ou outra coisa? — erro de rede vira
 * frase em português, não o "NetworkError when attempting to fetch resource." cru do navegador; (2) a conexão AO VIVO
 * (Pusher: mensagens dos outros e dos agentes) caiu depois de ter conectado? — aí aparece "Reconectando…".
 */

/** O fetch falhou por rede (sem internet, conexão caiu, DNS)? Cada navegador escreve de um jeito. */
export function ehErroDeRede(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e ?? "");
  return (e instanceof TypeError || (e as { name?: string })?.name === "TypeError") &&
    /failed to fetch|networkerror|load failed|network request failed|fetch failed|internet/i.test(msg);
}

/**
 * A frase pra pessoa. Erro de rede → "Sem conexão — <o que não deu>. Tente de novo."; outro erro → a mensagem dele
 * (as rotas já respondem em português). `oQue` = "sua mensagem não foi enviada", "não deu pra apagar"…
 */
export function mensagemDeErro(e: unknown, oQue: string): string {
  if (ehErroDeRede(e)) return `Sem conexão — ${oQue}. Tente de novo.`;
  const msg = String((e as { message?: string })?.message ?? e ?? "").trim();
  // #661: "HTTP 500" não diz nada pra pessoa
  return msg && !/^HTTP \d+$/.test(msg) ? msg : `Algo deu errado — ${oQue}.`;
}

/** Estados do Pusher (connection.state): initialized, connecting, connected, unavailable, failed, disconnected. */
const CAIU = new Set(["connecting", "unavailable", "failed", "disconnected"]);

/**
 * Acompanha a conexão ao vivo: true = mostrar "Reconectando…". Só depois de ter conectado uma vez (o "conectando" da
 * primeira abertura já tem o "Abrindo o canal…"); conectou de novo → some.
 */
export function vigiaAoVivo(): (estado: string) => boolean {
  let jaConectou = false;
  return (estado) => {
    if (estado === "connected") { jaConectou = true; return false; }
    return jaConectou && CAIU.has(estado);
  };
}

/** A mensagem que eu mandei e ainda não chegou no servidor (aparece na hora, meio apagada, "enviando…"). */
export const PREFIXO_ENVIANDO = "enviando-";
export const estaEnviando = (id: string): boolean => id.startsWith(PREFIXO_ENVIANDO);
/** Mensagem que não veio do servidor (a efêmera de erro do agente, a minha ainda enviando): fora das contas. */
export const ehLocal = (id: string): boolean => id.startsWith("efemera-") || estaEnviando(id);

type Msg = { id: string; autorId: string; texto: string };

/** #657: a resposta do envio chegou — a "enviando…" sai e entra a de verdade (se o ao vivo já não trouxe). */
export function confirmarEnviada<M extends Msg>(msgs: M[], tempId: string, real: M): M[] {
  const sem = msgs.filter((x) => x.id !== tempId);
  return sem.some((x) => x.id === real.id) ? sem : [...sem, real];
}

/** #657: a minha mensagem chegou AO VIVO antes da resposta do envio — tira a "enviando…" de mesmo texto e põe a real. */
export function chegouAoVivo<M extends Msg>(msgs: M[], real: M, meuId: string | null): M[] {
  if (msgs.some((x) => x.id === real.id)) return msgs;
  const minha = real.autorId === meuId;
  return [...msgs.filter((x) => !(minha && estaEnviando(x.id) && x.texto === real.texto)), real];
}
