"use client";
/**
 * As SKINS da Sala de Estudos. "blueprint" = o papel azul técnico (traço ciano, carimbos). "cartolina" = pedido do dono
 * (22/10): a antiga cartolina do caderno (components/lounge/LoungeCartolina) — papel creme, tinta marrom, letra escrita
 * à mão, cards tortinhos colados com fita, bordas e fios RABISCADOS (filtro SVG de turbulência no traço — o texto fica
 * nítido, só a linha treme). Os módulos são os mesmos; a skin troca cor, fonte e traço.
 * A escolha é por pessoa e por navegador (localStorage — conveniência; nada no servidor).
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Skin = "blueprint" | "cartolina";
export const SKINS: { id: Skin; nome: string }[] = [{ id: "blueprint", nome: "blueprint" }, { id: "cartolina", nome: "cartolina" }];
const CHAVE = "zaeon:sala-estudos:skin";

export const PAPEL = { fundo: "#efe7d3", card: "rgba(250,244,230,.97)", tinta: "#3a2f1e", tintaSuave: "#6b5a3e", fita: "rgba(14,116,144,.22)" } as const;
/** a letra de mão (fontes do sistema — sem baixar nada): títulos e corpo */
export const MAO = "'Segoe Print','Bradley Hand','Chalkboard SE','Comic Sans MS','Comic Neue',cursive";

/** as cores neon do blueprint → canetinhas na cartolina */
const MARCADOR: Record<string, string> = {
  "#7fe0ff": "#0e7490", "#ffd36b": "#b45309", "#ff4d5e": "#c0392b", "#7dffb0": "#2e7d32", "#ff9ec7": "#be185d",
  "#c9b6ff": "#6d28d9", "#e8f6ff": PAPEL.tinta, "#8cf4ff": "#0e7490", "#fff": PAPEL.tinta, "#ffffff": PAPEL.tinta, "#ffc2c8": "#9b2c2c",
};

const Ctx = createContext<Skin>("blueprint");
export const SkinProvider = Ctx.Provider;
export const useSkin = () => useContext(Ctx);

/** a cor certa pra skin atual (no blueprint, a mesma; na cartolina, a canetinha; azul claro translúcido vira tinta) */
export function corNaSkin(skin: Skin, c: string): string {
  if (skin === "blueprint") return c;
  const k = c.toLowerCase();
  if (MARCADOR[k]) return MARCADOR[k];
  const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(k);
  if (m) {
    const [r, , b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
    if (b >= 200 && r >= 100) return `rgba(58,47,30,${Math.min(0.85, a + 0.25)})`;   // os azuis claros do texto/linhas
    if (r >= 240 && b < 120) return `rgba(192,57,43,${a})`;                          // o vermelho translúcido do crítico
    if (r < 140 && b > 150) return `rgba(46,125,50,${a})`;                           // o verde translúcido
  }
  return c;
}
export function useCor() { const s = useSkin(); return useCallback((c: string) => corNaSkin(s, c), [s]); }

/** um ângulo pequeno e estável por card (colado à mão — sempre o mesmo pro mesmo card) */
export function inclinacao(semente: string): number {
  let h = 0; for (let i = 0; i < semente.length; i++) h = (h * 31 + semente.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 140) - 70) / 100;   // −0,7° … +0,7°
}

/** a skin escolhida (lembrada no navegador) */
export function useSkinEscolhida(): [Skin, (s: Skin) => void] {
  const [s, setS] = useState<Skin>("blueprint");
  useEffect(() => { try { const v = localStorage.getItem(CHAVE); if (v === "cartolina" || v === "blueprint") setS(v); } catch { /* sem storage */ } }, []);
  const trocar = useCallback((n: Skin) => { setS(n); try { localStorage.setItem(CHAVE, n); } catch { /* sem storage */ } }, []);
  return [s, trocar];
}

/** os filtros do traço rabiscado (uma vez por prancha) */
export function FiltrosRabisco() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="rabisco" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="r" />
          <feDisplacementMap in="SourceGraphic" in2="r" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="rabisco-forte" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="7" result="r" />
          <feDisplacementMap in="SourceGraphic" in2="r" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={PAPEL.tintaSuave} strokeWidth="1" opacity="0.45" />
        </pattern>
      </defs>
    </svg>
  );
}

/** o CSS da cartolina (escopo .skin-cartolina): letra de mão em tudo e as classes de cor clara do blueprint viram tinta */
export const CSS_CARTOLINA = `
.skin-cartolina, .skin-cartolina * { font-family: ${MAO} !important; letter-spacing: 0 !important; }
.skin-cartolina [class*="text-sky-"], .skin-cartolina [class*="text-emerald-"], .skin-cartolina [class*="text-cyan-"] { color: ${PAPEL.tintaSuave} !important; }
.skin-cartolina [class*="text-rose-"] { color: #9b2c2c !important; }
.skin-cartolina [class*="bg-sky-950"] { background: rgba(58,47,30,.12) !important; }
.skin-cartolina input { background: rgba(255,255,255,.6) !important; color: ${PAPEL.tinta} !important; }
`;
