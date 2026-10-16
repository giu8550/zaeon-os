/**
 * Praca — a ILHA FLUTUANTE da praça (lib/cyber/praca): o hiperespaço não tem mais chão, então as bases de estudo, o
 * heliporto e o estacionamento pequeno das motos ficam num disco flutuando no vazio, na mesma fundação dos outros
 * lugares (piso com anéis de luz, aro aceso na borda, base de cristal invertida com propulsores antigravidade) e com o
 * BURACO NEGRO dela (o nó da rede de túneis). O piso é o alvo do clique de andar.
 */
import * as THREE from "three";
import { PRACA } from "@/lib/cyber/praca";
import { NOS } from "@/lib/cyber/buracos";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";
import { criarBuracoPortal } from "./BuracoPortal";

export type PracaHandle = { group: THREE.Group; piso: THREE.Mesh; atualizar(dt: number, t: number): void; dispose(): void };

export function criarPraca(o: { low: boolean; starTex: THREE.Texture }): PracaHandle {
  const R = PRACA.r, seg = o.low ? 72 : 128, texturas: THREE.Texture[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const raiz = new THREE.Group(); raiz.position.set(PRACA.x, PRACA.y, PRACA.z);
  const add = <T extends THREE.Object3D>(x: T) => { raiz.add(x); return x; };
  const friso = new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });

  // ── o PISO: anéis concêntricos + raios finos (nada de grade infinita: é o piso de uma ilha) ──
  const c = document.createElement("canvas"); c.width = c.height = 1024;
  { const g = c.getContext("2d")!, m = 512; g.fillStyle = "#0b1328"; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = "rgba(102,230,255,.22)"; g.lineWidth = 2;
    for (let k = 1; k <= 9; k++) { g.beginPath(); g.arc(m, m, (k / 9) * 500, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = "rgba(102,230,255,.1)";
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g.beginPath(); g.moveTo(m + Math.cos(a) * 60, m + Math.sin(a) * 60); g.lineTo(m + Math.cos(a) * 500, m + Math.sin(a) * 500); g.stroke(); }
    const gr = g.createRadialGradient(m, m, 0, m, m, 130); gr.addColorStop(0, "rgba(120,200,255,.18)"); gr.addColorStop(1, "rgba(120,200,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024); }
  const texPiso = new THREE.CanvasTexture(c); texPiso.colorSpace = THREE.SRGBColorSpace; texturas.push(texPiso);
  const piso = add(new THREE.Mesh(new THREE.CircleGeometry(R, seg), new THREE.MeshStandardMaterial({ map: texPiso, roughness: 0.6, metalness: 0.35, emissive: 0x0a1430, emissiveIntensity: 0.55 })));
  piso.rotation.x = -Math.PI / 2; piso.position.y = 0.01;

  // ── a borda e a fundação (a mesma idéia da UNILAB) ──
  const pedra = new THREE.MeshStandardMaterial({ color: 0x141e38, roughness: 0.28, metalness: 0.75, emissive: 0x0b1a3c, emissiveIntensity: 0.65 });
  const casca = add(new THREE.Mesh(new THREE.CylinderGeometry(R, R - 1.5, 3, seg, 1, true), pedra)); casca.position.y = -1.5;
  const aro = add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.35, 6, seg), friso)); aro.rotation.x = Math.PI / 2; aro.position.y = 0.08;
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0a1226, roughness: 0.3, metalness: 0.5, emissive: 0x1a2f6a, emissiveIntensity: 0.55, flatShading: true });
  // (a montanha invertida e os brilhos embaixo saíram — out/2026: a praça subiu pra perto da Zaeon e as superfícies de
  //  baixo não existem; fica a laje: o piso, a casca da borda e o fundo liso)
  const fundo = add(new THREE.Mesh(new THREE.CircleGeometry(R - 1.5, seg), baseMat)); fundo.rotation.x = Math.PI / 2; fundo.position.y = -3;
  anim.push((_, t) => { friso.opacity = 0.65 + 0.2 * Math.sin(t * 0.9); });

  // ── o BURACO NEGRO da praça (o nó da rede de túneis) ──
  const n = NOS.praca, bp = criarBuracoPortal(raiz, { x: n.anel.x - PRACA.x, y: 0, z: n.anel.z - PRACA.z, anelR: n.anel.r, h: n.bh.h, r: n.bh.r, low: o.low, starTex: o.starTex });
  texturas.push(...bp.texturas); anim.push(bp.atualizar);

  return {
    group: raiz, piso,
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { liberar(raiz, texturas); },
  };
}
