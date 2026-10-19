/**
 * O CORPO DE ASTRONAUTA (as armas de fogo): um modelo de verdade, riggado no Mixamo (public/avatars/traje — convertido
 * por scripts/avatar/astronauta-para-glb.mjs: a malha intacta, sem as texturas pesadas), no lugar do corpo do avatar.
 *
 * Como anima: o esqueleto mixamo do AvatarLuz (o Soldier, invisível) continua fazendo tudo — as animações do rifle, a
 * IK das mãos na arma, andar, mirar. A cada quadro o astronauta COPIA a pose dele osso a osso pelo nome (os dois são
 * mixamo): cada osso gira, no referencial do corpo, o mesmo tanto que o do Soldier girou desde a pose de bind
 * (Δ = Q_agora · Q_bind⁻¹), aplicado sobre a pose de bind do astronauta — que antes é ALINHADA à do Soldier (cada
 * osso apontando pro mesmo lado: o astronauta veio em pose A, o Soldier em T). O quadril também desloca (escalado pela altura). O rosto de anime do VRM vai atrás da
 * viseira (AvatarVrm `rosto`, preso na `ancoraRosto`).
 * O traço é de DESENHO, como o avatar de roupa (components/cyber/AvatarAnime): cel shading em faixas chapadas, o brilho
 * de borda na cor do jogador e o CONTORNO DE TINTA (uma cópia da malha inflada, só as faces de trás, na mesma skin).
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { tintaFixa, toon } from "./AvatarAnime";

export const ASTRONAUTAS = { m: "/avatars/traje/astronauta-m.glb" } as const;
/** a VISEIRA (o material "visera" do modelo): escura, mas transparente o bastante pro rosto aparecer */
export const VISEIRA = { cor: 0x3a2a14, opacidade: 0.38 } as const;
/** o DESENHO: a espessura do contorno de tinta (m) e o quanto a cor clareia (o toon multiplica a cor pelas faixas: sem
 *  isso o branco vira cinza-chumbo na sombra — a mesma conta do avatar desenhado) */
export const DESENHO = { tinta: 0.011, clareia: 1.35 } as const;
/** onde ficam os OLHOS do rosto dentro do capacete, a partir do osso da cabeça (m, no referencial do corpo: pra cima e
 *  pra frente), e quanto o VRM encolhe pra cabeça de anime caber no capacete */
export const OLHOS_NO_CAPACETE = { cima: 0.085, frente: 0.05, escala: 0.86 } as const;

/** as PALETAS da armadura: por pedaço do nome do material (os do modelo — scripts/avatar/astronauta-m.cores.json); a
 *  "branca" é a do arquivo. A PRETA é a do fundador (placas de preto brilhante, a malha grafite por baixo); os outros
 *  jogadores vestem a COR DELES (`#rrggbb` — a cor do jogador): as placas na cor, a malha e os tubos escuros */
export type Paleta = "branca" | "preta" | `#${string}`;
const PLACAS = ["pechera", "hombrera", "placa_pelvis", "placa_piernas", "casco", "mochila", "cinturon", "armadura"];
type Tom = { pedacos: string[]; cor: number };
const PRETA: Tom[] = [
  { pedacos: PLACAS, cor: 0x23252c },
  { pedacos: ["covertura"], cor: 0x4a4d57 },
  { pedacos: ["tubos", "brazalete", "phongE", "lambert1"], cor: 0x131316 },
];
/** a paleta da cor do jogador: a cor nas placas (um pouco mais clara — no desenho a sombra escurece), o resto escuro */
export function paletaDaCor(hex: string): Tom[] {
  const c = new THREE.Color(hex), hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl);
  const placa = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.85), Math.max(0.42, Math.min(0.62, hsl.l + 0.08)));
  const malha = new THREE.Color().setHSL(hsl.h, 0.18, 0.17);
  return [{ pedacos: PLACAS, cor: placa.getHex() }, { pedacos: ["covertura"], cor: malha.getHex() }, { pedacos: ["tubos", "brazalete", "phongE", "lambert1"], cor: 0x141417 }];
}
const tons = (p: Paleta): Tom[] | null => (p === "branca" ? null : p === "preta" ? PRETA : paletaDaCor(p));

const cache = new Map<string, Promise<GLTF>>();
export function carregarAstronauta(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) { p = new GLTFLoader().loadAsync(url); cache.set(url, p); p.catch(() => cache.delete(url)); }
  return p;
}

export type CorpoAstronautaHandle = {
  cena: THREE.Object3D;
  ancoraRosto: THREE.Object3D;
  /** pinta a armadura com uma paleta */
  pintar(p: Paleta): void;
  /** copia a pose do esqueleto do avatar (chamar depois de toda a animação/IK do quadro, antes do rosto VRM) */
  atualizar(): void;
  visivel(on: boolean): void;
  dispose(): void;
};

const ossosMixamo = (raiz: THREE.Object3D) => { const m = new Map<string, THREE.Object3D>(); raiz.traverse((o) => { if ((o as THREE.Bone).isBone && o.name.startsWith("mixamorig")) m.set(o.name.replace(/^mixamorig:?/, ""), o); }); return m; };

/** veste o astronauta no `corpo` do avatar, seguindo o esqueleto mixamo `modelo` */
export function vestirAstronauta(gltf: GLTF, modelo: THREE.Object3D, corpo: THREE.Object3D, op: { /** a cor do brilho de borda (a do jogador) */ rim?: string } = {}): CorpoAstronautaHandle {
  const cena = skClone(gltf.scene);
  // os materiais são de cada avatar: viram DESENHO (toon) na cor de cada peça; a VISEIRA, vidro chapado transparente
  const rim = new THREE.Color(op.rim ?? "#9fb7ff");
  const meu = (mt: THREE.Material): THREE.Material => {
    const orig = mt as THREE.MeshStandardMaterial;
    if (orig.name === "visera") { const v = new THREE.MeshBasicMaterial({ name: "visera", color: VISEIRA.cor, transparent: true, opacity: VISEIRA.opacidade, depthWrite: false }); return v; }
    const c = toon(orig.color.clone().multiplyScalar(DESENHO.clareia), { rim, rimForca: 0.5, brilho: orig.metalness > 0.2 ? 0.45 : 0.25 }); c.name = orig.name;
    return c;
  };
  const mats: (THREE.MeshToonMaterial | THREE.MeshBasicMaterial)[] = [];
  cena.traverse((o) => {
    o.frustumCulled = false;
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    m.material = Array.isArray(m.material) ? m.material.map(meu) : meu(m.material);
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.push(x as THREE.MeshToonMaterial);
  });
  const originais = new Map(mats.map((x) => [x, x.color.clone()] as const));
  const fonte = ossosMixamo(modelo), alvo = ossosMixamo(cena);
  const pares: { nome: string; s: THREE.Object3D; a: THREE.Object3D; sBindInv: THREE.Quaternion; aBind: THREE.Quaternion }[] = [];

  // a pose de BIND do Soldier (o esqueleto pode estar no meio de uma animação): guarda, põe em bind, mede, devolve
  let sk: THREE.Skeleton | null = null;
  modelo.traverse((x) => { if (!sk && (x as THREE.SkinnedMesh).isSkinnedMesh) sk = (x as THREE.SkinnedMesh).skeleton; });
  const salvos: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = [];
  for (const o of fonte.values()) salvos.push([o, o.position.clone(), o.quaternion.clone()]);
  (sk as THREE.Skeleton | null)?.pose();
  corpo.updateWorldMatrix(true, false); modelo.updateMatrixWorld(true);
  const corpoInv = new THREE.Matrix4().copy(corpo.matrixWorld).invert(), mt = new THREE.Matrix4(), tp = new THREE.Vector3(), ts = new THREE.Vector3();
  /** a rotação (e a posição) de `o` no referencial do corpo */
  const noCorpo = (o: THREE.Object3D, q: THREE.Quaternion, p: THREE.Vector3 = tp) => { mt.multiplyMatrices(corpoInv, o.matrixWorld).decompose(p, q, ts); return q; };

  // o astronauta no corpo: virado como o Soldier (o modelo do Mixamo olha pro +Z, o do avatar pro −Z) e na ESCALA em
  // que o quadril fica na altura do quadril do Soldier
  corpo.add(cena); cena.rotation.set(0, Math.PI, 0); cena.updateMatrixWorld(true);
  // (o astronauta também vai pra pose de BIND da skin — os ossos do arquivo podem estar noutra pose, ex. o 1º quadro do Idle)
  cena.traverse((x) => { const m = x as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.pose(); });
  cena.updateMatrixWorld(true);
  const qS = fonte.get("Hips"), qA = alvo.get("Hips");
  const hipS = new THREE.Vector3(), hipA = new THREE.Vector3();
  if (qS && qA) { noCorpo(qS, new THREE.Quaternion(), hipS); noCorpo(qA, new THREE.Quaternion(), hipA); }
  const escala = hipA.y > 0.05 ? hipS.y / hipA.y : 1;
  cena.scale.setScalar(escala); cena.updateMatrixWorld(true);
  if (qA) noCorpo(qA, new THREE.Quaternion(), hipA);
  cena.position.x += hipS.x - hipA.x; cena.position.z += hipS.z - hipA.z; cena.updateMatrixWorld(true);   // (o quadril em cima do quadril)
  if (qA) noCorpo(qA, new THREE.Quaternion(), hipA);
  // o REPOUSO em comum: o astronauta pode ter sido riggado noutra pose (pose A, braços pra baixo) e o Soldier em T —
  // cada osso do astronauta gira até apontar (pro filho) pra onde o do Soldier aponta no bind. A malha vai junto (é o
  // esqueleto dela): fica na mesma pose do Soldier, e daí pra frente o Δ de cada quadro vale igual nos dois
  const pS = new THREE.Vector3(), pS2 = new THREE.Vector3(), pA2 = new THREE.Vector3(), dS = new THREE.Vector3(), dA = new THREE.Vector3(), qR = new THREE.Quaternion(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion();
  for (const [nome, a] of alvo) {
    const s = fonte.get(nome); if (!s) continue;
    const filho = s.children.find((c) => (c as THREE.Bone).isBone && alvo.has(c.name.replace(/^mixamorig:?/, "")));
    if (!filho) continue;
    const fa = alvo.get(filho.name.replace(/^mixamorig:?/, ""))!;
    s.getWorldPosition(pS); filho.getWorldPosition(pS2); dS.subVectors(pS2, pS).normalize();
    a.updateWorldMatrix(true, true); a.getWorldPosition(pA2); fa.getWorldPosition(dA); dA.sub(pA2).normalize();
    if (dA.lengthSq() < 1e-8 || dS.lengthSq() < 1e-8) continue;
    qR.setFromUnitVectors(dA, dS); a.getWorldQuaternion(qW); a.parent!.getWorldQuaternion(qP);
    a.quaternion.copy(qP.invert().multiply(qR.multiply(qW))); a.updateWorldMatrix(false, true);
  }
  cena.updateMatrixWorld(true);
  for (const [nome, a] of alvo) {
    const s = fonte.get(nome); if (!s) continue;
    pares.push({ nome, s, a, sBindInv: noCorpo(s, new THREE.Quaternion()).invert(), aBind: noCorpo(a, new THREE.Quaternion()) });
  }
  const hipSBind = hipS.clone(), hipABind = hipA.clone();
  for (const [o, p, q] of salvos) { o.position.copy(p); o.quaternion.copy(q); }
  modelo.updateMatrixWorld(true);

  // o CONTORNO DE TINTA: pra cada malha com skin, a mesma geometria inflada (só as faces de trás) na MESMA skin. A
  // espessura é no espaço da geometria (o modelo está em cm, escalado): medida pela altura da malha no mundo
  const matTinta = (() => {
    let geoAlt = 0, mundoAlt = 0;
    cena.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return; m.geometry.computeBoundingBox(); geoAlt = Math.max(geoAlt, m.geometry.boundingBox!.max.y - m.geometry.boundingBox!.min.y); });
    mundoAlt = new THREE.Box3().setFromObject(cena).getSize(new THREE.Vector3()).y;
    return tintaFixa(DESENHO.tinta * (geoAlt > 0 && mundoAlt > 0 ? geoAlt / mundoAlt : 1));
  })();
  const comContorno: THREE.SkinnedMesh[] = [];
  cena.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh) comContorno.push(m); });
  for (const m of comContorno) {
    const t = new THREE.SkinnedMesh(m.geometry, matTinta); t.bind(m.skeleton, m.bindMatrix);
    t.position.copy(m.position); t.quaternion.copy(m.quaternion); t.scale.copy(m.scale); t.frustumCulled = false; m.parent!.add(t);
  }

  // a ÂNCORA dos olhos: filha da cabeça do astronauta, acima e à frente (medida no corpo, na pose de bind)
  const ancoraRosto = new THREE.Object3D(), cab = alvo.get("Head");
  if (cab) {
    const pCab = new THREE.Vector3(); cab.getWorldPosition(pCab);
    const frente = new THREE.Vector3(0, 0, -1).transformDirection(corpo.matrixWorld), cimaW = new THREE.Vector3(0, 1, 0).transformDirection(corpo.matrixWorld);
    const alvoW = pCab.addScaledVector(cimaW, OLHOS_NO_CAPACETE.cima).addScaledVector(frente, OLHOS_NO_CAPACETE.frente);
    cab.add(ancoraRosto); cab.updateWorldMatrix(true, false); ancoraRosto.position.copy(cab.worldToLocal(alvoW));
  }

  const qD = new THREE.Quaternion(), qPai = new THREE.Quaternion(), qAg = new THREE.Quaternion(), pAg = new THREE.Vector3();
  return {
    cena, ancoraRosto,
    pintar(p) {
      for (const x of mats) {
        if (x.name === "visera") continue;
        const o = originais.get(x)!, t = tons(p)?.find((e) => e.pedacos.some((k) => x.name.includes(k)));
        if (t) x.color.setHex(t.cor).multiplyScalar(DESENHO.clareia); else x.color.copy(o);
      }
    },
    atualizar() {
      corpo.updateWorldMatrix(true, false); corpoInv.copy(corpo.matrixWorld).invert(); modelo.updateMatrixWorld(true);
      // (na ordem da hierarquia: o pai do osso já está na pose nova quando o filho é calculado)
      for (const p of pares) {
        noCorpo(p.s, qAg, pAg);
        qD.copy(qAg).multiply(p.sBindInv);                     // Δ = quanto o osso do Soldier girou desde o bind
        const pai = p.a.parent!; pai.updateWorldMatrix(true, false);   // (até a raiz: o modelo tem ossos com nome REPETIDO — Spine2/Neck/Head — e o de verdade da cadeia não está nos pares)
        mt.multiplyMatrices(corpoInv, pai.matrixWorld).decompose(tp, qPai, ts);
        p.a.quaternion.copy(qPai.invert().multiply(qD.multiply(p.aBind)));   // local = pai⁻¹ · (Δ · bind)
        if (p.nome === "Hips") {   // o quadril DESLOCA (sentar, agachar, pousar): o mesmo tanto, na escala do astronauta
          const alvoP = hipABind.clone().add(pAg.sub(hipSBind));
          p.a.position.copy(alvoP.applyMatrix4(corpo.matrixWorld)); pai.worldToLocal(p.a.position);
        }
        p.a.updateMatrixWorld(false);
      }
    },
    visivel(on) { cena.visible = on; },
    dispose() {
      cena.removeFromParent();
      for (const x of mats) x.dispose(); matTinta.dispose();
    },
  };
}
