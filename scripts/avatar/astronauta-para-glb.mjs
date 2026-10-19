/**
 * Converte o FBX de um ASTRONAUTA já riggado no Mixamo (o esqueleto `mixamorig*`, o mesmo do avatar do cyberespaço) num
 * GLB LEVE pro jogo: a MALHA e a SKIN ficam intactas (os mesmos polígonos, os mesmos pesos); saem as TEXTURAS (PBR de
 * 2048², dezenas de MB), as UVs, as animações embutidas e os nós vazios; os vértices repetidos viram um índice. Cada
 * material vira uma COR CHAPADA — a cor média da textura base daquela peça (passada no mapa abaixo) — com
 * rugosidade/metal por tipo de peça.
 *
 *   node scripts/avatar/astronauta-para-glb.mjs <entrada.fbx> <saida.glb> <cores.json>
 *
 * `cores.json`: { "<pedaço do nome do material>": { "cor": "#rrggbb", "rug": 0..1, "metal": 0..1, "vidro"?: true } } —
 * o primeiro pedaço que aparecer no nome do material vale; sem nenhum, cinza.
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// (o GLTFExporter usa FileReader pra montar o binário — o Node não tem)
globalThis.FileReader ??= class { readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type};base64,${Buffer.from(r).toString("base64")}`; this.onloadend?.(); }); } };
THREE.TextureLoader.prototype.load = () => new THREE.Texture();   // (as texturas não vêm)

const [entrada, saida, coresArq] = process.argv.slice(2);
if (!entrada || !saida || !coresArq) { console.error("uso: node astronauta-para-glb.mjs <fbx> <glb> <cores.json>"); process.exit(1); }
const cores = JSON.parse(readFileSync(coresArq, "utf8"));
const buf = readFileSync(entrada);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
obj.animations = [];

const feitos = new Map();
const material = (nome) => {
  const chave = Object.keys(cores).find((k) => nome.includes(k));
  const c = chave ? cores[chave] : { cor: "#8a8a8a", rug: 0.6, metal: 0.1 };
  if (feitos.has(chave ?? "?")) return feitos.get(chave ?? "?");
  const m = new THREE.MeshStandardMaterial({ name: chave ?? "outro", color: c.cor, roughness: c.rug ?? 0.6, metalness: c.metal ?? 0.1, ...(c.vidro ? { transparent: true, opacity: 0.55 } : {}) });
  feitos.set(chave ?? "?", m); return m;
};
const fora = [];
let tris = 0;
obj.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry, n = (g.index ? g.index.count : g.attributes.position.count) / 3;
  if (n < 1) { fora.push(o); return; }
  tris += n;
  for (const a of Object.keys(g.attributes)) if (!["position", "normal", "skinIndex", "skinWeight"].includes(a)) g.deleteAttribute(a);   // (sem UV: não há textura)
  o.geometry = mergeVertices(g, 1e-5);   // (o FBX vem com cada triângulo com os próprios vértices: indexa — os MESMOS triângulos, ~1/3 do tamanho)
  o.material = Array.isArray(o.material) ? o.material.map((m) => material(m.name)) : material(o.material.name);
});
for (const o of fora) o.removeFromParent();

const glb = await new Promise((ok, erro) => new GLTFExporter().parse(obj, ok, erro, { binary: true, onlyVisible: false }));
writeFileSync(saida, Buffer.from(glb));
console.log(`${saida}: ${(glb.byteLength / 1e6).toFixed(2)} MB, ${Math.round(tris)} triângulos, materiais: ${[...feitos.keys()].join(", ")}`);
