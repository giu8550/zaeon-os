"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Cpu, Sparkles, MessageSquare, Zap, Dna, Send, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { onEnterSubmit } from "@/lib/ui/enterSubmit";

// ─── BioSim3D (dynamic — Three.js can't SSR) ─────────────────────────────────
const BioSim3DModule = dynamic(
  () => import("@/app/agentic-modules/biosim3d/BioSim3DModule"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 flex items-center justify-center rounded-[2rem] border border-white/10 bg-white/5">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">
            Loading BioSim 3D...
          </span>
        </div>
      </div>
    ),
  }
);

// ─── Quantum Lab (physics + math simulator) ───────────────────────────────────
const QuantumLabModule = dynamic(
  () => import("@/app/agentic-modules/quantumlab/QuantumLabModule"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 flex items-center justify-center rounded-[2rem] border border-indigo-500/20 bg-black/20">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Loading Quantum Lab...</span>
        </div>
      </div>
    ),
  }
);

// ─── Code Lab (Monaco + Pyodide coding environment) ──────────────────────────
const CodeLabModule = dynamic(
  () => import("@/app/agentic-modules/codelab/CodeLabModule"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 flex items-center justify-center rounded-[2rem] border border-cyan-500/20 bg-black/20">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Loading Code Lab...</span>
        </div>
      </div>
    ),
  }
);

// ─── Aura Chat placeholder ────────────────────────────────────────────────────
function AuraChat() {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);

    try {
      // /api/chat/messages nunca existiu; o chat de IA é /api/ai/chat ({ prompt } → { text }).
      const res  = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, agent: "aura" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || String(res.status));
      setMessages(m => [...m, { role: "ai", text: data.text ?? "..." }]);
    } catch {
      setMessages(m => [...m, { role: "ai", text: "Connection error. Please retry." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-[2rem] bg-white/60 dark:bg-[#1a1a1a]/40 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-xl dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex flex-col gap-4">
      <h3 className="text-lg font-bold text-slate-800 dark:text-white/90 flex items-center gap-2">
        <Sparkles size={18} className="text-violet-500" />
        Chat com Aura
      </h3>

      <div className="flex-1 min-h-[150px] bg-white/30 dark:bg-black/20 rounded-2xl border border-black/5 dark:border-white/5 flex flex-col gap-2 p-3 overflow-y-auto max-h-64">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-slate-400 dark:text-white/30 italic">
              Inicie uma conversa para explorar temas de pesquisa...
            </span>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <span
                className={`px-3 py-2 rounded-xl text-xs max-w-[80%] ${
                  m.role === "user"
                    ? "bg-violet-500/20 text-violet-900 dark:text-violet-200"
                    : "bg-white/30 dark:bg-white/10 text-slate-700 dark:text-white/80"
                }`}
              >
                {m.text}
              </span>
            </div>
          ))
        )}
        {loading && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 size={12} className="animate-spin" />
            <span className="text-xs">Aura está pensando...</span>
          </div>
        )}
      </div>

      <div className="relative flex items-center bg-white dark:bg-[#1a1a1a] rounded-2xl border border-black/10 dark:border-white/10 p-2 shadow-sm">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onEnterSubmit(send)}
          placeholder="Ex: Quais são as tendências recentes em neurociência computacional?"
          className="flex-1 bg-transparent text-xs outline-none px-3 text-slate-700 dark:text-white placeholder:text-slate-400"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="p-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white rounded-xl shadow-md hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MessageSquare size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgenticAreaContent() {
  const { data: session } = useSession();

  // Map course → room key for BioSim context
  const courseRoom = (() => {
    const course = ((session?.user as any)?.course ?? "").toLowerCase();
    if (["medicina", "enfermagem", "farmácia", "fisioterapia", "biomedicina", "odontologia"].some(c => course.includes(c.toLowerCase()))) return "med";
    if (["biologia", "biotecnologia", "bioquímica", "ecologia"].some(c => course.includes(c.toLowerCase()))) return "bio";
    if (["física", "matemática", "estatística", "astronomia", "astrofísica"].some(c => course.includes(c.toLowerCase()))) return "quantic";
    if (["computação", "engenharia de software", "sistemas", "cibersegurança", "redes", "ia", "dados"].some(c => course.includes(c.toLowerCase()))) return "cyber";
    return "bio"; // default
  })();

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 max-w-[1400px] mx-auto w-full h-full">

      {/* ─── HEADER CARD ──────────────────────────────────────────────────── */}
      <div className="w-full p-8 rounded-[2rem] bg-white/40 dark:bg-slate-900/20 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-72 h-72 bg-violet-400/10 dark:bg-violet-500/10 rounded-full blur-[80px] -translate-y-1/2 -translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-cyan-400/10 dark:bg-cyan-500/10 rounded-full blur-[60px] translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <Bot className="text-violet-600 dark:text-violet-400" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                Pesquisa Agêntica
              </h1>
              <p className="text-xs text-slate-500 dark:text-white/50">
                Delegue pesquisas complexas a redes de agentes IA especializados.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AGENT CARDS ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: Sparkles, title: "Aura", desc: "Assistente de propósito geral. Resumos, brainstorming e ideação de temas de pesquisa.", color: "violet", status: "Online" },
          { icon: Cpu,      title: "Scholar", desc: "Agente especialista em busca e síntese de artigos científicos e meta-análises.", color: "cyan", status: "Em breve" },
          { icon: Zap,      title: "Synapse", desc: "Cruzamento de dados entre bases. Identifica correlações e gaps na literatura.", color: "amber", status: "Em breve" },
        ].map((item) => {
          const Icon = item.icon;
          const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
            violet: { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", badge: "bg-violet-500/20 text-violet-700 dark:text-violet-300" },
            cyan:   { bg: "bg-cyan-500/10",   text: "text-cyan-600 dark:text-cyan-400",     badge: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300" },
            amber:  { bg: "bg-amber-500/10",  text: "text-amber-600 dark:text-amber-400",   badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300" },
          };
          const colors     = colorMap[item.color];
          const isDisabled = item.status !== "Online";

          return (
            <motion.div
              key={item.title}
              whileHover={isDisabled ? {} : { scale: 1.02 }}
              className={`flex flex-col p-6 rounded-[2rem] backdrop-blur-2xl border transition-all duration-300 ${
                isDisabled
                  ? "bg-white/20 dark:bg-slate-900/10 border-white/30 dark:border-white/5 opacity-60 cursor-not-allowed"
                  : "bg-white/40 dark:bg-slate-900/20 border-white/60 dark:border-white/10 hover:bg-white/60 dark:hover:bg-white/5 cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors.bg} ${colors.text}`}>
                  <Icon size={24} />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${colors.badge}`}>
                  {item.status}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{item.title}</h2>
              <p className="text-xs text-slate-500 dark:text-white/60 leading-relaxed">{item.desc}</p>
            </motion.div>
          );
        })}
      </div>

      {/* ─── BIOSIM 3D ───────────────────────────────────────────────────── */}
      <div className="w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
            <Dna size={20} className="text-cyan-500 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">
              Simulação 3D em Tempo Real
            </h2>
            <p className="text-[10px] text-slate-500 dark:text-white/40">
              Estruturas biológicas, moleculares, quânticas e matemáticas renderizadas em voxels pelo BioSim Engine.
            </p>
          </div>
        </div>

        <BioSim3DModule courseRoom={courseRoom} />

        {/* Quantum Lab — only shown for quantic room */}
        {courseRoom === 'quantic' && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                <Sparkles size={20} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">
                  Quantum Lab — Physics Simulator
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-white/40">
                  Wave functions · Bloch sphere · Energy levels · Double-slit · Schrödinger solver
                </p>
              </div>
            </div>
            <QuantumLabModule />
          </div>
        )}

        {/* Code Lab — only shown for cyber room */}
        {courseRoom === 'cyber' && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                <Zap size={20} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-black tracking-tight text-slate-800 dark:text-white">
                  Code Lab — Interactive Editor
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-white/40">
                  JavaScript · TypeScript · Python · HTML · Monaco Editor · Gemini AI assist
                </p>
              </div>
            </div>
            <CodeLabModule />
          </div>
        )}
      </div>

      {/* ─── AURA CHAT ───────────────────────────────────────────────────── */}
      <AuraChat />
    </div>
  );
}
