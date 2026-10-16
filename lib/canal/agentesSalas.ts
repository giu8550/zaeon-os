/**
 * lib/canal/agentesSalas.ts — os agentes do ESCRITÓRIO são os MESMOS de todas as outras salas (PURO): o escritório é só
 * outra forma de chamar um ou mais deles. Aqui: as personas da plataforma que conversam (as silenciosas, que só
 * formatam saída, ficam de fora). Os mentores entram pelo que a pessoa contratou (lib/canal/server `agentesDoCanal`).
 */
import type { AgentBase } from "@/lib/agents/roster";

export const agentesDasSalas = (roster: readonly Pick<AgentBase, "agentKey" | "tipo" | "conversacional">[]): string[] =>
  roster.filter((a) => a.tipo === "persona" && a.conversacional).map((a) => a.agentKey);
