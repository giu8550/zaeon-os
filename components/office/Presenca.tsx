"use client";
/**
 * Presença das pessoas no chat do escritório (#423, parte 3; balão no #425):
 *   LinhaSistema   → "Martinez entrou no escritório" (linha do sistema, centralizada, sem balão).
 *   AvisoDigitando → um balão por pessoa digitando, igual ao dos agentes: a foto + três pontinhos
 *                    animados, sem texto na tela (o nome vai só pro leitor de tela).
 * Regras e frases em lib/canal/presenca.ts.
 */
import AgentAvatar from "@/components/agents/AgentAvatar";
import { textoDigitando } from "@/lib/canal/presenca";
import { TXT_MUDO, TXT_2, VIDRO_BOLHA } from "@/lib/canal/vidro";

export function LinhaSistema({ texto, hora }: { texto: string; hora?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-1">
      <span className={`px-3 py-1 rounded-full text-[11.5px] bg-slate-500/10 dark:bg-white/[0.06] ${TXT_2}`}>{texto}</span>
      {hora && <span className={`text-[10px] ${TXT_MUDO}`}>{hora}</span>}
    </div>
  );
}

export type PessoaDigitando = { id: string; nome: string; avatar?: string | null };

/** Os três pontinhos pulando, um depois do outro. */
export function TresPontos() {
  return (
    <span aria-hidden="true" data-testid="tres-pontos" className="flex items-center gap-1 h-[18px]">
      {[0, 150, 300].map((atraso) => (
        <span key={atraso} className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-white/50 animate-bounce" style={{ animationDelay: `${atraso}ms` }} />
      ))}
    </span>
  );
}

export function AvisoDigitando({ pessoas }: { pessoas: PessoaDigitando[] }) {
  if (!pessoas.length) return null;
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {pessoas.map((p) => (
        <div key={p.id} role="status" aria-label={textoDigitando([p.nome])} className="flex items-end gap-2">
          <AgentAvatar src={p.avatar} nome={p.nome} size={30} />
          <div className={`px-3.5 py-3 rounded-2xl rounded-bl-md ${VIDRO_BOLHA}`}>
            <TresPontos />
          </div>
        </div>
      ))}
    </div>
  );
}
