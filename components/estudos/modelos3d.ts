/**
 * Os DESENHOS 3D dos temas da vitrine de estudos (lib/estudos/vitrine `Modelo3D`) — procedurais, no estilo BLUEPRINT
 * da Zaeon: faces de vidro azul-escuro translúcido e as ARESTAS acesas (na cor da raridade). Cada modelo cabe numa
 * caixa de ~2 m em volta da origem; quem mostra gira devagar.
 */
import * as THREE from "three";
import type { Modelo3D } from "@/lib/estudos/vitrine";

type Peca = { geo: THREE.BufferGeometry; pos?: [number, number, number]; rot?: [number, number, number]; esc?: [number, number, number] };

export function criarModelo(m: Modelo3D, cor: number): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group(), descartar: { dispose(): void }[] = [];
  const face = new THREE.MeshBasicMaterial({ color: 0x0b2c4d, transparent: true, opacity: 0.55, depthWrite: false });
  const aresta = new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.95 });
  descartar.push(face, aresta);
  const add = (p: Peca) => {
    const mesh = new THREE.Mesh(p.geo, face), linhas = new THREE.LineSegments(new THREE.EdgesGeometry(p.geo, 20), aresta);
    for (const o of [mesh, linhas]) { if (p.pos) o.position.set(...p.pos); if (p.rot) o.rotation.set(...p.rot); if (p.esc) o.scale.set(...p.esc); group.add(o); }
    descartar.push(p.geo, linhas.geometry);
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cil = (rt: number, rb: number, h: number, s = 16) => new THREE.CylinderGeometry(rt, rb, h, s);
  switch (m) {
    case "console": add({ geo: box(0.55, 1.7, 1.2), pos: [0, 0, 0] }); add({ geo: box(0.08, 1.9, 1.35), pos: [-0.33, 0, 0] }); add({ geo: box(0.08, 1.9, 1.35), pos: [0.33, 0, 0] }); add({ geo: cil(0.35, 0.35, 0.05, 24), pos: [0.3, 0.3, 0], rot: [0, 0, Math.PI / 2] }); add({ geo: box(0.7, 0.08, 1.0), pos: [0, -0.95, 0] }); break;
    case "chip": add({ geo: box(1.4, 0.18, 1.4) }); add({ geo: box(0.7, 0.12, 0.7), pos: [0, 0.15, 0] }); for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { add({ geo: box(0.08, 0.04, 0.3), pos: [-0.55 + i * 0.22, -0.05, s * 0.85] }); add({ geo: box(0.3, 0.04, 0.08), pos: [s * 0.85, -0.05, -0.55 + i * 0.22] }); } break;
    case "planta": add({ geo: box(1.2, 0.35, 0.5), pos: [0, -0.8, 0] }); add({ geo: cil(0.04, 0.05, 1.2, 6), pos: [0, -0.05, 0] }); for (let i = 0; i < 6; i++) add({ geo: new THREE.ConeGeometry(0.16, 0.5, 5), pos: [Math.cos(i) * 0.3, -0.2 + i * 0.14, Math.sin(i) * 0.3], rot: [Math.cos(i) * 0.9, 0, Math.sin(i) * 0.9] }); add({ geo: box(1.4, 0.04, 0.9), pos: [0, 0.95, -0.35], rot: [-0.5, 0, 0] }); break;
    case "predio": for (let k = 0; k < 4; k++) add({ geo: box(1.2 - k * 0.12, 0.42, 1.0 - k * 0.1), pos: [0, -0.8 + k * 0.45, 0] }); for (const x of [-0.55, 0.55]) for (const z of [-0.45, 0.45]) add({ geo: cil(0.04, 0.04, 1.8, 6), pos: [x, 0, z] }); break;
    case "drone": add({ geo: box(0.5, 0.15, 0.5) }); for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; add({ geo: box(0.9, 0.05, 0.08), pos: [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], rot: [0, -a, 0] }); add({ geo: cil(0.32, 0.32, 0.02, 20), pos: [Math.cos(a) * 0.9, 0.1, Math.sin(a) * 0.9] }); } add({ geo: box(0.35, 0.25, 0.35), pos: [0, -0.35, 0] }); break;
    case "foguete": add({ geo: cil(0.25, 0.25, 1.3, 14), pos: [0, -0.1, 0] }); add({ geo: new THREE.ConeGeometry(0.25, 0.6, 14), pos: [0, 0.85, 0] }); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add({ geo: box(0.04, 0.45, 0.35), pos: [Math.cos(a) * 0.3, -0.6, Math.sin(a) * 0.3], rot: [0, -a, 0] }); } break;
    case "molecula": { const pts: [number, number, number][] = [[0, 0, 0], [0.7, 0.3, 0], [-0.6, 0.4, 0.3], [0.1, -0.7, 0.4], [-0.2, 0.2, -0.7], [0.8, -0.5, -0.3]]; pts.forEach((p, i) => add({ geo: new THREE.IcosahedronGeometry(i ? 0.18 : 0.28, 1), pos: p })); for (let i = 1; i < pts.length; i++) { const a = new THREE.Vector3(...pts[0]!), b = new THREE.Vector3(...pts[i]!), mid = a.clone().add(b).multiplyScalar(0.5), d = b.clone().sub(a); const g = cil(0.03, 0.03, d.length(), 6); const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); const e = new THREE.Euler().setFromQuaternion(q); add({ geo: g, pos: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z] }); } break; }
    case "engrenagem": add({ geo: new THREE.TorusGeometry(0.6, 0.14, 8, 24) }); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add({ geo: box(0.18, 0.2, 0.22), pos: [Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0], rot: [0, 0, a] }); } add({ geo: new THREE.TorusGeometry(0.3, 0.07, 6, 16), pos: [0.95, 0.95, 0.2] }); break;
    case "livro": add({ geo: box(0.9, 1.2, 0.08), pos: [-0.47, 0, 0], rot: [0, 0.35, 0] }); add({ geo: box(0.9, 1.2, 0.08), pos: [0.47, 0, 0], rot: [0, -0.35, 0] }); for (let k = 0; k < 4; k++) add({ geo: box(0.7, 0.01, 0.01), pos: [0.47, 0.3 - k * 0.18, 0.06], rot: [0, -0.35, 0] }); break;
    case "graos": for (let i = 0; i < 9; i++) add({ geo: new THREE.SphereGeometry(0.2, 10, 8), pos: [Math.cos(i * 1.9) * (0.25 + (i % 3) * 0.2), -0.2 + Math.floor(i / 3) * 0.25, Math.sin(i * 1.9) * (0.25 + (i % 3) * 0.2)], esc: [1, 0.7, 1.4] }); add({ geo: cil(0.75, 0.6, 0.5, 18), pos: [0, -0.7, 0] }); break;
    case "ondas": add({ geo: box(1.6, 1.0, 1.0) }); add({ geo: box(1.0, 0.75, 0.04), pos: [-0.2, 0, 0.5] }); add({ geo: box(0.3, 0.75, 0.05), pos: [0.6, 0, 0.5] }); for (let k = 0; k < 3; k++) add({ geo: new THREE.TorusGeometry(0.15 + k * 0.12, 0.01, 4, 24, Math.PI), pos: [-0.2, 0, 0.6 + k * 0.05] }); break;
    case "robo": add({ geo: box(0.7, 0.8, 0.5), pos: [0, -0.1, 0] }); add({ geo: box(0.5, 0.4, 0.45), pos: [0, 0.55, 0] }); for (const s of [-1, 1]) { add({ geo: cil(0.07, 0.07, 0.7, 8), pos: [s * 0.5, -0.1, 0], rot: [0, 0, s * 0.3] }); add({ geo: cil(0.08, 0.08, 0.5, 8), pos: [s * 0.2, -0.75, 0] }); } add({ geo: cil(0.02, 0.02, 0.3, 4), pos: [0, 0.9, 0] }); break;
  }
  // a base técnica (um anel no chão com as marcas de cota)
  const anel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.15, 1.15, 0.01, 40)), new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.35 }));
  anel.position.y = -1.05; group.add(anel); descartar.push(anel.geometry, anel.material as THREE.Material);
  return { group, dispose: () => { for (const d of descartar) d.dispose(); group.removeFromParent(); } };
}
