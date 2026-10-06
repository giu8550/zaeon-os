/**
 * ElevadorDeLuz — o jeito de subir a um lugar flutuante (Universidade, Solana House): um ANEL no chão, uma COLUNA de
 * luz até a base do disco (com fagulhas subindo) e o anel de VOLTA no piso do disco. Pisar no anel = subir/descer (a
 * lógica é do engine, lib/cyber/plataformas). Tudo é filho do `pai` (o grupo do disco, que já está na altura dele):
 * `chao.y` é a altura do chão RELATIVA ao disco (negativa). Devolve a animação por quadro.
 */
import * as THREE from "three";

export function criarElevadorDeLuz(pai: THREE.Object3D, o: { chao: { x: number; z: number; r: number; y: number }; disco: { x: number; z: number; r: number }; low: boolean; cor?: number }): (dt: number, t: number) => void {
  const cor = o.cor ?? 0x66e6ff;
  const luz = (op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const anel = (x: number, y: number, z: number, r: number) => {
    const g = new THREE.Group(); g.position.set(x, y, z); pai.add(g);
    const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 48), luz(0.9)); a.rotation.x = Math.PI / 2; a.position.y = 0.08; g.add(a);
    const fundo = new THREE.Mesh(new THREE.CircleGeometry(r - 0.1, 40), luz(0.22)); fundo.rotation.x = -Math.PI / 2; fundo.position.y = 0.06; g.add(fundo);
    const a2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.6, 0.06, 4, 40), luz(0.6)); a2.rotation.x = Math.PI / 2; a2.position.y = 0.1; g.add(a2);
    return { g, fundo, a2 };
  };
  const baixo = anel(o.chao.x, o.chao.y, o.chao.z, o.chao.r), cima = anel(o.disco.x, 0, o.disco.z, o.disco.r);
  // a coluna: do anel do chão até logo abaixo do disco
  const h = -o.chao.y - 1.5, coluna = new THREE.Mesh(new THREE.CylinderGeometry(o.chao.r * 0.85, o.chao.r * 0.85, h, 32, 1, true), luz(0.16));
  coluna.position.set(o.chao.x, o.chao.y + h / 2, o.chao.z); pai.add(coluna);
  const miolo = new THREE.Mesh(new THREE.CylinderGeometry(o.chao.r * 0.25, o.chao.r * 0.25, h, 12, 1, true), luz(0.3));
  miolo.position.copy(coluna.position); pai.add(miolo);
  // fagulhas subindo pela coluna
  const n = o.low ? 40 : 110, pos = new Float32Array(n * 3), fase = Array.from({ length: n }, () => Math.random());
  const ang = Array.from({ length: n }, () => Math.random() * Math.PI * 2), rr = Array.from({ length: n }, () => Math.random() * o.chao.r * 0.8);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: cor, size: 0.6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  pts.frustumCulled = false; pai.add(pts);
  return (_dt, t) => {
    for (let i = 0; i < n; i++) {
      const u = (fase[i]! + t * 0.06) % 1;
      pos[i * 3] = o.chao.x + Math.cos(ang[i]! + t * 0.5) * rr[i]!; pos[i * 3 + 1] = o.chao.y + 0.5 + u * h; pos[i * 3 + 2] = o.chao.z + Math.sin(ang[i]! + t * 0.5) * rr[i]!;
    }
    geo.attributes.position!.needsUpdate = true;
    const p = 0.16 + 0.08 * Math.sin(t * 2.2);
    (coluna.material as THREE.MeshBasicMaterial).opacity = p; (baixo.fundo.material as THREE.MeshBasicMaterial).opacity = p + 0.06; (cima.fundo.material as THREE.MeshBasicMaterial).opacity = p + 0.06;
    baixo.a2.rotation.z = t * 0.8; cima.a2.rotation.z = -t * 0.8;
  };
}
