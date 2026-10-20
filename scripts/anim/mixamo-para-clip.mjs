/**
 * Converte um FBX de animação do Mixamo ("Without Skin", 30 fps, sem keyframe reduction) num clipe JSON do three
 * (THREE.AnimationClip.toJSON) que toca no esqueleto do avatar do cyberespaço (o Soldier.glb do three: mixamo, com o
 * quadril dentro de um nó girado −90° em X e em centímetros).
 *
 *   node scripts/anim/mixamo-para-clip.mjs "<arquivo.fbx>" <nome> public/anim/<nome>.json [alturaDoQuadril_cm] [--laco|--golpe] [--sem-giro]
 *
 * - `--laco` / `--golpe` forçam o tipo (sem eles, vai pelo nome do arquivo: idle/walk/run = laço);
 * - `--sem-giro`: a VIRADA do corpo (o quadril girando em torno do eixo vertical ao longo do clipe — o "Rifle Turn") sai
 *   do clipe e vai pro JSON (`giro`, rad, + = pra esquerda): quem gira o corpo é o jogo, junto com o clipe;
 * - ALTURA: o personagem do Mixamo pode ter o quadril noutra altura (92,5 cm no das magias; o do jogo, 106) — tudo do
 *   quadril é escalado por `ALTURA_DO_JOGO / alturaDoQuadril` (o 4º argumento; sem ele, a altura do 1º quadro). Sem
 *   isso o corpo afundava ou flutuava (a "falha no quadril" do catwalk);
 * - ANDA SOZINHA ou não: se o quadril termina longe de onde começou (> 20 cm), o avanço sai (quem move é o jogo — e o
 *   empurrão vira um recuo controlado pelo jogo); se não, o BALANÇO do corpo fica (o ataque inclina, o idle oscila);
 * - NO LUGAR: o avanço do quadril (x/z) sai — quem anda é o jogo (sem isso, ela andaria sozinha e deslizaria);
 * - o QUADRIL vai pro referencial do Soldier: rotação e posição giradas +90° em X (Y pra cima → Z pra cima) e meia
 *   volta em Y (o personagem do Mixamo olha pro +Z, o do jogo pro −Z);
 * - os outros ossos são as rotações locais do mixamo (o mesmo padrão nos dois esqueletos);
 * - o ciclo FECHA nos laços (o último quadro = o primeiro); os DEDOS saem, os quadros repetidos também e os números são
 *   arredondados (arquivo menor).
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const flags = process.argv.slice(2).filter((a) => a.startsWith("--")), [entrada, nome, saida, alturaArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
/** a altura (cm) do quadril do Soldier em pé, no referencial dele (Z pra cima) */
const ALTURA_DO_JOGO = 106.13;
if (!entrada || !nome || !saida) { console.error("uso: node mixamo-para-clip.mjs <fbx> <nome> <saida.json>"); process.exit(1); }
const buf = readFileSync(entrada);
const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
// (alguns FBX trazem um "Take 001" vazio antes do clipe de verdade: fica o que tem mais trilhas)
const clip = [...obj.animations].sort((x, y) => y.tracks.length - x.tracks.length)[0]; if (!clip || !clip.tracks.length) throw new Error("sem animação no FBX");
// Y pra cima → Z pra cima (o nó do Soldier) e MEIA VOLTA (o personagem do Mixamo olha pro +Z; o do jogo, pro −Z)
const giroSoldier = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
const q = new THREE.Quaternion(), v = new THREE.Vector3(), r4 = (x) => Math.round(x * 1e3) / 1e3;
/** os DEDOS (≈30 das 53 trilhas): quase não aparecem no avatar e pesam o arquivo — saem */
const DEDO = /Thumb|Index|Middle|Ring|Pinky/;
/** é um LAÇO? (idle, andar, correr — repete) ou um GOLPE (toca uma vez) */
const laco = flags.includes("--laco") || (!flags.includes("--golpe") && /idle|walk|run|loop/i.test(entrada) && !/to standing|start|land|stop/i.test(entrada));
const semGiro = flags.includes("--sem-giro");
/** o rumo (rad, em torno do Y do Mixamo) da frente do quadril num quaternion */
const rumoDe = (qq) => { const f = new THREE.Vector3(0, 0, 1).applyQuaternion(qq); return Math.atan2(f.x, f.z); };
let giro = 0;
const tracks = [];
const hp = clip.tracks.find((t) => t.name === "mixamorigHips.position");
const y0 = hp ? hp.values[1] : ALTURA_DO_JOGO, x0 = hp ? hp.values[0] : 0, z0 = hp ? hp.values[2] : 0;
const k = ALTURA_DO_JOGO / (Number(alturaArg) || y0);
const nHp = hp ? hp.values.length / 3 : 0;
const andaSozinha = hp ? Math.hypot(hp.values[(nHp - 1) * 3] - x0, hp.values[(nHp - 1) * 3 + 2] - z0) > 20 : false;
/** o deslocamento total (m, no chão do personagem: x = pro lado, z = pra frente) — o jogo aplica como recuo/avanço */
const deslocamento = hp ? { x: +((hp.values[(nHp - 1) * 3] - x0) / 100).toFixed(3), z: +((hp.values[(nHp - 1) * 3 + 2] - z0) / 100).toFixed(3) } : { x: 0, z: 0 };
for (const t of clip.tracks) {
  const osso = t.name.split(".")[0], prop = t.name.split(".").pop();
  if (prop === "scale" || DEDO.test(osso)) continue;
  if (prop === "position" && osso !== "mixamorigHips") continue;   // só o quadril se move
  const valores = Float32Array.from(t.values);
  if (osso === "mixamorigHips" && prop === "position") {
    for (let i = 0; i < valores.length; i += 3) {
      const dx = andaSozinha ? 0 : (valores[i] - x0) * k, dz = andaSozinha ? 0 : (valores[i + 2] - z0) * k;   // o balanço fica; o avanço, não
      v.set(dx, valores[i + 1] * k, dz).applyQuaternion(giroSoldier); valores[i] = v.x; valores[i + 1] = v.y; valores[i + 2] = v.z;
    }
  } else if (osso === "mixamorigHips" && prop === "quaternion") {
    const r0 = rumoDe(q.fromArray(valores, 0)), desfaz = new THREE.Quaternion(), eixoY = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < valores.length; i += 4) {
      q.fromArray(valores, i);
      if (semGiro) { let d = rumoDe(q) - r0; d = Math.atan2(Math.sin(d), Math.cos(d)); if (i === valores.length - 4) giro = d; q.premultiply(desfaz.setFromAxisAngle(eixoY, -d)); }   // (a virada sai: o jogo gira)
      q.premultiply(giroSoldier); q.toArray(valores, i);
    }
  }
  // fecha o ciclo (só nos LAÇOS — os idles, os andares): o último quadro = o primeiro
  const n = t.times.length, tam = valores.length / n;
  if (laco) for (let c = 0; c < tam; c++) valores[(n - 1) * tam + c] = valores[c];
  const T = prop === "quaternion" ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  const tr = new T(t.name, Array.from(t.times, r4), Array.from(valores, r4)); tr.optimize();   // (sem os quadros repetidos)
  tracks.push(tr);
}
const out = new THREE.AnimationClip(nome, clip.duration, tracks);
writeFileSync(saida, JSON.stringify({ ...THREE.AnimationClip.toJSON(out), deslocamento, laco, ...(semGiro ? { giro: +giro.toFixed(3) } : {}) }));
console.log(`${nome}: ${clip.duration.toFixed(2)} s, ${tracks.length} trilhas, escala ${k.toFixed(3)}, ${andaSozinha ? `anda ${JSON.stringify(deslocamento)} m (o jogo move)` : "no lugar"}${laco ? ", laço" : ""}${semGiro ? `, giro ${(giro * 180 / Math.PI).toFixed(0)}°` : ""} → ${saida}`);
