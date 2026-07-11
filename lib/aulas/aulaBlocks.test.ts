import { describe, it, expect } from "vitest";
import { serializeFeed, ytIdFromText, type FeedItem } from "@/lib/aulas/aulaBlocks";

const note = (id: string, text: string, variant?: string, order = 0): FeedItem =>
  ({ id, type: "note", title: "", payload: { text, variant }, placement: "feed", order });
const q = (id: string, kind: string, order = 0): FeedItem =>
  ({ id, type: "aula-question", title: "", payload: { id, kind, type: "choice", text: "P?", marks: 2 }, placement: "feed", order });

describe("ytIdFromText", () => {
  it("extrai id de link solo do youtube", () => {
    expect(ytIdFromText("https://youtu.be/abc12345678")).toBe("abc12345678");
    expect(ytIdFromText("https://www.youtube.com/watch?v=abc12345678")).toBe("abc12345678");
  });
  it("texto com mais que o link → null", () => {
    expect(ytIdFromText("veja https://youtu.be/abc12345678 agora")).toBeNull();
    expect(ytIdFromText("só um texto")).toBeNull();
  });
});

describe("serializeFeed", () => {
  it("preserva a ordem e intercala texto e pergunta", () => {
    const feed = [note("a", "Introdução", "h1", 0), q("b", "q-choice", 1), note("c", "Conclusão", undefined, 2)];
    const { blocks, questions } = serializeFeed(feed);
    expect(blocks.map((b) => b.kind)).toEqual(["text", "q", "text"]);
    expect(blocks[0]).toEqual({ kind: "text", md: "# Introdução" });
    expect(blocks[1]).toEqual({ kind: "q", qref: "b", qkind: "q-choice" });
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("b");
  });
  it("nota com link solo do youtube vira bloco de vídeo", () => {
    const { blocks } = serializeFeed([note("v", "https://youtu.be/abc12345678", undefined, 0)]);
    expect(blocks).toEqual([{ kind: "video", youtubeId: "abc12345678" }]);
  });
  it("ignora notas vazias e tipos desconhecidos", () => {
    const feed: FeedItem[] = [note("e", "   ", undefined, 0), { id: "x", type: "weird", title: "", payload: {}, placement: "feed", order: 1 }];
    expect(serializeFeed(feed)).toEqual({ blocks: [], questions: [] });
  });
  it("h2 vira ## e texto puro fica como está", () => {
    const { blocks } = serializeFeed([note("a", "Sub", "h2", 0), note("b", "corpo", "text", 1)]);
    expect(blocks).toEqual([{ kind: "text", md: "## Sub" }, { kind: "text", md: "corpo" }]);
  });
  it("ordena pelo campo order antes de serializar", () => {
    const feed = [note("c", "terceiro", undefined, 2), note("a", "primeiro", undefined, 0), note("b", "segundo", undefined, 1)];
    const { blocks } = serializeFeed(feed);
    expect(blocks).toEqual([{ kind: "text", md: "primeiro" }, { kind: "text", md: "segundo" }, { kind: "text", md: "terceiro" }]);
  });
});
