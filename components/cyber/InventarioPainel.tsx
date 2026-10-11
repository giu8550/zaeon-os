"use client";

/**
 * InventarioPainel — o INVENTÁRIO do cyberespaço (tecla I; lib/cyber/inventario): os 12 espaços, o item escolhido
 * (nome, nível, raridade, o que a arma faz) e equipar/desequipar — quem guarda e aplica é o engine (`equipar`).
 * Embaixo, os LIVROS DOS SEUS ESTUDOS (lib/estudos/itens): cada estudo do board de Meus Estudos é um item que EVOLUI
 * com ele (a raridade e o nível vêm do blueprint) — e dá pra abrir o board dali.
 */
import { useEffect, useState } from "react";
import { COMBO, danoDoGolpe } from "@/lib/cyber/combate";
import { ITENS, type IdItem, type Inventario } from "@/lib/cyber/inventario";
import type { ItemEstudo } from "@/lib/estudos/itens";

const COR_RARIDADE: Record<string, string> = { comum: "#c9d4dc", rara: "#5fb8ff", epica: "#b98cff", lendaria: "#ffc46b" };
const NOME_RARIDADE: Record<string, string> = { comum: "Comum", rara: "Rara", epica: "Épica", lendaria: "Lendária" };

/** o ícone de um LIVRO de estudo (aberto, na cor da raridade) */
function IconeLivro({ cor, tam = 40 }: { cor: string; tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden>
      <path d="M5 11 L19 8 L19 31 L5 34 Z" fill="#0b1f33" stroke={cor} strokeWidth="1.2" />
      <path d="M35 11 L21 8 L21 31 L35 34 Z" fill="#0b1f33" stroke={cor} strokeWidth="1.2" />
      {[14, 18, 22, 26].map((y) => <g key={y}><path d={`M8 ${y} L17 ${y - 2}`} stroke={cor} strokeOpacity=".5" strokeWidth=".8" /><path d={`M32 ${y} L23 ${y - 2}`} stroke={cor} strokeOpacity=".5" strokeWidth=".8" /></g>)}
    </svg>
  );
}

/** o ícone da Espada Espiritual (lâmina escura, linha central acesa, guarda em asa) */
function IconeEspada({ tam = 40 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 3 L23 8 L23 27 L17 27 L17 8 Z" fill="#0f1a17" stroke="#1d3a33" strokeWidth="0.6" />
      <line x1="20" y1="5" x2="20" y2="26.5" stroke="#35ffd0" strokeWidth="1.2" style={{ filter: "drop-shadow(0 0 2px #35ffd0)" }} />
      <path d="M9 28 Q15 26 20 27.5 Q25 26 31 28 L29 29.5 Q24 28.8 20 30 Q16 28.8 11 29.5 Z" fill="#16231f" stroke="#2c5a4f" strokeWidth="0.5" />
      <rect x="18.8" y="30" width="2.4" height="6" rx="0.8" fill="#1a2024" />
      <path d="M20 36 L21.4 38.6 L18.6 38.6 Z" fill="#16231f" />
    </svg>
  );
}

export default function InventarioPainel({ aberto, onFechar, ler, equipar }: { aberto: boolean; onFechar: () => void; ler: () => Inventario | null; equipar: (id: IdItem | null) => Inventario | null }) {
  const [inv, setInv] = useState<Inventario | null>(null), [sel, setSel] = useState(0);
  // os LIVROS dos estudos (o servidor monta a partir dos boards de Meus Estudos)
  const [livros, setLivros] = useState<ItemEstudo[] | null>(null), [livro, setLivro] = useState<ItemEstudo | null>(null);
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    fetch("/api/estudos/itens", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { itens: [] })).then((j) => { if (vivo) setLivros(j.itens ?? []); }).catch(() => { if (vivo) setLivros([]); });
    return () => { vivo = false; };
  }, [aberto]);
  useEffect(() => { if (aberto) { const i = ler(); setInv(i); if (i) setSel(Math.max(0, i.espacos.findIndex((x) => x !== null))); } }, [aberto, ler]);
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key.toLowerCase() === "i") { e.preventDefault(); onFechar(); } };
    window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc);
  }, [aberto, onFechar]);
  if (!aberto || !inv) return null;
  const id = inv.espacos[sel] ?? null, item = id ? ITENS[id] : null, equipado = !!id && inv.equipado === id;
  return (
    <div role="dialog" aria-label="Inventário" className="absolute left-1/2 top-1/2 z-40 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-200/15 bg-[#060d0c]/92 p-4 text-emerald-50 shadow-[0_0_60px_rgba(53,255,208,.12)] backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.2em]">Inventário</h2>
        <button type="button" onClick={onFechar} aria-label="Fechar o inventário" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white">✕</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        <div className="grid grid-cols-4 content-start gap-2 self-start">
          {inv.espacos.map((x, i) => (
            <button key={i} type="button" onClick={() => { setSel(i); setLivro(null); }} aria-label={x ? ITENS[x].nome : `Espaço ${i + 1} vazio`} aria-pressed={i === sel}
              className={`relative flex h-14 w-14 items-center justify-center rounded-xl border ${i === sel ? "border-emerald-300/70 bg-emerald-300/10" : "border-white/10 bg-white/[0.03]"}`}>
              {x && <IconeEspada />}
              {x && inv.equipado === x && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_6px_#35ffd0]" title="Equipado" />}
              {x && <span className="absolute bottom-0.5 right-1 text-[9px] font-black text-white/70">{ITENS[x].nivel}</span>}
            </button>
          ))}
        </div>
        <div className="min-h-[220px] rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {livro ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-black/40" style={{ borderColor: `${COR_RARIDADE[livro.raridade]}66` }}><IconeLivro cor={COR_RARIDADE[livro.raridade]} tam={56} /></div>
                <div>
                  <div className="text-base font-black leading-tight">{livro.titulo}</div>
                  <div className="text-xs font-bold" style={{ color: COR_RARIDADE[livro.raridade] }}>{NOME_RARIDADE[livro.raridade]} · Nível {livro.nivel}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/45">Livro de estudo{livro.vendavel ? " · vendável" : ""}</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full rounded-full" style={{ width: `${livro.nivel}%`, background: COR_RARIDADE[livro.raridade] }} /></div>
                <p className="mt-1.5 text-[11px] text-white/60">{livro.proxima ? `Evolui pra ${NOME_RARIDADE[livro.proxima.raridade]} com mais ${livro.proxima.faltam} pontos — confirme na literatura, ligue o entregável, cheque os links.` : "Já é lendário."}</p>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Componentes</dt><dd className="text-sm font-black">{livro.componentes}</dd></div>
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Fontes</dt><dd className="text-sm font-black">{livro.fontes}</dd></div>
              </dl>
              <a href={`/research-lab?tab=sala-de-estudos&board=${livro.boardId}`} className="mt-4 flex min-h-[42px] w-full items-center justify-center rounded-full bg-gradient-to-b from-sky-200 to-sky-400 text-xs font-black uppercase tracking-widest text-slate-950">Abrir o estudo no board</a>
            </>
          ) : item ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-emerald-300/30 bg-black/40"><IconeEspada tam={56} /></div>
                <div>
                  <div className="text-base font-black">{item.nome}</div>
                  <div className="text-xs font-bold" style={{ color: COR_RARIDADE[item.raridade] }}>{NOME_RARIDADE[item.raridade]} · Nível {item.nivel}</div>
                  <div className="text-[11px] uppercase tracking-widest text-white/45">Arma</div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/70">{item.descricao}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Dano</dt><dd className="text-sm font-black">{COMBO.map((g) => danoDoGolpe(item.id, g)).join(" · ")}</dd></div>
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Alcance</dt><dd className="text-sm font-black">{item.arma.alcance.toFixed(1)} m</dd></div>
                <div className="rounded-lg bg-black/30 p-2"><dt className="text-white/45">Combo</dt><dd className="text-sm font-black">{COMBO.length} golpes</dd></div>
              </dl>
              <button type="button" onClick={() => { const r = equipar(equipado ? null : item.id); if (r) setInv(r); }}
                className={`mt-4 min-h-[42px] w-full rounded-full text-xs font-black uppercase tracking-widest ${equipado ? "border border-white/20 text-white/80" : "bg-gradient-to-b from-emerald-200 to-emerald-400 text-slate-950"}`}>
                {equipado ? "Desequipar" : "Equipar"}
              </button>
              <p className="mt-2 text-center text-[10px] text-white/40">Atacar: X ou clique (com o mouse travado) · Dash: C · na arena (a praça) a espada fica na mão</p>
            </>
          ) : <p className="text-xs text-white/40">Espaço vazio.</p>}
        </div>
      </div>
      {/* os LIVROS dos seus estudos (evoluem com o estudo no board de Meus Estudos) */}
      <div className="mt-4">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Livros dos seus estudos</div>
        {livros === null ? <p className="text-[11px] text-white/40">carregando…</p> : !livros.length ? (
          <p className="text-[11px] text-white/45">Nenhum ainda. Cada estudo do board de Meus Estudos vira um livro aqui — e evolui com ele.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {livros.map((l) => (
              <button key={l.id} type="button" onClick={() => setLivro(l)} aria-label={`${l.titulo} — ${NOME_RARIDADE[l.raridade]}, nível ${l.nivel}`} aria-pressed={livro?.id === l.id}
                className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border ${livro?.id === l.id ? "bg-white/10" : "bg-white/[0.03]"}`} style={{ borderColor: `${COR_RARIDADE[l.raridade]}${livro?.id === l.id ? "cc" : "55"}`, boxShadow: l.raridade === "lendaria" ? `0 0 12px ${COR_RARIDADE.lendaria}55` : undefined }}>
                <IconeLivro cor={COR_RARIDADE[l.raridade]} />
                <span className="absolute bottom-0.5 right-1 text-[9px] font-black text-white/70">{l.nivel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
