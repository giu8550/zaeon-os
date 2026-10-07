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
import { amostrarPose, duracaoClipe, envelopePouso, misturar, type Dir3, type Pose } from "@/lib/cyber/poses";
import { impactoDoPouso } from "@/lib/cyber/jet";
import { fasesDeContato, pisadasEntre } from "@/lib/cyber/audio";
import { clone as skClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { COR_LUZ } from "@/lib/cyber/cores";
import { MESA_DJ, PALCO } from "@/lib/cyber/ceu";

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

/** MONTADO numa moto voadora: o grupo do avatar vai no BANCO (o quadril encaixa ali) e mãos/pés são puxados por IK
 *  pros pontos da moto (mundo): punhos do guidão e pedaleiras. E = esquerda do piloto. */
export type Montado = { w: number; maoE: THREE.Vector3; maoD: THREE.Vector3; peE: THREE.Vector3; peD: THREE.Vector3 };

export type AvatarLuzHandle = {
  group: THREE.Group;
  /** meshes do corpo (raycast do clique). */
  meshes: THREE.Object3D[];
  /** Idle/Walk/Run em crossfade + neurônios + `sentado` (0..1) = na própria base: em pé no painel holográfico,
   *  DIGITANDO (braços baixos e pra frente, mãos batendo de leve) — a interação energética com as telas; aura pulsa.
   *  `meditando` (0..1) = descanso (vista de fora, antes de entrar): flutuando de pernas cruzadas, mãos nos joelhos.
   *  `pilotando` (0..1) = sentado no assento da cabine da nave: coxas na horizontal, canelas pra baixo, mãos nos manches.
   *  `jato` (0..1) = mochila a jato acesa (voando): as chamas dos dois propulsores crescem.
   *  `ar` = no ar de mochila: PLANANDO (jatos acesos: corpo inclinado pra frente quando anda, braços abertos pra trás,
   *  pernas dobradas) ou em QUEDA LIVRE (caindo rápido: braços pra cima, joelhos dobrados); ao tocar o chão, um
   *  agachamento curto de POUSO.
   *  `dj` (0..1) = na CABINE do DJ do lounge: tira o FONE do pescoço e põe na cabeça, mãos na controladora (a esquerda
   *  faz scratch, a direita mexe nos knobs e de vez em quando segura a concha pra ouvir a próxima), balançando no
   *  compasso (joelhos dobram, cabeça acena). */
  animar(o: { andando: boolean; correndo?: boolean; sentado?: number; meditando?: number; pilotando?: number; jato?: number; ar?: { vy: number; movendo: boolean } | null; montado?: Montado | null; dj?: number; dt: number; t: number }): void;
  /** quantas PISADAS (pé encostando no chão na animação de andar/correr) desde a última chamada — o som do passo
   *  sai no compasso do pé; `null` = avatar sem pés (sem o modelo): o engine usa a cadência fixa */
  passosNovos(): number | null;
  /** `facing` = atan2(dx, dz) do movimento (a conversão pro modelo é interna). */
  olharPara(facing: number): void;
  /** Troca a cor da armadura (cosmético / ordem canônica chegou depois). */
  recolorir(hex: string): void;
  dispose(): void;
};

/** quanto o corpo desce pra sentar no assento da cabine (quadril de pé ≈ 1 m → sentado ≈ 0,55 m) */
const SENTA_Y = 0.45;
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
  const pernas: { coxa: THREE.Bone; canela: THREE.Bone; pe: THREE.Object3D; dedo: THREE.Object3D | null; lado: 1 | -1 }[] = [];
  let lombar: THREE.Bone | null = null, pescoco: THREE.Object3D | null = null, cabeca: THREE.Object3D | null = null, alturaQuadril = 1.0;   // o tronco das poses capturadas
  let espinha: THREE.Object3D | null = null;   // a mochila acompanha o tronco (anda, senta, medita)
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
      if (low) return;   // celular: sem a casca de aura (é uma 2ª malha com skinning por avatar); a armadura já é emissiva
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
      const coxa = modelo.getObjectByName(`mixamorig${nome}UpLeg`) as THREE.Bone | undefined, canela = modelo.getObjectByName(`mixamorig${nome}Leg`) as THREE.Bone | undefined, pe = modelo.getObjectByName(`mixamorig${nome}Foot`);
      if (coxa && canela && pe) pernas.push({ coxa, canela, pe, dedo: modelo.getObjectByName(`mixamorig${nome}ToeBase`) ?? null, lado });
    }
    espinha = modelo.getObjectByName("mixamorigSpine2") ?? null;
    lombar = (modelo.getObjectByName("mixamorigSpine") as THREE.Bone | undefined) ?? null; pescoco = modelo.getObjectByName("mixamorigNeck") ?? null; cabeca = modelo.getObjectByName("mixamorigHead") ?? null;
    // altura do QUADRIL em pé (na pose de repouso): montado, o corpo desce isso pra o quadril cair no banco
    const quadril = modelo.getObjectByName("mixamorigHips");
    if (quadril) { grupo.updateMatrixWorld(true); alturaQuadril = quadril.getWorldPosition(new THREE.Vector3()).y - grupo.position.y; }
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(modelo);
      const cl = gltf.animations;
      idle = mixer.clipAction(achar(cl, /idle/i)!); walk = mixer.clipAction(achar(cl, /walk/i)!); run = mixer.clipAction(achar(cl, /run/i) ?? walk.getClip());
      idle.play(); walk.play(); run.play(); walk.setEffectiveWeight(0); run.setEffectiveWeight(0); idle.setEffectiveWeight(1);
    }
  }

  // MOCHILA A JATO nas costas (+z do grupo: a frente do modelo é o −z) com dois propulsores apontando pra baixo
  const mochila = new THREE.Group(); mochila.position.set(0, 1.22, 0.24); corpo.add(mochila);
  const matMochila = new THREE.MeshStandardMaterial({ color: 0x1a2440, roughness: 0.35, metalness: 0.55, emissive: armadura.clone().multiplyScalar(0.3), emissiveIntensity: 0.7 });
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.17), matMochila); mochila.add(caixa);
  const frisoMochila = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.01), new THREE.MeshBasicMaterial({ color: luz })); frisoMochila.position.z = 0.09; mochila.add(frisoMochila);
  const texJato = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(150,230,255,.8)"); gr.addColorStop(1, "rgba(60,140,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
  const jatos: { chama: THREE.Mesh; brilho: THREE.Sprite }[] = [];
  const BOCAL_Y = -0.29;
  for (const lado of [-1, 1]) {
    // bocais pequenos, logo abaixo da mochila
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.09, 12), matMochila); bocal.position.set(lado * 0.12, BOCAL_Y, 0.02); mochila.add(bocal);
    const chama = new THREE.Mesh(new THREE.ConeGeometry(0.042, 1, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    chama.rotation.x = Math.PI; chama.position.set(lado * 0.12, BOCAL_Y - 0.05, 0.02); chama.visible = false; mochila.add(chama);
    const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texJato, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); brilho.position.set(lado * 0.12, BOCAL_Y - 0.06, 0.02); brilho.visible = false; mochila.add(brilho);
    jatos.push({ chama, brilho });
  }
  // FONE DE OUVIDO do DJ: arco + 2 conchas com aro de luz; só aparece na cabine (sai do pescoço e sobe pra cabeça).
  //  Eixos locais: x = de uma orelha à outra, y = pra cima (o arco passa por cima da cabeça)
  const fone = new THREE.Group(); fone.visible = false; grupo.add(fone);
  const matFone = new THREE.MeshStandardMaterial({ color: 0x1a1f2e, roughness: 0.3, metalness: 0.5, emissive: armadura.clone().multiplyScalar(0.5), emissiveIntensity: 0.9 });
  const matLedFone = new THREE.MeshBasicMaterial({ color: luz, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const FONE_R = 0.12;
  fone.add(new THREE.Mesh(new THREE.TorusGeometry(FONE_R, 0.014, 6, 24, Math.PI), matFone));
  for (const sx of [-1, 1]) {
    const concha = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.05, 0.055, 16), matFone); concha.rotation.z = Math.PI / 2; concha.position.set(sx * FONE_R, -0.015, 0); fone.add(concha);
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.011, 4, 20), matLedFone); led.rotation.y = Math.PI / 2; led.position.set(sx * (FONE_R + 0.029), -0.015, 0); fone.add(led);
  }
  let tDj = 0;
  /** do DJ até onde as mãos pousam na mesa: a borda de trás da mesa + um pouco pra dentro (cai na controladora) */
  const DJ_ALCANCE = MESA_DJ.z - MESA_DJ.prof / 2 - PALCO.cabine.z + 0.17, DJ_MAO_Y = MESA_DJ.topo + 0.07, BPM_RAD = 2.1 * Math.PI * 2;
  let jatoS = 0, wAr = 0, wQueda = 0, wMov = 0, inclinaVoo = 0, estavaNoAr = false, tAr = 0, vyAr = 0, tPouso = -1, forcaPouso = 0;
  const PERNA = 0.95;   // comprimento da perna do avatar (m) — escala a altura do quadril das poses capturadas
  const DUR_POUSO = duracaoClipe("Jump_Land") * 0.8;

  // neurônios: ~240 em anel (raio 0.3–0.8, y 0.2–1.8), pulsando e girando devagar
  const n = low ? 80 : 150, np = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const y = 0.2 + Math.random() * 1.6, r = 0.3 + Math.random() * 0.5, a = Math.random() * 6.28; np[i * 3] = Math.cos(a) * r; np[i * 3 + 1] = y; np[i * 3 + 2] = Math.sin(a) * r; }
  const ng = new THREE.BufferGeometry(); ng.setAttribute("position", new THREE.BufferAttribute(np, 3));
  const neu = new THREE.Points(ng, new THREE.PointsMaterial({ size: 0.12, map: starTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: luz.clone().lerp(armadura, 0.3) }));
  grupo.add(neu);

  let alvo = 0, wWalk = 0, wRun = 0, pisadas = 0, uAnt = 0, acaoAnt: THREE.AnimationAction | null = null;
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), dirAlvo = new THREE.Vector3(), qPai = new THREE.Quaternion(), qOsso = new THREE.Quaternion(), qDelta = new THREE.Quaternion();
  /** as fases (0..1) do ciclo de andar/correr em que um pé encosta — medidas UMA vez da própria animação */
  const fasesPe = (() => {
    if (!mixer || !walk || !run || !idle || pernas.length < 2 || !gltf) return null;
    const medir = (a: THREE.AnimationAction) => {
      for (const x of [idle!, walk!, run!]) x.setEffectiveWeight(x === a ? 1 : 0);
      const d = a.getClip().duration, N = 64, alt: number[][] = pernas.map(() => []);
      for (let i = 0; i < N; i++) { mixer!.setTime(0); a.time = (d * i) / N; mixer!.update(0); grupo.updateMatrixWorld(true); const y0 = grupo.getWorldPosition(vA).y; pernas.forEach((o, k) => alt[k]!.push(o.pe.getWorldPosition(vB).y - y0)); }
      return fasesDeContato(alt);
    };
    const r = { walk: medir(walk), run: medir(run) };
    idle.setEffectiveWeight(1); walk.setEffectiveWeight(0); run.setEffectiveWeight(0); walk.time = run.time = idle.time = 0; mixer.update(0);
    return r;
  })();
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
  const frente = new THREE.Vector3(), lateral = new THREE.Vector3(), cima = new THREE.Vector3(0, 1, 0), cimaC = new THREE.Vector3(), qG = new THREE.Quaternion();
  const pN = new THREE.Vector3(), pH = new THREE.Vector3(), cimaH = new THREE.Vector3(), latH = new THREE.Vector3(), zH = new THREE.Vector3(), pF = new THREE.Vector3(), mBase = new THREE.Matrix4(), qCab = new THREE.Quaternion(), qPesc = new THREE.Quaternion(), qInv = new THREE.Quaternion(), alvoM = new THREE.Vector3(), pGr = new THREE.Vector3(), pConcha = new THREE.Vector3(), pesFixos = [new THREE.Vector3(), new THREE.Vector3()];
  const suave = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  const polo = new THREE.Vector3(), pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), eixo = new THREE.Vector3(), lado2 = new THREE.Vector3(), cot = new THREE.Vector3();
  /** IK de 2 ossos (ombro→cotovelo→mão / quadril→joelho→pé): leva a ponta até `alvo` (mundo), dobrando pro lado do
   *  `polo`; se não alcança, estica na direção do alvo. Usa o `apontar` (mistura com o peso `w`). */
  const ik = (raiz: THREE.Object3D, meio: THREE.Object3D, ponta: THREE.Object3D, alvo: THREE.Vector3, poloDir: THREE.Vector3, w: number) => {
    raiz.updateWorldMatrix(true, true);
    raiz.getWorldPosition(pA); meio.getWorldPosition(pB); ponta.getWorldPosition(pC);
    const l1 = pA.distanceTo(pB), l2 = pB.distanceTo(pC);
    eixo.copy(alvo).sub(pA); const dist = Math.min(Math.max(eixo.length(), 1e-3), l1 + l2 - 1e-3); eixo.normalize();
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    lado2.copy(poloDir).addScaledVector(eixo, -poloDir.dot(eixo)); if (lado2.lengthSq() < 1e-8) lado2.set(0, -1, 0); lado2.normalize();
    cot.copy(pA).addScaledVector(eixo, a).addScaledVector(lado2, h);   // onde o cotovelo/joelho tem que ficar
    dirAlvo.copy(cot).sub(pA).normalize(); apontar(raiz, meio, dirAlvo, w);
    meio.getWorldPosition(pB); dirAlvo.copy(alvo).sub(pB).normalize(); apontar(meio, ponta, dirAlvo, w);
  };
  return {
    group: grupo, meshes,
    animar({ andando, correndo, sentado = 0, meditando = 0, pilotando = 0, jato = 0, ar = null, montado = null, dj = 0, dt, t }) {
      const k = Math.min(1, dt * 8), corre = !!correndo && andando;
      wWalk += ((andando && !corre ? 1 : 0) - wWalk) * k; wRun += ((corre ? 1 : 0) - wRun) * k;
      if (mixer && idle && walk && run) { walk.setEffectiveWeight(wWalk); run.setEffectiveWeight(wRun); idle.setEffectiveWeight(Math.max(0, 1 - wWalk - wRun)); mixer.update(dt); }
      // PISADAS: o relógio da animação dominante (andar ou correr) cruzou a fase em que um pé encosta no chão
      if (walk && run && fasesPe) {
        const acao = wRun > wWalk ? run : walk, f = acao === run ? fasesPe.run : fasesPe.walk, u = (acao.time % acao.getClip().duration) / acao.getClip().duration;
        if (acao === acaoAnt && wWalk + wRun > 0.5 && !ar && sentado < 0.1 && !pilotando) pisadas += pisadasEntre(uAnt, u, f);
        acaoAnt = acao; uAnt = u;
      }
      let d = alvo - grupo.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      grupo.rotation.y += d * 0.15;
      // na base: em pé, levemente inclinado pro painel; meditando: abaixa (pernas cruzadas) e flutua devagar
      corpo.position.set(0, meditando * (-0.5 + (parado ? 0 : 0.06 * Math.sin(t * 1.1))) - SENTA_Y * pilotando - (montado ? alturaQuadril * montado.w : 0), 0); corpo.rotation.x = -0.07 * sentado + 0.08 * pilotando;
      if ((ossos.length || pernas.length) && pilotando > 0.02) {
        grupo.updateWorldMatrix(true, false); grupo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG); lateral.crossVectors(cima, frente).normalize();
        for (const o of pernas) {
          dirAlvo.copy(frente).multiplyScalar(1).addScaledVector(cima, -0.06).addScaledVector(lateral, 0.1 * o.lado).normalize(); apontar(o.coxa, o.canela, dirAlvo, pilotando);   // coxa: pra frente
          dirAlvo.copy(cima).multiplyScalar(-1).addScaledVector(frente, 0.2).normalize(); apontar(o.canela, o.pe, dirAlvo, pilotando);   // canela: pra baixo
        }
        for (const o of ossos) {
          dirAlvo.copy(cima).multiplyScalar(-0.8).addScaledVector(frente, 0.5).addScaledVector(lateral, 0.15 * o.lado).normalize(); apontar(o.braco, o.ante, dirAlvo, pilotando);
          dirAlvo.copy(frente).multiplyScalar(0.92).addScaledVector(cima, -0.15).addScaledVector(lateral, 0.05 * o.lado).normalize(); apontar(o.ante, o.mao, dirAlvo, pilotando);   // mãos nos manches
        }
      }
      if (montado && montado.w > 0.02 && (ossos.length || pernas.length)) {
        // MONTADO: tronco inclinado pra frente (moto esportiva) e mãos/pés no lugar por IK de 2 ossos
        grupo.updateWorldMatrix(true, false); grupo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG); lateral.crossVectors(cima, frente).normalize();
        if (lombar && pescoco) { dirAlvo.copy(frente).multiplyScalar(0.62).addScaledVector(cima, 0.78).normalize(); apontar(lombar, pescoco, dirAlvo, montado.w); }
        for (const o of pernas) {   // joelhos pra frente e um pouco pra fora (abraçando a moto)
          polo.copy(frente).addScaledVector(lateral, 0.35 * o.lado).addScaledVector(cima, 0.2);
          ik(o.coxa, o.canela, o.pe, o.lado > 0 ? montado.peE : montado.peD, polo, montado.w);
        }
        for (const o of ossos) {    // cotovelos pra fora e pra baixo
          polo.copy(lateral).multiplyScalar(0.7 * o.lado).addScaledVector(cima, -0.5).addScaledVector(frente, -0.2);
          ik(o.braco, o.ante, o.mao, o.lado > 0 ? montado.maoE : montado.maoD, polo, montado.w);
        }
      }
      if ((ossos.length || pernas.length) && meditando > 0.02) {
        grupo.updateWorldMatrix(true, false); grupo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG); lateral.crossVectors(cima, frente).normalize();   // lateral·lado = pra fora
        for (const o of pernas) {
          dirAlvo.copy(frente).multiplyScalar(0.8).addScaledVector(lateral, 0.55 * o.lado).addScaledVector(cima, -0.08).normalize();   // coxa: pra frente e pra fora
          apontar(o.coxa, o.canela, dirAlvo, meditando);
          dirAlvo.copy(lateral).multiplyScalar(-0.92 * o.lado).addScaledVector(frente, 0.3).addScaledVector(cima, -0.1).normalize();   // canela: cruza pro centro
          apontar(o.canela, o.pe, dirAlvo, meditando);
        }
        for (const o of ossos) {
          dirAlvo.copy(cima).multiplyScalar(-0.85).addScaledVector(lateral, 0.32 * o.lado).addScaledVector(frente, 0.25).normalize();   // braço: solto, um pouco aberto
          apontar(o.braco, o.ante, dirAlvo, meditando);
          dirAlvo.copy(frente).multiplyScalar(0.72).addScaledVector(cima, -0.45).addScaledVector(lateral, 0.28 * o.lado).normalize();   // antebraço: mãos nos joelhos
          apontar(o.ante, o.mao, dirAlvo, meditando);
        }
      }
      // ── VOO de mochila + POUSO com poses CAPTURADAS (Quaternius UAL, CC0): no ar = Jump_Loop; tocou o chão = Jump_Land
      //    (força pela velocidade da queda). Pernas e tronco vêm da captura; os braços ficam junto do corpo (nada de "T") ──
      const kv = Math.min(1, dt * 5);
      const caindo = !!ar && ar.vy < -3 && jato < 0.5, movendo = !!ar && ar.movendo && !caindo;
      wAr += ((ar ? 1 : 0) - wAr) * kv; wQueda += ((caindo ? 1 : 0) - wQueda) * kv; wMov += ((movendo ? 1 : 0) - wMov) * Math.min(1, dt * 3);
      if (ar) { tAr += dt; vyAr = ar.vy; } else tAr = 0;
      if (estavaNoAr && !ar) { tPouso = 0; forcaPouso = impactoDoPouso(vyAr); }   // tocou o chão
      estavaNoAr = !!ar;
      if (tPouso >= 0) { tPouso += dt * (1.5 - 0.5 * forcaPouso); if (tPouso > DUR_POUSO) tPouso = -1; }   // pousinho = mais rápido
      const wPouso = tPouso >= 0 && !ar ? envelopePouso(tPouso / DUR_POUSO) * (0.4 + 0.6 * forcaPouso) : 0;
      // inclinação do voo: andando no ar deita pra frente (~43°); pairando, levemente; caindo, um pouco pra trás
      inclinaVoo += ((ar ? (movendo ? -0.75 : caindo ? 0.1 : -0.12) : 0) - inclinaVoo) * Math.min(1, dt * 3);
      const aVoo = inclinaVoo * wAr, QUADRIL = 1.0;
      corpo.rotation.x += aVoo;
      corpo.position.z += -QUADRIL * Math.sin(aVoo); corpo.position.y += QUADRIL * (1 - Math.cos(aVoo));   // gira no QUADRIL
      const pAr: Pose | null = wAr > 0.02 ? amostrarPose("Jump_Loop", tAr * 0.8, true) : null;
      const pPouso: Pose | null = wPouso > 0.02 ? amostrarPose("Jump_Land", tPouso, false) : null;
      corpo.position.y += (pPouso ? pPouso.quadril * PERNA * wPouso / (0.4 + 0.6 * forcaPouso) * (0.5 + 0.5 * forcaPouso) : 0) + (parado ? 0 : 0.05 * Math.sin(t * 2.3)) * wAr * (1 - wQueda);
      if ((ossos.length || pernas.length) && (pAr || pPouso)) {
        // eixos do CORPO (já inclinado): as poses seguem a inclinação do voo
        corpo.updateWorldMatrix(true, false); corpo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG); cimaC.set(0, 1, 0).applyQuaternion(qG); lateral.crossVectors(cimaC, frente).normalize();   // lateral = esquerda
        const aplicar = (d: Dir3, osso: THREE.Object3D | null, filho: THREE.Object3D | null, w: number) => {
          if (!osso || !filho || w <= 0.01) return;
          dirAlvo.copy(frente).multiplyScalar(d[0]).addScaledVector(cimaC, d[1]).addScaledVector(lateral, d[2]).normalize(); apontar(osso, filho, dirAlvo, w);
        };
        const lado3 = (d: Dir3, lado: number): Dir3 => [d[0], d[1], d[2] * lado];
        if (pAr) {
          const ond = parado ? 0 : 0.07 * Math.sin(t * 3 + 1);
          aplicar(misturar(pAr.tronco, [0.12, 0.99, 0], 0.4), lombar, pescoco, wAr * 0.7);
          for (const o of pernas) {
            const E = o.lado > 0, c = pAr[E ? "coxaE" : "coxaD"], k = pAr[E ? "canelaE" : "canelaD"], pe = pAr[E ? "peE" : "peD"];
            // voando pra frente: as pernas vão juntas, "arrastando" atrás do corpo (com uma batidinha alternada)
            const cMov: Dir3 = [-0.12 + ond * o.lado, -0.99, 0.05 * o.lado], kMov: Dir3 = [-0.4, -0.92, 0];
            aplicar(misturar(lado3(misturar(c, [c[0], c[1], c[2] * 0.45], 0.6), 1), cMov, wMov), o.coxa, o.canela, wAr);
            aplicar(misturar(k, kMov, wMov), o.canela, o.pe, wAr);
            aplicar(misturar(pe, [0.3, -0.95, 0], wMov), o.pe, o.dedo, wAr * 0.8);
          }
          for (const o of ossos) {
            const E = o.lado > 0, bC = pAr[E ? "bracoE" : "bracoD"], aC = pAr[E ? "anteE" : "anteD"];
            // pairando: braços soltos junto do corpo, antebraço um pouco à frente; voando: ao longo do corpo, pra trás;
            // caindo: abertos pra equilibrar (mas dobrados, não em "T"); 20% da captura dá a assimetria natural
            const bPaira: Dir3 = [0.15, -0.92, 0.3 * o.lado], aPaira: Dir3 = [0.6, -0.7, 0.1 * o.lado];
            const bVoa: Dir3 = [-0.3, -0.93, 0.2 * o.lado], aVoa: Dir3 = [-0.4, -0.9, 0.1 * o.lado];
            const bCai: Dir3 = [0.2, 0.35, 0.75 * o.lado], aCai: Dir3 = [0.45, 0.65, 0.25 * o.lado];
            const b = misturar(misturar(misturar(bPaira, bVoa, wMov), bCai, wQueda), bC, 0.2), a = misturar(misturar(misturar(aPaira, aVoa, wMov), aCai, wQueda), aC, 0.2);
            aplicar(b, o.braco, o.ante, wAr); aplicar(a, o.ante, o.mao, wAr);
          }
        }
        if (pPouso) {   // IMPACTO: agacha (joelhos, tronco pra frente, quadril desce), braços pra equilibrar — tudo da captura
          aplicar(pPouso.tronco, lombar, pescoco, wPouso * 0.8);
          for (const o of pernas) { const E = o.lado > 0; aplicar(pPouso[E ? "coxaE" : "coxaD"], o.coxa, o.canela, wPouso); aplicar(pPouso[E ? "canelaE" : "canelaD"], o.canela, o.pe, wPouso); aplicar(pPouso[E ? "peE" : "peD"], o.pe, o.dedo, wPouso); }
          for (const o of ossos) { const E = o.lado > 0; aplicar(pPouso[E ? "bracoE" : "bracoD"], o.braco, o.ante, wPouso); aplicar(pPouso[E ? "anteE" : "anteD"], o.ante, o.mao, wPouso); }
        }
      }
      // ── DJ na cabine: fone (pescoço → cabeça), mãos na controladora por IK, balanço no compasso ──
      tDj = dj > 0.02 ? tDj + dt : 0;
      fone.visible = dj > 0.02 && !!cabeca && !!pescoco;
      if (fone.visible && cabeca && pescoco) {
        grupo.updateWorldMatrix(true, false); grupo.getWorldQuaternion(qG);
        frente.set(0, 0, -1).applyQuaternion(qG); lateral.crossVectors(cima, frente).normalize();   // lateral·lado = o lado da mão
        const mov = parado ? 0 : 1, fase = t * BPM_RAD, batida = 0.5 + 0.5 * Math.sin(fase);
        // balanço: o corpo desce no tempo (os pés ficam plantados: os joelhos dobram), gira de leve pros lados
        corpo.updateWorldMatrix(true, true);
        pernas.forEach((o, i) => o.pe.getWorldPosition(pesFixos[i]!));
        corpo.position.y -= dj * mov * 0.045 * batida; corpo.rotation.y = dj * mov * 0.06 * Math.sin(fase * 0.5);
        corpo.updateWorldMatrix(false, true);
        pernas.forEach((o, i) => { polo.copy(frente).addScaledVector(lateral, 0.15 * o.lado); ik(o.coxa, o.canela, o.pe, pesFixos[i]!, polo, dj); });
        // tronco debruçado na mesa
        if (lombar) { dirAlvo.copy(cima).multiplyScalar(0.95).addScaledVector(frente, 0.3 + 0.04 * batida * mov).normalize(); apontar(lombar, pescoco, dirAlvo, dj); }
        // cabeça: olha a mesa e ACENA no compasso; no "cue" inclina pro lado da concha
        const ciclo = (t % 8) / 8, cue = tDj > 1.3 ? suave((ciclo - 0.68) / 0.05) * (1 - suave((ciclo - 0.9) / 0.05)) * mov : 0;
        dirAlvo.copy(cima).addScaledVector(frente, 0.28 + 0.22 * mov * (0.5 + 0.5 * Math.sin(fase + 0.6))).addScaledVector(lateral, 0.25 * cue).normalize();
        apontar(pescoco, cabeca, dirAlvo, dj);
        // o fone: base no osso da cabeça (cima = pescoço→cabeça) — pondo: sobe do pescoço girando pra cima
        pescoco.getWorldPosition(pN); cabeca.getWorldPosition(pH); cimaH.copy(pH).sub(pN).normalize();
        latH.crossVectors(cimaH, frente).normalize(); zH.crossVectors(latH, cimaH).normalize();
        mBase.makeBasis(latH, cimaH, zH); qCab.setFromRotationMatrix(mBase);
        qPesc.setFromAxisAngle(latH, 1.45).multiply(qCab);   // no pescoço: o arco deitado pra trás (fone "pendurado")
        const pOn = suave((tDj - 0.15) / 0.85);
        pF.copy(pN).addScaledVector(cimaH, -0.02).addScaledVector(zH, -0.02).lerp(alvoM.copy(pH).addScaledVector(cimaH, 0.085).addScaledVector(zH, -0.005), pOn);
        fone.quaternion.copy(qInv.copy(qG).invert().multiply(qPesc.slerp(qCab, pOn)));
        fone.position.copy(grupo.worldToLocal(alvoM.copy(pF)));
        fone.scale.setScalar(Math.min(1, dj * 2));
        // mãos: pondo o fone → nas conchas (levam o fone pra cabeça); depois → na mesa (scratch / knobs / cue)
        const wFone = tDj < 1.25 ? 1 - suave((tDj - 0.95) / 0.3) : 0;
        grupo.getWorldPosition(pGr);   // (o `ik` usa pA/pB/pC por dentro)
        for (const o of ossos) {
          const esq = o.lado > 0;
          alvoM.copy(pGr).addScaledVector(frente, DJ_ALCANCE).addScaledVector(cima, DJ_MAO_Y).addScaledVector(lateral, (esq ? 0.34 : 0.24) * o.lado);
          if (esq) alvoM.addScaledVector(frente, 0.06 * mov * Math.sin(fase * 2)).addScaledVector(lateral, 0.03 * mov * Math.sin(fase * 2 + 1));   // scratch no disco
          else alvoM.addScaledVector(lateral, 0.035 * mov * Math.sin(t * 2.7)).addScaledVector(frente, 0.03 * mov * Math.cos(t * 2.7)).addScaledVector(cima, 0.03 * mov * Math.max(0, Math.sin(t * 1.3)));   // knobs/faders
          pConcha.copy(pF).addScaledVector(latH, (FONE_R + 0.03) * o.lado).addScaledVector(cimaH, -0.02);
          alvoM.lerp(pConcha, Math.max(wFone, esq ? 0 : cue));
          polo.copy(lateral).multiplyScalar(0.7 * o.lado).addScaledVector(cima, -0.6).addScaledVector(frente, -0.15);
          ik(o.braco, o.ante, o.mao, alvoM, polo, dj);
        }
      } else corpo.rotation.y = 0;
      // mochila presa às costas: segue o osso do tronco (em espaço do corpo), 0,22 m atrás
      if (espinha) { corpo.updateWorldMatrix(true, false); espinha.updateWorldMatrix(true, false); espinha.getWorldPosition(vA); corpo.worldToLocal(vA); mochila.position.set(vA.x, vA.y - 0.08, vA.z + 0.22); }
      // propulsores: chama + brilho crescem com o jato (suave; sem piscar)
      jatoS += (jato - jatoS) * Math.min(1, dt * 6);
      for (const j of jatos) {
        const on = jatoS > 0.02, tremor = parado ? 1 : 0.9 + 0.1 * Math.sin(t * 9 + j.chama.position.x * 20);
        j.chama.visible = j.brilho.visible = on;
        if (on) { const h = (0.12 + 0.26 * jatoS) * tremor; j.chama.scale.set(1, h, 1); j.chama.position.y = BOCAL_Y - 0.045 - h / 2; j.brilho.scale.setScalar(0.12 + 0.18 * jatoS); (j.brilho.material as THREE.SpriteMaterial).opacity = 0.45 + 0.4 * jatoS; }
      }
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
      matAura.opacity = 0.62 + Math.max(sentado, meditando, dj) * 0.25 * (0.5 + 0.5 * Math.sin(dj > Math.max(sentado, meditando) ? t * BPM_RAD : t * (meditando > sentado ? 0.9 : 2)));
      (neu.material as THREE.PointsMaterial).size = 0.1 + 0.05 * Math.sin(t * 2 + grupo.position.x);
      neu.rotation.y += dt * 0.5;
    },
    passosNovos() { if (!pernas.length) return null; const n = pisadas; pisadas = 0; return n; },
    olharPara(f) { alvo = f + Math.PI; },
    recolorir(hex) { armadura.set(hex); matArmadura.color.copy(armadura).multiplyScalar(0.5); matArmadura.emissive.copy(armadura); matMochila.emissive.copy(armadura).multiplyScalar(0.3); matFone.emissive.copy(armadura).multiplyScalar(0.5); (neu.material as THREE.PointsMaterial).color.copy(luz).lerp(armadura, 0.3); },
    dispose() {
      mixer?.stopAllAction(); matArmadura.dispose(); matViseira.dispose(); matAura.dispose(); ng.dispose(); (neu.material as THREE.Material).dispose();
      mochila.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mt = (m as { material?: THREE.Material }).material; if (mt && mt !== matArmadura) mt.dispose(); }); texJato.dispose();
      fone.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); matFone.dispose(); matLedFone.dispose();
      grupo.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !gltf) m.geometry.dispose(); });
      grupo.removeFromParent();
    },
  };
}
