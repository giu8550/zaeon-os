"use client";

/**
 * StudyThisButton — botão GRANDE "Estudar esse tema" (estilo about-us).
 * Pega um tema (ex.: o título da pesquisa / uma ref salva) e gera um ESTUDO em
 * "Meus Estudos" a partir dele.
 *
 * Funciona dentro E fora do research-lab:
 *  - mesma página: dispara `zaeon:set-tab` (vai pra Sala de Estudos) + `zaeon:study:run`
 *    (o feed escuta e gera o estudo) — o feed fica sempre montado, só escondido.
 *  - outra página: grava um handoff (sessionStorage) e navega; o feed consome no mount.
 */
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight } from "lucide-react";
import { setHandoff } from "@/lib/agents/handoff";

export default function StudyThisButton({
  topic,
  label = "Estudar esse tema",
  className = "",
}: {
  topic: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const go = () => {
    const t = (topic || "").trim();
    if (!t) return;
    // cross-page (consumido no mount do feed)
    setHandoff("study", t);
    // same-page (feed já montado): troca a aba + manda gerar
    try {
      window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: "sala-de-estudos" }));
      window.dispatchEvent(new CustomEvent("zaeon:study:run", { detail: { topic: t } }));
    } catch { /* ignore */ }
    // garante a navegação quando vier de fora do research-lab
    router.push("/research-lab?tab=sala-de-estudos");
  };

  return (
    <button
      onClick={go}
      title={label}
      className={`group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl text-white font-black text-[15px] tracking-tight transition-transform hover:scale-[1.03] active:scale-95 ${className}`}
      style={{ background: "linear-gradient(135deg,#2563eb,#06b6d4)", boxShadow: "0 18px 44px -14px rgba(34,211,238,0.6)" }}
    >
      <span className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg,#1d4ed8,#0891b2)" }} />
      <GraduationCap size={20} className="relative z-10" />
      <span className="relative z-10">{label}</span>
      <ArrowRight size={18} className="relative z-10 transition-transform group-hover:translate-x-1" />
    </button>
  );
}
