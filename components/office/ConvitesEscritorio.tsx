"use client";

/**
 * Peças do convite do escritório (#396, item D), separadas do CoworkingCanal pra serem testáveis:
 *   ConvidarForm      → o "+" ao lado da foto do dono: e-mail (ou nome) e Convidar.
 *   (Os convites recebidos e o status deles agora ficam no SINO — components/office/SinoConvites, #423.)
 * Os dados e as chamadas ficam no CoworkingCanal; aqui só desenho + callbacks.
 */
import { useState } from "react";
import { VIDRO_CHIP, TXT, TXT_2 } from "@/lib/canal/vidro";

export type PessoaConvite = { id: string; nome: string; avatar: string | null };
export type ConviteVista = { id: string; status: string; dmCanalId: string | null; pessoa: PessoaConvite };

export function ConvidarForm({ onEnviar, variante = "caixa", onFechar }: {
  onEnviar: (para: string) => Promise<{ ok: boolean; msg: string }>;
  /** #423: "linha" = abre NA HORIZONTAL ao lado do botão + (campo, botão e resposta numa linha só). */
  variante?: "caixa" | "linha";
  /** só na "linha": Esc fecha. */
  onFechar?: () => void;
}) {
  const [para, setPara] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const enviar = async () => {
    const t = para.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const r = await onEnviar(t);
      setResultado(r);
      if (r.ok) setPara("");
    } finally {
      setEnviando(false);
    }
  };
  if (variante === "linha") {
    return (
      <div className="flex items-center gap-1.5 min-w-0" role="group" aria-label="Convidar pessoa">
        <input value={para} autoFocus onChange={(e) => { setPara(e.target.value); setResultado(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void enviar(); if (e.key === "Escape") onFechar?.(); }}
          placeholder="e-mail (ou nome)" aria-label="E-mail ou nome de quem convidar"
          className={`w-[min(46vw,220px)] min-w-0 min-h-[40px] px-3 rounded-xl text-[13px] bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
        <button type="button" onClick={() => void enviar()} disabled={!para.trim() || enviando}
          className={`shrink-0 min-h-[40px] px-3 rounded-xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT} disabled:opacity-40`}>Convidar</button>
        {resultado && (
          <span role={resultado.ok ? "status" : "alert"} title={resultado.msg}
            className={`max-w-[38vw] sm:max-w-[220px] truncate text-[11.5px] ${resultado.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{resultado.msg}</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-[12px] font-bold ${TXT}`}>Convidar pra conversar</p>
      <p className={`text-[11.5px] ${TXT_2}`}>O convite chega no sino da pessoa. Depois que ela aceitar, você pode pô-la nos seus escritórios de turma e aberto.</p>
      <div className="flex gap-1.5">
        <input value={para} onChange={(e) => { setPara(e.target.value); setResultado(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void enviar(); }}
          placeholder="e-mail (ou nome) da pessoa" aria-label="E-mail ou nome de quem convidar"
          className={`flex-1 min-h-[40px] px-3 rounded-xl text-[13px] bg-white/70 dark:bg-white/[0.06] border border-white/60 dark:border-white/10 ${TXT} placeholder:text-slate-400 dark:placeholder:text-white/35 outline-none focus:border-blue-400/70`} />
        <button type="button" onClick={() => void enviar()} disabled={!para.trim() || enviando}
          className={`min-h-[40px] px-3 rounded-xl text-[12px] font-bold ${VIDRO_CHIP} ${TXT} disabled:opacity-40`}>Convidar</button>
      </div>
      {resultado && (
        <p role={resultado.ok ? "status" : "alert"} className={`text-[11.5px] ${resultado.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{resultado.msg}</p>
      )}
    </div>
  );
}
