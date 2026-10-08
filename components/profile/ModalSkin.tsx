"use client";
/**
 * ModalSkin — o pop-up do botão "Mudar skin" (vitrine do personagem no Perfil). Hoje só AVISA como se conquista uma
 * skin nova; é a casca pronta pra virar o SELETOR de cor/skin (escolha salva no servidor e levada pro cyberespaço —
 * lib/cyber/cores `minhaArmadura`). Acessível: role="dialog" + aria-modal, o foco fica dentro, Esc e clique fora fecham.
 */
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export const TEXTO_SKIN = "Para conquistar novas skins, você precisa progredir seus estudos no laboratório ou no cyberespaço.";

export default function ModalSkin({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null), botaoX = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const antes = document.activeElement as HTMLElement | null;
    botaoX.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); fechar(); return; }
      if (e.key !== "Tab" || !caixa.current) return;
      // o foco não sai do modal
      const focaveis = Array.from(caixa.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute("disabled"));
      if (!focaveis.length) return;
      const pri = focaveis[0]!, ult = focaveis[focaveis.length - 1]!;
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); antes?.focus?.(); };
  }, [aberto, fechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby="modal-skin-titulo" aria-describedby="modal-skin-texto"
        className="relative w-full max-w-sm rounded-3xl border border-cyan-300/40 dark:border-cyan-400/20 bg-white dark:bg-[#0b1020] shadow-2xl p-6 pt-7">
        <button ref={botaoX} type="button" onClick={fechar} aria-label="Fechar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
          <X size={16} strokeWidth={3} />
        </button>
        <p id="modal-skin-titulo" className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-300 mb-2">Skins</p>
        <p id="modal-skin-texto" className="text-[14px] font-semibold leading-relaxed text-slate-800 dark:text-white/90 pr-6">{TEXTO_SKIN}</p>
      </div>
    </div>
  );
}
