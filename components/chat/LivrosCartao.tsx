"use client";
/**
 * LivrosCartao — os livros que o buscar_livro achou (answer.livros), com as ações certas pra cada um:
 *   PDF livre      → "Abrir no leitor" (guarda na biblioteca da sala + abre numa aba de documento) · "Baixar"
 *   leitura online → "Ler online" · empréstimo → "Pegar emprestado" · prévia → "Ver prévia"
 * Substitui a lista em markdown do texto (que fica pros clientes sem cartão: escritório, mobile).
 */
import { useState } from "react";
import { BookOpen, Download, ExternalLink, Check } from "lucide-react";
import { abrirDocumento } from "@/lib/chat/documentos";
import { useLibraryFiles, type LibraryFile } from "@/lib/useLibraryFiles";
import type { StructuredAnswer } from "@/lib/agent/contracts";

type Livro = NonNullable<StructuredAnswer["livros"]>[number];

const ROTULO: Record<string, string> = { pdf_livre: "PDF livre", ler_online: "leitura livre", emprestimo: "empréstimo digital grátis", previa: "prévia", sem_acesso_livre: "sem cópia livre" };
const FONTE: Record<string, string> = { openstax: "OpenStax", gutenberg: "Project Gutenberg", openlibrary: "Open Library", google_books: "Google Books" };

/** PURO: id estável do livro na biblioteca (o mesmo livro aberto 2× não duplica). */
export function idDoLivro(l: Pick<Livro, "pdfUrl" | "paginaUrl">): string {
  const base = l.pdfUrl || l.paginaUrl;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0;
  return `livro-${(h >>> 0).toString(36)}`;
}
/** PURO: o livro como arquivo da biblioteca (pdfUrl remoto — o leitor usa o proxy). */
export function livroParaArquivo(l: Livro): LibraryFile | null {
  if (!l.pdfUrl) return null;
  return { id: idDoLivro(l), title: l.titulo, pdfUrl: l.pdfUrl, url: l.paginaUrl, authors: l.autores, ...(l.ano ? { year: l.ano } : {}), source: FONTE[l.fonte] ?? l.fonte, savedAt: Date.now() };
}

/** PURO: "autores · ano · acesso · licença · fonte" (sem repetir a fonte quando ela é o autor, ex.: OpenStax). */
export function linhaDoLivro(l: Livro): string {
  const autores = l.autores.slice(0, 2).join(", "), fonte = FONTE[l.fonte] ?? l.fonte;
  return [autores, l.ano, ROTULO[l.acesso] ?? l.acesso, l.licenca, fonte === autores ? null : fonte].filter(Boolean).join(" · ");
}

const BTN = "inline-flex items-center gap-1 min-h-[30px] px-2.5 rounded-lg text-[12px] font-semibold transition-colors";

export default function LivrosCartao({ livros, sala }: { livros: Livro[]; sala: "estudos" | "pesquisa" }) {
  const { save } = useLibraryFiles();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  if (!livros.length) return null;

  const abrir = async (l: Livro) => {
    const f = livroParaArquivo(l);
    if (!f) return;
    await save(f);   // fica na biblioteca da sala (aba Pesquisa → biblioteca) pra ler depois
    abrirDocumento({ sala, studioKind: "pdf", artifactId: f.id, titulo: l.titulo, data: { file: f }, focar: true });
    setAbertos((s) => new Set(s).add(f.id));
  };

  return (
    <div className="mt-2 w-full max-w-[88%] space-y-2" role="list" aria-label="Livros encontrados">
      {livros.map((l) => {
        const id = idDoLivro(l);
        return (
          <div key={id} role="listitem" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-slate-900 dark:text-white leading-snug">📕 {l.titulo}</div>
              <div className="text-[12px] text-slate-500 dark:text-white/55">
                {linhaDoLivro(l)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {l.pdfUrl && (
                <button type="button" onClick={() => void abrir(l)} className={`${BTN} bg-cyan-500 text-slate-950 hover:bg-cyan-400`}>
                  {abertos.has(id) ? <Check size={13} /> : <BookOpen size={13} />} {abertos.has(id) ? "Aberto no leitor" : "Abrir no leitor"}
                </button>
              )}
              {l.pdfUrl && <a href={l.pdfUrl} target="_blank" rel="noopener noreferrer" className={`${BTN} text-slate-700 dark:text-white/80 hover:bg-slate-900/5 dark:hover:bg-white/10`}><Download size={13} /> Baixar</a>}
              {!l.pdfUrl && l.lerUrl && (
                <a href={l.lerUrl} target="_blank" rel="noopener noreferrer" className={`${BTN} text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10`}>
                  <ExternalLink size={13} /> {l.acesso === "emprestimo" ? "Pegar emprestado" : l.acesso === "previa" ? "Ver prévia" : "Ler online"}
                </a>
              )}
              <a href={l.paginaUrl} target="_blank" rel="noopener noreferrer" className={`${BTN} text-slate-500 dark:text-white/55 hover:bg-slate-900/5 dark:hover:bg-white/10`}>Página</a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
