"use client";
/**
 * PassosTurno — os passos de um turno do Octa na janela do agente, um por linha, como no Claude Code:
 * bolinha de estado (rodando pulsa · ✓ · ✗ · esperando você), o que está fazendo, o arquivo, e embaixo (⎿) o resumo e
 * os arquivos gravados. CartaoAprovacao = quando o nível de permissão do projeto pede o "sim" do aluno.
 */
import { Loader2, ShieldAlert } from "lucide-react";
import { passosDoTurno, pedidoDeAprovacao, type EventoTurno } from "@/lib/octa/passos";

const Z = { borda: "#363c46", texto: "#dce0e5", fraco: "#a9afbc", apagado: "#878a98", acento: "#74ade8", ok: "#a1c181", erro: "#d07277", aviso: "#dec184", sel: "#3b414d", bg: "#282c33" };
const COR = { rodando: Z.acento, aguardando: Z.aviso, ok: Z.ok, falhou: Z.erro } as const;

export function PassosTurno({ eventos, vivo, onAbrirArquivo }: {
  eventos: readonly EventoTurno[];
  /** Turno ainda andando: mostra "Pensando…" e o passo atual pulsando. */
  vivo: boolean;
  onAbrirArquivo?: (path: string) => void;
}) {
  const passos = passosDoTurno(eventos, !vivo);
  if (!passos.length) {
    return vivo ? <div className="flex items-center gap-2 text-[12px]" style={{ color: Z.fraco }}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Começando…</div> : null;
  }
  return (
    <ol className="space-y-1.5 font-mono text-[11.5px] leading-relaxed" aria-label="Passos do Octa">
      {passos.map((p) => {
        if (p.tipo === "pensando") {
          return <li key={p.chave} className="flex items-center gap-2" style={{ color: Z.fraco }}><Loader2 className="w-3 h-3 animate-spin" style={{ color: Z.acento }} /> Pensando…</li>;
        }
        if (p.tipo === "erro") {
          return <li key={p.chave} className="flex items-start gap-2" style={{ color: Z.erro }}><span aria-hidden>✗</span><span className="font-sans text-[12px]">{p.texto}</span></li>;
        }
        return (
          <li key={p.chave}>
            <div className="flex items-baseline gap-2 min-w-0">
              <span aria-hidden className={`relative top-[1px] inline-block w-2 h-2 rounded-full shrink-0 ${p.estado === "rodando" && vivo ? "animate-pulse" : ""}`} style={{ background: COR[p.estado] }} />
              <span style={{ color: Z.texto }}>{p.rotulo}</span>
              {p.path && <span className="truncate" style={{ color: Z.fraco }}>{p.path}</span>}
              <span className="ml-auto shrink-0" style={{ color: COR[p.estado] }}>
                {p.estado === "ok" ? "✓" : p.estado === "falhou" ? "✗" : p.estado === "aguardando" ? "esperando você" : vivo ? "…" : ""}
              </span>
            </div>
            {(p.resumo || p.motivo) && (
              <div className="pl-4 flex gap-1.5" style={{ color: p.motivo ? Z.erro : Z.apagado }}>
                <span aria-hidden>⎿</span><span className="font-sans text-[11.5px] break-words min-w-0">{p.motivo ?? p.resumo}</span>
              </div>
            )}
            {!!p.arquivos.length && (
              <div className="pl-4 flex flex-wrap items-center gap-1" style={{ color: Z.apagado }}>
                <span aria-hidden>⎿</span>
                {p.arquivos.map((a) => (
                  <button key={`${a.acao}-${a.path}`} type="button" disabled={a.acao === "apagado" || !onAbrirArquivo} onClick={() => onAbrirArquivo?.(a.path)}
                    className="px-1.5 rounded enabled:hover:underline" style={{ background: a.acao === "apagado" ? "#d0727722" : "#a1c18122", color: a.acao === "apagado" ? Z.erro : Z.ok }}>
                    {a.acao === "apagado" ? "− " : "✎ "}{a.path}
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function CartaoAprovacao({ tool, path, ocupado, onDecidir }: {
  tool: string; path?: string; ocupado?: boolean; onDecidir: (aprovado: boolean) => void;
}) {
  return (
    <div role="group" aria-label="Aprovação" className="rounded-lg p-3 space-y-2" style={{ border: `1px solid ${Z.aviso}55`, background: "#dec18412" }}>
      <div className="flex items-start gap-2 text-[12.5px]" style={{ color: Z.texto }}>
        <ShieldAlert className="w-4 h-4 shrink-0 mt-[1px]" style={{ color: Z.aviso }} />
        <span>O Octa quer <b>{pedidoDeAprovacao(tool, path)}</b>. Pode?</span>
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={ocupado} onClick={() => onDecidir(true)} className="h-7 px-3 rounded-md text-[12px] font-medium disabled:opacity-50" style={{ background: Z.ok, color: "#1b1e24" }}>Aprovar</button>
        <button type="button" disabled={ocupado} onClick={() => onDecidir(false)} className="h-7 px-3 rounded-md text-[12px] disabled:opacity-50" style={{ border: `1px solid ${Z.borda}`, color: Z.fraco }}>Recusar</button>
      </div>
    </div>
  );
}
