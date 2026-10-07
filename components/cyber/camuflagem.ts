/**
 * camuflagem — o "macete" da nave-QG no MAPA INTEIRO, no MEIO-TERMO: as coisas continuam SÓLIDAS (paredes,
 * servidores, móveis), mas sem PBR nem luzes — uma luz "de mentira" fixa no shader + uma borda que acende (o toque
 * da camuflagem). O holograma puro (`camuflagem`) fica pra nave. Peças disponíveis:
 *  - VOLUMES (paredes, torres, colunas, telhados, rocha): CAMUFLAGEM — miolo quase transparente, a BORDA das curvas
 *    acende (fresnel, mostra a forma) e uma ondulação lenta escorre. Sem luz: um punhado de contas por pixel.
 *  - PISOS grandes: GRADE HOLOGRÁFICA — fundo escuro translúcido + linhas de luz calculadas no próprio shader
 *    (coordenada de mundo), no lugar de textura/superfície sólida.
 *  - Texturizados (telas, logos, placas, água): viram MeshBasic (o mesmo mapa, sem cálculo de luz).
 * Um RELÓGIO compartilhado (`TEMPO_CAMUFLAGEM`) anima todos: o engine chama `atualizarCamuflagem(t)` uma vez por quadro.
 * Suporta InstancedMesh (o three injeta `instanceMatrix` + `USE_INSTANCING` no ShaderMaterial).
 */
import * as THREE from "three";

export const TEMPO_CAMUFLAGEM = { value: 0 };
let parado = false;
export function atualizarCamuflagem(t: number): void { if (!parado) TEMPO_CAMUFLAGEM.value = t; }
/** prefers-reduced-motion: a ondulação para */
export function pararCamuflagem(on: boolean): void { parado = on; if (on) TEMPO_CAMUFLAGEM.value = 0; }

const VERT = `varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec4 p = vec4(position, 1.0); vec3 n = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
    #endif
    vec4 w = modelMatrix * p; vW = w.xyz;
    vec4 mv = viewMatrix * w; vV = -mv.xyz;
    vN = normalize(mat3(modelViewMatrix) * n);   // (escala uniforme na prática: basta pra o fresnel)
    #ifdef USE_INSTANCING
      vN = normalize(mat3(viewMatrix) * mat3(modelMatrix) * n);
    #endif
    gl_Position = projectionMatrix * mv;
  }`;

/** o shader dos VOLUMES. `uOp` multiplica tudo (ex.: a bordo, o dorso da nave some mais na MINHA tela). */
export function camuflagem(cor: THREE.ColorRepresentation, o: { base?: number; borda?: number; lados?: boolean; onda?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCor: { value: new THREE.Color(cor) }, uT: TEMPO_CAMUFLAGEM, uOp: { value: 1 },
      uBase: { value: o.base ?? 0.012 }, uBorda: { value: o.borda ?? 0.45 }, uOnda: { value: o.onda ?? 0.035 },
    },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 uCor; uniform float uT; uniform float uOp; uniform float uBase; uniform float uBorda; uniform float uOnda;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float borda = pow(f, 4.5);   // só a silhueta e as curvas fortes acendem
        float onda = 0.5 + 0.5 * sin(vW.y * 0.9 - uT * 1.1 + sin(vW.x * 0.23 + vW.z * 0.27 + uT * 0.4) * 1.6);
        float a = (uBase + borda * uBorda + onda * onda * onda * uOnda) * uOp;
        gl_FragColor = vec4(uCor * (0.3 + borda * 1.2 + onda * 0.2), a);
      }`,
    transparent: true, depthWrite: false, side: o.lados ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/** o MEIO-TERMO: sólido (ou vidro, com `alpha` < 1), cor do material + emissivo, uma luz fixa de cima ("sol" falso,
 *  sem PointLight) e uma borda que acende na cor `rim` — sem PBR, sem sombras: barato e ainda com volume. */
export function solidoLeve(o: { cor: THREE.Color; emissivo: THREE.Color; rim: THREE.Color; alpha?: number; lados?: boolean; rimForca?: number }): THREE.ShaderMaterial {
  const alpha = o.alpha ?? 1;
  return new THREE.ShaderMaterial({
    uniforms: {
      uCor: { value: o.cor.clone() }, uEmi: { value: o.emissivo.clone() }, uRim: { value: o.rim.clone() },
      uAlpha: { value: alpha }, uRimF: { value: o.rimForca ?? 0.55 }, uT: TEMPO_CAMUFLAGEM,
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vNW;
      void main() {
        vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
        vec4 w = modelMatrix * p; vW = w.xyz;
        vNW = normalize(mat3(modelMatrix) * n);
        vec4 mv = viewMatrix * w; vV = -mv.xyz; vN = normalize(mat3(viewMatrix) * vNW);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCor; uniform vec3 uEmi; uniform vec3 uRim; uniform float uAlpha; uniform float uRimF; uniform float uT;
      varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vNW;
      void main() {
        vec3 n = normalize(vNW);
        float sol = max(dot(n, normalize(vec3(0.35, 0.85, 0.4))), 0.0);   // a luz "de mentira", de cima
        float ceu = 0.5 + 0.5 * n.y;                                         // hemisfério: topo mais claro
        vec3 c = uCor * (0.32 + 0.38 * ceu + 0.55 * sol) + uEmi;
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float borda = pow(f, 3.0) * (0.85 + 0.15 * sin(uT * 1.3 + vW.y * 0.5));
        c += uRim * borda * uRimF;
        gl_FragColor = vec4(c, clamp(uAlpha + borda * 0.35 * (1.0 - uAlpha), 0.0, 1.0));
      }`,
    transparent: alpha < 1, depthWrite: alpha >= 1, side: o.lados ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/** o shader dos PISOS: escuro translúcido + grade de luz (passo em metros, no mundo) que respira devagar */
export function pisoHolografico(cor: THREE.ColorRepresentation, o: { passo?: number; fundo?: number } = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uCor: { value: new THREE.Color(cor) }, uT: TEMPO_CAMUFLAGEM, uPasso: { value: o.passo ?? 4 }, uFundo: { value: o.fundo ?? 0.55 } },
    vertexShader: VERT,
    fragmentShader: `uniform vec3 uCor; uniform float uT; uniform float uPasso; uniform float uFundo; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main() {
        vec2 g = abs(fract(vW.xz / uPasso - 0.5) - 0.5) / fwidth(vW.xz / uPasso);
        float linha = 1.0 - min(min(g.x, g.y), 1.0);
        float pulso = 0.55 + 0.45 * sin(uT * 0.8 + (vW.x + vW.z) * 0.05);
        vec3 c = mix(vec3(0.01, 0.03, 0.07), uCor, linha * 0.85 * pulso);
        gl_FragColor = vec4(c + uCor * 0.04, max(uFundo, linha * 0.9));
      }`,
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
  });
}

/** a cor de um material "real" (o emissivo, se tiver, é a cor que ele quer mostrar) — clareada pra virar luz */
function tomDe(mat: THREE.MeshStandardMaterial): THREE.Color {
  const e = mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.02 ? mat.emissive.clone() : mat.color.clone();
  const hsl = { h: 0, s: 0, l: 0 }; e.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, Math.max(0.55, hsl.s), Math.min(0.72, Math.max(0.55, hsl.l + 0.35)));
}

/**
 * Percorre um ambiente JÁ MONTADO e troca o PBR pelo MEIO-TERMO (`solidoLeve`): continua sólido, sem luz de verdade. Materiais repetidos viram UM
 * shader (cache por material). Some PointLight/SpotLight (com tudo sem luz, elas só custam). `pular` preserva peças.
 */
export function camuflarGrupo(raiz: THREE.Object3D, o: { pular?: (m: THREE.Object3D) => boolean } = {}): void {
  const cache = new Map<THREE.Material, THREE.Material>();
  const luzes: THREE.Light[] = [];
  raiz.traverse((obj) => {
    if ((obj as THREE.PointLight).isPointLight || (obj as THREE.SpotLight).isSpotLight) { luzes.push(obj as THREE.Light); return; }
    const m = obj as THREE.Mesh;
    if (!m.isMesh || o.pular?.(m)) return;
    const troca = (mat: THREE.Material): THREE.Material => {
      const st = mat as THREE.MeshStandardMaterial;
      if (!st.isMeshStandardMaterial) return mat;   // Basic/Sprite/Points/Line/Shader: já são leves
      if (st.map) {   // texturizado (tela, logo, água, deck): mantém a imagem, sem luz
        let b = cache.get(mat);
        if (!b) { b = new THREE.MeshBasicMaterial({ map: st.map, color: st.color, transparent: st.transparent, opacity: st.opacity, side: st.side, depthWrite: st.depthWrite }); cache.set(mat, b); }
        return b;
      }
      // MEIO-TERMO: tudo continua sólido (vidro continua vidro, com a mesma transparência), sem PBR nem luzes
      let c = cache.get(mat);
      if (!c) {
        const emi = st.emissive ? st.emissive.clone().multiplyScalar(st.emissiveIntensity ?? 1) : new THREE.Color(0);
        const alpha = st.transparent ? Math.max(0.18, st.opacity) : 1;
        c = solidoLeve({ cor: st.color.clone(), emissivo: emi, rim: tomDe(st), alpha, lados: st.side === THREE.DoubleSide });
        cache.set(mat, c);
      }
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(troca) : troca(m.material);
    m.castShadow = false; m.receiveShadow = false;
  });
  for (const l of luzes) l.parent?.remove(l);
}
