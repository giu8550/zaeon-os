"use client";
/** Um artefato-documento ocupando a aba inteira da sala (diagrama interativo ou aula). */
import DiagramView from "@/components/studio/DiagramView";
import AulaView from "@/components/aula-interativa/AulaView";
import type { DocArtefato } from "@/lib/chat/documentos";

export default function DocumentoArtefato({ doc }: { doc: Pick<DocArtefato, "studioKind" | "artifactId" | "titulo" | "data"> }) {
  if (doc.studioKind === "diagram") {
    return <div className="h-full p-3"><DiagramView artifactId={doc.artifactId} titulo={doc.titulo} cheio /></div>;
  }
  if (doc.studioKind === "aula") {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-3 sm:p-5 bg-[#070d1a]">
        <div className="mx-auto w-full max-w-[min(100%,calc((100vh-18rem)*16/9))]">
          <AulaView artifactId={doc.artifactId} dados={doc.data} grande />
        </div>
      </div>
    );
  }
  return <div className="p-6 text-[13px] text-slate-500">Documento indisponível.</div>;
}
