"use client";
/**
 * ContadorFps — o contador de quadros por segundo no canto da tela, com o NOME DA PLACA DE VÍDEO e o modo de gráficos
 * (liga nas configurações: "Mostrar FPS"). Serve pra quem estiver com o cyberespaço lento mandar um print — a gente
 * ajusta o modo leve com número de verdade. Também avisa quando a ACELERAÇÃO DE HARDWARE está desligada (o navegador
 * desenha na CPU: SwiftShader/llvmpipe) — ligá-la resolve a maior parte das máquinas "lentas".
 */
import { useEffect, useState } from "react";
import type { ClasseGpu } from "@/lib/cyber/dispositivo";

type Est = { fps: number; degrau: string; leve: boolean };

export default function ContadorFps({ mostrar, gpu, classe, ler }: { mostrar: boolean; gpu?: string; classe?: ClasseGpu; ler: () => Est | null }) {
  const [e, setE] = useState<Est | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);
  useEffect(() => { if (!mostrar) return; const id = setInterval(() => setE(ler()), 500); return () => clearInterval(id); }, [mostrar, ler]);
  const software = classe === "software";
  const nome = (gpu ?? "placa desconhecida").replace(/^ANGLE \(([^,]+), /, "").replace(/ \(0x[0-9a-f]+\)| Direct3D.*$| vs_\d.*$/gi, "").replace(/\)$/, "").slice(0, 60);
  return (
    <>
      {mostrar && e && (
        <div className="pointer-events-none absolute left-3 top-3 z-[23] rounded-xl border border-white/10 bg-[#05081a]/70 px-3 py-2 font-mono text-[11px] leading-tight text-white/85 backdrop-blur">
          <div><b className={e.fps >= 28 ? "text-emerald-300" : e.fps >= 20 ? "text-amber-300" : "text-rose-300"}>{e.fps} fps</b> · {e.leve ? "modo leve" : "completo"} · {e.degrau}</div>
          <div className="text-white/55">{nome}{classe && classe !== "desconhecida" ? ` (${classe})` : ""}</div>
        </div>
      )}
      {software && !avisoFechado && (
        <div className="absolute left-1/2 top-3 z-[24] flex max-w-[92vw] -translate-x-1/2 items-start gap-3 rounded-2xl border border-amber-300/40 bg-[#1a1205]/90 px-4 py-3 text-[13px] text-amber-50 shadow-lg backdrop-blur">
          <span>⚠️ A <b>aceleração de hardware</b> do navegador está desligada — o cyberespaço está sendo desenhado pelo processador e vai ficar lento. No Chrome: Configurações → Sistema → ligue <b>&quot;Usar aceleração de hardware quando disponível&quot;</b> e reinicie o navegador.</span>
          <button type="button" onClick={() => setAvisoFechado(true)} className="shrink-0 rounded-full px-2 text-amber-200/80 hover:text-amber-50" aria-label="Fechar aviso">✕</button>
        </div>
      )}
    </>
  );
}
