/**
 * FiosCosmicos — as PISTAS CÓSMICAS da Zaeon (lib/cyber/fiosCosmicos): LEVES — cada pista é um FLUXO de luz (uma
 * linha tênue na cor da sala + as partículas correndo por ela até o buraco negro) e, no canto do
 * mapa, o BURACO NEGRO MASSIVO (o horizonte, o anel de fótons, o disco de acreção girando, a aura) envolto numa
 * TEMPESTADE (as nuvens e os raios de components/cyber/Tempestade) que cresce quanto mais perto se chega.
 * Referencial: o LOCAL da ilha (o grupo vai dentro do hub).
 */
import * as THREE from "three";
import { FIO, fiosCosmicos, pertoDoBuraco, pontoDoFio, type FioCosmico, type V3 } from "@/lib/cyber/fiosCosmicos";
import type { NomeSala } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { criarTempestade } from "./Tempestade";

export type FiosCosmicosHandle = {
  group: THREE.Group; alvos: THREE.Object3D[];
  /** onde a pessoa está (LOCAL da ilha): a tempestade e o brilho do buraco negro crescem quando ela chega perto */
  atualizar(dt: number, t: number, eu?: V3): void;
  dispose(): void;
};

const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function criarFiosCosmicos(o: { /** as pistas a desenhar (padrão: as do hub) */ pistas?: readonly FioCosmico[]; low: boolean; cores: Record<NomeSala, number>; starTex: THREE.Texture; /** um raio da tempestade de um buraco negro caiu (LOCAL da ilha): o trovão */ aoTrovao?: (p: THREE.Vector3) => void }): FiosCosmicosHandle {
  const group = new THREE.Group(); group.name = "pistas-cosmicas";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [], alvos: THREE.Object3D[] = [];
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D) => { geos.push(g); mats.push(m); const x = new THREE.Mesh(g, m); x.frustumCulled = false; pai.add(x); return x; };
  const halo = glowTex("rgba(255,255,255,0.9)", "rgba(150,120,255,0.18)"); texs.push(halo);
  const sprite = (cor: THREE.ColorRepresentation, op: number, escala: number, pai: THREE.Object3D) => { const m = new THREE.SpriteMaterial({ map: halo, color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); const s = new THREE.Sprite(m); s.scale.setScalar(escala); pai.add(s); return s; };
  type Vivo = { f: FioCosmico; fluxo: { u: number; v: number; lado: number; alto: number }[]; pos: Float32Array; geo: THREE.BufferGeometry; disco: THREE.Group; aura: THREE.Sprite; tempestade: ReturnType<typeof criarTempestade>; tg: THREE.Group; linha: THREE.LineBasicMaterial };
  const vivos: Vivo[] = [];

  for (const f of o.pistas ?? fiosCosmicos()) {
    const cor = new THREE.Color(o.cores[f.sala]), clara = cor.clone().lerp(new THREE.Color(0xffffff), 0.5);
    const g = new THREE.Group(); g.name = `pista-${f.sala}`; group.add(g);
    // ── a PISTA: uma linha tênue (o traçado) — o que se vê de verdade é o fluxo correndo por ela ──
    const passo = o.low ? 4 : 2, pts: number[] = []; for (let i = 0; i < f.eixo.length; i += passo) { const p = f.eixo[i]!; pts.push(p.x, p.y, p.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); geos.push(lg);
    const linha = new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(linha);
    const l = new THREE.Line(lg, linha); l.frustumCulled = false; g.add(l);
    // ── o FLUXO: partículas correndo pela pista até o buraco negro (uma faixa larga, como poeira sendo sugada) ──
    const N = o.low ? 110 : 260, pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geos.push(geo);
    const pm = new THREE.PointsMaterial({ size: 2.2, map: o.starTex, color: clara, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(pm);
    const pp = new THREE.Points(geo, pm); pp.frustumCulled = false; g.add(pp);
    const fluxo = Array.from({ length: N }, (_, i) => ({ u: i / N, v: 0.012 + ((i * 37) % 17) / 900, lado: (((i * 53) % 21) - 10) * 0.9, alto: (((i * 29) % 13) - 6) * 0.6 }));
    // (sem boca nem coluna de luz: o fluxo É o caminho — quem chega perto dele é levado)
    // ── o BURACO NEGRO MASSIVO do canto ──
    const bn = new THREE.Group(); bn.position.set(f.bn.x, f.bn.y, f.bn.z); g.add(bn);
    const R = f.bn.r; malha(new THREE.SphereGeometry(R, 40, 28), new THREE.MeshBasicMaterial({ color: 0x000000 }), bn);
    sprite(0xffe9c8, 0.9, R * 2.7, bn);
    const aura = sprite(cor, 0.5, R * 9, bn);
    const disco = new THREE.Group(); disco.rotation.set(-Math.PI / 2 + 0.3, 0, 0.2); bn.add(disco);
    for (const [a, b, c, op] of [[1.15, 3.6, 0xffe3b0, 0.5], [1.15, 2.6, 0xffb45a, 0.55], [1.15, 1.8, clara.getHex(), 0.7]] as const) malha(new THREE.RingGeometry(R * a, R * b, o.low ? 64 : 128), aditivo(c, op), disco);
    // ── a TEMPESTADE em volta: nuvens escuras girando e raios — fraca de longe, forte chegando ──
    const tg = new THREE.Group(); tg.position.set(f.bn.x, 0, f.bn.z); g.add(tg);
    const tempestade = criarTempestade({ low: o.low, yBase: f.bn.y - 70, yTopo: f.bn.y + 90, raioMax: FIO.espiralR + 60, alvoPonta: new THREE.Vector3(0, f.bn.y, 0), cor: cor.clone().multiplyScalar(0.35), semAbismo: true, densidade: 0.7, nuvens: o.low ? 40 : 90 });
    tg.add(tempestade.group); tempestade.definir(0.25, false);
    vivos.push({ f, fluxo, pos, geo, disco, aura, tempestade, tg, linha });
  }

  const raio = new THREE.Vector3();
  return {
    group, alvos,
    atualizar(dt, t, eu) {
      for (const v of vivos) {
        for (let i = 0; i < v.fluxo.length; i++) {
          const p = v.fluxo[i]!; p.u += dt * p.v * (0.6 + 1.8 * p.u * p.u); if (p.u > 1) p.u -= 1;   // (acelera chegando no buraco negro)
          const q = pontoDoFio(v.f, p.u), aperta = 1 - p.u * 0.85, s = Math.sin(q.rumo), c = Math.cos(q.rumo);
          v.pos[i * 3] = q.x + c * p.lado * aperta; v.pos[i * 3 + 1] = q.y + p.alto * aperta; v.pos[i * 3 + 2] = q.z - s * p.lado * aperta;
        }
        v.geo.attributes.position!.needsUpdate = true;
        v.disco.rotation.z += dt * 0.22;
        // o quanto a pessoa está perto do buraco negro: a tempestade (e os raios) e a aura crescem
        const k = eu ? pertoDoBuraco(v.f, eu) : 0;
        v.tempestade.definir(0.25 + 0.75 * k, k > 0.15);
        (v.aura.material as THREE.SpriteMaterial).opacity = 0.45 + 0.4 * k;
        v.linha.opacity = 0.2 + 0.25 * k;
        const caiu = v.tempestade.atualizar(t);
        if (caiu && o.aoTrovao) o.aoTrovao(raio.copy(caiu).add(v.tg.position));
      }
    },
    dispose() { group.removeFromParent(); for (const v of vivos) v.tempestade.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
