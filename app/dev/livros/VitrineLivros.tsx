"use client";
import { useEffect, useState } from "react";
import LivrosCartao from "@/components/chat/LivrosCartao";
import ChatMarkdown from "@/components/study/ChatMarkdown";
import { EVT_ABRIR_DOC, type DocArtefato } from "@/lib/chat/documentos";

const LIVROS = [
  { titulo: "Calculus Volume 1", autores: ["OpenStax"], ano: 2016, acesso: "pdf_livre", pdfUrl: "https://assets.openstax.org/oscms-prodcms/media/documents/calculus-volume-1_-_WEB.pdf", lerUrl: "https://openstax.org/details/books/calculus-volume-1", paginaUrl: "https://openstax.org/details/books/calculus-volume-1", fonte: "openstax", licenca: "CC BY 4.0" },
  { titulo: "Dom Casmurro", autores: ["Machado de Assis"], ano: 1899, acesso: "pdf_livre", pdfUrl: "https://archive.org/download/bwb_P9-BIH-494/bwb_P9-BIH-494.pdf", lerUrl: null, paginaUrl: "https://openlibrary.org/works/OL43027352W", fonte: "openlibrary", licenca: "domínio público" },
  { titulo: "Pride and Prejudice", autores: ["Jane Austen"], ano: null, acesso: "ler_online", pdfUrl: null, lerUrl: "https://www.gutenberg.org/ebooks/1342.html.images", paginaUrl: "https://www.gutenberg.org/ebooks/1342", fonte: "gutenberg", licenca: "domínio público" },
  { titulo: "Sapiens", autores: ["Yuval Noah Harari"], ano: 2011, acesso: "emprestimo", pdfUrl: null, lerUrl: "https://openlibrary.org/works/OL17075811W/borrow", paginaUrl: "https://openlibrary.org/works/OL17075811W", fonte: "openlibrary", licenca: null },
];

export default function VitrineLivros() {
  const [abertos, setAbertos] = useState<DocArtefato[]>([]);
  useEffect(() => {
    const on = (e: Event) => setAbertos((xs) => [...xs, (e as CustomEvent<DocArtefato>).detail]);
    window.addEventListener(EVT_ABRIR_DOC, on);
    return () => window.removeEventListener(EVT_ABRIR_DOC, on);
  }, []);
  return (
    <main className="min-h-screen bg-white dark:bg-[#0b1020] px-4 py-10">
      <div className="mx-auto max-w-[720px] text-[15px] text-slate-800 dark:text-white/90">
        <div className="rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] p-5">
          <ChatMarkdown text="Achei o **Calculus Volume 1** da OpenStax em PDF livre (licença aberta) — é a opção mais direta. Dom Casmurro está em domínio público; Sapiens tem direito autoral, então o caminho legal é o empréstimo digital." />
        </div>
        <LivrosCartao livros={LIVROS} sala="estudos" />
        <pre className="mt-6 text-[12px] text-slate-500 dark:text-white/50">{abertos.length ? abertos.map((d) => `aberto: ${d.studioKind} · ${d.titulo}`).join("\n") : "(nenhum aberto)"}</pre>
      </div>
    </main>
  );
}
