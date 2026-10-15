"use client";

/**
 * Peças do convite do escritório (#396, item D), separadas do CoworkingCanal pra serem testáveis:
 *   ConvidarForm      → o "+" ao lado da foto do dono: e-mail (ou nome) e Convidar.
 *   ConvitesRecebidos → na aba Privado: convites que chegaram (Aceitar / Recusar) e os que você mandou.
 * Os dados e as chamadas ficam no CoworkingCanal; aqui só desenho + callbacks.
 */
import { useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { VIDRO_CHIP, TXT, TXT_2, TXT_MUDO } from "@/lib/canal/vidro";

export type PessoaConvite = { id: string; nome: string; avatar: string | null };
export type ConviteVista = { id: string; status: string; dmCanalId: string | null; pessoa: PessoaConvite };

export function ConvidarForm({ onEnviar }: { onEnviar: (para: string) => Promise<{ ok: boolean; msg: string }> }) {
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
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-[12px] font-bold ${TXT}`}>Convidar pra conversar</p>
      <p className={`text-[11.5px] ${TXT_2}`}>O convite chega na aba Privado da pessoa. Depois que ela aceitar, você pode pô-la nos seus escritórios de turma e aberto.</p>
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

export function ConvitesRecebidos({ recebidos, enviados, ocupado, onResponder }: {
  recebidos: ConviteVista[];
  enviados: ConviteVista[];
  /** id do convite sendo respondido (botões desligados). */
  ocupado: string | null;
  onResponder: (id: string, acao: "aceitar" | "recusar") => void;
}) {
  if (!recebidos.length && !enviados.length) return null;
  return (
    <div className="mt-1 flex flex-col gap-1.5 p-1">
      {recebidos.length > 0 && <p className={`px-2 text-[10.5px] font-bold uppercase tracking-wider ${TXT_MUDO}`}>Convites recebidos</p>}
      {recebidos.map((c) => (
        <div key={c.id} className="flex items-center gap-2 px-2">
          <AgentAvatar src={c.pessoa.avatar} nome={c.pessoa.nome} size={26} />
          <span className={`flex-1 min-w-0 truncate text-[12.5px] ${TXT}`}><b>{c.pessoa.nome}</b> quer conversar</span>
          <button type="button" onClick={() => onResponder(c.id, "aceitar")} disabled={ocupado === c.id}
            aria-label={`Aceitar o convite de ${c.pessoa.nome}`}
            className="min-h-[32px] px-2.5 rounded-lg text-[11.5px] font-bold bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-900 disabled:opacity-40">Aceitar</button>
          <button type="button" onClick={() => onResponder(c.id, "recusar")} disabled={ocupado === c.id}
            aria-label={`Recusar o convite de ${c.pessoa.nome}`}
            className={`min-h-[32px] px-2.5 rounded-lg text-[11.5px] font-bold ${VIDRO_CHIP} ${TXT_2} disabled:opacity-40`}>Recusar</button>
        </div>
      ))}
      {enviados.length > 0 && <p className={`px-2 pt-1 text-[10.5px] font-bold uppercase tracking-wider ${TXT_MUDO}`}>Esperando resposta</p>}
      {enviados.map((c) => (
        <div key={c.id} className={`flex items-center gap-2 px-2 text-[12px] ${TXT_2}`}>
          <AgentAvatar src={c.pessoa.avatar} nome={c.pessoa.nome} size={22} />
          <span className="truncate">{c.pessoa.nome}</span>
          <span className={`ml-auto text-[10.5px] ${TXT_MUDO}`}>aguardando</span>
        </div>
      ))}
    </div>
  );
}
