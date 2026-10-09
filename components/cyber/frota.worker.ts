/// <reference lib="webworker" />
/**
 * Worker da FROTA: o plano do dia (lib/cyber/frota/plano) e as conversas (conversas `episodiosDoDia`) FORA da linha
 * principal — com 1500 IAs o plano leva ~0,5 s e as conversas ~0,3 s, o que travaria a tela. Recebe a config da frota e o
 * dia; devolve o plano (as agendas de cada IA) e os episódios agrupados por IA. Tudo PURO (sem three, sem DOM).
 */
import { gerarFrota, type ConfigFrota } from "@/lib/cyber/frota/frota";
import { planejarDia } from "@/lib/cyber/frota/plano";
import { episodiosDoDia, type Episodio } from "@/lib/cyber/frota/conversas";
import type { FlagsFrota } from "@/lib/cyber/frota/agenda";

export type PedidoFrota = { id: number; frota: ConfigFrota; dia: number; flags: FlagsFrota; /** o dia está no MODO FULL (24 h) */ full: boolean };
export type RespostaFrota = { id: number; dia: number; plano: ReturnType<typeof planejarDia>; eps: [string, Episodio[]][] } | { id: number; erro: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = (ev: MessageEvent<PedidoFrota>) => {
  const { id, frota, dia, flags, full } = ev.data;
  try {
    const plano = planejarDia(gerarFrota(frota), dia, flags, full), m = new Map<string, Episodio[]>();
    for (const e of episodiosDoDia(plano, flags)) for (const a of new Set(e.falas.map((f) => f.agente))) (m.get(a) ?? m.set(a, []).get(a)!).push(e);
    ctx.postMessage({ id, dia, plano, eps: [...m.entries()] } satisfies RespostaFrota);
  } catch (e) { ctx.postMessage({ id, erro: String((e as Error)?.message ?? e) } satisfies RespostaFrota); }
};
