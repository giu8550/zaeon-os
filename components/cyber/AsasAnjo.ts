/**
 * AsasAnjo — as ASAS NEGRAS DE ANJO do founder (no lugar da mochila a jato), no desenho anime do cyberespaço: penas
 * pretas com um brilho violeta na borda (rim) e contorno de tinta. Cada asa tem um esqueleto de 3 juntas (ombro →
 * cotovelo → pulso, como a de um pássaro): as penas do braço (escapulares + cobertas), as SECUNDÁRIAS no antebraço e as
 * PRIMÁRIAS na mão — essas, uma a uma, abrem em leque. O que as asas FAZEM (abrir, bater, planar, mergulhar) vem de
 * lib/cyber/asas (puro); aqui é só o corpo e as poses.
 *
 * Referencial do grupo (o mesmo do `corpo` do avatar): a frente da pessoa é o −Z, as costas o +Z. Asa direita = +X; a
 * esquerda é a mesma, espelhada (escala −1 em X). Na asa ABERTA, o braço vai pra fora (+X) e as penas pendem (−Y).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { toon, tintaFixa } from "./AvatarAnime";
import type { SaidaAsas } from "@/lib/cyber/asas";

export type AsasHandle = { group: THREE.Group; atualizar(s: SaidaAsas, t: number): void; dispose(): void };

const COR_PENA = 0x17141f, COR_BRILHO = 0x8f7bff;
/** comprimento dos ossos da asa (m): braço, antebraço, mão */
const L = { braco: 0.44, ante: 0.52, mao: 0.46 } as const;

/** uma PENA: folha com ponta, de espessura fina (pra o contorno de tinta funcionar), curvada pra trás. A base fica na
 *  origem e a pena pende pra −Y */
function pena(comp: number, larg: number, curva = 0.1): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-larg * 0.5, 0);
  s.quadraticCurveTo(-larg * 0.62, -comp * 0.55, -larg * 0.08, -comp * 0.97);
  s.quadraticCurveTo(0, -comp * 1.02, larg * 0.12, -comp * 0.95);
  s.quadraticCurveTo(larg * 0.58, -comp * 0.5, larg * 0.5, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / comp; p.setZ(i, p.getZ(i) - 0.006 + curva * comp * y * y); }   // centra a espessura e curva pra trás
  g.computeVertexNormals();
  return g;
}
const posta = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz: number, rx = 0) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1)));
/** o osso da asa (a borda de ataque): tubo afinando ao longo de +X */
const osso = (comp: number, r0: number, r1: number) => new THREE.CylinderGeometry(r1, r0, comp, 8, 1).rotateZ(-Math.PI / 2).translate(comp / 2, 0, 0).toNonIndexed();

type Asa = { raiz: THREE.Group; ombro: THREE.Group; cotovelo: THREE.Group; pulso: THREE.Group; primarias: { m: THREE.Group; base: number }[] };

export function criarAsas(): AsasHandle {
  const group = new THREE.Group();
  const mat = toon(COR_PENA, { rim: new THREE.Color(COR_BRILHO), rimForca: 0.14, brilho: 0 });   // (rim forte em pena chapada vista de raspão acendia a pena inteira)
  const tinta = tintaFixa(0.007);
  const geos: THREE.BufferGeometry[] = [];
  // cada asa vira UMA malha com esqueleto (os ossos = ombro, cotovelo, pulso e os 9 pivôs das primárias): 2 draw calls
  // por asa (penas + contorno) — eram 24 (cada pena e cada segmento com o toon e a tinta dele)
  let partes: { g: THREE.BufferGeometry; osso: THREE.Object3D }[] = [];
  const malha = (g: THREE.BufferGeometry, pai: THREE.Object3D) => { geos.push(g); partes.push({ g, osso: pai }); };
  const esqueletizar = (raiz: THREE.Object3D, ossos: THREE.Object3D[]) => {
    raiz.updateMatrixWorld(true);
    const inv = raiz.matrixWorld.clone().invert(), m = new THREE.Matrix4();
    const gs = partes.map(({ g, osso: o }) => {
      const c = g.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)), n = c.attributes.position!.count, k = ossos.indexOf(o);
      const si = new Float32Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = k; sw[i * 4] = 1; }
      c.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); c.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
      return c;
    });
    const geo = mergeGeometries(gs)!; gs.forEach((g) => g.dispose()); geos.push(geo); partes = [];
    const penas = new THREE.SkinnedMesh(geo, mat), contorno = new THREE.SkinnedMesh(geo, tinta);
    penas.frustumCulled = contorno.frustumCulled = false; contorno.raycast = () => {};
    raiz.add(penas, contorno); raiz.updateMatrixWorld(true);
    const esq = new THREE.Skeleton(ossos as THREE.Bone[]); penas.bind(esq); contorno.bind(esq);
    geo.computeBoundingSphere(); penas.boundingSphere = geo.boundingSphere!.clone(); contorno.boundingSphere = geo.boundingSphere!.clone();   // (sem a deformação na CPU no 1º desenho)
  };

  // as penas de cada segmento (iguais nos dois lados; a esquerda é espelhada)
  const gBraco = mergeGeometries([
    osso(L.braco, 0.05, 0.04),
    ...Array.from({ length: 5 }, (_, i) => posta(pena(0.36 + 0.04 * i, 0.13), 0.04 + i * 0.085, 0.01, 0.008 * i, -0.28 + 0.06 * i)),   // escapulares
    ...Array.from({ length: 4 }, (_, i) => posta(pena(0.22, 0.12, 0.05), 0.06 + i * 0.1, 0.02, 0.03, -0.1 + 0.03 * i)),                 // cobertas
  ])!;
  const gAnte = mergeGeometries([
    osso(L.ante, 0.04, 0.032),
    ...Array.from({ length: 7 }, (_, i) => posta(pena(0.74 + 0.02 * i, 0.15), 0.02 + i * 0.075, 0.0, 0.006 * i, -0.04 + 0.03 * i)),   // secundárias
    ...Array.from({ length: 6 }, (_, i) => posta(pena(0.3, 0.12, 0.05), 0.03 + i * 0.085, 0.02, 0.035, 0.02 * i)),                       // cobertas
  ])!;
  const gMao = mergeGeometries([osso(L.mao, 0.032, 0.012), posta(pena(0.18, 0.08, 0.04), 0.05, 0.03, 0.03, -0.6)])!;   // + a álula

  const lado = (s: 1 | -1): Asa => {
    const raiz = new THREE.Group(); raiz.scale.x = s; raiz.position.set(s * 0.08, 0, 0); group.add(raiz);
    const ombro = new THREE.Group(); raiz.add(ombro);
    const cotovelo = new THREE.Group(); cotovelo.position.x = L.braco; ombro.add(cotovelo);
    const pulso = new THREE.Group(); pulso.position.x = L.ante; cotovelo.add(pulso);
    malha(s > 0 ? gBraco : gBraco.clone(), ombro); malha(s > 0 ? gAnte : gAnte.clone(), cotovelo); malha(s > 0 ? gMao : gMao.clone(), pulso);
    // PRIMÁRIAS: cada uma num pivô próprio (o leque), da mais interna (pendendo) à mais externa (quase na horizontal)
    const primarias: Asa["primarias"] = [];
    for (let i = 0; i < 9; i++) {
      const piv = new THREE.Group(); piv.position.set(0.02 + i * 0.05, 0, 0.004 * i); pulso.add(piv);
      malha(pena(0.86 + 0.035 * i, 0.135 - 0.004 * i, 0.12), piv);
      primarias.push({ m: piv, base: 0.12 + (1.25 * i) / 8 });
    }
    esqueletizar(raiz, [ombro, cotovelo, pulso, ...primarias.map((p) => p.m)]);
    return { raiz, ombro, cotovelo, pulso, primarias };
  };
  const asas = [lado(1), lado(-1)];

  // as poses: RECOLHIDA (atrás das costas, braço apontando pra trás e pra cima, penas pendendo até as pernas) × ABERTA
  // RECOLHIDA: dobra em Z como a de um pássaro (braço pra trás, antebraço volta, mão pra trás de novo), SEM levantar o
  // braço antes de girar (senão as penas saem na diagonal, espetadas pra trás): o arco fica no alto, acima dos ombros
  // (a raiz sobe), e as penas caem RETAS, coladas às costas, até a panturrilha
  // (o cotovelo dobrado ~140° INVERTE o sentido: pra devolver as penas à vertical ele gira +, não −)
  // o braço SOBE íngreme até o cotovelo (o PICO pontudo acima do ombro — a silhueta clássica) e o antebraço desce de
  // volta; a mão volta pra trás
  const RECOLHE = { ombro: [0.85, -1.6], cotovelo: [1.1, 2.55], pulso: [-0.3, -2.45] } as const;
  const SOBE_RECOLHIDA = 0.06, ABRE_PONTAS = -0.15;   // o braço sobe (arco acima dos ombros) e o cotovelo devolve; as pontas abrem um pouco pra fora
  const ABRE = { ombro: [0.28, -0.22], cotovelo: [-0.06, 0.04], pulso: [0.14, 0.0] } as const;
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;

  return {
    group,
    atualizar(s, t) {
      const a = s.e.abertura, b = s.batida, fase = s.e.fase, amp = s.e.amp;
      // as juntas de fora ATRASAM em relação ao ombro (a onda que corre na asa = batida orgânica)
      const bCot = amp * Math.cos(fase - 0.7), bPul = amp * Math.cos(fase - 1.3);
      const respira = (1 - a) * 0.03 * Math.sin(t * 1.3);
      for (const w of asas) {
        w.raiz.position.y = SOBE_RECOLHIDA * (1 - a); w.raiz.rotation.z = -ABRE_PONTAS * (1 - a);
        w.ombro.rotation.set(0, mix(RECOLHE.ombro[1], ABRE.ombro[1], a), mix(RECOLHE.ombro[0], ABRE.ombro[0], a) + b * a + respira, "YZX");
        w.cotovelo.rotation.set(0, mix(RECOLHE.cotovelo[1], ABRE.cotovelo[1], a), mix(RECOLHE.cotovelo[0], ABRE.cotovelo[0], a) + 0.5 * bCot * a, "YZX");
        w.pulso.rotation.set(0, mix(RECOLHE.pulso[1], ABRE.pulso[1], a), mix(RECOLHE.pulso[0], ABRE.pulso[0], a) + 0.45 * bPul * a, "YZX");
        // o leque das primárias: fechado recolhido, aberto voando; na DESCIDA da batida ele abre mais (pega o ar)
        const leque = mix(0.07, 1, a) * (1 + 0.18 * Math.max(0, -Math.sin(fase)) * Math.min(1, amp * 2));
        for (const p of w.primarias) p.m.rotation.z = p.base * leque;
      }
    },
    dispose() { for (const g of geos) g.dispose(); mat.dispose(); tinta.dispose(); group.removeFromParent(); },
  };
}
