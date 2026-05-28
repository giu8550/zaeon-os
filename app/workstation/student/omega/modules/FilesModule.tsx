"use client";
import { Download } from "lucide-react";
export default function FilesModule({ files }: { files: { name: string; kind: string; content: string }[] }) {
  if (!files?.length) return <p className="text-xs text-slate-400">Nenhum arquivo gerado ainda.</p>;
  const dl = (f: any) => {
    const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
  };
  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <button key={i} onClick={() => dl(f)} className="w-full flex items-center gap-2 text-left rounded-xl bg-white/60 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 px-3 py-2.5 hover:border-violet-400/40">
          <Download size={14} className="text-violet-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-white/80">{f.name}</span>
        </button>
      ))}
    </div>
  );
}
