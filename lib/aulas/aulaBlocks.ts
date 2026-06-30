/**
 * Serializador PURO do feed do canvas teach → { blocks, questions } (fatia rica).
 * blocks = sequência ordenada (texto/vídeo/studio/pergunta). As perguntas (q) carregam
 * `qref` = id temporário do AuthQ; a rota /api/aulas troca por `questionId` real ao
 * criar os AulaQuestion. NÃO importa React/DOM (testável).
 */
import type { AuthQ } from "@/components/aulas/AulaQuestionsPanel";

export type FeedItem = {
  id: string; type: string; title: string; payload: any;
  placement: string; order?: number; createdAt?: string;
};

export type AulaBlock =
  | { kind: "text"; md: string }
  | { kind: "video"; youtubeId: string }
  | { kind: "studio"; studioKind: string; title?: string; data: unknown }
  | { kind: "q"; qref: string; qkind: string };

export type SerializedAula = { blocks: AulaBlock[]; questions: AuthQ[] };

/** id de um vídeo do YouTube SE o texto, sem espaços, for um único link (senão null). */
export function ytIdFromText(s: string): string | null {
  const t = (s || "").trim();
  if (!t || /\s/.test(t)) return null;
  const m = t.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const ord = (i: FeedItem) => (typeof i.order === "number" ? i.order : 0);

export function serializeFeed(feed: FeedItem[]): SerializedAula {
  const ordered = [...feed].sort(
    (a, b) => (ord(a) - ord(b)) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
  );
  const blocks: AulaBlock[] = [];
  const questions: AuthQ[] = [];
  for (const it of ordered) {
    if (it.type === "aula-question" && it.payload && typeof it.payload === "object") {
      const aq = it.payload as AuthQ;
      questions.push(aq);
      blocks.push({ kind: "q", qref: aq.id, qkind: aq.kind });
    } else if (it.type === "note") {
      const text = String(it.payload?.text || "").trim();
      if (!text) continue;
      const yt = ytIdFromText(text);
      if (yt) { blocks.push({ kind: "video", youtubeId: yt }); continue; }
      const v = it.payload?.variant;
      blocks.push({ kind: "text", md: v === "h1" ? `# ${text}` : v === "h2" ? `## ${text}` : text });
    } else if (it.type === "video" && it.payload?.videoId) {
      blocks.push({ kind: "video", youtubeId: String(it.payload.videoId) });
    } else if (it.type === "link" && it.payload?.url) {
      blocks.push({ kind: "text", md: `[${it.title || it.payload.url}](${it.payload.url})` });
    } else if (it.type === "studio" && it.payload?.studioKind) {
      blocks.push({ kind: "studio", studioKind: String(it.payload.studioKind), title: it.title || undefined, data: it.payload.data ?? null });
    }
  }
  return { blocks, questions };
}
