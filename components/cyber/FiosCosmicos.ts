/**
 * FiosCosmicos — o TECIDO CÓSMICO da Zaeon (lib/cyber/fiosCosmicos): no lugar das escadas, da borda saem os fios-
 * NEURÔNIO — o axônio (um núcleo aceso dentro de uma bainha translúcida), os sinais correndo por ele até a ponta (as
 * sinapses), os dendritos com as pontinhas acesas — e na ponta de cada um um BURACO NEGRO MASSIVO (o horizonte, o anel
 * de fótons, o disco de acreção girando, o halo). Na borda, a BOCA (o anel onde se pisa pra prancha te levar).
 * Referencial: o LOCAL da ilha (o grupo vai dentro dela).
 */
import * as THREE from "three";
import { FIO, fiosCosmicos, pontoDoFio, type V3 } from "@/lib/cyber/fiosCosmicos";
import type { NomeSala } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";

export type FiosCosmicosHandle = { group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const v3 = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);

export function criarFiosCosmicos(o: { low: boolean; cores: Record<NomeSala, number>; starTex: THREE.Texture }): FiosCosmicosHandle {
  const group = new THREE.Group(); group.name = "tecido-cosmico";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [], alvos: THREE.Object3D[] = [];
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); const x = new THREE.Mesh(g, m); x.frustumCulled = false; pai.add(x); return x; };
  const halo = glowTex("rgba(255,255,255,0.9)", "rgba(150,120,255,0.18)"); texs.push(halo);
  const SEG = o.low ? 140 : 260, RAD = o.low ? 6 : 10;
  type Vivo = { pulsos: { u: number; v: number }[]; pos: Float32Array; geo: THREE.BufferGeometry; f: ReturnType<typeof fiosCosmicos>[number]; disco: THREE.Group; casca: THREE.MeshBasicMaterial; anelBoca: THREE.Mesh; bulbos: THREE.Sprite[] };
  const vivos: Vivo[] = [];

  for (const f of fiosCosmicos()) {
    const cor = new THREE.Color(o.cores[f.sala]), clara = cor.clone().lerp(new THREE.Color(0xffffff), 0.55);
    const g = new THREE.Group(); g.name = `fio-${f.sala}`; group.add(g);
    // ── o AXÔNIO: núcleo aceso + bainha translúcida (mais grossa) ──
    const curva = new THREE.CatmullRomCurve3(f.eixo.map(v3));
    const nucleo = aditivo(clara, 0.95), casca = aditivo(cor, 0.16); mats.push(nucleo, casca);
    malha(new THREE.TubeGeometry(curva, SEG, FIO.raio * 0.42, RAD, false), nucleo, g);
    malha(new THREE.TubeGeometry(curva, SEG, FIO.raio * 1.6, RAD, false), casca, g);
    // ── os DENDRITOS (mais finos) e as pontinhas acesas ──
    const nucleoR = aditivo(clara, 0.7), cascaR = aditivo(cor, 0.1); mats.push(nucleoR, cascaR);
    for (const ramo of f.ramos) {
      const c = new THREE.CatmullRomCurve3(ramo.map(v3));
      malha(new THREE.TubeGeometry(c, o.low ? 12 : 24, FIO.raio * 0.18, 5, false), nucleoR, g);
      if (!o.low) malha(new THREE.TubeGeometry(c, 16, FIO.raio * 0.6, 6, false), cascaR, g);
    }
    const bulbos = f.bulbos.map((b) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: clara, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); mats.push(s.material); s.position.copy(v3(b)); s.scale.setScalar(3.2); g.add(s); return s; });
    // ── os SINAIS correndo pelo axônio até o buraco negro ──
    const N = o.low ? 18 : 42, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geos.push(geo);
    const pm = new THREE.PointsMaterial({ size: 2.4, map: o.starTex, color: clara, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(pm);
    const pts = new THREE.Points(geo, pm); pts.frustumCulled = false; g.add(pts);
    const pulsos = Array.from({ length: N }, (_, i) => ({ u: i / N, v: 0.05 + ((i * 37) % 10) / 160 }));
    // ── a BOCA na borda: o anel aceso no piso + o "poço" escuro (alvo do clique) ──
    const boca = new THREE.Group(); boca.position.set(f.boca.x, 0.06, f.boca.z); g.add(boca);
    const anelBoca = malha(new THREE.TorusGeometry(f.boca.r, 0.16, 6, 48), aditivo(clara, 0.9), boca); anelBoca.rotation.x = Math.PI / 2; mats.push(anelBoca.material as THREE.Material);
    const poco = malha(new THREE.CircleGeometry(f.boca.r - 0.12, 40), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), boca); poco.rotation.x = -Math.PI / 2; mats.push(poco.material as THREE.Material); alvos.push(poco);
    const feixe = malha(new THREE.CylinderGeometry(f.boca.r * 0.6, f.boca.r, 9, 24, 1, true), aditivo(cor, 0.12), boca); feixe.position.y = 4.5; mats.push(feixe.material as THREE.Material);
    // ── o BURACO NEGRO MASSIVO da ponta ──
    const bn = new THREE.Group(); bn.position.copy(v3(f.bn)); g.add(bn);
    const R = f.bn.r, preto = new THREE.MeshBasicMaterial({ color: 0x000000 }); mats.push(preto);
    malha(new THREE.SphereGeometry(R, 40, 28), preto, bn);
    const fotons = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffe9c8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); fotons.scale.setScalar(R * 2.6); bn.add(fotons); mats.push(fotons.material);
    const auraBn = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: cor, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); auraBn.scale.setScalar(R * 8); bn.add(auraBn); mats.push(auraBn.material);
    const disco = new THREE.Group(); disco.rotation.set(-Math.PI / 2 + 0.32, 0, 0.18); bn.add(disco);
    for (const [a, b, c, op] of [[1.15, 3.2, 0xffe3b0, 0.55], [1.15, 2.4, 0xffb45a, 0.6], [1.15, 1.7, clara.getHex(), 0.7]] as const) { const m = aditivo(c, op); mats.push(m); malha(new THREE.RingGeometry(R * a, R * b, o.low ? 64 : 128), m, disco); }
    vivos.push({ pulsos, pos, geo, f, disco, casca, anelBoca, bulbos });
  }

  return {
    group, alvos,
    atualizar(dt, t) {
      for (const v of vivos) {
        for (let i = 0; i < v.pulsos.length; i++) {
          const p = v.pulsos[i]!; p.u += dt * p.v; if (p.u > 1) p.u -= 1;
          const q = pontoDoFio(v.f, p.u); v.pos[i * 3] = q.x; v.pos[i * 3 + 1] = q.y; v.pos[i * 3 + 2] = q.z;
        }
        v.geo.attributes.position!.needsUpdate = true;
        v.disco.rotation.z += dt * 0.25;
        v.casca.opacity = 0.13 + 0.05 * Math.sin(t * 1.3);
        (v.anelBoca.material as THREE.MeshBasicMaterial).opacity = 0.7 + 0.25 * Math.sin(t * 2.4);
        v.bulbos.forEach((b, i) => b.scale.setScalar(2.6 + 0.9 * Math.sin(t * 1.7 + i)));
      }
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
