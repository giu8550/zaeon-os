"use client";
/**
 * As conversas de uma sala que NÃO está aberta, embaixo do nome dela na sidebar principal: o
 * "+ Nova" e as recentes (lidas do aparelho — lib/chat/threads). Clicar entra na sala e abre a
 * conversa (lib/chat/conversasNav). A sala aberta usa a lista completa (ConversasSidebar), por portal.
 */
import { useEffect, useState } from "react";
import { SquarePen } from "lucide-react";
import { arvoreDeThreads, carregarThreads, ESCOPO_COWORK, ESCOPO_PESQUISA, type Thread } from "@/lib/chat/threads";
import { pedirConversa, type SalaChat } from "@/lib/chat/conversasNav";

export default function ConversasDaSala({ sala, rotuloNova, onEntrar, max = 5 }: {
  sala: SalaChat;
  rotuloNova: string;
  /** troca a sala ativa (a página) */
  onEntrar: () => void;
  max?: number;
}) {
  const [recentes, setRecentes] = useState<Thread[]>([]);
  useEffect(() => {
    try {
      const lista = carregarThreads(localStorage, sala === "pesquisa" ? ESCOPO_PESQUISA : ESCOPO_COWORK);
      setRecentes(arvoreDeThreads(lista).map((n) => n.thread).slice(0, max));
    } catch { /* aba anônima: só o "+ Nova" */ }
  }, [sala, max]);

  const ir = (p: { id?: string; nova?: boolean }) => { pedirConversa({ sala, ...p }); onEntrar(); };
  return (
    <div className="flex flex-col gap-0.5">
      <button type="button" onClick={() => ir({ nova: true })}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-semibold text-slate-700 dark:text-white/75 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]">
        <SquarePen size={13} /> {rotuloNova}
      </button>
      {recentes.map((t) => (
        <button key={t.id} type="button" onClick={() => ir({ id: t.id })} title={t.titulo}
          className="text-left truncate px-2 py-1.5 rounded-lg text-[12.5px] text-slate-600 dark:text-white/60 hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white">
          {t.titulo}
        </button>
      ))}
    </div>
  );
}
