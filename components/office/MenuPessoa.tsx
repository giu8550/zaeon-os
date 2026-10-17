"use client";
/**
 * MenuPessoa — o que abre ao clicar na foto de uma pessoa na barra do escritório (#425):
 *   "Ver perfil"             → o cartão com foto, nome, curso, nível, instituição e bio (+ "Conversar", se já é contato).
 *   "Remover do escritório"  → só pro dono (regra em lib/canal/perfil podeRemover); quem chama confirma antes.
 * O perfil vem de /api/canal/[id]/pessoa/[userId] — sem cérebros (ficam privados).
 */
import { useState } from "react";
import { MessageCircle, UserRound, UserMinus } from "lucide-react";
import AgentAvatar from "@/components/agents/AgentAvatar";
import type { PerfilPublico } from "@/lib/canal/perfil";
import { VIDRO_POPOVER, TXT, TXT_2, TXT_MUDO } from "@/lib/canal/vidro";

export type PerfilCarregado = { pessoa: PerfilPublico; papel: "dono" | "membro" };

const ITEM = "w-full min-h-[40px] px-2.5 rounded-xl flex items-center gap-2 text-left text-[12.5px] font-semibold";

export default function MenuPessoa({ pessoa, carregarPerfil, podeRemover, onRemover, onConversar }: {
  pessoa: { id: string; nome: string; avatar: string | null };
  carregarPerfil: (id: string) => Promise<PerfilCarregado | null>;
  podeRemover: boolean;
  onRemover: () => void;
  /** abre a conversa privada com a pessoa (só quando já são contatos). */
  onConversar?: () => void;
}) {
  const [perfil, setPerfil] = useState<PerfilCarregado | null>(null);
  const [estado, setEstado] = useState<"menu" | "carregando" | "perfil" | "erro">("menu");

  const verPerfil = async () => {
    setEstado("carregando");
    const p = await carregarPerfil(pessoa.id).catch(() => null);
    setPerfil(p);
    setEstado(p ? "perfil" : "erro");
  };

  return (
    <div role="dialog" aria-label={`Menu de ${pessoa.nome}`} className={`absolute right-0 top-full mt-1.5 z-30 w-[min(92vw,280px)] p-2 rounded-2xl ${VIDRO_POPOVER}`}>
      {estado === "perfil" && perfil ? (
        <div className="flex flex-col gap-2 p-1" data-testid="perfil-pessoa">
          <div className="flex items-center gap-2.5">
            <AgentAvatar src={perfil.pessoa.avatar} nome={perfil.pessoa.nome} size={44} />
            <div className="min-w-0">
              <p className={`text-[14px] font-bold truncate ${TXT}`}>{perfil.pessoa.nome}</p>
              <p className={`text-[11px] ${TXT_MUDO}`}>{perfil.papel === "dono" ? "Dono do escritório" : "Membro do escritório"}</p>
            </div>
          </div>
          {(perfil.pessoa.curso || perfil.pessoa.nivel || perfil.pessoa.instituicao) && (
            <dl className={`grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px] ${TXT_2}`}>
              {perfil.pessoa.curso && (<><dt className={TXT_MUDO}>Curso</dt><dd className="truncate">{perfil.pessoa.curso}</dd></>)}
              {perfil.pessoa.nivel && (<><dt className={TXT_MUDO}>Nível</dt><dd className="truncate">{perfil.pessoa.nivel}</dd></>)}
              {perfil.pessoa.instituicao && (<><dt className={TXT_MUDO}>Instituição</dt><dd className="truncate">{perfil.pessoa.instituicao}</dd></>)}
            </dl>
          )}
          {perfil.pessoa.bio && <p className={`text-[12px] leading-snug ${TXT_2}`}>{perfil.pessoa.bio}</p>}
          {onConversar && (
            <button type="button" onClick={onConversar} className={`${ITEM} justify-center bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-900`}>
              <MessageCircle className="w-4 h-4" aria-hidden /> Conversar
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <p className={`px-2.5 pt-1 pb-1.5 text-[12px] font-bold truncate ${TXT}`}>{pessoa.nome}</p>
          <button type="button" onClick={() => void verPerfil()} disabled={estado === "carregando"}
            className={`${ITEM} ${TXT} hover:bg-slate-500/10 dark:hover:bg-white/10 disabled:opacity-50`}>
            <UserRound className="w-4 h-4" aria-hidden /> {estado === "carregando" ? "Abrindo perfil…" : "Ver perfil"}
          </button>
          {podeRemover && (
            <button type="button" onClick={onRemover}
              className={`${ITEM} text-rose-600 dark:text-rose-300 hover:bg-rose-500/10`}>
              <UserMinus className="w-4 h-4" aria-hidden /> Remover do escritório
            </button>
          )}
          {estado === "erro" && <p role="alert" className={`px-2.5 pt-1 text-[11.5px] ${TXT_MUDO}`}>Não deu pra abrir o perfil agora.</p>}
        </div>
      )}
    </div>
  );
}
