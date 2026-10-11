/**
 * CoracaoZaeon — o CICLO do coração da Zaeon (o ritmo, o traçado e os atrasos são puros: lib/cyber/coracao):
 *  - o RAIO azul cai na ponta da capela (6 formatos ramificados pré-gerados, girados ao acaso, com clarão);
 *  - o pulso DESCE a capela (o eixo central até o globo + as 8 nervuras da cúpula e dos pilares);
 *  - o globo BATE ("tum-tum") e o azul se PROPAGA pelas VEIAS, do coração pra fora (pelo caminho de cada uma).
 * As veias são UMA malha (fitas deitadas na superfície) com o ATRASO do pulso em cada vértice; azul sólido (mistura
 * normal — o piso é claro como as colunas, e luz somada sumiria nele). Sem luz, sem sombra: barato.
 * Com movimento reduzido: o raio não tremula. No modo leve, sem as veias. Tudo no referencial da ILHA.
 */
import * as THREE from "three";
import { CORACAO, T_CORACAO, TOPO_DA_CAPELA, bateAgora, batidaNoCoracao, disparaRaio, gerarVeias } from "@/lib/cyber/coracao";

export type CoracaoHandle = {
  group: THREE.Group;
  /** a intensidade da batida no coração agora (0..1) — o globo e as estações pulsam junto */
  batida(): number;
  /** chamar todo quadro; devolve `true` no quadro em que um RAIO dispara (o engine toca o som) */
  atualizar(dt: number, t: number): { raio: boolean; tum: boolean };
  dispose(): void;
};

/** o "tum-tum" no shader: `x` = s depois de uma 1ª bulha (periódico no ciclo) — o mesmo de lib/cyber/coracao `pulso` */
const GLSL_PULSO = /* glsl */ `
  float pulso(float x) {
    float c = ${CORACAO.ciclo.toFixed(3)};
    float u = mod(x, c);
    float d1 = u > c * 0.5 ? u - c : u;
    float d2 = u - ${CORACAO.dub.toFixed(3)}; d2 = d2 > c * 0.5 ? d2 - c : (d2 < -c * 0.5 ? d2 + c : d2);
    return min(1.0, exp(-d1 * d1 / 0.0081) + ${CORACAO.forcaDub.toFixed(2)} * exp(-d2 * d2 / 0.01));
  }`;

/** fitas (2 vértices por ponto) deitadas na superfície; atributos: atraso do pulso (s), lado (0..1), geração */
function fitas(lista: { p: number[]; n: number[]; w: number[]; a: number[]; geracao: number }[]): THREE.BufferGeometry {
  let nv = 0; for (const v of lista) nv += (v.p.length / 3) * 2;
  const pos = new Float32Array(nv * 3), dist = new Float32Array(nv), lado = new Float32Array(nv), ger = new Float32Array(nv), idx: number[] = [];
  const P = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), S = new THREE.Vector3();
  let k = 0;
  for (const v of lista) {
    const n = v.p.length / 3, base = k;
    for (let i = 0; i < n; i++) {
      P.fromArray(v.p, i * 3); A.fromArray(v.p, Math.max(0, i - 1) * 3); B.fromArray(v.p, Math.min(n - 1, i + 1) * 3);
      T.subVectors(B, A).normalize(); N.fromArray(v.n, i * 3); S.crossVectors(T, N).normalize().multiplyScalar(v.w[i]! / 2);
      for (const s of [-1, 1]) { pos[k * 3] = P.x + S.x * s; pos[k * 3 + 1] = P.y + S.y * s; pos[k * 3 + 2] = P.z + S.z * s; dist[k] = v.a[i]!; lado[k] = s < 0 ? 0 : 1; ger[k] = v.geracao; k++; }
      if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aAtraso", new THREE.BufferAttribute(dist, 1));
  g.setAttribute("aLado", new THREE.BufferAttribute(lado, 1)); g.setAttribute("aGer", new THREE.BufferAttribute(ger, 1)); g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** um raio ramificado (polilinha por deslocamento de ponto médio + galhos), como fitas em 2 planos cruzados */
function formatoDeRaio(semente: number, altura: number): THREE.BufferGeometry {
  let s = semente >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const linhas: { pts: THREE.Vector3[]; w: number }[] = [];
  const quebrar = (a: THREE.Vector3, b: THREE.Vector3, prof: number, desvio: number): THREE.Vector3[] => {
    if (prof === 0) return [a, b];
    const m = a.clone().lerp(b, 0.5); m.x += (r() - 0.5) * desvio; m.z += (r() - 0.5) * desvio; m.y += (r() - 0.5) * desvio * 0.2;
    return [...quebrar(a, m, prof - 1, desvio * 0.55).slice(0, -1), ...quebrar(m, b, prof - 1, desvio * 0.55)];
  };
  const topo = new THREE.Vector3((r() - 0.5) * 30, altura, (r() - 0.5) * 30);
  const tronco = quebrar(new THREE.Vector3(0, 0, 0), topo, 6, altura * 0.35);
  linhas.push({ pts: tronco, w: 1.5 });
  for (let f = 0; f < 3; f++) {
    const i0 = Math.floor(tronco.length * (0.2 + r() * 0.55)), o = tronco[i0]!, comp = 25 + r() * 35, ang = r() * Math.PI * 2;
    const fim = o.clone().add(new THREE.Vector3(Math.cos(ang) * comp * 0.8, comp * (0.3 + r() * 0.5), Math.sin(ang) * comp * 0.8));
    linhas.push({ pts: quebrar(o, fim, 4, comp * 0.4), w: 0.75 });
  }
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const { pts, w } of linhas) for (const lado of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
    const base = pos.length / 3;
    pts.forEach((p, i) => { const k = 1 - 0.6 * (i / pts.length); for (const s of [-1, 1]) { pos.push(p.x + lado.x * s * w * k, p.y, p.z + lado.z * s * w * k); uv.push(s < 0 ? 0 : 1, i / pts.length); } if (i > 0) { const a = base + (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

function texBrilho(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(235,250,255,1)"); gr.addColorStop(0.25, "rgba(140,210,255,.8)"); gr.addColorStop(1, "rgba(40,110,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export function criarCoracao(o: { low: boolean }): CoracaoHandle {
  const rm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const group = new THREE.Group();
  // LEVE (placa integrada): sem as VEIAS pulsando no piso — uma malha transparente do tamanho da ilha, desenhada por
  // cima de tudo a cada quadro (o raio e o clarão no topo ficam)
  const { veias } = o.low ? { veias: [] } : gerarVeias({ low: o.low });

  // ── as VEIAS ──
  const uT = { value: 0 };
  const Tc = T_CORACAO();
  const matVeia = new THREE.ShaderMaterial({
    uniforms: { uT },
    vertexShader: /* glsl */ `attribute float aAtraso; attribute float aLado; attribute float aGer; varying float vA; varying float vL; varying float vG;
      void main() { vA = aAtraso; vL = aLado; vG = aGer; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uT; varying float vA; varying float vL; varying float vG; ${GLSL_PULSO}
      void main() {
        // o raio cai em t = k·ciclo; o pulso passa aqui vA s depois (o "tum-tum" chega junto)
        float b = pulso(uT - vA);
        float longe = exp(-max(0.0, vA - ${Tc.toFixed(3)}) / 9.0);
        float centro = 1.0 - abs(vL * 2.0 - 1.0); centro = centro * centro * (3.0 - 2.0 * centro);
        float acende = b * (0.35 + 0.65 * longe);
        vec3 cor = mix(vec3(0.10, 0.33, 0.92), vec3(0.18, 0.72, 1.0), acende);
        float alfa = (0.7 + 0.3 * acende) * centro;   // (o afinamento já vem da largura — Murray)
        gl_FragColor = vec4(cor * (1.0 + 0.6 * acende), alfa);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const geoVeias = fitas(veias);
  const malhaVeias = new THREE.Mesh(geoVeias, matVeia); malhaVeias.frustumCulled = false; malhaVeias.renderOrder = 1; if (veias.length) group.add(malhaVeias);

  // ── o RAIO no topo ──
  const topo = TOPO_DA_CAPELA(), formatos = Array.from({ length: 6 }, (_, i) => formatoDeRaio(1000 + i * 77, 150));
  const uA = { value: 0 };
  const matRaio = new THREE.ShaderMaterial({
    uniforms: { uA },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `uniform float uA; varying vec2 vUv;
      void main() { float c = 1.0 - abs(vUv.x * 2.0 - 1.0); float nucleo = pow(c, 3.0); vec3 cor = mix(vec3(0.25, 0.55, 1.0), vec3(0.92, 0.98, 1.0), nucleo);
        gl_FragColor = vec4(cor * (0.35 * c + nucleo * 1.6) * uA * (1.0 - vUv.y * 0.35), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const raio = new THREE.Mesh(formatos[0]!, matRaio); raio.position.set(topo.x, topo.y, topo.z); raio.visible = false; raio.frustumCulled = false; group.add(raio);
  const tex = texBrilho();
  const clarao = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xaee2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  clarao.position.set(topo.x, topo.y + 2, topo.z); clarao.scale.setScalar(46); group.add(clarao);

  let tAnt = -1, idadeRaio = 99;
  return {
    group,
    batida: () => batidaNoCoracao(uT.value),
    atualizar(dt, t) {
      uT.value = t;
      // o raio: cai no começo de cada ciclo
      const dispara = tAnt >= 0 && disparaRaio(tAnt, t), tum = tAnt >= 0 && bateAgora(tAnt, t); tAnt = t;
      if (dispara) { raio.geometry = formatos[Math.floor(Math.random() * formatos.length)]!; raio.rotation.y = Math.random() * Math.PI * 2; idadeRaio = 0; }
      idadeRaio += dt;
      const a = idadeRaio < 0.05 ? idadeRaio / 0.05 : Math.exp(-(idadeRaio - 0.05) * 6) * (rm ? 1 : 0.75 + 0.25 * Math.sin(idadeRaio * 85));
      uA.value = idadeRaio < 0.9 ? a * (rm ? 0.6 : 1) : 0; raio.visible = uA.value > 0.01;
      clarao.material.opacity = idadeRaio < 1.2 ? Math.min(1, a * 1.1) : 0;
      return { raio: dispara, tum };
    },
    dispose() { geoVeias.dispose(); matVeia.dispose(); for (const f of formatos) f.dispose(); matRaio.dispose(); tex.dispose(); clarao.material.dispose(); group.removeFromParent(); },
  };
}
