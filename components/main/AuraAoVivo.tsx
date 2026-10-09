"use client";

/**
 * AuraAoVivo — a Aura respondendo AO VIVO no hero da landing: o visitante vê que o chat TEM ROSTO
 * antes de entrar. Loop de perguntas reais de estudante: a pergunta chega → ela pensa → fala
 * (texto saindo palavra a palavra enquanto a boca mexe) → sorri ao terminar → próxima.
 * O cartão inteiro é o "Iniciar chat" (clicar = falar com ela). Só desktop (no celular o rosto vai
 * no botão do CTA); prefers-reduced-motion → conversa estática, sem animação.
 * Sem avatar vivo publicado pra Aura → não renderiza nada.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AgentAvatar from "@/components/agents/AgentAvatar";
import { useAmbienteAvatar, useManifesto } from "@/components/agents/avatar/hooks";
import type { SinalAvatar } from "@/lib/avatars/estados";

const ROTEIRO = [
  { q: "Me explica fotossíntese em uma frase?", r: "A planta usa a luz pra transformar água e CO₂ em açúcar — e solta oxigênio de brinde. 🌱" },
  { q: "Monta um plano pra minha prova de cálculo?", r: "Bora: 3 dias de limites, 2 de derivadas e 1 de revisão com provas antigas. Começo pelo resumo?" },
  { q: "Essa citação tá certa na ABNT?", r: "Quase! Falta o ano depois do autor: (SILVA, 2021, p. 12). Quer que eu arrume as outras?" },
];

type Fase = "pergunta" | "pensando" | "falando" | "feliz";

export default function AuraAoVivo({ onAbrir }: { onAbrir: () => void }) {
  const manifest = useManifesto("aura");
  const { reduzido } = useAmbienteAvatar();
  const [i, setI] = useState(0);
  const [fase, setFase] = useState<Fase>("pergunta");
  const [palavras, setPalavras] = useState(0);
  const [hover, setHover] = useState(false);
  const item = ROTEIRO[i];
  const total = item.r.split(" ").length;

  useEffect(() => {
    if (reduzido) { setFase("feliz"); setPalavras(total); return; }
    let t: ReturnType<typeof setTimeout>;
    if (fase === "pergunta") t = setTimeout(() => setFase("pensando"), 1100);
    else if (fase === "pensando") t = setTimeout(() => { setPalavras(0); setFase("falando"); }, 1500);
    else if (fase === "falando") {
      if (palavras < total) t = setTimeout(() => setPalavras((n) => n + 1), 110 + Math.random() * 90);
      else t = setTimeout(() => setFase("feliz"), 250);
    } else t = setTimeout(() => { setI((n) => (n + 1) % ROTEIRO.length); setPalavras(0); setFase("pergunta"); }, 3200);
    return () => clearTimeout(t);
  }, [fase, palavras, total, reduzido]);

  if (!manifest) return null;
  // "feliz" só nos primeiros instantes: o sorriso automático do AgentAvatar já cuida (falando → idle)
  const sinal: SinalAvatar = fase === "pensando" ? "pensando" : fase === "falando" ? "falando" : "idle";

  return (
    <motion.button
      type="button"
      onClick={onAbrir}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
      aria-label="Conversar com a Aura — iniciar chat"
      className="group relative w-full text-left rounded-[30px] p-5 pt-16 backdrop-blur-md backdrop-saturate-150
        bg-white/70 border border-white/80 shadow-[0_30px_80px_-30px_rgba(76,29,149,0.55)]
        dark:bg-white/[0.06] dark:border-white/[0.12] dark:shadow-[0_30px_80px_-30px_rgba(139,92,246,0.55)]
        transition-transform duration-300 hover:-translate-y-1"
    >
      {/* o rosto sai pra fora do cartão: ela é a protagonista, a conversa é dela */}
      <span className="absolute -top-14 left-5">
        <AgentAvatar agentId="aura" manifest={manifest} nome="Aura" size={108} estado={sinal} hover={hover} destaque
          className="ring-4 ring-white/80 dark:ring-white/10 shadow-[0_18px_40px_-14px_rgba(124,58,237,0.7)]" />
      </span>
      <span className="absolute top-4 left-[136px] flex flex-col">
        <span className="font-tech text-[17px] font-semibold text-slate-900 dark:text-white leading-tight">Aura</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-white/55">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
          {fase === "pensando" ? "pensando…" : fase === "falando" ? "respondendo…" : "online · este chat sou eu"}
        </span>
      </span>

      <div className="flex flex-col gap-2.5 min-h-[168px]">
        <AnimatePresence mode="popLayout">
          <motion.p key={`q-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="self-end max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md text-[13.5px] bg-cyan-600 text-white">
            {item.q}
          </motion.p>
        </AnimatePresence>
        {fase !== "pergunta" && (
          <motion.div key={`r-${i}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="self-start max-w-[92%] px-3.5 py-2.5 rounded-2xl rounded-bl-md text-[13.5px] leading-relaxed bg-slate-100 text-slate-800 dark:bg-white/[0.08] dark:text-white/90">
            {fase === "pensando" ? (
              <span className="inline-flex gap-1 py-1" aria-label="pensando">
                {[0, 1, 2].map((k) => <span key={k} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${k * 140}ms` }} />)}
              </span>
            ) : item.r.split(" ").slice(0, palavras).join(" ")}
          </motion.div>
        )}
      </div>

      <span className="mt-4 flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] bg-white/80 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-400 dark:text-white/40 group-hover:border-violet-400/60 transition-colors">
        Fale com a Aura…
        <span className="ml-auto grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white text-[13px]">↑</span>
      </span>
    </motion.button>
  );
}
