/**
 * SIMPLIFICA um modelo pesado (os gerados por IA vêm com milhões de triângulos) pra um tamanho de jogo, mantendo a
 * forma e a costura das UVs (meshoptimizer `simplifyWithAttributes`), e assa a TEXTURA nas cores dos vértices (sem
 * imagem no arquivo). Pra ver a forma e como base do rig (scripts/avatar/rigar-eve.mjs faz o resto).
 *
 *   node scripts/avatar/decimar.mjs <entrada.fbx> <basecolor.(png|jpg)> <saida.glb> [triângulos=30000]
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import sharp from "sharp";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MeshoptSimplifier } from "meshoptimizer";

globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); } };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const [entrada, texArq, saida, alvoArg] = process.argv.slice(2);
if (!entrada || !texArq || !saida) { console.error("uso: node decimar.mjs <fbx> <basecolor> <saida.glb> [triângulos]"); process.exit(1); }
const alvo = Number(alvoArg ?? 30000);
const buf = readFileSync(entrada);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
obj.updateMatrixWorld(true);
const tex = await sharp(texArq).raw().toBuffer({ resolveWithObject: true });
const { width: TW, height: TH, channels: TC } = tex.info;
const cor = (u, v) => { const x = Math.min(TW - 1, Math.max(0, Math.round((((u % 1) + 1) % 1) * (TW - 1)))), y = Math.min(TH - 1, Math.max(0, Math.round((1 - (((v % 1) + 1) % 1)) * (TH - 1)))), i = (y * TW + x) * TC; return [tex.data[i] / 255, tex.data[i + 1] / 255, tex.data[i + 2] / 255]; };

await MeshoptSimplifier.ready; MeshoptSimplifier.useExperimentalFeatures = true;
const raiz = new THREE.Group(); raiz.name = "modelo";
let antes = 0, depois = 0;
const meshes = []; obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
for (const o of meshes) {
  let g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
  g.deleteAttribute("normal");
  for (const a of Object.keys(g.attributes)) if (!["position", "uv"].includes(a)) g.deleteAttribute(a);
  g = mergeVertices(g, 1e-6);
  const idx = new Uint32Array(g.index.array), pos = new Float32Array(g.attributes.position.array), uv = new Float32Array(g.attributes.uv.array);
  antes += idx.length / 3;
  const metaIdx = Math.min(idx.length, Math.round((alvo * 3) / meshes.length));
  const [novo] = MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, uv, 2, [0.5, 0.5], null, Math.max(3, Math.floor(metaIdx / 3) * 3), 0.05, []);
  depois += novo.length / 3;
  // compacta (só os vértices usados) e assa a cor da textura em cada vértice
  const usados = new Map(), P = [], U = [], C = [], I = [];
  for (const i of novo) {
    let j = usados.get(i);
    if (j === undefined) { j = usados.size; usados.set(i, j); P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); U.push(uv[i * 2], uv[i * 2 + 1]); const k = new THREE.Color().setRGB(...cor(uv[i * 2], uv[i * 2 + 1]), THREE.SRGBColorSpace); C.push(k.r, k.g, k.b); }   // (a textura é sRGB; a cor do vértice, linear)
    I.push(j);
  }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); ng.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  const cores = new THREE.Float32BufferAttribute(C, 3); ng.setAttribute("color", cores); ng.setIndex(I); ng.computeVertexNormals();
  const m = new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 })); m.name = o.name; raiz.add(m);
}
const glb = await new Promise((ok, erro) => new GLTFExporter().parse(raiz, ok, erro, { binary: true }));
writeFileSync(saida, Buffer.from(glb));
console.log(`${saida}: ${antes} → ${depois} triângulos, ${(glb.byteLength / 1e6).toFixed(2)} MB`);
