/**
 * #631 · o CRONÔMETRO da troca de blueprint — pra medir antes/depois em produção, sem atrapalhar ninguém.
 * Desligado por padrão. Liga no console do navegador:  localStorage.setItem("zaeon.debug.blueprint", "1")
 * e cada troca imprime: quanto o SERVIDOR levou, quanto a TELA levou pra desenhar e se veio do que já estava guardado.
 */
type Troca = { id: string; inicio: number; servidorMs?: number; guardado: boolean };
let troca: Troca | null = null;

const ligado = () => { try { return localStorage.getItem("zaeon.debug.blueprint") === "1"; } catch { return false; } };
const agora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** o clique (ou a recarga) pediu este blueprint */
export function comecarTroca(id: string, guardado: boolean): void { troca = { id, inicio: agora(), guardado }; }
/** o servidor respondeu */
export function servidorRespondeu(id: string): void { if (troca?.id === id && troca.servidorMs === undefined) troca.servidorMs = Math.round(agora() - troca.inicio); }

/** a prancha deste blueprint foi desenhada (chamado no quadro seguinte ao render) — devolve a linha do relatório */
export function telaDesenhou(id: string): string | null {
  if (!troca || troca.id !== id) return null;
  const total = Math.round(agora() - troca.inicio);
  const linha = `[blueprint] ${id.slice(-6)} · ${troca.guardado ? "guardado (sem esperar o servidor)" : `servidor ${troca.servidorMs ?? "?"} ms`} · na tela em ${total} ms`;
  troca = null;
  if (ligado()) console.info(linha);   // eslint-disable-line no-console
  return linha;
}
