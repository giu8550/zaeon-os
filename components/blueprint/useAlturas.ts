"use client";
/**
 * useAlturas — #631: a altura medida de cada card da prancha. Antes, CADA card medido virava um setState (e um
 * layout inteiro da prancha): abrir um blueprint com N cards redesenhava N vezes seguidas. Agora as medidas do mesmo
 * quadro se juntam e entram de UMA vez no quadro seguinte (requestAnimationFrame) — e só se alguma mudou de verdade.
 * As medidas ficam PRESAS ao blueprint de onde vieram (os ids dos módulos, "passo:p1"…, se repetem entre blueprints):
 * trocou de blueprint, as alturas do anterior somem NA HORA (não num efeito depois) e medida velha não entra no novo.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** aplica as medidas novas; devolve o MESMO objeto se nenhuma mudou mais de 1 px (nada pra redesenhar) */
export function juntarAlturas(a: Record<string, number>, novas: Record<string, number>): Record<string, number> {
  let mudou = false;
  const n = { ...a };
  for (const [k, h] of Object.entries(novas)) if (Math.abs((a[k] ?? 0) - h) > 1) { n[k] = h; mudou = true; }
  return mudou ? n : a;
}

const VAZIO: Record<string, number> = {};

export function useAlturas(id: string) {
  const [estado, setEstado] = useState<{ id: string; alturas: Record<string, number> }>({ id, alturas: VAZIO });
  const idRef = useRef(id);
  idRef.current = id;
  // as medidas esperando o próximo quadro, com o blueprint de onde vieram
  const pendentes = useRef<{ id: string; alturas: Record<string, number> }>({ id, alturas: {} });
  const quadro = useRef(0);
  const guarda = useCallback((k: string, h: number) => {
    if (pendentes.current.id !== idRef.current) pendentes.current = { id: idRef.current, alturas: {} };
    pendentes.current.alturas[k] = h;
    if (quadro.current) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;
      const p = pendentes.current;
      pendentes.current = { id: idRef.current, alturas: {} };
      if (p.id !== idRef.current) return;   // medidas de um blueprint que já saiu da tela
      setEstado((s) => {
        const base = s.id === p.id ? s.alturas : VAZIO;
        const n = juntarAlturas(base, p.alturas);
        return s.id === p.id && n === s.alturas ? s : { id: p.id, alturas: n };
      });
    });
  }, []);
  // StrictMode remonta os efeitos: zera o quadro cancelado, senão o próximo `guarda` acharia que já tem um marcado
  useEffect(() => () => { cancelAnimationFrame(quadro.current); quadro.current = 0; }, []);
  // trocou de blueprint: as alturas do anterior não valem (já no MESMO render, sem esperar efeito)
  return { alturas: estado.id === id ? estado.alturas : VAZIO, guarda };
}
