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
  /** até onde (m) a câmera desenha AGORA (a qualidade adaptativa encurta): o buraco negro fica sempre aquém disso */
  vista(m: number): void;
  dispose(): void;
};

const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function criarFiosCosmicos(o: { /** as pistas a desenhar (padrão: as do hub) */ pistas?: readonly FioCosmico[]; low: boolean; cores: Record<NomeSala, number>; starTex: THREE.Texture; /** até onde (m) a câmera enxerga: mais longe que isso, o buraco negro é trazido pra perto,
   *  ENCOLHIDO na mesma proporção (do ponto de vista de quem olha, idêntico) — os buracos ficam a ~8 km */ alcanceVista?: number; /** um raio da tempestade de um buraco negro caiu (LOCAL da ilha): o trovão */ aoTrovao?: (p: THREE.Vector3) => void }): FiosCosmicosHandle {
  const group = new THREE.Group(); group.name = "pistas-cosmicas";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [], alvos: THREE.Object3D[] = [];
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D) => { geos.push(g); mats.push(m); const x = new THREE.Mesh(g, m); x.frustumCulled = false; pai.add(x); return x; };
  const halo = glowTex("rgba(255,255,255,0.9)", "rgba(150,120,255,0.18)"); texs.push(halo);
  const sprite = (cor: THREE.ColorRepresentation, op: number, escala: number, pai: THREE.Object3D) => { const m = new THREE.SpriteMaterial({ map: halo, color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); const s = new THREE.Sprite(m); s.scale.setScalar(escala); pai.add(s); return s; };
  type Vivo = { f: FioCosmico; disco: THREE.Group; aura: THREE.Sprite; tempestade: ReturnType<typeof criarTempestade>; tg: THREE.Group; bn: THREE.Group };
  const vivos: Vivo[] = [];

  for (const f of o.pistas ?? fiosCosmicos()) {
    const cor = new THREE.Color(o.cores[f.sala]), clara = cor.clone().lerp(new THREE.Color(0xffffff), 0.5);
    const g = new THREE.Group(); g.name = `pista-${f.sala}`; group.add(g);
    // (sem a linha nem as partículas da pista — out/2026, o dono: entre a plataforma e o buraco negro, só o FLUXO DE
    //  VEÍCULOS — components/cyber/TrafegoCeu; quem é levado continua indo pela mesma pista)
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
    vivos.push({ f, disco, aura, tempestade, tg, bn });
  }

  const raio = new THREE.Vector3(); let vista = (o.alcanceVista ?? 2600) * 0.72;
  /** põe `obj` (de posição real `x,y,z`) a no máximo `vista` m de quem olha, encolhido na mesma proporção — e, longe,
   *  um pouco MAIOR que o real (até `realce`×: o farol no horizonte que chama pra ir até lá) */
  const aproximar = (obj: THREE.Object3D, x: number, y: number, z: number, eu: V3 | undefined, realce = 1) => {
    const d = eu ? Math.hypot(x - eu.x, y - eu.y, z - eu.z) : 0, k = eu && d > vista ? vista / d : 1;
    const longe = eu ? Math.max(0, Math.min(1, (d - 1500) / 4000)) : 0, r = 1 + (realce - 1) * longe;
    obj.position.set(eu ? eu.x + (x - eu.x) * k : x, eu ? eu.y + (y - eu.y) * k : y, eu ? eu.z + (z - eu.z) * k : z); obj.scale.setScalar(k * r);
  };
  return {
    group, alvos,
    atualizar(dt, t, eu) {
      for (const v of vivos) {
        v.disco.rotation.z += dt * 0.22;
        aproximar(v.bn, v.f.bn.x, v.f.bn.y, v.f.bn.z, eu, 2.6); aproximar(v.tg, v.f.bn.x, 0, v.f.bn.z, eu, 1.6);
        // o quanto a pessoa está perto do buraco negro: a tempestade (e os raios) e a aura crescem
        const k = eu ? pertoDoBuraco(v.f, eu) : 0;
        v.tempestade.definir(0.25 + 0.75 * k, k > 0.15);
        (v.aura.material as THREE.SpriteMaterial).opacity = 0.45 + 0.4 * k;
        const caiu = v.tempestade.atualizar(t);
        if (caiu && o.aoTrovao) o.aoTrovao(raio.copy(caiu).multiplyScalar(v.tg.scale.x).add(v.tg.position));
      }
    },
    vista(m) { vista = Math.max(600, m * 0.72); },
    dispose() { group.removeFromParent(); for (const v of vivos) v.tempestade.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
