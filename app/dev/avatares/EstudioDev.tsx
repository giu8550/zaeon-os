"use client";

import { useCallback, useEffect, useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import EstudioAvatar from "@/components/agents/avatar/EstudioAvatar";
import { carregarManifestos, invalidarManifestos } from "@/components/agents/avatar/hooks";
import { AVATAR_LOOKS } from "@/lib/avatars/looks";
import type { AvatarManifest } from "@/lib/avatars/estados";
import { VIDRO_CHIP, TXT, TXT_MUDO } from "@/lib/canal/vidro";

export default function EstudioDev() {
  const ids = Object.keys(AVATAR_LOOKS);
  const [id, setId] = useState(ids[0]);
  const [mapa, setMapa] = useState<Record<string, AvatarManifest>>({});
  const [rev, setRev] = useState(0);
  const recarregar = useCallback(() => { invalidarManifestos(); void carregarManifestos().then(setMapa); setRev((r) => r + 1); }, []);
  useEffect(() => { void carregarManifestos().then(setMapa); }, []);
  const look = AVATAR_LOOKS[id];

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 dark:from-[#060a16] dark:to-[#0b1020] p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className={`text-xl font-black tracking-tight ${TXT}`}>Estúdio de avatar vivo</h1>
        <span className={`text-[11px] font-bold uppercase tracking-widest ${TXT_MUDO}`}>Etapa A · dev · salva em public/avatars</span>
      </header>
      <nav className="flex gap-2 overflow-x-auto pb-3 mb-4" aria-label="Agentes">
        {ids.map((k) => (
          <button key={k} type="button" onClick={() => setId(k)} aria-pressed={k === id}
            className={`shrink-0 min-h-[44px] pl-1.5 pr-3 rounded-full flex items-center gap-2 text-[13px] font-semibold ${VIDRO_CHIP} ${k === id ? `ring-2 ring-cyan-400 ${TXT}` : TXT_MUDO}`}>
            <AgentAvatar agentId={k} nome={AVATAR_LOOKS[k].nome} size={32} key={`${k}-${rev}`} />
            {AVATAR_LOOKS[k].nome}{mapa[k] ? " ✓" : ""}
          </button>
        ))}
      </nav>
      <EstudioAvatar
        key={`${id}-${rev}`}
        endpoint="/api/dev/avatares"
        agentId={id}
        nome={look.nome}
        personagemInicial={look.personagem}
        corInicial={look.cor}
        existente={mapa[id] ?? null}
        baseUrlExistente={mapa[id] ? `/avatars/${id}/base.webp` : null}
        extraSalvar={{ agentId: id }}
        onSalvo={recarregar}
      />
    </main>
  );
}
