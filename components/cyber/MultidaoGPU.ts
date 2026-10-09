/**
 * MultidaoGPU — a MULTIDÃO animada pela placa de vídeo (o truque da multidão do spiderbench, src/world/npc/crowd.js):
 * centenas de IAs da frota ANIMADAS (andando, sentadas, dançando, de moto…) em 2 draw calls (a armadura desenhada + o
 * contorno de tinta), no lugar das cápsulas.
 *
 * Como:
 *  1. ASSAR (uma vez): um avatar de verdade (components/cyber/AvatarLuz, o mesmo dos corpos completos) passa por cada
 *     POSE da frota (lib/cyber/frota/corpo `PoseIA`) com os MESMOS parâmetros que a FrotaIA usa; a cada quadro (15 por
 *     segundo) as matrizes dos ossos — já no referencial do avatar parado na origem, de frente pra +z — vão pra uma
 *     TEXTURA (largura = 4 texels por osso, altura = os quadros de todas as poses).
 *  2. DESENHAR: um InstancedMesh com a geometria do corpo (o visor junto, marcado por atributo); o vertex shader lê a
 *     pose do quadro da instância na textura (interpolando 2 quadros) e faz o skinning; a cor da armadura é a cor da
 *     instância (a do card da IA). Cada instância: a matriz (onde está, pra onde olha) + `aAnim` (quadro inicial, nº de
 *     quadros, fase, velocidade).
 * O contorno é a mesma malha, 2º grupo da geometria, com o material de tinta (casca invertida, espessura no espaço do
 * modelo como o materialTinta): 1 InstancedMesh, 2 draw calls, a mesma matriz/pose pras duas.
 */
import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { criarAvatarLuz, type Montado } from "./AvatarLuz";
import { criarMoto } from "./Moto";
import { texFaixas, corDesenho } from "./AvatarAnime";
import { FAIXAS_TOON, TINTA, espessuraTinta } from "@/lib/cyber/estiloAvatar";
import { COR_LUZ } from "@/lib/cyber/cores";
import type { PoseIA } from "@/lib/cyber/frota/corpo";

/** quadros por segundo da gravação e quantos quadros cada pose tem (os ciclos fecham: andar ~1,1 s, dança 4 s) */
export const FPS_ASSADO = 15;
const QUADROS: Record<PoseIA, number> = { parado: 30, andando: 17, mochila: 30, moto: 30, sentado: 30, deitado: 30, relaxa: 30, chao: 30, danca: 60 };
export const POSES_ASSADAS = Object.keys(QUADROS) as PoseIA[];

export type Clipe = { inicio: number; quadros: number };
export type MultidaoHandle = {
  malha: THREE.InstancedMesh;
  clipes: Record<PoseIA, Clipe>;
  /** a instância `i`: onde (pés no chão / no assento), pra onde olha (rumo), a pose, a cor (a do card), a fase (s) */
  colocar(i: number, x: number, y: number, z: number, rumo: number, pose: PoseIA, cor: THREE.Color, fase: number): void;
  /** quantas instâncias desenhar neste quadro (depois dos `colocar`) */
  fechar(n: number): void;
  /** o relógio da animação */
  atualizar(t: number): void;
  dispose(): void;
};

/** os parâmetros de `animar` de cada pose — os MESMOS da FrotaIA (components/cyber/FrotaIA, corpos completos) */
function estadoDaPose(p: PoseIA, montado: Montado | null) {
  const deitado = p === "deitado", sentar = p === "sentado" || p === "relaxa" ? 1 : 0;
  return {
    andando: p === "andando", correndo: false, montado: p === "moto" ? montado : null,
    jato: p === "mochila" ? 0.9 : 0, ar: p === "mochila" ? { vy: 0, movendo: true } : null,
    meditando: p === "chao" ? 1 : 0, danca: p === "danca" ? 1 : 0,
    descanso: { sentar, deitar: deitado ? 1 : 0, assentoY: 0.7, relaxa: p === "relaxa" ? 1 : 0 },
    tablet: 0,
  };
}

/** ASSA as poses: devolve a textura (RGBA float), a tabela de clipes, a geometria (corpo + visor) e a espessura da tinta */
function assar(gltf: GLTF, starTex: THREE.Texture) {
  const av = criarAvatarLuz("#ffffff", starTex, true, gltf, { anime: true });
  const raiz = new THREE.Group(); raiz.add(av.group);
  const corpos: THREE.SkinnedMesh[] = []; av.group.traverse((o) => { const s = o as THREE.SkinnedMesh; if (s.isSkinnedMesh && s.material && !(s.material as THREE.Material & { side: number }).side) corpos.push(s); });
  // o corpo: a malha com mais vértices que não seja casca (tinta/aura são BackSide); o visor: a outra do GLB
  const lista = corpos.filter((s) => s.geometry.attributes.skinIndex).sort((a, b) => b.geometry.attributes.position!.count - a.geometry.attributes.position!.count);
  const corpo = lista.find((s) => !/visor/i.test(s.name)) ?? lista[0]!, visor = lista.find((s) => /visor/i.test(s.name) && s !== corpo) ?? null;
  const esq = corpo.skeleton, nOssos = esq.bones.length, nSlots = nOssos + 1;   // +1: a MOCHILA (a matriz dela em cada quadro)
  // a moto (pra pose montada): na origem, de frente pra +z; o avatar no banco (como na FrotaIA)
  const moto = criarMoto({ cor: "#ffffff", low: true }); raiz.add(moto.group);
  const montado: Montado = { w: 1, maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  const total = POSES_ASSADAS.reduce((n, p) => n + QUADROS[p], 0);
  const dados = new Float32Array(nSlots * 4 * 4 * total);
  const clipes = {} as Record<PoseIA, Clipe>;
  const m = new THREE.Matrix4(), dt = 1 / FPS_ASSADO;
  let linha = 0, t = 0;
  for (const p of POSES_ASSADAS) {
    moto.group.visible = p === "moto";
    av.group.position.set(0, 0, 0);
    if (p === "moto") {
      moto.atualizar({ dt, t, voando: true, vel: 30, curva: 0 }); raiz.updateMatrixWorld(true);
      moto.assento.getWorldPosition(av.group.position);
      moto.pontos.maoE.getWorldPosition(montado.maoE); moto.pontos.maoD.getWorldPosition(montado.maoD); moto.pontos.peE.getWorldPosition(montado.peE); moto.pontos.peD.getWorldPosition(montado.peD);
    }
    av.olharPara(0);
    const est = estadoDaPose(p, montado);
    for (let k = 0; k < 45; k++) { t += dt; av.animar({ ...est, dt, t }); }   // entra na pose (os pesos sobem devagar)
    clipes[p] = { inicio: linha, quadros: QUADROS[p] };
    for (let q = 0; q < QUADROS[p]; q++, linha++) {
      t += dt; av.animar({ ...est, dt, t });
      raiz.updateMatrixWorld(true); esq.update();
      // a posição no mundo de um vértice = matrixWorld · bindMatrixInverse · Σ (osso · bindMatrix) · v (vale nos 2 modos de bind)
      for (let b = 0; b < nOssos; b++) {
        m.fromArray(esq.boneMatrices!, b * 16).multiply(corpo.bindMatrix).premultiply(corpo.bindMatrixInverse).premultiply(corpo.matrixWorld);
        m.toArray(dados, (linha * nSlots * 4 + b * 4) * 4);
      }
      av.mochila.matrixWorld.toArray(dados, (linha * nSlots * 4 + nOssos * 4) * 4);   // a mochila: rígida, no próprio referencial
    }
  }
  const tex = new THREE.DataTexture(dados, nSlots * 4, total, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  // a geometria: o corpo + o visor (levado pro bind do corpo) + `aVisor` (1 no visor)
  const so = (g: THREE.BufferGeometry, visorV: number) => {
    const out = new THREE.BufferGeometry();
    for (const k of ["position", "normal", "skinIndex", "skinWeight"]) {   // tudo em float (o GLB pode trazer índices em 16 bits e pesos normalizados em 8)
      const a = g.attributes[k]!, f = new Float32Array(a.count * a.itemSize);
      const ler = [a.getX, a.getY, a.getZ, a.getW].map((fn) => fn.bind(a));   // (intercalado não tem getComponent)
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = ler[c]!(i);
      out.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
    out.setAttribute("aVisor", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count).fill(visorV), 1));
    out.setAttribute("aFixa", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position!.count), 1));
    if (g.index) { const ix = g.index; out.setIndex(Array.from({ length: ix.count }, (_, i) => ix.getX(i))); }
    return out;
  };
  let geo = so(corpo.geometry, 0);
  if (visor) { const gv = visorNoCorpo(visor, corpo, raiz); if (gv) { const junta = juntar([geo, gv]); if (junta) geo = junta; } }
  { const gm = geoMochila(nOssos); const junta = juntar([geo, gm]); if (junta) geo = junta; }
  geo.computeBoundingBox(); const tam = geo.boundingBox!.getSize(new THREE.Vector3());
  const espessura = espessuraTinta(Math.max(tam.x, tam.y, tam.z));
  moto.dispose(); av.dispose();
  return { tex, clipes, geo, espessura, nOssos };
}

/** o VISOR tem um esqueleto PRÓPRIO (2 ossos): cada vértice vai pro osso equivalente do corpo (o de maior peso, peso 1)
 *  e é levado pro bind do corpo — T = (matriz do osso no corpo)⁻¹ · (matriz do osso no visor), com as matrizes de agora */
function visorNoCorpo(visor: THREE.SkinnedMesh, corpo: THREE.SkinnedMesh, raiz: THREE.Object3D): THREE.BufferGeometry | null {
  raiz.updateMatrixWorld(true); visor.skeleton.update(); corpo.skeleton.update();
  const daMalha = (s: THREE.SkinnedMesh, i: number) => new THREE.Matrix4().fromArray(s.skeleton.boneMatrices!, i * 16).multiply(s.bindMatrix).premultiply(s.bindMatrixInverse).premultiply(s.matrixWorld);
  const g = visor.geometry, n = g.attributes.position!.count, si = g.attributes.skinIndex!, sw = g.attributes.skinWeight!;
  const T = visor.skeleton.bones.map((b, j) => { const i = corpo.skeleton.bones.indexOf(b); return i < 0 ? null : { i, m: daMalha(corpo, i).invert().multiply(daMalha(visor, j)) }; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = new Float32Array(n * 4), pes = new Float32Array(n * 4);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  for (let k = 0; k < n; k++) {
    const pesoK = [sw.getX(k), sw.getY(k), sw.getZ(k), sw.getW(k)], ossoK = [si.getX(k), si.getY(k), si.getZ(k), si.getW(k)];
    let j = 0, w = -1; for (let c = 0; c < 4; c++) if (pesoK[c]! > w) { w = pesoK[c]!; j = ossoK[c]!; }
    const t = T[j]; if (!t) return null;
    const P = g.attributes.position!, N = g.attributes.normal!;
    v.set(P.getX(k), P.getY(k), P.getZ(k)).applyMatrix4(t.m).toArray(pos, k * 3);
    v.set(N.getX(k), N.getY(k), N.getZ(k)).applyMatrix3(nm.getNormalMatrix(t.m)).normalize().toArray(nor, k * 3);
    idx[k * 4] = t.i; pes[k * 4] = 1;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("skinIndex", new THREE.BufferAttribute(idx, 4)); out.setAttribute("skinWeight", new THREE.BufferAttribute(pes, 4));
  out.setAttribute("aVisor", new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  out.setAttribute("aFixa", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  out.setIndex(g.index ? Array.from(g.index.array as ArrayLike<number>) : [...Array(n).keys()]);
  return out;
}

/** a MOCHILA (as mesmas medidas da do AvatarLuz): caixa + 2 bocais na cor FIXA dela, o friso na cor da luz — tudo preso
 *  ao "osso" extra `slot` (a matriz da mochila gravada em cada quadro) */
const COR_MOCHILA = 0x2a3a66;
function geoMochila(slot: number): THREE.BufferGeometry {
  const pecas: { g: THREE.BufferGeometry; visor: number; fixa: number }[] = [{ g: new THREE.BoxGeometry(0.4, 0.5, 0.17), visor: 0, fixa: 1 }];
  for (const lado of [-1, 1]) { const b = new THREE.CylinderGeometry(0.035, 0.05, 0.09, 8); b.translate(lado * 0.12, -0.29, 0.02); pecas.push({ g: b, visor: 0, fixa: 1 }); }
  const f = new THREE.BoxGeometry(0.06, 0.42, 0.01); f.translate(0, 0, 0.09); pecas.push({ g: f, visor: 1, fixa: 0 });
  const gs = pecas.map(({ g, visor, fixa }) => {
    const n = g.attributes.position!.count, out = new THREE.BufferGeometry();
    out.setAttribute("position", g.attributes.position!); out.setAttribute("normal", g.attributes.normal!);
    const si = new Float32Array(n * 4), sw = new Float32Array(n * 4); for (let i = 0; i < n; i++) { si[i * 4] = slot; sw[i * 4] = 1; }
    out.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); out.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    out.setAttribute("aVisor", new THREE.Float32BufferAttribute(new Float32Array(n).fill(visor), 1));
    out.setAttribute("aFixa", new THREE.Float32BufferAttribute(new Float32Array(n).fill(fixa), 1));
    out.setIndex(g.index ? Array.from(g.index.array as ArrayLike<number>) : [...Array(n).keys()]);
    return out;
  });
  return juntar(gs)!;
}

/** junta 2 geometrias indexadas com os mesmos atributos (sem depender do BufferGeometryUtils pros atributos inteiros) */
function juntar(gs: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const out = new THREE.BufferGeometry(); let base = 0; const idx: number[] = [];
  for (const k of Object.keys(gs[0]!.attributes)) {
    const a0 = gs[0]!.attributes[k] as THREE.BufferAttribute, n = gs.reduce((s, g) => s + g.attributes[k]!.count, 0);
    const arr = new (a0.array.constructor as new (n: number) => THREE.TypedArray)(n * a0.itemSize); let o = 0;
    for (const g of gs) { const a = g.attributes[k] as THREE.BufferAttribute; arr.set(a.array as ArrayLike<number>, o); o += a.array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, a0.itemSize, a0.normalized));
  }
  for (const g of gs) { const n = g.attributes.position!.count; if (!g.index) return null; for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base); base += n; }
  out.setIndex(idx); return out;
}

/** o skinning da textura: `peleAgora()` = a matriz do vértice (4 ossos × 2 quadros interpolados) */
const PELE_PARS = /* glsl */ `
  uniform sampler2D uAnim; uniform float uTempo; uniform float uFps;
  attribute vec4 skinIndex; attribute vec4 skinWeight; attribute vec4 aAnim; attribute float aVisor; attribute float aFixa;
  varying float vVisor; varying float vFixa;
  mat4 ossoEm(float i, float q) { int x = int(i) * 4, y = int(q);
    return mat4(texelFetch(uAnim, ivec2(x, y), 0), texelFetch(uAnim, ivec2(x + 1, y), 0), texelFetch(uAnim, ivec2(x + 2, y), 0), texelFetch(uAnim, ivec2(x + 3, y), 0)); }
  mat4 peleNo(float q) { return ossoEm(skinIndex.x, q) * skinWeight.x + ossoEm(skinIndex.y, q) * skinWeight.y + ossoEm(skinIndex.z, q) * skinWeight.z + ossoEm(skinIndex.w, q) * skinWeight.w; }
  mat4 peleAgora() {
    float f = max(0.0, (uTempo * aAnim.w + aAnim.z) * uFps), q0 = mod(floor(f), aAnim.y), q1 = mod(q0 + 1.0, aAnim.y);
    mat4 a = peleNo(aAnim.x + q0), b = peleNo(aAnim.x + q1); float k = fract(f);
    return a * (1.0 - k) + b * k;
  }
`;

export function criarMultidao(o: { gltf: GLTF; starTex: THREE.Texture; max: number }): MultidaoHandle {
  const { tex, clipes, geo, espessura } = assar(o.gltf, o.starTex);
  const uni = { uAnim: { value: tex }, uTempo: { value: 0 }, uFps: { value: FPS_ASSADO }, uLuz: { value: new THREE.Color(COR_LUZ) }, uFixa: { value: corDesenho(new THREE.Color(COR_MOCHILA)) }, uEsp: { value: espessura } };
  // a ARMADURA desenhada (o mesmo toon dos corpos completos: 3 faixas, brilho recortado, borda na cor da luz) — a cor é
  // a da instância (vColor) e o visor sai na cor da luz
  const [s, mt] = FAIXAS_TOON.map((v) => (v / 255).toFixed(3));
  const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: texFaixas() });
  toon.defines = { PELE_NORMAL: "" };
  toon.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = PELE_PARS + sh.vertexShader
      .replace("#include <beginnormal_vertex>", "mat4 _pele = peleAgora(); vec3 objectNormal = normalize(mat3(_pele) * normal); vVisor = aVisor; vFixa = aFixa;")
      .replace("#include <begin_vertex>", "vec3 transformed = (_pele * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = "uniform vec3 uLuz; uniform vec3 uFixa; varying float vVisor; varying float vFixa;\n" + sh.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\n vec3 corInst = diffuseColor.rgb; diffuseColor.rgb = mix(diffuseColor.rgb, uFixa, step(0.5, vFixa));")   // a mochila tem cor própria
      .replace("#include <opaque_fragment>", `
      vec3 Ld = normalize(vec3(-0.45, 0.75, 0.5));
      float nl = dot(normal, Ld);
      float faixa = nl > 0.32 ? 1.0 : (nl > -0.2 ? ${mt} : ${s});
      vec3 V = normalize(vViewPosition);
      float brilho = step(0.94, max(dot(reflect(-Ld, normal), V), 0.0));
      float rimF = 1.0 - clamp(dot(normal, V), 0.0, 1.0);
      outgoingLight = diffuseColor.rgb * faixa + vec3(0.85) * brilho * 0.35 + uLuz * step(0.6, rimF) * 0.6 * (0.4 + 0.6 * faixa);
      // a mochila (materialToonSimples do AvatarLuz): as faixas sem a borda de luz + o brilho próprio na cor da armadura
      outgoingLight = mix(outgoingLight, diffuseColor.rgb * faixa + corInst * 0.2, step(0.5, vFixa));
      outgoingLight = mix(outgoingLight, uLuz, step(0.5, vVisor));
      #include <opaque_fragment>`);
  };
  toon.customProgramCacheKey = () => "multidao-toon-v2";
  // o CONTORNO de tinta: casca invertida, a espessura no espaço do modelo (antes do skinning, como o materialTinta)
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA.cor, side: THREE.BackSide });
  tinta.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = "uniform float uEsp;\n" + PELE_PARS + sh.vertexShader.replace("#include <begin_vertex>", "mat4 _pele = peleAgora(); vec3 transformed = (_pele * vec4(position + normalize(normal) * uEsp, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = diffuse;");   // a tinta não pega a cor da instância
  };
  tinta.customProgramCacheKey = () => "multidao-tinta-v1";
  // 2 grupos da MESMA faixa de índices: armadura e contorno (1 InstancedMesh, 2 draw calls)
  const n = geo.index!.count; geo.clearGroups(); geo.addGroup(0, n, 0); geo.addGroup(0, n, 1);
  const aAnim = new THREE.InstancedBufferAttribute(new Float32Array(o.max * 4), 4); aAnim.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("aAnim", aAnim);
  const malha = new THREE.InstancedMesh(geo, [toon, tinta], o.max);
  malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage); malha.count = 0; malha.frustumCulled = false; malha.name = "multidao-gpu";
  malha.setColorAt(0, new THREE.Color(1, 1, 1));
  const mI = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1), cI = new THREE.Color();
  return {
    malha, clipes,
    colocar(i, x, y, z, rumo, pose, cor, fase) {
      malha.setMatrixAt(i, mI.compose(p.set(x, y, z), q.setFromAxisAngle(eixo, rumo), um));
      malha.setColorAt(i, corDesenho(cor, cI));
      const c = clipes[pose]; aAnim.setXYZW(i, c.inicio, c.quadros, fase, 1);
    },
    fechar(k) {
      malha.count = k; malha.instanceMatrix.needsUpdate = true; if (malha.instanceColor) malha.instanceColor.needsUpdate = true; aAnim.needsUpdate = true;
      malha.instanceMatrix.clearUpdateRanges(); malha.instanceMatrix.addUpdateRange(0, k * 16);
      aAnim.clearUpdateRanges(); aAnim.addUpdateRange(0, k * 4);
      if (malha.instanceColor) { malha.instanceColor.clearUpdateRanges(); malha.instanceColor.addUpdateRange(0, k * 3); }
    },
    atualizar(t) { uni.uTempo.value = t; },
    dispose() { malha.removeFromParent(); geo.dispose(); toon.dispose(); tinta.dispose(); tex.dispose(); },
  };
}
