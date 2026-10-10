"use client";

/**
 * SolanaPrivacidade — a seção "Seu conhecimento, sua prova." da página inicial.
 *
 * O desenho (SVG, animado com SMIL — leve, sem JS por quadro): uma IMPRESSÃO DIGITAL no centro, a marca OFICIAL
 * da Solana se fecha por cima dela (a identidade some atrás da prova) e, daí, ARQUIVOS saem distribuídos entre
 * nós QUADRADOS (sólidos) e HOLOGRÁFICOS (aramados), que acendem ao receber. Loop contínuo.
 *
 * Copy comercial, mas verdadeira (ancorada no que o código faz — ver app/about/about-us e /docs#privacidade):
 * nada de dado pessoal na cadeia; credencial soulbound na carteira do aluno; validação por gente.
 */
import Link from "next/link";
import { useId } from "react";
import { motion } from "framer-motion";
import { TituloSecao } from "@/components/layout/secao";
import TextoRevelado from "@/components/ui/TextoRevelado";
import SolanaMark from "@/components/solana/SolanaMark";
import IconeCredencial, { type NomeIcone } from "@/components/solana/IconesCredencial";

const CARDS: { icone: NomeIcone; t: string; d: string }[] = [
  { icone: "privacidade", t: "Sua identidade fica com você", d: "Nome, e-mail e documentos nunca vão pra blockchain. O que sobe é só a prova: o quê, quando e um ponteiro." },
  { icone: "credencial", t: "Sua conquista vai com você", d: "Cada título validado vira uma credencial soulbound na sua carteira — portável, intransferível e à prova de adulteração." },
  { icone: "revisor", t: "Validado por gente, não por robô", d: "Só um professor vinculado ou a instituição chancela. Sem revisão humana, nada vira credencial." },
];

/* ───────── o desenho ───────── */
function ImpressaoSolana() {
  const id = useId().replace(/:/g, "");
  const g = `sg-${id}`, h = `hg-${id}`, glow = `gl-${id}`;
  // nós: 3 quadrados (sólidos) e 3 holográficos (aramados), em volta do centro
  const nos = [
    { x: 70, y: 70, tipo: "quad" }, { x: 430, y: 70, tipo: "holo" }, { x: 70, y: 330, tipo: "holo" },
    { x: 430, y: 330, tipo: "quad" }, { x: 250, y: 36, tipo: "holo" }, { x: 250, y: 364, tipo: "quad" },
  ] as const;
  const C = { x: 250, y: 200 };
  // arcos da impressão digital (meio-círculos concêntricos com "falhas")
  const arcos = [34, 50, 66, 82, 98];
  return (
    <svg viewBox="0 0 500 400" className="w-full h-auto max-w-[560px] mx-auto" role="img" aria-labelledby={`t-${id}`} focusable="false">
      <title id={`t-${id}`}>A marca da Solana cobre uma impressão digital; da prova saem arquivos distribuídos entre nós quadrados e holográficos.</title>
      <defs>
        <linearGradient id={g} gradientUnits="userSpaceOnUse" x1="360.8791" y1="351.4553" x2="141.213" y2="-69.2936" gradientTransform="matrix(1 0 0 -1 0 314)">
          <stop offset="0" stopColor="#00FFA3" /><stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
        <linearGradient id={h} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.9" /><stop offset="1" stopColor="#818cf8" stopOpacity="0.5" /></linearGradient>
        <radialGradient id={glow}><stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></radialGradient>
      </defs>

      {/* fios do centro aos nós */}
      {nos.map((n, i) => (
        <path key={`f${i}`} id={`p-${id}-${i}`} d={`M${C.x},${C.y} Q${(C.x + n.x) / 2},${(C.y + n.y) / 2 + (i % 2 ? -28 : 28)} ${n.x},${n.y}`} fill="none" stroke="#22d3ee" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="3 5" />
      ))}

      {/* brilho central */}
      <circle cx={C.x} cy={C.y} r="120" fill={`url(#${glow})`} />

      {/* impressão digital */}
      <g fill="none" stroke="#e2e8f0" strokeOpacity="0.75" strokeWidth="2.2" strokeLinecap="round">
        {arcos.map((r, i) => (
          <g key={r}>
            <path d={`M${C.x - r},${C.y + 10} A${r},${r} 0 0 1 ${C.x + r},${C.y + 10}`} strokeDasharray={i % 2 ? `${r * 1.2} 12 ${r * 0.9} 10` : `${r * 0.8} 10 ${r * 1.4} 9`} />
            <path d={`M${C.x - r},${C.y + 10} A${r},${r} 0 0 0 ${C.x + r},${C.y + 10}`} strokeOpacity="0.45" strokeDasharray={`${r * 1.1} 14 ${r * 0.7} 11`} />
          </g>
        ))}
        <path d={`M${C.x},${C.y - 18} v56`} strokeOpacity="0.6" />
      </g>

      {/* a marca da Solana FECHA por cima da digital (a identidade some atrás da prova) */}
      <g transform={`translate(${C.x - 60} ${C.y - 47}) scale(0.3)`} opacity="0.96">
        <animateTransform attributeName="transform" type="scale" additive="sum" values="0.6;1;1;1;0.6" keyTimes="0;0.12;0.8;0.92;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.96;0.96;0.96;0" keyTimes="0;0.12;0.8;0.92;1" dur="6s" repeatCount="indefinite" />
        <rect x="-30" y="-30" width="457" height="371" rx="60" fill="#070a1a" fillOpacity="0.85" />
        <path fill={`url(#${g})`} d="M64.6,237.9c2.4-2.4,5.7-3.8,9.2-3.8h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,237.9z" />
        <path fill={`url(#${g})`} d="M64.6,3.8C67.1,1.4,70.4,0,73.8,0h317.4c5.8,0,8.7,7,4.6,11.1l-62.7,62.7c-2.4,2.4-5.7,3.8-9.2,3.8H6.5c-5.8,0-8.7-7-4.6-11.1L64.6,3.8z" />
        <path fill={`url(#${g})`} d="M333.1,120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8,0-8.7,7-4.6,11.1l62.7,62.7c2.4,2.4,5.7,3.8,9.2,3.8h317.4c5.8,0,8.7-7,4.6-11.1L333.1,120.1z" />
      </g>

      {/* os ARQUIVOS saindo da prova pros nós */}
      {nos.map((n, i) => (
        <g key={`a${i}`} opacity="0">
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.9;1" dur="2.4s" begin={`${1 + i * 0.35}s`} repeatCount="indefinite" />
          <animateMotion dur="2.4s" begin={`${1 + i * 0.35}s`} repeatCount="indefinite" rotate="0" calcMode="spline" keySplines="0.4 0 0.2 1" keyTimes="0;1" keyPoints="0;1">
            <mpath href={`#p-${id}-${i}`} />
          </animateMotion>
          {/* ícone de arquivo (com a dobra) */}
          <path d="M-6,-8 h8 l4,4 v12 h-12 z" fill="#0b1226" stroke="#22d3ee" strokeWidth="1.3" />
          <path d="M2,-8 v4 h4" fill="none" stroke="#22d3ee" strokeWidth="1.3" />
          <path d="M-3,0 h6 M-3,3 h6" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="1" />
        </g>
      ))}

      {/* os NÓS: quadrados (sólidos) e holográficos (aramados) — acendem quando o arquivo chega */}
      {nos.map((n, i) => (
        <g key={`n${i}`} transform={`translate(${n.x} ${n.y})`}>
          {n.tipo === "quad" ? (
            <>
              <rect x="-20" y="-20" width="40" height="40" rx="7" fill="#0f1f44" stroke="#22d3ee" strokeWidth="1.4">
                <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="2.4s" begin={`${3.2 + i * 0.35}s`} repeatCount="indefinite" />
              </rect>
              <rect x="-11" y="-11" width="22" height="22" rx="3" fill="#22d3ee" fillOpacity="0.18" />
              <path d="M-5,-2 h10 M-5,2 h10" stroke="#22d3ee" strokeWidth="1.2" strokeOpacity="0.8" />
            </>
          ) : (
            <>
              <polygon points="0,-24 21,-12 21,12 0,24 -21,12 -21,-12" fill={`url(#${h})`} fillOpacity="0.12" stroke={`url(#${h})`} strokeWidth="1.3" strokeDasharray="4 3">
                <animate attributeName="fill-opacity" values="0.1;0.35;0.1" dur="2.4s" begin={`${3.2 + i * 0.35}s`} repeatCount="indefinite" />
              </polygon>
              <polygon points="0,-12 10.5,-6 10.5,6 0,12 -10.5,6 -10.5,-6" fill="none" stroke="#a5b4fc" strokeOpacity="0.8" strokeWidth="1" />
              <circle r="2.2" fill="#22d3ee" />
            </>
          )}
          <circle r="30" fill="#22d3ee" fillOpacity="0">
            <animate attributeName="fill-opacity" values="0;0.18;0" dur="2.4s" begin={`${3.2 + i * 0.35}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}

      {/* legenda */}
      <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="9" fill="#94a3b8" letterSpacing="1.5">
        <text x="12" y="392">PRIVADO · a pessoa</text>
        <text x="488" y="392" textAnchor="end">PÚBLICO · a prova</text>
      </g>
    </svg>
  );
}

export default function SolanaPrivacidade() {
  return (
    <section id="privacidade" aria-labelledby="privacidade-titulo" className="zaeon-borda relative z-40 w-full scroll-mt-28 pt-6 pb-16 md:pb-24">
      <div id="privacidade-titulo">
        <TituloSecao className="font-display" forte="Seu conhecimento, sua prova." fraco="Sua identidade, só sua." />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* texto */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <p className="font-display text-base md:text-lg font-light leading-relaxed text-slate-900 dark:text-white max-w-[520px]">
            <TextoRevelado texto="Tudo o que você conquista aqui vira uma prova que ninguém falsifica e ninguém tira de você — registrada na Solana, na sua carteira, sem expor quem você é." delay={0.15} />
          </p>
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/15 bg-black/80 px-4 py-2 shadow-[0_0_30px_rgba(220,31,255,0.15)]">
            <SolanaMark size={15} wordmark />
            <span className="h-4 w-px bg-white/15" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/80">credenciais verificáveis</span>
          </div>
          <ul className="flex flex-col gap-3">
            {CARDS.map((c, i) => (
              <motion.li
                key={c.t}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="dark flex items-start gap-4 rounded-2xl border border-cyan-400/25 bg-[#0f1f44]/80 backdrop-blur-md p-4 shadow-[0_0_24px_rgba(6,182,212,0.12)]"
              >
                <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                  <IconeCredencial name={c.icone} size={20} />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-semibold text-white leading-tight">{c.t}</span>
                  <span className="block mt-1 text-[13px] leading-snug text-white/75">{c.d}</span>
                </span>
              </motion.li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-black uppercase tracking-widest">
            <Link href="/about/about-us" className="text-cyan-700 dark:text-cyan-300 hover:text-cyan-500 underline underline-offset-4 decoration-cyan-500/40">Como a verificação funciona →</Link>
            <Link href="/docs#privacidade" className="text-slate-700 dark:text-white/70 hover:text-cyan-500 underline underline-offset-4 decoration-white/20">O que vai pra blockchain →</Link>
          </div>
        </div>

        {/* desenho */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: false, margin: "-60px" }}
          transition={{ duration: 0.6 }}
          className="dark lg:col-span-7 rounded-[2rem] border border-cyan-400/25 bg-[#0b1733]/80 backdrop-blur-md p-4 md:p-8 shadow-[0_0_40px_rgba(6,182,212,0.12)]"
        >
          <ImpressaoSolana />
        </motion.div>
      </div>
    </section>
  );
}
