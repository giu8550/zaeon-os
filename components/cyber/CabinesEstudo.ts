/**
 * CabinesEstudo — as CABINES DE ESTUDO da cidadela (lib/cyber/ceu `cabinesDaCidadela`), por hierarquia acadêmica
 * por LEVEL (lib/cyber/credenciais): a fileira dos level 10 (PhD) logo depois dos pilares da capela, a dos level 7–9
 * (doutorado) atrás e a dos level 4–6 (mestrado) depois. Cada cabine: o piso de vidro escuro com o friso na cor do degrau, a mesa, o monitor aceso (virado
 * pra quem senta), a cadeira, dois painéis de vidro dos lados com o topo aceso e um losango flutuando em cima (a cor do
 * degrau). UMA malha instanciada por peça (~10 draw calls pras 52 cabines); no referencial da ILHA (flutua com ela).
 */
import * as THREE from "three";
import { CABINE, cabinesDaCidadela, type CabineEstudo } from "@/lib/cyber/ceu";
import { MODELOS_CREDENCIAL } from "@/lib/cyber/credenciais";

type Peca = { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; cor?: "degrau" | "tela"; rotY?: number };

export function criarCabinesEstudo(o: { low: boolean }): { group: THREE.Group; dispose(): void } {
  const g = new THREE.Group(); g.name = "cabines-estudo";
  const cabines = cabinesDaCidadela(), n = cabines.length, C = CABINE;
  const escuro = new THREE.MeshStandardMaterial({ color: 0x0c1426, emissive: 0x0a1630, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.7 });
  const madeira = new THREE.MeshStandardMaterial({ color: 0x1a2440, emissive: 0x101c3a, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.4 });
  const aceso = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const vidro = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.08, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide });
  const pecas: Peca[] = [
    { geo: new THREE.BoxGeometry(C.larg, 0.1, C.prof), mat: escuro, pos: [0, 0.05, 0.1] },                                   // o piso da cabine
    { geo: new THREE.BoxGeometry(C.larg + 0.04, 0.03, 0.06), mat: aceso, pos: [0, 0.11, 0.1 + C.prof / 2], cor: "degrau" },   // o friso da frente
    { geo: new THREE.BoxGeometry(C.larg + 0.04, 0.03, 0.06), mat: aceso, pos: [0, 0.11, 0.1 - C.prof / 2], cor: "degrau" },   // o de trás
    { geo: new THREE.BoxGeometry(2.2, 0.07, 0.85), mat: madeira, pos: [0, 0.78, C.mesaZ] },                                   // o tampo da mesa
    { geo: new THREE.BoxGeometry(2.2, 0.7, 0.05), mat: escuro, pos: [0, 0.4, C.mesaZ + 0.4] },                                 // o painel da frente da mesa
    { geo: new THREE.BoxGeometry(1.3, 0.76, 0.05), mat: escuro, pos: [0, 1.28, C.monitorZ] },                                  // o monitor (a carcaça)
    { geo: new THREE.PlaneGeometry(1.2, 0.66), mat: aceso, pos: [0, 1.28, C.monitorZ - 0.03], cor: "tela", rotY: Math.PI },  // a TELA, virada pra quem senta
    { geo: new THREE.BoxGeometry(0.52, 0.07, 0.5), mat: madeira, pos: [C.assento.x, 0.5, C.assento.z] },                     // o assento
    { geo: new THREE.BoxGeometry(0.5, 0.62, 0.06), mat: madeira, pos: [C.assento.x, 0.86, C.assento.z - 0.27] },             // o encosto
    { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.46, 6), mat: escuro, pos: [C.assento.x, 0.25, C.assento.z] },            // o pé da cadeira
    { geo: new THREE.BoxGeometry(0.04, 1.25, 2.3), mat: vidro, pos: [-C.painelX, 0.72, 0.1] },                                // os painéis de vidro
    { geo: new THREE.BoxGeometry(0.04, 1.25, 2.3), mat: vidro, pos: [C.painelX, 0.72, 0.1] },
    { geo: new THREE.BoxGeometry(0.07, 0.04, 2.3), mat: aceso, pos: [-C.painelX, 1.36, 0.1], cor: "degrau" },               // o topo aceso dos painéis
    { geo: new THREE.BoxGeometry(0.07, 0.04, 2.3), mat: aceso, pos: [C.painelX, 1.36, 0.1], cor: "degrau" },
    { geo: new THREE.OctahedronGeometry(0.2, 0), mat: aceso, pos: [0, 2.35, C.mesaZ], cor: "degrau" },                        // o losango do degrau
  ];
  const corDe = (c: CabineEstudo) => new THREE.Color(MODELOS_CREDENCIAL[c.nivel].cor);
  const mC = new THREE.Matrix4(), mP = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0), um = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  const geos = new Set<THREE.BufferGeometry>();
  for (const p of pecas) {
    if (o.low && p.mat === vidro) continue;   // (no fraco, sem os vidros transparentes)
    const im = new THREE.InstancedMesh(p.geo, p.mat, n); geos.add(p.geo);
    if (p.cor) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    cabines.forEach((c, i) => {
      mC.compose(v.set(c.x, 0, c.z), q.setFromAxisAngle(eixo, c.rot), um);
      mP.compose(v.set(...p.pos), q.setFromAxisAngle(eixo, p.rotY ?? 0), um);
      im.setMatrixAt(i, mC.clone().multiply(mP));
      if (p.cor) im.setColorAt(i, p.cor === "tela" ? corDe(c).lerp(new THREE.Color(0xdff6ff), 0.55) : corDe(c));
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere(); im.userData.semLote = true;
    g.add(im);
  }
  return {
    group: g,
    dispose() { for (const ge of geos) ge.dispose(); for (const m of [escuro, madeira, aceso, vidro]) m.dispose(); g.removeFromParent(); },
  };
}
