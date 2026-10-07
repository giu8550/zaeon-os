"use client";
/**
 * useAnexoChat — anexar arquivo NO CHAT (Sala de Estudos e Sala de Pesquisa, o mesmo comportamento):
 * 📎 do composer, ou soltar um arquivo em cima da conversa. O PDF NÃO abre no leitor — a IA lê e responde
 * sobre ele (vai junto em cada pergunta enquanto o chip 📎 estiver lá). O PDF também entra na biblioteca
 * (dá pra arrastar de lá pro leitor depois). Imagem: só anexa (Gemini Vision).
 *
 * `EVT_ANEXAR` (detail `{ sala, id, nome, dataUrl, perguntar? }`): a sala pede pro chat ler um arquivo da
 * biblioteca (ex.: ▶ de um documento) e, opcional, já perguntar algo.
 */
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useLibraryFiles, type LibraryFile } from "@/lib/useLibraryFiles";
import { blobParaDataUrl } from "@/lib/pdfStore";

export type AnexoChat = { id: string; nome: string; dataUrl: string };
export type SalaChat = "pesquisa" | "estudos";
export const EVT_ANEXAR = "zaeon:chat:anexar";

const ehPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** os bytes de um PDF da biblioteca como data: URL (remoto pelo proxy; upload local direto) */
export async function pdfDaBiblioteca(f: LibraryFile): Promise<string | null> {
  try {
    const r = await fetch(/^https?:\/\//i.test(f.pdfUrl) ? `/api/ai/scholar/pdf?url=${encodeURIComponent(f.pdfUrl)}` : f.pdfUrl);
    if (!r.ok) return null;
    return await blobParaDataUrl(await r.blob());
  } catch { return null; }
}

export function useAnexoChat(
  sala: SalaChat,
  o: { focar: () => void; perguntar: (texto: string) => void; /** soltar um documento DA BIBLIOTECA na conversa = a IA lê (Estudos) */ aceitaBiblioteca?: boolean },
) {
  const { saveFile, files } = useLibraryFiles();
  const filesRef = useRef(files);
  filesRef.current = files;
  const [anexo, setAnexo] = useState<AnexoChat | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const anexoRef = useRef<AnexoChat | null>(null);
  anexoRef.current = anexo;
  const oRef = useRef(o);
  oRef.current = o;

  const fixar = (a: AnexoChat | null) => { anexoRef.current = a; setAnexo(a); };

  const anexarArquivos = useCallback(async (files: File[]) => {
    const pdfs = files.filter(ehPdf);
    if (pdfs.length) {
      for (const [i, f] of pdfs.entries()) {
        const id = `pdf-${Date.now()}-${i}`, nome = f.name.replace(/\.pdf$/i, "");
        void saveFile({ id, title: nome, source: "upload", savedAt: Date.now() }, f);   // também na biblioteca
        if (i === 0) { const dataUrl = await blobParaDataUrl(f); if (dataUrl) fixar({ id, nome, dataUrl }); }
      }
      oRef.current.focar();
      return;
    }
    const img = files.find((f) => f.type.startsWith("image/"));
    if (img) { const dataUrl = await blobParaDataUrl(img); if (dataUrl) { fixar({ id: `img-${Date.now()}`, nome: img.name, dataUrl }); oRef.current.focar(); } }
  }, [saveFile]);

  const anexarDaBiblioteca = useCallback(async (id: string) => {
    const f = filesRef.current.find((x) => x.id === id); if (!f) return;
    const dataUrl = await pdfDaBiblioteca(f);
    if (dataUrl) { fixar({ id: f.id, nome: f.title, dataUrl }); oRef.current.focar(); }
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<AnexoChat & { sala: SalaChat; perguntar?: string }>).detail;
      if (!d?.dataUrl || d.sala !== sala) return;
      fixar({ id: d.id, nome: d.nome, dataUrl: d.dataUrl });
      if (d.perguntar) { const p = d.perguntar; setTimeout(() => oRef.current.perguntar(p), 0); } else oRef.current.focar();
    };
    window.addEventListener(EVT_ANEXAR, on);
    return () => window.removeEventListener(EVT_ANEXAR, on);
  }, [sala]);

  /** soltar arquivo(s) do computador em cima da conversa */
  const soltar = {
    onDragOver: (e: DragEvent) => {
      const t = e.dataTransfer.types;
      if (t.includes("Files") || (o.aceitaBiblioteca && t.includes("text/zaeon-file"))) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setArrastando(true); }
    },
    onDragLeave: (e: DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setArrastando(false); },
    onDrop: (e: DragEvent) => {
      setArrastando(false);
      const doc = o.aceitaBiblioteca ? e.dataTransfer.getData("text/zaeon-file") : "";
      if (doc) { e.preventDefault(); void anexarDaBiblioteca(doc); return; }
      if (!e.dataTransfer.files?.length) return;
      e.preventDefault();
      void anexarArquivos(Array.from(e.dataTransfer.files));
    },
  };

  return { anexo, anexoRef, tirar: () => { fixar(null); oRef.current.focar(); }, anexarArquivos, anexarDaBiblioteca, soltar, arrastando };
}

/** o chip 📎 acima do texto do composer */
export function ChipAnexo({ anexo, onTirar }: { anexo: AnexoChat; onTirar: () => void }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className="inline-flex items-center gap-1.5 max-w-full min-h-[32px] pl-3 pr-1 rounded-full text-[12px] font-semibold bg-cyan-500/12 border border-cyan-400/40 text-cyan-800 dark:text-cyan-100" title="A IA está lendo este arquivo">
        <span aria-hidden>📎</span>
        <span className="truncate max-w-[16rem]">{anexo.nome}</span>
        <button type="button" onClick={onTirar} aria-label="Parar de ler este arquivo" className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-cyan-500/20">×</button>
      </span>
    </div>
  );
}

/** o aviso "solte para a IA ler" por cima da conversa enquanto se arrasta um arquivo */
export function AvisoSoltar() {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none" style={{ background: "rgba(34,211,238,0.08)", backdropFilter: "blur(2px)" }}>
      <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: "rgba(8,47,73,0.92)", border: "1px solid rgba(34,211,238,0.7)" }}>
        <span aria-hidden>📎</span>
        <span className="text-[11px] font-black uppercase tracking-wide text-cyan-100">Soltar para a IA ler</span>
      </div>
    </div>
  );
}
