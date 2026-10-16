"use client";
/**
 * PreviaSvg — desenha um arquivo .svg como IMAGEM (#421: a arte do Octa aparecia só como código).
 *   tamanho="grande" → a prévia do editor (modo Visualizar).
 *   tamanho="mini"   → a miniatura no chat do agente, ao lado do arquivo que ele gravou.
 * Sempre por <img src="data:image/svg+xml,…">: numa <img> o navegador não roda <script> do SVG nem busca
 * nada de fora. Nunca injeta o SVG na página. Regra pura em lib/octa/ideWorkspace (svgParaDataUrl).
 */
import { useEffect, useMemo, useState } from "react";
import { svgParaDataUrl } from "@/lib/octa/ideWorkspace";

export default function PreviaSvg({ conteudo, titulo, tamanho = "grande", onClick }: {
  conteudo: string;
  /** nome do arquivo (vira o texto alternativo da imagem). */
  titulo: string;
  tamanho?: "grande" | "mini";
  /** só na miniatura: abrir o arquivo no editor. */
  onClick?: () => void;
}) {
  const url = useMemo(() => svgParaDataUrl(conteudo), [conteudo]);
  // o navegador avisa (onError) quando o SVG está quebrado; volta a tentar quando o conteúdo muda
  const [quebrou, setQuebrou] = useState(false);
  useEffect(() => { setQuebrou(false); }, [url]);
  const alt = `Arte: ${titulo}`;

  if (tamanho === "mini") {
    if (!url || quebrou) return null; // no chat, sem miniatura é melhor que um aviso de erro
    return (
      <button type="button" onClick={onClick} title={`Abrir ${titulo}`} aria-label={`Abrir ${titulo}`}
        className="w-20 h-20 rounded-md overflow-hidden border border-white/10 hover:border-white/30 bg-[#21252b] shrink-0">
        <img src={url} alt={alt} className="w-full h-full object-contain" onError={() => setQuebrou(true)} />
      </button>
    );
  }

  if (!url || quebrou) {
    return (
      <div role="alert" className="w-full h-full grid place-items-center p-6 text-center text-[13px] text-[#d07277]">
        Não deu pra desenhar: o SVG tem erro. Abra em “Código” pra ver ou corrigir.
      </div>
    );
  }
  return (
    <div className="w-full h-full grid place-items-center p-4 overflow-auto bg-[#21252b]">
      <img src={url} alt={alt} className="max-w-full max-h-full object-contain rounded shadow-lg" onError={() => setQuebrou(true)} />
    </div>
  );
}
