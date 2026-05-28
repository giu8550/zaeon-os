// Normalized paper from any source
export interface Paragraph {
  idx: number;
  page?: number;     // present for PDF-extracted text
  section?: string;  // present for structured full-text
  text: string;
}

export interface RetrievedText {
  kind: "pdf" | "fulltext" | "abstract";
  paragraphs: Paragraph[];
}

export interface Paper {
  id: string;            // stable internal id (doi or arxiv or source:externalId)
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  arxivId?: string;
  url?: string;
  pdfUrl?: string;
  abstract?: string;
  citationCount?: number;
  openAccess: boolean;
  sources: string[];     // which APIs returned it
  retrievedText?: RetrievedText;
}

export type Locator =
  | { kind: "pdf"; page: number; paragraph?: number }
  | { kind: "fulltext"; section?: string; paragraph: number }
  | { kind: "abstract"; sentence?: number };

export interface EvidenceRecord {
  paperId: string;
  claim: string;
  quote: string;
  locator?: Locator;
  confidence: "high" | "medium" | "low";
  verified: boolean;
  fullTextAvailable: boolean;
}

export interface ScholarPayload {
  query: string;
  domain?: string;
  answer: string;
  references: Paper[];
  evidence: EvidenceRecord[];
  insights: { summary: string; trends: string[]; contradictions: string[] };
  gaps: { description: string; rqCards: string[] };
  files: { name: string; kind: string; content: string }[];
}

// Shape the LLM returns (before deterministic verification). Lives here so both
// synthesize.ts and assemble.ts can import it without an ordering dependency.
export interface RawSynthesis {
  answer: string;
  evidence: { paperId: string; claim: string; quote: string; confidence: "high" | "medium" | "low" }[];
  insights: { summary: string; trends: string[]; contradictions: string[] };
  gaps: { description: string; rqCards: string[] };
}

// NDJSON stream events (server → client)
export type ScholarEvent =
  | { type: "session"; sessionId: string }
  | { type: "phase"; phase: "planning"; message: string }
  | { type: "phase"; phase: "searching"; source: string; count: number; message?: string }
  | { type: "phase"; phase: "dedup"; unique: number; fulltext: number; message?: string }
  | { type: "phase"; phase: "synthesizing"; message?: string }
  | { type: "phase"; phase: "verifying"; checked: number; verified: number; dropped: number; message?: string }
  | { type: "answer"; text: string }
  | { type: "done"; session: any }
  | { type: "error"; message: string };
