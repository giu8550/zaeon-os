/**
 * lib/ui/monitorIA.ts — o MONITOR DE IA do laboratório dentro do TABLET (a CONCORRÊNCIA do modo tablet: deixar uma
 * pesquisa/resposta rodando no laboratório e ir brincar no cyberespaço). Embrulha o `fetch` da página: toda chamada
 * POST pra `/api/` da mesma origem (menos as que não são de IA — `IGNORAR`) conta como trabalho em andamento até a
 * resposta acabar — numa resposta em STREAM (a IA escrevendo aos poucos), até o fim do corpo. A cada mudança avisa quem
 * instalou (o laboratório repassa pra janela de cima — components/cyber/TabletLab — que mostra a barra de IA no HUD).
 */
import type { EstadoIALab } from "./loungeHub";

/** rotas POST que NÃO são trabalho de IA (login, presença, o cyberespaço, uploads, telemetria) */
export const IGNORAR = ["/api/auth", "/api/cyber", "/api/lounge3d", "/api/presence", "/api/presenca", "/api/pusher", "/api/realtime", "/api/analytics", "/api/telemetry", "/api/upload", "/api/uploads", "/api/log", "/api/ping", "/api/heartbeat", "/api/tour", "/api/ai/transcript"] as const;   // (transcript = salvar a conversa depois da resposta)

/**
 * #440: os pedidos do ESCRITÓRIO que não são IA (o aviso de "digitando" a cada 3 s, o sino, convites, agenda,
 * criar escritório…). O "digitando" acendia a barra "IA trabalhando" do metaverso por até 15 min. A mensagem
 * (`/api/canal/<id>/mensagem`) continua contando: ela pode esperar o turno do agente.
 */
export const IGNORAR_PADROES: readonly RegExp[] = [
  /^\/api\/canal\/?$/,                                                    // criar escritório
  /^\/api\/canal\/(?:sino|convites|pusher-auth)(?:\/.*)?$/,             // sino, convites, auth do tempo real
  /^\/api\/canal\/[^/]+\/(?:digitando|agenda|entrar)(?:\/.*)?$/,        // digitando, agenda, entrar
];

/**
 * #468: trabalho de IA que NÃO é um fetch desta página — o agente do escritório responde em segundo plano (a mensagem
 * volta na hora; a resposta chega depois pelo tempo real). O escritório avisa com este evento enquanto a agente que
 * VOCÊ chamou escreve, e o metaverso mantém "IA trabalhando" (antes virava "livre" em 3 s).
 */
export const EV_TRABALHO_IA = "zaeon:ia-trabalho";
export type TrabalhoIA = { chave: string; ativo: boolean };
export function avisarTrabalhoIA(chave: string, ativo: boolean, w: Window = window): void {
  try { w.dispatchEvent(new CustomEvent<TrabalhoIA>(EV_TRABALHO_IA, { detail: { chave, ativo } })); } catch { /* ignore */ }
}

/** é uma chamada de IA? (POST, mesma origem, em /api/, fora das ignoradas) */
export function ehChamadaDeIA(url: string, metodo: string | undefined, origem: string): boolean {
  if ((metodo ?? "GET").toUpperCase() !== "POST") return false;
  let u: URL; try { u = new URL(url, origem); } catch { return false; }
  if (u.origin !== origem || !u.pathname.startsWith("/api/")) return false;
  if (IGNORAR_PADROES.some((r) => r.test(u.pathname))) return false;
  return !IGNORAR.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
}

/**
 * a resposta vem em STREAM? (sem tamanho fechado: a IA ainda está escrevendo quando os cabeçalhos chegam)
 * #440: resposta JSON nunca é a IA escrevendo aos poucos — as de IA em stream são text/plain ou x-ndjson. Com a
 * compressão do servidor, JSON chega SEM tamanho fechado; se ninguém lia o corpo, o monitor esperava 15 min.
 */
export const respostaEmStream = (r: { headers: { get(n: string): string | null }; body: unknown }) =>
  !!r.body && !r.headers.get("content-length") && !/^application\/json\b/i.test(r.headers.get("content-type") ?? "");

/** o contador (puro): começa/termina chamadas e diz o estado */
export function criarContador(agora: () => number) {
  const ativos = new Map<number, number>(); let seq = 0, leva: number | null = null, terminou: EstadoIALab["terminou"] = null;
  const estado = (): EstadoIALab => ({ ativos: ativos.size, desde: ativos.size ? Math.min(...ativos.values()) : null, terminou });
  return {
    comecar(): number { const id = ++seq, t = agora(); if (!ativos.size) leva = t; ativos.set(id, t); return id; },
    terminar(id: number): boolean {
      if (!ativos.delete(id)) return false;
      if (!ativos.size && leva !== null) { const t = agora(); terminou = { em: t, durMs: t - leva }; leva = null; }
      return true;
    },
    estado,
  };
}

/** instala o monitor no `window.fetch` (uma vez); devolve o desinstalar */
export function instalarMonitorIA(avisar: (e: EstadoIALab) => void, w: Window & typeof globalThis = window): () => void {
  const original = w.fetch.bind(w), cont = criarContador(() => Date.now()), origem = w.location.origin;
  const fim = (id: number) => { if (cont.terminar(id)) avisar(cont.estado()); };
  const embrulhado: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const metodo = init?.method ?? (typeof input === "object" && "method" in input ? input.method : undefined);
    if (!ehChamadaDeIA(url, metodo, origem)) return original(input, init);
    const id = cont.comecar(); avisar(cont.estado());
    const seguranca = setTimeout(() => fim(id), 15 * 60_000);   // (uma resposta nunca lida não prende a barra pra sempre)
    try {
      const r = await original(input, init);
      if (!respostaEmStream(r)) { clearTimeout(seguranca); fim(id); return r; }
      // STREAM: repassa o corpo pedaço a pedaço e só termina quando ele acaba (ou é cancelado)
      const leitor = r.body!.getReader();
      const corpo = new ReadableStream<Uint8Array>({
        async pull(c) {
          try { const { done, value } = await leitor.read(); if (done) { c.close(); clearTimeout(seguranca); fim(id); } else c.enqueue(value); }
          catch (e) { clearTimeout(seguranca); fim(id); c.error(e); }
        },
        cancel(motivo) { clearTimeout(seguranca); fim(id); return leitor.cancel(motivo); },
      });
      return new Response(corpo, { status: r.status, statusText: r.statusText, headers: r.headers });
    } catch (e) { clearTimeout(seguranca); fim(id); throw e; }
  };
  w.fetch = embrulhado;
  // #468: trabalho avisado pelo escritório (uma chave por agente; repetir "ativo" não conta duas vezes)
  const porChave = new Map<string, { id: number; seguranca: ReturnType<typeof setTimeout> }>();
  const aoTrabalho = (ev: Event) => {
    const d = (ev as CustomEvent<TrabalhoIA>).detail;
    if (!d?.chave) return;
    const j = porChave.get(d.chave);
    if (d.ativo && !j) {
      const id = cont.comecar(); avisar(cont.estado());
      porChave.set(d.chave, { id, seguranca: setTimeout(() => { porChave.delete(d.chave); fim(id); }, 15 * 60_000) });
    } else if (!d.ativo && j) {
      clearTimeout(j.seguranca); porChave.delete(d.chave); fim(j.id);
    }
  };
  w.addEventListener?.(EV_TRABALHO_IA, aoTrabalho);
  return () => {
    if (w.fetch === embrulhado) w.fetch = original;
    w.removeEventListener?.(EV_TRABALHO_IA, aoTrabalho);
    for (const j of porChave.values()) clearTimeout(j.seguranca);
  };
}
