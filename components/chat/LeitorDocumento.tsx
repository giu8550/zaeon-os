"use client";
/**
 * LeitorDocumento — o leitor de PDF da sala (app/research-lab/PdfViewer: pdf.js, leitura em voz,
 * selecionar trecho → citação) numa aba de DOCUMENTO. PDF remoto passa pelo proxy autenticado
 * (/api/ai/scholar/pdf, guard anti-SSRF) — é o PdfViewer que decide. Citações vão pra mesma
 * aba de Citações da Sala de Pesquisa.
 */
import PdfViewer from "@/app/research-lab/PdfViewer";
import type { LibraryFile } from "@/lib/useLibraryFiles";
import { useSavedCitations } from "@/lib/useSavedCitations";
import { capabilities } from "@/lib/runtime/mode";

export default function LeitorDocumento({ file }: { file: LibraryFile }) {
  const { save } = useSavedCitations();
  const mode: "vercel" | "gemini" = capabilities().heavyRag ? "gemini" : "vercel";
  return <PdfViewer file={file} mode={mode} onCite={save} />;
}
