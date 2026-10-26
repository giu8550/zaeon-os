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

    // MOTO MONO-PNEU + RASTRO (placeholder: uma roda vertical + casco preto + frisos na cor do usuário)
    const moto = new THREE.Group(); scene.add(moto);
    const rodaRaio = 2.6;
    const pneu = new THREE.Mesh(new THREE.TorusGeometry(rodaRaio, 0.5, 12, 40), matPreto({ metalness: 0.6 })); pneu.rotation.y = Math.PI / 2; moto.add(pneu);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(rodaRaio, 0.12, 8, 48), aditivo(corUser, 1)); aro.rotation.y = Math.PI / 2; moto.add(aro);
    const casco = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.1, 1.3), matPreto({ metalness: 0.6 })); casco.position.set(0, rodaRaio + 0.2, 0); moto.add(casco);
    const friso = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.12, 0.14), aditivo(corUser, 0.95)); friso.position.set(0, rodaRaio + 0.7, 0.66); moto.add(friso);

    // RASTRO: muro de luz que fica pra trás (ring buffer de pontos → fita de quads)
    const NR = 90, rastroPos = new Float32Array(NR * 2 * 3), rastroCor = new Float32Array(NR * 2 * 3);
    const rastroGeo = new THREE.BufferGeometry();
    rastroGeo.setAttribute("position", new THREE.BufferAttribute(rastroPos, 3));
    rastroGeo.setAttribute("color", new THREE.BufferAttribute(rastroCor, 3));
    const idx: number[] = []; for (let i = 0; i < NR - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    rastroGeo.setIndex(idx);
    const rastroMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const rastro = new THREE.Mesh(rastroGeo, rastroMat); rastro.frustumCulled = false; scene.add(rastro);
    const pts: THREE.Vector3[] = Array.from({ length: NR }, () => new THREE.Vector3());
    let nPts = 0; const ALT = 2.4; const corTmp = new THREE.Color();

    const ro = new ResizeObserver(() => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { R.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); } });
    ro.observe(host);

    let raf = 0; const t0 = performance.now(); let paradoAng = 0;
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      atualizarFluxo(fluxo, t);
      // aplica a cor do usuário escolhida (traje + moto)
      const cu = corTmp.set(corRef.current);
      (matLinhaTraje as THREE.MeshBasicMaterial).color.copy(cu);
      (aro.material as THREE.MeshBasicMaterial).color.copy(cu);
      (friso.material as THREE.MeshBasicMaterial).color.copy(cu);
      // a moto corre num círculo
      paradoAng += 0.012; const Rc = 11, mx = Math.cos(paradoAng) * Rc, mz = Math.sin(paradoAng) * Rc;
      moto.position.set(mx, 0, mz);
      moto.rotation.y = -paradoAng + Math.PI / 2;
      pneu.rotation.x -= 0.25;
      // empurra ponto no rastro
      const base = pts[nPts % NR]!; base.set(mx, 0.05, mz); nPts++;
      const vis = Math.min(nPts, NR);
      for (let i = 0; i < vis; i++) {
        const p = pts[(nPts - vis + i + NR) % NR]!; const o = i * 6;
        rastroPos[o] = p.x; rastroPos[o + 1] = p.y; rastroPos[o + 2] = p.z;
        rastroPos[o + 3] = p.x; rastroPos[o + 4] = p.y + ALT; rastroPos[o + 5] = p.z;
        const a = i / vis;                         // cauda(0) → cabeça(1)
        const f = (0.15 + 0.85 * a);
        rastroCor[o] = cu.r * f; rastroCor[o + 1] = cu.g * f; rastroCor[o + 2] = cu.b * f;
        rastroCor[o + 3] = cu.r * f * 0.5; rastroCor[o + 4] = cu.g * f * 0.5; rastroCor[o + 5] = cu.b * f * 0.5;
      }
      rastroGeo.setDrawRange(0, Math.max(0, (vis - 1) * 6));
      (rastroGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (rastroGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      // câmera orbitando devagar
      const ca = t * 0.08; cam.position.set(Math.sin(ca) * 36, 15, Math.cos(ca) * 36); cam.lookAt(0, 4, 0);
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
