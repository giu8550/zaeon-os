/**
 * MandalaSagrada — o SHOW do lounge durante a música (roteiro puro em lib/cyber/showLounge). Em cima do DJ, do centro
 * do olho nasce uma MANDALA de GEOMETRIA SAGRADA (um plano, um shader): flor da vida → semente → cubo de Metatron → Sri
 * Yantra → hexagrama → árvore da vida → toro → espiral de Fibonacci → vesica piscis → merkaba, uma se fundindo na outra,
 * pulsando no grave, mais complexa (camadas em cima) e maior ao longo da faixa. Psicodélico, mas LIMPO: filamentos de
 * luz em curvas sinuosas, cores correndo devagar, sem tapar o céu. Em volta, ARTEFATOS brilhantes (pontos e anéis
 * finos orbitando) dão contraste.
 * De dentro dela saem SERPENTES (tubos animados no vertex shader, com escamas de luz) que rodeiam a parte de cima do
 * lounge; depois, TENTÁCULOS maiores (polvo) saem do centro e balançam no compasso, da direita pra esquerda, com as
 * ventosas acesas. `definir(estado, batida)` a cada quadro; o grupo fica no referencial da SALA (o centro = o olho).
 */
import * as THREE from "three";
import { FORMAS, type EstadoShow } from "@/lib/cyber/showLounge";

export type MandalaHandle = { group: THREE.Group; definir(e: EstadoShow, batida: number, t: number): void; dispose(): void };

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
/** as FORMAS, cada uma uma função de distância em luz (0..1), num plano −3..3 */
const FRAG = `
precision highp float;
uniform float uT, uB, uNasc, uComp, uMix, uForma, uProx, uLow;
varying vec2 vUv;
#define PI 3.14159265
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float linha(float d, float w) { return smoothstep(w, 0.0, abs(d)); }
float anel(vec2 p, vec2 c, float r, float w) { return linha(length(p - c) - r, w); }
float seg(vec2 p, vec2 a, vec2 b, float w) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return linha(length(pa - ba * h), w); }
float tri(vec2 p, float r, float w) { float a = atan(p.y, p.x), s = 2.0 * PI / 3.0; float d = cos(floor(0.5 + a / s) * s - a) * length(p) - r * 0.5; return linha(d, w); }
float poli(vec2 p, float n, float r, float w) { float a = atan(p.y, p.x), s = 2.0 * PI / n; float d = cos(floor(0.5 + a / s) * s - a) * length(p) - r; return linha(d, w); }
// a rede hexagonal (centros da flor da vida)
float florDaVida(vec2 p, float w) {
  float v = 0.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec2 c = vec2(float(i) + 0.5 * float(j), 0.8660254 * float(j));
    if (length(c) < 2.05) v += anel(p, c, 1.0, w);
  }
  v += anel(p, vec2(0.0), 3.0, w) + anel(p, vec2(0.0), 3.12, w * 0.7);
  return v;
}
float sementeDaVida(vec2 p, float w) {
  float v = anel(p, vec2(0.0), 1.0, w);
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0; v += anel(p, vec2(cos(a), sin(a)), 1.0, w); }
  return v + anel(p, vec2(0.0), 2.0, w) + anel(p, vec2(0.0), 2.1, w * 0.6);
}
float cuboDeMetatron(vec2 p, float w) {
  vec2 c[13]; c[0] = vec2(0.0);
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0 + PI / 6.0; c[1 + i] = vec2(cos(a), sin(a)); c[7 + i] = 2.0 * vec2(cos(a), sin(a)); }
  float v = 0.0;
  for (int i = 0; i < 13; i++) v += anel(p, c[i], 0.5, w);
  if (uLow < 0.5) { for (int i = 0; i < 13; i++) for (int j = 0; j < 13; j++) if (j > i) v += 0.55 * seg(p, c[i], c[j], w * 0.7); }
  else { for (int i = 7; i < 13; i++) for (int j = 0; j < 13; j++) if (j != i) v += 0.55 * seg(p, c[i], c[j], w * 0.7); }
  return v + anel(p, vec2(0.0), 2.55, w);
}
float sriYantra(vec2 p, float w) {
  float v = 0.0;
  // 4 triângulos pra cima e 5 pra baixo, entrelaçados
  v += tri(rot(PI / 2.0) * (p - vec2(0.0, 0.08)), 2.3, w) + tri(rot(PI / 2.0) * (p - vec2(0.0, -0.3)), 1.75, w) + tri(rot(PI / 2.0) * (p - vec2(0.0, -0.55)), 1.2, w) + tri(rot(PI / 2.0) * (p - vec2(0.0, -0.7)), 0.7, w);
  v += tri(rot(-PI / 2.0) * (p - vec2(0.0, -0.1)), 2.1, w) + tri(rot(-PI / 2.0) * (p - vec2(0.0, 0.25)), 1.6, w) + tri(rot(-PI / 2.0) * (p - vec2(0.0, 0.5)), 1.15, w) + tri(rot(-PI / 2.0) * (p - vec2(0.0, 0.65)), 0.75, w) + tri(rot(-PI / 2.0) * (p - vec2(0.0, 0.8)), 0.4, w);
  // o bindu, os lótus de 8 e 16 pétalas e o bhupura (a muralha)
  v += smoothstep(0.08, 0.0, length(p)) * 1.5;
  for (int i = 0; i < 16; i++) { float a = float(i) * PI / 8.0; vec2 q = rot(-a) * p; float petala = linha(length((q - vec2(1.45, 0.0)) * vec2(1.0, 2.6)) - 0.28, w * 1.6); v += petala * (i < 8 || uComp > 0.3 ? 1.0 : 0.0); }
  v += anel(p, vec2(0.0), 1.3, w) + anel(p, vec2(0.0), 1.8, w) + anel(p, vec2(0.0), 2.4, w);
  v += poli(p, 4.0, 2.75, w) + poli(p, 4.0, 2.9, w * 0.8);
  return v;
}
float hexagrama(vec2 p, float w) { return tri(rot(PI / 2.0) * p, 2.4, w) + tri(rot(-PI / 2.0) * p, 2.4, w) + anel(p, vec2(0.0), 1.2, w) + anel(p, vec2(0.0), 2.4, w) + poli(p, 6.0, 2.75, w); }
float arvoreDaVida(vec2 p, float w) {
  vec2 s[10];
  s[0] = vec2(0.0, 2.6); s[1] = vec2(1.0, 1.9); s[2] = vec2(-1.0, 1.9); s[3] = vec2(1.0, 0.7); s[4] = vec2(-1.0, 0.7); s[5] = vec2(0.0, 0.1);
  s[6] = vec2(1.0, -0.9); s[7] = vec2(-1.0, -0.9); s[8] = vec2(0.0, -1.5); s[9] = vec2(0.0, -2.7);
  float v = 0.0;
  for (int i = 0; i < 10; i++) { v += anel(p, s[i], 0.32, w) + smoothstep(0.12, 0.0, length(p - s[i])) * 0.8; }
  // os 22 caminhos
  v += seg(p, s[0], s[1], w) + seg(p, s[0], s[2], w) + seg(p, s[0], s[5], w) + seg(p, s[1], s[2], w) + seg(p, s[1], s[3], w) + seg(p, s[1], s[5], w) + seg(p, s[2], s[4], w) + seg(p, s[2], s[5], w);
  v += seg(p, s[3], s[4], w) + seg(p, s[3], s[5], w) + seg(p, s[3], s[6], w) + seg(p, s[4], s[5], w) + seg(p, s[4], s[7], w) + seg(p, s[5], s[6], w) + seg(p, s[5], s[7], w) + seg(p, s[5], s[8], w);
  v += seg(p, s[6], s[7], w) + seg(p, s[6], s[8], w) + seg(p, s[7], s[8], w) + seg(p, s[8], s[9], w) + seg(p, s[6], s[9], w) * 0.5 + seg(p, s[7], s[9], w) * 0.5;
  // os 3 pilares
  v += 0.35 * (seg(p, vec2(1.0, 2.1), vec2(1.0, -1.1), w * 2.5) + seg(p, vec2(-1.0, 2.1), vec2(-1.0, -1.1), w * 2.5));
  return v;
}
float toro(vec2 p, float w) {
  float v = 0.0;
  for (int i = 0; i < 24; i++) { float a = float(i) * PI / 12.0 + uT * 0.05; v += anel(p, 0.95 * vec2(cos(a), sin(a)), 1.25, w * 0.8); }
  return v * 0.7 + anel(p, vec2(0.0), 2.2, w) + anel(p, vec2(0.0), 0.3, w);
}
float espiral(vec2 p, float w) {
  float r = length(p), a = atan(p.y, p.x), b = 0.3063489;   // o fator áureo (phi^(2/pi))
  float v = 0.0;
  for (int k = 0; k < 4; k++) { float ak = a + float(k) * PI / 2.0 + uT * 0.12; float n = (log(max(r, 0.02)) / b - ak) / (2.0 * PI); v += linha(fract(n) - 0.5, 0.045) * smoothstep(0.02, 0.2, r) * smoothstep(3.0, 2.2, r); }
  // os quadrados áureos
  float q = 2.6; vec2 c = vec2(0.0);
  for (int k = 0; k < 6; k++) { v += 0.6 * (linha(max(abs(p.x - c.x), abs(p.y - c.y)) - q * 0.5, w * 0.8)); c += vec2(q * 0.191, -q * 0.118) * (mod(float(k), 2.0) * 2.0 - 1.0); q *= 0.618; }
  return v;
}
float vesica(vec2 p, float w) {
  float v = anel(p, vec2(-0.75, 0.0), 1.5, w) + anel(p, vec2(0.75, 0.0), 1.5, w) + anel(p, vec2(0.0), 1.5, w * 0.7);
  v += seg(p, vec2(0.0, 1.3), vec2(0.0, -1.3), w) + seg(p, vec2(-2.25, 0.0), vec2(2.25, 0.0), w * 0.7);
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0; v += 0.5 * anel(p, 0.75 * vec2(cos(a), sin(a)), 1.5, w * 0.7); }
  return v + anel(p, vec2(0.0), 2.7, w);
}
float merkaba(vec2 p, float w) {
  float v = tri(rot(PI / 2.0) * p, 2.6, w) + tri(rot(-PI / 2.0) * p, 2.6, w) + poli(p, 6.0, 1.3, w);
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0; v += seg(p, vec2(0.0), 1.3 * vec2(cos(a), sin(a)), w * 0.8) + seg(p, 1.3 * vec2(cos(a), sin(a)), 1.3 * vec2(cos(a + PI / 3.0), sin(a + PI / 3.0)), w); }
  return v + anel(p, vec2(0.0), 2.75, w);
}
float forma(float id, vec2 p, float w) {
  int i = int(id + 0.5);
  if (i == 0) return florDaVida(p, w); if (i == 1) return sementeDaVida(p, w); if (i == 2) return cuboDeMetatron(p, w); if (i == 3) return sriYantra(p, w);
  if (i == 4) return hexagrama(p, w); if (i == 5) return arvoreDaVida(p, w); if (i == 6) return toro(p, w); if (i == 7) return espiral(p, w);
  if (i == 8) return vesica(p, w); return merkaba(p, w);
}
void main() {
  vec2 p = (vUv - 0.5) * 6.6;
  float r = length(p), a = atan(p.y, p.x);
  float pulso = 1.0 - 0.05 * uB;
  vec2 q = rot(uT * 0.03) * p / pulso;
  float w = 0.042 + 0.014 * uB;
  float v = mix(forma(uForma, q, w), forma(uProx, q, w), uMix);
  // a complexidade: uma 2ª camada menor girando ao contrário e anéis finos em volta
  float v2 = mix(forma(uProx, rot(-uT * 0.07) * q * 2.3, w * 1.6), forma(uForma, rot(-uT * 0.07) * q * 2.3, w * 1.6), uMix) * smoothstep(0.0, 1.0, uComp) * 0.35 * smoothstep(1.4, 0.6, r);
  float aneis = linha(sin(r * 14.0 - uT * 1.2) * 0.5, 0.06) * smoothstep(2.6, 3.0, r) * smoothstep(3.3, 3.05, r) * uComp * 0.5;
  // o nascimento: do centro pra fora
  float nasc = smoothstep(uNasc * 3.4, uNasc * 3.4 - 0.5, r);
  float luz = (v + v2 + aneis) * nasc;
  // as cores: correm devagar com o raio e o ângulo; o grave acende
  vec3 cor = hsv(fract(0.62 + r * 0.09 - uT * 0.04 + 0.08 * sin(a * 3.0 + uT * 0.3)), 0.72, 1.0);
  vec3 col = cor * luz * (1.15 + 1.1 * uB) + vec3(0.9, 0.85, 1.0) * luz * luz * 0.5;
  col += vec3(1.0, 0.95, 0.8) * smoothstep(0.1, 0.0, r) * (1.5 + 2.0 * uB) * step(0.01, uNasc);   // o ponto do centro (de onde tudo nasce)
  col *= smoothstep(3.3, 2.9, r);
  gl_FragColor = vec4(col, 1.0);
}`;

/** uma CRIATURA (serpente ou tentáculo): um cilindro fino esticado ao longo de um caminho calculado no vertex shader */
const VERT_CRIATURA = `
uniform float uT, uB, uProg, uFase, uRaio, uAlt, uComp, uTipo, uGiro;
varying float vU; varying float vLado; varying vec3 vN;
#define PI 3.14159265
vec3 caminho(float u) {
  if (uTipo < 0.5) {   // SERPENTE: rodeia a parte de cima do lounge, ondulando; sai da mandala (o centro) conforme uProg
    float a = uFase + u * 2.4 + uT * 0.18 * uGiro, rr = uRaio * (1.0 + 0.08 * sin(u * 9.0 + uT * 1.5));
    vec3 p = vec3(cos(a) * rr, uAlt + 3.5 * sin(u * 7.0 + uT * 1.3 + uFase), sin(a) * rr);
    float sai = clamp(uProg * 1.6 - u * 0.6, 0.0, 1.0); sai = sai * sai * (3.0 - 2.0 * sai);
    return mix(vec3(0.0), p, sai);
  }
  // TENTÁCULO: sai do centro, abre pra fora e pra baixo, balança da direita pra esquerda no compasso
  float bal = sin(uT * 0.9 + uFase) * (0.55 + 0.25 * uB), curva = u * u;
  float a = uFase + bal * (0.3 + 0.9 * u), rr = uRaio * u * uProg;
  vec3 p = vec3(cos(a) * rr, -uAlt * curva * uProg + 2.5 * sin(u * 5.0 + uT * 1.1 + uFase) * u, sin(a) * rr);
  return p;
}
void main() {
  float u = position.y + 0.5; vU = u;
  vec3 c = caminho(u), c2 = caminho(min(1.0, u + 0.01));
  vec3 t = normalize(c2 - c + vec3(1e-4)), up = vec3(0.0, 1.0, 0.0), n = normalize(cross(t, up)), b = cross(n, t);
  float raio = uTipo < 0.5 ? (0.55 + 0.35 * (1.0 - smoothstep(0.0, 0.12, u)) * 0.0 + 0.5 * smoothstep(1.0, 0.75, u) * (0.6 + 0.4 * smoothstep(0.0, 0.1, u))) : (1.6 * (1.0 - u) * (1.0 - u) + 0.08);
  if (uTipo < 0.5) raio = 0.42 + 0.38 * smoothstep(0.0, 0.1, u) * smoothstep(1.0, 0.8, u);   // a cabeça e a cauda mais finas
  vec3 pos = c + n * position.x * raio + b * position.z * raio;
  vN = n * position.x + b * position.z; vLado = atan(position.z, position.x);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;
const FRAG_CRIATURA = `
uniform float uT, uB, uTipo, uFase; uniform vec3 uCor;
varying float vU; varying float vLado; varying vec3 vN;
void main() {
  float escamas = uTipo < 0.5 ? smoothstep(0.35, 0.5, abs(fract(vU * 60.0 - uT * 0.6) - 0.5)) * smoothstep(0.3, 0.5, abs(fract(vLado * 1.2732 + vU * 60.0) - 0.5)) : 0.0;
  float ventosas = uTipo < 0.5 ? 0.0 : smoothstep(0.18, 0.05, length(vec2(fract(vU * 26.0) - 0.5, (vLado / 3.14159) * 0.9)) ) * step(0.0, -cos(vLado + 1.57));
  float borda = pow(1.0 - abs(cos(vLado)), 2.0);   // as laterais acesas (o filamento), o dorso escuro
  vec3 cor = uCor * (0.25 + 0.75 * borda) + vec3(1.0) * escamas * 0.6 + vec3(1.0, 0.95, 0.8) * ventosas * (0.9 + 0.8 * uB);
  float a = 0.35 + 0.65 * borda + escamas * 0.3 + ventosas;
  gl_FragColor = vec4(cor * (0.8 + 0.5 * uB) * a, 1.0);
}`;

export function criarMandala(o: { low: boolean; estrela?: THREE.Texture; tam?: number }): MandalaHandle {
  const g = new THREE.Group(); g.name = "mandala-sagrada";
  const tam = o.tam ?? 44, geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const uni = { uT: { value: 0 }, uB: { value: 0 }, uNasc: { value: 0 }, uComp: { value: 0 }, uMix: { value: 0 }, uForma: { value: 0 }, uProx: { value: 1 }, uLow: { value: o.low ? 1 : 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }); mats.push(mat);
  const geo = new THREE.PlaneGeometry(tam, tam); geos.push(geo);
  const plano = new THREE.Mesh(geo, mat); plano.renderOrder = 4; plano.frustumCulled = false; g.add(plano);
  // os ARTEFATOS: pontos de luz orbitando (contraste) e 3 anéis finos inclinados
  const linhaMat = (cor: number, op: number) => { const m = new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); return m; };
  const aneis = [0xffe7a8, 0x9affd0, 0xff9ad5].map((c, i) => { const pts: THREE.Vector3[] = []; const R = tam * (0.5 + i * 0.07), n = o.low ? 48 : 96; for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); } const gg = new THREE.BufferGeometry().setFromPoints(pts); geos.push(gg); const l = new THREE.LineLoop(gg, linhaMat(c, 0.5)); g.add(l); return l; });
  const NP = o.low ? 140 : 320, pv = new Float32Array(NP * 3), pd = Array.from({ length: NP }, (_, i) => ({ a: (i / NP) * Math.PI * 2 * 7.3, r: 0.35 + 0.65 * ((i * 37) % 100) / 100, y: ((i * 53) % 100) / 100 - 0.5, v: 0.05 + ((i * 11) % 7) * 0.02 }));
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pv, 3)); geos.push(pg);
  const pontos = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.9, map: o.estrela ?? null, color: 0xfff1d6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })); pontos.frustumCulled = false; mats.push(pontos.material as THREE.Material); g.add(pontos);

  // as CRIATURAS: serpentes (rodeiam o lounge) e tentáculos (saem do centro)
  type Criatura = { m: THREE.Mesh; u: Record<string, { value: number | THREE.Color }> };
  const criar = (tipo: 0 | 1, n: number, cores: number[], centro: THREE.Vector3, raio: number, alt: number): Criatura[] => {
    const out: Criatura[] = [];
    for (let i = 0; i < n; i++) {
      const gg = new THREE.CylinderGeometry(1, 1, 1, tipo ? 10 : 8, o.low ? 48 : 110, true); geos.push(gg);
      const u = { uT: { value: 0 }, uB: { value: 0 }, uProg: { value: 0 }, uFase: { value: (i / n) * Math.PI * 2 + tipo * 0.7 }, uRaio: { value: raio * (1 + 0.12 * (i % 3)) }, uAlt: { value: alt + (i % 2) * 3 }, uComp: { value: 0 }, uTipo: { value: tipo }, uGiro: { value: i % 2 ? -1 : 1 }, uCor: { value: new THREE.Color(cores[i % cores.length]!) } };
      const m = new THREE.Mesh(gg, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT_CRIATURA, fragmentShader: FRAG_CRIATURA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      mats.push(m.material as THREE.Material); m.frustumCulled = false; m.renderOrder = 3; m.position.copy(centro); m.visible = false; g.add(m); out.push({ m, u });
    }
    return out;
  };
  // (o grupo fica no centro do olho; o lounge fica 44 m à frente e ~60 m abaixo: as serpentes rodeiam ESSE centro)
  const centroLounge = new THREE.Vector3(0, -22, 44);
  const serpentes = criar(0, o.low ? 4 : 6, [0x9affd0, 0xb98cff, 0xffd36b, 0x66e6ff, 0xff7ab8, 0x6bff9a], centroLounge, 52, 0);
  const tentaculos = criar(1, o.low ? 3 : 5, [0xb98cff, 0xff5fd2, 0x66e6ff, 0xff9a5c, 0x9affd0], new THREE.Vector3(0, 0, 0), 46, 34);
  for (const c of [...serpentes, ...tentaculos]) c.m.userData.semLote = true;
  g.traverse((n) => { n.userData.semLote = true; });

  return {
    group: g,
    definir(e, batida, t) {
      const vis = e.nascimento > 0.001; g.visible = vis; if (!vis) return;
      uni.uT.value = t; uni.uB.value = batida; uni.uNasc.value = e.nascimento; uni.uComp.value = e.complexidade; uni.uMix.value = e.mistura; uni.uForma.value = e.forma; uni.uProx.value = e.proxima;
      plano.scale.setScalar(e.area * (1 + 0.03 * batida));
      aneis.forEach((an, i) => { an.rotation.set(t * (0.11 + i * 0.05), t * (0.07 - i * 0.03), i * 1.1); an.scale.setScalar(e.area * e.nascimento * (1 + 0.04 * batida)); (an.material as THREE.LineBasicMaterial).opacity = 0.25 + 0.45 * e.complexidade; });
      { const a = pg.attributes.position!.array as Float32Array, R = tam * 0.62 * e.area;
        pd.forEach((p, i) => { const ang = p.a + t * p.v, rr = R * p.r * e.nascimento; a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 1] = Math.sin(ang) * rr * 0.75 + p.y * 6 * e.complexidade; a[i * 3 + 2] = Math.sin(ang * 2 + i) * 4 * e.complexidade; });
        pg.attributes.position!.needsUpdate = true; (pontos.material as THREE.PointsMaterial).opacity = 0.3 + 0.6 * e.complexidade; }
      for (const c of serpentes) { c.m.visible = e.serpentes > 0.001; (c.u.uT as { value: number }).value = t; (c.u.uB as { value: number }).value = batida; (c.u.uProg as { value: number }).value = e.serpentes; (c.u.uComp as { value: number }).value = e.complexidade; }
      for (const c of tentaculos) { c.m.visible = e.tentaculos > 0.001; (c.u.uT as { value: number }).value = t; (c.u.uB as { value: number }).value = batida; (c.u.uProg as { value: number }).value = e.tentaculos; (c.u.uComp as { value: number }).value = e.complexidade; }
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); g.removeFromParent(); },
  };
}
export const N_FORMAS = FORMAS.length;
