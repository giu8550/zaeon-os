"use client";
/**
 * HoloZaeonCena — a Zaeon em HOLOGRAMA, a mesma do centro da cidadela (components/cyber/HoloZaeon), numa cena 3D pequena
 * pro player do vídeo do documento: o globo de luz embaixo, o rosto sobe de dentro dele e a boca segue o VOLUME da
 * narração (`nivel()` — o AnalyserNode do player). Pausa quando a aba some (visibilitychange), como o resto do 3D da casa.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { criarHoloZaeon } from "@/components/cyber/HoloZaeon";
import { GLOBO_CAPELA } from "@/lib/cyber/ceu";

export default function HoloZaeonCena({ nivel, falando }: { nivel: () => number | null; falando: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const falandoRef = useRef(falando); falandoRef.current = falando;
  const nivelRef = useRef(nivel); nivelRef.current = nivel;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let R: THREE.WebGLRenderer;
    try { R = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch { return; }   // (sem WebGL: o player segue sem o holograma)
    R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); R.setClearColor(0x000000, 0);
    el.appendChild(R.domElement);
    const cena = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    const raiz = new THREE.Group(); cena.add(raiz);
    // o GLOBO de luz de onde ela sai
    const globo = new THREE.Mesh(new THREE.SphereGeometry(GLOBO_CAPELA.r, 40, 24), new THREE.MeshBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    globo.position.y = GLOBO_CAPELA.y; raiz.add(globo);
    const aroGlobo = new THREE.Mesh(new THREE.TorusGeometry(GLOBO_CAPELA.r * 1.02, 0.05, 6, 80), new THREE.MeshBasicMaterial({ color: 0x9ff0ff, transparent: true, opacity: 0.7 }));
    aroGlobo.rotation.x = Math.PI / 2; aroGlobo.position.y = GLOBO_CAPELA.y; raiz.add(aroGlobo);
    const holo = criarHoloZaeon(raiz, { low: false });
    holo.aparecer();
    // enquadra o busto + o globo (o rosto termina ~TAM acima do globo)
    const alvo = new THREE.Vector3(0, GLOBO_CAPELA.y + 7.5, 0);
    cam.position.set(0, alvo.y + 1.5, 34); cam.lookAt(alvo);
    const medir = () => { const w = el.clientWidth || 1, h = el.clientHeight || 1; R.setSize(w, h, false); R.domElement.style.width = "100%"; R.domElement.style.height = "100%"; cam.aspect = w / h; cam.updateProjectionMatrix(); };
    medir(); const ro = new ResizeObserver(medir); ro.observe(el);
    let raf = 0, ultimo = performance.now(), visivel = document.visibilityState === "visible";
    const vis = () => { visivel = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", vis);
    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      if (!visivel) return;
      const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
      holo.boca(falandoRef.current ? nivelRef.current() : null);
      aroGlobo.rotation.z += dt * 0.5; globo.scale.setScalar(1 + Math.sin(agora / 600) * 0.015);
      holo.atualizar(dt, agora / 1000, cam.position);
      R.render(cena, cam);
    };
    raf = requestAnimationFrame(quadro);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener("visibilitychange", vis); holo.dispose(); R.dispose(); R.domElement.remove(); };
  }, []);
  return <div ref={ref} className="h-full w-full" aria-label="A Zaeon em holograma apresentando o documento" />;
}
