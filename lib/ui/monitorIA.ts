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

/** é uma chamada de IA? (POST, mesma origem, em /api/, fora das ignoradas) */
export function ehChamadaDeIA(url: string, metodo: string | undefined, origem: string): boolean {
  if ((metodo ?? "GET").toUpperCase() !== "POST") return false;
  let u: URL; try { u = new URL(url, origem); } catch { return false; }
  if (u.origin !== origem || !u.pathname.startsWith("/api/")) return false;
  return !IGNORAR.some((p) => u.pathname === p || u.pathname.startsWith(p + "/"));
}

/** a resposta vem em STREAM? (sem tamanho fechado: a IA ainda está escrevendo quando os cabeçalhos chegam) */
export const respostaEmStream = (r: { headers: { get(n: string): string | null }; body: unknown }) =>
  !!r.body && !r.headers.get("content-length");

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
  return () => { if (w.fetch === embrulhado) w.fetch = original; };
}
