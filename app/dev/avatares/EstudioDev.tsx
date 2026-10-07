"use client";

/**
 * Estúdio da Etapa A com FILA: todos os agentes ficam montados (rascunho de um não some ao abrir
 * outro), "gerar todos que faltam" gera 2 por vez e as abas mostram o progresso — o dono revisa e
 * aprova cada um quando quiser. Nada é salvo sem aprovação (o salvar é por agente).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import EstudioAvatar from "@/components/agents/avatar/EstudioAvatar";
import { carregarManifestos, invalidarManifestos } from "@/components/agents/avatar/hooks";
import { AVATAR_LOOKS } from "@/lib/avatars/looks";
import type { AvatarManifest } from "@/lib/avatars/estados";
import { VIDRO_CHIP, TXT, TXT_MUDO } from "@/lib/canal/vidro";

type Status = { rodando: boolean; prontos: number; aprovados: number; falhas: number };
const SIMULTANEOS = 2;

export default function EstudioDev() {
  const ids = Object.keys(AVATAR_LOOKS);
  const [id, setId] = useState(ids[0]);
  const [mapa, setMapa] = useState<Record<string, AvatarManifest>>({});
  const [rev, setRev] = useState<Record<string, number>>({});
  const [gatilhos, setGatilhos] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [fila, setFilaState] = useState<string[]>([]);
  const filaRef = useRef<string[]>([]);
  const setFila = (f: string[]) => { filaRef.current = f; setFilaState(f); };
  const emCurso = useRef(new Set<string>());

  useEffect(() => { void carregarManifestos().then(setMapa); }, []);
  const recarregar = useCallback((k: string) => {
    invalidarManifestos();
    void carregarManifestos().then(setMapa);
    setRev((r) => ({ ...r, [k]: (r[k] ?? 0) + 1 }));
  }, []);

  const disparar = (k: string) => { emCurso.current.add(k); setGatilhos((g) => ({ ...g, [k]: (g[k] ?? 0) + 1 })); };
  const gerarTodos = () => {
    const faltam = ids.filter((k) => !mapa[k] && !(status[k]?.prontos || status[k]?.rodando));
    setFila(faltam.slice(SIMULTANEOS));
    faltam.slice(0, SIMULTANEOS).forEach(disparar);
  };

  // terminou um → puxa o próximo da fila
  const aoStatus = useCallback((k: string, s: Status) => {
    setStatus((m) => ({ ...m, [k]: s }));
    if (!s.rodando && emCurso.current.has(k)) {
      // a 1ª notificação (antes de começar) também chega com rodando=false — só conta depois de produzir algo
      if (s.prontos + s.falhas === 0) return;
      emCurso.current.delete(k);
      const [prox, ...resto] = filaRef.current;
      setFila(resto);
      if (prox) disparar(prox);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rodandoAlgum = Object.values(status).some((s) => s.rodando) || fila.length > 0;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 dark:from-[#060a16] dark:to-[#0b1020] p-4 sm:p-6">
      <header className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className={`text-xl font-black tracking-tight ${TXT}`}>Estúdio de avatar vivo</h1>
        <span className={`text-[11px] font-bold uppercase tracking-widest ${TXT_MUDO}`}>Etapa A · dev · salva em public/avatars</span>
        <button type="button" onClick={gerarTodos} disabled={rodandoAlgum}
          className="ml-auto min-h-[40px] px-4 rounded-xl text-[12px] font-black uppercase tracking-widest bg-cyan-500 text-slate-950 disabled:opacity-40">
          {rodandoAlgum ? `gerando… (${fila.length} na fila)` : "gerar todos que faltam"}
        </button>
      </header>
      <nav className="flex gap-2 overflow-x-auto pb-3 mb-4" aria-label="Agentes">
        {ids.map((k) => {
          const s = status[k];
          const selo = mapa[k] && !s?.prontos ? "✓" : s?.rodando ? "⏳" : s?.prontos ? `${s.prontos} p/ aprovar` : fila.includes(k) ? "na fila" : "";
          return (
            <button key={k} type="button" onClick={() => setId(k)} aria-pressed={k === id}
              className={`shrink-0 min-h-[44px] pl-1.5 pr-3 rounded-full flex items-center gap-2 text-[13px] font-semibold ${VIDRO_CHIP} ${k === id ? `ring-2 ring-cyan-400 ${TXT}` : TXT_MUDO}`}>
              <AgentAvatar agentId={k} nome={AVATAR_LOOKS[k].nome} size={32} key={`${k}-${rev[k] ?? 0}`} vivo={false} />
              {AVATAR_LOOKS[k].nome}
              {selo && <span className={`text-[10.5px] font-bold ${s?.prontos ? "text-amber-600 dark:text-amber-300" : ""}`}>{selo}</span>}
            </button>
          );
        })}
      </nav>
      {/* todos montados: o rascunho (não salvo) de cada agente sobrevive à troca de aba */}
      {ids.map((k) => (
        <div key={k} hidden={k !== id}>
          <EstudioAvatar
            key={`${k}-${rev[k] ?? 0}`}
            endpoint="/api/dev/avatares"
            agentId={k}
            nome={AVATAR_LOOKS[k].nome}
            personagemInicial={AVATAR_LOOKS[k].personagem}
            corInicial={AVATAR_LOOKS[k].cor}
            existente={mapa[k] ?? null}
            baseUrlExistente={mapa[k] ? `/avatars/${k}/base.webp` : null}
            extraSalvar={{ agentId: k }}
            onSalvo={() => recarregar(k)}
            gatilho={gatilhos[k] ?? 0}
            onStatus={(s) => aoStatus(k, s)}
          />
        </div>
      ))}
    </main>
  );
}
