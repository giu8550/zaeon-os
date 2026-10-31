"use client";
/** Home do app mobile: dois cartões grandes (Estudos / Pesquisa) e o que estava aberto por último. */
import Link from "next/link";
import { useEffect, useState } from "react";
import { ALVO, FOCO } from "@/components/mobile/estilo";
import { useArmazemDaConta } from "@/lib/chat/contaNoNavegador";

export default function HomeMobile() {
  const [ultima, setUltima] = useState<"estudos" | "pesquisa" | null>(null);
  const [conversas, setConversas] = useState<Array<{ id: string; titulo: string }>>([]);
  const area = useArmazemDaConta();
  useEffect(() => {
    try {
      const a = JSON.parse(localStorage.getItem("zaeon.m.aba") || "null");
      if (a === "estudos" || a === "pesquisa") setUltima(a);
      const c = JSON.parse(area?.armazem.getItem("zaeon.m.conversas") || "[]");
      setConversas(Array.isArray(c) ? c.slice(0, 5) : []);
    } catch { /* sem L0 */ }
  }, [area]);
  const cartao = `${ALVO} ${FOCO} block rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.04]`;
  return (
    <main className="flex min-h-[100dvh] flex-col gap-4 bg-slate-50 px-4 text-slate-900 dark:bg-[#030014] dark:text-white"
      style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))", paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
      <h1 className="text-2xl font-semibold">Zaeon</h1>
      <Link href="/m/estudos" className={cartao}>
        <span className="block text-lg font-semibold">Estudos</span>
        <span className="mt-1 block text-sm text-slate-600 dark:text-white/60">Converse com a Aura e gere mapas, flashcards e guias.</span>
        {ultima === "estudos" && <span className="mt-2 block text-xs text-cyan-800 dark:text-cyan-300">continuar de onde parou</span>}
      </Link>
      <Link href="/m/pesquisa" className={cartao}>
        <span className="block text-lg font-semibold">Pesquisa</span>
        <span className="mt-1 block text-sm text-slate-600 dark:text-white/60">Busque artigos científicos com referências verificadas.</span>
        {ultima === "pesquisa" && <span className="mt-2 block text-xs text-cyan-800 dark:text-cyan-300">continuar de onde parou</span>}
      </Link>
      {conversas.length > 0 && (
        <section aria-labelledby="m-recentes">
          <h2 id="m-recentes" className="mt-2 text-sm font-semibold text-slate-600 dark:text-white/60">Conversas recentes</h2>
          <ul className="mt-2 flex flex-col">
            {conversas.map((c) => (
              <li key={c.id}>
                <Link href="/m/estudos" onClick={() => { try { area?.armazem.setItem("zaeon.m.conversa", JSON.stringify(c.id)); } catch { /* */ } }}
                  className={`${ALVO} ${FOCO} flex items-center rounded-xl px-3 text-[15px]`}>{c.titulo}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
