/**
 * TemploEstudo — os LOUNGES ESTUDANTIS do Templo Cósmico (layout puro em lib/cyber/temploCosmico `ESTUDO`; os sofás e
 * pufes das rodas de leitura são móveis do lounge — lib/cyber/ceu `zonaEstudo`, onde dá pra sentar): uma sala de
 * estudos moderna e aconchegante em cada lado do salão — o tapete quente, as ESTANTES em arco cheias de livros, as
 * luminárias de pé, as plantas e a cobertura de vidro sobre pilares finos com as luzinhas penduradas. A "caixa de som"
 * no meio de cada um é de onde sai o som calmo de estudo (o engine toca).
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico).
 */
import * as THREE from "three";
import { PLATS, aberturasDe } from "@/lib/cyber/temploCosmico";

export type EstudoHandle = { group: THREE.Group; alvos: THREE.Object3D[]; caixas: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const CORES_LIVRO = [0xc94f3d, 0x3d6fc9, 0xe0b04a, 0x4fa36b, 0x8a5bc9, 0xd98a3a, 0x2f8f9a, 0xe8e1d0];

export function criarLoungesEstudo(o: { low: boolean; paredeMat: THREE.Material }): EstudoHandle {
  const group = new THREE.Group(); group.name = "lounges-estudo";
  const alvos: THREE.Object3D[] = [], caixas: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const madeira = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.75, metalness: 0.05 });
  const tapete = new THREE.MeshStandardMaterial({ color: 0x2a2440, emissive: 0x161028, emissiveIntensity: 0.4, roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd8dce6, roughness: 0.3, metalness: 0.8 });
  const quente = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), vaso = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6 });
  const folha = new THREE.MeshStandardMaterial({ color: 0x2f8a4a, emissive: 0x0c2a14, emissiveIntensity: 0.5, roughness: 0.8 });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const luzes: THREE.InstancedMesh[] = [];

  for (const p of PLATS.filter((x) => x.id === "estudoL" || x.id === "estudoR")) {
    const g = new THREE.Group(); g.position.set(p.x, p.h, p.z); group.add(g);
    const R = p.r, abs = aberturasDe(p), livre = (a: number, folga: number) => abs.every((ab) => { let d = a - ab.ang; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) > ab.meia + folga; });
    // o TAPETE redondo (quente, macio) e o anel de madeira na borda
    const tp = malha(new THREE.CircleGeometry(R - 3, 64), tapete, g); tp.rotation.x = -Math.PI / 2; tp.position.y = 0.04;
    const anel = malha(new THREE.RingGeometry(R - 3, R - 2.4, 64), madeira, g); anel.rotation.x = -Math.PI / 2; anel.position.y = 0.05;
    // as ESTANTES em arco (por dentro do guarda-corpo, menos onde as pontes e a escada encostam), cheias de livros
    const prat: { a: number }[] = []; for (let a = 0; a < Math.PI * 2; a += 2.6 / (R - 1.6)) if (livre(a, 0.12)) prat.push({ a });
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.3, 0.45), madeira, prat.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    geos.push(im.geometry); g.add(im); alvos.push(im);
    const porEstante = o.low ? 12 : 28, livros = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.42, 0.3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), prat.length * porEstante);
    geos.push(livros.geometry); mats.push(livros.material as THREE.Material); g.add(livros);
    const cor = new THREE.Color(); let k = 0;
    prat.forEach(({ a }, i) => {
      const r = R - 1.6, rot = Math.atan2(-Math.cos(a), -Math.sin(a));   // (de frente pro meio)
      q.setFromAxisAngle(v.set(0, 1, 0), rot); im.setMatrixAt(i, m4.compose(v.set(Math.cos(a) * r, 1.15, Math.sin(a) * r), q, um));
      for (let j = 0; j < porEstante; j++) {
        const prateleira = j % 3, lx = -1.05 + ((j / 3) | 0) * (2.1 / Math.ceil(porEstante / 3)), alt = 0.42 + prateleira * 0.72;
        const off = new THREE.Vector3(lx, alt, 0.08).applyQuaternion(q);
        livros.setMatrixAt(k, m4.compose(v.set(Math.cos(a) * r + off.x, off.y, Math.sin(a) * r + off.z), q, um.set(1, 0.8 + ((j * 37) % 5) * 0.06, 1))); um.set(1, 1, 1);
        livros.setColorAt(k, cor.setHex(CORES_LIVRO[(i * 7 + j * 3) % CORES_LIVRO.length]!)); k++;
      }
    });
    im.instanceMatrix.needsUpdate = true; livros.instanceMatrix.needsUpdate = true; if (livros.instanceColor) livros.instanceColor.needsUpdate = true; im.computeBoundingSphere(); livros.computeBoundingSphere();
    // a COBERTURA: pilares finos, o aro e o vidro por cima, com as luzinhas penduradas
    const NP = 10, H = 7.5;
    for (let i = 0; i < NP; i++) { const a = (i / NP) * Math.PI * 2 + 0.31; if (!livre(a, 0.05)) continue; const c = malha(new THREE.CylinderGeometry(0.12, 0.16, H, 8), metal, g); c.position.set(Math.cos(a) * (R - 0.6), H / 2, Math.sin(a) * (R - 0.6)); }
    const aro = malha(new THREE.TorusGeometry(R - 0.6, 0.18, 6, 96), metal, g); aro.rotation.x = Math.PI / 2; aro.position.y = H;
    const teto = malha(new THREE.CircleGeometry(R - 0.6, 64), vidro, g); teto.rotation.x = Math.PI / 2; teto.position.y = H;
    const NL = o.low ? 40 : 90, pend = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), quente, NL); geos.push(pend.geometry);
    for (let i = 0; i < NL; i++) { const a = (i / NL) * Math.PI * 2 * 3.7, r = 4 + (i / NL) * (R - 6); pend.setMatrixAt(i, m4.makeTranslation(Math.cos(a) * r, H - 0.6 - ((i * 13) % 7) * 0.25, Math.sin(a) * r)); }
    pend.instanceMatrix.needsUpdate = true; pend.computeBoundingSphere(); g.add(pend); luzes.push(pend);
    // as LUMINÁRIAS de pé (junto das rodas de leitura) e as PLANTAS
    for (const [lx, lz] of [[-20, 6], [20, 6], [-8, 21], [8, 21], [-6, 3], [6, 3]] as const) {
      const pe = malha(new THREE.CylinderGeometry(0.05, 0.05, 2.1, 6), metal, g); pe.position.set(lx, 1.05, lz);
      const cup = malha(new THREE.ConeGeometry(0.42, 0.45, 16, 1, true), quente, g); cup.position.set(lx, 2.15, lz); cup.rotation.x = Math.PI;
    }
    for (const [lx, lz] of [[-22, 12], [22, 12], [-15, 20], [15, 20], [0, 24], [-3, -23]] as const) {
      const vs = malha(new THREE.CylinderGeometry(0.5, 0.38, 0.8, 12), vaso, g); vs.position.set(lx, 0.4, lz);
      const fl = malha(new THREE.IcosahedronGeometry(0.9, 1), folha, g); fl.position.set(lx, 1.35, lz); fl.scale.set(1, 1.3, 1);
    }
    // a "caixa de som" no meio (de onde sai o som calmo de estudo)
    const cx = new THREE.Object3D(); cx.position.set(0, 3, 0); g.add(cx); caixas.push(cx);
  }
  return {
    group, alvos, caixas,
    atualizar(_dt, t) { for (const l of luzes) l.material instanceof THREE.MeshBasicMaterial && l.material.color.setHSL(0.09, 0.9, 0.78 + 0.05 * Math.sin(t * 0.8)); },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of [...mats, madeira, tapete, metal, quente, vaso, folha, vidro]) if (m !== o.paredeMat) m.dispose(); },
  };
}
