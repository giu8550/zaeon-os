/**
 * Separa a ARMA de um modelo de casca única (a feiticeira gerada por IA: corpo, capa e cajado numa malha só) e prepara
 * o CORPO pro rig automático do Mixamo.
 *
 *   node scripts/avatar/separar-cajado.mjs <decimado.glb> <saida-dir> <basecolor> "x1,y1,z1" "x2,y2,z2" [rCabeca=0.055] [yCabeca=0.79] [rHaste=0.014]
 *
 * - O cajado é o que está COLADO na linha reta do topo (x1,y1,z1) ao pé (x2,y2,z2): raio `rCabeca` acima de `yCabeca`
 *   (o cristal) e `rHaste` abaixo (fino: a mão que o segura fica no corpo). Um triângulo vai pro cajado se os 3 vértices
 *   estão dentro.
 * - Saídas: `corpo.obj` + `corpo.mtl` + a textura (o pacote pro Mixamo: suba o .zip) e `cajado.glb` (a peça, com as
 *   cores nos vértices — vai presa na mão no jogo); e `corpo.glb` pra conferir o corte.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import sharp from "sharp";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js";

globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); } };

const [entrada, saidaDir, tex, a1, a2, rC = "0.055", yC = "0.79", rH = "0.014"] = process.argv.slice(2);
if (!entrada || !saidaDir || !tex || !a1 || !a2) { console.error("uso: node separar-cajado.mjs <glb> <dir> <basecolor> x1,y1,z1 x2,y2,z2 [rCabeca] [yCabeca] [rHaste]"); process.exit(1); }
mkdirSync(saidaDir, { recursive: true });
const b = readFileSync(entrada);
const g = await new Promise((ok, e) => new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", ok, e));
let mesh; g.scene.traverse((o) => { if (o.isMesh) mesh = o; });
const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index.array;
const A = new THREE.Vector3(...a1.split(",").map(Number)), B = new THREE.Vector3(...a2.split(",").map(Number)), AB = B.clone().sub(A);
const dentro = (i) => {
  const p = new THREE.Vector3().fromBufferAttribute(pos, i), t = Math.max(0, Math.min(1, p.clone().sub(A).dot(AB) / AB.lengthSq()));
  return p.distanceTo(A.clone().addScaledVector(AB, t)) < (p.y > Number(yC) ? Number(rC) : Number(rH));
};
const ehCajado = new Uint8Array(pos.count); for (let i = 0; i < pos.count; i++) ehCajado[i] = dentro(i) ? 1 : 0;
const corpoI = [], cajadoI = [];
for (let t = 0; t < idx.length; t += 3) (ehCajado[idx[t]] && ehCajado[idx[t + 1]] && ehCajado[idx[t + 2]] ? cajadoI : corpoI).push(idx[t], idx[t + 1], idx[t + 2]);
// as LASCAS: pedaços que sobraram soltos do corpo depois do corte (enfeites do cristal fora do raio) vão pro cajado —
// ilhas do corpo com menos de 2% dos triângulos
{
  const chave = (i) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const rep = new Map(), raizV = new Int32Array(pos.count); for (let i = 0; i < pos.count; i++) { const k = chave(i); if (!rep.has(k)) rep.set(k, i); raizV[i] = rep.get(k); }
  const pai = Int32Array.from({ length: pos.count }, (_, i) => i), ach = (x) => { while (pai[x] !== x) { pai[x] = pai[pai[x]]; x = pai[x]; } return x; };
  for (let t = 0; t < corpoI.length; t += 3) { const a0 = ach(raizV[corpoI[t]]); pai[ach(raizV[corpoI[t + 1]])] = a0; pai[ach(raizV[corpoI[t + 2]])] = a0; }
  const n = new Map(); for (let t = 0; t < corpoI.length; t += 3) { const r = ach(raizV[corpoI[t]]); n.set(r, (n.get(r) ?? 0) + 1); }
  const total = corpoI.length / 3, fica = [];
  for (let t = 0; t < corpoI.length; t += 3) (n.get(ach(raizV[corpoI[t]])) < total * 0.02 ? cajadoI : fica).push(corpoI[t], corpoI[t + 1], corpoI[t + 2]);
  corpoI.length = 0; corpoI.push(...fica);
}
const parte = (I, nome) => { const gg = geo.clone(); gg.setIndex(I); const m = new THREE.Mesh(gg, mesh.material); m.name = nome; return m; };
const corpo = parte(corpoI, "corpo"), cajado = parte(cajadoI, "cajado");

// o corpo pro Mixamo: OBJ (com as UVs) + MTL + a textura
const corpoSoUv = corpo.clone(); corpoSoUv.geometry = corpo.geometry.clone(); corpoSoUv.geometry.deleteAttribute("color");
corpoSoUv.material = new THREE.MeshStandardMaterial({ name: "feiticeira" });
writeFileSync(join(saidaDir, "corpo.obj"), "mtllib corpo.mtl\n" + new OBJExporter().parse(corpoSoUv).replace(/^o .*$/m, (l) => `${l}\nusemtl feiticeira`));
writeFileSync(join(saidaDir, "corpo.mtl"), "newmtl feiticeira\nKd 1 1 1\nmap_Kd textura.jpg\n");
await sharp(tex).resize(2048).jpeg({ quality: 88 }).toFile(join(saidaDir, "textura.jpg"));
// o cajado: a peça com as cores
const glbDe = async (m) => { const r = new THREE.Group(); r.add(m); return Buffer.from(await new Promise((ok, erro) => new GLTFExporter().parse(r, ok, erro, { binary: true }))); };
writeFileSync(join(saidaDir, "cajado.glb"), await glbDe(cajado));
writeFileSync(join(saidaDir, "corpo.glb"), await glbDe(corpo));   // (pra conferir o corte)
console.log(`corpo: ${corpoI.length / 3} triângulos · cajado: ${cajadoI.length / 3} triângulos → ${saidaDir}`);
