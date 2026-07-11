import type { AulaBlock } from "@/lib/aulas/aulaBlocks";

/** Bloco como PERSISTIDO em Aula.blocks (q já com questionId real, sem o qref temporário). */
export type PersistedBlock =
  | { kind: "text"; md: string }
  | { kind: "video"; youtubeId: string }
  | { kind: "studio"; studioKind: string; title?: string; data: unknown }
  | { kind: "q"; questionId: string; qkind: string };

/** Troca os refs temporários (qref) das perguntas pelo questionId real; descarta q sem id mapeado. */
export function resolveBlockRefs(blocks: AulaBlock[], idByRef: Record<string, string>): PersistedBlock[] {
  const out: PersistedBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "q") {
      const questionId = idByRef[b.qref];
      if (questionId) out.push({ kind: "q", questionId, qkind: b.qkind });
    } else {
      out.push(b);
    }
  }
  return out;
}
