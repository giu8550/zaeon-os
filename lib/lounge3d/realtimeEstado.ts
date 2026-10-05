/**
 * lib/lounge3d/realtimeEstado.ts — estado e DIAGNÓSTICO do tempo real do lounge (Pusher), PURO e client-safe.
 * "Indisponível" só vale quando de fato falhou — nunca enquanto ainda está conectando — e sempre diz POR QUÊ.
 */
/** "pusher" | "colyseus" = conectado (o transporte em uso) */
export type EstadoRealtime = "conectando" | "pusher" | "colyseus" | "erro" | "sem-chave";

export type MotivoErro = "sem-credenciais-servidor" | "sessao" | "cheia" | "client-events" | "conexao" | "auth" | "desconhecido";

/** Classifica o que o pusher-js entrega em `subscription_error` / `connection.error`. */
export function classificarErroPusher(e: unknown): MotivoErro {
  const x = e as { status?: number; error?: { status?: number; data?: { code?: number | null; message?: string } }; data?: { code?: number | null; message?: string }; type?: string } | null;
  const status = x?.status ?? x?.error?.status;
  const code = x?.data?.code ?? x?.error?.data?.code;
  const msg = String(x?.data?.message ?? x?.error?.data?.message ?? "");
  // "Enable client events" desligado no painel. ATENÇÃO: o Pusher manda isso com `code: null` e só a mensagem
  // ("To send client events, you must enable this feature…") — conferido contra o app de produção.
  if (code === 4301 || /client events/i.test(msg)) return "client-events";
  if (status === 503) return "sem-credenciais-servidor"; // getPusher() nulo no servidor (APP_ID/SECRET ausentes no runtime)
  if (status === 401) return "sessao";
  if (status === 403) return "cheia";
  if (x?.type === "AuthError" || (typeof status === "number" && status >= 400)) return "auth";
  return "desconhecido";
}

/** Texto pro usuário (curto) — `null` = não mostra nada. */
export function avisoRealtime(estado: EstadoRealtime, motivo: MotivoErro | null): string | null {
  if (estado === "pusher" || estado === "colyseus" || estado === "conectando") return null;
  if (estado === "sem-chave") return "Tempo real indisponível (chave do Pusher ausente neste build).";
  switch (motivo) {
    case "sem-credenciais-servidor": return "Tempo real indisponível: o servidor está sem as credenciais do Pusher.";
    case "sessao": return "Tempo real indisponível: entre na sua conta novamente.";
    case "conexao": return "Sem conexão com o tempo real — tentando reconectar.";
    default: return "Tempo real indisponível agora — você pode não ver os outros.";
  }
}

/** Estados de conexão do pusher-js que contam como falha (o resto é transitório). */
export const ehFalhaDeConexao = (state: string | undefined): boolean => state === "failed" || state === "unavailable";
