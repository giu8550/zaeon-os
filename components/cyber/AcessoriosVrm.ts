/**
 * AcessoriosVrm — os acessórios dos personagens que o VRoid não tem, feitos em código no mesmo DESENHO anime (cel
 * shading + contorno de tinta — components/cyber/AvatarAnime) e presos aos OSSOS do VRM, então acompanham a pose:
 *  - "foneNoPescoco": o fone over-ear branco descansando em volta do pescoço (o da Nina no card): o arco passa por trás
 *    da nuca e as conchas ficam dos lados, apoiadas nas clavículas;
 *  - "presilhaLapis": a presilha amarela em forma de LÁPIS na franja (Nina);
 *  - "oculosRedondos": os óculos de aro fino dourado, redondos (Aura);
 *  - "presilhaEstrela": a presilha de ESTRELA prateada na franja (Aura);
 *  - "oculosRetangulares": os óculos de armação preta retangular (Téo);
 *  - "golaCircuito": o friso de CIRCUITO verde que brilha na borda do capuz (Téo);
 *  - "gravataCarmesim": a gravata vermelha no decote do blazer (Examiner);
 *  - "distintivoPrata": o distintivo prateado em forma de escudo no peito, do lado esquerdo dela (Examiner);
 *  - "mechaCarmesim": a mecha vermelha na franja, do lado direito dela (Examiner) — o VRoid não pinta mecha por mecha.
 * As medidas são em metros, no espaço dos ossos do VRM (VRM 1.0: em repouso, eixos alinhados ao mundo, +Z = frente).
 */
import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { tintaFixa, toon } from "./AvatarAnime";
import type { AcessorioVrm } from "@/lib/cyber/estiloAvatar";

export type AcessoriosHandle = { dispose(): void };

const TINTA = 0.004;
/** uma malha desenhada: o material toon + o contorno (casca invertida) */
function desenhada(g: THREE.BufferGeometry, cor: THREE.ColorRepresentation, mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const m = toon(cor, { brilho: 0.25 }), t = tintaFixa(TINTA);
  mats.push(m, t); geos.push(g);
  const grupo = new THREE.Group(), corpo = new THREE.Mesh(g, m), traco = new THREE.Mesh(g, t);
  corpo.frustumCulled = traco.frustumCulled = false; traco.raycast = () => {};
  grupo.add(corpo, traco);
  return grupo;
}

/** o fone em volta do pescoço (no osso do pescoço): arco atrás, conchas dos lados, um pouco abaixo do queixo */
function fone(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), R = 0.105;   // largo: passa POR FORA do capuz do moletom
  // o arco: meia volta por TRÁS do pescoço (de um lado ao outro), deitado e um pouco inclinado pra frente
  const arco = desenhada(new THREE.TorusGeometry(R, 0.009, 8, 32, Math.PI), 0xf4f4f6, mats, geos);
  arco.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI); g.add(arco);
  for (const lado of [-1, 1]) {
    const concha = desenhada(new THREE.CylinderGeometry(0.042, 0.038, 0.032, 20), 0xf4f4f6, mats, geos);
    concha.rotation.z = Math.PI / 2; concha.position.set(lado * (R + 0.004), -0.012, 0.012);
    concha.rotation.y = lado * 0.35;   // viradas um pouco pra frente, como quando o fone está no pescoço
    const almofada = desenhada(new THREE.TorusGeometry(0.03, 0.009, 6, 20), 0x3a3d48, mats, geos);
    almofada.rotation.y = Math.PI / 2; almofada.position.set(-lado * 0.016, 0, 0); concha.add(almofada);
    g.add(concha);
  }
  g.position.set(0, 0.05, 0.025);   // um pouco à frente e acima: apoiado sobre a gola, visível de frente
  return g;
}

/** a presilha de lápis (no osso da cabeça): amarela com a ponta de madeira e o grafite, na franja do lado esquerdo dela */
function presilha(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const corpo = desenhada(new THREE.CylinderGeometry(0.0065, 0.0065, 0.05, 6), 0xffcf3a, mats, geos); g.add(corpo);
  const madeira = desenhada(new THREE.ConeGeometry(0.0065, 0.014, 6), 0xf3d2a2, mats, geos); madeira.position.y = 0.032; g.add(madeira);
  const grafite = desenhada(new THREE.ConeGeometry(0.0025, 0.006, 6), 0x2a2a2a, mats, geos); grafite.position.y = 0.0405; g.add(grafite);
  const borracha = desenhada(new THREE.CylinderGeometry(0.0066, 0.0066, 0.008, 6), 0xf28aa8, mats, geos); borracha.position.y = -0.029; g.add(borracha);
  g.rotation.z = -1.0;   // deitada na diagonal sobre a franja
  g.position.set(0.055, 0.135, 0.085);
  return g;
}

/** os óculos redondos de aro fino dourado (no osso da cabeça), na altura dos olhos */
function oculos(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), OURO = 0xd8b45a, R = 0.0185, X = 0.031;
  for (const lado of [-1, 1]) {
    const aro = desenhada(new THREE.TorusGeometry(R, 0.0022, 6, 28), OURO, mats, geos); aro.position.set(lado * X, 0, 0); g.add(aro);
    const haste = desenhada(new THREE.CylinderGeometry(0.0018, 0.0018, 0.1, 5), OURO, mats, geos);
    haste.rotation.x = Math.PI / 2; haste.position.set(lado * (X + R + 0.004), 0.004, -0.05); g.add(haste);
  }
  const ponte = desenhada(new THREE.TorusGeometry(0.008, 0.0018, 5, 12, Math.PI), OURO, mats, geos); ponte.position.set(0, 0.004, 0); g.add(ponte);
  g.position.set(0, 0.079, 0.1);
  return g;
}

/** a presilha de estrela prateada (no osso da cabeça), na franja do lado direito dela */
function estrela(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const sh = new THREE.Shape(), n = 5, R = 0.019, r = 0.008;
  for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? r : R; if (k) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }).translate(0, 0, -0.002);
  const g = desenhada(geo, 0xdfe6f2, mats, geos);
  g.rotation.set(-0.3, -0.5, 0.3); g.position.set(-0.072, 0.118, 0.082);
  return g;
}

/** os óculos de armação preta retangular (no osso da cabeça) */
function oculosRet(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), PRETO = 0x15171c, L = 0.042, A = 0.024, X = 0.033, e = 0.004;
  for (const lado of [-1, 1]) {
    for (const [w, h, x, y] of [[L, e, 0, A / 2], [L, e, 0, -A / 2], [e, A, -L / 2, 0], [e, A, L / 2, 0]] as const) {
      const b = desenhada(new THREE.BoxGeometry(w, h, 0.004), PRETO, mats, geos); b.position.set(lado * X + x, y, 0); g.add(b);
    }
    const haste = desenhada(new THREE.BoxGeometry(0.003, 0.003, 0.1), PRETO, mats, geos); haste.position.set(lado * (X + L / 2 + 0.003), A / 2 - 0.003, -0.05); g.add(haste);
  }
  const ponte = desenhada(new THREE.BoxGeometry(0.024, 0.003, 0.004), PRETO, mats, geos); ponte.position.set(0, A / 2 - 0.004, 0); g.add(ponte);
  g.position.set(0, 0.09, 0.118);
  return g;
}

/** o friso de circuito verde na borda do capuz (no osso do pescoço): uma linha que brilha (não leva tinta — é luz) */
function golaCircuito(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), cor = 0x2bf59a;
  const m = new THREE.MeshBasicMaterial({ color: cor, toneMapped: false }); mats.push(m);
  const arco = new THREE.TorusGeometry(0.115, 0.0035, 5, 40, Math.PI * 1.3); geos.push(arco);
  const a = new THREE.Mesh(arco, m); a.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI * 1.35 / 2 + Math.PI / 2 - 0.1); g.add(a);
  g.position.set(0, 0.02, -0.01);
  return g;
}

const CARMESIM = 0xc41e3a;
/** a gravata (no osso do pescoço): o nó logo abaixo da gola e a lâmina descendo pelo decote, inclinada pra acompanhar
 *  o peito */
function gravata(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const no = desenhada(new THREE.CylinderGeometry(0.014, 0.01, 0.022, 4), CARMESIM, mats, geos); no.rotation.y = Math.PI / 4; g.add(no);
  // a lâmina: um trapézio fino que alarga pra baixo e termina em ponta
  const sh = new THREE.Shape(); sh.moveTo(-0.009, 0); sh.lineTo(0.009, 0); sh.lineTo(0.017, -0.1); sh.lineTo(0, -0.118); sh.lineTo(-0.017, -0.1); sh.closePath();
  const lamina = desenhada(new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false }), CARMESIM, mats, geos);
  lamina.position.set(0, -0.01, 0.004); lamina.rotation.x = -0.68; g.add(lamina);
  g.position.set(0, -0.005, 0.085);
  return g;
}

/** o distintivo (no osso do peito superior): um escudo prateado pequeno, do lado esquerdo dela */
function distintivo(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const sh = new THREE.Shape(); sh.moveTo(-0.017, 0.018); sh.lineTo(0.017, 0.018); sh.lineTo(0.017, -0.002); sh.quadraticCurveTo(0.014, -0.016, 0, -0.024); sh.quadraticCurveTo(-0.014, -0.016, -0.017, -0.002); sh.closePath();
  const g = desenhada(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }), 0xd9dee8, mats, geos);
  g.scale.setScalar(0.8); g.position.set(0.085, 0.03, 0.12); g.rotation.y = 0.25;
  return g;
}

/** a MECHA carmesim: pinta mechas DE VERDADE do cabelo do VRM (não é peça por cima). O cabelo do VRoid é uma malha só,
 *  feita de mechas soltas (cada uma é um pedaço conexo da malha): escolhe as da frente, do lado direito dela, que descem
 *  da risca até o queixo (medidas na pose de repouso, a partir do osso da cabeça), e passa os triângulos delas pra um
 *  material próprio — o mesmo MToon do cabelo, em carmesim liso */
const MECHA = { x: [-0.072, -0.05], zMin: 0.06, alturaMin: 0.18 } as const;
function pintarMecha(vrm: VRM, cor: THREE.ColorRepresentation): (() => void) | null {
  let malha: THREE.SkinnedMesh | null = null;
  vrm.scene.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!malha && m.isSkinnedMesh && (Array.isArray(m.material) ? m.material : [m.material]).some((x) => /_Hair_00_HAIR/.test(x.name) && !/HairBack/.test(x.name))) malha = m; });
  const hm = malha as THREE.SkinnedMesh | null, cabeca = vrm.humanoid.getRawBoneNode("head");
  if (!hm || !cabeca || !hm.geometry.index || !Array.isArray(hm.material)) return null;
  const g = hm.geometry, pos = g.attributes.position as THREE.BufferAttribute, idx = g.index!, n = pos.count;
  const bi = hm.skeleton.bones.indexOf(cabeca as THREE.Bone); if (bi < 0) return null;
  const pc = new THREE.Vector3().setFromMatrixPosition(hm.skeleton.boneInverses[bi]!.clone().invert());
  // as mechas = os pedaços conexos da malha (union-find pelos triângulos)
  const pai = new Int32Array(n).map((_, i) => i);
  const raiz = (i: number): number => { while (pai[i] !== i) { pai[i] = pai[pai[i]!]!; i = pai[i]!; } return i; };
  for (let t = 0; t < idx.count; t += 3) { const a = raiz(idx.getX(t)); pai[raiz(idx.getX(t + 1))] = a; pai[raiz(idx.getX(t + 2))] = a; }
  const v = new THREE.Vector3(), soma = new Map<number, { n: number; x: number; z: number; y0: number; y1: number }>();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(hm.bindMatrix).sub(pc);
    const r = raiz(i), c = soma.get(r) ?? { n: 0, x: 0, z: 0, y0: 9, y1: -9 };
    c.n++; c.x += v.x; c.z += v.z; c.y0 = Math.min(c.y0, v.y); c.y1 = Math.max(c.y1, v.y); soma.set(r, c);
  }
  const escolhidas = new Set([...soma].filter(([, c]) => { const x = c.x / c.n; return x >= MECHA.x[0] && x <= MECHA.x[1] && c.z / c.n >= MECHA.zMin && c.y1 - c.y0 >= MECHA.alturaMin; }).map(([r]) => r));
  if (!escolhidas.size) return null;
  // os triângulos das mechas escolhidas vão pro fim do índice, num grupo com o material carmesim
  const resto: number[] = [], delas: number[] = [];
  for (let t = 0; t < idx.count; t += 3) (escolhidas.has(raiz(idx.getX(t))) ? delas : resto).push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  const original = { index: idx, groups: g.groups.map((x) => ({ ...x })), material: hm.material };
  const mats = hm.material, principal = mats.findIndex((m) => !(m as { isOutline?: boolean }).isOutline), traco = mats.findIndex((m) => (m as { isOutline?: boolean }).isOutline);
  const pintada = mats[principal]!.clone() as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color; map?: THREE.Texture | null; shadeMultiplyTexture?: THREE.Texture | null };
  const c = new THREE.Color(cor); pintada.map = null; pintada.shadeMultiplyTexture = null; pintada.color?.copy(c); pintada.shadeColorFactor?.copy(c).multiplyScalar(0.55); pintada.needsUpdate = true;
  const Arr = (idx.array as Uint16Array | Uint32Array).constructor as Uint16ArrayConstructor | Uint32ArrayConstructor;
  g.setIndex(new THREE.BufferAttribute(new Arr([...resto, ...delas]), 1));
  g.clearGroups(); g.addGroup(0, resto.length, principal); g.addGroup(resto.length, delas.length, mats.length);
  if (traco >= 0) g.addGroup(0, resto.length + delas.length, traco);
  hm.material = [...mats, pintada];
  return () => {
    g.setIndex(original.index); g.clearGroups(); for (const x of original.groups) g.addGroup(x.start, x.count, x.materialIndex);
    hm.material = original.material; pintada.dispose();
  };
}

/** veste os acessórios no VRM (cada um no seu osso); `dispose()` tira e solta tudo */
export function vestirAcessorios(vrm: VRM, lista: readonly AcessorioVrm[]): AcessoriosHandle {
  const mats: THREE.Material[] = [], geos: THREE.BufferGeometry[] = [], postos: THREE.Object3D[] = [], desfazer: (() => void)[] = [];
  const osso = (n: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(n);
  for (const a of lista) {
    if (a === "mechaCarmesim") { const d = pintarMecha(vrm, CARMESIM); if (d) desfazer.push(d); continue; }
    const pai = a === "foneNoPescoco" || a === "golaCircuito" || a === "gravataCarmesim" ? osso("neck") ?? osso("upperChest")
      : a === "distintivoPrata" ? osso("upperChest") ?? osso("chest") : osso("head");
    if (!pai) continue;
    const obj = a === "foneNoPescoco" ? fone(mats, geos) : a === "oculosRedondos" ? oculos(mats, geos) : a === "presilhaEstrela" ? estrela(mats, geos)
      : a === "oculosRetangulares" ? oculosRet(mats, geos) : a === "golaCircuito" ? golaCircuito(mats, geos)
      : a === "gravataCarmesim" ? gravata(mats, geos) : a === "distintivoPrata" ? distintivo(mats, geos) : presilha(mats, geos);
    pai.add(obj); postos.push(obj);
    // os ÓCULOS vão onde os olhos estão (os ossos dos olhos do VRM, no referencial da cabeça) — cada rosto tem a sua
    // proporção
    if (a === "oculosRedondos" || a === "oculosRetangulares") {
      const oe = osso("leftEye"), od = osso("rightEye");
      if (oe && od) {
        vrm.scene.updateMatrixWorld(true);
        const m = oe.getWorldPosition(new THREE.Vector3()).add(od.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
        pai.worldToLocal(m);
        const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(pai.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(vrm.scene.getWorldQuaternion(new THREE.Quaternion())));
        obj.position.copy(m).addScaledVector(frente, 0.078);   // o osso do olho é o CENTRO do globo ocular: a lente fica ~7,8 cm à frente
      }
    }
  }
  return {
    dispose() {
      for (const o of postos) o.removeFromParent();
      for (const d of desfazer) d();
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
    },
  };
}
