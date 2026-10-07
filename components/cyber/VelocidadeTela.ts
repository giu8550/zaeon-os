/**
 * VELOCIDADE NA TELA (moto rápida / boost): BLUR RADIAL (o borrão de quando a câmera é que corre — as bordas
 * esticam pro centro, o meio fica nítido) + LINHAS DE VELOCIDADE (riscos finos correndo das bordas) + vinheta leve.
 * Uma passada só, barata: a cena vai pra uma textura e um quad de tela inteira lê ela com `AMOSTRAS` toques ao longo
 * do raio. Desligado (`forca` ≈ 0) a cena desenha direto na tela — custo zero fora da moto.
 */
import * as THREE from "three";

const AMOSTRAS = 10;

export type VelocidadeTela = {
  /** desenha o quadro: `desenhar()` = o desenho normal da cena (no alvo atual); `forca` 0..~1.2 */
  render(R: THREE.WebGLRenderer, forca: number, t: number, desenhar: () => void): void;
  dispose(): void;
};

export function criarVelocidadeTela(o: { amostrasMsaa: number }): VelocidadeTela {
  let rt: THREE.WebGLRenderTarget | null = null;
  const tam = new THREE.Vector2();
  const mat = new THREE.ShaderMaterial({
    uniforms: { tCena: { value: null }, uForca: { value: 0 }, uT: { value: 0 }, uAspecto: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tCena; uniform float uForca, uT, uAspecto; varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec2 d = vUv - 0.5; float r = length(d * vec2(uAspecto, 1.0));
        // blur radial: o meio (r < ~0.18) fica nítido; nas bordas estica até ~9% da tela
        float k = uForca * 0.09 * smoothstep(0.12, 0.75, r);
        vec4 c = vec4(0.0);
        for (int i = 0; i < ${AMOSTRAS}; i++) c += texture2D(tCena, 0.5 + d * (1.0 - k * float(i) / ${AMOSTRAS - 1}.0));
        c /= ${AMOSTRAS}.0;
        // linhas de velocidade: fatias finas de ângulo, cada uma acende de vez em quando e corre pra fora
        float ang = atan(d.y, d.x * uAspecto), fatia = floor((ang + 3.14159) * 38.0);
        float liga = step(0.84, hash(fatia + floor(uT * 7.0 + hash(fatia) * 7.0)));
        float risco = smoothstep(0.35, 0.0, abs(fract((ang + 3.14159) * 38.0) - 0.5)) * liga;
        float corre = fract(r * 2.2 - uT * 3.5 + hash(fatia * 1.7));
        float linha = risco * smoothstep(0.3, 0.75, r) * smoothstep(0.0, 0.25, corre) * (1.0 - corre);
        c.rgb += vec3(0.75, 0.92, 1.0) * linha * 0.22 * clamp(uForca - 0.25, 0.0, 1.0);   // só bem rápido (no cruzeiro, quase nada)
        // vinheta: as bordas escurecem um tico (o olhar vai pro centro)
        c.rgb *= 1.0 - 0.22 * clamp(uForca, 0.0, 1.0) * smoothstep(0.45, 0.9, r);
        gl_FragColor = vec4(c.rgb, 1.0);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const cenaQuad = new THREE.Scene(); cenaQuad.add(quad);
  const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    render(R, forca, t, desenhar) {
      if (forca < 0.03) { desenhar(); return; }
      R.getDrawingBufferSize(tam);
      if (!rt || rt.width !== tam.x || rt.height !== tam.y) {
        rt?.dispose();
        // HalfFloat: a cena fica LINEAR na textura (a conversão pra sRGB é no quad) — com 8 bits o escuro faria degraus
        rt = new THREE.WebGLRenderTarget(tam.x, tam.y, { type: THREE.HalfFloatType, samples: o.amostrasMsaa, depthBuffer: true });
      }
      const ant = R.getRenderTarget();
      R.setRenderTarget(rt); desenhar(); R.setRenderTarget(ant);
      mat.uniforms.tCena!.value = rt.texture; mat.uniforms.uForca!.value = forca; mat.uniforms.uT!.value = t; mat.uniforms.uAspecto!.value = tam.x / Math.max(1, tam.y);
      R.render(cenaQuad, camQuad);
    },
    dispose() { rt?.dispose(); mat.dispose(); quad.geometry.dispose(); },
  };
}
