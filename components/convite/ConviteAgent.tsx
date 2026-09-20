"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PaperClipIcon } from "@heroicons/react/24/outline";
import { onEnterSubmit } from "@/lib/ui/enterSubmit";

type Role = "student" | "teacher";

interface CollectedData {
  name: string;
  age: number;
  area: string;
  role: Role;
  subject?: string;
  institution: string;
  verificationDoc?: string;
}

type Phase =
  | "name"
  | "age"
  | "area"
  | "role"
  | "subject"
  | "institution"
  | "doc"
  | "done";

interface ChatMessage {
  from: "agent" | "user";
  text: string;
  imagePreview?: string;
}

interface Props {
  sessionToken: string;
  inviteCode: string;
  onComplete: () => void;
}

function getAgentMessage(phase: Phase, collected: Partial<CollectedData>): string {
  switch (phase) {
    case "name":
      return "Olá! Bem-vindo ao Zaeon. 👋 Qual é o seu nome completo?";
    case "age":
      return `Prazer, ${collected.name}! Quantos anos você tem?`;
    case "area":
      return "Legal! Qual é a sua área de estudo ou atuação?";
    case "role":
      return "Você é estudante ou professor?";
    case "subject":
      return "Qual disciplina você ensina?";
    case "institution":
      return collected.role === "teacher"
        ? "Em qual instituição você leciona?"
        : "Em qual instituição você estuda?";
    case "doc":
      return "Ótimo! Para finalizar, você tem uma foto do seu comprovante de matrícula ou carteira estudantil? Me envia aqui 📎";
    case "done":
      return "Perfeito! Tudo anotado. Vamos finalizar seu cadastro com o Google. 🚀";
    default:
      return "";
  }
}

export default function ConviteAgent({ sessionToken, inviteCode, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("name");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "agent", text: getAgentMessage("name", {}) },
  ]);
  const [input, setInput] = useState("");
  const [collected, setCollected] = useState<Partial<CollectedData>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (msg: ChatMessage) =>
    setMessages((prev) => [...prev, msg]);

  const advanceToPhase = (
    nextPhase: Phase,
    updatedCollected: Partial<CollectedData>
  ) => {
    setPhase(nextPhase);
    addMessage({ from: "agent", text: getAgentMessage(nextPhase, updatedCollected) });
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || saving) return;
    setInput("");
    setError(null);

    addMessage({ from: "user", text: value });

    const next = { ...collected };

    switch (phase) {
      case "name":
        next.name = value;
        setCollected(next);
        advanceToPhase("age", next);
        break;

      case "age": {
        const age = parseInt(value, 10);
        if (isNaN(age) || age < 13 || age > 100) {
          addMessage({ from: "agent", text: "Por favor, insira uma idade válida (ex: 21)." });
          return;
        }
        next.age = age;
        setCollected(next);
        advanceToPhase("area", next);
        break;
      }

      case "area":
        next.area = value;
        setCollected(next);
        advanceToPhase("role", next);
        break;

      case "role": {
        const normalized = value.toLowerCase();
        if (normalized.includes("professor") || normalized.includes("teacher")) {
          next.role = "teacher";
          setCollected(next);
          advanceToPhase("subject", next);
        } else if (
          normalized.includes("estudante") ||
          normalized.includes("student") ||
          normalized.includes("aluno")
        ) {
          next.role = "student";
          setCollected(next);
          advanceToPhase("institution", next);
        } else {
          addMessage({
            from: "agent",
            text: 'Por favor, responda "estudante" ou "professor".',
          });
        }
        break;
      }

      case "subject":
        next.subject = value;
        setCollected(next);
        advanceToPhase("institution", next);
        break;

      case "institution":
        next.institution = value;
        setCollected(next);
        advanceToPhase("doc", next);
        break;

      case "doc":
        next.verificationDoc = undefined;
        setCollected(next);
        await savePending(next as CollectedData);
        break;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const updated = { ...collected, verificationDoc: base64 };
      setCollected(updated);

      addMessage({
        from: "user",
        text: file.name,
        imagePreview: file.type.startsWith("image/") ? base64 : undefined,
      });
      addMessage({
        from: "agent",
        text: "Recebi! 📎 Vamos finalizar o seu cadastro.",
      });

      await savePending(updated as CollectedData);
    };
    reader.readAsDataURL(file);
  };

  const handleSkipDoc = async () => {
    addMessage({ from: "user", text: "Prefiro enviar depois." });
    addMessage({
      from: "agent",
      text: "Sem problema! Ou se preferir, me envia depois, ok? 😊 Vamos finalizar o cadastro.",
    });
    const updated = { ...collected, verificationDoc: undefined };
    setCollected(updated);
    await savePending(updated as CollectedData);
  };

  const savePending = async (data: CollectedData) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/convite/salvar-pendente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionToken,
          inviteCode,
          name: data.name,
          age: data.age,
          area: data.area,
          role: data.role,
          subject: data.subject ?? null,
          institution: data.institution,
          verificationDoc: data.verificationDoc ?? null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao salvar dados.");
        return;
      }

      setPhase("done");
      addMessage({ from: "agent", text: getAgentMessage("done", data) });
      setTimeout(onComplete, 1500);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030014] flex items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col h-[80vh] bg-white/5 backdrop-blur-2xl border border-cyan-500/20 rounded-[2rem] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5">
          <h2 className="text-lg font-black text-white tracking-tight">
            Zaeon <span className="text-cyan-400 font-medium text-sm ml-1">onboarding</span>
          </h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                    msg.from === "agent"
                      ? "bg-white/10 text-white/90"
                      : "bg-cyan-500 text-black font-medium"
                  }`}
                >
                  {msg.imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={msg.imagePreview}
                      alt="comprovante"
                      className="max-w-[200px] rounded-xl mb-2"
                    />
                  )}
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Error */}
        {error && (
          <p className="px-6 py-2 text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Input area */}
        {phase !== "done" && (
          <div className="p-4 border-t border-white/5">
            {phase === "doc" ? (
              <div className="flex gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  <PaperClipIcon className="w-4 h-4" />
                  Enviar comprovante
                </button>
                <button
                  onClick={handleSkipDoc}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-white/50 text-sm hover:text-white/70 hover:border-white/20 transition-colors"
                >
                  Enviar depois
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type={phase === "age" ? "number" : "text"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onEnterSubmit(handleSend)}
                  placeholder={
                    phase === "role"
                      ? "estudante / professor"
                      : phase === "age"
                      ? "ex: 22"
                      : ""
                  }
                  autoFocus
                  className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-cyan-500 transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || saving}
                  className="px-5 py-3 bg-cyan-500 text-black rounded-2xl text-sm font-bold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
