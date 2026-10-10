/**
 * OlhoHolografico — o "OLHO" psicodélico em cima do DJ do lounge (pedido do dono, out/2026: não as luzinhas de sempre,
 * mas JOGOS DE LUZ GEOMÉTRICOS de verdade, renderizados leves, como HOLOGRAMA). Tudo aditivo, sem luz de cena:
 *  - um plano só com um shader: o olho em amêndoa (pálpebras de luz que piscam de vez em quando), a ÍRIS caleidoscópica
 *    (simetria de 12, geometria sagrada — flor da vida, triângulos, anéis — girando em sentidos opostos, com o arco-íris
 *    correndo), a pupila em fenda que dilata com o grave e, por fora, uma MANDALA de raios e polígonos que respira;
 *  - em volta, o TRIÂNGULO de luz (o olho que tudo vê) e 3 anéis de linhas girando em eixos diferentes;
 *  - sólidos platônicos em wireframe orbitando, trocando de cor.
 * `atualizar(t, batida, ativo)`: a batida (0..1) pulsa tudo; `ativo` (música tocando) acende de vez. Referencial: o
 * olho olha pra +z, centro na origem; ~`tam` m de largura.
 */
import * as THREE from "three";

export type OlhoHandle = { group: THREE.Group; atualizar(t: number, batida: number, ativo: number): void; dispose(): void };

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `
precision highp float;
uniform float uT, uB, uA, uPisca;
varying vec2 vUv;
#define PI 3.14159265
vec3 hsv(float h, float s, float v) { vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return v * mix(vec3(1.0), k, s); }
float linha(float d, float w) { return smoothstep(w, 0.0, abs(d)); }
// dobra o plano num caleidoscópio de n fatias espelhadas
vec2 kal(vec2 p, float n) { float a = atan(p.y, p.x), r = length(p), s = PI / n; a = mod(a, 2.0 * s) - s; a = abs(a); return vec2(cos(a), sin(a)) * r; }
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
float poligono(vec2 p, float n, float r) { float a = atan(p.y, p.x), s = 2.0 * PI / n; return cos(floor(0.5 + a / s) * s - a) * length(p) - r; }
void main() {
  vec2 p = (vUv - 0.5) * 2.0;          // -1..1 (o plano todo); o olho ocupa o miolo
  float t = uT, b = uB, A = 0.35 + 0.65 * uA;
  vec3 col = vec3(0.0);
  float r = length(p);
  // ── a MANDALA por fora (raios + polígonos que respiram), some na borda do plano ──
  vec2 k = kal(p, 12.0);
  float raios = linha(k.y - 0.02 * sin(k.x * 30.0 - t * 3.0), 0.006 + 0.004 * b) * smoothstep(0.45, 0.6, r);
  float poli = 0.0;
  for (int i = 0; i < 4; i++) { float fi = float(i); float rr = 0.58 + fi * 0.1 + 0.02 * sin(t * 0.7 + fi); vec2 q = rot(t * (0.1 + fi * 0.05) * (mod(fi, 2.0) * 2.0 - 1.0)) * p; poli += linha(poligono(q, 3.0 + fi * 3.0, rr), 0.005); }
  float aneis = linha(sin(r * 46.0 - t * 4.0 - b * 6.0) * 0.5, 0.18) * smoothstep(0.42, 0.7, r) * 0.35;
  float fora = (raios + poli * 0.8 + aneis) * smoothstep(1.0, 0.75, r);
  col += hsv(fract(r * 0.8 - t * 0.08 + atan(p.y, p.x) / (2.0 * PI)), 0.75, 1.0) * fora * (0.55 + 0.9 * b);
  // as PÉTALAS e o CAMPO caleidoscópico preenchidos (a cor de verdade, não só linhas)
  vec2 kk = kal(rot(t * 0.06) * p, 12.0);
  float pet = smoothstep(0.17, 0.0, length(kk - vec2(0.74 + 0.03 * sin(t * 0.8), 0.0)) - 0.02 * b);
  float aroPet = linha(length(kk - vec2(0.74, 0.0)) - 0.15 - 0.03 * b, 0.012);
  float campo = smoothstep(0.15, 0.95, sin(kk.x * 17.0 - t * 2.2) * sin(kk.y * 21.0 + t * 1.4 + sin(kk.x * 6.0)));
  float faixa = smoothstep(0.46, 0.56, r) * smoothstep(0.98, 0.82, r);
  col += hsv(fract(kk.x * 0.9 + t * 0.07), 0.95, 1.0) * (campo * 0.32 * faixa + pet * 0.45 + aroPet) * (0.6 + 0.8 * b);
  // ── o OLHO: amêndoa entre dois arcos (as pálpebras), que fecham num piscar ──
  vec2 e = p / vec2(0.62, 0.62);
  float abre = 0.52 * (1.0 - uPisca);
  float palp = abs(e.y) - abre * (1.0 - e.x * e.x);            // < 0 dentro do olho
  float dentro = smoothstep(0.01, -0.01, palp) * step(abs(e.x), 1.0);
  float borda = linha(palp, 0.018) * step(abs(e.x), 1.02);
  col += vec3(0.75, 0.95, 1.0) * borda * (1.2 + b);
  // cílios de luz: raios curtos saindo das pálpebras
  float cil = linha(fract((e.x + 1.0) * 9.0) - 0.5, 0.06) * smoothstep(0.0, 0.08, palp) * smoothstep(0.18, 0.06, palp) * step(abs(e.x), 0.9);
  col += hsv(0.55 + 0.1 * sin(t), 0.5, 1.0) * cil * 0.7;
  // ── a ÍRIS caleidoscópica (gira num sentido; a flor da vida no outro) ──
  vec2 ip = p / 0.36; float ir = length(ip);
  float giro = t * 0.35 + b * 0.4;
  vec2 kq = kal(rot(giro) * ip, 12.0);
  float flor = 0.0;
  for (int i = 0; i < 6; i++) { float a = float(i) * PI / 3.0 - giro * 0.6; flor += linha(length(ip - 0.5 * vec2(cos(a), sin(a))) - 0.5, 0.025); }
  float tri = linha(poligono(rot(-giro * 1.4) * ip, 3.0, 0.42 + 0.05 * b), 0.03) + linha(poligono(rot(giro * 1.4 + PI) * ip, 3.0, 0.42 + 0.05 * b), 0.03);
  float fibras = linha(sin(kq.y * 40.0 + kq.x * 6.0 - t * 2.0), 0.35) * smoothstep(0.25, 0.9, ir);
  float iris = (fibras * 0.5 + flor * 0.7 + tri) * smoothstep(1.02, 0.96, ir);
  vec3 corIris = hsv(fract(ir * 0.6 - t * 0.12 + 0.15 * sin(atan(ip.y, ip.x) * 3.0 + t)), 0.85, 1.0);
  col += corIris * iris * dentro * (0.9 + 1.2 * b);
  float campoI = 0.5 + 0.5 * sin(kq.x * 14.0 - t * 3.0 + sin(kq.y * 9.0 + t) * 2.0);
  col += hsv(fract(0.6 + ir * 0.5 + kq.y * 0.3 - t * 0.1), 0.9, 1.0) * campoI * 0.6 * dentro * smoothstep(1.0, 0.9, ir) * (0.7 + 0.6 * b);
  col += vec3(0.6, 0.9, 1.0) * linha(ir - 1.0, 0.04) * dentro * 1.4;     // o limbo (o aro da íris)
  // a PUPILA: fenda vertical que dilata com o grave; o brilho (o reflexo)
  float pup = length(ip / vec2(0.16 + 0.22 * b + 0.06 * sin(t * 0.8), 0.62));
  col *= mix(1.0, 0.0, smoothstep(1.02, 0.95, pup) * dentro);
  col += vec3(0.8, 0.3, 1.0) * linha(pup - 1.0, 0.08) * dentro * 1.2;
  col += vec3(1.0) * smoothstep(0.09, 0.0, length(ip - vec2(-0.32, 0.36))) * dentro * 0.9;
  // o branco do olho: uma névoa leve e escura (holograma) — dá corpo sem tampar o céu
  col += vec3(0.05, 0.08, 0.16) * dentro * (1.0 - smoothstep(0.9, 1.0, ir)) * 0.6;
  col *= A * (0.92 + 0.08 * sin(vUv.y * 420.0 + t * 18.0));   // as linhas de varredura do holograma
  gl_FragColor = vec4(col, 1.0);   // (aditivo: a cor já é a intensidade)
}`;

export function criarOlho(o: { low: boolean; tam?: number }): OlhoHandle {
  const tam = o.tam ?? 40, g = new THREE.Group(); g.name = "olho-holografico";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const uni = { uT: { value: 0 }, uB: { value: 0 }, uA: { value: 0 }, uPisca: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(tam, tam); geos.push(geo); mats.push(mat);
  const plano = new THREE.Mesh(geo, mat); plano.renderOrder = 4; g.add(plano);

  const linhaMat = (cor: number, op: number) => { const m = new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); return m; };
  // o TRIÂNGULO de luz em volta do olho (duplo, um girando devagar no plano)
  const tri = (R: number) => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= 3; i++) { const a = Math.PI / 2 + (i / 3) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); } const gg = new THREE.BufferGeometry().setFromPoints(pts); geos.push(gg); return gg; };
  const triA = new THREE.Line(tri(tam * 0.42), linhaMat(0xffe7a8, 0.85)); g.add(triA);
  const triB = new THREE.Line(tri(tam * 0.46), linhaMat(0xb98cff, 0.5)); triB.rotation.z = Math.PI; g.add(triB);
  // 3 ANÉIS de linhas girando em eixos diferentes (o "giroscópio" do holograma)
  const anel = (R: number, n: number) => { const pts: THREE.Vector3[] = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0)); } const gg = new THREE.BufferGeometry().setFromPoints(pts); geos.push(gg); return gg; };
  const aneis = [0x66e6ff, 0xff5fd2, 0x6bff9a].map((c, i) => { const l = new THREE.LineLoop(anel(tam * (0.36 + i * 0.03), o.low ? 48 : 96), linhaMat(c, 0.55)); g.add(l); return l; });
  // SÓLIDOS em wireframe orbitando (tetra, octa, icosa, dodeca), trocando de cor
  const solidos = [new THREE.TetrahedronGeometry(1.6), new THREE.OctahedronGeometry(1.6), new THREE.IcosahedronGeometry(1.7), new THREE.DodecahedronGeometry(1.6), new THREE.TetrahedronGeometry(1.3), new THREE.OctahedronGeometry(1.2)]
    .slice(0, o.low ? 4 : 6).map((gg) => { const w = new THREE.EdgesGeometry(gg); gg.dispose(); geos.push(w); const m = new THREE.LineSegments(w, linhaMat(0xffffff, 0.8)); g.add(m); return m; });
  const cor = new THREE.Color();
  let proxPisca = 3, piscaIni = -1;

  return {
    group: g,
    atualizar(t, batida, ativo) {
      uni.uT.value = t; uni.uB.value = batida; uni.uA.value = ativo;
      // pisca de vez em quando (rápido: fecha e abre em ~0,25 s)
      if (t > proxPisca && piscaIni < 0) piscaIni = t;
      if (piscaIni >= 0) { const k = (t - piscaIni) / 0.26; uni.uPisca.value = k < 1 ? Math.sin(k * Math.PI) : 0; if (k >= 1) { piscaIni = -1; proxPisca = t + 4 + ((t * 7.3) % 5); } }
      triA.rotation.z = 0.08 * Math.sin(t * 0.4); triB.rotation.z = Math.PI - t * 0.05;
      (triA.material as THREE.LineBasicMaterial).opacity = 0.5 + 0.45 * batida;
      aneis[0]!.rotation.set(t * 0.31, t * 0.17, 0); aneis[1]!.rotation.set(-t * 0.21, t * 0.29, Math.PI / 3); aneis[2]!.rotation.set(t * 0.13, -t * 0.37, -Math.PI / 3);
      for (const a of aneis) a.scale.setScalar(1 + 0.05 * batida);
      solidos.forEach((s, i) => {
        const a = t * (0.25 + i * 0.04) + (i / solidos.length) * Math.PI * 2, R = tam * (0.5 + 0.04 * Math.sin(t * 0.6 + i));
        s.position.set(Math.cos(a) * R, Math.sin(a) * R * 0.55, Math.sin(a * 2 + i) * 3);
        s.rotation.set(t * (0.7 + i * 0.1), t * (0.5 + i * 0.13), 0); s.scale.setScalar(1 + 0.35 * batida);
        cor.setHSL((t * 0.06 + i / solidos.length) % 1, 0.9, 0.65); (s.material as THREE.LineBasicMaterial).color.copy(cor);
      });
    },
    dispose() { for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); g.removeFromParent(); },
  };
}
