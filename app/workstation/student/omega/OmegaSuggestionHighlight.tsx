"use client";
import ResearchSuggestionPanel from "@/components/research/ResearchSuggestionPanel";
import { useOmegaScholar } from "./OmegaScholarContext";

// Highlight de sugestão dentro da aba Omega, semeado pela query/draft atual do Omega.
export default function OmegaSuggestionHighlight() {
  const { query, draft, setDraft } = useOmegaScholar();
  const seed = (query || draft || "").trim();
  return (
    <div className="mb-6">
      <ResearchSuggestionPanel docTitle={seed} onSelectTitle={(t) => setDraft(t)} />
    </div>
  );
}
