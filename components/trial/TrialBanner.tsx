"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AcademicCapIcon, SparklesIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

type Status = {
    plan: "free" | "plus";
    daysLeft: number | null;
    trialGranted: boolean;
    eduVerified: boolean;
};

type Step = "idle" | "email" | "code" | "done";

// Banner de trial de estudante — drop-in. Estilo liquid glass (cyan).
// Monte no onboarding (sucesso) e/ou no perfil da workstation.
export default function TrialBanner() {
    const [status, setStatus] = useState<Status | null>(null);
    const [step, setStep] = useState<Step>("idle");
    const [eduEmail, setEduEmail] = useState("");
    const [code, setCode] = useState("");
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);
    const [institution, setInstitution] = useState<string | null>(null);

    const load = async () => {
        const r = await fetch("/api/trial/status");
        if (r.ok) setStatus(await r.json());
    };
    useEffect(() => { load(); }, []);

    const glass = "bg-white/80 dark:bg-cyan-950/10 backdrop-blur-3xl border border-slate-200 dark:border-white/10 shadow-2xl";

    // 1) tenta auto pelo e-mail do login
    const tryAuto = async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/trial/grant", { method: "POST" });
        const d = await r.json();
        setBusy(false);
        if (d.granted) { setInstitution(d.institution); setStep("done"); load(); }
        else setStep("email"); // não é .edu no login → verificação manual
    };

    const requestCode = async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/trial/edu/request", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eduEmail }),
        });
        const d = await r.json();
        setBusy(false);
        if (r.ok) { setInstitution(d.institution); setStep("code"); if (d.devCode) setMsg(`(dev) código: ${d.devCode}`); }
        else setMsg(d.message || "Não consegui validar esse e-mail.");
    };

    const verify = async () => {
        setBusy(true); setMsg("");
        const r = await fetch("/api/trial/edu/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eduEmail, code }),
        });
        const d = await r.json();
        setBusy(false);
        if (r.ok) { setStep("done"); load(); }
        else setMsg(d.message || "Código inválido.");
    };

    if (!status) return null;

    // Plus ativo → mostra contador, discreto
    if (status.plan === "plus" && status.daysLeft !== null) {
        return (
            <div className={`rounded-[2rem] p-5 flex items-center gap-4 ${glass}`}>
                <SparklesIcon className="w-6 h-6 text-cyan-500" />
                <div>
                    <p className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tight">Plano Plus ativo</p>
                    <p className="text-[11px] text-slate-400 uppercase tracking-widest">{status.daysLeft} dias restantes · WhatsApp liberado</p>
                </div>
            </div>
        );
    }

    // Free → CTA de ativação + fluxo
    return (
        <div className={`rounded-[2rem] p-6 ${glass}`}>
            <div className="flex items-center gap-3 mb-3">
                <AcademicCapIcon className="w-6 h-6 text-cyan-500" />
                <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-tight">
                    {status.trialGranted ? "Seu Plus expirou" : "30 dias de Plus grátis pra estudante"}
                </h3>
            </div>

            <AnimatePresence mode="wait">
                {step === "done" ? (
                    <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 text-cyan-600 dark:text-cyan-400">
                        <CheckCircleIcon className="w-7 h-7" />
                        <span className="text-sm font-bold">Plus ativado{institution ? ` · ${institution}` : ""} 🎉</span>
                    </motion.div>
                ) : status.trialGranted ? (
                    <p className="text-[12px] text-slate-500 dark:text-white/40">Você já usou o trial. Faça upgrade pra manter o WhatsApp e a busca avançada.</p>
                ) : step === "idle" ? (
                    <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-[12px] text-slate-500 dark:text-white/40 mb-4">Inclui o assistente no WhatsApp, busca avançada e mais.</p>
                        <button disabled={busy} onClick={tryAuto}
                            className="px-6 py-3 rounded-2xl bg-slate-950 dark:bg-cyan-500 text-white dark:text-black font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                            {busy ? "Verificando..." : "Ativar 30 dias grátis"}
                        </button>
                    </motion.div>
                ) : step === "email" ? (
                    <motion.div key="email" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <p className="text-[12px] text-slate-500 dark:text-white/40">Confirme seu vínculo: informe seu e-mail acadêmico (.edu).</p>
                        <div className="flex gap-3">
                            <input type="email" value={eduEmail} onChange={(e) => setEduEmail(e.target.value)} placeholder="voce@universidade.br"
                                className="flex-1 bg-slate-100 dark:bg-white/5 p-3 rounded-2xl outline-none font-bold text-sm" />
                            <button disabled={busy || !eduEmail} onClick={requestCode}
                                className="px-5 py-3 rounded-2xl bg-cyan-500 text-black font-black text-xs uppercase tracking-widest disabled:opacity-50">
                                {busy ? "..." : "Enviar código"}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="code" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                        <p className="text-[12px] text-slate-500 dark:text-white/40">Digite o código de 6 dígitos que enviamos para {eduEmail}.</p>
                        <div className="flex gap-3">
                            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6}
                                className="flex-1 bg-slate-100 dark:bg-white/5 p-3 rounded-2xl outline-none font-black text-lg tracking-[0.5em] text-center" />
                            <button disabled={busy || code.length < 6} onClick={verify}
                                className="px-5 py-3 rounded-2xl bg-cyan-500 text-black font-black text-xs uppercase tracking-widest disabled:opacity-50">
                                {busy ? "..." : "Confirmar"}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {msg && <p className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-3">{msg}</p>}
        </div>
    );
}
