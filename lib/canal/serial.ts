/**
 * lib/canal/serial.ts — UM turno por canal (padrão do Buzz: "one turn per channel").
 * Encadeia promessas por chave; canais diferentes rodam em paralelo, o mesmo canal em
 * fila. Vale dentro de um processo (web inline OU worker) — a fila BullMQ (quando ligada)
 * entrega os jobs e aqui garantimos a serialização por canal.
 */
const filas = new Map<string, Promise<unknown>>();

export function emSerie<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const atual = anterior.catch(() => undefined).then(fn);
  filas.set(chave, atual);
  // limpa a entrada quando esta for a última da fila (não acumula memória)
  atual.catch(() => undefined).finally(() => { if (filas.get(chave) === atual) filas.delete(chave); });
  return atual;
}

/** Quantos canais têm turno em andamento (diagnóstico/testes). */
export const emAndamento = (): number => filas.size;
