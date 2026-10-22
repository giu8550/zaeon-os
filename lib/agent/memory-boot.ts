/**
 * lib/agent/memory-boot.ts — liga a memória L3 (gavetas verbatim no Atlas) no boot do servidor.
 *
 * MEMORY_L3=1 (runtime: .env + recriar o web) → `configureMemory` com a coleção `memory_drawers`
 * (driver `mongodb`, mesma DATABASE_URL do Prisma) e o gemini-embedding-001 a 1536 dims — a dimensão
 * dos índices `memory_drawers_vec`/`memory_drawers_text` que já existem no Atlas.
 * Sem a flag (ou com falha aqui) tudo segue em nullMemory: o chat responde sem memória, como antes.
 */
import { configureMemory, mongoDrawerCollection } from "@/lib/agent/memory-provider";
import { EMBED_DIM } from "@/lib/agent/memory";
import { embedGemini } from "@/lib/rag/embed";

type Env = Record<string, string | undefined>;

export const memoriaL3Ligada = (env: Env = process.env): boolean => env.MEMORY_L3 === "1" && Boolean(env.DATABASE_URL);

/** Liga o L3 se a flag pedir. Devolve true se ligou. Lança só se a conexão falhar (o chamador loga). */
export async function ligarMemoriaL3(env: Env = process.env): Promise<boolean> {
  if (!memoriaL3Ligada(env)) return false;
  const { MongoClient, ObjectId } = await import("mongodb");
  // Prazo curto: Atlas fora no boot não pode segurar o servidor (o chat segue sem memória).
  const client = new MongoClient(env.DATABASE_URL!, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
  await client.connect();
  configureMemory({
    drawers: mongoDrawerCollection(client.db().collection("memory_drawers"), ObjectId),
    embed: (textos, dim) => embedGemini(textos, { dim: dim ?? EMBED_DIM }),
  });
  return true;
}
