"use client";
/**
 * TutorialLab — o tour da 1ª missão DENTRO do tablet (lib/onboarding/tutorialLab). Só existe no laboratório aberto pelo
 * tutorial do cyberespaço (`?tablet=1&tutorial=1`). Escurece a tela em volta do card da vez (o DESTAQUE, que deixa
 * clicar), e o Droid fala num balão de RPG. Cada etapa anda com a ação certa (evento) ou, nas de só ver, com "Próximo".
 * No tema, leva a pessoa pro Marketplace › Estudos já pesquisando; no fim, com a pesquisa SALVA de verdade, avisa o
 * cyberespaço (o Droid interrompe o tablet).
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import RetratoDroid from "@/components/cyber/RetratoDroid";
import { irPraAbaEstudos } from "@/lib/chat/conversasNav";
import { MSG_PESQUISA_SALVA, type PesquisaSalva } from "@/lib/ui/loungeHub";
import {
  EVT_ESTUDOS_VISTA, EVT_OMEGA_RODAR, EVT_PESQUISA_SALVA, EVT_TEMA, assinarTutorialLab, avancarTutorialLab, encerrarTutorialLab,
  etapaDe, falaDaEtapa, iniciarTutorialLab, lerTutorialLab,
} from "@/lib/onboarding/tutorialLab";

const COR = "#ffc46b";
type Caixa = { x: number; y: number; w: number; h: number };

/** o 1º alvo que está NA TELA (visível) */
function acharAlvo(sel: string[]): Caixa | null {
  for (const s of sel) {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
      const r = el.getBoundingClientRect();
      if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < window.innerHeight) return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
  }
  return null;
}

export default function TutorialLab() {
  const st = useSyncExternalStore(assinarTutorialLab, lerTutorialLab, lerTutorialLab);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); iniciarTutorialLab(); }, []);
  const etapa = etapaDe(st.etapa);

  // a etapa anda com a AÇÃO (os eventos do laboratório)
  useEffect(() => {
    if (!st.ativo) return;
    const offs: (() => void)[] = [];
    for (const ev of etapa.avancaEm) {
      const f = (e: Event) => {
        const d = (e as CustomEvent).detail;
        if (ev === EVT_TEMA) {
          const tema = String(d?.tema ?? "").trim(); if (!tema) return;
          avancarTutorialLab({ tema });
          // o tema vai pro Marketplace › Estudos, direto na tela roxa, já pesquisando
          irPraAbaEstudos("community");
          window.dispatchEvent(new CustomEvent(EVT_ESTUDOS_VISTA, { detail: "pesquisar" }));
          setTimeout(() => window.dispatchEvent(new CustomEvent(EVT_OMEGA_RODAR, { detail: { prompt: tema } })), 350);
          return;
        }
        if (ev === "zaeon:research:draftdone" && d && d.ok === false) return;   // falhou: continua pedindo pra gerar
        if (ev === EVT_PESQUISA_SALVA) {
          const p: PesquisaSalva = { titulo: String(d?.titulo || st.tema || "Minha pesquisa"), palavras: Number(d?.palavras) || 0, workId: d?.workId ?? null };
          try { window.parent?.postMessage({ type: MSG_PESQUISA_SALVA, pesquisa: p }, window.location.origin); } catch { /* fora do tablet */ }
          encerrarTutorialLab();
          return;
        }
        avancarTutorialLab();
      };
      window.addEventListener(ev, f); offs.push(() => window.removeEventListener(ev, f));
    }
    return () => { for (const o of offs) o(); };
  }, [st.ativo, st.etapa, st.tema, etapa.avancaEm]);

  // o destaque segue o card (ele aparece, rola, muda de tamanho)
  useEffect(() => {
    if (!st.ativo || !etapa.alvos.length) { setAlvo(null); return; }
    let raf = 0, ult = "";
    const medir = () => {
      const c = acharAlvo(etapa.alvos), k = c ? `${Math.round(c.x)},${Math.round(c.y)},${Math.round(c.w)},${Math.round(c.h)}` : "";
      if (k !== ult) { ult = k; setAlvo(c); }
      raf = requestAnimationFrame(medir);
    };
    raf = requestAnimationFrame(medir);
    return () => cancelAnimationFrame(raf);
  }, [st.ativo, st.etapa, etapa.alvos]);

  if (!montado || !st.ativo || st.etapa === "fim") return null;
  const so = etapa.avancaEm.length === 0, P = 8;
  // o balão: embaixo do card se couber; senão em cima; sem card, no pé da tela
  const H = typeof window !== "undefined" ? window.innerHeight : 800, W = typeof window !== "undefined" ? window.innerWidth : 1200;
  const larg = Math.min(W - 24, 440);
  let pos: React.CSSProperties = { left: "50%", bottom: 24, transform: "translateX(-50%)" };
  if (alvo) {
    const cx = Math.min(W - larg / 2 - 12, Math.max(larg / 2 + 12, alvo.x + alvo.w / 2));
    pos = alvo.y + alvo.h + 190 < H ? { left: cx, top: alvo.y + alvo.h + P + 14, transform: "translateX(-50%)" } : alvo.y > 200 ? { left: cx, top: alvo.y - P - 14, transform: "translate(-50%,-100%)" } : pos;
  }
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[1300]" aria-live="polite">
      {alvo ? (
        <div className="absolute rounded-2xl transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: alvo.x - P, top: alvo.y - P, width: alvo.w + P * 2, height: alvo.h + P * 2, boxShadow: `0 0 0 9999px rgba(2,6,23,.58), 0 0 0 2px ${COR}, 0 0 28px 4px ${COR}88` }}>
          <span className="absolute inset-0 rounded-2xl motion-safe:animate-ping" style={{ boxShadow: `0 0 0 2px ${COR}55` }} />
        </div>
      ) : <div className="absolute inset-0 bg-[rgba(2,6,23,.35)]" />}
      <div className="pointer-events-auto absolute" style={{ width: larg, ...pos }}>
        <div className="relative z-[1] ml-[78px] -mb-[11px] inline-flex items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-0.5 text-[11px] font-black uppercase tracking-[0.22em]"
          style={{ borderColor: `${COR}aa`, background: "linear-gradient(180deg,#1a1230,#0b0818)", color: COR }}>◆ Droid</div>
        <div className="flex gap-3 rounded-[14px] border-2 px-3 pb-3 pt-4" style={{ borderColor: `${COR}cc`, background: "linear-gradient(180deg,rgba(13,10,30,.97),rgba(5,4,14,.98))", boxShadow: `0 18px 50px -12px rgba(0,0,0,.8), 0 0 30px -10px ${COR}` }}>
          <div className="-mt-7 h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full border-2" style={{ borderColor: COR, boxShadow: `0 0 18px -4px ${COR}` }}><RetratoDroid cor={COR} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[15.5px] font-semibold leading-[1.45] text-[#fff8ea]">{falaDaEtapa(etapa, st.tema)}</p>
            <div className="mt-2 flex items-center justify-end gap-2">
              {so && (
                <button type="button" onClick={() => avancarTutorialLab()}
                  className="rounded-full border-2 px-4 py-1 text-[12px] font-black uppercase tracking-[0.16em] text-[#1a1004] transition-transform hover:scale-105"
                  style={{ background: COR, borderColor: "#fff1cf" }}>Próximo ▸</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
