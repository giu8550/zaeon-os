"use client";

/**
 * ApprovalCard — o cartão de aprovação do MODO GUIADO (gap K da §7; §11.4 do plano).
 * Quando execMode="guiado", o laço PAUSA nos gates HITL (aprovar plano / tool cara /
 * draft) e mostra este cartão — análogo ao plan-mode do Claude. O usuário: Aprova,
 * Edita (ajusta o texto/plano) ou Redireciona (manda outra instrução).
 *
 * Componente CONTROLADO e agnóstico do gate: quem chama passa o tipo, o resumo e os
 * callbacks. Reusa o REQUIRE_APPROVAL do permit() (runtime.ts). Pronto para o PR07
 * ligar no runTrajectory (await approvalGate(phase, st)).
 */
import { useState } from "react";
import { Check, Pencil, CornerUpRight, X } from "lucide-react";

export type ApprovalKind = "plano" | "ferramenta" | "rascunho";

const HEAD: Record<ApprovalKind, { emoji: string; title: string; approve: string }> = {
  plano: { emoji: "🧭", title: "Aprovar o plano?", approve: "Seguir com o plano" },
  ferramenta: { emoji: "⚙️", title: "Autorizar esta ação?", approve: "Autorizar" },
  rascunho: { emoji: "📝", title: "Aprovar o rascunho?", approve: "Finalizar" },
};

export default function ApprovalCard({
  kind,
  summary,
  onApprove,
  onEdit,
  onRedirect,
  busy = false,
}: {
  kind: ApprovalKind;
  summary: string;                         // o que será aprovado (plano em texto, args da tool, resumo do draft)
  onApprove: () => void;
  onEdit?: (text: string) => void;         // devolve o texto editado (plano/rascunho)
  onRedirect?: (instruction: string) => void; // nova instrução que redireciona o laço
  busy?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "redirect">("idle");
  const [text, setText] = useState(summary);
  const [instr, setInstr] = useState("");
  const head = HEAD[kind];

  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.05] dark:bg-white/[0.03] px-4 py-3 max-w-[460px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[18px] leading-none">{head.emoji}</span>
        <span className="font-tech text-[15px] font-medium text-slate-800 dark:text-white/90">{head.title}</span>
        <span className="ml-auto font-tech text-[11px] px-2 py-0.5 rounded-full bg-violet-500/12 text-violet-600 dark:text-violet-300">Guiado</span>
      </div>

      {mode !== "edit" && (
        <p className="font-tech text-[13px] leading-[1.5] text-slate-600 dark:text-white/70 whitespace-pre-wrap mb-3">{summary}</p>
      )}
      {mode === "edit" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-xl bg-white/70 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 px-3 py-2 font-tech text-[13px] text-slate-800 dark:text-white/90 outline-none mb-3"
        />
      )}
      {mode === "redirect" && (
        <input
          value={instr}
          onChange={(e) => setInstr(e.target.value)}
          placeholder="Diga o que mudar de rota…"
          className="w-full rounded-xl bg-white/70 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 px-3 py-2 font-tech text-[13px] text-slate-800 dark:text-white/90 outline-none mb-3"
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {mode === "idle" && (
          <>
            <button
              type="button" onClick={onApprove} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-white text-[13px] font-tech disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
            >
              <Check size={14} /> {head.approve}
            </button>
            {onEdit && (
              <button type="button" onClick={() => setMode("edit")} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[13px] font-tech text-slate-600 dark:text-white/70 hover:bg-slate-500/10">
                <Pencil size={13} /> Editar
              </button>
            )}
            {onRedirect && (
              <button type="button" onClick={() => setMode("redirect")} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[13px] font-tech text-slate-600 dark:text-white/70 hover:bg-slate-500/10">
                <CornerUpRight size={13} /> Redirecionar
              </button>
            )}
          </>
        )}
        {mode === "edit" && (
          <>
            <button type="button" onClick={() => { onEdit?.(text); setMode("idle"); }} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-white text-[13px] font-tech disabled:opacity-40" style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
              <Check size={14} /> Aprovar edição
            </button>
            <button type="button" onClick={() => { setText(summary); setMode("idle"); }} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[13px] font-tech text-slate-500 hover:bg-slate-500/10">
              <X size={13} /> Cancelar
            </button>
          </>
        )}
        {mode === "redirect" && (
          <>
            <button type="button" onClick={() => { if (instr.trim()) onRedirect?.(instr.trim()); setMode("idle"); }} disabled={busy || !instr.trim()}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-white text-[13px] font-tech disabled:opacity-40" style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
              <CornerUpRight size={14} /> Enviar nova rota
            </button>
            <button type="button" onClick={() => { setInstr(""); setMode("idle"); }} className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[13px] font-tech text-slate-500 hover:bg-slate-500/10">
              <X size={13} /> Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
