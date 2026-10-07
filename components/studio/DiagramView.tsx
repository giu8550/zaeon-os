"use client";

/**
 * DiagramView — o diagrama interativo (archify) dentro da resposta.
 *
 * O HTML é standalone e tem JS próprio (zoom, "seguir um caminho", lente, exportar PNG/SVG),
 * então mora num iframe SANDBOX (`allow-scripts` sem `allow-same-origin`: origem opaca, sem
 * acesso a cookie nem API do site). O HTML entra por `srcdoc` (buscado com a sessão do aluno)
 * e não por `src`: há navegadores/webviews que simplesmente não carregam iframe sandbox com URL
 * — o painel do app desktop é um deles. O /file ainda manda CSP `sandbox` pra quem abrir o link.
 * "Abrir numa aba" usa o mesmo arquivo; o botão do bloco baixa o .html (abre offline).
 */
import { useEffect, useState } from "react";
import { Maximize2, Minimize2, ExternalLink } from "lucide-react";

export default function DiagramView({ artifactId, titulo }: { artifactId: string; titulo?: string }) {
  const [alto, setAlto] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const url = `/api/studio/${artifactId}/file`;

  useEffect(() => {
    let vivo = true;
    setHtml(null);
    setErro(false);
    fetch(url, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { if (vivo) setHtml(t); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [url]);

  const altura = alto ? "h-[78vh]" : "h-[440px]";
  if (erro) return <div className="text-[12px] text-slate-500 dark:text-white/50 px-1 py-3">Não consegui abrir o diagrama agora.</div>;
  if (html === null) {
    return <div className={`w-full ${altura} rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] animate-pulse`} aria-label="Carregando o diagrama" />;
  }
  return (
    <div className="relative">
      <iframe
        srcDoc={html}
        title={titulo ? `Diagrama: ${titulo}` : "Diagrama interativo"}
        sandbox="allow-scripts allow-downloads allow-popups"
        referrerPolicy="no-referrer"
        className={`w-full rounded-xl border border-slate-200 dark:border-white/10 bg-[#020617] transition-[height] ${altura}`}
      />
      <div className="absolute top-2 left-2 flex gap-1">
        <button
          type="button"
          onClick={() => setAlto((v) => !v)}
          aria-label={alto ? "Diminuir o diagrama" : "Aumentar o diagrama"}
          title={alto ? "Diminuir" : "Aumentar"}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/55 text-white/80 hover:text-white hover:bg-black/75"
        >
          {alto ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir o diagrama numa aba"
          title="Abrir em tela cheia"
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-black/55 text-white/80 hover:text-white hover:bg-black/75"
        >
          <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}
