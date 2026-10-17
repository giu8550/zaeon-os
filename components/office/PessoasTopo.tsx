"use client";
/**
 * PessoasTopo — as fotos das pessoas do escritório no topo (#423, barra de cima).
 * Antes ficavam SOBREPOSTAS (-space-x-2) e pareciam coladas; agora cada foto tem o seu espaço (gap).
 * Anel verde = online agora; cinza = é do canal mas está fora. Quem entra na lista vem de lib/canal/topoPessoas.
 * #425: cada foto é um botão — clicar abre o menu da pessoa (Ver perfil / Remover), que vem de `menuDe`.
 */
import type { ReactNode } from "react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { TXT_MUDO } from "@/lib/canal/vidro";

type Pessoa = { id: string; nome: string; avatar: string | null };

export default function PessoasTopo({ visiveis, extras, onlineIds, total, aberta = null, onAlternar, menuDe }: {
  visiveis: Pessoa[];
  /** quantas ficaram de fora (vira "+N"). */
  extras: number;
  onlineIds: Set<string>;
  total: number;
  /** #425: id da pessoa com o menu aberto. */
  aberta?: string | null;
  onAlternar?: (id: string) => void;
  menuDe?: (p: Pessoa) => ReactNode;
}) {
  if (!visiveis.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      <div className="hidden xs:flex sm:flex items-center gap-1.5" aria-label={`${onlineIds.size} online de ${total}`} data-testid="pessoas-topo">
        {visiveis.map((p) => {
          const aqui = onlineIds.has(p.id);
          const foto = <AgentAvatar src={p.avatar} nome={p.nome} size={28} className={`ring-2 ${aqui ? "ring-emerald-400/70" : "ring-slate-400/40 opacity-70"}`} />;
          if (!onAlternar) {
            return <span key={p.id} title={`${p.nome}${aqui ? " · online" : ""}`} aria-label={`${p.nome}${aqui ? " (online)" : ""}`} className="inline-flex">{foto}</span>;
          }
          return (
            <span key={p.id} className="relative inline-flex">
              <button type="button" onClick={() => onAlternar(p.id)} aria-haspopup="dialog" aria-expanded={aberta === p.id}
                title={`${p.nome}${aqui ? " · online" : ""}`} aria-label={`${p.nome}${aqui ? " (online)" : ""}`}
                className="inline-flex rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
                {foto}
              </button>
              {aberta === p.id && menuDe?.(p)}
            </span>
          );
        })}
      </div>
      {extras > 0 && <span className={`text-[11px] ${TXT_MUDO}`}>+{extras}</span>}
    </div>
  );
}
