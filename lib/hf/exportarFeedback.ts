/**
 * lib/hf/exportarFeedback.ts — sobe os 👍/👎 novos (ChatFeedback sem exportadoEm) pro dataset privado
 * `<HF_DATASETS_ORG>/zaeon-feedback-chat`, um JSONL por lote em `data/AAAA-MM-DD/HHmmss.jsonl`.
 * Roda de tempos em tempos no processo do web (instrumentation-node) e pode ser chamado à mão.
 * Falhou o commit → nada é marcado (o lote sai de novo na próxima vez).
 */
import { commitArquivo, datasetsLigados, repoDaOrg } from "@/lib/hf/datasets";
import { linhaDoDataset } from "@/lib/chat/feedbackDataset";

export const DATASET_FEEDBACK = "zaeon-feedback-chat";
export const LOTE = 500;

type Db = {
  chatFeedback: {
    findMany(a: any): Promise<Array<{ id: string; criadoEm: Date; voto: string; sala: string; modelo: string | null; pergunta: string; resposta: string }>>;
    updateMany(a: any): Promise<{ count: number }>;
  };
};

export async function exportarFeedback(
  deps: { db?: Db; commit?: typeof commitArquivo; agora?: () => Date; env?: Record<string, string | undefined> } = {},
): Promise<{ exportados: number; arquivo?: string; erro?: string }> {
  const env = deps.env ?? process.env;
  if (!datasetsLigados(env) || env.FEEDBACK_DATASET === "0") return { exportados: 0, erro: "desligado" };
  const db = deps.db ?? ((await import("@/src/lib/prisma")).prisma as unknown as Db);
  const linhas = await db.chatFeedback.findMany({
    where: { exportadoEm: null }, orderBy: { criadoEm: "asc" }, take: LOTE,
    select: { id: true, criadoEm: true, voto: true, sala: true, modelo: true, pergunta: true, resposta: true },
  });
  if (!linhas.length) return { exportados: 0 };
  const agora = (deps.agora ?? (() => new Date()))();
  const iso = agora.toISOString();
  const arquivo = `data/${iso.slice(0, 10)}/${iso.slice(11, 19).replace(/:/g, "")}.jsonl`;
  const conteudo = linhas.map((l) => JSON.stringify(linhaDoDataset(l))).join("\n") + "\n";
  const r = await (deps.commit ?? commitArquivo)({ repo: repoDaOrg(DATASET_FEEDBACK, env), caminho: arquivo, conteudo, mensagem: `feedback do chat: ${linhas.length} votos` }, { env });
  if (!r.ok) return { exportados: 0, erro: `HTTP ${r.status}: ${r.erro}` };
  await db.chatFeedback.updateMany({ where: { id: { in: linhas.map((l) => l.id) } }, data: { exportadoEm: agora } });
  return { exportados: linhas.length, arquivo };
}
