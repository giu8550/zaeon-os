"use client";
/**
 * A PRÉVIA 3D do personagem no seletor (components/lounge/EscolherPersonagem): o corpo de astronauta do gênero escolhido
 * (components/cyber/CorpoAstronauta), na cor escolhida, girando devagar. Troca de modelo/cor sem recriar a cena.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle } from "@/components/cyber/AvatarLuz";
import { glowTex } from "@/components/cyber/CenaCosmica";
import { paletaDoPersonagem, type Personagem } from "@/lib/cyber/personagem";

export default function PreviaPersonagem({ personagem }: { personagem: Personagem }) {
  const ref = useRef<HTMLDivElement>(null);
  const atual = useRef(personagem); atual.current = personagem;
  useEffect(() => {
    const el = ref.current!, R = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    R.setPixelRatio(Math.min(2, devicePixelRatio)); R.setSize(el.clientWidth, el.clientHeight); el.appendChild(R.domElement);
    const cena = new THREE.Scene();
    cena.add(new THREE.HemisphereLight(0xaab8ff, 0x10101c, 1.1)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 4, 3); cena.add(d);
    const cam = new THREE.PerspectiveCamera(30, el.clientWidth / el.clientHeight, 0.05, 50); cam.position.set(0, 1.15, 4.6); cam.lookAt(0, 0.95, 0);
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.12 })); base.rotation.x = -Math.PI / 2; cena.add(base);
    const starTex = glowTex("rgba(255,255,255,1)", "rgba(190,215,255,0.5)");
    let av: AvatarLuzHandle | null = null, vivo = true, raf = 0;
    void carregarModeloAvatar().then((gltf) => { if (!vivo) return; av = criarAvatarLuz("#8b5cf6", starTex, false, gltf, { anime: true }); cena.add(av.group); });
    const t0 = performance.now(); let tAnt = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - t0) / 1000, dt = Math.min(0.05, t - tAnt); tAnt = t;
      if (av) {
        const p = atual.current;
        av.traje(true, { modelo: p.genero, paleta: paletaDoPersonagem(p) });
        av.olharPara(t * 0.45); av.animar({ andando: false, dt, t });
      }
      R.render(cena, cam);
    };
    loop();
    const ro = new ResizeObserver(() => { cam.aspect = el.clientWidth / Math.max(1, el.clientHeight); cam.updateProjectionMatrix(); R.setSize(el.clientWidth, el.clientHeight); });
    ro.observe(el);
    return () => { vivo = false; cancelAnimationFrame(raf); ro.disconnect(); av?.dispose(); starTex.dispose(); R.dispose(); R.domElement.remove(); };
  }, []);
  return <div ref={ref} className="h-full w-full" aria-hidden="true" />;
}
