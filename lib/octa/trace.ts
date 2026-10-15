/**
 * lib/octa/trace.ts — P7 do Pack Octa (lacuna §9.1). Observabilidade dos runs do agente: trace passo a
 * passo (prompt → tool → resultado), tokens e custo por run, e REPLAY (re-executa o laço com os resultados
 * de tool gravados, sem efeito colateral). Nunca grava valor de segredo: tudo passa por `redact` antes.
 */
import { randomBytes } from "node:crypto";

export type TipoPasso = "prompt" | "modelo" | "tool_chamada" | "tool_resultado" | "guard" | "sinal" | "erro";
export type Passo = {
  id: string;
  tipo: TipoPasso;
  em: string;
  ms?: number;
  dados: Record<string, unknown>;
  tokens?: { entrada: number; saida: number };
  modelo?: string;
};
export type Trace = { runId: string; taskId?: string; inicio: string; fim?: string; passos: Passo[] };

/** US$ por milhão de tokens (entrada, saída). Valores de referência; atualizar quando o preço mudar. */
export const PRECO_POR_MTOK: Record<string, [number, number]> = {
  "claude-opus-5-5": [15, 75],
  "claude-sonnet-5-5": [3, 15],
  "claude-haiku-5-5": [1, 5],
};

export class Tracer {
  readonly trace: Trace;
  constructor(p: { taskId?: string; runId?: string } = {}, private agora: () => Date = () => new Date(), private redigir: (s: string) => string = (s) => s) {
    this.trace = { runId: p.runId ?? randomBytes(6).toString("hex"), taskId: p.taskId, inicio: this.agora().toISOString(), passos: [] };
  }
  registrar(tipo: TipoPasso, dados: Record<string, unknown>, extra: Partial<Pick<Passo, "ms" | "tokens" | "modelo">> = {}): Passo {
    const limpo = JSON.parse(this.redigir(JSON.stringify(dados ?? {})));
    const p: Passo = { id: `${this.trace.passos.length + 1}`, tipo, em: this.agora().toISOString(), dados: limpo, ...extra };
    this.trace.passos.push(p);
    return p;
  }
  encerrar(): Trace { this.trace.fim = this.agora().toISOString(); return this.trace; }
}

export function custoDoRun(t: Trace): { tokensEntrada: number; tokensSaida: number; usd: number; semPreco: string[] } {
  let tokensEntrada = 0, tokensSaida = 0, usd = 0;
  const semPreco = new Set<string>();
  for (const p of t.passos) {
    if (!p.tokens) continue;
    tokensEntrada += p.tokens.entrada; tokensSaida += p.tokens.saida;
    const preco = p.modelo ? PRECO_POR_MTOK[p.modelo] : undefined;
    if (!preco) { semPreco.add(p.modelo ?? "?"); continue; }
    usd += (p.tokens.entrada * preco[0] + p.tokens.saida * preco[1]) / 1e6;
  }
  return { tokensEntrada, tokensSaida, usd: +usd.toFixed(6), semPreco: [...semPreco] };
}

/**
 * Replay: devolve um executor de tool que responde com os resultados GRAVADOS, na ordem, e acusa se o
 * laço pedir uma tool diferente da gravada (divergência = o comportamento mudou).
 */
export function replayer(t: Trace) {
  const chamadas = t.passos.filter((p) => p.tipo === "tool_chamada");
  const resultados = t.passos.filter((p) => p.tipo === "tool_resultado");
  let i = 0;
  return {
    async executar(nome: string, args: unknown): Promise<unknown> {
      const c = chamadas[i], r = resultados[i];
      if (!c || !r) throw new Error(`replay: chamada ${i + 1} (${nome}) não existe no trace`);
      if (c.dados.tool !== nome) throw new Error(`replay divergiu no passo ${i + 1}: gravado ${String(c.dados.tool)}, pedido ${nome}`);
      if (JSON.stringify(c.dados.args) !== JSON.stringify(args)) throw new Error(`replay divergiu nos args de ${nome} (passo ${i + 1})`);
      i++;
      return r.dados.resultado;
    },
    restantes: () => chamadas.length - i,
  };
}

/** Persistência plugável do trace (memória em teste; arquivo/Mongo em prod). */
export interface TraceStore { salvar(t: Trace): Promise<void>; obter(runId: string): Promise<Trace | null> }
export class MemoryTraceStore implements TraceStore {
  private m = new Map<string, Trace>();
  async salvar(t: Trace) { this.m.set(t.runId, structuredClone(t)); }
  async obter(id: string) { return this.m.get(id) ?? null; }
}
