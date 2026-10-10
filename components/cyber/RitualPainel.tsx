"use client";
/**
 * RitualPainel — a "call" do RITUAL da chegada do dono (lib/cyber/ritual), aberta no buraco negro dentro da nave: liga
 * a TEMPESTADE no templo (as nuvens se formam em ~8 s pra todo mundo; o 1º trovão energiza as caixas do lounge) e
 * solta/recolhe os ANUNCIADORES (os droids que rodeiam cada pessoa, louvando). O servidor confere que é o dono.
 */
import { useEffect, useState } from "react";
import { FORMACAO_S, faseDaTempestade, type Ritual } from "@/lib/cyber/ritual";

const FASE: Record<string, string> = { off: "céu limpo", formando: "as nuvens se formando…", raios: "raios caindo na capela (ainda mudos)", armada: "tempestade armada — as caixas energizadas" };

export default function RitualPainel(p: { ritual: Ritual | null; offsetMs: number; definir: (m: { tempestade?: boolean; droids?: boolean; veu?: boolean; nave?: boolean }) => Promise<{ ok: boolean; erro?: string }>; /** a nave está no perímetro das nuvens (dá pra tirar o véu)? */ noPerimetro: () => boolean; onFechar: () => void }) {
  const [agora, setAgora] = useState(() => Date.now()), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null), [perto, setPerto] = useState(false);
  useEffect(() => { const id = setInterval(() => { setAgora(Date.now()); setPerto(p.noPerimetro()); }, 500); return () => clearInterval(id); }, [p]);
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === "Escape") p.onFechar(); }; window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [p]);
  const r = p.ritual, tempestade = !!r && r.tempestade > 0, droids = !!r?.droids, veu = !!r && r.veu > 0, fase = faseDaTempestade(r, agora + p.offsetMs);
  const s = tempestade ? Math.max(0, (agora + p.offsetMs - r!.tempestade) / 1000) : 0;
  const mudar = async (m: { tempestade?: boolean; droids?: boolean; veu?: boolean; nave?: boolean }) => { if (ocupado) return; setOcupado(true); setErro(null); try { const x = await p.definir(m); if (!x.ok) setErro(x.erro ?? "Não deu."); } catch { setErro("Sem conexão."); } finally { setOcupado(false); } };
  const BTN = "min-h-[44px] rounded-full px-4 text-xs font-black uppercase tracking-widest disabled:opacity-50";
  return (
    <div role="dialog" aria-modal="true" aria-label="Ritual da chegada" className="absolute inset-0 z-50 flex items-center justify-center bg-[#03030a]/60 px-4" onClick={p.onFechar}>
      <div className="w-full max-w-[440px] rounded-2xl border border-fuchsia-300/30 bg-[#0c0718]/95 p-4 text-fuchsia-50 shadow-[0_0_40px_rgba(255,95,210,.15)]" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-bold text-fuchsia-200">Ritual da chegada</p>
        <p className="mt-1 text-xs text-fuchsia-50/60">A tempestade se forma em cima da capela do templo, pra todo mundo ver; o primeiro trovão energiza as caixas do lounge. Os anunciadores saem da nave e rodeiam cada pessoa no mapa. Tudo acaba quando você pisa no lounge.</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-white">⛈ Tempestade no templo</p>
          <p className="text-xs text-fuchsia-50/60">{FASE[fase]}{tempestade && fase === "formando" ? ` (${Math.min(FORMACAO_S, s).toFixed(0)}/${FORMACAO_S} s)` : ""}</p>
          <button type="button" disabled={ocupado} onClick={() => mudar({ tempestade: !tempestade })} className={`${BTN} mt-2 w-full ${tempestade ? "border border-white/20 text-white/80" : "bg-gradient-to-b from-fuchsia-200 to-fuchsia-400 text-slate-950"}`}>
            {tempestade ? "Desfazer a tempestade" : "Formar a tempestade"}
          </button>
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-white">✦ Anunciadores</p>
          <p className="text-xs text-fuchsia-50/60">{droids ? "soltos pelo mapa, louvando" : "recolhidos na nave"}</p>
          <button type="button" disabled={ocupado} onClick={() => mudar({ droids: !droids })} className={`${BTN} mt-2 w-full ${droids ? "border border-white/20 text-white/80" : "bg-gradient-to-b from-amber-200 to-amber-400 text-slate-950"}`}>
            {droids ? "Recolher os anunciadores" : "Soltar os anunciadores"}
          </button>
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
          <p className="text-sm font-semibold text-white">🛸 O véu da nave</p>
          <p className="text-xs text-fuchsia-50/60">{veu ? "revelada (até a tempestade acabar)" : !tempestade ? "a nave está invisível; forme a tempestade primeiro" : perto ? "a nave está no perímetro das nuvens" : "chegue com a nave no perímetro das nuvens da capela"}</p>
          <button type="button" disabled={ocupado || veu || !tempestade || !perto} onClick={() => mudar({ veu: true })} className={`${BTN} mt-2 w-full ${veu ? "border border-white/20 text-white/80" : "bg-gradient-to-b from-sky-200 to-sky-400 text-slate-950"}`}>
            {veu ? "Véu tirado" : "Tirar o véu da nave"}
          </button>
        </div>
        {erro && <p role="alert" className="mt-2 text-xs text-rose-300">{erro}</p>}
        <div className="mt-3 flex justify-end"><button type="button" onClick={p.onFechar} className="min-h-[40px] rounded-full border border-white/15 px-4 text-xs text-fuchsia-50/80">Fechar</button></div>
      </div>
    </div>
  );
}
