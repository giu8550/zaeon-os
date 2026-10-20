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
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { MIXAMO_PRO_VRM } from "@/lib/cyber/vrmMapa";
import { PALETAS_FEMININAS } from "@/lib/cyber/personagem";

/** os MODELOS (public/avatars/traje — CREDITS.md): o masculino (riggado no Mixamo) e a feminina (a "Eve", riggada por
 *  scripts/avatar/rigar-eve.mjs). `olhos`: onde ficam os olhos do rosto VRM dentro do capacete, a partir do osso da
 *  cabeça (m, no corpo: pra cima e pra frente), e quanto o VRM encolhe pra cabeça de anime caber nele */
export const ASTRONAUTAS = {
  m: { url: "/avatars/traje/astronauta-m.glb", olhos: { cima: 0.085, frente: 0.05, escala: 0.86 } },
  f: { url: "/avatars/traje/astronauta-f.glb", olhos: { cima: 0.11, frente: 0.06, escala: 0.86 } },
} as const;
export type ModeloAstronauta = keyof typeof ASTRONAUTAS;
/** a VISEIRA (o material "visera" do modelo): escura, mas transparente o bastante pro rosto aparecer */
export const VISEIRA = { cor: 0x3a2a14, opacidade: 0.38 } as const;
/** o DESENHO: a espessura do contorno de tinta (m) e o quanto a cor clareia (o toon multiplica a cor pelas faixas: sem
 *  isso o branco vira cinza-chumbo na sombra — a mesma conta do avatar desenhado) */
export const DESENHO = { tinta: 0.011, clareia: 1.35 } as const;

/** as PALETAS da armadura: por pedaço do nome do material (os do modelo — scripts/avatar/astronauta-m.cores.json); a
 *  "branca" é a do arquivo. A PRETA é a do fundador (placas de preto brilhante, a malha grafite por baixo); os outros
 *  jogadores vestem a COR DELES (`#rrggbb` — a cor do jogador): as placas na cor, a malha e os tubos escuros */
export type Paleta = "branca" | "preta" | `#${string}` | `fem:${string}`;
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
// (a PERSONAGEM STANDARD FEMININA — as cores — mora em lib/cyber/personagem: o seletor e o servidor usam a mesma lista)
export { PALETAS_FEMININAS };
/** a paleta feminina mais próxima de uma cor (pelo matiz, e pela claridade nas cores sem matiz) */
export function paletaFeminina(hex: string): `fem:${string}` {
  const c = new THREE.Color(hex), h = { h: 0, s: 0, l: 0 }; c.getHSL(h);
  let melhor = PALETAS_FEMININAS[0]!, dm = Infinity;
  for (const p of PALETAS_FEMININAS) {
    if (p.nome === "eve") continue;
    const q = { h: 0, s: 0, l: 0 }; new THREE.Color(p.placa).getHSL(q);
    const dh = Math.min(Math.abs(h.h - q.h), 1 - Math.abs(h.h - q.h)), d = h.s < 0.15 ? Math.abs(h.l - q.l) + (q.s > 0.2 ? 0.5 : 0) : dh * 2 + Math.abs(h.s - q.s) * 0.3;
    if (d < dm) { dm = d; melhor = p; }
  }
  return `fem:${melhor.nome}`;
}
const tons = (p: Paleta): Tom[] | null => {
  if (p === "branca") return null;
  if (p === "preta") return PRETA;
  if (p.startsWith("fem:")) {
    const f = PALETAS_FEMININAS.find((x) => x.nome === p.slice(4)) ?? PALETAS_FEMININAS[0]!;
    return [{ pedacos: PLACAS, cor: f.placa }, { pedacos: ["covertura"], cor: f.malha }, { pedacos: ["tubos", "brazalete", "phongE", "lambert1"], cor: 0x141417 }];
  }
  return paletaDaCor(p);
};

const cache = new Map<string, Promise<GLTF>>();
export function carregarAstronauta(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) { p = new GLTFLoader().loadAsync(url); cache.set(url, p); p.catch(() => cache.delete(url)); }
  return p;
}

export type CorpoAstronautaHandle = {
  cena: THREE.Object3D;
  ancoraRosto: THREE.Object3D;
  /** as COSTAS do traje: presa no osso do peito, na superfície das costas (no meio da altura do peito), com os eixos do
   *  corpo (y pra cima, +z pra trás) e em metros — onde a mochila a jato encaixa */
  costas: THREE.Object3D | null;
  /** o modelo já tem MOCHILA própria (o masculino): aí só os propulsores vão nela */
  temMochila: boolean;
  /** pinta a armadura com uma paleta */
  pintar(p: Paleta): void;
  /** copia a pose do esqueleto do avatar (chamar depois de toda a animação/IK do quadro, antes do rosto VRM) */
  atualizar(): void;
  visivel(on: boolean): void;
  /** onde fica o REPULSOR da palma (mundo) — é dele que os poderes saem; null sem manopla */
  repulsor(lado: "direita" | "esquerda", out: THREE.Vector3): THREE.Vector3 | null;
  dispose(): void;
};

const ossosMixamo = (raiz: THREE.Object3D) => { const m = new Map<string, THREE.Object3D>(); raiz.traverse((o) => { if ((o as THREE.Bone).isBone && o.name.startsWith("mixamorig")) m.set(o.name.replace(/^mixamorig:?/, ""), o); }); return m; };

/** veste o astronauta no `corpo` do avatar, seguindo o esqueleto mixamo `modelo` */
export function vestirAstronauta(gltf: GLTF, modelo: THREE.Object3D, corpo: THREE.Object3D, op: {
  /** a cor do brilho de borda (a do jogador) */ rim?: string; olhos?: { cima: number; frente: number };
  /** copiar as ROTAÇÕES do corpo VRM (que tem a marcha e a pose femininas por cima do esqueleto) em vez das do Soldier;
   *  o deslocamento do quadril continua vindo do Soldier. Chamar `atualizar` DEPOIS do VRM no quadro */
  fonteVrm?: VRM;
} = {}): CorpoAstronautaHandle {
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
  const originais = new Map<THREE.Material, THREE.Color>(mats.map((x) => [x, x.color.clone()] as const));
  const fonte = ossosMixamo(modelo), alvo = ossosMixamo(cena);
  /** de onde vem a ROTAÇÃO de cada osso: o osso NORMALIZADO do VRM (quando há — o repouso dele é a pose T, como o do
   *  Soldier, com as rotações locais em identidade) ou o do Soldier */
  const vrm = op.fonteVrm, H = vrm?.humanoid, rigN = H?.normalizedHumanBonesRoot ?? null;
  const rotDe = (nome: string): THREE.Object3D | null => { const v = MIXAMO_PRO_VRM[nome]; const r = v && H ? H.getNormalizedBoneNode(v as VRMHumanBoneName) : null; return r ?? fonte.get(nome) ?? null; };
  /** (o rig normalizado não entra na passada de matrizes da cena — AvatarVrm: atualiza na mão) */
  const atualizarRigN = () => { if (rigN && vrm) { vrm.scene.updateMatrixWorld(false); THREE.Object3D.prototype.updateMatrixWorld.call(rigN, true); } };
  const pares: { nome: string; s: THREE.Object3D; a: THREE.Object3D; sBindInv: THREE.Quaternion; aBind: THREE.Quaternion }[] = [];

  // a pose de BIND do Soldier (o esqueleto pode estar no meio de uma animação): guarda, põe em bind, mede, devolve
  let sk: THREE.Skeleton | null = null;
  modelo.traverse((x) => { if (!sk && (x as THREE.SkinnedMesh).isSkinnedMesh) sk = (x as THREE.SkinnedMesh).skeleton; });
  const salvos: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = [];
  for (const o of fonte.values()) salvos.push([o, o.position.clone(), o.quaternion.clone()]);
  (sk as THREE.Skeleton | null)?.pose();
  // (o VRM também, quando é ele a fonte: o rig normalizado no REPOUSO — as rotações locais em identidade = a pose T)
  const salvosVrm: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = [];
  if (rigN) { rigN.traverse((b) => { if (b !== rigN) { salvosVrm.push([b, b.position.clone(), b.quaternion.clone()]); b.quaternion.identity(); } }); atualizarRigN(); }
  corpo.updateWorldMatrix(true, false); modelo.updateMatrixWorld(true);
  const corpoInv = new THREE.Matrix4().copy(corpo.matrixWorld).invert(), mt = new THREE.Matrix4(), tp = new THREE.Vector3(), ts = new THREE.Vector3();
  /** a rotação (e a posição) de `o` no referencial do corpo */
  const noCorpo = (o: THREE.Object3D, q: THREE.Quaternion, p: THREE.Vector3 = tp) => { mt.multiplyMatrices(corpoInv, o.matrixWorld).decompose(p, q, ts); return q; };

  // o astronauta no corpo: virado como o Soldier (o modelo do Mixamo olha pro +Z, o do avatar pro −Z), na escala dele
  corpo.add(cena); cena.rotation.set(0, Math.PI, 0); cena.updateMatrixWorld(true);
  // (o astronauta também vai pra pose de BIND da skin — os ossos do arquivo podem estar noutra pose, ex. o 1º quadro do Idle)
  cena.traverse((x) => { const m = x as THREE.SkinnedMesh; if (m.isSkinnedMesh) m.skeleton.pose(); });
  cena.updateMatrixWorld(true);
  const qS = fonte.get("Hips"), qA = alvo.get("Hips");
  const hipS = new THREE.Vector3(), hipA = new THREE.Vector3();
  if (qS && qA) { noCorpo(qS, new THREE.Quaternion(), hipS); noCorpo(qA, new THREE.Quaternion(), hipA); }
  // a ESCALA pela altura da CABEÇA (o rosto VRM vai nela; e um modelo de pernas curtas, escalado pelo quadril, virava
  // um gigante), com o quadril se não houver cabeça
  const cS = fonte.get("Head"), cA = alvo.get("Head"), headS = new THREE.Vector3(), headA = new THREE.Vector3();
  if (cS && cA) { noCorpo(cS, new THREE.Quaternion(), headS); noCorpo(cA, new THREE.Quaternion(), headA); }
  const escala = headA.y > 0.05 ? headS.y / headA.y : hipA.y > 0.05 ? hipS.y / hipA.y : 1;
  cena.scale.setScalar(escala); cena.updateMatrixWorld(true);
  if (qA) noCorpo(qA, new THREE.Quaternion(), hipA);
  cena.position.x += hipS.x - hipA.x; cena.position.z += hipS.z - hipA.z; cena.updateMatrixWorld(true);   // (o quadril em cima do quadril)
  if (qA) noCorpo(qA, new THREE.Quaternion(), hipA);
  // o REPOUSO em comum: o astronauta pode ter sido riggado noutra pose (pose A, braços pra baixo) e o Soldier em T —
  // cada osso dos BRAÇOS do astronauta gira até apontar (pro filho) pra onde o do Soldier aponta no bind. A malha vai junto (é o
  // esqueleto dela): fica na mesma pose do Soldier, e daí pra frente o Δ de cada quadro vale igual nos dois
  const pS = new THREE.Vector3(), pS2 = new THREE.Vector3(), pA2 = new THREE.Vector3(), dS = new THREE.Vector3(), dA = new THREE.Vector3(), qR = new THREE.Quaternion(), qW = new THREE.Quaternion(), qP = new THREE.Quaternion();
  for (const [nome, a] of alvo) {
    if (!/Shoulder|Arm|Hand/.test(nome)) continue;   // (só os BRAÇOS: o tronco já está em pé e as pernas têm o jeito delas — endireitar osso a osso entortava o tronco e amassava o quadril)
    const s = rotDe(nome); if (!s) continue;
    // o filho: o 1º osso filho do astronauta que também existe na fonte (a direção do osso = dele pro filho)
    const fa = a.children.find((c) => (c as THREE.Bone).isBone && rotDe(c.name.replace(/^mixamorig:?/, "")));
    if (!fa) continue;
    const filho = rotDe(fa.name.replace(/^mixamorig:?/, ""))!;
    s.getWorldPosition(pS); filho.getWorldPosition(pS2); dS.subVectors(pS2, pS).normalize();
    a.updateWorldMatrix(true, true); a.getWorldPosition(pA2); fa.getWorldPosition(dA); dA.sub(pA2).normalize();
    if (dA.lengthSq() < 1e-8 || dS.lengthSq() < 1e-8) continue;
    qR.setFromUnitVectors(dA, dS); a.getWorldQuaternion(qW); a.parent!.getWorldQuaternion(qP);
    a.quaternion.copy(qP.invert().multiply(qR.multiply(qW))); a.updateWorldMatrix(false, true);
  }
  cena.updateMatrixWorld(true);
  for (const [nome, a] of alvo) {
    const s = rotDe(nome); if (!s) continue;
    pares.push({ nome, s, a, sBindInv: noCorpo(s, new THREE.Quaternion()).invert(), aBind: noCorpo(a, new THREE.Quaternion()) });
  }
  const costas = medirCostas(alvo.get("Spine2") ?? alvo.get("Spine1") ?? null, cena, corpo, corpoInv);
  let temMochila = false; cena.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) for (const x of Array.isArray(m.material) ? m.material : [m.material]) if (/mochila/i.test(x.name)) temMochila = true; });
  const hipSBind = hipS.clone(), hipABind = hipA.clone();
  for (const [o, p, q] of [...salvos, ...salvosVrm]) { o.position.copy(p); o.quaternion.copy(q); }
  modelo.updateMatrixWorld(true); atualizarRigN();

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

  // as MANOPLAS: o punho blindado e a placa nas costas de cada mão (os dedos do modelo ficam), presos no osso da mão,
  // no desenho (toon + contorno de tinta)
  const luvas = vestirManoplas(alvo, rim, comContorno);
  for (const x of luvas.mats) { mats.push(x); originais.set(x, x.color.clone()); }

  // a ÂNCORA dos olhos: filha da cabeça do astronauta, acima e à frente (medida no corpo, na pose de bind)
  const ancoraRosto = new THREE.Object3D(), cab = alvo.get("Head");
  if (cab) {
    const pCab = new THREE.Vector3(); cab.getWorldPosition(pCab);
    const frente = new THREE.Vector3(0, 0, -1).transformDirection(corpo.matrixWorld), cimaW = new THREE.Vector3(0, 1, 0).transformDirection(corpo.matrixWorld);
    const olhos = op.olhos ?? ASTRONAUTAS.m.olhos, alvoW = pCab.addScaledVector(cimaW, olhos.cima).addScaledVector(frente, olhos.frente);
    cab.add(ancoraRosto); cab.updateWorldMatrix(true, false); ancoraRosto.position.copy(cab.worldToLocal(alvoW));
  }

  const qD = new THREE.Quaternion(), qPai = new THREE.Quaternion(), qAg = new THREE.Quaternion(), pAg = new THREE.Vector3();
  return {
    cena, ancoraRosto, costas, temMochila,
    pintar(p) {
      for (const x of mats) {
        if (x.name === "visera") continue;
        const o = originais.get(x)!, t = tons(p)?.find((e) => e.pedacos.some((k) => x.name.includes(k)));
        if (t) x.color.setHex(t.cor).multiplyScalar(DESENHO.clareia); else x.color.copy(o);
      }
    },
    atualizar() {
      corpo.updateWorldMatrix(true, false); corpoInv.copy(corpo.matrixWorld).invert(); modelo.updateMatrixWorld(true); atualizarRigN();
      // (na ordem da hierarquia: o pai do osso já está na pose nova quando o filho é calculado)
      for (const p of pares) {
        noCorpo(p.s, qAg, pAg);
        qD.copy(qAg).multiply(p.sBindInv);                     // Δ = quanto o osso do Soldier girou desde o bind
        const pai = p.a.parent!; pai.updateWorldMatrix(true, false);   // (até a raiz: o modelo tem ossos com nome REPETIDO — Spine2/Neck/Head — e o de verdade da cadeia não está nos pares)
        mt.multiplyMatrices(corpoInv, pai.matrixWorld).decompose(tp, qPai, ts);
        p.a.quaternion.copy(qPai.invert().multiply(qD.multiply(p.aBind)));   // local = pai⁻¹ · (Δ · bind)
        if (p.nome === "Hips") {   // o quadril DESLOCA (sentar, agachar, pousar): o mesmo tanto, na escala do astronauta
          if (qS && p.s !== qS) noCorpo(qS, qAg, pAg);   // (o deslocamento vem sempre do Soldier)
          const alvoP = hipABind.clone().add(pAg.sub(hipSBind));
          p.a.position.copy(alvoP.applyMatrix4(corpo.matrixWorld)); pai.worldToLocal(p.a.position);
        }
        p.a.updateMatrixWorld(false);
      }
    },
    visivel(on) { cena.visible = on; },
    repulsor(lado, out) { const r = luvas.repulsores[lado]; return r ? r.getWorldPosition(out) : null; },
    dispose() {
      cena.removeFromParent();
      for (const x of mats) x.dispose(); matTinta.dispose(); luvas.dispose();
    },
  };
}

/** as MANOPLAS do traje (m): o punho blindado (raio no pulso, na boca, comprimento), a placa nas costas da mão e o
 *  REPULSOR na palma (de onde saem os poderes) — os dedos do modelo ficam à mostra */
export const MANOPLA = { punho: { r: 0.042, boca: 0.05, comp: 0.075 }, placa: { larg: 0.034, comp: 0.036, esp: 0.01 } } as const;
function vestirManoplas(ossos: Map<string, THREE.Object3D>, rim: THREE.Color, malhas: THREE.SkinnedMesh[]) {
  const matPlaca = toon(new THREE.Color(0xeeeeee).multiplyScalar(DESENHO.clareia), { rim, rimForca: 0.5, brilho: 0.45 }); matPlaca.name = "armadura_manopla";
  const matFriso = toon(new THREE.Color(0x2a2a30).multiplyScalar(DESENHO.clareia), { rim, rimForca: 0.5, brilho: 0.45 }); matFriso.name = "tubos_manopla";
  const matTinta = tintaFixa(DESENHO.tinta * 0.7);
  const matLuz = new THREE.MeshBasicMaterial({ color: rim.clone().lerp(new THREE.Color(0xffffff), 0.45), side: THREE.DoubleSide });
  const repulsores: Partial<Record<"direita" | "esquerda", THREE.Object3D>> = {};
  const geos: THREE.BufferGeometry[] = [];
  const peca = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D) => {
    geos.push(g); const x = new THREE.Mesh(g, m); x.frustumCulled = false; pai.add(x);
    const t = new THREE.Mesh(g, matTinta); t.frustumCulled = false; x.add(t); return x;
  };
  const ws = new THREE.Vector3(), { punho: P, placa: L } = MANOPLA;
  for (const lado of ["Left", "Right"] as const) {
    const mao = ossos.get(`${lado}Hand`); if (!mao) continue;
    // os eixos no referencial do osso da mão, na pose de BIND alinhada à do Soldier (a pose T: palmas pra baixo, as
    // COSTAS da mão pra cima) — o modelo pode não ter o osso do polegar
    const meio = ossos.get(`${lado}HandMiddle1`) ?? ossos.get(`${lado}HandIndex1`);
    mao.updateWorldMatrix(true, false); mao.getWorldScale(ws);
    const qInv = mao.getWorldQuaternion(new THREE.Quaternion()).invert();
    const dLong = meio ? meio.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const dDorso = new THREE.Vector3(0, 1, 0).applyQuaternion(qInv); dDorso.addScaledVector(dLong, -dDorso.dot(dLong)).normalize();
    const dLado = new THREE.Vector3().crossVectors(dLong, dDorso).normalize();
    // o grupo: X = de lado, Y = pros dedos, Z = pras COSTAS da mão; na escala do MUNDO (o modelo é em cm)
    const g = new THREE.Group(); g.name = `manopla${lado}`;
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dLado, dLong, dDorso));
    g.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z); mao.add(g);
    // a MÃO DE VERDADE (cada modelo tem a sua — a da Eve é grande e grossa): os vértices presos no osso da mão, no
    // referencial do grupo (m) — dá o comprimento, as costas, a palma e a grossura do pulso
    const med = medirMao(mao, malhas, g.quaternion, ws.x);
    const k = med ? Math.max(0.8, Math.min(2.2, med.comp / 0.1)) : 1;   // (as peças crescem com a mão)
    const zCostas = med ? med.costas : 0.02, zPalma = med ? med.palma : -0.02, zc = med ? med.centro : 0, rPulso = Math.min(med ? med.pulso : P.r, P.r * k), yMeio = med ? med.comp * 0.32 : L.comp * 0.95;
    // o PUNHO blindado: um cone aberto que sobe pelo antebraço e abre na boca, com um friso escuro na borda
    const cano = peca(new THREE.CylinderGeometry(rPulso * 1.12, rPulso * 1.12 * (P.boca / P.r), P.comp * k, 20, 1, true), matPlaca, g); cano.position.set(0, -P.comp * k * 0.38, zc);
    (cano.material as THREE.Material).side = THREE.DoubleSide;
    const friso = peca(new THREE.TorusGeometry(rPulso * 1.12 * (P.boca / P.r) * 0.99, 0.005 * k, 6, 24), matFriso, g); friso.rotation.x = Math.PI / 2; friso.position.set(0, -P.comp * k * 0.88, zc);
    // a PLACA nas costas da mão (meia casca achatada) e a junta dos nós dos dedos
    const placa = peca(new THREE.SphereGeometry(1, 18, 12), matPlaca, g);
    placa.scale.set(L.larg * k, L.comp * k, L.esp * k); placa.position.set(0, yMeio, zCostas - L.esp * k * 0.35);
    const nos = peca(new THREE.CapsuleGeometry(0.008, L.larg * 1.1, 3, 8), matFriso, g); nos.rotation.z = Math.PI / 2; nos.scale.setScalar(k); nos.position.set(0, yMeio + L.comp * k * 0.75, zCostas - 0.004 * k);
    // o REPULSOR na palma (como a manopla do Homem de Ferro): é dele que os poderes saem — um anel escuro com o
    // núcleo aceso na cor da luz do jogador
    const anel = peca(new THREE.CylinderGeometry(0.017, 0.019, 0.008, 18), matFriso, g); anel.rotation.x = Math.PI / 2; anel.scale.setScalar(k); anel.position.set(0, yMeio, zPalma + 0.002 * k);
    const nucleo = new THREE.Mesh(new THREE.CircleGeometry(0.012, 18), matLuz); geos.push(nucleo.geometry); nucleo.rotation.x = Math.PI; nucleo.scale.setScalar(k); nucleo.position.set(0, yMeio, zPalma - 0.0025 * k); g.add(nucleo);
    repulsores[lado === "Right" ? "direita" : "esquerda"] = nucleo;
  }
  return { mats: [matPlaca, matFriso], repulsores, dispose() { matTinta.dispose(); matLuz.dispose(); for (const x of geos) x.dispose(); } };
}

/** os vértices pesados no osso `mao` (peso > 0,4), no referencial do grupo (rotação `q` em relação ao osso, `ws` = a
 *  escala do osso no mundo): o comprimento (m, pros dedos), as COSTAS (+z máx. no meio da mão), a PALMA (−z mín.) e o
 *  raio do pulso */
function medirMao(mao: THREE.Object3D, malhas: THREE.SkinnedMesh[], q: THREE.Quaternion, ws: number) {
  const qi = q.clone().invert(), v = new THREE.Vector3(), pts: THREE.Vector3[] = [];
  for (const m of malhas) {
    const i = m.skeleton.bones.indexOf(mao as THREE.Bone); if (i < 0) continue;
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    if (!pos || !si || !sw) continue;
    const inv = m.skeleton.boneInverses[i]!;
    for (let j = 0; j < pos.count; j++) {
      let w = 0; for (let c = 0; c < 4; c++) if (si.getComponent(j, c) === i) w += sw.getComponent(j, c);
      if (w < 0.4) continue;
      v.fromBufferAttribute(pos, j).applyMatrix4(m.bindMatrix).applyMatrix4(inv).applyQuaternion(qi).multiplyScalar(ws);
      pts.push(v.clone());
    }
  }
  if (pts.length < 12) return null;
  // (percentis, não extremos: o polegar e os vértices soltos da costura não contam)
  const pct = (xs: number[], f: number) => { const o = [...xs].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.max(0, Math.round(f * (o.length - 1))))]!; };
  const comp = pct(pts.map((p) => p.y), 0.97);
  const meio = pts.filter((p) => p.y > comp * 0.15 && p.y < comp * 0.5);
  if (meio.length < 6) return null;
  const costas = pct(meio.map((p) => p.z), 0.9), palma = pct(meio.map((p) => p.z), 0.1), zc = (costas + palma) / 2;
  const punho = pts.filter((p) => p.y > -comp * 0.05 && p.y < comp * 0.1);
  return { comp, costas, palma, centro: zc, pulso: punho.length >= 6 ? pct(punho.map((p) => Math.hypot(p.x, p.z - zc)), 0.85) : MANOPLA.punho.r };
}

/** a âncora das COSTAS (ver `costas` no handle): os vértices presos no osso do peito (peso > 0,4), no referencial do
 *  corpo — o ponto mais de trás na faixa do meio da altura deles. Chamar com o astronauta na pose de bind */
function medirCostas(osso: THREE.Object3D | null, cena: THREE.Object3D, corpo: THREE.Object3D, corpoInv: THREE.Matrix4): THREE.Object3D | null {
  if (!osso) return null;
  cena.updateMatrixWorld(true);
  const v = new THREE.Vector3(), pts: THREE.Vector3[] = [];
  cena.traverse((o) => {
    const m = o as THREE.SkinnedMesh; if (!m.isSkinnedMesh) return;
    const i = m.skeleton.bones.indexOf(osso as THREE.Bone); if (i < 0) return;
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    if (!pos || !si || !sw) return;
    const inv = m.skeleton.boneInverses[i]!;
    for (let j = 0; j < pos.count; j++) {
      let w = 0; for (let c = 0; c < 4; c++) if (si.getComponent(j, c) === i) w += sw.getComponent(j, c);
      if (w < 0.4) continue;
      pts.push(v.fromBufferAttribute(pos, j).applyMatrix4(m.bindMatrix).applyMatrix4(inv).applyMatrix4(osso.matrixWorld).applyMatrix4(corpoInv).clone());
    }
  });
  if (pts.length < 12) return null;
  const ys = pts.map((p) => p.y).sort((a, b) => a - b), yM = ys[Math.floor(ys.length / 2)]!, faixa = pts.filter((p) => Math.abs(p.y - yM) < 0.06 && Math.abs(p.x) < 0.08);
  const zs = (faixa.length ? faixa : pts).map((p) => p.z).sort((a, b) => a - b), z = zs[Math.floor(zs.length * 0.95)]!;
  const a = new THREE.Object3D(); a.name = "costasTraje";
  const pW = new THREE.Vector3(0, yM, z).applyMatrix4(corpo.matrixWorld);
  osso.add(a); a.position.copy(osso.worldToLocal(pW));
  const qOsso = osso.getWorldQuaternion(new THREE.Quaternion()), qCorpo = corpo.getWorldQuaternion(new THREE.Quaternion()), ws = osso.getWorldScale(new THREE.Vector3());
  a.quaternion.copy(qOsso.invert().multiply(qCorpo)); a.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  return a;
}
