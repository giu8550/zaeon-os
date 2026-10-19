/**
 * RIG AUTOMÁTICO da astronauta "Eve" (um FBX só com a malha, sem esqueleto) → GLB pro jogo, no mesmo formato do
 * astronauta masculino (scripts/avatar/astronauta-para-glb.mjs): o esqueleto MIXAMO (os nomes `mixamorig*` — o corpo
 * copia a pose do avatar osso a osso, components/cyber/CorpoAstronauta), a malha intacta, sem texturas.
 *
 *   node scripts/avatar/rigar-eve.mjs <Eve_low.fbx> <Eve_low_Eve_BaseColor.png> <saida.glb>
 *
 * - O ESQUELETO é montado nas medidas DELA (pose A, olhando pro +Z): o quadril logo acima de onde as pernas se separam,
 *   a coluna pelo peitoral, o pescoço e a cabeça pelo capacete, o cotovelo e o pulso pelas pontas das braçadeiras, a mão
 *   até a ponta dos dedos, joelho/tornozelo/dedão pelas alturas da perna. Os ossos ficam sem rotação (só posição): o
 *   jogo alinha o repouso dele com o do avatar pelas direções dos ossos.
 * - Os PESOS: as peças RÍGIDAS vão inteiras num osso (capacete e vidro → cabeça, pescoço → pescoço, peitoral → tronco,
 *   cada braçadeira → o antebraço do lado dela); o CORPO pela distância de cada vértice aos segmentos dos ossos (1/d⁴,
 *   os 4 mais perto) e depois SUAVIZADO pela malha (6 passadas de difusão entre vizinhos), sem nunca misturar o lado
 *   esquerdo com o direito — abaixo da virilha, cada vértice é de uma perna.
 * - As CURVAS: a cintura afina, o quadril e os glúteos abrem e o busto avança (campos suaves só no tronco).
 * - As CORES: cada triângulo pega a cor da textura no meio dele e vira uma ZONA — placa (o verde-água), macacão (o
 *   creme), detalhe escuro (o cinza) — cada zona um material com o nome que as paletas do jogo conhecem ("armadura",
 *   "covertura", "tubos"; o vidro é a "visera").
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import sharp from "sharp";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); } };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const [entrada, texArq, saida] = process.argv.slice(2);
if (!entrada || !texArq || !saida) { console.error("uso: node rigar-eve.mjs <fbx> <basecolor.png> <saida.glb>"); process.exit(1); }
const buf = readFileSync(entrada);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
obj.updateMatrixWorld(true);
const tex = await sharp(texArq).raw().toBuffer({ resolveWithObject: true });
const { width: TW, height: TH, channels: TC } = tex.info;
const cor = (u, v) => { const x = Math.min(TW - 1, Math.max(0, Math.round(((u % 1) + 1) % 1 * (TW - 1)))), y = Math.min(TH - 1, Math.max(0, Math.round((1 - (((v % 1) + 1) % 1)) * (TH - 1)))), i = (y * TW + x) * TC; return [tex.data[i] / 255, tex.data[i + 1] / 255, tex.data[i + 2] / 255]; };

// as peças, em coordenadas do mundo
const pecas = {};
obj.traverse((o) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); pecas[o.name] = g; } });
const pts = (g) => { const p = g.attributes.position, out = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i)); return out; };
const corpo = pts(pecas.Body_low), H = Math.max(...corpo.map((p) => p.y));

// ── as MEDIDAS ──
// a virilha: a maior altura em que, numa faixa fina, não há vértice do corpo perto do meio (as pernas separadas)
let virilha = 0;
for (let y = 2; y < H * 0.6; y += 0.5) { const faixa = corpo.filter((p) => p.y > y && p.y < y + 1.5); if (faixa.length && faixa.every((p) => Math.abs(p.x) > H * 0.012)) virilha = y; }
const lado = (s, f) => corpo.filter((p) => Math.sign(p.x) === s && f(p));
const medio = (a) => a.reduce((m, p) => m.add(p), new THREE.Vector3()).divideScalar(Math.max(1, a.length));
const peito = pts(pecas.Armor_low), capacete = pts(pecas.Helmet_low), pescoco = pts(pecas.Neck_low), bracos = pts(pecas.Bracers_low);
const yPeito0 = Math.min(...peito.map((p) => p.y)), yPeito1 = Math.max(...peito.map((p) => p.y));
const yPesc0 = Math.min(...pescoco.map((p) => p.y)), yCap0 = Math.min(...capacete.map((p) => p.y)), yCap1 = Math.max(...capacete.map((p) => p.y));
const J = {};
// a COLUNA no meio do tronco (a profundidade de cada fatia do tronco — o corpo dela não está centrado em z = 0)
const zTronco = (y) => { const f = corpo.filter((p) => Math.abs(p.y - y) < H * 0.02 && Math.abs(p.x) < H * 0.08); return f.length ? (Math.min(...f.map((p) => p.z)) + Math.max(...f.map((p) => p.z))) / 2 : 0; };
const noMeio = (y) => new THREE.Vector3(0, y, zTronco(y));
J.Hips = noMeio(virilha + H * 0.035);
J.Spine = noMeio(J.Hips.y + (yPeito0 - J.Hips.y) * 0.35);
J.Spine1 = noMeio(J.Hips.y + (yPeito0 - J.Hips.y) * 0.75);
J.Spine2 = noMeio(yPeito0 + (yPeito1 - yPeito0) * 0.35);
const zPesc = (Math.min(...pescoco.map((p) => p.z)) + Math.max(...pescoco.map((p) => p.z))) / 2, zCap = (Math.min(...capacete.map((p) => p.z)) + Math.max(...capacete.map((p) => p.z))) / 2;
J.Neck = new THREE.Vector3(0, yPesc0 + (yCap0 - yPesc0) * 0.3, zPesc);
J.Head = new THREE.Vector3(0, yCap0 + (yCap1 - yCap0) * 0.12, zCap);
J.HeadTop_End = new THREE.Vector3(0, yCap1, zCap);
for (const [s, L] of [[1, "Left"], [-1, "Right"]]) {
  // o braço: o pulso e o cotovelo são as pontas da braçadeira do lado (a de longe do corpo e a de perto); a mão vai
  // até a ponta dos dedos (o vértice mais pra fora)
  const br = bracos.filter((p) => Math.sign(p.x) === s), cBr = medio(br);
  const ponta = lado(s, () => true).reduce((m, p) => (Math.abs(p.x) > Math.abs(m.x) ? p : m));
  const eixo = ponta.clone().sub(cBr).normalize();
  const proj = br.map((p) => p.clone().sub(cBr).dot(eixo)), aMin = Math.min(...proj), aMax = Math.max(...proj);
  const pulso = cBr.clone().addScaledVector(eixo, aMax), cotovelo = cBr.clone().addScaledVector(eixo, aMin - (aMax - aMin) * 0.12);
  // o OMBRO: a 40% do peito ao pescoço, pra dentro da largura do tronco ali (a junta fica dentro do deltoide)
  const yOmbro = J.Spine2.y + (J.Neck.y - J.Spine2.y) * 0.45;
  const largOmbro = Math.max(...corpo.filter((p) => Math.abs(p.y - yOmbro) < H * 0.012 && Math.sign(p.x) === s).map((p) => Math.abs(p.x)));
  const ombro = new THREE.Vector3(s * largOmbro * 0.72, yOmbro, zTronco(yOmbro));
  J[`${L}Shoulder`] = new THREE.Vector3(s * Math.abs(ombro.x) * 0.35, ombro.y - H * 0.005, ombro.z);
  J[`${L}Arm`] = ombro; J[`${L}ForeArm`] = cotovelo; J[`${L}Hand`] = pulso;
  J[`${L}HandMiddle1`] = pulso.clone().lerp(ponta, 0.45); J[`${L}HandMiddle4`] = ponta.clone();
  // a PERNA: o centro de cada fatia horizontal é o EIXO dela (as pernas da Eve convergem pros pés — um osso na
  // vertical do quadril ficava fora da perna e a malha entortava); as ALTURAS do joelho e do tornozelo, pela proporção
  // (a perna mais estreita não serve: as botas mudam a largura)
  const fatia = (y) => { const f = lado(s, (p) => Math.abs(p.y - y) < H * 0.018 && Math.abs(p.x) < H * 0.16); if (f.length < 4) return null; const xs = f.map((p) => p.x); return { c: medio(f), larg: Math.max(...xs) - Math.min(...xs) }; };
  const naAltura = (y) => { const f = fatia(y); return f ? { y, c: f.c } : null; };
  const fq = fatia(virilha - H * 0.03) ?? { c: new THREE.Vector3(s * H * 0.06, virilha, 0) };
  const joelho = naAltura(virilha * 0.53), tornozelo = naAltura(H * 0.075);
  const pe = lado(s, (p) => p.y < H * 0.05), frente = pe.reduce((m, p) => (p.z > m.z ? p : m), pe[0]);
  J[`${L}UpLeg`] = new THREE.Vector3(fq.c.x, virilha + H * 0.01, fq.c.z);
  J[`${L}Leg`] = joelho ? new THREE.Vector3(joelho.c.x, joelho.y, joelho.c.z + H * 0.004) : new THREE.Vector3(fq.c.x, virilha * 0.52, 0);
  J[`${L}Foot`] = tornozelo ? new THREE.Vector3(tornozelo.c.x, tornozelo.y, tornozelo.c.z) : new THREE.Vector3(fq.c.x, H * 0.07, 0);
  J[`${L}ToeBase`] = new THREE.Vector3((J[`${L}Foot`].x + frente.x) / 2, H * 0.02, J[`${L}Foot`].z + (frente.z - J[`${L}Foot`].z) * 0.6);
  J[`${L}Toe_End`] = new THREE.Vector3(frente.x, H * 0.015, frente.z);
}
if (process.env.RIG_DEBUG) for (const [k, v] of Object.entries(J)) console.log(k.padEnd(18), v.toArray().map((x) => x.toFixed(1)).join("  "));

// as CURVAS (o dono pediu realçar): a cintura afina, o quadril e os glúteos abrem, o busto avança — campos suaves
// (gaussianas na altura) só no tronco (|x| dentro da largura do quadril: os braços, em pose A, ficam de fora). O
// peitoral (a peça rígida) acompanha o busto
const CURVAS = { cintura: 0.86, quadril: 1.13, gluteo: 1.12, busto: 1.16 };
{
  const yCint = (J.Spine.y + J.Spine1.y) / 2, yQuad = J.Hips.y - H * 0.025, yBusto = J.Spine2.y + H * 0.015;
  const largQuad = Math.max(...corpo.filter((p) => Math.abs(p.y - yQuad) < H * 0.02).map((p) => Math.abs(p.x)));
  const sino = (y, c, larg) => Math.exp(-(((y - c) / larg) ** 2));
  const esculpir = (g, soFrente) => {
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (Math.abs(v.x) > largQuad * 1.15 && !soFrente) continue;
      const kc = sino(v.y, yCint, H * 0.045), kq = sino(v.y, yQuad, H * 0.06), kb = sino(v.y, yBusto, H * 0.035);
      const sx = 1 + (CURVAS.cintura - 1) * kc + (CURVAS.quadril - 1) * kq;
      const sz = 1 + (CURVAS.cintura - 1) * kc * 0.7 + (v.z < 0 ? (CURVAS.gluteo - 1) * kq : 0) + (v.z > 0 ? (CURVAS.busto - 1) * kb : 0);
      pos.setXYZ(i, v.x * sx, v.y, v.z * sz);
    }
    pos.needsUpdate = true;
  };
  esculpir(pecas.Body_low, false); esculpir(pecas.Armor_low, true);
}

// a hierarquia (o pai de cada osso)
const PAI = { Hips: null, Spine: "Hips", Spine1: "Spine", Spine2: "Spine1", Neck: "Spine2", Head: "Neck", HeadTop_End: "Head" };
for (const L of ["Left", "Right"]) Object.assign(PAI, { [`${L}Shoulder`]: "Spine2", [`${L}Arm`]: `${L}Shoulder`, [`${L}ForeArm`]: `${L}Arm`, [`${L}Hand`]: `${L}ForeArm`, [`${L}HandMiddle1`]: `${L}Hand`, [`${L}HandMiddle4`]: `${L}HandMiddle1`, [`${L}UpLeg`]: "Hips", [`${L}Leg`]: `${L}UpLeg`, [`${L}Foot`]: `${L}Leg`, [`${L}ToeBase`]: `${L}Foot`, [`${L}Toe_End`]: `${L}ToeBase` });
const nomes = Object.keys(PAI), ossos = {};
for (const n of nomes) { const b = new THREE.Bone(); b.name = `mixamorig${n}`; ossos[n] = b; }
for (const n of nomes) { const p = PAI[n]; if (p) { ossos[p].add(ossos[n]); ossos[n].position.copy(J[n]).sub(J[p]); } else ossos[n].position.copy(J[n]); }
const lista = nomes.map((n) => ossos[n]), idx = Object.fromEntries(nomes.map((n, i) => [n, i]));

// os SEGMENTOS que puxam vértices (osso → o filho principal) e de que lado são
const FILHO = { Hips: "Spine", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head", Head: "HeadTop_End" };
for (const L of ["Left", "Right"]) Object.assign(FILHO, { [`${L}Shoulder`]: `${L}Arm`, [`${L}Arm`]: `${L}ForeArm`, [`${L}ForeArm`]: `${L}Hand`, [`${L}Hand`]: `${L}HandMiddle4`, [`${L}UpLeg`]: `${L}Leg`, [`${L}Leg`]: `${L}Foot`, [`${L}Foot`]: `${L}ToeBase`, [`${L}ToeBase`]: `${L}Toe_End` });
const segs = Object.entries(FILHO).map(([n, f]) => ({ n, a: J[n], b: J[f], s: n.startsWith("Left") ? 1 : n.startsWith("Right") ? -1 : 0 }));
const dSeg = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
/** o LADO de um vértice: 0 = o meio do tronco (só os ossos do centro); abaixo da virilha, sempre o lado da perna
 *  (as coxas dela se encostam: a linha do meio entre elas é de uma perna ou da outra — no quadril, virava uma membrana) */
const ladoDe = (p) => (Math.abs(p.x) < H * 0.015 && p.y > virilha - H * 0.005 ? 0 : Math.sign(p.x) || 1);
/** o peso CRU (antes de suavizar): pela distância aos segmentos do lado dele, 1/d⁴, os 4 mais perto */
const pesoCru = (p) => {
  const s = ladoDe(p), w = new Map();
  const cand = segs.filter((g) => g.s === 0 || g.s === s && s !== 0).map((g) => ({ n: g.n, d: dSeg(p, g.a, g.b) })).sort((x, y) => x.d - y.d).slice(0, 4);
  let soma = 0; for (const c of cand) { const x = 1 / Math.pow(c.d + H * 0.006, 4); w.set(idx[c.n], x); soma += x; }
  for (const [k, x] of w) w.set(k, x / soma);
  return w;
};
/** os pesos SUAVIZADOS do corpo (difusão pela malha: cada vértice puxa a média dos vizinhos — as juntas dobram sem
 *  quina), por posição (a malha do FBX repete o vértice em cada triângulo) */
const pesosDoCorpo = (() => {
  const g = pecas.Body_low.index ? pecas.Body_low.toNonIndexed() : pecas.Body_low, pos = g.attributes.position;
  const chave = (i) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const id = new Map(), vp = [], viz = [];
  const de = (i) => { const k = chave(i); let j = id.get(k); if (j === undefined) { j = vp.length; id.set(k, j); vp.push(new THREE.Vector3().fromBufferAttribute(pos, i)); viz.push(new Set()); } return j; };
  for (let t = 0; t < pos.count; t += 3) { const a = de(t), b = de(t + 1), c = de(t + 2); viz[a].add(b).add(c); viz[b].add(a).add(c); viz[c].add(a).add(b); }
  let w = vp.map(pesoCru);
  const lados = vp.map(ladoDe), ladoDoOsso = Object.fromEntries(nomes.map((n) => [idx[n], n.startsWith("Left") ? 1 : n.startsWith("Right") ? -1 : 0]));
  for (let it = 0; it < 6; it++) {
    w = w.map((wi, i) => {
      const m = new Map(); for (const [k, x] of wi) m.set(k, x * 0.5);
      const vs = [...viz[i]].filter((j) => lados[j] === lados[i] || lados[j] === 0 || lados[i] === 0);
      for (const j of vs) for (const [k, x] of w[j]) if (ladoDoOsso[k] === 0 || ladoDoOsso[k] === lados[i]) m.set(k, (m.get(k) ?? 0) + (x * 0.5) / vs.length);
      return m;
    });
  }
  return (p) => {
    const wi = w[id.get(`${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`)] ?? pesoCru(p);
    const top = [...wi].sort((a, b) => b[1] - a[1]).slice(0, 4), soma = top.reduce((a, [, x]) => a + x, 0);
    return top.map(([k, x]) => [k, x / soma]);
  };
})();
const RIGIDA = { Helmet_low: "Head", Helmetglass_low: "Head", Neck_low: "Neck", Armor_low: "Spine2" };

// as ZONAS de cor
const ZONAS = { armadura: [0.24, 0.37, 0.36], covertura: [0.78, 0.74, 0.69], tubos: [0.33, 0.31, 0.3] };
const zonaDe = (c) => { let melhor = "armadura", dm = Infinity; for (const [k, z] of Object.entries(ZONAS)) { const d = (c[0] - z[0]) ** 2 + (c[1] - z[1]) ** 2 + (c[2] - z[2]) ** 2; if (d < dm) { dm = d; melhor = k; } } return melhor; };
const somaZona = Object.fromEntries(Object.keys(ZONAS).map((k) => [k, [0, 0, 0, 0]]));

const raiz = new THREE.Group(); raiz.name = "Eve";
const arm = new THREE.Group(); arm.name = "Rig"; raiz.add(arm); arm.add(ossos.Hips);
raiz.updateMatrixWorld(true);
const esqueleto = new THREE.Skeleton(lista);
const mats = {}, mat = (n) => (mats[n] ??= new THREE.MeshStandardMaterial({ name: n, color: 0xffffff, roughness: 0.6, metalness: 0.1 }));
let tris = 0;
for (const [nome, g0] of Object.entries(pecas)) {
  // sem índice: cada triângulo com a sua cor/zona; os grupos por zona
  const g = g0.index ? g0.toNonIndexed() : g0, pos = g.attributes.position, uv = g.attributes.uv, n = pos.count;
  const tri = n / 3, zonaTri = [];
  for (let t = 0; t < tri; t++) {
    let c = [0.5, 0.5, 0.5];
    if (uv) { const u = (uv.getX(t * 3) + uv.getX(t * 3 + 1) + uv.getX(t * 3 + 2)) / 3, v = (uv.getY(t * 3) + uv.getY(t * 3 + 1) + uv.getY(t * 3 + 2)) / 3; c = cor(u, v); }
    const z = nome === "Helmetglass_low" ? "visera" : zonaDe(c); zonaTri.push(z);
    if (somaZona[z]) { somaZona[z][0] += c[0]; somaZona[z][1] += c[1]; somaZona[z][2] += c[2]; somaZona[z][3]++; }
  }
  // reordena os triângulos por zona (um grupo por zona)
  const ordem = [...Array(tri).keys()].sort((a, b) => zonaTri[a].localeCompare(zonaTri[b]));
  const P = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4), gr = new THREE.BufferGeometry(), zonasUsadas = [];
  const rig = RIGIDA[nome] ?? (nome === "Bracers_low" ? null : undefined);
  ordem.forEach((t, k) => {
    for (let j = 0; j < 3; j++) {
      const i = t * 3 + j, o = k * 3 + j, p = new THREE.Vector3().fromBufferAttribute(pos, i);
      P.set([p.x, p.y, p.z], o * 3);
      let w;
      if (rig) w = [[idx[rig], 1]];
      else if (nome === "Bracers_low") w = [[idx[p.x > 0 ? "LeftForeArm" : "RightForeArm"], 1]];
      else w = pesosDoCorpo(p);
      w.forEach(([b, x], m) => { SI[o * 4 + m] = b; SW[o * 4 + m] = x; });
    }
  });
  let ini = 0;
  for (let k = 0; k <= ordem.length; k++) {
    if (k === ordem.length || (k > 0 && zonaTri[ordem[k]] !== zonaTri[ordem[k - 1]])) { const z = zonaTri[ordem[k - 1]]; zonasUsadas.push(z); gr.addGroup(ini * 3, (k - ini) * 3, zonasUsadas.length - 1); ini = k; }
  }
  gr.setAttribute("position", new THREE.BufferAttribute(P, 3)); gr.setAttribute("skinIndex", new THREE.BufferAttribute(SI, 4)); gr.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
  // (funde os vértices repetidos pela posição e pela skin — sem a normal, que no FBX é uma por triângulo — e calcula as
  // normais SUAVES: sem isso o corpo ficava facetado, cada triângulo chapado)
  const gm = mergeVertices(gr, 1e-4); gm.computeVertexNormals();
  const m = new THREE.SkinnedMesh(gm, zonasUsadas.map(mat)); m.name = nome; raiz.add(m); m.bind(esqueleto, new THREE.Matrix4());
  tris += tri;
}
// a cor de cada zona: a média da textura nos triângulos dela
for (const [z, [r, g, b, k]] of Object.entries(somaZona)) if (k && mats[z]) mats[z].color.setRGB(r / k, g / k, b / k, THREE.SRGBColorSpace);   // (a textura é sRGB)
if (mats.visera) Object.assign(mats.visera, { transparent: true, opacity: 0.55 }), mats.visera.color.setRGB(0.36, 0.25, 0.62, THREE.SRGBColorSpace);

const glb = await new Promise((ok, erro) => new GLTFExporter().parse(raiz, ok, erro, { binary: true, onlyVisible: false }));
writeFileSync(saida, Buffer.from(glb));
console.log(`${saida}: ${(glb.byteLength / 1e6).toFixed(2)} MB, ${tris} triângulos, ${lista.length} ossos; virilha ${virilha.toFixed(1)} de ${H.toFixed(1)}; zonas`, Object.fromEntries(Object.entries(mats).map(([k, m]) => [k, `#${m.color.getHexString()}`])));
