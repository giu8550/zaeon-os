"use client";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { X } from "lucide-react";
import { useEffect } from "react";

export default function PdfViewerModal({ pdfUrl, page, quote, onClose }:
  { pdfUrl: string; page: number; quote: string; onClose: () => void }) {
  const nav = pageNavigationPlugin();
  const proxied = `/api/ai/scholar/pdf?url=${encodeURIComponent(pdfUrl)}`;
  useEffect(() => { const t = setTimeout(() => nav.jumpToPage(Math.max(0, page - 1)), 600); return () => clearTimeout(t); }, [page]);

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-[#0a0a0a] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-500">Página {page} — trecho citado</p>
            <p className="text-xs italic text-slate-600 dark:text-white/60 mt-1">&quot;{quote}&quot;</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
            <Viewer fileUrl={proxied} plugins={[nav]} />
          </Worker>
        </div>
      </div>
    </div>
  );
}
