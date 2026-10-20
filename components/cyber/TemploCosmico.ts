/**
 * TemploCosmico — o SALÃO central do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu):
 * a laje do salão (mais baixa que o lounge), o guarda-corpo de vidro com as aberturas, a PONTE subindo até o pátio do
 * lounge e, no meio, o MONUMENTO ALIENÍGENA — a pirâmide de obsidiana com as arestas acesas, o cume dourado flutuando
 * de ponta-cabeça, os anéis girando em volta e o feixe subindo pro céu.
 * Referencial da SALA do lounge, y = 0 no pátio (quem monta põe o grupo no lounge, com o mesmo giro e o ESPELHO dele).
 */
import * as THREE from "three";
import { PIRAMIDE, PONTE_LOUNGE, SALAO, aberturasDoSalao } from "@/lib/cyber/temploCosmico";

export type SalaoCosmicoHandle = { group: THREE.Group; alvos: THREE.Object3D[]; atualizar(dt: number, t: number): void; dispose(): void };

const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function criarSalaoCosmico(o: { low: boolean; paredeMat: THREE.Material }): SalaoCosmicoHandle {
  const group = new THREE.Group(); group.name = "salao-cosmico";
  const alvos: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const S = SALAO, y0 = -S.desce, seg = o.low ? 48 : 96;

  // ── a LAJE do salão: obsidiana polida, com círculos de luz gravados no piso ──
  const piso = malha(new THREE.CylinderGeometry(S.r + 0.6, S.r - 2, 2.2, seg), new THREE.MeshStandardMaterial({ color: 0x0b0a1e, emissive: 0x1a1048, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.6 }));
  piso.position.set(S.x, y0 - 1.1, S.z); alvos.push(piso);
  const gravura = aditivo(0x8a7dff, 0.35);
  for (const [r, w] of [[S.r - 1.2, 0.35], [S.r * 0.72, 0.18], [S.r * 0.46, 0.18], [PIRAMIDE.meia * 1.75, 0.5]] as const) {
    const an = malha(new THREE.RingGeometry(r - w, r, seg), gravura); an.rotation.x = -Math.PI / 2; an.position.set(S.x, y0 + 0.02, S.z);
  }
  // os raios gravados saindo da pirâmide (12 linhas finas no piso)
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, len = S.r - PIRAMIDE.meia * 1.75 - 2, l = malha(new THREE.PlaneGeometry(0.16, len), gravura);
    l.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2); const d = PIRAMIDE.meia * 1.75 + len / 2;
    l.position.set(S.x + Math.cos(a) * d, y0 + 0.025, S.z + Math.sin(a) * d);
  }
  const aro = malha(new THREE.TorusGeometry(S.r + 0.6, 0.3, 6, seg * 2), aditivo(0x66e6ff, 0.75)); aro.rotation.x = Math.PI / 2; aro.position.set(S.x, y0 - 0.1, S.z);

  // ── o GUARDA-CORPO de vidro (aberto onde saem as conexões) ──
  const abs = aberturasDoSalao().sort((a, b) => a.ang - b.ang);
  const trechos: [number, number][] = [];   // [ângulo inicial, final] fechados, entre as aberturas
  for (let i = 0; i < abs.length; i++) { const a = abs[i]!, b = abs[(i + 1) % abs.length]!; let fim = b.ang - b.meia; const ini = a.ang + a.meia; while (fim <= ini) fim += Math.PI * 2; trechos.push([ini, fim]); }
  for (const [ini, fim] of trechos) {
    // no CylinderGeometry: x = r·sen θ, z = r·cos θ → o ângulo `a` (x = cos a, z = sen a) é θ = π/2 − a
    const g = new THREE.CylinderGeometry(S.r, S.r, 1.15, Math.max(8, Math.round(seg * (fim - ini) / (Math.PI * 2))), 1, true, Math.PI / 2 - fim, fim - ini);
    const p = malha(g, o.paredeMat); p.position.set(S.x, y0 + 0.58, S.z);
    // o friso aceso em cima: o toro nasce no plano xy a partir do +x — gira no plano (z) até o começo e deita (x = π/2)
    const topo = malha(new THREE.TorusGeometry(S.r, 0.07, 4, 64, fim - ini), aditivo(0x9fe8ff, 0.8)); topo.rotation.set(Math.PI / 2, 0, ini); topo.position.set(S.x, y0 + 1.16, S.z);
  }

  // ── a PONTE até o pátio do lounge: a rampa de cristal, as quinas acesas e o guarda-corpo ──
  { const { a, b, meia } = PONTE_LOUNGE, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), dy = S.desce, inc = Math.atan2(dy, L), comp = Math.hypot(L, dy);
    const ponte = new THREE.Group(); ponte.position.set((a.x + b.x) / 2, y0 + dy / 2, (a.z + b.z) / 2); ponte.rotation.y = Math.atan2(dx, dz); group.add(ponte);
    const tab = malha(new THREE.BoxGeometry(meia * 2, 0.5, comp), new THREE.MeshStandardMaterial({ color: 0x14123a, emissive: 0x2a1c70, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 }), ponte);
    tab.rotation.x = -inc; tab.position.y = -0.25; alvos.push(tab);
    for (const s of [-1, 1]) {
      const quina = malha(new THREE.BoxGeometry(0.18, 0.1, comp), aditivo(0x66e6ff, 0.9), ponte); quina.rotation.x = -inc; quina.position.set(s * (meia - 0.1), 0.02, 0);
      const vidro = malha(new THREE.BoxGeometry(0.06, 1.1, comp), o.paredeMat, ponte); vidro.rotation.x = -inc; vidro.position.set(s * (meia + 0.3), 0.55, 0);
    }
    // os degraus de luz (faixas a cada 2 m: o ritmo de quem sobe)
    const faixa = aditivo(0xb98cff, 0.45);
    for (let k = 1; k < comp / 2; k++) { const f = malha(new THREE.PlaneGeometry(meia * 2 - 0.6, 0.12), faixa, ponte); const t = k * 2 - comp / 2; f.rotation.x = -Math.PI / 2 - inc; f.position.set(0, t * Math.sin(inc) + 0.01, t * Math.cos(inc)); }
  }

  // ── o MONUMENTO ALIENÍGENA: a pirâmide ──
  const P = PIRAMIDE, mon = new THREE.Group(); mon.position.set(P.x, y0, P.z); group.add(mon);
  const R = P.meia * Math.SQRT2;
  // o corpo: obsidiana com as faces sombreadas (uma luz fixa, sem custo de luz de verdade), o brilho subindo pro cume e os
  // GLIFOS — faixas de escrita acesa que sobem pelas faces, devagar (a escrita de quem construiu)
  const corpoMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAlt: { value: P.alt } },
    vertexShader: `varying vec3 vN; varying float vH; varying vec2 vF;
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vH = position.y; vF = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uAlt; varying vec3 vN; varying float vH; varying vec2 vF;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      void main(){
        float k = clamp(vH / uAlt + 0.5, 0.0, 1.0);
        float luz = 0.35 + 0.65 * max(0.0, dot(vN, normalize(vec3(0.5, 0.8, 0.35))));
        vec3 base = mix(vec3(0.03, 0.02, 0.09), vec3(0.16, 0.07, 0.34), k) * luz;
        float faixa = vH * 0.9 - uT * 0.35, linha = smoothstep(0.08, 0.0, abs(fract(faixa) - 0.5) - 0.06);
        float lado = atan(vF.y, vF.x) * 4.0, cel = floor(lado * 3.0 + floor(faixa) * 7.0);
        float glifo = linha * step(0.45, h(cel)) * (1.0 - k * 0.6);
        vec3 cor = base + vec3(0.4, 0.9, 1.0) * glifo * 0.9 + vec3(0.72, 0.55, 1.0) * pow(k, 6.0) * 0.6;
        gl_FragColor = vec4(cor, 1.0);
      }`,
  });
  const corpo = malha(new THREE.ConeGeometry(R, P.alt, 4, 1), corpoMat, mon);
  corpo.rotation.y = Math.PI / 4; corpo.position.y = P.alt / 2; alvos.push(corpo); corpo.userData.semLote = true;
  // as arestas acesas e a AURA (a mesma pirâmide um pouco maior, aditiva e tênue — o campo de energia)
  const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(corpo.geometry), new THREE.LineBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  geos.push(arestas.geometry); mats.push(arestas.material as THREE.Material); arestas.rotation.y = Math.PI / 4; arestas.position.y = P.alt / 2; mon.add(arestas);
  const cascaMat = aditivo(0x7a5cff, 0.07); cascaMat.side = THREE.FrontSide;
  const casca = malha(new THREE.ConeGeometry(R * 1.1, P.alt * 1.08, 4, 1, true), cascaMat, mon); casca.rotation.y = Math.PI / 4; casca.position.y = (P.alt * 1.08) / 2;
  // o CUME dourado: um octaedro flutuando de ponta-cabeça acima da ponta, e o halo
  const cume = malha(new THREE.OctahedronGeometry(2.4, 0), new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xffb43a, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.7 }), mon);
  cume.position.y = P.alt + 4.5; cume.scale.y = 1.5;
  const aneis = [0, 1, 2].map((i) => { const an = malha(new THREE.TorusGeometry(4.2 + i * 1.8, 0.07, 6, 64), aditivo(i === 1 ? 0xffd36a : 0xb98cff, 0.7), mon); an.position.y = P.alt + 4.5; an.rotation.x = Math.PI / 2 + (i - 1) * 0.5; return an; });
  // o FEIXE subindo pro céu (aditivo, sem luz de verdade: barato)
  const feixe = malha(new THREE.CylinderGeometry(0.6, 1.8, 160, 16, 1, true), aditivo(0xb98cff, 0.16), mon); feixe.position.y = P.alt + 4.5 + 80;
  for (const x of [casca, cume, feixe, ...aneis]) x.userData.semLote = true;

  return {
    group, alvos,
    atualizar(dt, t) {
      cume.rotation.y += dt * 0.6; cume.position.y = P.alt + 4.5 + Math.sin(t * 0.9) * 0.6;
      aneis.forEach((an, i) => { an.rotation.z += dt * (0.3 + i * 0.2) * (i % 2 ? -1 : 1); an.position.y = cume.position.y; });
      corpoMat.uniforms.uT!.value = t;
      (feixe.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(t * 1.3);
      cascaMat.opacity = 0.09 + 0.05 * Math.sin(t * 0.7);
    },
    dispose() { group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) if (m !== o.paredeMat) m.dispose(); },
  };
}
