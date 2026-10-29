"use client";
/**
 * Carregando — "Abrindo o escritório…/Abrindo o canal…" com aviso de demora (#645). O site não sabe se a lentidão é
 * da internet (o Firefox nem informa a conexão), então avisa pelo TEMPO: passou de AVISO_MS, explica que pode ser a
 * conexão; passou de TENTAR_MS, oferece "Tentar de novo" (ninguém fica preso na tela).
 */
import { useEffect, useState } from "react";
import { TXT_MUDO } from "@/lib/canal/vidro";

export const AVISO_MS = 4_000;
export const TENTAR_MS = 15_000;

export default function Carregando({ texto, onTentar }: { texto: string; onTentar: () => void }) {
  const [fase, setFase] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const a = setTimeout(() => setFase(1), AVISO_MS);
    const b = setTimeout(() => setFase(2), TENTAR_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [texto]);
  return (
    <div role="status" className={`w-full h-full grid place-items-center text-center text-[13px] ${TXT_MUDO}`}>
      <div className="flex flex-col items-center gap-2 px-6">
        <span>{texto}</span>
        {fase >= 1 && <span className="text-[12px] opacity-80">Está demorando mais que o normal — pode ser a conexão. Aguarde um pouquinho…</span>}
        {fase >= 2 && (
          <button type="button" onClick={onTentar}
            className="mt-1 px-3 py-1.5 rounded-full text-[12px] font-semibold border border-blue-500/40 text-blue-700 hover:bg-blue-500/10 dark:border-cyan-300/40 dark:text-cyan-200 dark:hover:bg-cyan-300/10">
            Tentar de novo
          </button>
        )}
      </div>
    </div>
  );
}
