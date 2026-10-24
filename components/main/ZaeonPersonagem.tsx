"use client";

/**
 * ZaeonPersonagem — a ZAEON em 3D na landing (out/2026, o dono: "uma versão da Zaeon em 3D pra aparecer na landing
 * como personagem"). O mesmo corpo da capela do cyberespaço (o VRM da Zaeon — lib/cyber/estiloAvatar CORPOS_VRM.zaeon),
 * na vitrine em MODO PERSONAGEM (components/cyber/VitrinePersonagem, sem girar): de frente pra quem chega, respirando,
 * a CABEÇA e os OLHOS seguindo o cursor, piscando. Clicar nela: ela SAÚDA — a voz dela (public/avatars/zaeon/voz) com a
 * boca acompanhando o som.
 * Leve com a página: o VRM (12 MB) só baixa no computador (ponteiro fino, tela larga), depois da intro, e só renderiza
 * visível; quem pede menos movimento a vê parada.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CORPOS_VRM } from "@/lib/cyber/estiloAvatar";
import type { QuadroVitrine } from "@/components/cyber/VitrinePersonagem";

const VitrinePersonagem = dynamic(() => import("@/components/cyber/VitrinePersonagem"), { ssr: false });

const CIANO = "#7fe8ff";
const VOZES = ["/avatars/zaeon/voz/saudacao-01.wav", "/avatars/zaeon/voz/saudacao-02.wav", "/avatars/zaeon/voz/saudacao-03.wav"] as const;

/** dá pra mostrar ela aqui? (computador — mouse e tela a partir de 768 px: o VRM é pesado pro celular) */
function podeMostrar() {
  if (typeof window === "undefined") return false;
  return (window.matchMedia?.("(pointer: fine)").matches ?? false) && window.innerWidth >= 768;
}

export default function ZaeonPersonagem({ className = "", forcar = false }: { className?: string; /** mostra em qualquer tela (a página de prévia) */ forcar?: boolean }) {
  const [ok, setOk] = useState(false), [falando, setFalando] = useState(false);
  const mouse = useRef({ x: 0, y: 0 }), boca = useRef(0), alvo = useRef(new THREE.Object3D());
  const audio = useRef<{ ctx: AudioContext; an: AnalyserNode; buf: Uint8Array } | null>(null);
  const qCabeca = useRef(new THREE.Quaternion()), eCabeca = useRef(new THREE.Euler());

  useEffect(() => {
    const ver = () => setOk(forcar || podeMostrar());
    const t = setTimeout(ver, 600); window.addEventListener("resize", ver);   // (depois da intro/abertura assentar)
    const mexe = (e: PointerEvent) => { mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1; };
    window.addEventListener("pointermove", mexe, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener("resize", ver); window.removeEventListener("pointermove", mexe); };
  }, [forcar]);

  // a cada quadro: a cabeça e os olhos no cursor (de onde ela está na tela), a boca na voz
  const aoQuadro = useCallback(({ vrm, dt, cam, el }: QuadroVitrine) => {
    if (!vrm) return;
    const r = el.getBoundingClientRect(), cx = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1, cy = ((r.top + r.height * 0.22) / window.innerHeight) * 2 - 1;
    const dx = THREE.MathUtils.clamp(mouse.current.x - cx, -1.2, 1.2), dy = THREE.MathUtils.clamp(mouse.current.y - cy, -1, 1);
    // os OLHOS: o alvo do lookAt do VRM, na frente dela, puxado pro cursor
    const a = alvo.current; a.position.set(dx * 1.2, 1.45 - dy * 0.8, 2.5); a.updateMatrixWorld();
    if (vrm.lookAt) { vrm.lookAt.target = a; vrm.lookAt.update(dt); }
    // a CABEÇA: um pouco, por cima da pose (a pose é reescrita a cada quadro: não acumula)
    const cab = vrm.humanoid?.getRawBoneNode("head");
    if (cab) { eCabeca.current.set(dy * 0.22, dx * 0.38, 0); qCabeca.current.setFromEuler(eCabeca.current); cab.quaternion.multiply(qCabeca.current); }
    // a BOCA: o volume da voz
    const au = audio.current, ex = vrm.expressionManager;
    let alvoBoca = 0;
    if (au) { au.an.getByteTimeDomainData(au.buf as Uint8Array<ArrayBuffer>); let s = 0; for (const v of au.buf) s += Math.abs(v - 128); alvoBoca = Math.min(1, (s / au.buf.length) / 18); }
    boca.current += (alvoBoca - boca.current) * Math.min(1, dt * 18);
    if (ex) { ex.setValue("aa", boca.current * 0.85); ex.setValue("happy", falando ? 0.15 : 0.3); ex.update(); }
    void cam;
  }, [falando]);

  const saudar = useCallback(async () => {
    if (falando) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current) { const ctx = new Ctx(), an = ctx.createAnalyser(); an.fftSize = 512; an.connect(ctx.destination); audio.current = { ctx, an, buf: new Uint8Array(an.fftSize) }; }
      const { ctx, an } = audio.current; if (ctx.state === "suspended") await ctx.resume();
      const el = new Audio(VOZES[Math.floor(Math.random() * VOZES.length)]); el.crossOrigin = "anonymous";
      const src = ctx.createMediaElementSource(el); src.connect(an);
      setFalando(true); el.onended = () => { setFalando(false); src.disconnect(); };
      await el.play();
    } catch { setFalando(false); }
  }, [falando]);

  if (!ok) return null;
  return (
    <div className={`pointer-events-none ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative "}${className}`}>
      {/* o brilho de holograma por trás */}
      <div aria-hidden className="absolute inset-x-[12%] bottom-[6%] top-[14%] rounded-full blur-3xl" style={{ background: `radial-gradient(ellipse at 50% 60%, ${CIANO}33, transparent 70%)` }} />
      <button type="button" onClick={() => void saudar()} aria-label="Falar com a Zaeon" className="pointer-events-auto absolute inset-x-[18%] bottom-[4%] top-[18%] z-[5] cursor-pointer rounded-full" />
      <VitrinePersonagem fundador={false} cor={CIANO} corpo={CORPOS_VRM.zaeon} giro={false} aoQuadro={aoQuadro} rotulo="Zaeon, a guia da plataforma" className="h-full w-full" />
      <p className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.28em] text-cyan-700/70 dark:text-cyan-200/60">clique pra falar comigo</p>
    </div>
  );
}
