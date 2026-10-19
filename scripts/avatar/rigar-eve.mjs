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
 *   os 3 mais perto), sem nunca misturar o lado esquerdo com o direito.
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
J.Hips = new THREE.Vector3(0, virilha + H * 0.035, 0);
J.Spine = new THREE.Vector3(0, J.Hips.y + (yPeito0 - J.Hips.y) * 0.35, 0);
J.Spine1 = new THREE.Vector3(0, J.Hips.y + (yPeito0 - J.Hips.y) * 0.75, 0);
J.Spine2 = new THREE.Vector3(0, yPeito0 + (yPeito1 - yPeito0) * 0.35, 0);
J.Neck = new THREE.Vector3(0, yPesc0 + (yCap0 - yPesc0) * 0.3, 0);
J.Head = new THREE.Vector3(0, yCap0 + (yCap1 - yCap0) * 0.12, 0);
J.HeadTop_End = new THREE.Vector3(0, yCap1, 0);
for (const [s, L] of [[1, "Left"], [-1, "Right"]]) {
  // o braço: o pulso e o cotovelo são as pontas da braçadeira do lado (a de longe do corpo e a de perto); a mão vai
  // até a ponta dos dedos (o vértice mais pra fora)
  const br = bracos.filter((p) => Math.sign(p.x) === s), cBr = medio(br);
  const ponta = lado(s, () => true).reduce((m, p) => (Math.abs(p.x) > Math.abs(m.x) ? p : m));
  const eixo = ponta.clone().sub(cBr).normalize();
  const proj = br.map((p) => p.clone().sub(cBr).dot(eixo)), aMin = Math.min(...proj), aMax = Math.max(...proj);
  const pulso = cBr.clone().addScaledVector(eixo, aMax), cotovelo = cBr.clone().addScaledVector(eixo, aMin - (aMax - aMin) * 0.12);
  const ombro = new THREE.Vector3(s * Math.abs(cotovelo.x) * 0.48, yPeito1 - (yPeito1 - yPeito0) * 0.08, cBr.z * 0.5);
  J[`${L}Shoulder`] = new THREE.Vector3(s * Math.abs(ombro.x) * 0.35, ombro.y - H * 0.005, ombro.z);
  J[`${L}Arm`] = ombro; J[`${L}ForeArm`] = cotovelo; J[`${L}Hand`] = pulso;
  J[`${L}HandMiddle1`] = pulso.clone().lerp(ponta, 0.45); J[`${L}HandMiddle4`] = ponta.clone();
  // a perna: o centro dela logo abaixo da virilha, o joelho, o tornozelo; o pé pra frente (+z)
  const coxa = medio(lado(s, (p) => p.y > virilha - H * 0.12 && p.y < virilha - H * 0.03));
  const pe = lado(s, (p) => p.y < H * 0.06), frenteDoPe = Math.max(...pe.map((p) => p.z));
  J[`${L}UpLeg`] = new THREE.Vector3(coxa.x, virilha + H * 0.01, 0);
  J[`${L}Leg`] = new THREE.Vector3(coxa.x, virilha * 0.52, 0.004 * H);
  J[`${L}Foot`] = new THREE.Vector3(coxa.x, H * 0.07, -0.01 * H);
  J[`${L}ToeBase`] = new THREE.Vector3(coxa.x, H * 0.02, frenteDoPe * 0.55);
  J[`${L}Toe_End`] = new THREE.Vector3(coxa.x, H * 0.015, frenteDoPe);
}
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
const pesosDoVertice = (p) => {
  const meio = Math.abs(p.x) < H * 0.015;
  const cand = segs.filter((g) => (g.s === 0 ? true : !meio && Math.sign(p.x) === g.s)).map((g) => ({ n: g.n, d: dSeg(p, g.a, g.b) })).sort((x, y) => x.d - y.d).slice(0, 3);
  const w = cand.map((c) => 1 / (Math.pow(c.d + H * 0.004, 4))), soma = w.reduce((a, b) => a + b, 0);
  return cand.map((c, i) => [idx[c.n], w[i] / soma]);
};
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
      else w = pesosDoVertice(p);
      w.forEach(([b, x], m) => { SI[o * 4 + m] = b; SW[o * 4 + m] = x; });
    }
  });
  let ini = 0;
  for (let k = 0; k <= ordem.length; k++) {
    if (k === ordem.length || (k > 0 && zonaTri[ordem[k]] !== zonaTri[ordem[k - 1]])) { const z = zonaTri[ordem[k - 1]]; zonasUsadas.push(z); gr.addGroup(ini * 3, (k - ini) * 3, zonasUsadas.length - 1); ini = k; }
  }
  gr.setAttribute("position", new THREE.BufferAttribute(P, 3)); gr.setAttribute("skinIndex", new THREE.BufferAttribute(SI, 4)); gr.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
  gr.computeVertexNormals();
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
