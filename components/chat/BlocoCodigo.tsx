"use client";
/**
 * BlocoCodigo — o ```código``` de uma resposta (#634). Antes saía como parágrafo comum: as crases na tela e o
 * `# comentário` do Python virando título. Agora é uma caixa ESCURA nos dois temas (destaca do texto em volta),
 * com a linguagem em cima, "Copiar", rolagem pro lado (código não quebra linha) e cores leves (lib/chat/codigo).
 */
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { colorirCodigo, type PedacoCodigo } from "@/lib/chat/codigo";

const COR: Record<PedacoCodigo["tipo"], string> = {
  texto: "",
  comentario: "text-slate-500 italic",
  string: "text-emerald-300",
  numero: "text-amber-300",
  palavra: "text-sky-300",
};

export default function BlocoCodigo({ codigo, lang }: { codigo: string; lang?: string }) {
  const pedacos = useMemo(() => colorirCodigo(codigo, lang), [codigo, lang]);
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sem permissão de área de transferência: o texto continua selecionável */ }
  };
  return (
    <div data-bloco-codigo className="my-3 overflow-hidden rounded-xl border border-slate-900/20 dark:border-white/10 bg-[#0b1220] shadow-sm not-italic">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-400">
        <span className="font-mono">{lang || "código"}</span>
        <button type="button" onClick={copiar} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-slate-200">
          {copiado ? <Check size={12} /> : <Copy size={12} />}{copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="custom-scrollbar overflow-x-auto p-3 text-[0.86em] leading-[1.6] text-slate-100">
        <code className="font-mono">{pedacos.map((p, i) => (p.tipo === "texto" ? p.t : <span key={i} className={COR[p.tipo]}>{p.t}</span>))}</code>
      </pre>
    </div>
  );
}
