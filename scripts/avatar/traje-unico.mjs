/**
 * O TRAJE ÚNICO (out/2026): do astronauta masculino (public/avatars/traje/astronauta-m.glb — 503 pedaços, um por grupo de
 * material, ≈ 1000 chamadas de desenho por personagem com o contorno) sai um traje de 3 malhas no MESMO esqueleto:
 *   - "corpo": tudo menos capacete e viseira, num material só — cada vértice leva a ZONA (`_zona`: 0 placa, 1 malha,
 *     2 tubos/escuro) e quem pinta é o shader (CorpoAstronauta);
 *   - "casco": o capacete (zona 0) — à parte pra poder tirar (o personagem SEM capacete, com rosto);
 *   - "visera": o vidro.
 * E a versão LEVE (os outros personagens): "corpo_leve"/"casco_leve", simplificadas (meshoptimizer), nos mesmos vértices.
 *
 * A FEMININA é o mesmo traje com o corpo ajeitado de leve (cintura, quadril, ombros, braços, pernas, busto, capacete) —
 * os vértices andam, o esqueleto não: tudo que anima o masculino anima ela igual.
 *
 *   node scripts/avatar/traje-unico.mjs            → public/avatars/traje/traje-m.glb e traje-f.glb
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MeshoptSimplifier } from "meshoptimizer";

globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); } };

const DIR = "public/avatars/traje";
const ZONAS = [
  ["pechera", "hombrera", "placa_pelvis", "placa_piernas", "casco", "mochila", "cinturon", "armadura"],
  ["covertura"],
  ["tubos", "brazalete", "phongE", "lambert1"],
];
const zonaDe = (nome) => { const i = ZONAS.findIndex((z) => z.some((k) => nome.includes(k))); return i < 0 ? 2 : i; };
/** a partir de quanto acima do osso do pescoço (no mundo, em repouso — o modelo é em cm) a peça é do capacete */
const ALTO_PESCOCO = 4;
/** quanto da malha fica na versão leve */
const LEVE = 0.42;

const carregar = async () => {
  const b = readFileSync(`${DIR}/astronauta-m.glb`);
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "");
};

/** junta os pedaços em vértices nas coordenadas do corpo principal (o "modelgeo"), separados por zona (um vértice
 *  usado por duas zonas vira dois — a cor não escorre de uma peça pra outra) */
function juntar(gltf) {
  const malhas = []; gltf.scene.traverse((o) => { if (o.isSkinnedMesh) malhas.push(o); });
  const principal = malhas.find((m) => m.skeleton.bones.length > 10);
  const sk = principal.skeleton;
  sk.pose(); gltf.scene.updateMatrixWorld(true);
  const invPrincipal = principal.matrixWorld.clone().invert();
  const P = [], N = [], J = [], W = [], Z = [];
  const tris = { corpo: [], casco: [], visera: [] };
  const v = new THREE.Vector3(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  const chaves = new Map();
  for (const m of malhas) {
    const g = m.geometry, nome = m.material.name, z = zonaDe(nome);
    const alvo = nome.includes("visera") ? tris.visera : nome.includes("casco") ? tris.casco : tris.corpo;
    const pos = g.attributes.position, nor = g.attributes.normal, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const outra = m !== principal;
    if (outra) nm.getNormalMatrix(new THREE.Matrix4().multiplyMatrices(invPrincipal, m.matrixWorld));
    const idx = g.index ? g.index.array : [...Array(pos.count).keys()];
    for (const i of idx) {
      const k = `${outra ? m.uuid : "p"}|${z}|${alvo === tris.visera ? "v" : ""}|${i}`;
      let j = chaves.get(k);
      if (j === undefined) {
        j = Z.length; chaves.set(k, j);
        v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
        if (outra) {   // (a peça do pescoço tem outra skin: a posição de repouso no mundo, levada pro espaço do corpo principal)
          m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(invPrincipal); n.applyMatrix3(nm).normalize();
        }
        P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z);
        for (let c = 0; c < 4; c++) {
          const b = outra ? sk.bones.indexOf(m.skeleton.bones[si.getComponent(i, c)]) : si.getComponent(i, c);
          J.push(Math.max(0, b)); W.push(sw.getComponent(i, c));
        }
        Z.push(z);
      }
      alvo.push(j);
    }
  }
  // o que é preso na CABEÇA (as mangueiras e os encaixes do capacete) vai com o capacete: sem ele, sobravam penduricalhos
  const cabeca = new Set(sk.bones.map((b, i) => (/Head/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  // (e as MANGUEIRAS, que saem da mochila: o que fica acima do pescoço — medido no mundo, em repouso)
  const pescoco = sk.bones.find((b) => /Neck$/.test(b.name)).getWorldPosition(new THREE.Vector3()).y, vv = new THREE.Vector3();
  const acimaDoPescoco = (v) => vv.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).applyMatrix4(principal.matrixWorld).y > pescoco + ALTO_PESCOCO;
  const daCabeca = (v) => { let w = 0; for (let c = 0; c < 4; c++) if (cabeca.has(J[v * 4 + c])) w += W[v * 4 + c]; return w > 0.5 || acimaDoPescoco(v); };
  const corpo = [];
  for (let t = 0; t < tris.corpo.length; t += 3) {
    const tri = tris.corpo.slice(t, t + 3);
    (tri.every(daCabeca) ? tris.casco : corpo).push(...tri);
  }
  tris.corpo = corpo;
  return { principal, sk, P: new Float32Array(P), N: new Float32Array(N), J: new Uint16Array(J), W: new Float32Array(W), Z: new Float32Array(Z), tris };
}

/** o corpo FEMININO: cada vértice anda o tanto que os ossos dele pedem (pelo peso) — no referencial do mundo em repouso */
function feminizar(d) {
  const { principal, sk, P, J, W } = d;
  const mw = principal.matrixWorld, inv = mw.clone().invert();
  const osso = (nome) => sk.bones.find((x) => x.name === `mixamorig${nome}`) ?? principal.parent?.parent?.getObjectByName(`mixamorig${nome}`);
  const pos = (nome) => osso(nome).getWorldPosition(new THREE.Vector3());
  const filho = (b) => b.children.find((c) => c.isBone);
  const hips = pos("Hips"), spine1 = pos("Spine1"), spine2 = pos("Spine2"), neck = pos("Neck"), head = pos("Head");
  const altura = osso("HeadTop_End") ? pos("HeadTop_End").y : head.y + (head.y - neck.y) * 2;   // (altura do corpo no mundo — as medidas abaixo são frações dela)
  const H = altura - Math.min(pos("LeftToeBase").y, pos("LeftFoot").y);
  const cintura = spine1.y, quadril = hips.y - H * 0.03, peito = spine2.y + H * 0.02;
  // a largura do tronco ao longo da altura (fator em x; em z um pouco menos)
  const largura = (y) => {
    const pts = [[quadril - H * 0.12, 1.0], [quadril, 1.09], [cintura - H * 0.02, 0.83], [peito, 0.88], [neck.y, 0.84]];
    if (y <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const t = (y - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]); return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t; }
    return pts[pts.length - 1][1];
  };
  const radial = { Shoulder: 0.82, Arm: 0.86, ForeArm: 0.87, Hand: 0.9, UpLeg: 0.95, Leg: 0.9, Foot: 0.92, ToeBase: 0.92, Neck: 0.86 };
  const TRONCO = new Set(["Hips", "Spine", "Spine1", "Spine2"]);
  const busto = { y: peito - H * 0.015, x: H * 0.055, frente: H * 0.024, raio: H * 0.048 };
  const centroZ = spine2.z;
  const v = new THREE.Vector3(), out = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), p = new THREE.Vector3(), acc = new THREE.Vector3();
  const nomeDe = sk.bones.map((x) => x.name.replace(/^mixamorig/, ""));
  for (let i = 0; i < P.length / 3; i++) {
    v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(mw);
    acc.set(0, 0, 0); let wt = 0;
    for (let c = 0; c < 4; c++) {
      const w = W[i * 4 + c]; if (w <= 0) continue;
      const bi = J[i * 4 + c], nome = nomeDe[bi], osso = sk.bones[bi];
      const tipo = nome.replace(/^(Left|Right)/, "").replace(/\d+$/, "").replace(/(Index|Middle|Ring|Pinky|Thumb)$/, "Hand");
      out.copy(v);
      if (TRONCO.has(nome) || (tipo === "UpLeg" && v.y > quadril - H * 0.1)) {
        const k = largura(v.y);
        out.x = v.x * k; out.z = centroZ + (v.z - centroZ) * (1 - (1 - k) * 0.6);
        if (nome === "Spine2" || nome === "Spine1") {   // o BUSTO: dois montes suaves na frente do peito
          const dz = v.z - centroZ;
          if (dz > 0) for (const s of [-1, 1]) {
            const r = Math.hypot(v.x - s * busto.x, v.y - busto.y) / busto.raio;
            if (r < 2) out.z += busto.frente * Math.exp(-r * r * 1.4) * Math.min(1, dz / (H * 0.03));
          }
        }
      } else if (tipo === "Head" || tipo === "HeadTop_End") {
        osso.getWorldPosition(a); a.y += H * 0.05; out.copy(a).addScaledVector(v.clone().sub(a), 0.95);   // (o capacete um pouco menor)
      } else if (radial[tipo]) {
        osso.getWorldPosition(a); const f = filho(osso); if (f) f.getWorldPosition(b); else b.copy(a);
        const ab = b.clone().sub(a), l2 = ab.lengthSq(), t = l2 > 0 ? Math.max(0, Math.min(1, v.clone().sub(a).dot(ab) / l2)) : 0;
        p.copy(a).addScaledVector(ab, t); out.copy(p).addScaledVector(v.clone().sub(p), radial[tipo]);
      }
      acc.addScaledVector(out, w); wt += w;
    }
    if (wt > 0) { acc.divideScalar(wt).applyMatrix4(inv); P[i * 3] = acc.x; P[i * 3 + 1] = acc.y; P[i * 3 + 2] = acc.z; }
  }
}

function simplificar(idx, P, alvo) {
  const [novo] = MeshoptSimplifier.simplify(new Uint32Array(idx), P, 3, Math.floor((idx.length * alvo) / 3) * 3, 0.01, ["LockBorder"]);
  return Array.from(novo);
}

async function montar(gltf, fem) {
  const d = juntar(gltf);
  if (fem) feminizar(d);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(d.P, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(d.N, 3));
  g.setAttribute("skinIndex", new THREE.BufferAttribute(d.J, 4));
  g.setAttribute("skinWeight", new THREE.BufferAttribute(d.W, 4));
  g.setAttribute("zona", new THREE.BufferAttribute(d.Z, 1));   // (o exportador põe "_ZONA"; o carregador lê "_zona")
  if (fem) { g.setIndex([...d.tris.corpo, ...d.tris.casco]); g.computeVertexNormals(); }   // (o corpo mudou de forma: as normais de novo)
  const mat = (nome, cor) => new THREE.MeshStandardMaterial({ name: nome, color: cor, roughness: 0.5, metalness: 0.1 });
  const traje = mat("traje", 0xd0cece), vidro = new THREE.MeshStandardMaterial({ name: "visera", color: 0x2a2320, transparent: true, opacity: 0.55 });
  const pai = d.principal.parent;
  const raiz = gltf.scene;
  const tirar = []; raiz.traverse((o) => { if (o.isSkinnedMesh) tirar.push(o); }); for (const o of tirar) o.removeFromParent();
  const pecas = [
    ["corpo", d.tris.corpo, traje], ["casco", d.tris.casco, traje], ["visera", d.tris.visera, vidro],
    ["corpo_leve", simplificar(d.tris.corpo, d.P, LEVE), traje], ["casco_leve", simplificar(d.tris.casco, d.P, LEVE * 1.4), traje],
  ];
  const info = [];
  for (const [nome, idx, m] of pecas) {
    const gg = new THREE.BufferGeometry();
    for (const k of Object.keys(g.attributes)) gg.setAttribute(k, g.attributes[k]);   // (os MESMOS vértices: o arquivo guarda uma vez)
    gg.setIndex(idx);
    const sm = new THREE.SkinnedMesh(gg, m); sm.name = nome;
    sm.position.copy(d.principal.position); sm.quaternion.copy(d.principal.quaternion); sm.scale.copy(d.principal.scale);
    pai.add(sm); sm.bind(d.sk, d.principal.bindMatrix);
    info.push(`${nome} ${idx.length / 3}`);
  }
  raiz.animations = [];
  const glb = await new Promise((ok, erro) => new GLTFExporter().parse(raiz, ok, erro, { binary: true, onlyVisible: false }));
  const saida = `${DIR}/traje-${fem ? "f" : "m"}.glb`;
  writeFileSync(saida, Buffer.from(glb));
  console.log(`${saida}: ${(glb.byteLength / 1e6).toFixed(2)} MB, ${d.Z.length} vértices — ${info.join(", ")} triângulos`);
}

await MeshoptSimplifier.ready;
await montar(await carregar(), false);
await montar(await carregar(), true);
