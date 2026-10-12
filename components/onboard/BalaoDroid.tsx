"use client";
/**
 * BalaoDroid — o DESTAQUE (a tela escurece em volta do card da vez, que continua clicável) + o balão de RPG do Droid,
 * dos tours do laboratório: a 1ª missão (TutorialLab) e o tour da sala (TourSala). O balão fica onde NÃO cobre o que a
 * pessoa precisa clicar (lib/onboarding/tutorialLab `posicaoDoBalao`); sem botão no balão, ele nem pega o clique.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import RetratoDroid from "@/components/cyber/RetratoDroid";
import { posicaoDoBalao, uniaoDe, type Caixa } from "@/lib/onboarding/tutorialLab";

export const COR_DROID = "#ffc46b";

/** o 1º alvo que EXISTE (renderizado, com tamanho) — na ordem dos seletores */
function acharElemento(sel: string[]): HTMLElement | null {
  for (const s of sel) for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) { const r = el.getBoundingClientRect(); if (r.width > 4 && r.height > 4) return el; }
  return null;
}
const naTela = (r: DOMRect) => r.bottom > 0 && r.top < window.innerHeight;
const caixaDe = (r: DOMRect): Caixa => ({ x: r.left, y: r.top, w: r.width, h: r.height });
const chaveDe = (c: Caixa | null) => (c ? `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}` : "");

/** o destaque segue o card (ele aparece, rola, muda de tamanho). O card da vez pode estar FORA da tela (o "Gerar
 *  pesquisa" fica embaixo da tela roxa): rola até ele uma vez por card — depois a pessoa rola à vontade */
export function useDestaque(alvos: string[], evitar: string[] = [], ligado = true): { alvo: Caixa | null; evita: Caixa | null } {
  const [st, setSt] = useState<{ alvo: Caixa | null; evita: Caixa | null }>({ alvo: null, evita: null });
  const k = `${alvos.join("|")}§${evitar.join("|")}`;
  useEffect(() => {
    if (!ligado || !alvos.length) { setSt({ alvo: null, evita: null }); return; }
    let raf = 0, ult = "", rolou: HTMLElement | null = null;
    const medir = () => {
      const el = acharElemento(alvos);
      if (el && rolou !== el) { rolou = el; if (!naTela(el.getBoundingClientRect())) el.scrollIntoView({ behavior: "smooth", block: "center" }); }
      const r = el?.getBoundingClientRect(), alvo = r && naTela(r) ? caixaDe(r) : null;
      const ev = acharElemento(evitar), evita = uniaoDe([alvo, ev ? caixaDe(ev.getBoundingClientRect()) : null]);
      const kk = `${chaveDe(alvo)}/${chaveDe(evita)}`;
      if (kk !== ult) { ult = kk; setSt({ alvo, evita }); }
      raf = requestAnimationFrame(medir);
    };
    raf = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ligado, k]);
  return st;
}

export function OverlayDroid({ alvo, evita, fala, botoes }: { alvo: Caixa | null; evita: Caixa | null; fala: string; botoes?: ReactNode }) {
  const balao = useRef<HTMLDivElement>(null);
  // a altura medida na LARGURA CHEIA (estreito, o texto quebra mais — a conta do vão já considera isso)
  const [alt, setAlt] = useState(170);
  const P = 8, W = window.innerWidth, H = window.innerHeight, larg = Math.min(W - 24, 440);
  const pos = posicaoDoBalao(evita ?? alvo, W, H, { w: larg, h: alt });
  useLayoutEffect(() => { const el = balao.current; if (!el) return; const h = el.offsetHeight * (el.offsetWidth / larg); if (h && Math.abs(h - alt) > 2) setAlt(Math.round(h)); }, [fala, botoes, pos.w, larg, alt]);
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1300]" aria-live="polite">
      {alvo ? (
        <div className="absolute rounded-2xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: alvo.x - P, top: alvo.y - P, width: alvo.w + P * 2, height: alvo.h + P * 2, boxShadow: `0 0 0 9999px rgba(2,6,23,.58), 0 0 0 2px ${COR_DROID}, 0 0 28px 4px ${COR_DROID}88` }}>
          <span className="absolute inset-0 rounded-2xl motion-safe:animate-ping" style={{ boxShadow: `0 0 0 2px ${COR_DROID}55` }} />
        </div>
      ) : <div className="absolute inset-0 bg-[rgba(2,6,23,.35)]" />}
      {/* sem botões, o balão é só leitura: o clique ATRAVESSA (nunca bloqueia o caminho — o "Salvar" ficava embaixo dele) */}
      <div ref={balao} className={`${botoes ? "pointer-events-auto" : "pointer-events-none"} absolute pt-3 transition-[left,top] duration-300 ease-out motion-reduce:transition-none`} style={{ width: pos.w, left: pos.left, top: pos.top }}>
        <div className="relative z-[1] ml-[78px] -mb-[11px] inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.22em]"
          style={{ borderColor: `${COR_DROID}aa`, background: "linear-gradient(180deg,#1a1230,#0b0818)", color: COR_DROID }}>◆ Droid</div>
        <div className="flex gap-3 rounded-[14px] border-2 px-3 pb-3 pt-4" style={{ borderColor: `${COR_DROID}cc`, background: "linear-gradient(180deg,rgba(13,10,30,.97),rgba(5,4,14,.98))", boxShadow: `0 18px 50px -12px rgba(0,0,0,.8), 0 0 30px -10px ${COR_DROID}` }}>
          <div className="-mt-7 h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: COR_DROID, boxShadow: `0 0 18px -4px ${COR_DROID}` }}><RetratoDroid cor={COR_DROID} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-semibold leading-[1.45] text-[#fff8ea]">{fala}</p>
            {botoes && <div className="mt-2 flex items-center justify-end gap-2">{botoes}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** o botão dourado do balão ("Próximo ▸") e o discreto ("Pular") */
export const BotaoDroid = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick}
    className="rounded-full border-2 px-4 py-1 text-[12px] font-black uppercase tracking-[0.16em] text-[#1a1004] transition-transform hover:scale-105"
    style={{ background: COR_DROID, borderColor: "#fff1cf" }}>{children}</button>
);
export const BotaoDroidLeve = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#fff8ea]/55 hover:text-[#fff8ea]">{children}</button>
);
