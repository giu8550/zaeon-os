"use client";
/**
 * /zz-cyber/tron — BANCADA de dev da estética Tron (Etapa 1; NÃO vai pra prod, zz-cyber é preview).
 * Mostra, isolado e lado a lado, o sistema de neon ciano-sobre-preto animado (lib/cyber/neon + fluxoNeon):
 *   • CHÃO = PISTA (preto + faixas ciano correndo + a onda do fluxo)
 *   • PAREDE = CIRCUITO (trilhas em grade na cor neon)
 *   • TRAJE (preto + linhas na COR DO USUÁRIO — o mundo é ciano, o ser mantém a cor dele)
 *   • MOTO MONO-PNEU + RASTRO (roda única iluminada deixando um muro de luz)
 * É aqui que a gente afina o look antes de propagar pro mundo (etapas 2–5).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { NEON_HEX, aditivo, matPreto } from "@/lib/cyber/neon";
import { criarFluxo, atualizarFluxo, matPista, matCircuito } from "@/lib/cyber/fluxoNeon";
import { criarMoto } from "@/components/cyber/Moto";

const CORES_DEMO = ["#ff7fb0", "#4aa3ff", "#5fd08a", "#ffbe54", "#b48cff", "#49d9d9", "#ff8a65"];

export default function BancadaTron() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [corUser, setCorUser] = useState("#ff7fb0");
  const corRef = useRef(corUser); corRef.current = corUser;

  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const R = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const w0 = host.clientWidth || 960, h0 = host.clientHeight || 600;
    R.setSize(w0, h0); host.appendChild(R.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(NEON_HEX.preto);
    const cam = new THREE.PerspectiveCamera(50, w0 / h0, 0.1, 2000); cam.position.set(0, 14, 34);
    scene.add(new THREE.HemisphereLight(0x3a5a88, 0x05060a, 0.8));
    const dir = new THREE.DirectionalLight(0x99bbff, 0.5); dir.position.set(8, 20, 10); scene.add(dir);

    // o FLUXO (fonte alto no centro, como o olho da torre)
    const fluxo = criarFluxo({ fonte: new THREE.Vector3(0, 40, 0), vel: 22, entre: 60 });

    // CHÃO = PISTA
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), matPista(fluxo, { escala: 1 }));
    chao.rotation.x = -Math.PI / 2; scene.add(chao);
    // uma "laje preta" por baixo pra o chão não ser só o additive no vazio
    const laje = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), matPreto({ emissiveIntensity: 0.25 }));
    laje.rotation.x = -Math.PI / 2; laje.position.y = -0.02; scene.add(laje);

    // PAREDE = CIRCUITO (ao fundo)
    const parede = new THREE.Mesh(new THREE.BoxGeometry(60, 26, 1.2), matCircuito(fluxo));
    parede.position.set(0, 13, -34); scene.add(parede);
    const paredePreta = new THREE.Mesh(new THREE.BoxGeometry(60, 26, 1), matPreto());
    paredePreta.position.set(0, 13, -34.6); scene.add(paredePreta);

    // TRAJE (amostra): capsula preta + "linhas" neon na COR DO USUÁRIO
    const trajeG = new THREE.Group(); trajeG.position.set(-16, 0, 2); scene.add(trajeG);
    const corpo = new THREE.Mesh(new THREE.CapsuleGeometry(2.4, 7, 8, 20), matPreto({ metalness: 0.7, roughness: 0.35 }));
    corpo.position.y = 6.2; trajeG.add(corpo);
    const matLinhaTraje = aditivo(corUser, 0.95);
    const linhasTraje: THREE.Mesh[] = [];
    // umas tiras finas verticais/peitorais — o lugar das "linhas do Tron"
    for (const [x, y, z, rz, len] of [[0, 7.6, 2.45, 0, 5], [1.4, 6.5, 2.2, 0.5, 3.2], [-1.4, 6.5, 2.2, -0.5, 3.2], [0, 4, 2.45, 0, 3]] as const) {
      const tira = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.08), matLinhaTraje); tira.position.set(x, y, z); tira.rotation.z = rz; corpo.add(tira); linhasTraje.push(tira);
    }
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.4, 32), matPreto()); pedestal.position.y = 0.2; trajeG.add(pedestal);
    const anelPedestal = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.06, 8, 48), aditivo(corUser, 0.9)); anelPedestal.rotation.x = Math.PI / 2; anelPedestal.position.y = 0.42; trajeG.add(anelPedestal);

    // MOTO: a REAL (components/cyber/Moto.criarMoto) — assim a bancada mostra EXATAMENTE a moto do mundo (lightcycle
    // Tron: duas rodas hubless + casco preto + neon na cor do dono). Escalada pra caber na bancada (a moto é ~2 m).
    // escala 1 (a moto de verdade, ~2 m): assim o MURO DE LUZ dela (gerado em metros de mundo) sai no tamanho certo.
    const motoH = criarMoto({ cor: corUser, low: false, estilo: 0 });
    const moto = motoH.group; scene.add(moto);
    // os materiais de neon/casco pra recolorir quando o dono troca de cor (sem reconstruir a moto)
    const frisoMats: THREE.MeshBasicMaterial[] = [];
    moto.traverse((o) => { const m = (o as THREE.Mesh).material; for (const mm of Array.isArray(m) ? m : [m]) { if (mm && (mm as THREE.Material).userData?.friso) frisoMats.push(mm as THREE.MeshBasicMaterial); } });
    const corTmp = new THREE.Color();
    // o RASTRO é o da PRÓPRIA moto (motoH.atualizar desenha o muro de luz no mundo) — sem fita de placeholder aqui.

    const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { R.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); } });
    ro.observe(host);

    let raf = 0; const t0 = performance.now(); let paradoAng = 0, tAnt = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000; const dt = Math.min(0.05, t - tAnt); tAnt = t;
      atualizarFluxo(fluxo, t);
      // aplica a cor do usuário escolhida (traje + moto)
      const cu = corTmp.set(corRef.current);
      (matLinhaTraje as THREE.MeshBasicMaterial).color.copy(cu);
      for (const fm of frisoMats) fm.color.copy(cu);
      // a moto (de verdade, ~2 m) corre num círculo pequeno NO CHÃO — ela se anima e desenha o muro de luz sozinha
      paradoAng += 0.007; const Rc = 2.6, mx = Math.cos(paradoAng) * Rc, mz = Math.sin(paradoAng) * Rc;
      moto.position.set(mx, 0, mz);
      moto.rotation.y = -paradoAng + Math.PI / 2;
      motoH.atualizar({ dt, t, voando: false, vel: 26, curva: 0.007 });
      // câmera perto, girando devagar em volta do centro — enquadra a moto inteira e mostra rodas + muro de todo lado
      const orb = t * 0.22, rCam = 5;
      cam.position.set(Math.cos(orb) * rCam, 1.9, Math.sin(orb) * rCam);
      cam.lookAt(mx * 0.5, 0.9, mz * 0.5);
      R.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry?.dispose(); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach((x) => x?.dispose()); } });
      R.dispose(); host.removeChild(R.domElement);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#04060a] text-white">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[12px] leading-5 text-cyan-200/90">
        <div className="text-[14px] font-bold text-cyan-300">BANCADA TRON · Etapa 1</div>
        <div className="mt-1 text-cyan-100/70">ciano = mundo · cor escolhida = jogador/moto</div>
        <div className="mt-2 space-y-0.5 text-cyan-100/80">
          <div>◤ CHÃO = PISTA (fluxo animado)</div>
          <div>◤ PAREDE = CIRCUITO</div>
          <div>◤ TRAJE (cor do usuário)</div>
          <div>◤ MOTO MONO-PNEU + RASTRO</div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <span className="font-mono text-[11px] text-cyan-200/70">cor do jogador:</span>
        {CORES_DEMO.map((c) => (
          <button key={c} onClick={() => setCorUser(c)} aria-label={c}
            className={`h-6 w-6 rounded-full border transition ${corUser === c ? "border-white scale-110" : "border-white/20"}`}
            style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
        ))}
      </div>
    </div>
  );
}
