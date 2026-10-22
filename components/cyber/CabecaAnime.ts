/**
 * A CABEÇA DE ANIME de quem anda SEM CAPACETE (o traje único): a cabeça, o cabelo (o corte de lib/cyber/rosto) e o
 * rosto desenhado (olhos grandes com brilho, sobrancelhas, boca) — tudo GERADO (nenhum arquivo, nenhuma textura) e
 * barato: a cabeça e o cabelo numa malha só (cor por vértice, no desenho toon), o rosto noutra, mais o contorno de
 * tinta = 3 chamadas de desenho. A geometria de cada combinação é feita uma vez e dividida por todo mundo.
 *
 * Em METROS, com a origem no CENTRO da cabeça, +y pra cima e +z pra FRENTE.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { tintaFixa, toon } from "./AvatarAnime";
import type { Corte, Rosto } from "@/lib/cyber/rosto";

/** o raio da cabeça (m) — um pouco maior que a de verdade: o traje é parrudo e a cabeça de anime é grande */
export const RAIO_CABECA = 0.115;

const pintar = (g: THREE.BufferGeometry, cor: number) => {
  const g2 = g.index ? g.toNonIndexed() : g, c = new THREE.Color(cor), n = g2.attributes.position!.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  g2.setAttribute("color", new THREE.BufferAttribute(arr, 3)); g2.deleteAttribute("uv");
  return g2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// (CylinderGeometry: θ = 0 é a FRENTE (+z) — as cortinas começam e terminam dos lados, abertas na frente)
/** a altura do contorno do cabelo no crânio pelo ângulo em volta da cabeça (0 = frente, π = nuca) */
function corteDe(c: Corte) {
  switch (c) {
    case "raspado": return { frente: 0.5, lado: 0.12, nuca: -0.3, casca: 1.03 };
    case "topete": return { frente: 0.5, lado: 0.05, nuca: -0.35, casca: 1.08 };
    case "longo": return { frente: 0.42, lado: -0.2, nuca: -0.6, casca: 1.08 };
    case "chanel": return { frente: 0.36, lado: -0.25, nuca: -0.55, casca: 1.09 };
    case "rabo": case "coque": return { frente: 0.46, lado: 0.0, nuca: -0.45, casca: 1.06 };
    default: return { frente: 0.4, lado: 0.02, nuca: -0.4, casca: 1.09 };
  }
}

function geoCabelo(c: Corte, R: number): THREE.BufferGeometry[] {
  const k = corteDe(c), pecas: THREE.BufferGeometry[] = [];
  // a CASCA: uma esfera um pouco maior que a cabeça; abaixo do contorno os vértices entram na cabeça (somem)
  const casca = new THREE.SphereGeometry(R * k.casca, 24, 18), p = casca.attributes.position!, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.abs(Math.atan2(v.x, v.z)) / Math.PI;   // 0 frente .. 1 nuca
    const limite = (a < 0.5 ? lerp(k.frente, k.lado, a / 0.5) : lerp(k.lado, k.nuca, (a - 0.5) / 0.5)) * R;
    if (v.y < limite) v.multiplyScalar(0.55);   // (bem pra dentro: a cara é mais estreita que a esfera)
    p.setXYZ(i, v.x, v.y, v.z);
  }
  casca.computeVertexNormals(); pecas.push(casca);
  const mecha = (raio: number, alt: number, x: number, y: number, z: number, rx: number, rz: number, ry = 0) => {
    const g = new THREE.ConeGeometry(raio, alt, 5, 1); g.scale(1, 1, 0.55); g.rotateX(rx); g.rotateZ(rz); g.rotateY(ry); g.translate(x, y, z); pecas.push(g);
  };
  // a FRANJA: mechas apontando pra baixo na testa
  if (c !== "raspado") {
    const n = c === "chanel" ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5, ang = t * 1.5, alt = R * (c === "chanel" ? 0.5 : 0.42) * (1 - Math.abs(t) * 0.4);
      mecha(R * 0.26, alt, Math.sin(ang) * R * 0.98, R * 0.62, Math.cos(ang) * R * 0.96, Math.PI + 0.35, 0, 0);
    }
  }
  switch (c) {
    case "espetado":
      for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2; mecha(R * 0.2, R * 0.55, Math.sin(ang) * R * 0.55, R * 0.95, Math.cos(ang) * R * 0.55 - R * 0.1, -0.5 * Math.cos(ang) - 0.3, 0.5 * Math.sin(ang)); }
      break;
    case "topete": {
      const q = new THREE.SphereGeometry(R * 0.42, 12, 8); q.scale(1.4, 0.75, 1.1); q.rotateX(-0.4); q.translate(0, R * 0.95, R * 0.45); pecas.push(q); break;
    }
    case "longo": {   // a CORTINA de cabelo nas costas e as mechas que emolduram o rosto
      const cort = new THREE.CylinderGeometry(R * 1.02, R * 1.2, R * 1.7, 18, 1, true, Math.PI * 0.32, Math.PI * 1.36); cort.translate(0, -R * 0.7, -R * 0.05); pecas.push(cort);
      for (const s of [-1, 1]) mecha(R * 0.2, R * 1.1, s * R * 0.92, -R * 0.15, R * 0.35, Math.PI, 0);
      break;
    }
    case "chanel": {
      const sino = new THREE.CylinderGeometry(R * 1.08, R * 1.2, R * 0.95, 18, 1, true, Math.PI * 0.27, Math.PI * 1.46); sino.translate(0, -R * 0.25, 0); pecas.push(sino);
      break;
    }
    case "rabo": {
      const r = new THREE.CapsuleGeometry(R * 0.2, R * 1.2, 4, 10); r.scale(1, 1, 0.8); r.rotateX(0.55); r.translate(0, -R * 0.2, -R * 1.25); pecas.push(r);
      const laco = new THREE.TorusGeometry(R * 0.17, R * 0.05, 6, 12); laco.translate(0, R * 0.38, -R * 1.0); pecas.push(laco);
      break;
    }
    case "coque": {
      const b = new THREE.SphereGeometry(R * 0.42, 14, 10); b.translate(0, R * 0.75, -R * 0.7); pecas.push(b); break;
    }
  }
  return pecas;
}

function geoCabeca(R: number, fem: boolean): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(R, 24, 18), p = g.attributes.position!, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {   // o QUEIXO de anime: a parte de baixo da frente afina
    v.fromBufferAttribute(p, i); v.x *= 0.9; v.z *= 0.95;
    if (v.y < 0) { const t = -v.y / R; v.x *= 1 - t * (fem ? 0.42 : 0.32); if (v.z > 0) v.z *= 1 - t * 0.12; v.y *= 1.12; }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals(); return g;
}

/** o ROSTO desenhado: planos finos na frente da cabeça (os olhos, o brilho, as sobrancelhas, a boca) */
function geoRosto(r: Rosto, R: number): THREE.BufferGeometry {
  const pecas: THREE.BufferGeometry[] = [];
  const naFace = (g: THREE.BufferGeometry, x: number, y: number, camada: number, cor: number) => {
    // em cima da superfície da cabeça (a mesma conta de geoCabeca, aproximada), virada pra frente
    const z = Math.sqrt(Math.max(0, R * R - x * x / 0.81 - y * y)) * 0.95 + 0.0015 + camada * 0.0008;
    g.rotateY(Math.atan2(x, z) * 0.8); g.translate(x, y, z); pecas.push(pintar(g, cor));
  };
  const ew = R * (r.feminino ? 0.2 : 0.17), eh = R * (r.feminino ? 0.3 : 0.24), ey = -R * 0.12, ex = R * 0.36;
  for (const s of [-1, 1]) {
    const x = s * ex;
    const olho = new THREE.CircleGeometry(1, 18); olho.scale(ew, eh, 1); naFace(olho, x, ey, 0, 0x16121c);
    const iris = new THREE.CircleGeometry(1, 18); iris.scale(ew * 0.72, eh * 0.72, 1); naFace(iris, x, ey - eh * 0.12, 1, r.olhos);
    const pupila = new THREE.CircleGeometry(1, 12); pupila.scale(ew * 0.32, eh * 0.34, 1); naFace(pupila, x, ey - eh * 0.15, 2, 0x0c0a12);
    const brilho = new THREE.CircleGeometry(1, 10); brilho.scale(ew * 0.3, ew * 0.3, 1); naFace(brilho, x - s * ew * 0.25, ey + eh * 0.32, 3, 0xffffff);
    const sob = new THREE.PlaneGeometry(ew * 1.6, R * 0.035); sob.rotateZ(-s * (r.feminino ? 0.12 : 0.05)); naFace(sob, x + s * ew * 0.1, ey + eh + R * 0.12, 0, r.cabelo);
    if (r.feminino) { const cilio = new THREE.PlaneGeometry(ew * 2.1, R * 0.05); cilio.rotateZ(-s * 0.18); naFace(cilio, x + s * ew * 0.12, ey + eh * 0.9, 1, 0x16121c); }
  }
  const boca = new THREE.PlaneGeometry(R * 0.16, R * 0.03); naFace(boca, 0, -R * 0.62, 0, 0x7a3a3a);
  return mergeGeometries(pecas)!;
}

const cacheGeo = new Map<string, { corpo: THREE.BufferGeometry; rosto: THREE.BufferGeometry }>();
let mats: { pele: THREE.MeshToonMaterial; rosto: THREE.MeshBasicMaterial; tinta: THREE.MeshBasicMaterial } | null = null;

export type CabecaAnime = { grupo: THREE.Group; dispose(): void };

/** a cabeça de um rosto (a geometria é dividida por quem tem o mesmo; `dispose` só tira da cena) */
export function criarCabeca(r: Rosto): CabecaAnime {
  const R = RAIO_CABECA, k = `${r.corte}|${r.pele}|${r.cabelo}|${r.olhos}|${r.feminino ? 1 : 0}`;
  let geo = cacheGeo.get(k);
  if (!geo) {
    // (o PESCOÇO desce até dentro da gola do traje)
    const pescoco = new THREE.CylinderGeometry(R * (r.feminino ? 0.3 : 0.36), R * 0.42, R * 1.1, 12, 1, true); pescoco.translate(0, -R * 1.05, -R * 0.12);
    const corpo = mergeGeometries([pintar(geoCabeca(R, r.feminino), r.pele), pintar(pescoco, r.pele), ...geoCabelo(r.corte, R).map((g) => pintar(g, r.cabelo))])!;
    geo = { corpo, rosto: geoRosto(r, R) }; cacheGeo.set(k, geo);
  }
  if (!mats) {
    const pele = toon(0xffffff, { brilho: 0.18 }); pele.vertexColors = true;
    // (o rosto não escurece tanto quanto a armadura: a sombra do desenho vira um meio-tom leve — senão metade da cara some)
    const base = pele.onBeforeCompile;
    pele.onBeforeCompile = (sh, r) => { base.call(pele, sh, r); sh.fragmentShader = sh.fragmentShader.replace("outgoingLight = diffuseColor.rgb * faixa", "outgoingLight = diffuseColor.rgb * mix(0.82, 1.0, faixa)"); };
    pele.customProgramCacheKey = () => "cabecaAnime"; pele.side = THREE.DoubleSide;   // (as cortinas de cabelo são abertas: o lado de dentro aparece)
    mats = { pele, rosto: new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), tinta: tintaFixa(0.004) };
  }
  const grupo = new THREE.Group(); grupo.name = "cabecaAnime";
  const corpo = new THREE.Mesh(geo.corpo, mats.pele), tinta = new THREE.Mesh(geo.corpo, mats.tinta), rosto = new THREE.Mesh(geo.rosto, mats.rosto);
  for (const m of [corpo, tinta, rosto]) { m.frustumCulled = false; grupo.add(m); }
  return { grupo, dispose() { grupo.removeFromParent(); } };
}
