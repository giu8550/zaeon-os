"use client";
/**
 * useAlturas — #631: a altura medida de cada card da prancha. Antes, CADA card medido virava um setState (e um
 * layout inteiro da prancha): abrir um blueprint com N cards redesenhava N vezes seguidas. Agora as medidas do mesmo
 * quadro se juntam e entram de UMA vez no quadro seguinte (requestAnimationFrame) — e só se alguma mudou de verdade.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** aplica as medidas novas; devolve o MESMO objeto se nenhuma mudou mais de 1 px (nada pra redesenhar) */
export function juntarAlturas(a: Record<string, number>, novas: Record<string, number>): Record<string, number> {
  let mudou = false;
  const n = { ...a };
  for (const [k, h] of Object.entries(novas)) if (Math.abs((a[k] ?? 0) - h) > 1) { n[k] = h; mudou = true; }
  return mudou ? n : a;
}

export function useAlturas(id: string) {
  const [alturas, setAlturas] = useState<Record<string, number>>({});
  const pendentes = useRef<Record<string, number>>({});
  const quadro = useRef(0);
  const guarda = useCallback((k: string, h: number) => {
    pendentes.current[k] = h;
    if (quadro.current) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;
      const p = pendentes.current; pendentes.current = {};
      setAlturas((a) => juntarAlturas(a, p));
    });
  }, []);
  // os ids dos módulos ("passo:p1"…) se repetem entre blueprints: trocou de blueprint, começa do zero
  useEffect(() => { pendentes.current = {}; setAlturas({}); }, [id]);
  useEffect(() => () => cancelAnimationFrame(quadro.current), []);
  return { alturas, guarda };
}
