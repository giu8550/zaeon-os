/**
 * A MEDIÇÃO de cada resposta do chat (out/2026, o dono: "já estamos lentos demais" — achar ONDE: servidor ou tela).
 * Marcos, em ms desde o envio:
 *  - `sinal`     — o 1º sinal do servidor (fase, modelo ou texto): o tempo até o servidor responder;
 *  - `texto`     — o 1º texto pintado na tela;
 *  - `recebido`  — a resposta inteira chegou (o stream fechou);
 *  - `fim`       — a tela terminou de mostrar (a datilografia alcançou o fim);
 *  - `quadrosLentos` / `piorQuadro` — quadros > 50 ms na tela durante a resposta (a thread principal engasgando).
 * Custo: alguns `performance.now()` por resposta. Fica num anel das últimas 20 (localStorage `zaeon.tempos`, e
 * `window.__tempos()` imprime a tabela); com a flag `localStorage["zaeon.tempos.ver"] = "1"` (ou `?tempos=1`), o chat
 * mostra um selo com os números da última.
 */
export type TemposResposta = { em: number; caracteres: number; sinal?: number; texto?: number; recebido?: number; fim?: number; quadrosLentos: number; piorQuadro: number };
export const EVT_TEMPOS = "zaeon:tempos";
const CHAVE = "zaeon.tempos", MAX = 20;

export function lerTempos(): TemposResposta[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function verTempos(): boolean {
  try { return localStorage.getItem("zaeon.tempos.ver") === "1" || new URLSearchParams(location.search).get("tempos") === "1"; } catch { return false; }
}

/** um cronômetro por resposta: marcar os pontos e `fechar()` no fim */
export function cronometrarResposta() {
  const t0 = performance.now(), m: TemposResposta = { em: Date.now(), caracteres: 0, quadrosLentos: 0, piorQuadro: 0 };
  const desde = () => Math.round(performance.now() - t0);
  // os QUADROS da tela durante a resposta (um rAF leve: só compara tempos)
  let vivo = true, ultimo = performance.now();
  const quadro = () => { if (!vivo) return; const t = performance.now(), d = t - ultimo; ultimo = t; if (d > 50) { m.quadrosLentos++; m.piorQuadro = Math.max(m.piorQuadro, Math.round(d)); } requestAnimationFrame(quadro); };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(quadro);
  return {
    sinal: () => { if (m.sinal === undefined) m.sinal = desde(); },
    texto: () => { if (m.texto === undefined) { if (m.sinal === undefined) m.sinal = desde(); m.texto = desde(); } },
    recebido: (caracteres: number) => { m.recebido = desde(); m.caracteres = caracteres; },
    fechar: () => {
      if (!vivo) return; vivo = false; m.fim = desde();
      try { localStorage.setItem(CHAVE, JSON.stringify([...lerTempos(), m].slice(-MAX))); } catch { /* storage bloqueado: só o evento */ }
      try { window.dispatchEvent(new CustomEvent(EVT_TEMPOS, { detail: m })); } catch { /* */ }
    },
  };
}

/** `window.__tempos()`: a tabela das últimas respostas (no console) */
if (typeof window !== "undefined") (window as unknown as { __tempos: () => void }).__tempos = () => console.table(lerTempos().map((t) => ({ ...t, em: new Date(t.em).toLocaleTimeString() })));

/** o selo: "servidor 1,2 s · 1º texto 1,3 s · recebido 4,0 s · tela 4,5 s" */
export const fmtTempos = (t: TemposResposta) => {
  const s = (ms?: number) => (ms === undefined ? "—" : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);
  return `servidor ${s(t.sinal)} · 1º texto ${s(t.texto)} · recebido ${s(t.recebido)} · tela ${s(t.fim)}${t.quadrosLentos ? ` · ${t.quadrosLentos} quadros lentos (pior ${t.piorQuadro} ms)` : ""}`;
};
