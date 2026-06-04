"use client";
import ResearchSuggestionPanel from "@/components/research/ResearchSuggestionPanel";
import OmegaRelatedResearch from "./OmegaRelatedResearch";
import { useOmegaScholar } from "./OmegaScholarContext";

// Highlight de sugestão dentro da aba Omega, semeado pela query/draft atual do Omega.
// O painel de sugestão fica em standby (recolhido), expandindo ao clicar; abaixo dele,
// os projetos relacionados ao input do Omega aparecem sempre.
export default function OmegaSuggestionHighlight() {
  const { query, draft, setDraft } = useOmegaScholar();
  const seed = (query || draft || "").trim();
  return (
    <div className="mb-6">
      <ResearchSuggestionPanel
        docTitle={seed}
        onSelectTitle={(t) => setDraft(t)}
        collapsible
        defaultCollapsed
      />
      <OmegaRelatedResearch />
    </div>
  );
}
