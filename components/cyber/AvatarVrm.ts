/**
 * AvatarVrm — um corpo ANIME de verdade (VRM: o formato dos personagens do VRoid Studio, com o sombreamento MToon
 * de anime, contorno e física de cabelo/roupa) no lugar do soldado do GLB.
 *
 * Como anima: o esqueleto mixamo do GLB CONTINUA fazendo tudo (Idle/Walk/Run + as poses do AvatarLuz: jato, moto
 * com IK, DJ, dança, prancha…), invisível. A cada quadro o VRM COPIA a pose dele (lib/cyber/vrmMapa): a rotação de
 * cada osso, medida como "quanto girou desde a pose de repouso (T)", vai pro osso humanoide normalizado do VRM — que
 * por definição tem repouso em T e eixos alinhados ao mundo. O quadril leva também o deslocamento (sentar, pousar).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMLoaderPlugin, VRMUtils, type VRM, type VRMHumanBoneName } from "@pixiv/three-vrm";
import { MIXAMO_PRO_VRM, ORDEM_VRM, paiExistente } from "@/lib/cyber/vrmMapa";
import { contornarMateriais, trocarJsonDoGlb } from "@/lib/cyber/vrmContorno";
import { respiracao, type PoseVrm } from "@/lib/cyber/posesVrm";

/** os BYTES do VRM, baixados uma vez por URL (o founder tem 16 MB): começar cedo (`precarregarVrm`) faz o corpo
 *  próprio já estar pronto quando o avatar nasce — sem aparecer o corpo padrão antes */
const bytes = new Map<string, Promise<ArrayBuffer>>();
export function precarregarVrm(url: string): Promise<ArrayBuffer> {
  let p = bytes.get(url);
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(`VRM ${r.status}: ${url}`); return r.arrayBuffer(); });
    bytes.set(url, p); p.catch(() => { if (bytes.get(url) === p) bytes.delete(url); });
  }
  return p;
}

/** carrega e prepara um VRM (uma instância por chamada — VRM não se clona com segurança), com o TRAÇO DE ANIME
 *  (lib/cyber/vrmContorno: o contorno MToon ligado/engrossado no arquivo antes da carga) */
export async function carregarVrm(url: string): Promise<VRM> {
  const loader = new GLTFLoader();
  loader.register((p) => new VRMLoaderPlugin(p));
  const dados = trocarJsonDoGlb(await precarregarVrm(url), (j) => contornarMateriais(j as never));   // (cópia: os bytes do cache ficam intactos)
  const gltf = await loader.parseAsync(dados, url.slice(0, url.lastIndexOf("/") + 1));
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error(`não é um VRM: ${url}`);
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);   // VRM 0.x olha pro −Z; o 1.0 pro +Z — deixa todos no padrão do 1.0
  vrm.scene.traverse((o) => { o.frustumCulled = false; });
  realcar(vrm);
  return vrm;
}

/** o MToon (o desenho do VRM) pinta com as luzes da cena — e o cyberespaço é escuro. A própria textura entra também
 *  como EMISSIVA (fraca): o personagem fica legível em qualquer canto, sem acender a cena toda */
const REALCE = 0.42;
function realcar(vrm: VRM) {
  vrm.scene.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      const mt = mat as THREE.Material & { map?: THREE.Texture | null; emissive?: THREE.Color; emissiveMap?: THREE.Texture | null; isOutline?: boolean };
      if (!mt.emissive || !mt.map || mt.isOutline) continue;   // o traço (contorno) fica tinta chapada
      mt.emissiveMap = mt.map; mt.emissive.setScalar(REALCE); mt.needsUpdate = true;
    }
  });
}

/** tinge peças do VRM pelo nome do material (os do VRoid: "…_Tops_01_CLOTH", "…_Bottoms_…", "…_Shoes_…"): a cor
 *  multiplica a textura (o moletom é branco → vira a cor) e a sombra do desenho (MToon) acompanha, mais escura */
export function tingirVrm(vrm: VRM, tintas: Readonly<Record<string, string>>) {
  vrm.scene.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if ((mat as { isOutline?: boolean }).isOutline) continue;   // o traço não se tinge
      const chave = Object.keys(tintas).find((k) => mat.name.includes(`_${k}_`)); if (!chave) continue;
      const c = new THREE.Color(tintas[chave]!), mt = mat as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color };
      mt.color?.copy(c); mt.shadeColorFactor?.copy(c).multiplyScalar(0.55);
      (mt as { emissive?: THREE.Color }).emissive?.copy(c).multiplyScalar(REALCE * 2);   // o realce na cor da peça (não clareia o preto)
    }
  });
}

export type EspelhoVrm = {
  atualizar(dt: number, t: number): void;
  /** uma POSE própria (lib/cyber/posesVrm) por cima da cópia do esqueleto — entra/sai suave; null = só a cópia */
  pose(p: PoseVrm | null): void;
  dispose(): void;
};
/** a pose de REPOUSO (T) do esqueleto mixamo, no referencial do `corpo` — medida ao criar o avatar, antes de qualquer
 *  animação (o VRM pode chegar depois, com o esqueleto já andando) */
export type Repouso = { q: Map<THREE.Object3D, THREE.Quaternion>; quadril: THREE.Vector3 };
export function medirRepouso(modelo: THREE.Object3D, corpo: THREE.Object3D): Repouso {
  corpo.updateWorldMatrix(true, false); modelo.updateMatrixWorld(true);
  const inv = corpo.matrixWorld.clone().invert(), m = new THREE.Matrix4(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const q = new Map<THREE.Object3D, THREE.Quaternion>(), quadril = new THREE.Vector3();
  for (const mx of Object.keys(MIXAMO_PRO_VRM)) {
    const o = modelo.getObjectByName(`mixamorig${mx}`); if (!o) continue;
    const r = new THREE.Quaternion(); m.multiplyMatrices(inv, o.matrixWorld).decompose(mx === "Hips" ? quadril : p, r, s); q.set(o, r);
  }
  return { q, quadril };
}

/** liga o VRM ao esqueleto mixamo `modelo` (já dentro do `corpo` do avatar, na pose de repouso). O VRM entra no
 *  `corpo` virado pro −Z (a frente do modelo) e na escala em que o quadril fica na mesma altura do quadril do GLB
 *  (o mundo foi medido com ele: assento, moto, cabine) */
export function espelharNoVrm(vrm: VRM, modelo: THREE.Object3D, corpo: THREE.Object3D, repouso: Repouso): EspelhoVrm {
  const H = vrm.humanoid;
  const no = (b: string) => H.getNormalizedBoneNode(b as VRMHumanBoneName);
  const existe = (b: string) => !!no(b);
  const osso = (n: string) => modelo.getObjectByName(`mixamorig${n}`) ?? null;

  // a pose de repouso do mixamo (medida na criação) e a do VRM, no referencial do `corpo`
  corpo.updateWorldMatrix(true, false); modelo.updateMatrixWorld(true);
  const corpoInv = new THREE.Matrix4(), m = new THREE.Matrix4(), tp = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
  const relativa = (o: THREE.Object3D, q: THREE.Quaternion, p?: THREE.Vector3) => { m.multiplyMatrices(corpoInv, o.matrixWorld).decompose(p ?? tp, q, ts); };
  corpoInv.copy(corpo.matrixWorld).invert();
  const fontes: { vrm: string; mx: THREE.Object3D; restoInv: THREE.Quaternion }[] = [];
  for (const [mx, v] of Object.entries(MIXAMO_PRO_VRM)) {
    const o = osso(mx), r = o && repouso.q.get(o); if (!o || !r || !existe(v)) continue;
    fontes.push({ vrm: v, mx: o, restoInv: r.clone().invert() });
  }
  const porVrm = new Map(fontes.map((f) => [f.vrm, f] as const));
  const quadrilMx = osso("Hips"), quadrilRepouso = repouso.quadril.clone();

  // o VRM no corpo: de frente pro −Z (gira π) e na escala do quadril
  vrm.scene.rotation.set(0, Math.PI, 0); vrm.scene.position.set(0, 0, 0); vrm.scene.scale.setScalar(1);
  corpo.add(vrm.scene); vrm.scene.updateMatrixWorld(true);
  const quadrilVrm = no("hips"), alturaVrm = quadrilVrm ? quadrilVrm.getWorldPosition(new THREE.Vector3()).applyMatrix4(corpoInv).y : 1;
  const escala = quadrilMx && alturaVrm > 0.1 ? quadrilRepouso.y / alturaVrm : 1;
  vrm.scene.scale.setScalar(escala);
  const hipsRepouso = quadrilVrm ? quadrilVrm.position.clone() : new THREE.Vector3();
  // de "girou no corpo" pra "girou no VRM" (o VRM está virado π em Y dentro do corpo): Δ' = R⁻¹ Δ R
  const R = new THREE.Quaternion().setFromEuler(vrm.scene.rotation), Rinv = R.clone().invert();

  const delta = new Map<string, THREE.Quaternion>(), ident = new THREE.Quaternion(), d = new THREE.Vector3();
  for (const b of ORDEM_VRM) if (existe(b)) delta.set(b, new THREE.Quaternion());
  let piscaT = 2 + Math.random() * 3, piscando = 0;
  let pose: PoseVrm | null = null, pesoPose = 0;
  const qPose = new THREE.Quaternion(), ePose = new THREE.Euler();

  return {
    atualizar(dt, t) {
      corpo.updateWorldMatrix(true, false); corpoInv.copy(corpo.matrixWorld).invert(); modelo.updateMatrixWorld(true);
      for (const b of ORDEM_VRM) {
        const n = no(b), q = delta.get(b); if (!n || !q) continue;
        const pai = paiExistente(b, existe), qPai = pai ? delta.get(pai)! : ident;
        const f = porVrm.get(b);
        if (f) { relativa(f.mx, q); q.multiply(f.restoInv); q.premultiply(Rinv).multiply(R); }   // Δ = Q_agora · Q_repouso⁻¹, no referencial do VRM
        else q.copy(qPai);                                                                          // osso sem fonte: acompanha o pai
        n.quaternion.copy(qPai).invert().multiply(q);                                               // local = Δ_pai⁻¹ · Δ
      }
      // o quadril também DESLOCA (sentar, agachar no pouso, montar na moto)
      if (quadrilMx && quadrilVrm) {
        relativa(quadrilMx, tq, d); d.sub(quadrilRepouso).applyQuaternion(Rinv).divideScalar(escala);
        quadrilVrm.position.copy(hipsRepouso).add(d);
      }
      // a POSE própria (personagens): sobrepõe a cópia osso a osso, com a respiração no peito
      pesoPose += ((pose ? 1 : 0) - pesoPose) * Math.min(1, dt * 4);
      if (pose && pesoPose > 0.001) {
        const resp = respiracao(pose, t);
        for (const [b, e] of Object.entries(pose.ossos)) {
          const n = no(b); if (!n) continue;
          ePose.set(e[0] + (b === "chest" ? resp : 0), e[1], e[2]); qPose.setFromEuler(ePose);
          n.quaternion.slerp(qPose, pesoPose);
        }
      }
      // piscar de vez em quando (a expressão "blink" do VRM)
      const ex = vrm.expressionManager;
      if (ex) {
        piscaT -= dt; if (piscaT <= 0) { piscando = 0.14; piscaT = 2.2 + Math.random() * 3.5; }
        if (piscando > 0) { piscando -= dt; ex.setValue("blink", Math.sin(Math.max(0, piscando / 0.14) * Math.PI)); } else ex.setValue("blink", 0);
      }
      vrm.update(dt);   // normalizado → ossos reais, física do cabelo/roupa (spring bones), expressões
    },
    pose(p) { pose = p; },
    dispose() { vrm.scene.removeFromParent(); },
  };
}
