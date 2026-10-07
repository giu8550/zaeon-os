"use client";

/**
 * Live2DAvatar — motor LIVE2D do avatar vivo (upgrade do handoff, fase 4). Só monta quando o
 * manifesto tem um modelo PRÓPRIO (`live2d.model`) e NEXT_PUBLIC_AVATAR_ENGINE ≠ "sprite".
 *
 * Runtime carregado sob demanda do CDN (nada no bundle; só baixa quando o card entra em cena):
 *   Cubism Core (proprietário, Live2D Inc. — licença: https://www.live2d.com/en/sdk/license/)
 *   PixiJS v7 (MIT) + pixi-live2d-display, fork mantido RaSan147 (MIT).
 * URLs trocáveis por env (NEXT_PUBLIC_LIVE2D_CORE_URL / _PIXI_URL / _LIB_URL) pra servir local.
 * Qualquer falha (script, WebGL, modelo) → `onFalha()` → o AgentAvatar volta pro sprite.
 * Sinais: expressões do rig por nome (`live2d.expressoes`), boca via ParamMouthOpenY ao falar,
 * olhar no cursor (focus) no hover; sem vaga de vida ou reduced-motion → ticker parado.
 */
import { useEffect, useRef } from "react";
import { duracaoSilaba, type AvatarManifest, type SinalAvatar } from "@/lib/avatars/estados";

const CORE = process.env.NEXT_PUBLIC_LIVE2D_CORE_URL || "https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js";
const PIXI = process.env.NEXT_PUBLIC_LIVE2D_PIXI_URL || "https://cdn.jsdelivr.net/npm/pixi.js@7.4.2/dist/pixi.min.js";
const LIB = process.env.NEXT_PUBLIC_LIVE2D_LIB_URL || "https://cdn.jsdelivr.net/npm/pixi-live2d-display-lipsyncpatch@0.5.0-ls-8/dist/cubism4.min.js";

const scripts = new Map<string, Promise<void>>();
function carregarScript(src: string): Promise<void> {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise<void>((ok, falha) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.crossOrigin = "anonymous";
      s.onload = () => ok();
      s.onerror = () => { scripts.delete(src); falha(new Error(`não carregou ${src}`)); };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(src)!;
}

async function runtime(): Promise<any> {
  await carregarScript(CORE);
  await carregarScript(PIXI);
  await carregarScript(LIB);
  const w = window as any;
  if (!w.PIXI?.live2d?.Live2DModel) throw new Error("pixi-live2d-display indisponível");
  return w.PIXI;
}

export default function Live2DAvatar({
  manifest, sinal, hover, vivo, reduzido, tamanho, onFalha,
}: {
  manifest: AvatarManifest;
  sinal: SinalAvatar;
  hover: boolean;
  vivo: boolean;
  reduzido: boolean;
  tamanho: number;
  onFalha: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<any>(null);
  const model = useRef<any>(null);
  const boca = useRef(0);
  const falha = useRef(onFalha);
  falha.current = onFalha;

  const modelUrl = manifest.live2d?.model;
  // monta app + modelo uma vez por modelo
  useEffect(() => {
    if (!modelUrl) return;
    let cancelado = false;
    (async () => {
      try {
        const P = await runtime();
        if (cancelado || !host.current) return;
        const px = Math.round(tamanho * Math.min(2, window.devicePixelRatio || 1));
        const a = new P.Application({ width: px, height: px, backgroundAlpha: 0, antialias: true, autoStart: false });
        a.view.style.width = a.view.style.height = "100%";
        host.current.appendChild(a.view);
        app.current = a;
        const m = await P.live2d.Live2DModel.from(modelUrl, { autoInteract: false });
        if (cancelado) { a.destroy(true); return; }
        const escala = Math.min(px / m.width, px / m.height) * 1.6; // busto: aproxima no rosto
        m.scale.set(escala);
        m.anchor.set(0.5, 0.18);
        m.position.set(px / 2, 0);
        a.stage.addChild(m);
        model.current = m;
        // boca: escrita a cada frame (o motor de física/idle do rig sobrescreveria fora do hook)
        m.internalModel.on("beforeModelUpdate", () => {
          m.internalModel.coreModel.setParameterValueById("ParamMouthOpenY", boca.current);
        });
        a.render();
      } catch (e) {
        console.warn("[live2d]", (e as Error)?.message);
        if (!cancelado) falha.current();
      }
    })();
    return () => {
      cancelado = true;
      app.current?.destroy(true, { children: true });
      app.current = null;
      model.current = null;
    };
  }, [modelUrl, tamanho]);

  // vida: ticker só roda com vaga e sem reduced-motion
  useEffect(() => {
    const a = app.current;
    if (!a) return;
    if (vivo && !reduzido) a.ticker.start(); else { a.ticker.stop(); a.render(); }
  }, [vivo, reduzido]);

  // expressões por sinal
  useEffect(() => {
    const m = model.current;
    const nomes = manifest.live2d?.expressoes ?? {};
    const nome = (hover && sinal === "idle" ? nomes.hover : nomes[sinal]) ?? nomes.idle;
    if (m && nome) m.expression(nome);
  }, [sinal, hover, manifest.live2d?.expressoes]);

  // boca ao falar (sílabas irregulares, como no motor de sprite)
  useEffect(() => {
    if (sinal !== "falando" || reduzido) { boca.current = 0; return; }
    let t: ReturnType<typeof setTimeout>;
    const passo = () => { boca.current = boca.current > 0.3 ? 0.1 : 0.5 + Math.random() * 0.5; t = setTimeout(passo, duracaoSilaba()); };
    passo();
    return () => { clearTimeout(t); boca.current = 0; };
  }, [sinal, reduzido]);

  return (
    <div
      ref={host}
      aria-hidden
      className="absolute inset-0"
      onPointerMove={(e) => model.current?.focus?.(e.nativeEvent.offsetX * (window.devicePixelRatio || 1), e.nativeEvent.offsetY * (window.devicePixelRatio || 1))}
    />
  );
}
