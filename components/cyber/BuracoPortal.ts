/**
 * BuracoPortal — um BURACO NEGRO pequeno, nó da rede de túneis (lib/cyber/buracos): o ANEL no piso (pisou = entra no
 * túnel), o buraco pairando em cima (horizonte preto + anel de fótons + disco de acreção quente girando + halo) e as
 * fagulhas sendo SUGADAS do anel pra dentro dele, em espiral. Mesmo idioma do buraco negro grande (CenaCosmica).
 * Leve: ~8 malhas + 1 nuvem de pontos; `low` corta as partículas. Tudo é filho do `pai`, em coordenadas do pai.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";

export type BuracoPortalHandle = {
  group: THREE.Group;
  /** o disco do anel (alvo de clique) */
  alvo: THREE.Mesh;
  /** as texturas próprias (pra quem libera a árvore inteira de uma vez — Landmark `liberar`) */
  texturas: THREE.Texture[];
  atualizar(dt: number, t: number): void;
  dispose(): void;
};

/** a textura do ANEL DE FÓTONS (um aro fino e brilhante) — sprite: sempre de frente pra câmera */
function texAnelFotons(): THREE.CanvasTexture {
  const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
  const g = c.getContext("2d")!, gr = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s / 2);
  gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.36, "rgba(0,0,0,0)"); gr.addColorStop(0.42, "rgba(255,240,214,1)"); gr.addColorStop(0.5, "rgba(255,180,90,.55)"); gr.addColorStop(0.75, "rgba(180,90,30,.12)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

export function criarBuracoPortal(pai: THREE.Object3D, o: { x: number; y: number; z: number; anelR: number; h: number; r: number; low: boolean; cor?: number; starTex?: THREE.Texture }): BuracoPortalHandle {
  const cor = o.cor ?? 0xffb45a, texs: THREE.Texture[] = [];
  const g = new THREE.Group(); g.position.set(o.x, o.y, o.z); pai.add(g);
  const aditivo = (c: number, op: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  // ── o ANEL no piso: aro aceso + o "poço" escuro (alvo) + um aro de dentro girando ──
  const aro = new THREE.Mesh(new THREE.TorusGeometry(o.anelR, 0.13, 6, 56), aditivo(cor, 0.9)); aro.rotation.x = Math.PI / 2; aro.position.y = 0.09; g.add(aro);
  const poco = new THREE.Mesh(new THREE.CircleGeometry(o.anelR - 0.1, 48), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
  poco.rotation.x = -Math.PI / 2; poco.position.y = 0.05; g.add(poco);
  const aroDentro = new THREE.Mesh(new THREE.RingGeometry(o.anelR * 0.55, o.anelR * 0.62, 48, 1, 0, Math.PI * 1.6), aditivo(0xff7a2c, 0.7)); aroDentro.rotation.x = -Math.PI / 2; aroDentro.position.y = 0.07; g.add(aroDentro);

  // ── o BURACO: horizonte + fótons + disco de acreção + halo ──
  const bh = new THREE.Group(); bh.position.y = o.h; g.add(bh);
  bh.add(new THREE.Mesh(new THREE.SphereGeometry(o.r, 32, 24), new THREE.MeshBasicMaterial({ color: 0x000000 })));
  const tf = texAnelFotons(); texs.push(tf);
  const fotons = new THREE.Sprite(new THREE.SpriteMaterial({ map: tf, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); fotons.scale.setScalar(o.r * 2.9); bh.add(fotons);
  const th = glowTex("rgba(255,200,130,0.5)", "rgba(180,90,30,0.15)"); texs.push(th);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: th, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(o.r * 6); bh.add(halo);
  const disco = new THREE.Group(); disco.rotation.x = -Math.PI / 2 + 0.22; bh.add(disco);
  for (const [a, b, c, op] of [[1.1, 2.5, 0xffe3b0, 0.8], [1.1, 1.9, 0xffb45a, 0.75], [1.1, 1.5, 0xff7a2c, 0.65]] as const) disco.add(new THREE.Mesh(new THREE.RingGeometry(o.r * a, o.r * b, o.low ? 48 : 96), aditivo(c, op)));

  // ── o FEIXE do anel até o buraco (bem fraco) ──
  const feixe = new THREE.Mesh(new THREE.CylinderGeometry(o.r * 0.5, o.anelR * 0.75, o.h - o.r, 24, 1, true), aditivo(cor, 0.1)); feixe.position.y = (o.h - o.r) / 2; g.add(feixe);

  // ── as fagulhas SUGADAS: sobem do anel em espiral, afinando, até sumir no horizonte ──
  const N = o.low ? 36 : 90, pos = new Float32Array(N * 3), ps = Array.from({ length: N }, () => ({ u: Math.random(), a: Math.random() * Math.PI * 2, v: 0.25 + Math.random() * 0.35 }));
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const fag = o.starTex ?? glowTex("rgba(255,255,255,1)", "rgba(255,210,160,0.5)"); if (!o.starTex) texs.push(fag);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.32, map: fag, color: 0xffd9a8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; g.add(pts);

  return {
    group: g, alvo: poco, texturas: texs,
    atualizar(dt, t) {
      disco.rotation.z += dt * 0.9; aroDentro.rotation.z -= dt * 1.4;
      (aro.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.25 * Math.sin(t * 2.2);
      (halo.material as THREE.SpriteMaterial).opacity = 0.75 + 0.15 * Math.sin(t * 1.5);
      for (let i = 0; i < N; i++) {
        const p = ps[i]!; p.u += dt * p.v; if (p.u > 1) { p.u = 0; p.a = Math.random() * Math.PI * 2; }
        const u = p.u, rr = o.anelR * (1 - u) * 0.9 + o.r * 0.8 * u, a = p.a + u * 7;
        pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = 0.2 + u * (o.h - 0.2); pos[i * 3 + 2] = Math.sin(a) * rr;
      }
      geo.attributes.position!.needsUpdate = true;
    },
    dispose() {
      g.traverse((x) => { const m = x as THREE.Mesh; m.geometry?.dispose(); const mt = (m as { material?: THREE.Material | THREE.Material[] }).material; if (mt) (Array.isArray(mt) ? mt : [mt]).forEach((k) => k.dispose()); });
      texs.forEach((k) => k.dispose()); g.removeFromParent();
    },
  };
}
