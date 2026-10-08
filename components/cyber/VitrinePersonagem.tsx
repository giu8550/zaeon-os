"use client";
/**
 * VitrinePersonagem — o PERSONAGEM da pessoa em pé, girando devagar numa vitrine (a 3ª coluna do Perfil, ao lado das
 * Habilidades). É o MESMO corpo do cyberespaço (components/cyber/AvatarLuz), sempre no estilo ANIME aqui — independente
 * da flag do cyberespaço — e na cor dela (lib/cyber/cores `minhaArmadura`). O FOUNDER aparece com o corpo próprio (o
 * VRM do VRoid, lib/cyber/estiloAvatar CORPO_DO_FUNDADOR) e as asas negras — e só ele baixa o VRM (16 MB).
 * Leve: three só no cliente (montado com next/dynamic ssr:false), renderiza só VISÍVEL (IntersectionObserver) e com a
 * aba à mostra, DPR ≤ 1,5, e solta tudo (dispose) ao desmontar. Arrastar gira o personagem.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle } from "./AvatarLuz";
import { carregarVrm, tingirVrm } from "./AvatarVrm";
import { VRMUtils, type VRM } from "@pixiv/three-vrm";
import { glowTex } from "./CenaCosmica";
import { CORPO_DO_FUNDADOR, type CorpoVrm } from "@/lib/cyber/estiloAvatar";
import { vestirAcessorios, type AcessoriosHandle } from "./AcessoriosVrm";
import { POSES_VRM } from "@/lib/cyber/posesVrm";

/** o enquadramento: o ponto que a câmera olha (m) e a ALTURA/LARGURA que tem que caber na tela. As asas abertas do
 *  founder vão a 62% (inteiras, elas têm ~3 m de envergadura — o personagem ficaria pequeno numa coluna em pé) */
const QUADRO = {
  comum: { alvoY: 1.04, altura: 2.45, largura: 1.3 },
  fundador: { alvoY: 1.0, altura: 2.2, largura: 2.05, escalaAsas: 0.62 },
  personagem: { alvoY: 0.98, altura: 2.15, largura: 1.2 },
} as const;
const FOV = 28, GIRO = 0.32;   // graus; rad/s do giro de vitrine

/** `corpo` = um PERSONAGEM com corpo VRM próprio (lib/cyber/estiloAvatar CORPOS_VRM — ex.: a Nina), sem asas */
export default function VitrinePersonagem({ fundador, cor, corpo, className = "" }: { fundador: boolean; cor: string; corpo?: CorpoVrm; className?: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "erro">("carregando");

  useEffect(() => {
    const el = caixa.current; if (!el) return;
    let vivo = true, raf = 0, visivel = true, av: AvatarLuzHandle | null = null, corpoVrm: VRM | null = null, acessorios: AcessoriosHandle | null = null;
    const parado = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const fraco = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    let R: THREE.WebGLRenderer;
    try { R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { setEstado("erro"); return; }
    R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    R.outputColorSpace = THREE.SRGBColorSpace; R.setClearColor(0x000000, 0);
    R.domElement.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab";
    el.appendChild(R.domElement);

    const cena = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    // o desenho anime traz a própria luz (presa à câmera); o VRM (MToon) usa a da cena: luz suave de céu + uma de frente
    cena.add(new THREE.HemisphereLight(0xdfeaff, 0x2a2440, 2));
    const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(-1.5, 3, 4); cena.add(sol);
    const pivo = new THREE.Group(); cena.add(pivo);
    // o chão da vitrine: um disco de luz na cor da pessoa
    const starTex = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
    const discoTex = glowTex("rgba(255,255,255,0.9)", "rgba(255,255,255,0.18)");
    const disco = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: discoTex, color: new THREE.Color(cor), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    disco.rotation.x = -Math.PI / 2; disco.position.y = 0.01; cena.add(disco);

    const q = corpo ? QUADRO.personagem : fundador ? QUADRO.fundador : QUADRO.comum;
    const enquadrar = () => {
      const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      R.setSize(w, h, false); cam.aspect = w / h;
      // a distância que faz caber a altura E a largura pedidas
      const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), th = tv * cam.aspect;
      const d = Math.max(q.altura / 2 / tv, q.largura / 2 / th);
      cam.position.set(0, q.alvoY + 0.12, d); cam.lookAt(0, q.alvoY, 0); cam.updateProjectionMatrix();
      R.render(cena, cam);   // (o setSize limpa a tela: redesenha já, mesmo com o giro pausado)
    };
    enquadrar();
    const ro = new ResizeObserver(enquadrar); ro.observe(el);

    // arrastar gira (o giro sozinho pausa enquanto se arrasta)
    let arrastando = false, xAnt = 0, girar = 0;
    const desce = (e: PointerEvent) => { arrastando = true; xAnt = e.clientX; R.domElement.setPointerCapture(e.pointerId); R.domElement.style.cursor = "grabbing"; };
    const move = (e: PointerEvent) => { if (!arrastando) return; girar += (e.clientX - xAnt) * 0.012; xAnt = e.clientX; };
    const sobe = () => { arrastando = false; R.domElement.style.cursor = "grab"; };
    R.domElement.addEventListener("pointerdown", desce); R.domElement.addEventListener("pointermove", move);
    R.domElement.addEventListener("pointerup", sobe); R.domElement.addEventListener("pointercancel", sobe);

    const relogio = new THREE.Clock();
    let t = 0;
    const quadro = () => {
      raf = 0; if (!vivo || !visivel || document.hidden) return;
      const dt = Math.min(0.05, relogio.getDelta()); t += dt;
      if (!arrastando && !parado) pivo.rotation.y += dt * GIRO;
      pivo.rotation.y += girar; girar = 0;
      av?.animar({ andando: false, dt, t });
      R.render(cena, cam);
      raf = requestAnimationFrame(quadro);
    };
    const tocar = () => { if (!raf && vivo && visivel && !document.hidden) { relogio.getDelta(); raf = requestAnimationFrame(quadro); } };
    const io = new IntersectionObserver(([e]) => { visivel = !!e?.isIntersecting; tocar(); }, { threshold: 0.01 });
    io.observe(el);
    const aba = () => tocar();
    document.addEventListener("visibilitychange", aba);

    // o corpo: o GLB do cyberespaço (mixamo) desenhado; o founder veste o VRM por cima (o esqueleto anima por baixo)
    carregarModeloAvatar().then((gltf) => {
      if (!vivo) return;
      const a = criarAvatarLuz(cor, starTex, fraco, gltf, { anime: true });
      a.olharPara(0);   // de frente pra câmera (o modelo encara −Z; olharPara gira pra facing + π)
      pivo.add(a.group); av = a;
      const proprio: CorpoVrm | null = corpo ?? (fundador ? CORPO_DO_FUNDADOR : null);
      if (proprio) {
        if (!corpo) a.usarAsas({ escala: QUADRO.fundador.escalaAsas });   // as asas são do founder
        else { a.semMochila(); if (corpo.pose) a.poseVrm(POSES_VRM[corpo.pose]); }
        a.esperarCorpo(true);   // o corpo padrão não aparece antes do próprio
        carregarVrm(proprio.url).then((vrm) => {
          if (!vivo || av !== a) { VRMUtils.deepDispose(vrm.scene); return; }
          tingirVrm(vrm, proprio.tintas); a.usarVrm(vrm); corpoVrm = vrm;
          if (proprio.acessorios?.length) acessorios = vestirAcessorios(vrm, proprio.acessorios);
          setEstado("pronto");
        }).catch((e) => { console.warn("[vitrine] corpo próprio (VRM) não carregou:", e); a.esperarCorpo(false); if (vivo) setEstado("pronto"); });
      } else setEstado("pronto");
      tocar();
    }).catch((e) => { console.warn("[vitrine] o corpo não carregou:", e); if (vivo) setEstado("erro"); });
    tocar();

    return () => {
      vivo = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener("visibilitychange", aba);
      R.domElement.removeEventListener("pointerdown", desce); R.domElement.removeEventListener("pointermove", move);
      R.domElement.removeEventListener("pointerup", sobe); R.domElement.removeEventListener("pointercancel", sobe);
      av?.dispose(); av = null;
      acessorios?.dispose(); acessorios = null;
      if (corpoVrm) { VRMUtils.deepDispose(corpoVrm.scene); corpoVrm = null; }
      disco.geometry.dispose(); (disco.material as THREE.Material).dispose(); discoTex.dispose(); starTex.dispose();
      R.dispose(); R.forceContextLoss(); R.domElement.remove();
    };
  }, [fundador, cor, corpo]);

  return (
    <div ref={caixa} className={`relative ${className}`} aria-label={fundador ? "Seu personagem (corpo de fundador, com asas)" : "Seu personagem"} role="img">
      {estado !== "pronto" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-white/35">
            {estado === "erro" ? "Personagem indisponível" : "Carregando…"}
          </span>
        </div>
      )}
    </div>
  );
}
