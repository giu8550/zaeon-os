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
import { SimplifyModifier } from "three/examples/jsm/modifiers/SimplifyModifier.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { criarAvatarLuz, type Montado } from "./AvatarLuz";
import { criarMoto } from "./Moto";
import { texFaixas, corDesenho } from "./AvatarAnime";
import { FAIXAS_TOON, TINTA, espessuraTinta } from "@/lib/cyber/estiloAvatar";
import { COR_LUZ } from "@/lib/cyber/cores";
import type { PoseIA } from "@/lib/cyber/frota/corpo";
import { ASTRONAUTAS, carregarAstronauta, type ModeloAstronauta } from "./CorpoAstronauta";

/** quadros por segundo da gravação e quantos quadros cada pose tem (os ciclos fecham: andar ~1,1 s, dança 4 s) */
export const FPS_ASSADO = 15;
const QUADROS: Record<PoseIA, number> = { parado: 30, andando: 17, mochila: 30, moto: 30, sentado: 30, deitado: 30, relaxa: 30, chao: 30, danca: 60 };
export const POSES_ASSADAS = Object.keys(QUADROS) as PoseIA[];

export type Clipe = { inicio: number; quadros: number };
export type MultidaoHandle = {
  /** os 2 níveis de detalhe (perto: a malha inteira; longe: a simplificada) — num grupo só */
  malha: THREE.Group;
  clipes: Record<PoseIA, Clipe>;
  /** começa o quadro (zera as listas) */
  comecar(): void;
  /** mais uma IA: onde (pés no chão / no assento), pra onde olha (rumo), a pose, a cor (a do card), a fase (s) e se está
   *  LONGE (vai pra malha simplificada); devolve false se a lista daquele nível encheu */
  adicionar(x: number, y: number, z: number, rumo: number, pose: PoseIA, cor: THREE.Color, fase: number, longe: boolean): boolean;
  /** fecha o quadro (sobe só as instâncias vivas) */
  fechar(): void;
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

/** o TOM de cada pedaço do traje (pelo nome do material — os do modelo: scripts/avatar/astronauta-m.cores.json):
 *  0 = as PLACAS (na cor da IA), 1 = a malha por baixo (a cor escurecida), 2 = tubos/braçadeiras (quase preto), 3 = a
 *  viseira (vidro escuro) */
const TONS_TRAJE: Record<string, number> = { pechera: 0, hombrera: 0, placa_pelvis: 0, placa_piernas: 0, casco: 0, mochila: 0, cinturon: 0, armadura: 0, covertura: 1, tubos: 2, brazalete: 2, phongE: 2, lambert1: 2, visera: 3 };
const tomDoTraje = (nome: string) => { for (const [k, v] of Object.entries(TONS_TRAJE)) if (nome.includes(k)) return v; return -1; };
/** veste um avatar de bake com o TRAJE (o masculino — o do dono — ou o feminino) e espera o modelo chegar */
async function vestidoDeTraje(gltf: GLTF, starTex: THREE.Texture, modelo: ModeloAstronauta) {
  await carregarAstronauta(ASTRONAUTAS[modelo].url);
  const av = criarAvatarLuz("#ffffff", starTex, true, gltf, { anime: true });
  av.traje(true, { paleta: "branca", modelo });
  const pecas = () => { const out: THREE.SkinnedMesh[] = []; av.group.traverse((o) => { const s = o as THREE.SkinnedMesh; if (s.isSkinnedMesh && tomDoTraje((s.material as THREE.Material).name ?? "") >= 0) out.push(s); }); return out; };
  for (let k = 0; k < 120 && !pecas().length; k++) await new Promise((r) => setTimeout(r, 16));
  if (!pecas().length) { av.dispose(); throw new Error(`o traje ${modelo} não chegou`); }
  return { av, pecas: pecas() };
}

/** ASSA as poses: devolve a textura (RGBA float), a tabela de clipes, a geometria (corpo + visor) e a espessura da tinta.
 *  Com `traje`: assa os ossos da ARMADURA (o avatar já vestido) em vez do corpo de sempre */
type Assado = { tex: THREE.DataTexture; clipes: Record<PoseIA, Clipe>; geo: THREE.BufferGeometry; geoLonge: THREE.BufferGeometry; espessura: number; nOssos: number };
function assar(gltf: GLTF, starTex: THREE.Texture): Assado {
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
  const corpoG = so(corpo.geometry, 0), extras: THREE.BufferGeometry[] = [];
  if (visor) { const gv = visorNoCorpo(visor, corpo, raiz); if (gv) extras.push(gv); }
  extras.push(geoMochila(nOssos));
  const geo = juntar([corpoG, ...extras]) ?? corpoG;
  // o nível LONGE: o corpo simplificado (~40% dos vértices); visor e mochila já são leves e vão inteiros
  const simples = simplificar(corpoG, 0.4), geoLonge = (simples && juntar([simples, ...extras])) ?? geo;
  geo.computeBoundingBox(); const tam = geo.boundingBox!.getSize(new THREE.Vector3());
  const espessura = espessuraTinta(Math.max(tam.x, tam.y, tam.z));
  moto.dispose(); av.dispose();
  return { tex, clipes, geo, geoLonge, espessura, nOssos };
}

/** ASSA o TRAJE: os pedaços (centenas de malhas, cada uma num material) juntados por ESQUELETO numa geometria só, com o
 *  tom de cada vértice; os ossos de cada esqueleto em fatias da textura (+ a mochila, no feminino — o masculino tem a dele) */
const ceder = () => new Promise<void>((r) => setTimeout(r, 0));
async function assarTraje(av: ReturnType<typeof criarAvatarLuz>, pecas: THREE.SkinnedMesh[], modelo: ModeloAstronauta) {
  const raiz = new THREE.Group(); raiz.add(av.group);
  // os GRUPOS: a mesma geometria-base (os mesmos vértices) e o mesmo esqueleto
  type Grupo = { base: THREE.SkinnedMesh; malhas: THREE.SkinnedMesh[]; slot: number };
  const grupos: Grupo[] = [];
  // (o mesmo ARRAY de vértices, os mesmos OSSOS e o mesmo bind — cada pedaço clonado tem o seu objeto de esqueleto, mas os
  //  ossos são os mesmos: por objeto, as ~500 peças do traje masculino viravam 500 grupos e 26 mil ossos na textura)
  const mesmo = (a: THREE.SkinnedMesh, b: THREE.SkinnedMesh) => a.geometry.attributes.position!.array === b.geometry.attributes.position!.array && a.skeleton.bones.length === b.skeleton.bones.length && a.skeleton.bones.every((o, i) => o === b.skeleton.bones[i]) && a.bindMatrix.equals(b.bindMatrix);
  for (const p of pecas) { const g = grupos.find((x) => mesmo(x.base, p)); if (g) g.malhas.push(p); else grupos.push({ base: p, malhas: [p], slot: 0 }); }
  let nSlots = 0; for (const g of grupos) { g.slot = nSlots; nSlots += g.base.skeleton.bones.length; }
  // (só os OSSOS importam pro assado: as centenas de malhas do traje saem da cena — senão cada quadro recalculava todas)
  for (const g of grupos) for (const s of g.malhas) if (s !== g.base) s.removeFromParent();
  av.group.traverse((x) => { if ((x as THREE.Mesh).isMesh && !grupos.some((g) => g.base === x)) x.visible = false; });
  const slotMochila = nSlots; nSlots += 1;
  const total = POSES_ASSADAS.reduce((n, p) => n + QUADROS[p], 0), dados = new Float32Array(nSlots * 4 * 4 * total), clipes = {} as Record<PoseIA, Clipe>;
  const moto = criarMoto({ cor: "#ffffff", low: true }); raiz.add(moto.group);
  const montado: Montado = { w: 1, maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  const m = new THREE.Matrix4(), dt = 1 / FPS_ASSADO; let linha = 0, t = 0;
  for (const p of POSES_ASSADAS) {
    await ceder();   // (uma pose por vez: a tela não trava)
    moto.group.visible = p === "moto"; av.group.position.set(0, 0, 0);
    if (p === "moto") {
      moto.atualizar({ dt, t, voando: true, vel: 30, curva: 0 }); raiz.updateMatrixWorld(true);
      moto.assento.getWorldPosition(av.group.position);
      moto.pontos.maoE.getWorldPosition(montado.maoE); moto.pontos.maoD.getWorldPosition(montado.maoD); moto.pontos.peE.getWorldPosition(montado.peE); moto.pontos.peD.getWorldPosition(montado.peD);
    }
    av.olharPara(0);
    const est = estadoDaPose(p, montado);
    for (let k = 0; k < 45; k++) { t += dt; av.animar({ ...est, dt, t }); }
    clipes[p] = { inicio: linha, quadros: QUADROS[p] };
    for (let q = 0; q < QUADROS[p]; q++, linha++) {
      t += dt; av.animar({ ...est, dt, t });   // (o animar copia a pose pra armadura)
      raiz.updateMatrixWorld(true);
      for (const g of grupos) {
        const s = g.base; s.skeleton.update();
        for (let b = 0; b < s.skeleton.bones.length; b++) { m.fromArray(s.skeleton.boneMatrices!, b * 16).multiply(s.bindMatrix).premultiply(s.bindMatrixInverse).premultiply(s.matrixWorld); m.toArray(dados, (linha * nSlots * 4 + (g.slot + b) * 4) * 4); }
      }
      av.mochila.matrixWorld.toArray(dados, (linha * nSlots * 4 + slotMochila * 4) * 4);
    }
  }
  const tex = new THREE.DataTexture(dados, nSlots * 4, total, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
  // a GEOMETRIA de cada grupo: os vértices-base + os índices de todas as malhas dele + o tom (pelo material de quem usa o vértice)
  const partes = grupos.map((g) => {
    const G = g.base.geometry, n = G.attributes.position!.count, out = new THREE.BufferGeometry();
    for (const k of ["position", "normal", "skinIndex", "skinWeight"]) {
      const a = G.attributes[k]!, f = new Float32Array(a.count * a.itemSize), ler = [a.getX, a.getY, a.getZ, a.getW].map((fn) => fn.bind(a));
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = ler[c]!(i) + (k === "skinIndex" ? g.slot : 0);
      out.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
    }
    const tom = new Float32Array(n), idx: number[] = [];
    for (const s of g.malhas) {
      const t0 = tomDoTraje((s.material as THREE.Material).name ?? ""), ix = s.geometry.index;
      const ini = s.geometry.drawRange.start, fim = Math.min(ix ? ix.count : n, ini + s.geometry.drawRange.count);
      for (let i = ini; i < fim; i++) { const v = ix ? ix.getX(i) : i; tom[v] = t0; idx.push(v); }
    }
    out.setAttribute("aTom", new THREE.BufferAttribute(tom, 1));
    out.setAttribute("aVisor", new THREE.BufferAttribute(tom.map((x) => (x === 3 ? 1 : 0)), 1));
    out.setAttribute("aFixa", new THREE.BufferAttribute(new Float32Array(n), 1));
    out.setIndex(idx);
    return out;
  });
  if (modelo === "f") { const mo = geoMochila(slotMochila); mo.setAttribute("aTom", new THREE.BufferAttribute(new Float32Array(mo.attributes.position!.count), 1)); partes.push(mo); }
  const geo = juntar(partes) ?? partes[0]!;
  await ceder();
  const corpoG = partes[0]!, simples = corpoG.attributes.position!.count > 3000 ? simplificar(corpoG, 0.35) : null;
  const geoLonge = (simples && juntar([simples, ...partes.slice(1)])) ?? geo;
  geo.computeBoundingBox(); const tam = geo.boundingBox!.getSize(new THREE.Vector3());
  const espessura = espessuraTinta(Math.max(tam.x, tam.y, tam.z));
  moto.dispose(); av.dispose();
  return { tex, clipes, geo, geoLonge, espessura, nOssos: nSlots - 1 };
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

/** o corpo SIMPLIFICADO (o SimplifyModifier do three, que só preserva posição/normal — e cuja versão com cor quebra:
 *  usa THREE.Color sem importar). Os vértices que sobram ficam na posição ORIGINAL: os atributos do esqueleto, o visor e
 *  a mochila voltam procurando o vértice original na mesma posição */
function simplificar(g: THREE.BufferGeometry, fracao: number): THREE.BufferGeometry | null {
  try {
    const P = g.attributes.position!, n = P.count, chave = (x: number, y: number, z: number) => `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    const origem = new Map<string, number>(); for (let i = 0; i < n; i++) { const k = chave(P.getX(i), P.getY(i), P.getZ(i)); if (!origem.has(k)) origem.set(k, i); }
    const t = new THREE.BufferGeometry(); t.setAttribute("position", P.clone()); t.setAttribute("normal", g.attributes.normal!.clone()); if (g.index) t.setIndex(g.index.clone());
    const r = new SimplifyModifier().modify(t, Math.floor(n * (1 - fracao))); t.dispose();
    if (!r.attributes.normal) r.computeVertexNormals();   // (a do traje às vezes sai sem as normais)
    const R = r.attributes.position!, m = R.count;
    const copiar = (nome: string, tam: number) => { const a = g.attributes[nome]!, f = new Float32Array(m * tam), ler = [a.getX, a.getY, a.getZ, a.getW].map((fn) => fn.bind(a));
      for (let i = 0; i < m; i++) { const o = origem.get(chave(R.getX(i), R.getY(i), R.getZ(i))); if (o === undefined) throw new Error("vértice sem origem"); for (let c = 0; c < tam; c++) f[i * tam + c] = ler[c]!(o); }
      return new THREE.BufferAttribute(f, tam); };
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", R); out.setAttribute("normal", r.attributes.normal!);
    out.setAttribute("skinIndex", copiar("skinIndex", 4)); out.setAttribute("skinWeight", copiar("skinWeight", 4));
    out.setAttribute("aVisor", copiar("aVisor", 1)); out.setAttribute("aFixa", copiar("aFixa", 1));
    if (g.attributes.aTom) out.setAttribute("aTom", copiar("aTom", 1));
    out.setIndex(r.index ? Array.from(r.index.array as ArrayLike<number>) : [...Array(m).keys()]);
    return out;
  } catch (e) { console.warn("[multidão] não simplificou o corpo — longe usa o inteiro:", String(e)); return null; }
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

/** a MULTIDÃO DE TRAJE (out/2026, o dono: "coloca o traje também na multidão de longe"): assa o traje do gênero */
export async function criarMultidaoDeTraje(o: { gltf: GLTF; starTex: THREE.Texture; max: number; modelo: ModeloAstronauta }): Promise<MultidaoHandle> {
  const v = await vestidoDeTraje(o.gltf, o.starTex, o.modelo);
  await ceder();
  return criarMultidao({ ...o, assado: await assarTraje(v.av, v.pecas, o.modelo) });
}
export function criarMultidao(o: { gltf: GLTF; starTex: THREE.Texture; max: number; /** o TRAJE já assado (`criarMultidaoDeTraje`) */ assado?: Assado }): MultidaoHandle {
  const { tex, clipes, geo, geoLonge, espessura } = o.assado ?? assar(o.gltf, o.starTex);
  const deTraje = !!o.assado;
  const uni = { uAnim: { value: tex }, uTempo: { value: 0 }, uFps: { value: FPS_ASSADO }, uLuz: { value: new THREE.Color(COR_LUZ) }, uFixa: { value: corDesenho(new THREE.Color(COR_MOCHILA)) }, uEsp: { value: espessura } };
  // a ARMADURA desenhada (o mesmo toon dos corpos completos: 3 faixas, brilho recortado, borda na cor da luz) — a cor é
  // a da instância (vColor) e o visor sai na cor da luz
  const [s, mt] = FAIXAS_TOON.map((v) => (v / 255).toFixed(3));
  const toon = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: texFaixas() });
  toon.defines = deTraje ? { PELE_NORMAL: "", TRAJE: "" } : { PELE_NORMAL: "" };
  toon.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = PELE_PARS + (deTraje ? "attribute float aTom; varying float vTom;\n" : "") + sh.vertexShader
      .replace("#include <beginnormal_vertex>", "mat4 _pele = peleAgora(); vec3 objectNormal = normalize(mat3(_pele) * normal); vVisor = aVisor; vFixa = aFixa;" + (deTraje ? " vTom = aTom;" : ""))
      .replace("#include <begin_vertex>", "vec3 transformed = (_pele * vec4(position, 1.0)).xyz;");
    sh.fragmentShader = "uniform vec3 uLuz; uniform vec3 uFixa; varying float vVisor; varying float vFixa;\n" + (deTraje ? "varying float vTom;\n" : "") + sh.fragmentShader
      .replace("#include <color_fragment>", "#include <color_fragment>\n vec3 corInst = diffuseColor.rgb; diffuseColor.rgb = mix(diffuseColor.rgb, uFixa, step(0.5, vFixa));"
        // (o TRAJE: a malha por baixo na cor escurecida, os tubos quase pretos — as placas ficam na cor da instância)
        + (deTraje ? "\n if (vTom > 0.5 && vTom < 1.5) diffuseColor.rgb = mix(vec3(0.05, 0.05, 0.07), corInst, 0.22); else if (vTom > 1.5 && vTom < 2.5) diffuseColor.rgb = vec3(0.075, 0.075, 0.085);" : ""))   // a mochila tem cor própria
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
      #ifdef TRAJE
      outgoingLight = mix(outgoingLight, vec3(0.03, 0.035, 0.06) + vec3(0.55, 0.7, 1.0) * brilho * 0.6 + uLuz * step(0.55, rimF) * 0.4, step(0.5, vVisor));   // (a viseira: vidro escuro, sem rosto atrás — o reflexo e a borda acesa)
      #else
      outgoingLight = mix(outgoingLight, uLuz, step(0.5, vVisor));
      #endif
      #include <opaque_fragment>`);
  };
  toon.customProgramCacheKey = () => (deTraje ? "multidao-toon-traje-v1" : "multidao-toon-v2");
  // o CONTORNO de tinta: casca invertida, a espessura no espaço do modelo (antes do skinning, como o materialTinta)
  const tinta = new THREE.MeshBasicMaterial({ color: TINTA.cor, side: THREE.BackSide });
  tinta.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = "uniform float uEsp;\n" + PELE_PARS + sh.vertexShader.replace("#include <begin_vertex>", "mat4 _pele = peleAgora(); vec3 transformed = (_pele * vec4(position + normalize(normal) * uEsp, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb = diffuse;");   // a tinta não pega a cor da instância
  };
  tinta.customProgramCacheKey = () => "multidao-tinta-v1";
  // cada nível: 2 grupos da MESMA faixa de índices (armadura e contorno) — 1 InstancedMesh, 2 draw calls
  const nivel = (g: THREE.BufferGeometry, max: number, nome: string) => {
    const n = g.index!.count; g.clearGroups(); g.addGroup(0, n, 0); g.addGroup(0, n, 1);
    const aAnim = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); aAnim.setUsage(THREE.DynamicDrawUsage); g.setAttribute("aAnim", aAnim);
    const m = new THREE.InstancedMesh(g, [toon, tinta], max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.name = nome; m.setColorAt(0, new THREE.Color(1, 1, 1));
    return { m, aAnim, k: 0, max };
  };
  const perto = nivel(geo, o.max, "multidao-gpu"), longe = nivel(geoLonge === geo ? geo.clone() : geoLonge, o.max, "multidao-gpu-longe");
  const malha = new THREE.Group(); malha.name = "multidao"; malha.add(perto.m, longe.m);
  const mI = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1), cI = new THREE.Color();
  const subir = (nv: typeof perto) => {
    const { m, aAnim, k } = nv; m.count = k;
    m.instanceMatrix.clearUpdateRanges(); m.instanceMatrix.addUpdateRange(0, k * 16); m.instanceMatrix.needsUpdate = true;
    aAnim.clearUpdateRanges(); aAnim.addUpdateRange(0, k * 4); aAnim.needsUpdate = true;
    if (m.instanceColor) { m.instanceColor.clearUpdateRanges(); m.instanceColor.addUpdateRange(0, k * 3); m.instanceColor.needsUpdate = true; }
  };
  return {
    malha, clipes,
    comecar() { perto.k = 0; longe.k = 0; },
    adicionar(x, y, z, rumo, pose, cor, fase, ehLonge) {
      const nv = ehLonge ? longe : perto; if (nv.k >= nv.max) return false;
      const i = nv.k++;
      nv.m.setMatrixAt(i, mI.compose(p.set(x, y, z), q.setFromAxisAngle(eixo, rumo), um));
      nv.m.setColorAt(i, corDesenho(cor, cI));
      const c = clipes[pose]; nv.aAnim.setXYZW(i, c.inicio, c.quadros, fase, 1);
      return true;
    },
    fechar() { subir(perto); subir(longe); },
    atualizar(t) { uni.uTempo.value = t; },
    dispose() { malha.removeFromParent(); perto.m.geometry.dispose(); longe.m.geometry.dispose(); toon.dispose(); tinta.dispose(); tex.dispose(); },
  };
}
