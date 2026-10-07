"use client";

/**
 * AulaView — a aula dentro da conversa: busca o roteiro + tempos do artefato (/api/studio/[id]) e
 * toca no AulaPlayer; "tela cheia" abre o mesmo player grande num modal (Esc fecha). A narração
 * de cada beat vem de /api/studio/[id]/aula/[beat]. O artefato fica salvo no Studio do aluno —
 * dá pra voltar nele depois (é um documento, não uma mensagem).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import AulaPlayer from "@/components/aula-interativa/AulaPlayer";
import type { Aula, Beat, TempoBeat } from "@/lib/aula-interativa/contrato";

type Dados = { aula: Aula; tempos: Record<string, TempoBeat> };

export default function AulaView({ artifactId, dados: inicial }: { artifactId: string; dados?: Partial<Dados> | null }) {
  const [dados, setDados] = useState<Dados | null>(inicial?.aula && inicial?.tempos ? (inicial as Dados) : null);
  const [erro, setErro] = useState(false);
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    if (dados) return;
    let vivo = true;
    fetch(`/api/studio/${artifactId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((a) => { if (vivo && a?.meta?.aula) setDados({ aula: a.meta.aula, tempos: a.meta.tempos ?? {} }); else if (vivo) setErro(true); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [artifactId, dados]);

  useEffect(() => {
    if (!cheia) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setCheia(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [cheia]);

  if (erro) return <div className="text-[12px] text-slate-500 dark:text-white/50 px-1 py-3">Não consegui abrir a aula agora.</div>;
  if (!dados) return <div className="w-full aspect-video rounded-2xl bg-slate-200/60 dark:bg-white/[0.04] animate-pulse" aria-label="Carregando a aula" />;

  const audioDe = (b: Beat) => (dados.tempos[b.id]?.audio ? `/api/studio/${artifactId}/aula/${encodeURIComponent(b.id)}` : null);
  return (
    <>
      {!cheia && <AulaPlayer aula={dados.aula} tempos={dados.tempos} audioDe={audioDe} onTelaCheia={() => setCheia(true)} />}
      {cheia && createPortal(
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`Aula: ${dados.aula.titulo}`}>
          <div className="relative w-full max-w-[min(1400px,calc((100vh-9rem)*16/9))]">
            <button type="button" onClick={() => setCheia(false)} aria-label="Fechar a tela cheia" className="absolute -top-10 right-0 w-8 h-8 rounded-full flex items-center justify-center bg-white/10 text-white hover:bg-white/20"><X size={16} /></button>
            <AulaPlayer aula={dados.aula} tempos={dados.tempos} audioDe={audioDe} grande />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
