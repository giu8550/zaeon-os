/**
 * AvatarLuz (Avatar3D do cyberespaço) — o "ser de luz" (HANDOFF lounge cósmico §1): CORPO HUMANO real (GLB rigado
 * com animações Idle/Walk/Run). É um ser de LUZ (aura clara em volta, viseira luminosa, neurônios) com ARMADURA de
 * uma cor (lib/cyber/cores: a sua é azul; as dos outros, outras cores — futuramente cosmético do perfil). Componente ISOLADO: trocar o asset (Ready Player Me/Mixamo self-hostado) é só trocar a URL
 * (`NEXT_PUBLIC_CYBER_AVATAR_GLB`), sem refatorar a cena. Vários avatares = `SkeletonUtils.clone` (um
 * AnimationMixer cada) — nunca `.clone()` cru.
 *
 * Convenção do modelo de referência (Soldier.glb): encara -Z em rotation 0 → o grupo gira para `facing + π`
 * (anti-moonwalk); `facing` aqui é `atan2(dx, dz)` da direção de movimento.
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { COR_LUZ } from "@/lib/cyber/cores";

/** Modelo de referência de teste (three.js examples). Em produção, hospede um GLB humano próprio e aponte a env. */
export const AVATAR_GLB_REFERENCIA = "https://threejs.org/examples/models/gltf/Soldier.glb";
export const avatarGlbUrl = (): string => process.env.NEXT_PUBLIC_CYBER_AVATAR_GLB || AVATAR_GLB_REFERENCIA;

let cache: { url: string; p: Promise<GLTF> } | null = null;
/** Carrega o GLB uma vez (todos os avatares clonam dele). */
export function carregarModeloAvatar(url = avatarGlbUrl()): Promise<GLTF> {
  if (cache?.url === url) return cache.p;
  const p = new GLTFLoader().loadAsync(url);
  cache = { url, p }; p.catch(() => { if (cache?.p === p) cache = null; });
  return p;
}

export type AvatarLuzHandle = {
  group: THREE.Group;
  /** meshes do corpo (raycast do clique). */
  meshes: THREE.Object3D[];
  /** Idle/Walk/Run em crossfade + neurônios + `sentado` (0..1) = na própria base: em pé no painel holográfico,
   *  DIGITANDO (braços baixos e pra frente, mãos batendo de leve) — a interação energética com as telas; aura pulsa. */
  animar(o: { andando: boolean; correndo?: boolean; sentado?: number; dt: number; t: number }): void;
  /** `facing` = atan2(dx, dz) do movimento (a conversão pro modelo é interna). */
  olharPara(facing: number): void;
  /** Troca a cor da armadura (cosmético / ordem canônica chegou depois). */
  recolorir(hex: string): void;
  dispose(): void;
};

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const achar = (clips: THREE.AnimationClip[], re: RegExp) => clips.find((c) => re.test(c.name)) ?? clips[0];

export function criarAvatarLuz(armaduraHex: string, starTex: THREE.Texture, low: boolean, gltf: GLTF | null): AvatarLuzHandle {
  const armadura = new THREE.Color(armaduraHex), luz = new THREE.Color(COR_LUZ), parado = reducedMotion();
  const grupo = new THREE.Group();
  const corpo = new THREE.Group(); grupo.add(corpo);   // sentar: inclina/abaixa o corpo; o grupo guarda posição/yaw
  const meshes: THREE.Object3D[] = [];
  const matArmadura = new THREE.MeshStandardMaterial({ color: armadura.clone().multiplyScalar(0.5), emissive: armadura, emissiveIntensity: 0.65, roughness: 0.4, metalness: 0.35 });
  const matViseira = new THREE.MeshBasicMaterial({ color: luz });                       // a "luz" do rosto
  // AURA: casca inflada (back-face, aditiva) em volta do corpo — o que faz dele um ser de luz
  const matAura = new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide });
  matAura.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += normalize(normal) * 0.05;"); };
  let mixer: THREE.AnimationMixer | null = null;
  // braços (rig mixamo do GLB): quando sentado, apontam pra tela — sem os ossos, só a aura pulsa
  const ossos: { braco: THREE.Bone; ante: THREE.Bone; mao: THREE.Object3D; lado: 1 | -1 }[] = [];
  let idle: THREE.AnimationAction | null = null, walk: THREE.AnimationAction | null = null, run: THREE.AnimationAction | null = null;

  if (gltf) {
    const modelo = skClone(gltf.scene);
    modelo.scale.setScalar(1.15);
    const cascas: THREE.Mesh[] = [];
    modelo.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      m.frustumCulled = false;
      if (/visor/i.test(m.name)) { m.material = matViseira; return; }   // viseira = luz; o resto = armadura
      m.material = matArmadura; meshes.push(m);
      const sk = m as THREE.SkinnedMesh;
      let casca: THREE.Mesh;
      if (sk.isSkinnedMesh) { const c = new THREE.SkinnedMesh(m.geometry, matAura); c.bind(sk.skeleton, sk.bindMatrix); casca = c; }
      else casca = new THREE.Mesh(m.geometry, matAura);
      casca.frustumCulled = false; casca.renderOrder = 2; cascas.push(casca); casca.userData.pai = m.parent;
    });
    for (const c of cascas) (c.userData.pai as THREE.Object3D).add(c);
    corpo.add(modelo);
    for (const [lado, nome] of [[1, "Left"], [-1, "Right"]] as const) {
      const braco = modelo.getObjectByName(`mixamorig${nome}Arm`) as THREE.Bone | undefined, ante = modelo.getObjectByName(`mixamorig${nome}ForeArm`) as THREE.Bone | undefined, mao = modelo.getObjectByName(`mixamorig${nome}Hand`);
      if (braco && ante && mao) ossos.push({ braco, ante, mao, lado });
    }
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(modelo);
      const cl = gltf.animations;
      idle = mixer.clipAction(achar(cl, /idle/i)!); walk = mixer.clipAction(achar(cl, /walk/i)!); run = mixer.clipAction(achar(cl, /run/i) ?? walk.getClip());
      idle.play(); walk.play(); run.play(); walk.setEffectiveWeight(0); run.setEffectiveWeight(0); idle.setEffectiveWeight(1);
    }
  }

  // neurônios: ~240 em anel (raio 0.3–0.8, y 0.2–1.8), pulsando e girando devagar
  const n = low ? 80 : 150, np = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const y = 0.2 + Math.random() * 1.6, r = 0.3 + Math.random() * 0.5, a = Math.random() * 6.28; np[i * 3] = Math.cos(a) * r; np[i * 3 + 1] = y; np[i * 3 + 2] = Math.sin(a) * r; }
  const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.BufferAttribute(np, 3));
  const neu = new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.12, map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: luz.clone().lerp(armadura, 0.3) }));
  grupo.add(neu);

  let alvo = 0, wWalk = 0, wRun = 0;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), dirAlvo = new THREE.Vector3(), qPai = new THREE.Quaternion(), qOsso = new THREE.Quaternion(), qDelta = new THREE.Quaternion();
  /** gira `osso` (em espaço de mundo) pra que o segmento osso→filho aponte pra `dir`, misturando com o pose da animação */
  const apontar = (osso: THREE.Object3D, filho: THREE.Object3D, dir: THREE.Vector3, w: number) => {
    osso.updateWorldMatrix(true, false); filho.updateWorldMatrix(false, false);
    osso.getWorldPosition(vA); filho.getWorldPosition(vB);
    const atual = vB.sub(vA).normalize();
    qDelta.setFromUnitVectors(atual, dir);
    osso.getWorldQuaternion(qOsso); osso.parent!.getWorldQuaternion(qPai);
    const alvoLocal = qPai.invert().multiply(qDelta.multiply(qOsso));
    osso.quaternion.slerp(alvoLocal, w);
    osso.updateWorldMatrix(false, true);
  };
  const frente = new THREE.Vector3(), lateral = new THREE.Vector3(), cima = new THREE.Vector3(0, 1, 0), qG = new THREE.Quaternion();
  return {
    group: grupo, meshes,
    animar({ andando, correndo, sentado = 0, dt, t }) {
      const k = Math.min(1, dt * 8), corre = !!correndo && andando;
      wWalk += ((andando && !corre ? 1 : 0) - wWalk) * k; wRun += ((corre ? 1 : 0) - wRun) * k;
      if (mixer && idle && walk && run) { walk.setEffectiveWeight(wWalk); run.setEffectiveWeight(wRun); idle.setEffectiveWeight(Math.max(0, 1 - wWalk - wRun)); mixer.update(dt); }
      let d = alvo - grupo.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      grupo.rotation.y += d * 0.15;
      corpo.position.y = 0; corpo.rotation.x = -0.07 * sentado;   // na base: em pé, levemente inclinado pro painel
      // interação energética (na base): DIGITANDO no painel — braços baixos e pra frente, mãos batendo alternado
      if (ossos.length && sentado > 0.02) {
        grupo.updateWorldMatrix(true, false); grupo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG);   // o grupo gira f+π (olharPara): a frente do modelo é o −z do grupo
        lateral.crossVectors(cima, frente).normalize();
        for (const o of ossos) {
          const tecla = parado ? 0 : 0.07 * Math.sin(t * 7 + (o.lado > 0 ? 0 : Math.PI)) + 0.03 * Math.sin(t * 11.3 + o.lado);
          // braço: desce rente ao corpo, um pouco à frente
          dirAlvo.copy(frente).multiplyScalar(0.55).addScaledVector(cima, -0.8).addScaledVector(lateral, 0.12 * o.lado).normalize();
          apontar(o.braco, o.ante, dirAlvo, sentado);
          // antebraço: pra frente, mãos sobre o painel
          dirAlvo.copy(frente).multiplyScalar(0.95).addScaledVector(cima, -0.34 + tecla).addScaledVector(lateral, -0.1 * o.lado).normalize();
          apontar(o.ante, o.mao, dirAlvo, sentado);
        }
      }
      matAura.opacity = 0.62 + sentado * 0.25 * (0.5 + 0.5 * Math.sin(t * 2));
      (neu.material as THREE.PointsMaterial).size = 0.1 + 0.05 * Math.sin(t * 2 + grupo.position.x);
      neu.rotation.y += dt * 0.5;
    },
    olharPara(f) { alvo = f + Math.PI; },
    recolorir(hex) { armadura.set(hex); matArmadura.color.copy(armadura).multiplyScalar(0.5); matArmadura.emissive.copy(armadura); (neu.material as THREE.PointsMaterial).color.copy(luz).lerp(armadura, 0.3); },
    dispose() {
      mixer?.stopAllAction(); matArmadura.dispose(); matViseira.dispose(); matAura.dispose(); ng.dispose(); (neu.material as THREE.Material).dispose();
      grupo.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !gltf) m.geometry.dispose(); });
      grupo.removeFromParent();
    },
  };
}
