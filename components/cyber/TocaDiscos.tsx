"use client";
/**
 * TocaDiscos — o pop-up do player de música do lounge da Zaeon (mesmo estilo do recado pro QG): o dono sobe as
 * músicas dele (vários arquivos de uma vez), vê a playlist, escolhe uma faixa e controla ⏮ ⏯ ⏹ ⏭. A música sai pelas
 * caixas de som do lounge, sincronizada pra todo mundo da sala (lib/lounge3d/musica + components/cyber/SomLounge).
 */
import { useEffect, useRef, useState } from "react";
import { MAX_BYTES_FAIXA, MAX_FAIXAS, nomeDoArquivo, posicaoAgora, tempo, type AcaoSom, type SomLounge } from "@/lib/lounge3d/musica";

export type ApiMusica = {
  subir(file: File, dur: number, nome: string): Promise<{ ok: boolean; erro?: string }>;
  controlar(acao: AcaoSom, i?: number): Promise<{ ok: boolean; erro?: string }>;
  remover(id: string): Promise<{ ok: boolean; erro?: string }>;
};

/** a duração de um arquivo de áudio (lida no navegador antes de subir); 0 se não der */
function duracaoDe(file: File): Promise<number> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file), a = new Audio(); let feito = false;
    const fim = (d: number) => { if (feito) return; feito = true; URL.revokeObjectURL(url); ok(Number.isFinite(d) && d > 0 ? d : 0); };
    a.preload = "metadata"; a.onloadedmetadata = () => fim(a.duration); a.onerror = () => fim(0); setTimeout(() => fim(0), 8000); a.src = url;
  });
}

const BTN = "flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/35 bg-[#0a081e]/80 text-base text-sky-100 hover:border-cyan-200 disabled:opacity-40";

export default function TocaDiscos(p: { som: SomLounge | null; offsetMs: number; api: ApiMusica; onFechar: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());
  const [enviando, setEnviando] = useState<string | null>(null), [erro, setErro] = useState<string | null>(null), [ocupado, setOcupado] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { const id = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(id); }, []);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") p.onFechar(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [p]);

  const som = p.som, faixas = som?.faixas ?? [], pos = som ? posicaoAgora(som, agora + p.offsetMs) : null, atual = pos ? faixas[pos.i] : undefined;
  const tocando = !!som?.estado.tocando;

  const fazer = async (f: () => Promise<{ ok: boolean; erro?: string }>) => { if (ocupado) return; setOcupado(true); setErro(null); try { const r = await f(); if (!r.ok) setErro(r.erro ?? "Não deu."); } catch { setErro("Sem conexão."); } finally { setOcupado(false); } };
  const subir = async (lista: FileList | null) => {
    const arqs = Array.from(lista ?? []); if (!arqs.length) return;
    setErro(null);
    for (let k = 0; k < arqs.length; k++) {
      const f = arqs[k]!;
      if (f.size > MAX_BYTES_FAIXA) { setErro(`"${f.name}" passa de 20 MB.`); continue; }
      setEnviando(`Enviando ${k + 1}/${arqs.length}: ${nomeDoArquivo(f.name)}…`);
      try { const r = await p.api.subir(f, await duracaoDe(f), nomeDoArquivo(f.name)); if (!r.ok) { setErro(r.erro ?? "Não deu pra enviar."); if (/playlist já tem/.test(r.erro ?? "")) break; } } catch { setErro("Sem conexão."); }
    }
    setEnviando(null); if (input.current) input.current.value = "";
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Toca-discos do lounge" className="absolute inset-0 z-50 flex items-center justify-center bg-[#03030a]/60 px-4" onClick={p.onFechar}>
      <div className="flex max-h-[86vh] w-full max-w-[460px] flex-col rounded-2xl border border-cyan-300/30 bg-[#070c22]/95 p-4 text-sky-100 shadow-[0_0_40px_rgba(102,230,255,.15)]" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-cyan-200">Toca-discos do lounge</p>
        <p className="mt-1 text-xs text-sky-100/60">Suas músicas tocam nas caixas de som do lounge — quem estiver por perto ouve junto, no mesmo ponto da música.</p>

        {/* tocando agora + controles */}
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-white">{atual ? `${tocando ? "▶" : "⏸"} ${atual.nome}` : "Nenhuma música ainda"}</p>
          {atual && pos && <p className="text-xs tabular-nums text-sky-100/60">{tempo(pos.t)}{atual.dur ? ` / ${tempo(atual.dur)}` : ""}{!tocando && pos.t === 0 ? " · parado" : !tocando ? " · pausado" : ""}</p>}
          {atual && atual.dur > 0 && pos && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-cyan-300 to-violet-400" style={{ width: `${Math.min(100, (pos.t / atual.dur) * 100)}%` }} /></div>}
          <div className="mt-2.5 flex items-center justify-center gap-3" role="group" aria-label="Controles">
            <button type="button" aria-label="Anterior" disabled={!faixas.length || ocupado} onClick={() => void fazer(() => p.api.controlar("anterior"))} className={BTN}>⏮</button>
            <button type="button" aria-label={tocando ? "Pausar" : "Tocar"} disabled={!faixas.length || ocupado} onClick={() => void fazer(() => p.api.controlar(tocando ? "pausar" : "tocar"))} className={`${BTN} h-12 w-12 bg-gradient-to-b from-cyan-200 to-sky-400 text-slate-950`}>{tocando ? "⏸" : "▶"}</button>
            <button type="button" aria-label="Parar" disabled={!faixas.length || ocupado} onClick={() => void fazer(() => p.api.controlar("parar"))} className={BTN}>⏹</button>
            <button type="button" aria-label="Próxima" disabled={!faixas.length || ocupado} onClick={() => void fazer(() => p.api.controlar("proxima"))} className={BTN}>⏭</button>
          </div>
        </div>

        {/* playlist */}
        <ol className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" aria-label="Playlist">
          {faixas.map((f, i) => (
            <li key={f.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${pos?.i === i ? "bg-cyan-300/15 text-white" : "text-sky-100/80 hover:bg-white/5"}`}>
              <button type="button" onClick={() => void fazer(() => p.api.controlar("ir", i))} className="min-h-[32px] min-w-0 flex-1 truncate text-left" title={`Tocar ${f.nome}`}>
                <span className="mr-1.5 tabular-nums text-sky-100/40">{i + 1}.</span>{f.nome}
              </button>
              {f.dur > 0 && <span className="tabular-nums text-sky-100/40">{tempo(f.dur)}</span>}
              <button type="button" aria-label={`Tirar ${f.nome}`} onClick={() => void fazer(() => p.api.remover(f.id))} className="min-h-[32px] min-w-[32px] rounded-full text-rose-200/70 hover:text-rose-200">×</button>
            </li>
          ))}
        </ol>

        {enviando && <p role="status" className="mt-2 text-xs text-cyan-200">{enviando}</p>}
        {erro && <p role="alert" className="mt-2 text-xs text-rose-300">{erro}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-sky-100/40">{faixas.length}/{MAX_FAIXAS} · até 20 MB cada</span>
          <div className="flex gap-2">
            <button type="button" onClick={p.onFechar} className="min-h-[40px] rounded-full border border-white/15 px-4 text-xs text-sky-100/80">Fechar</button>
            <input ref={input} type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.aac,.flac,.webm" multiple className="hidden" onChange={(e) => void subir(e.target.files)} />
            <button type="button" disabled={!!enviando || faixas.length >= MAX_FAIXAS} onClick={() => input.current?.click()} className="min-h-[40px] rounded-full bg-gradient-to-b from-cyan-200 to-sky-400 px-5 text-xs font-extrabold text-slate-950 disabled:opacity-50">{enviando ? "Enviando…" : "＋ Adicionar músicas"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
