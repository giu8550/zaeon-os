/**
 * Converte um FBX de animação do Mixamo ("Without Skin", 30 fps, sem keyframe reduction) num clipe JSON do three
 * (THREE.AnimationClip.toJSON) que toca no esqueleto do avatar do cyberespaço (o Soldier.glb do three: mixamo, com o
 * quadril dentro de um nó girado −90° em X e em centímetros).
 *
 *   node scripts/anim/mixamo-para-clip.mjs "<arquivo.fbx>" <nome> public/anim/<nome>.json
 *
 * - NO LUGAR: o avanço do quadril (x/z) sai — quem anda é o jogo (sem isso, ela andaria sozinha e deslizaria);
 * - o QUADRIL vai pro referencial do Soldier: rotação e posição giradas +90° em X (Y pra cima → Z pra cima) e meia
 *   volta em Y (o personagem do Mixamo olha pro +Z, o do jogo pro −Z);
 * - os outros ossos são as rotações locais do mixamo (o mesmo padrão nos dois esqueletos);
 * - o ciclo FECHA (o último quadro = o primeiro) e os números são arredondados (arquivo menor).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const [entrada, nome, saida] = process.argv.slice(2);
if (!entrada || !nome || !saida) { console.error("uso: node mixamo-para-clip.mjs <fbx> <nome> <saida.json>"); process.exit(1); }
const buf = readFileSync(entrada);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
const clip = obj.animations[0]; if (!clip) throw new Error("sem animação no FBX");
// Y pra cima → Z pra cima (o nó do Soldier) e MEIA VOLTA (o personagem do Mixamo olha pro +Z; o do jogo, pro −Z)
const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
const q = new THREE.Quaternion(), v = new THREE.Vector3(), r4 = (x) => Math.round(x * 1e4) / 1e4;
const tracks = [];
for (const t of clip.tracks) {
  const osso = t.name.split(".")[0], prop = t.name.split(".").pop();
  if (prop === "scale") continue;
  if (prop === "position" && osso !== "mixamorigHips") continue;   // só o quadril se move
  const valores = Float32Array.from(t.values);
  if (osso === "mixamorigHips" && prop === "position") {
    for (let i = 0; i < valores.length; i += 3) { v.set(0, valores[i + 1], 0).applyQuaternion(giro); valores[i] = v.x; valores[i + 1] = v.y; valores[i + 2] = v.z; }   // no lugar (x/z do avanço fora) e girado
  } else if (osso === "mixamorigHips" && prop === "quaternion") {
    for (let i = 0; i < valores.length; i += 4) { q.fromArray(valores, i).premultiply(giro); q.toArray(valores, i); }
  }
  // fecha o ciclo: o último quadro = o primeiro
  const n = t.times.length, k = valores.length / n;
  for (let c = 0; c < k; c++) valores[(n - 1) * k + c] = valores[c];
  const T = prop === "quaternion" ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  tracks.push(new T(t.name, Array.from(t.times, r4), Array.from(valores, r4)));
}
const out = new THREE.AnimationClip(nome, clip.duration, tracks);
writeFileSync(saida, JSON.stringify(THREE.AnimationClip.toJSON(out)));
console.log(`${nome}: ${clip.duration.toFixed(2)} s, ${tracks.length} trilhas → ${saida}`);
