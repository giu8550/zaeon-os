/**
 * TemploCosmico — o SALÃO central do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu):
 * a laje do salão (mais baixa que o lounge), o guarda-corpo de vidro com as aberturas, a PONTE subindo até o pátio do
 * lounge e, no meio, o MONUMENTO ALIENÍGENA — a pirâmide de obsidiana com as arestas acesas, o cume dourado flutuando
 * de ponta-cabeça, os anéis girando em volta e o feixe subindo pro céu.
 * Referencial da SALA do lounge, y = 0 no pátio (quem monta põe o grupo no lounge, com o mesmo giro e o ESPELHO dele).
 */
import * as THREE from "three";
import { CUPULA, PIRAMIDE, PLATS, PONTES, SALAO, aberturasDe, portaDaCupula } from "@/lib/cyber/temploCosmico";
import { TEMPLO } from "@/lib/cyber/templo";
import { criarMeio } from "./TemploMeio";
import { criarRasta } from "./TemploRasta";
import { criarLoungesEstudo } from "./TemploEstudo";

export type SalaoCosmicoHandle = { group: THREE.Group; alvos: THREE.Object3D[]; /** de onde sai o som calmo dos lounges estudantis */ caixasEstudo: THREE.Object3D[]; /** os raios do campus de TI que caíram desde a última leitura (mundo) */ raiosCampus(): { x: number; y: number; z: number }[]; /** a cápsula da torre em que eu estou (a vista de dentro) */ capsulaDentro(id: string | null): void; atualizar(dt: number, t: number): void; /** a porta da CÚPULA da guardiã: aberta pra quem venceu o duelo */ cupula(aberta: boolean): void; dispose(): void };

const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function criarSalaoCosmico(o: { low: boolean; paredeMat: THREE.Material }): SalaoCosmicoHandle {
  const group = new THREE.Group(); group.name = "salao-cosmico";
  const alvos: THREE.Object3D[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const seg = o.low ? 48 : 96;

  // ── as PLATAFORMAS da rede (o salão, o disco rasta, a capela maior, o salão de festas, o lounge dos casais): a laje,
  //    o aro aceso e o guarda-corpo de vidro aberto onde as pontes e as escadarias encostam ──
  const TEMA: Record<string, { laje: number; brilho: number; aro: number }> = {
    salao: { laje: 0x0b0a1e, brilho: 0x1a1048, aro: 0x66e6ff },
    rasta: { laje: 0x070c08, brilho: 0x08200e, aro: 0xffd23f }, capelaRasta: { laje: 0x0d160f, brilho: 0x184a22, aro: 0x2fae4a },
    festas: { laje: 0x140c0c, brilho: 0x4a1418, aro: 0xe63946 }, cyber: { laje: 0x060407, brilho: 0x1a0408, aro: 0xff2a3a }, casais: { laje: 0x160c14, brilho: 0x4a1840, aro: 0xff7ab8 },
  };
  for (const p of PLATS) {
    const tm = TEMA[p.id] ?? TEMA.salao!, y = p.h;
    const laje = malha(new THREE.CylinderGeometry(p.r + 0.6, p.r - 2, 2.2, seg), new THREE.MeshStandardMaterial({ color: tm.laje, emissive: tm.brilho, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.6 }));
    laje.position.set(p.x, y - 1.1, p.z); alvos.push(laje);
    const aro = malha(new THREE.TorusGeometry(p.r + 0.6, 0.3, 6, seg * 2), aditivo(tm.aro, 0.75)); aro.rotation.x = Math.PI / 2; aro.position.set(p.x, y - 0.1, p.z);
    const abs = aberturasDe(p).sort((a, b) => a.ang - b.ang);
    const trechos: [number, number][] = abs.length ? [] : [[0, Math.PI * 2]];   // [ângulo inicial, final] fechados, entre as aberturas
    for (let i = 0; i < abs.length; i++) { const a = abs[i]!, b = abs[(i + 1) % abs.length]!; let fim = b.ang - b.meia; const ini = a.ang + a.meia; while (fim <= ini) fim += Math.PI * 2; trechos.push([ini, fim]); }
    for (const [ini, fim] of trechos) {
      // no CylinderGeometry: x = r·sen θ, z = r·cos θ → o ângulo `a` (x = cos a, z = sen a) é θ = π/2 − a
      const g = new THREE.CylinderGeometry(p.r, p.r, 1.15, Math.max(8, Math.round(seg * (fim - ini) / (Math.PI * 2))), 1, true, Math.PI / 2 - fim, fim - ini);
      const w = malha(g, o.paredeMat); w.position.set(p.x, y + 0.58, p.z);
      // o friso aceso em cima: o toro nasce no plano xy a partir do +x — gira no plano (z) até o começo e deita (x = π/2)
      const topo = malha(new THREE.TorusGeometry(p.r, 0.07, 4, 64, fim - ini), aditivo(tm.aro, 0.8)); topo.rotation.set(Math.PI / 2, 0, ini); topo.position.set(p.x, y + 1.16, p.z);
    }
  }
  // o piso do SALÃO: círculos de luz gravados e os raios saindo da pirâmide
  const S = SALAO, y0 = -S.desce;
  const gravura = aditivo(0x8a7dff, 0.35);
  for (const [r, w] of [[S.r - 1.2, 0.35], [S.r * 0.72, 0.18], [S.r * 0.46, 0.18], [PIRAMIDE.meia * 1.75, 0.5]] as const) {
    const an = malha(new THREE.RingGeometry(r - w, r, seg), gravura); an.rotation.x = -Math.PI / 2; an.position.set(S.x, y0 + 0.02, S.z);
  }
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2, len = S.r - PIRAMIDE.meia * 1.75 - 2, l = malha(new THREE.PlaneGeometry(0.16, len), gravura);
    l.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2); const d = PIRAMIDE.meia * 1.75 + len / 2;
    l.position.set(S.x + Math.cos(a) * d, y0 + 0.025, S.z + Math.sin(a) * d);
  }

  // ── as PONTES: a rampa de cristal, as quinas acesas, o guarda-corpo e as faixas de luz (o ritmo de quem sobe) ──
  const COR_PONTE: Record<string, number> = { lounge: 0x66e6ff, rasta: 0x2fae4a, festas: 0xffd23f, casais: 0xff7ab8, meio: 0xff2a3a, escadaMeio: 0xff2a3a };
  const tabMat = new THREE.MeshStandardMaterial({ color: 0x14123a, emissive: 0x2a1c70, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.5 });
  for (const po of PONTES) {
    const { a, b, meia } = po, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), dy = po.hb - po.ha, inc = Math.atan2(dy, L), comp = Math.hypot(L, dy), cor = COR_PONTE[po.id] ?? 0x66e6ff;
    const ponte = new THREE.Group(); ponte.position.set((a.x + b.x) / 2, po.ha + dy / 2, (a.z + b.z) / 2); ponte.rotation.y = Math.atan2(dx, dz); group.add(ponte);
    const tab = malha(new THREE.BoxGeometry(meia * 2, 0.5, comp), tabMat, ponte); tab.rotation.x = -inc; tab.position.y = -0.25; alvos.push(tab);
    const quinaMat = aditivo(cor, 0.9), faixa = aditivo(cor, 0.4);
    for (const sx of [-1, 1]) {
      const quina = malha(new THREE.BoxGeometry(0.18, 0.1, comp), quinaMat, ponte); quina.rotation.x = -inc; quina.position.set(sx * (meia - 0.1), 0.02, 0);
      const vidro = malha(new THREE.BoxGeometry(0.06, 1.1, comp), o.paredeMat, ponte); vidro.rotation.x = -inc; vidro.position.set(sx * (meia + 0.3), 0.55, 0);
    }
    if (Math.abs(dy) > 3) {   // ESCADA (as que sobem pras festas): DEGRAUS de verdade em cima da rampa, a quina acesa
      const n = Math.round(L / 0.85), passoH = L / n, gD = new THREE.BoxGeometry(meia * 2, Math.abs(dy) / n + 0.05, passoH + 0.02), gQ = new THREE.BoxGeometry(meia * 2 - 0.3, 0.04, 0.06); geos.push(gD, gQ);
      const imD = new THREE.InstancedMesh(gD, tabMat, n), imQ = new THREE.InstancedMesh(gQ, quinaMat, n), mm = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { const zl = -L / 2 + (i + 0.5) * passoH, yd = -dy / 2 + dy * ((i + 1) / n); imD.setMatrixAt(i, mm.makeTranslation(0, yd - Math.abs(dy) / n / 2, zl)); imQ.setMatrixAt(i, mm.makeTranslation(0, yd + 0.01, zl - passoH / 2 * Math.sign(dy))); }
      for (const im of [imD, imQ]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); ponte.add(im); }
      alvos.push(imD); tab.visible = false;
    } else for (let k = 1; k < comp / 2; k++) { const f = malha(new THREE.PlaneGeometry(meia * 2 - 0.6, 0.12), faixa, ponte); const t = k * 2 - comp / 2; f.rotation.x = -Math.PI / 2 - inc; f.position.set(0, t * Math.sin(inc) + 0.01, t * Math.cos(inc)); }
  }

  // ── o LOUNGE RASTA (components/cyber/TemploRasta): a árvore, a escadaria das raízes, a capela maior, festas, casais e a torre ──
  const rasta = criarRasta({ low: o.low, paredeMat: o.paredeMat }); group.add(rasta.group); alvos.push(...rasta.alvos);
  // ── a CÚPULA da guardiã: o vidro de energia fechado em volta da capela do lounge (o templo lá em cima) e a PORTA na
  //    entrada da escadaria-veia — um campo de força vermelho até a Examiner abrir (lib/cyber/dueloIngles) ──
  const cupulaMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec3 vP; varying vec3 vN;
      void main(){
        vec2 h = vec2(atan(vP.z, vP.x) * 9.0, vP.y * 0.55); vec2 g = abs(fract(h + vec2(0.5 * floor(h.y), 0.0)) - 0.5);
        float hex = smoothstep(0.06, 0.0, min(g.x, g.y)), borda = pow(1.0 - abs(vN.z), 2.0);
        float onda = 0.5 + 0.5 * sin(vP.y * 0.4 - uT * 1.4);
        gl_FragColor = vec4(vec3(0.9, 0.08, 0.16) * (0.05 + 0.32 * hex * onda + 0.18 * borda), 1.0);
      }`,
  });
  const cup = new THREE.Group(); cup.position.set(TEMPLO.x, TEMPLO.h, TEMPLO.z); group.add(cup);
  const domo = malha(new THREE.SphereGeometry(CUPULA.r, o.low ? 36 : 64, o.low ? 14 : 24, 0, Math.PI * 2, 0, Math.PI / 2), cupulaMat, cup); domo.scale.y = CUPULA.alt / CUPULA.r;
  const base = malha(new THREE.TorusGeometry(CUPULA.r, 0.35, 6, seg * 2), aditivo(0xff2a3a, 0.8), cup); base.rotation.x = Math.PI / 2; base.position.y = 0.2;
  const pd = portaDaCupula(), larg = 2 * TEMPLO.r * Math.sin(pd.meia), porta = new THREE.Group();
  porta.position.set(pd.x - TEMPLO.x, 0, pd.z - TEMPLO.z); porta.rotation.y = Math.atan2(Math.cos(pd.ang), Math.sin(pd.ang)); cup.add(porta);
  const campoMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uAbre: { value: 0 } }, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uAbre; varying vec2 vUv;
      void main(){ if (vUv.y < uAbre) discard; float l = 0.5 + 0.5 * sin(vUv.y * 60.0 - uT * 8.0), b = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        gl_FragColor = vec4(vec3(1.0, 0.1, 0.18) * (0.25 + 0.55 * l) * b, 1.0); }` });
  malha(new THREE.PlaneGeometry(larg, CUPULA.portaAlt), campoMat, porta).position.y = CUPULA.portaAlt / 2;
  for (const [w, h, x, y] of [[0.5, CUPULA.portaAlt + 0.6, -larg / 2, CUPULA.portaAlt / 2], [0.5, CUPULA.portaAlt + 0.6, larg / 2, CUPULA.portaAlt / 2], [larg + 0.5, 0.5, 0, CUPULA.portaAlt + 0.3]] as const) { const b = malha(new THREE.BoxGeometry(w, h, 0.4), aditivo(0xff2a3a, 0.95), porta); b.position.set(x, y, 0); }
  for (const x of [cup, domo, porta]) x.userData.semLote = true;
  let abrir = 0, abrirAlvo = 0;

  // ── os LOUNGES ESTUDANTIS (components/cyber/TemploEstudo): dos dois lados do salão, antes das escadas das festas ──
  const estudo = criarLoungesEstudo({ low: o.low, paredeMat: o.paredeMat }); group.add(estudo.group); alvos.push(...estudo.alvos);
  // ── o CAMINHO DO MEIO (components/cyber/TemploMeio): o caminho reto, a escadaria e o monumento da Cyber Room ──
  const meio = criarMeio({ low: o.low }); group.add(meio.group); alvos.push(...meio.alvos);

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
    group, alvos, caixasEstudo: estudo.caixas, raiosCampus: () => meio.raios(), capsulaDentro: (id) => meio.capsulaDentro(id),
    atualizar(dt, t) {
      rasta.atualizar(dt, t); meio.atualizar(dt, t); estudo.atualizar(dt, t);
      cupulaMat.uniforms.uT!.value = t; campoMat.uniforms.uT!.value = t;
      abrir += (abrirAlvo - abrir) * Math.min(1, dt * 1.6); campoMat.uniforms.uAbre!.value = abrir;
      cume.rotation.y += dt * 0.6; cume.position.y = P.alt + 4.5 + Math.sin(t * 0.9) * 0.6;
      aneis.forEach((an, i) => { an.rotation.z += dt * (0.3 + i * 0.2) * (i % 2 ? -1 : 1); an.position.y = cume.position.y; });
      corpoMat.uniforms.uT!.value = t;
      (feixe.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.06 * Math.sin(t * 1.3);
      cascaMat.opacity = 0.09 + 0.05 * Math.sin(t * 0.7);
    },
    cupula(aberta) { abrirAlvo = aberta ? 1 : 0; },
    dispose() { rasta.dispose(); meio.dispose(); estudo.dispose(); group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) if (m !== o.paredeMat) m.dispose(); },
  };
}
