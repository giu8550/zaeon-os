/**
 * lib/cyber/fluxoNeon.ts — o FLUXO de neon animado, GENERALIZADO (out/2026). É a mesma onda do "caminho do meio" da
 * torre (components/cyber/TemploMeio `onda()`/`FLUXO_CYBER`): uma frente de luz que nasce num PONTO-FONTE e corre pelas
 * superfícies; cada ponto acende quando a frente passa. Antes vivia só na Cyber Room; aqui vira reusável pra o chão
 * (pista), as paredes (circuito) e o que mais quiser pulsar — tudo em CIANO sobre PRETO (lib/cyber/neon).
 *
 * Mecânica: um uniform de tempo `uT` por quadro (NÃO é scroll de textura nem dash). `s` = caminho da fonte até o ponto
 * (descida + afastamento no plano). PURO three (roda no cliente e em worker).
 */
import * as THREE from "three";
import { NEON_HEX } from "@/lib/cyber/neon";

export type Fluxo = {
  uT: { value: number }; uV: { value: number }; uSp: { value: number };
  uCor: { value: THREE.Color }; uFrente: { value: THREE.Color }; uFonte: { value: THREE.Vector3 }; uDoMundo: { value: THREE.Matrix4 };
};

/** os padrões do fluxo (velocidade da frente, espaço entre frentes) — herdados da torre */
export const FLUXO_PADRAO = { vel: 24, entre: 90 } as const;

/** (GLSL) a onda no ponto `L` (layout/mundo): 0 fora da frente, 1 nela. Mesma de TemploMeio. */
export const ONDA_GLSL = `uniform float uT, uV, uSp; uniform vec3 uCor, uFrente, uFonte; uniform mat4 uDoMundo;
  float onda(vec3 L){ float s = max(0.0, uFonte.y - L.y) + length(L.xz - uFonte.xz); float p = fract((uT * uV - s) / uSp); return smoothstep(0.0, 0.03, p) * smoothstep(0.3, 0.04, p); }`;

/** cria uma bag de fluxo (cor ciano por padrão; `cor`/`frente` sobrescrevem — ex.: a cor do jogador na pista dele) */
export function criarFluxo(o: { fonte?: THREE.Vector3; vel?: number; entre?: number; cor?: THREE.ColorRepresentation; frente?: THREE.ColorRepresentation } = {}): Fluxo {
  return {
    uT: { value: 0 }, uV: { value: o.vel ?? FLUXO_PADRAO.vel }, uSp: { value: o.entre ?? FLUXO_PADRAO.entre },
    uCor: { value: new THREE.Color(o.cor ?? NEON_HEX.ciano) },
    uFrente: { value: new THREE.Color(o.frente ?? NEON_HEX.branco) },
    uFonte: { value: o.fonte ? o.fonte.clone() : new THREE.Vector3(0, 60, 0) },
    uDoMundo: { value: new THREE.Matrix4() },
  };
}

/** a mesma onda em JS (pros frisos/anéis que não são shader) */
export function ondaEm(f: Fluxo, x: number, y: number, z: number): number {
  const F = f.uFonte.value, s = Math.max(0, F.y - y) + Math.hypot(x - F.x, z - F.z);
  const p = (((f.uT.value * f.uV.value - s) / f.uSp.value) % 1 + 1) % 1;
  const sm = (a: number, b: number, t: number) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  return sm(0, 0.03, p) * sm(0.3, 0.04, p);
}

/** avança o fluxo um quadro. `grupo` opcional: recalcula a inversa do mundo (pra grupos girados/espelhados). */
export function atualizarFluxo(f: Fluxo, t: number, grupo?: THREE.Object3D): void {
  f.uT.value = t;
  if (grupo) { grupo.updateWorldMatrix(true, false); f.uDoMundo.value.copy(grupo.matrixWorld).invert(); }
}

/** o CHÃO = PISTA: preto + faixas de luz ciano correndo no sentido do movimento + grade fina + a onda do fluxo
 *  acendendo tudo (branco) quando passa. `cor` muda o neon (ex.: a cor do jogador). */
export function matPista(f: Fluxo, o: { cor?: THREE.ColorRepresentation; escala?: number } = {}): THREE.ShaderMaterial {
  const esc = o.escala ?? 1;
  const m = new THREE.ShaderMaterial({
    uniforms: { ...f, uEsc: { value: esc } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: "uniform mat4 uDoMundo; varying vec3 vL; void main(){ vL = (uDoMundo * modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${ONDA_GLSL} uniform float uEsc; varying vec3 vL;
      void main(){
        vec2 p = vL.xz / uEsc;
        // FAIXAS da pista (linhas fortes ao longo de Z) + grade fina
        vec2 g = abs(fract(p / 6.0) - 0.5);
        float faixa = smoothstep(0.045, 0.0, g.x);                 // lanes (ao longo de Z)
        float grade = smoothstep(0.02, 0.0, min(g.x, g.y)) * 0.5;  // grade fina
        // luz CORRENDO ao longo das faixas (sensação de velocidade)
        float corre = 0.35 + 0.65 * smoothstep(0.65, 1.0, fract(p.y * 0.08 - uT * 1.2));
        float linhas = faixa * corre + grade * (0.4 + 0.3 * corre);
        float w = onda(vL);
        vec3 cor = uCor * linhas + uFrente * (faixa * 2.2 + 0.2) * w;
        gl_FragColor = vec4(cor, 1.0);
      }`,
  });
  if (o.cor != null) (m.uniforms.uCor!.value as THREE.Color).set(o.cor);
  return m;
}

/** a PAREDE = CIRCUITO: trilhas em grade quebrada sobre o negro, na cor neon, com o pulso correndo e a onda acendendo
 *  tudo quando passa. Mesma ideia de TemploMeio.materialCircuito, em ciano. */
export function matCircuito(f: Fluxo, o: { cor?: THREE.ColorRepresentation } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: { ...f },
    vertexShader: "uniform mat4 uDoMundo; varying vec3 vP; varying vec3 vN; varying vec3 vL; void main(){ vP = position; vN = normal; vL = (uDoMundo * modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${ONDA_GLSL} varying vec3 vP; varying vec3 vN; varying vec3 vL;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        vec3 n = abs(vN); vec2 uv = n.x > 0.5 ? vP.zy : n.y > 0.5 ? vP.xz : vP.xy;
        vec2 g = uv * 0.7, c = floor(g), ff = fract(g);
        float r = h(c), linha = 0.0;
        if (r < 0.5) linha = smoothstep(0.08, 0.0, abs(ff.y - 0.5)); else linha = smoothstep(0.08, 0.0, abs(ff.x - 0.5));
        linha *= step(0.3, h(c + 7.0));
        float no = smoothstep(0.16, 0.08, length(ff - 0.5)) * step(0.75, h(c + 3.0));
        float pulso = 0.35 + 0.65 * smoothstep(0.7, 1.0, fract(uv.y * 0.05 - uT * 0.25 + r * 0.3));
        float luz = 0.25 + 0.75 * max(0.0, dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.5))));
        float w = onda(vL);
        vec3 base = vec3(0.01, 0.02, 0.03) * (0.6 + luz);
        gl_FragColor = vec4(base + uCor * (linha + no) * pulso + uFrente * ((linha + no) * 2.4 + 0.4) * w, 1.0);
      }`,
  });
  if (o.cor != null) (m.uniforms.uCor!.value as THREE.Color).set(o.cor);
  return m;
}
