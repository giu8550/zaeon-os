"use client";

/**
 * /bem-vindo — follow-up de boas-vindas do NOVO usuário (pós-convite).
 *  - Card liquid-glass com COR PRÓPRIA (não depende de tema): feminino → rosa/branco,
 *    masculino → azul/preto. Lembra o card de convite.
 *  - Saúda pelo PRIMEIRO NOME + pronome inteligente (escolha do card de convite).
 *  - Cards explicativos de cada função da Zaeon, com voz (SpeakButton).
 *  - Depois, empurra o usuário a clicar em "Pesquisa" → tour (?tour=true).
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Search, GraduationCap, Code2, Mic, Users, ArrowRight } from "lucide-react";
import SpeakButton from "@/components/voice/SpeakButton";

type G = "f" | "m";

export default function BemVindoPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [gender, setGender] = useState<G>("m");
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    let g: G = "m"; let fn = "";
    try {
      const lg = localStorage.getItem("zaeon.gender");
      if (lg === "f" || lg === "m") g = lg;
      fn = localStorage.getItem("zaeon.firstName") || "";
    } catch { /* ignore */ }
    const sg = (session?.user as any)?.gender;
    if (sg === "f" || sg === "m") g = sg;
    if (!fn && session?.user?.name) fn = session.user.name.trim().split(/\s+/)[0];
    setGender(g); setFirstName(fn);
  }, [session]);

  // pronome inteligente
  const a = gender === "f" ? "a" : "o";

  // paleta própria por gênero (independe de claro/escuro)
  const theme = useMemo(() => gender === "f" ? {
    pageBg: "radial-gradient(1100px 520px at 12% -8%, rgba(236,72,153,.18), transparent 60%), radial-gradient(900px 460px at 100% 0%, rgba(244,114,182,.16), transparent 55%), linear-gradient(165deg,#fff5fa,#ffe9f2 60%,#ffdcec)",
    ring: "linear-gradient(90deg,rgba(236,72,153,.5),rgba(244,114,182,.5),rgba(168,85,247,.4))",
    card: "linear-gradient(135deg,rgba(255,255,255,.94),rgba(255,228,240,.86))",
    ink: "#7a1f4b", sub: "#9d4373", accent: "#ec4899",
    chip: "linear-gradient(135deg,#ec4899,#f9a8d4)",
  } : {
    pageBg: "radial-gradient(1100px 520px at 12% -8%, rgba(56,189,248,.18), transparent 60%), radial-gradient(900px 460px at 100% 0%, rgba(37,99,235,.18), transparent 55%), linear-gradient(165deg,#0a1020,#0a0f1e 60%,#0b1428)",
    ring: "linear-gradient(90deg,rgba(37,99,235,.55),rgba(34,211,238,.5),rgba(124,58,237,.4))",
    card: "linear-gradient(135deg,rgba(255,255,255,.08),rgba(56,189,248,.06))",
    ink: "#eaf2ff", sub: "#9fc3ff", accent: "#38bdf8",
    chip: "linear-gradient(135deg,#2563eb,#06b6d4)",
  }, [gender]);

  const feats = [
    { icon: Search, title: "Pesquisa", desc: `Peça qualquer tema e a Zaeon busca fontes acadêmicas, resume e cita por você.` },
    { icon: GraduationCap, title: "Sala de Estudos", desc: `Seu caderno vivo: escreva, e peça à Zaeon pra montar o estudo bloco a bloco.` },
    { icon: Code2, title: "Projetos", desc: `Crie e rode projetos com a IA agêntica, direto no navegador.` },
    { icon: Mic, title: "Modo voz (sem as mãos)", desc: `Fale com a Zaeon: ela clica, escreve e navega por você. Onde há um campo, há voz.` },
    { icon: Users, title: "Convites", desc: `Chame até 3 colegas e compartilhem o Plano Plus em grupo.` },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-5 sm:p-8" style={{ background: theme.pageBg }}>
      <div className="w-full max-w-2xl rounded-[28px] p-[1.5px]" style={{ background: theme.ring, boxShadow: "0 30px 90px -40px rgba(0,0,0,.5)" }}>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="rounded-[27px] p-7 sm:p-10"
          style={{ background: theme.card, backdropFilter: "blur(26px) saturate(150%)", WebkitBackdropFilter: "blur(26px) saturate(150%)", border: "1px solid rgba(255,255,255,.25)" }}
        >
          {/* selo + ⟁ */}
          <div className="flex items-center gap-2.5 mb-5">
            <motion.span
              className="text-xl leading-none"
              style={{ color: theme.accent, filter: `drop-shadow(0 0 7px ${theme.accent})` }}
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
              aria-hidden
            >⟁</motion.span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.25em] text-white" style={{ background: theme.chip }}>
              Bem-vind{a} à Zaeon
            </span>
          </div>

          {/* saudação animada */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}
            className="text-3xl sm:text-[2.6rem] font-black tracking-tight leading-[1.05]"
            style={{ color: theme.ink }}
          >
            {firstName ? <>Olá, {firstName}.</> : <>Olá!</>}<br />
            Que bom ter você {gender === "f" ? "aqui" : "aqui"}.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="mt-3 text-[14px] leading-relaxed max-w-lg" style={{ color: theme.sub }}
          >
            Você está pront{a} pra estudar e pesquisar como nunca. Veja o que a Zaeon faz por você —
            toque no <b>alto-falante</b> de cada card pra ouvir.
          </motion.p>

          {/* cards das funções (com voz) */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {feats.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
                className="rounded-2xl p-3.5 flex items-start gap-3"
                style={{ background: "rgba(255,255,255,.10)", border: "1px solid rgba(255,255,255,.18)" }}
              >
                <span className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: theme.chip }}>
                  <f.icon size={17} className="text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black" style={{ color: theme.ink }}>{f.title}</span>
                    <SpeakButton text={`${f.title}. ${f.desc}`} title="Ouvir" />
                  </div>
                  <p className="text-[11.5px] leading-snug mt-0.5" style={{ color: theme.sub }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA → Pesquisa + tour */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="mt-7 flex flex-col items-center gap-2">
            <button
              onClick={() => router.push("/research-lab?tab=pesquisa&tour=true")}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-white font-black uppercase tracking-widest text-[12px] transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
              style={{ background: theme.chip, boxShadow: `0 14px 34px -12px ${theme.accent}` }}
            >
              Começar pela Pesquisa <ArrowRight size={15} />
            </button>
            <span className="text-[11px]" style={{ color: theme.sub }}>
              Dica: depois é só clicar em <b>Pesquisa</b> na barra lateral pra rever o tour.
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
