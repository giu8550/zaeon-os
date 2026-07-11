import { describe, it, expect } from "vitest";
import { resolveBlockRefs } from "@/lib/aulas/persistBlocks";

describe("resolveBlockRefs", () => {
  it("troca qref por questionId e mantém os outros blocos na ordem", () => {
    const blocks = [
      { kind: "text", md: "oi" },
      { kind: "q", qref: "tmp1", qkind: "q-choice" },
      { kind: "video", youtubeId: "abc12345678" },
    ] as any[];
    const out = resolveBlockRefs(blocks, { tmp1: "real1" });
    expect(out).toEqual([
      { kind: "text", md: "oi" },
      { kind: "q", questionId: "real1", qkind: "q-choice" },
      { kind: "video", youtubeId: "abc12345678" },
    ]);
  });
  it("descarta bloco q sem id mapeado", () => {
    const out = resolveBlockRefs([{ kind: "q", qref: "x", qkind: "q-voice" }] as any[], {});
    expect(out).toEqual([]);
  });
});
