"use client";
/**
 * Carregando — "Abrindo o escritório…/Abrindo o canal…" com aviso de demora (#645) e o que fazer quando a internet falha
 * (#657). O site não sabe se a lentidão é da internet (o Firefox nem informa a conexão), então a demora é avisada pelo
 * TEMPO: passou de AVISO_MS, explica que pode ser a conexão; passou de TENTAR_MS, oferece "Tentar de novo".
 * #657: se a busca FALHOU, não espera — avisa na hora; sem internet (o navegador sabe), diz isso e que abre sozinho
 * quando voltar. O pontinho girando mostra que não travou.
 */
import { useEffect, useState } from "react";
import { TXT_MUDO } from "@/lib/canal/vidro";

export const AVISO_MS = 4_000;
export const TENTAR_MS = 15_000;

export default function Carregando({ texto, onTentar, falhou = false, offline = false }: {
  texto: string;
  /** tenta de novo SÓ o Escritório (não recarrega a página) */
  onTentar: () => void;
  /** #657: a busca falhou (não é demora) */
  falhou?: boolean;
  /** #657: o navegador está sem internet */
  offline?: boolean;
}) {
  const [fase, setFase] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    setFase(0);
    const a = setTimeout(() => setFase(1), AVISO_MS);
    const b = setTimeout(() => setFase(2), TENTAR_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [texto, falhou, offline]);
  const parado = falhou || offline;
  const titulo = offline ? "Você está sem internet" : falhou ? "Não deu pra abrir o Escritório" : texto;
  const aviso = offline
    ? "Assim que a conexão voltar, o Escritório abre sozinho."
    : falhou
      ? "A conexão falhou no meio do caminho."
      : fase >= 1 ? "Está demorando mais que o normal — pode ser a conexão. Aguarde um pouquinho…" : null;
  return (
    <div role="status" aria-live="polite" className={`w-full h-full grid place-items-center text-center text-[13px] ${TXT_MUDO}`}>
      <div className="flex flex-col items-center gap-2.5 px-6">
        {!parado && <span aria-hidden data-girando className="h-5 w-5 rounded-full border-2 border-current border-t-transparent opacity-70 animate-spin motion-reduce:animate-none" />}
        <span className={parado ? "font-semibold text-slate-700 dark:text-white/80" : ""}>{titulo}</span>
        {aviso && <span className="max-w-[340px] text-[12.5px] text-slate-600 dark:text-white/65">{aviso}</span>}
        {(parado || fase >= 2) && (
          <button type="button" onClick={onTentar}
            className="mt-1 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border border-blue-500/40 text-blue-700 hover:bg-blue-500/10 dark:border-cyan-300/40 dark:text-cyan-200 dark:hover:bg-cyan-300/10">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}
