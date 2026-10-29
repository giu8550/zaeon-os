"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BORDA } from "@/components/layout/secao";

/**
 * "Duas metades da mesma plataforma" (Figma zaeon-design, out/2026): o Chat de Pesquisa e o Cyberespaço 3D lado a lado,
 * ligados por um nó no meio. Logo depois do hero — explica o que os dois botões dele abrem.
 *
 * Os cards são ESCUROS nos dois temas (como os dos patrocinadores): as ilustrações são de tela escura.
 */

const CHAT_ROTA = "/research-lab?tab=sala-de-estudos";

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`absolute inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[10px] leading-none ${className}`}>
      {children}
    </span>
  );
}

/** a ilustração do chat: a "Pesquisa Aumentada" no centro, orbitada pelas fontes (DOI, PubMed, ABNT) */
function VisualChat() {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl border border-white/[0.06] bg-[#080b12] md:h-48">
      <div aria-hidden className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-[62%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-cyan-300/25" />
      <div aria-hidden className="absolute left-1/2 top-1/2 h-24 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-2xl" />
      <span className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-lg border border-cyan-300/50 bg-[#0b1a22] px-3 py-1.5 font-mono text-[11px] text-cyan-100 shadow-[0_0_18px_rgba(103,216,242,0.35)]">
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
          <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v6a1.5 1.5 0 0 1-1.5 1.5H9l-3.5 3v-3h-1A1.5 1.5 0 0 1 3 11.5z" strokeLinejoin="round" />
        </svg>
        Pesquisa Aumentada
      </span>
      <Chip className="left-3 top-3 border-white/10 bg-white/[0.04] text-slate-300">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden><path d="M4 1.5h5l3 3v10H4z M9 1.5v3h3" strokeLinejoin="round" /></svg>
        DOI:10.1038/s41586
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
      </Chip>
      <Chip className="right-3 top-3 border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden><circle cx="8" cy="8" r="6" /><path d="M5.5 8.2l1.7 1.7 3.3-3.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        PubMed
      </Chip>
      <Chip className="bottom-3 right-3 border-white/10 bg-white/[0.04] text-slate-300">
        <span className="font-sans font-bold text-cyan-300">99</span> Ref. ABNT NBR 6023
      </Chip>
    </div>
  );
}

/** a ilustração do cyberespaço: uma plataforma isométrica com duas pessoas e telas flutuando */
function VisualCyber() {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0912] md:h-48">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(139,92,246,0.18),transparent_65%)]" />
      <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* a grade do chão em losango */}
        <g stroke="rgba(167,139,250,0.14)" strokeWidth="0.8" fill="none" style={{ mask: "url(#dm-fade)" }}>
          {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={160 + i * 22 - 110} y1={120 + i * 11 - 55} x2={160 + i * 22 + 110} y2={120 + i * 11 + 55} transform="translate(0,-10)" />
              <line x1={160 + i * 22 + 110} y1={120 - i * 11 - 55} x2={160 + i * 22 - 110} y2={120 - i * 11 + 55} transform="translate(0,-10)" />
            </g>
          ))}
        </g>
        {/* a plataforma */}
        <defs>
          <radialGradient id="dm-fade-g" cx="0.5" cy="0.6" r="0.45">
            <stop offset="0.3" stopColor="#fff" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
          <mask id="dm-fade"><rect width="320" height="180" fill="url(#dm-fade-g)" /></mask>
          <linearGradient id="dm-topo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4c3fb0" />
            <stop offset="1" stopColor="#2a2370" />
          </linearGradient>
          <radialGradient id="dm-brilho" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ec4899" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ec4899" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d="M160 82 L208 106 L160 130 L112 106 Z" fill="url(#dm-topo)" stroke="#8b7cf6" strokeWidth="1" />
        <path d="M112 106 L160 130 L160 142 L112 118 Z" fill="#1d1854" />
        <path d="M208 106 L160 130 L160 142 L208 118 Z" fill="#251f66" />
        <ellipse cx="160" cy="106" rx="22" ry="11" fill="url(#dm-brilho)" />
        {/* telas flutuando */}
        <g>
          <rect x="138" y="62" width="22" height="13" rx="2" fill="#3b1530" stroke="#f472b6" strokeWidth="0.8" transform="skewY(-8)" />
          <line x1="141" y1="70" x2="155" y2="70" stroke="#f9a8d4" strokeWidth="0.8" transform="skewY(-8)" />
          <rect x="168" y="78" width="22" height="13" rx="2" fill="#0c2a36" stroke="#67d8f2" strokeWidth="0.8" transform="skewY(-8)" />
          <line x1="171" y1="85" x2="186" y2="85" stroke="#a5f3fc" strokeWidth="0.8" transform="skewY(-8)" />
        </g>
        {/* duas pessoas */}
        <g>
          <line x1="100" y1="104" x2="100" y2="112" stroke="#60a5fa" strokeWidth="2" />
          <circle cx="100" cy="100" r="4" fill="#60a5fa" />
          <line x1="222" y1="104" x2="222" y2="112" stroke="#f87171" strokeWidth="2" />
          <circle cx="222" cy="100" r="4" fill="#f87171" />
        </g>
      </svg>
      <Chip className="bottom-3 right-3 border-violet-400/40 bg-violet-500/15 text-violet-200">WebGL Ao Vivo</Chip>
    </div>
  );
}

function Card({
  href, icone, titulo, texto, visual, tom,
}: { href: string; icone: React.ReactNode; titulo: string; texto: string; visual: React.ReactNode; tom: "ciano" | "violeta" }) {
  return (
    <Link
      href={href}
      className={`group relative block rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#111826] to-[#0c111b] p-5 transition-colors duration-300 md:p-6 ${tom === "ciano" ? "hover:border-cyan-300/40" : "hover:border-violet-400/40"}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tom === "ciano" ? "bg-cyan-400/10 text-cyan-300" : "bg-violet-500/15 text-violet-300"}`}>
        {icone}
      </span>
      <h3 className="mt-5 font-[family-name:var(--font-space)] text-lg font-semibold text-white">{titulo}</h3>
      <p className="mt-1.5 text-sm text-slate-400">{texto}</p>
      <div className="mt-5">{visual}</div>
    </Link>
  );
}

export default function DuasMetades() {
  return (
    <section id="duas-metades" aria-labelledby="duas-metades-titulo" className={`${BORDA} relative z-[30] scroll-mt-28 py-16 md:py-24`}>
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <h2 id="duas-metades-titulo" className="font-[family-name:var(--font-space)] text-[1.75rem] font-semibold tracking-[-0.01em] text-slate-900 md:text-[2.25rem] dark:text-white">
          Duas metades da mesma plataforma
        </h2>
        <p className="mt-2 text-sm text-slate-600 md:text-base dark:text-slate-400">
          Rigor científico e vivência colaborativa integrados em um fluxo único de estudo.
        </p>

        <div className="relative mt-10 grid gap-5 md:grid-cols-2 md:gap-6">
          <Card
            href={CHAT_ROTA}
            tom="ciano"
            titulo="Chat de Pesquisa"
            texto="Todas as IAs, com fontes reais e citações ABNT."
            visual={<VisualChat />}
            icone={
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <rect x="2.5" y="4" width="15" height="12" rx="2" /><path d="M6 8.5l2 1.75L6 12M10 12h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          />
          <Card
            href="#cyberespaco"
            tom="violeta"
            titulo="Cyberespaço 3D"
            texto="Um mundo 3D onde você estuda ao lado de outras pessoas."
            visual={<VisualCyber />}
            icone={
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
                <path d="M3 6V4.5A1.5 1.5 0 0 1 4.5 3H6M14 3h1.5A1.5 1.5 0 0 1 17 4.5V6M17 14v1.5a1.5 1.5 0 0 1-1.5 1.5H14M6 17H4.5A1.5 1.5 0 0 1 3 15.5V14" strokeLinecap="round" />
                <path d="M10 6.5l3 1.7v3.6L10 13.5l-3-1.7V8.2z M7 8.2l3 1.7 3-1.7 M10 9.9v3.6" strokeLinejoin="round" />
              </svg>
            }
          />
          {/* o nó que liga as duas metades */}
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 hidden h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/60 bg-[#0b1a22] shadow-[0_0_14px_rgba(103,216,242,0.6)] md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-200" />
          </span>
        </div>
      </motion.div>
    </section>
  );
}
