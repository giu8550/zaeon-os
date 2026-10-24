"use client";
/**
 * SeletorPersona — no topo do chat: Aura · Zenita · Nina. A escolhida é o avatar 3D do painel dos documentos
 * (components/research/ZaeonDocumentos). O Octa Code não entra: ele não tem avatar.
 */
import { useEffect, useState } from "react";
import { EVT_PERSONA, PERSONAS, escolherPersona, personaSalva, personaValida, type PersonaId } from "@/lib/research/zaeonEventos";

export function usePersona(): PersonaId {
  const [p, setP] = useState<PersonaId>("aura");
  useEffect(() => {
    setP(personaSalva());
    const on = (e: Event) => setP(personaValida((e as CustomEvent).detail));
    window.addEventListener(EVT_PERSONA, on);
    return () => window.removeEventListener(EVT_PERSONA, on);
  }, []);
  return p;
}

export default function SeletorPersona() {
  const atual = usePersona();
  return (
    <div role="radiogroup" aria-label="Avatar do painel" className="flex items-center gap-0.5 rounded-full border p-0.5 border-slate-200 bg-white/70 dark:border-white/10 dark:bg-white/[0.04]">
      {PERSONAS.map((p) => {
        const ativa = p.id === atual;
        return (
          <button key={p.id} type="button" role="radio" aria-checked={ativa} title={`Avatar: ${p.nome}`} onClick={() => escolherPersona(p.id)}
            className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] font-bold transition-colors
              ${ativa ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200" : "text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/avatars/${p.id}/idle.sm.webp`} alt="" width={20} height={20} className={`h-5 w-5 rounded-full object-cover object-top ${ativa ? "ring-2 ring-cyan-400/70" : "opacity-70"}`} />
            <span className="hidden sm:inline">{p.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
