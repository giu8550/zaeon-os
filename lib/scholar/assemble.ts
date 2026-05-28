import { verifyQuote } from "./verify";
import type { EvidenceRecord, Paper, RetrievedText, RawSynthesis } from "./types";

export interface AssembledResults {
  answer: string;
  references: Paper[];
  evidence: EvidenceRecord[];
  insights: RawSynthesis["insights"];
  gaps: RawSynthesis["gaps"];
  files: { name: string; kind: string; content: string }[];
  verifiedCount: number;
  dropped: number;
}

export function assembleResults(query: string, grounded: Paper[], raw: RawSynthesis): AssembledResults {
  const textById = new Map<string, RetrievedText>();
  for (const p of grounded) if (p.retrievedText) textById.set(p.id, p.retrievedText);

  const evidence: EvidenceRecord[] = [];
  let verifiedCount = 0, dropped = 0;
  for (const e of raw.evidence ?? []) {
    const rt = textById.get(e.paperId);
    const v = rt ? verifyQuote(e.quote, rt) : { verified: false as const };
    if (v.verified && rt) {
      verifiedCount++;
      evidence.push({ ...e, locator: v.locator, verified: true, fullTextAvailable: rt.kind !== "abstract" });
    } else dropped++;
  }

  const citedIds = new Set(evidence.map((e) => e.paperId));
  const references = grounded.filter((p) => citedIds.has(p.id));

  const files = [{
    name: "literature-review.md", kind: "markdown",
    content: `# ${query}\n\n${raw.answer}\n\n## Referências\n` +
      references.map((p) => `- ${p.authors.join(", ")} (${p.year ?? "s.d."}). ${p.title}. ${p.venue ?? ""}. ${p.doi ? "doi:" + p.doi : p.url ?? ""}`).join("\n"),
  }];

  return { answer: raw.answer, references, evidence, insights: raw.insights, gaps: raw.gaps, files, verifiedCount, dropped };
}
