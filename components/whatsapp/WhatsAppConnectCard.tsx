"use client";

/**
 * Card "Mentor no WhatsApp" (perfil). Fluxo NÃO invasivo: gera um QR `wa.me` do número da
 * plataforma com o código CONECTAR-XXXX; o aluno escaneia/abre, envia, e o vínculo fica
 * verified + optIn. Consentimento explícito (o envio do código) + "PARE" desliga.
 */
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, QrCode, ExternalLink, Loader2, PowerOff, RefreshCw, ShieldCheck, Moon } from "lucide-react";

type Status = {
  configured: boolean; allowed: boolean; linked: boolean; verified: boolean; optIn: boolean;
  phoneMasked: string | null; quietHours: { start: number; end: number; tz?: string }; pendingCode: boolean; linkedAt: string | null;
};
type Start = { code: string; waUrl: string; qrDataUrl: string; platformPhone: string; alreadyLinked: boolean };

export default function WhatsAppConnectCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/whatsapp/link/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // enquanto o QR está na tela, faz polling até o aluno mandar o código
  useEffect(() => {
    if (!start || status?.linked) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [start, status?.linked, refresh]);

  useEffect(() => { if (status?.linked && start) setStart(null); }, [status?.linked, start]);

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/whatsapp/link/start", { method: "POST" });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setError(body?.error || "Não deu pra gerar o QR agora."); return; }
      setStart(body);
    } catch { setError("Sem conexão."); }
    finally { setBusy(false); }
  };

  const disconnect = async () => {
    setBusy(true);
    try { await fetch("/api/whatsapp/link/status", { method: "DELETE" }); setStart(null); await refresh(); }
    finally { setBusy(false); }
  };

  const setQuiet = async (start: number, end: number) => {
    await fetch("/api/whatsapp/link/status", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quietHours: { start, end, tz: status?.quietHours?.tz } }) });
    await refresh();
  };

  const linked = !!status?.linked;

  return (
    <div className="w-full rounded-[2rem] bg-white/80 dark:bg-white/[0.02] border border-slate-300 dark:border-white/10 shadow-xl backdrop-blur-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-emerald-500" />
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">Mentor no WhatsApp</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest ${linked ? (status?.optIn ? "text-emerald-500" : "text-amber-500") : "text-slate-400"}`}>
          {linked ? (status?.optIn ? "conectado" : "pausado") : status?.pendingCode ? "aguardando código" : "não conectado"}
        </span>
      </div>

      <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
        Seu mentor manda a agenda do dia, lembretes de estudo, revisões espaçadas e conquistas no seu WhatsApp — e responde quando você escreve.
        Não conectamos a sua conta: você só manda um código pro número da Zaeon.
      </p>

      {status && !status.configured && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400 mb-3">O número da plataforma ainda não foi configurado.</div>
      )}
      {status && status.configured && !status.allowed && !linked && (
        <div className="text-[11px] text-amber-600 dark:text-amber-400 mb-3">Recurso do plano Plus. Estudante com e-mail acadêmico ganha 30 dias.</div>
      )}
      {error && <div className="text-[11px] text-rose-500 mb-3">{error}</div>}

      {linked ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[12px] text-slate-700 dark:text-slate-200">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Número {status?.phoneMasked ?? "vinculado"} · {status?.optIn ? "recebendo mensagens" : "mensagens pausadas (responda VOLTAR no Zap)"}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Moon size={13} />
            <span>Não incomodar das</span>
            <select value={status?.quietHours.start ?? 22} onChange={(e) => setQuiet(Number(e.target.value), status?.quietHours.end ?? 7)} className="bg-transparent border border-slate-300 dark:border-white/10 rounded-md px-1 py-0.5">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
            </select>
            <span>às</span>
            <select value={status?.quietHours.end ?? 7} onChange={(e) => setQuiet(status?.quietHours.start ?? 22, Number(e.target.value))} className="bg-transparent border border-slate-300 dark:border-white/10 rounded-md px-1 py-0.5">
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}h</option>)}
            </select>
          </div>
          <button onClick={disconnect} disabled={busy} className="self-start inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-400 disabled:opacity-50">
            <PowerOff size={13} /> Desligar
          </button>
        </div>
      ) : start ? (
        <div className="flex flex-col md:flex-row gap-5 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={start.qrDataUrl} alt="QR para conectar o WhatsApp" className="w-40 h-40 rounded-xl bg-white p-1 border border-slate-200" />
          <div className="flex-1 flex flex-col gap-2 text-[12px] text-slate-700 dark:text-slate-200">
            <p>1. Escaneie o QR (ou toque no botão no celular).</p>
            <p>2. O WhatsApp abre com o código <b className="font-mono">CONECTAR-{start.code}</b>. Só envie.</p>
            <p>3. Pronto — o mentor responde por lá. Esta tela atualiza sozinha.</p>
            <div className="flex items-center gap-3 mt-1">
              <a href={start.waUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-white px-3 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-400">
                <ExternalLink size={13} /> Abrir no WhatsApp
              </a>
              <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"><RefreshCw size={12} /> novo código</button>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-1">Enviar o código autoriza as mensagens do mentor. Para parar a qualquer momento, responda <b>PARE</b>.</p>
          </div>
        </div>
      ) : (
        <button onClick={generate} disabled={busy || (status ? !status.configured || !status.allowed : false)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-400 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />} Gerar QR e conectar
        </button>
      )}
    </div>
  );
}
