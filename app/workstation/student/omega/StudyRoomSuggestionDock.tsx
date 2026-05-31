// app/workstation/student/omega/StudyRoomSuggestionDock.tsx
"use client";
import { useEffect, useState } from "react";
import { useOmegaScholar } from "./OmegaScholarContext";
import ContextualSuggestionDock from "@/components/research/ContextualSuggestionDock";

export default function StudyRoomSuggestionDock() {
  const { draft, setDraft } = useOmegaScholar();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(id);
  }, [draft]);

  // "Usar como título →" semeia a barra Omega (não há editor de doc nesta tela).
  return <ContextualSuggestionDock topic={debounced} onSelectTitle={(t) => setDraft(t)} />;
}
