/**
 * A TRAVESSIA do buraco negro (out/2026, o dono: "uma entrada mais dramática, uma cutscene focando no buraco negro e ele
 * fazendo maiores efeitos de magnetismo com o personagem, com FACHADAS PSICODÉLICAS em vez de simplesmente puxar"):
 *  - as FACHADAS: anéis de painéis altos em volta do eixo buraco negro → personagem, como a nave de uma catedral que
 *    afunila até o horizonte — cada painel um caleidoscópio (geometria sagrada espelhada, as cores girando); os anéis
 *    giram em sentidos alternados e são puxados pra dentro com a tragada;
 *  - os RAIOS: descargas em zigue-zague do horizonte até em volta do personagem, piscando;
 *  - os ESTILHAÇOS: cacos de vidro iridescentes em espiral pro centro — no horizonte, ESTOURAM pra fora.
 * Três chamadas de desenho (as fachadas e os cacos são instanciados). Tudo no mundo; `atualizar` a cada quadro com o
 * progresso da tragada (0..1).
 */
import * as THREE from "three";

export type TravessiaHandle = {
  grupo: THREE.Group;
  /** `k` = o quanto da tragada já foi (0..1); `eu` = o personagem; `bn` = o centro do buraco negro e o raio dele */
  atualizar(dt: number, t: number, k: number, eu: THREE.Vector3, bn: THREE.Vector3, bnR: number): void;
  /** o horizonte: os cacos estouram pra fora e os raios fazem um último clarão */
  estourar(): void;
  /** some aos poucos (depois do clarão); `true` quando já sumiu */
  apagar(dt: number): boolean;
  dispose(): void;
};

const VERT_FACHADA = /* glsl */ `
  varying vec2 vUv; varying float vId;
  void main() { vUv = uv; vId = float(gl_InstanceID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }
`;
const FRAG_FACHADA = /* glsl */ `
  uniform float uT, uK, uA; varying vec2 vUv; varying float vId;
  vec3 hsv(float h, float s, float v) { vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s); }
  void main() {
    // o CALEIDOSCÓPIO: o painel em coordenadas polares, espelhado em 8 gomos, com anéis e pétalas (geometria sagrada)
    vec2 p = (vUv - 0.5) * vec2(1.0, 2.4);
    float r = length(p), a = atan(p.y, p.x), seg = 6.2831853 / 8.0;
    a = abs(mod(a + uT * 0.35 + vId * 0.7, seg) - seg * 0.5);
    vec2 q = vec2(cos(a), sin(a)) * r;
    float petala = sin(q.x * 18.0 - uT * 3.0 + vId) * cos(q.y * 22.0 + uT * 2.1);
    float aneis = sin(r * 34.0 - uT * 5.0 - vId * 1.3);
    float flor = smoothstep(0.55, 1.0, abs(petala + aneis * 0.6));
    float linhas = smoothstep(0.92, 1.0, abs(sin(r * 60.0 - uT * 7.0)));
    vec3 c = hsv(fract(uT * 0.07 + vId * 0.11 + r * 0.6), 0.85, 1.0) * (0.25 + 0.95 * flor) + vec3(0.9, 0.8, 1.0) * linhas * 0.6;
    // a borda do painel some (não é um retângulo duro); a base escurece pro horizonte
    float borda = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    gl_FragColor = vec4(c * borda * uA * (0.6 + 0.6 * uK), 1.0);
  }
`;
const FRAG_CACO = /* glsl */ `
  uniform float uT, uA; varying vec2 vUv; varying float vId;
  vec3 hsv(float h, float s, float v) { vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s); }
  void main() { float brilho = 0.45 + 0.55 * pow(abs(sin(uT * 6.0 + vId * 2.3)), 6.0); gl_FragColor = vec4(hsv(fract(vId * 0.137 + uT * 0.2), 0.5, 1.0) * brilho * uA, 1.0); }
`;

export function criarTravessia(o: { low: boolean }): TravessiaHandle {
  const grupo = new THREE.Group(); grupo.name = "travessiaBN";
  const ANEIS = o.low ? 6 : 9, POR_ANEL = o.low ? 8 : 12, CACOS = o.low ? 40 : 180, RAIOS = o.low ? 4 : 9, SEG = 12;
  const uni = { uT: { value: 0 }, uK: { value: 0 }, uA: { value: 0 } };
  const comum = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide } as const;
  // as FACHADAS
  const geoF = new THREE.PlaneGeometry(1, 1);
  const fachadas = new THREE.InstancedMesh(geoF, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT_FACHADA, fragmentShader: FRAG_FACHADA, ...comum }), ANEIS * POR_ANEL);
  fachadas.frustumCulled = false; grupo.add(fachadas);
  // os CACOS (um triângulo fino cada)
  const geoC = new THREE.BufferGeometry(); geoC.setAttribute("position", new THREE.Float32BufferAttribute([0, 0.5, 0, -0.18, -0.4, 0, 0.22, -0.3, 0], 3)); geoC.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 1, 0, 0, 1, 0], 2));
  const cacos = new THREE.InstancedMesh(geoC, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT_FACHADA, fragmentShader: FRAG_CACO, ...comum }), CACOS);
  cacos.frustumCulled = false; grupo.add(cacos);
  const caco = Array.from({ length: CACOS }, (_, i) => ({ fase: Math.random() * Math.PI * 2, d: 0.15 + Math.random() * 0.85, r: 0.3 + Math.random() * 0.7, gira: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), esc: 0.4 + Math.random() * 1.6, i }));
  // os RAIOS
  const posR = new Float32Array(RAIOS * SEG * 6), geoR = new THREE.BufferGeometry(); geoR.setAttribute("position", new THREE.BufferAttribute(posR, 3));
  const matR = new THREE.LineBasicMaterial({ color: 0xe6d2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const raios = new THREE.LineSegments(geoR, matR); raios.frustumCulled = false; grupo.add(raios);

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const eixo = new THREE.Vector3(), lado = new THREE.Vector3(), cima = new THREE.Vector3(), tmp = new THREE.Vector3(), olho = new THREE.Vector3();
  let tRaio = 0, estouro = -1, alfa = 0, apagando = false;
  return {
    grupo,
    atualizar(dt, t, k, eu, bn, bnR) {
      uni.uT.value = t; uni.uK.value = k;
      if (!apagando) alfa = Math.min(1, alfa + dt * 1.6);
      uni.uA.value = alfa;
      // o eixo: do buraco negro pro personagem (e a base em volta dele)
      eixo.subVectors(eu, bn); const L = Math.max(1, eixo.length()); eixo.divideScalar(L);
      lado.set(0, 1, 0).cross(eixo); if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0); lado.normalize(); cima.crossVectors(eixo, lado).normalize();
      // as FACHADAS: um TÚNEL em volta de quem é tragado — anéis à frente (rumo ao buraco negro) que vêm vindo e passam,
      // cada vez mais rápido; perto do fim, o túnel fecha no horizonte
      const frente = tmp.copy(eixo).negate().clone(), ESP = 34, vel = 26 + 190 * k, fluxo = (t * vel) % ESP, ate = Math.max(ESP, L - bnR * 0.9);
      let n = 0;
      for (let i = 0; i < ANEIS; i++) {
        const dd = Math.min(ate, -ESP * 0.5 + i * ESP + (ESP - fluxo)), fecha = Math.min(1, dd / ate), giro = t * (i % 2 ? -0.45 : 0.36) * (1 + 2 * k) + i * 0.9;
        const R = (24 + 5 * Math.sin(t * 0.8 + i) + i * 2.5) * (1 - 0.55 * fecha * k), alt = ESP * 0.85;
        for (let j = 0; j < POR_ANEL; j++, n++) {
          const a = giro + (j / POR_ANEL) * Math.PI * 2;
          olho.copy(eu).addScaledVector(frente, dd);
          p.copy(olho).addScaledVector(lado, Math.cos(a) * R).addScaledVector(cima, Math.sin(a) * R);
          tmp.subVectors(olho, p).normalize();
          m.lookAt(p, tmp.add(p), frente); q.setFromRotationMatrix(m);
          s.set(R * 0.5, alt, 1); fachadas.setMatrixAt(n, m.compose(p, q, s));
        }
      }
      fachadas.instanceMatrix.needsUpdate = true;
      // os CACOS: em espiral em volta do caminho, correndo pra frente (rumo ao buraco negro); depois do estouro, pra fora
      for (const c of caco) {
        let r: number, dd: number;
        if (estouro >= 0) { const e = (t - estouro) * (1.8 + c.r); r = 6 + e * 60 * c.r; dd = c.d * 60 - e * 20; }
        else { const f = ((t * (0.15 + 0.6 * k) * (0.6 + c.r) + c.d) % 1); r = 4 + 30 * c.r * (1 - 0.5 * f); dd = -20 + f * 220; }
        const a = c.fase + t * (0.8 + 2.6 * k) * (0.5 + c.r);
        p.copy(eu).addScaledVector(frente, dd).addScaledVector(lado, Math.cos(a) * r).addScaledVector(cima, Math.sin(a) * r);
        q.setFromAxisAngle(c.gira, t * 3 + c.fase); s.setScalar(c.esc * (1 + k));
        cacos.setMatrixAt(c.i, m.compose(p, q, s));
      }
      cacos.instanceMatrix.needsUpdate = true;
      // os RAIOS: novos a cada ~0,09 s, do horizonte até em volta do personagem, em zigue-zague
      tRaio -= dt;
      if (tRaio <= 0) {
        tRaio = 0.06 + Math.random() * 0.08;
        for (let b = 0; b < RAIOS; b++) {
          // (de lá da frente do túnel — ou do horizonte, se já está perto — até em volta de quem passa)
          const a0 = Math.random() * Math.PI * 2, longe = Math.min(L - bnR, 220), rl = longe < 200 ? bnR : 30, de = new THREE.Vector3().copy(eu).addScaledVector(eixo, -longe).addScaledVector(lado, Math.cos(a0) * rl).addScaledVector(cima, Math.sin(a0) * rl);
          const a1 = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 7, ate = new THREE.Vector3().copy(eu).addScaledVector(lado, Math.cos(a1) * rr).addScaledVector(cima, Math.sin(a1) * rr + 1);
          let ant = de.clone();
          for (let g = 1; g <= SEG; g++) {
            const f = g / SEG, prox = new THREE.Vector3().lerpVectors(de, ate, f);
            const zz = 9 * (1 - f * 0.8);
            if (g < SEG) prox.addScaledVector(lado, (Math.random() - 0.5) * zz).addScaledVector(cima, (Math.random() - 0.5) * zz);
            const o6 = (b * SEG + g - 1) * 6; posR[o6] = ant.x; posR[o6 + 1] = ant.y; posR[o6 + 2] = ant.z; posR[o6 + 3] = prox.x; posR[o6 + 4] = prox.y; posR[o6 + 5] = prox.z;
            ant = prox;
          }
        }
        geoR.attributes.position!.needsUpdate = true;
      }
      matR.opacity = alfa * (0.25 + 0.75 * Math.random()) * (0.4 + 0.6 * k) * (estouro >= 0 ? Math.max(0, 1 - (t - estouro) * 2) : 1);
    },
    estourar() { if (estouro < 0) estouro = uni.uT.value; },
    apagar(dt) { apagando = true; alfa = Math.max(0, alfa - dt * 1.1); uni.uA.value = alfa; matR.opacity *= 0.8; return alfa <= 0; },
    dispose() {
      grupo.removeFromParent(); geoF.dispose(); geoC.dispose(); geoR.dispose(); matR.dispose();
      (fachadas.material as THREE.Material).dispose(); (cacos.material as THREE.Material).dispose();
    },
  };
}
