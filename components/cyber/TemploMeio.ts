/**
 * TemploMeio — o CAMINHO DO MEIO do Templo Cósmico (layout puro em lib/cyber/temploCosmico; piso e colisão no ceu): o
 * caminho reto atrás da pirâmide (ladeado por obeliscos negros com a fenda vermelha), a ESCADARIA subindo e, lá em cima,
 * o MONUMENTO DA CYBER ROOM — mais sinistro que a pirâmide: o cubo negro de circuitos vermelhos pulsando, a pirâmide
 * invertida flutuando por cima com o olho, os estilhaços orbitando, o anel de varredura e o PORTAL selado virado pra
 * escada (a sala abre depois — o resto do caminho do meio vem com o dono).
 * Referencial da SALA do lounge, y = 0 no pátio (vai dentro do grupo do Templo Cósmico).
 */
import * as THREE from "three";
import { criarTeloesMercado } from "./TeloesMercado";
import { RACKS_TI, ALTO_TI, PIRAMIDE_INV, CABINES_TORRE, CABINE_TI, CAMPUS, CYBER, DIFUSOR_TI, ESTACOES_TI, NUCLEO_CYBER, PILARES_ALTO, POCOS_TC, PONTES, SALAO, TEMPESTADE_TI, TORRE_TI, capsulaEm, difusorDe, portaDoPoco } from "@/lib/cyber/temploCosmico";

export type MeioHandle = { group: THREE.Group; alvos: THREE.Object3D[]; /** os RAIOS que caíram desde a última leitura (onde, no MUNDO) — o engine toca o trovão */ raios(): { x: number; y: number; z: number }[]; /** a cápsula em que eu estou (a vista de DENTRO: sem o teto, o vidro quase sumido), ou null */ capsulaDentro(id: string | null): void; /** os ESTILHAÇOS girando em volta do cubo agora (MUNDO: centro e raio) — o engine empurra quem encosta */ estilhacos(): { x: number; y: number; z: number; r: number }[]; atualizar(dt: number, t: number): void; dispose(): void };

const VERMELHO = 0xff2a3a;
const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
/** o FLUXO da Cyber Room (out/2026, o dono: "a cor dessa sala pulsante, dinâmica — como o fluxo da árvore no lounge
 *  rasta —, mas o fluxo começa no TOPO da torre"): ondas de luz que nascem no olho da pirâmide invertida e descem pela
 *  torre (pelos pilares, pela coluna, pelos anéis) até o fim do campus; a cor da sala vai mudando devagar (vermelho →
 *  magenta → violeta → azul elétrico → de volta). `s` = o caminho (m) do olho até o ponto: a descida + o afastamento */
export const FLUXO_CYBER = { vel: 24, entre: 90, ciclo: 48 } as const;
const PALETA_CYBER = [0xff2a3a, 0xff1f9a, 0x9b2bff, 0x2a7dff, 0xff2a3a].map((c) => new THREE.Color(c));
type Fluxo = { uT: { value: number }; uV: { value: number }; uSp: { value: number }; uCor: { value: THREE.Color }; uFrente: { value: THREE.Color }; uFonte: { value: THREE.Vector3 }; uDoMundo: { value: THREE.Matrix4 } };
/** (GLSL) a onda no ponto `L` (layout): 0 fora da frente, 1 nela */
const ONDA_GLSL = `uniform float uT, uV, uSp; uniform vec3 uCor, uFrente, uFonte; uniform mat4 uDoMundo;
  float onda(vec3 L){ float s = max(0.0, uFonte.y - L.y) + length(L.xz - uFonte.xz); float p = fract((uT * uV - s) / uSp); return smoothstep(0.0, 0.03, p) * smoothstep(0.3, 0.04, p); }`;
/** a mesma onda em JS (pros anéis e frisos) */
const ondaEm = (f: Fluxo, x: number, y: number, z: number) => {
  const F = f.uFonte.value, s = Math.max(0, F.y - y) + Math.hypot(x - F.x, z - F.z), p = (((f.uT.value * f.uV.value - s) / f.uSp.value) % 1 + 1) % 1;
  const sm = (a: number, b: number, x: number) => { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  return sm(0, 0.03, p) * sm(0.3, 0.04, p);
};
/** as VEIAS do fluxo: a luz escorrendo do topo (os traços correndo pra baixo, como a seiva da árvore rasta) e a onda */
function materialVeia(f: Fluxo): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...f }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: "uniform mat4 uDoMundo; varying vec3 vL; void main(){ vec4 p = instanceMatrix * vec4(position, 1.0); vL = (uDoMundo * modelMatrix * p).xyz; gl_Position = projectionMatrix * modelViewMatrix * p; }",
    fragmentShader: `${ONDA_GLSL} varying vec3 vL;
      void main(){ float s = max(0.0, uFonte.y - vL.y) + length(vL.xz - uFonte.xz), p = fract((uT * uV * 0.7 - s) / 9.0);
        float gota = smoothstep(0.0, 0.06, p) * smoothstep(0.5, 0.1, p), w = onda(vL);
        gl_FragColor = vec4(uCor * (0.25 + 1.3 * gota) + uFrente * 2.2 * w, 1.0); }`,
  });
}
/** o CIRCUITO: trilhas em grade quebrada sobre o negro, na cor da sala, com o pulso correndo por elas e a ONDA do fluxo
 *  acendendo tudo quando passa */
function materialCircuito(f: Fluxo): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { ...f },
    vertexShader: "uniform mat4 uDoMundo; varying vec3 vP; varying vec3 vN; varying vec3 vL; void main(){ vP = position; vN = normal; vL = (uDoMundo * modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `${ONDA_GLSL} varying vec3 vP; varying vec3 vN; varying vec3 vL;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        vec3 n = abs(vN); vec2 uv = n.x > 0.5 ? vP.zy : n.y > 0.5 ? vP.xz : vP.xy;
        vec2 g = uv * 0.7, c = floor(g), f = fract(g);
        float r = h(c), linha = 0.0;
        if (r < 0.5) linha = smoothstep(0.08, 0.0, abs(f.y - 0.5)); else linha = smoothstep(0.08, 0.0, abs(f.x - 0.5));
        linha *= step(0.3, h(c + 7.0));
        float no = smoothstep(0.16, 0.08, length(f - 0.5)) * step(0.75, h(c + 3.0));
        float pulso = 0.35 + 0.65 * smoothstep(0.7, 1.0, fract(uv.y * 0.05 - uT * 0.25 + r * 0.3));
        float luz = 0.25 + 0.75 * max(0.0, dot(normalize(vN), normalize(vec3(0.4, 0.7, 0.5))));
        float w = onda(vL);
        vec3 cor = vec3(0.02, 0.01, 0.015) * (0.6 + luz) + uCor * (linha + no) * pulso + uFrente * ((linha + no) * 2.4 + 0.45) * w;
        gl_FragColor = vec4(cor, 1.0);
      }`,
  });
}

export function criarMeio(o: { low: boolean }): MeioHandle {
  const group = new THREE.Group(); group.name = "caminho-do-meio";
  const alvos: THREE.Object3D[] = [], anim: ((dt: number, t: number) => void)[] = [], geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [];
  const malha = <G extends THREE.BufferGeometry>(g: G, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); if (!mats.includes(m)) mats.push(m); const x = new THREE.Mesh(g, m); pai.add(x); return x; };
  const negro = new THREE.MeshStandardMaterial({ color: 0x050407, emissive: 0x0a0306, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.9 });

  const fluxo: Fluxo = { uT: { value: 0 }, uV: { value: FLUXO_CYBER.vel }, uSp: { value: FLUXO_CYBER.entre }, uCor: { value: new THREE.Color(VERMELHO) }, uFrente: { value: new THREE.Color(0xffd0d8) },
    uFonte: { value: new THREE.Vector3(CYBER.x, CYBER.h + PIRAMIDE_INV.y - PIRAMIDE_INV.alt / 2, CYBER.z) }, uDoMundo: { value: new THREE.Matrix4() } };
  /** o que acompanha a cor da sala (os frisos e anéis acesos) */
  const naCor: THREE.MeshBasicMaterial[] = [], corSala = (m: THREE.MeshBasicMaterial) => { naCor.push(m); return m; };
  const y0 = -SALAO.desce, campus = PONTES.find((p) => p.id === "meio")!, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), um = new THREE.Vector3(1, 1, 1);
  const instanciar = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { geos.push(geo); if (!mats.includes(mat)) mats.push(mat); const im = new THREE.InstancedMesh(geo, mat, n); group.add(im); return im; };
  const fechar = (...ims: THREE.InstancedMesh[]) => { for (const im of ims) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); } };

  // ── o CAMPUS DE TI: o piso de grade acesa e o CORREDOR do meio (a linha vermelha até a torre) ──
  { const L = campus.a.z - campus.b.z, zc = (campus.a.z + campus.b.z) / 2;
    const grade = new THREE.ShaderMaterial({ uniforms: { ...fluxo }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: "uniform mat4 uDoMundo; varying vec2 vP; varying vec3 vL; void main(){ vP = position.xy; vL = (uDoMundo * modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `${ONDA_GLSL} varying vec2 vP; varying vec3 vL;
        void main(){ vec2 g = abs(fract(vP / 3.0) - 0.5); float l = smoothstep(0.03, 0.0, min(g.x, g.y)); float pulso = 0.5 + 0.5 * sin(vP.y * 0.12 + uT * 1.5), w = onda(vL);
          vec3 base = mix(vec3(0.15, 0.55, 1.0), uCor, 0.55);
          gl_FragColor = vec4(base * l * (0.18 + 0.25 * pulso) + uFrente * (l * 0.9 + 0.05) * w, 1.0); }` });
    const pl = malha(new THREE.PlaneGeometry(CAMPUS.meia * 2 - 1, L), grade); pl.rotation.x = -Math.PI / 2; pl.position.set(campus.a.x, y0 + 0.03, zc);
    const linha = malha(new THREE.PlaneGeometry(0.35, L), corSala(aditivo(VERMELHO, 0.55))); linha.rotation.x = -Math.PI / 2; linha.position.set(campus.a.x, y0 + 0.04, zc);
  }
  // ── os TELÕES DO MERCADO na ponte inicial (components/cyber/TeloesMercado): a moldura acompanha a cor da sala ──
  const teloes = criarTeloesMercado({ low: o.low }); group.add(teloes.group); alvos.push(...teloes.alvos);
  anim.push((dt, t) => teloes.atualizar(dt, t, fluxo.uCor.value));
  // ── as ESTAÇÕES DE TRABALHO: as CABINES no molde das da cidadela (components/cyber/CabinesEstudo), nas cores da sala —
  //    o vidro escuro, os frisos vermelhos acesos, o monitor com o código rolando e o losango vermelho em cima ──
  const N = ESTACOES_TI.length, C = CABINE_TI;
  const escuro = new THREE.MeshStandardMaterial({ color: 0x0a0608, emissive: 0x16050a, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.7 });
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x1a1216, emissive: 0x1a060c, emissiveIntensity: 0.5, roughness: 0.45, metalness: 0.5 });
  const acesoV = corSala(new THREE.MeshBasicMaterial({ color: VERMELHO, toneMapped: false }));
  const vidroV = new THREE.MeshStandardMaterial({ color: 0xff8090, emissive: 0xff2a3a, emissiveIntensity: 0.06, transparent: true, opacity: 0.14, depthWrite: false, roughness: 0.1, metalness: 0.2, side: THREE.DoubleSide });
  const telaMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; varying float vI; void main(){ vUv = uv; vI = float(gl_InstanceID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec2 vUv; varying float vI; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      void main(){ float linha = floor(vUv.y * 14.0), comp = h(vec2(linha, vI)) * 0.8 + 0.1, rola = fract(uT * 0.3 + h(vec2(vI, 1.0)));
        float cod = step(vUv.x, comp) * step(0.25, fract(vUv.y * 14.0)) * step(fract(linha / 14.0 + rola), 0.9);
        vec3 fundo = mix(vec3(0.06, 0.01, 0.02), vec3(0.14, 0.02, 0.05), vUv.y), cor = mod(vI, 4.0) < 1.0 ? vec3(1.0, 0.85, 0.88) : vec3(1.0, 0.22, 0.3);
        gl_FragColor = vec4(fundo + cor * cod * 0.85, 1.0); }` });
  type Peca = { geo: THREE.BufferGeometry; mat: THREE.Material; pos: [number, number, number]; rotY?: number };
  const pecas: Peca[] = [
    { geo: new THREE.BoxGeometry(C.larg, 0.1, C.prof), mat: escuro, pos: [0, 0.05, 0.1] },                                   // o piso da cabine
    { geo: new THREE.BoxGeometry(C.larg + 0.04, 0.03, 0.06), mat: acesoV, pos: [0, 0.11, 0.1 + C.prof / 2] },                // os frisos
    { geo: new THREE.BoxGeometry(C.larg + 0.04, 0.03, 0.06), mat: acesoV, pos: [0, 0.11, 0.1 - C.prof / 2] },
    { geo: new THREE.BoxGeometry(2.2, 0.07, 0.85), mat: mesaMat, pos: [0, 0.78, C.mesaZ] },                                  // a mesa
    { geo: new THREE.BoxGeometry(2.2, 0.7, 0.05), mat: escuro, pos: [0, 0.4, C.mesaZ + 0.4] },
    { geo: new THREE.BoxGeometry(1.3, 0.76, 0.05), mat: escuro, pos: [0, 1.28, C.monitorZ] },                                 // o monitor
    { geo: new THREE.PlaneGeometry(1.2, 0.66), mat: telaMat, pos: [0, 1.28, C.monitorZ - 0.03], rotY: Math.PI },             // a TELA, virada pra quem senta
    { geo: new THREE.BoxGeometry(0.52, 0.07, 0.5), mat: mesaMat, pos: [0, 0.5, C.assentoZ] },                                // a cadeira
    { geo: new THREE.BoxGeometry(0.5, 0.62, 0.06), mat: mesaMat, pos: [0, 0.86, C.assentoZ - 0.27] },
    { geo: new THREE.CylinderGeometry(0.04, 0.05, 0.46, 6), mat: escuro, pos: [0, 0.25, C.assentoZ] },
    { geo: new THREE.BoxGeometry(0.04, 1.25, 2.3), mat: vidroV, pos: [-C.painelX, 0.72, 0.1] },                             // os painéis de vidro
    { geo: new THREE.BoxGeometry(0.04, 1.25, 2.3), mat: vidroV, pos: [C.painelX, 0.72, 0.1] },
    { geo: new THREE.BoxGeometry(0.07, 0.04, 2.3), mat: acesoV, pos: [-C.painelX, 1.36, 0.1] },
    { geo: new THREE.BoxGeometry(0.07, 0.04, 2.3), mat: acesoV, pos: [C.painelX, 1.36, 0.1] },
    { geo: new THREE.OctahedronGeometry(0.2, 0), mat: acesoV, pos: [0, 2.35, C.mesaZ] },                                     // o losango
  ];
  // (as do campus, viradas pra torre, e as LÁ EM CIMA: o deck do topo e o mirante — lib/cyber/temploCosmico `CABINES_TORRE`)
  const todas = [...ESTACOES_TI.map((e) => ({ x: e.x, z: e.z, y: y0, rot: Math.PI })), ...CABINES_TORRE];
  { const mC = new THREE.Matrix4(), mP = new THREE.Matrix4(), eixo = new THREE.Vector3(0, 1, 0);
    for (const p of pecas) {
      if (o.low && p.mat === vidroV) continue;
      const im = instanciar(p.geo, p.mat, todas.length);
      todas.forEach((e, i) => { mC.compose(v.set(e.x, e.y, e.z), q.setFromAxisAngle(eixo, e.rot), um); mP.compose(v.set(...p.pos), q.setFromAxisAngle(eixo, p.rotY ?? 0), um); im.setMatrixAt(i, mC.clone().multiply(mP)); });
      fechar(im); if (p.mat === escuro && p.pos[1] < 0.1) alvos.push(im);
    }
    if (!mats.includes(vidroV)) mats.push(vidroV);
  }
  // ── os DIFUSORES (um do lado de cada cabine): a haste, as bobinas e a ESFERA na ponta, que acende quando o raio chega ──
  const D = DIFUSOR_TI, difs = ESTACOES_TI.map((e) => difusorDe(e));
  const haste = instanciar(new THREE.CylinderGeometry(0.05, 0.09, D.alt, 6), escuro, N), baseD = instanciar(new THREE.CylinderGeometry(D.r, D.r + 0.1, 0.18, 12), escuro, N);
  const bobinas = instanciar(new THREE.TorusGeometry(0.2, 0.035, 5, 16), acesoV, N * 3);
  const esferaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), esferas = instanciar(new THREE.SphereGeometry(0.24, 14, 10), esferaMat, N);
  const corBase = new THREE.Color(0x6a0a16), corRaio = new THREE.Color(0xfff0f4), corT = new THREE.Color(), brilho = new Float32Array(N);
  difs.forEach((d, i) => {
    haste.setMatrixAt(i, m4.makeTranslation(d.x, y0 + D.alt / 2, d.z)); baseD.setMatrixAt(i, m4.makeTranslation(d.x, y0 + 0.09, d.z));
    for (let k = 0; k < 3; k++) { q.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); bobinas.setMatrixAt(i * 3 + k, m4.compose(v.set(d.x, y0 + D.alt - 0.75 + k * 0.22, d.z), q, um)); }
    esferas.setMatrixAt(i, m4.makeTranslation(d.x, y0 + D.alt, d.z)); esferas.setColorAt(i, corBase);
  });
  fechar(haste, baseD, bobinas, esferas); esferas.userData.semLote = true;
  // ── a TEMPESTADE (no lugar dos telões de código): a nuvem por cima das fileiras, escura, com os clarões dentro ──
  const zs = ESTACOES_TI.map((e) => e.z), zMax = Math.max(...zs) + 8, zMin = Math.min(...zs) - 8, yN = y0 + TEMPESTADE_TI.alt;
  const nuvemMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uFl: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; uniform vec3 uFl[4]; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + vec2(uT * 0.05, -uT * 0.03); a *= 0.5; } return s; }
      void main(){ float d = fbm(vP * 0.035), dens = smoothstep(0.32, 0.75, d);
        float fl = 0.0; for (int i = 0; i < 4; i++) fl += uFl[i].z * exp(-length(vP - uFl[i].xy) * 0.07);
        vec3 cor = mix(vec3(0.05, 0.01, 0.03), vec3(0.22, 0.03, 0.08), d) + vec3(1.0, 0.45, 0.55) * fl * (0.4 + dens);
        gl_FragColor = vec4(cor, dens * 0.92 + min(fl, 1.0) * 0.3); }` });
  mats.push(nuvemMat);
  // (o plano no layout; o shader usa o xz do MUNDO só pra textura — o clarão vem no mesmo referencial: guardamos o ponto do layout e convertemos)
  const nuvem = malha(new THREE.PlaneGeometry(CAMPUS.meia * 2 + 16, zMax - zMin, 1, 1), nuvemMat); nuvem.rotation.x = Math.PI / 2; nuvem.position.set(campus.a.x, yN, (zMax + zMin) / 2); nuvem.userData.semLote = true;
  const nuvem2 = malha(new THREE.PlaneGeometry(CAMPUS.meia * 2 + 6, zMax - zMin - 10, 1, 1), nuvemMat); nuvem2.rotation.x = Math.PI / 2; nuvem2.position.set(campus.a.x, yN + 3, (zMax + zMin) / 2); nuvem2.userData.semLote = true;
  // ── os RAIOS: um punhado de malhas reaproveitadas — o caminho quebrado da nuvem até a esfera de um difusor (o núcleo
  //    branco e o brilho vermelho, em cruz pra ser visto de todo lado), piscando por um instante ──
  const SEG = 14, POOL = o.low ? 3 : 6, raioNucleo = aditivo(0xfff0f4, 1), raioBrilho = aditivo(VERMELHO, 0.55);
  type Raio = { mesh: THREE.Mesh[]; pos: Float32Array[]; vida: number; i: number };
  const pool: Raio[] = [];
  for (let k = 0; k < POOL; k++) {
    const ms: THREE.Mesh[] = [], ps: Float32Array[] = [];
    for (const [mat, larg] of [[raioNucleo, 0.12], [raioBrilho, 0.7]] as const) for (let c = 0; c < 2; c++) {
      const pos = new Float32Array((SEG + 1) * 2 * 3), gq = new THREE.BufferGeometry(), idx: number[] = [];
      for (let s = 0; s < SEG; s++) { const b = s * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      gq.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); gq.setIndex(idx);
      const me = malha(gq, mat); me.visible = false; me.frustumCulled = false; me.userData.semLote = true; me.userData.larg = larg; me.userData.cruz = c; ms.push(me); ps.push(pos);
    }
    pool.push({ mesh: ms, pos: ps, vida: 0, i: -1 });
  }
  const pts = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  const disparar = (r: Raio, i: number) => {
    const d = difs[i]!, fim = new THREE.Vector3(d.x, y0 + D.alt + 0.2, d.z), ini = new THREE.Vector3(d.x + (Math.random() - 0.5) * 14, yN, d.z + (Math.random() - 0.5) * 14);
    for (let s = 0; s <= SEG; s++) { const t = s / SEG, j = s === 0 || s === SEG ? 0 : 1.6 * Math.sin(Math.PI * t); pts[s]!.lerpVectors(ini, fim, t).add(v.set((Math.random() - 0.5) * j, 0, (Math.random() - 0.5) * j)); }
    r.mesh.forEach((me, k) => {
      const larg = me.userData.larg as number, cruz = me.userData.cruz as number, p = r.pos[k]!;
      for (let s = 0; s <= SEG; s++) { const a = pts[s]!, w = larg * (1 - 0.5 * (s / SEG)), ox = cruz ? w : 0, oz = cruz ? 0 : w; p.set([a.x - ox, a.y, a.z - oz, a.x + ox, a.y, a.z + oz], s * 6); }
      (me.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; me.geometry.computeBoundingSphere(); me.visible = true;
    });
    r.vida = 0.24; r.i = i; brilho[i] = 1;
    // (a nuvem e o trovão, no MUNDO: o grupo vai dentro do lounge, girado e espelhado)
    const fl = nuvemMat.uniforms.uFl!.value as THREE.Vector3[], dw = group.localToWorld(new THREE.Vector3(ini.x, yN, ini.z));
    const k = fl.reduce((m, x, j) => (x.z < fl[m]!.z ? j : m), 0); fl[k]!.set(dw.x, dw.z, 1.4);
    if (raios.length < 8) { const fw = group.localToWorld(fim.clone()); raios.push({ x: fw.x, y: fw.y, z: fw.z }); }
  };
  const raios: { x: number; y: number; z: number }[] = [];
  let proximo = 0.5;
  anim.push((dt, t) => {
    telaMat.uniforms.uT!.value = t; nuvemMat.uniforms.uT!.value = t;
    proximo -= dt;
    if (proximo <= 0) { const r = pool.find((x) => x.vida <= 0); if (r) disparar(r, Math.floor(Math.random() * N)); proximo = TEMPESTADE_TI.cadaRaio * (0.3 + Math.random() * 1.4); }
    for (const r of pool) if (r.vida > 0) { r.vida -= dt; const vis = r.vida > 0, op = 0.45 + Math.random() * 0.55; r.mesh.forEach((me) => { me.visible = vis && op > 0.5; }); }
    raioBrilho.opacity = 0.4 + Math.random() * 0.3;
    for (const x of nuvemMat.uniforms.uFl!.value as THREE.Vector3[]) x.z = Math.max(0, x.z - dt * 3.5);
    let mudou = false;
    for (let i = 0; i < N; i++) if (brilho[i]! > 0) { brilho[i] = Math.max(0, brilho[i]! - dt * 1.3); esferas.setColorAt(i, corT.copy(corBase).lerp(corRaio, brilho[i]!)); mudou = true; }
    if (mudou && esferas.instanceColor) esferas.instanceColor.needsUpdate = true;
  });
  // ── os RACKS DE SERVIDOR nas laterais (as luzinhas piscando) ──
  { const zs = RACKS_TI.filter((r) => r.x < SALAO.x).map((r) => r.z);   // (os mesmos da colisão)
    const ledMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; varying float vI; void main(){ vUv = uv; vI = float(gl_InstanceID); gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying vec2 vUv; varying float vI; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
        void main(){ vec2 c = floor(vUv * vec2(6.0, 28.0)); float on = step(0.55, h(c + vI + floor(uT * (2.0 + h(c) * 6.0)))); vec3 cor = h(c + 3.0) < 0.7 ? vec3(0.3, 1.0, 0.5) : vec3(0.3, 0.7, 1.0);
          gl_FragColor = vec4(vec3(0.03, 0.04, 0.06) + cor * on * 0.9, 1.0); }` });
    const racks = instanciar(new THREE.BoxGeometry(1.6, 4.2, 1.1), negro, zs.length * 2), leds = instanciar(new THREE.PlaneGeometry(1.3, 3.8), ledMat, zs.length * 2);
    zs.forEach((z, i) => { for (const [k, s] of [[0, -1], [1, 1]] as const) {
      racks.setMatrixAt(i * 2 + k, m4.makeTranslation(campus.a.x + s * (CAMPUS.meia - 2.4), y0 + 2.1, z));
      q.setFromEuler(new THREE.Euler(0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0)); leds.setMatrixAt(i * 2 + k, m4.compose(v.set(campus.a.x + s * (CAMPUS.meia - 3.21), y0 + 2.1, z), q, um));
    } });
    fechar(racks, leds); alvos.push(racks);
    anim.push((_, t) => { ledMat.uniforms.uT!.value = t; });
  }

  // ── a TORRE TECNOLÓGICA: a coluna massiva (circuitos vermelhos, os anéis dos andares acesos) ──
  const circTorre = materialCircuito(fluxo); mats.push(circTorre);
  { const T = TORRE_TI, H = CYBER.h - y0;
    // (a coluna PARA dentro da laje do deck, sem tampa: a tampa dela no mesmo plano do piso do deck brigava com ele — o
    //  piso "piscando" que o dono via lá em cima)
    const Hc = H - 1.2, col = malha(new THREE.CylinderGeometry(T.colR - 0.5, T.colR + 1.5, Hc, o.low ? 24 : 48, 8, true), circTorre); col.position.set(T.x, y0 + Hc / 2, T.z); alvos.push(col); col.userData.semLote = true;
    // as VEIAS: faixas de luz descendo pela coluna, do deck até o pé (o fluxo que nasce lá em cima)
    const veia = materialVeia(fluxo); mats.push(veia);
    const NV = o.low ? 8 : 16, gV = new THREE.PlaneGeometry(0.9, Hc), veias = instanciar(gV, veia, NV), eixoY = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < NV; k++) { const a = (k / NV) * Math.PI * 2 + 0.11, r = T.colR + 1.7; veias.setMatrixAt(k, m4.compose(v.set(T.x + Math.cos(a) * r, y0 + Hc / 2, T.z + Math.sin(a) * r), q.setFromAxisAngle(eixoY, Math.PI / 2 - a), um)); }
    fechar(veias); veias.userData.semLote = true;
    const aneisT: THREE.Mesh[] = [];
    for (let k = 1; k < 12; k++) { const an = malha(new THREE.TorusGeometry(T.colR + 1.2, 0.35, 6, 96), aditivo(VERMELHO, 0.75)); an.rotation.x = Math.PI / 2; an.position.set(T.x, y0 + (k / 12) * H, T.z); an.userData.semLote = true; aneisT.push(an); }
    // o DECK do topo (a laje é a da rede — components/cyber/TemploCosmico): a borda de baixo acesa, que se vê do campus
    const beiral = malha(new THREE.TorusGeometry(CYBER.r + 0.6, 0.4, 6, 128), corSala(aditivo(VERMELHO, 0.85))); beiral.rotation.x = Math.PI / 2; beiral.position.set(CYBER.x, CYBER.h - 2.2, CYBER.z);
    // os ANÉIS dos andares: na cor da sala, e acendem quando a onda passa por eles (descendo)
    anim.push(() => { aneisT.forEach((an) => { const m = an.material as THREE.MeshBasicMaterial, w = ondaEm(fluxo, T.x, an.position.y, T.z + T.colR); m.color.copy(fluxo.uCor.value).lerp(fluxo.uFrente.value, w * 0.7); m.opacity = 0.25 + 0.75 * w; }); });
  }
  // ── o MIRANTE da pirâmide invertida: o anel lá no alto (a laje, o guarda-corpo de dentro e o de fora) e os pilares ──
  { const A = ALTO_TI, seg = o.low ? 64 : 128, vidroT = new THREE.MeshStandardMaterial({ color: 0xff8090, emissive: 0xff2a3a, emissiveIntensity: 0.08, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }); mats.push(vidroT);
    const piso = malha(new THREE.RingGeometry(A.rIn, A.rOut, seg), negro); piso.rotation.x = -Math.PI / 2; piso.position.set(A.x, A.h, A.z); alvos.push(piso);
    const baixo = malha(new THREE.RingGeometry(A.rIn, A.rOut, seg), negro); baixo.rotation.x = Math.PI / 2; baixo.position.set(A.x, A.h - 0.8, A.z);
    for (const r of [A.rIn, A.rOut]) {
      const borda = malha(new THREE.CylinderGeometry(r, r, 0.8, seg, 1, true), negro); borda.position.set(A.x, A.h - 0.4, A.z);
      const vid = malha(new THREE.CylinderGeometry(r, r, 1.15, seg, 1, true), vidroT); vid.position.set(A.x, A.h + 0.58, A.z);
      for (const y of [A.h + 1.16, A.h + 0.05]) { const f = malha(new THREE.TorusGeometry(r, 0.07, 4, seg), corSala(aditivo(VERMELHO, 0.85))); f.rotation.x = Math.PI / 2; f.position.set(A.x, y, A.z); }
    }
    // (a gravura um pouco ACIMA do piso — colada a 2 cm, de longe ela brigava com a laje e piscava)
    const gravura = malha(new THREE.RingGeometry(A.rIn + 2.2, A.rIn + 2.45, seg), corSala(aditivo(VERMELHO, 0.4))); gravura.rotation.x = -Math.PI / 2; gravura.position.set(A.x, A.h + 0.08, A.z); gravura.renderOrder = 2;
    for (const p of PILARES_ALTO) { const pl = malha(new THREE.CylinderGeometry(p.r, p.r * 1.3, A.h - CYBER.h, 10), circTorre); pl.position.set(p.x, CYBER.h + (A.h - CYBER.h) / 2, p.z); }
  }
  // ── as CÁPSULAS: o poço de vidro colado na torre (as guias acesas) e a cápsula subindo e descendo no relógio comum.
  //    Os VIDROS da porta (a metade virada pra fora da torre) abrem deslizando por trás da outra metade quando ela chega
  //    e fecham antes de sair; o anel fica BRANCO aberta e VERMELHO viajando. Quem está DENTRO vê por dentro: o teto e o
  //    vidro somem quase todo (a vista lá fora limpa) ──
  const capsDentro: { id: string | null } = { id: null };
  { const vidroP = new THREE.MeshStandardMaterial({ color: 0xffd0d6, emissive: 0xff2a3a, emissiveIntensity: 0.05, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }); mats.push(vidroP);
    const casco = new THREE.MeshStandardMaterial({ color: 0x14080c, emissive: 0x2a060c, emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.85 }); mats.push(casco);
    type Cap = { p: (typeof POCOS_TC)[number]; g: THREE.Group; porta: THREE.MeshBasicMaterial; bocas: THREE.MeshBasicMaterial[]; portas: [THREE.Object3D, THREE.Object3D]; vidros: THREE.MeshStandardMaterial; teto: THREE.Object3D };
    const caps: Cap[] = [], guiaMat = corSala(aditivo(VERMELHO, 0.7));
    for (const p of POCOS_TC) {
      // o POÇO: o tubo de vidro só ENTRE as bocas (nas bocas a cápsula fica livre pra abrir) e as guias de ponta a ponta
      const H = p.ate - p.de, tb = H - 3.8, tubo = malha(new THREE.CylinderGeometry(p.r + 0.35, p.r + 0.35, tb, 32, 1, true), vidroP); tubo.position.set(p.x, p.de + 3.6 + tb / 2, p.z);
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4, gd = malha(new THREE.BoxGeometry(0.14, H + 4, 0.14), guiaMat); gd.position.set(p.x + Math.cos(a) * (p.r + 0.4), p.de + (H + 4) / 2, p.z + Math.sin(a) * (p.r + 0.4)); }
      const bocas = [p.de, p.ate].map((y) => { const m = aditivo(0xffffff, 0.9), an = malha(new THREE.TorusGeometry(p.r, 0.09, 6, 48), m); an.rotation.x = Math.PI / 2; an.position.set(p.x, y + 0.05, p.z); an.userData.semLote = true; return m; });
      // a CÁPSULA: o piso, a metade de trás do vidro (fixa), as DUAS folhas da porta, o teto e os anéis
      const g = new THREE.Group(); g.position.set(p.x, p.de, p.z); g.userData.semLote = true; group.add(g);
      malha(new THREE.CylinderGeometry(p.r, p.r * 0.9, 0.3, 32), casco, g).position.y = -0.15;
      const vidros = vidroP.clone(); mats.push(vidros);
      const a = portaDoPoco(p), arco = (de: number, ate: number, r: number) => new THREE.CylinderGeometry(r, r, 3, 24, 1, true, Math.PI / 2 - ate, ate - de);
      malha(arco(a + Math.PI / 2, a + (3 * Math.PI) / 2, p.r), vidros, g).position.y = 1.5;   // (a metade de trás, virada pra torre)
      const folhas = [[a, a + Math.PI / 2], [a - Math.PI / 2, a]].map(([de, ate]) => { const f = new THREE.Group(); g.add(f); malha(arco(de!, ate!, p.r - 0.06), vidros, f).position.y = 1.5;
        const bat = malha(new THREE.BoxGeometry(0.05, 3, 0.05), aditivo(VERMELHO, 0.6), f); const ab = de === a ? de : ate!; bat.position.set(Math.cos(ab) * (p.r - 0.06), 1.5, Math.sin(ab) * (p.r - 0.06)); return f; });
      const teto = malha(new THREE.SphereGeometry(p.r, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), casco, g); teto.scale.y = 0.35; teto.position.y = 3;
      const porta = aditivo(0xffffff, 0.9); for (const y of [0.05, 3]) { const an = malha(new THREE.TorusGeometry(p.r + 0.02, 0.08, 6, 48), porta, g); an.rotation.x = Math.PI / 2; an.position.y = y; }
      caps.push({ p, g, porta, bocas, portas: [folhas[0]!, folhas[1]!], vidros, teto });
    }
    const branco = new THREE.Color(0xffffff), verm = new THREE.Color(VERMELHO);
    anim.push(() => {
      const agora = Date.now() / 1000;
      for (const c of caps) {
        const st = capsulaEm(c.p, agora); c.g.position.y = st.h;
        // as folhas giram em volta do eixo e escondem atrás da metade de trás (a da esquerda pra um lado, a outra pro outro)
        c.portas[0].rotation.y = -(Math.PI / 2) * st.abre; c.portas[1].rotation.y = (Math.PI / 2) * st.abre;
        c.porta.color.copy(st.aberta ? branco : verm);
        c.bocas[0]!.color.copy(st.aberta === "baixo" ? branco : verm); c.bocas[1]!.color.copy(st.aberta === "cima" ? branco : verm);
        const dentro = capsDentro.id === c.p.id; c.teto.visible = !dentro; c.vidros.opacity = dentro ? 0.03 : 0.1;
      }
    });
  }

  // ── o MONUMENTO DA CYBER ROOM ──
  const mg = new THREE.Group(); mg.position.set(CYBER.x, CYBER.h, CYBER.z); group.add(mg);
  const circ = materialCircuito(fluxo); mats.push(circ);
  const lado = NUCLEO_CYBER.r * Math.SQRT2 * 0.9, cubo = malha(new THREE.BoxGeometry(lado, lado * 1.5, lado), circ, mg);
  cubo.position.y = (lado * 1.5) / 2; alvos.push(cubo); cubo.userData.semLote = true;   // (de frente pro campus: o portal no meio da face)
  // o PORTAL selado (virado pra escada, o +z do monumento): a moldura vermelha e a estática escura no vão
  const portal = new THREE.Group(); portal.position.set(0, 0, lado / 2 + 0.06); mg.add(portal);
  const est = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, transparent: true, side: THREE.DoubleSide,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9, 78.2))) * 43758.5); }
      void main(){ float n = h(floor(vUv * vec2(60.0, 120.0)) + floor(uT * 14.0)); float scan = 0.5 + 0.5 * sin(vUv.y * 80.0 - uT * 6.0);
        gl_FragColor = vec4(vec3(0.6, 0.02, 0.05) * (0.25 + 0.5 * n * scan), 0.9); }` }); mats.push(est);
  malha(new THREE.PlaneGeometry(4.4, 8.4), est, portal).position.y = 4.4;
  for (const [w, h, x, y] of [[0.4, 9.2, -2.4, 4.6], [0.4, 9.2, 2.4, 4.6], [5.2, 0.4, 0, 9.2]] as const) { const b = malha(new THREE.BoxGeometry(w, h, 0.3), aditivo(VERMELHO, 0.95), portal); b.position.set(x, y, 0); }
  // a pirâmide INVERTIDA flutuando por cima, com o OLHO vermelho e o anel de varredura
  const PI_ = PIRAMIDE_INV, inv = new THREE.Group(); inv.position.y = PI_.y; mg.add(inv);
  const pin = malha(new THREE.ConeGeometry(PI_.r, PI_.alt, 4), negro, inv); pin.rotation.x = Math.PI; pin.rotation.y = Math.PI / 4;
  const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(pin.geometry), new THREE.LineBasicMaterial({ color: VERMELHO, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  arestas.rotation.copy(pin.rotation); arestas.scale.setScalar(1.012); inv.add(arestas);   // (um tiquinho por fora das faces: coladas, piscavam) geos.push(arestas.geometry); mats.push(arestas.material as THREE.Material);
  const olho = malha(new THREE.SphereGeometry(1.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xff1a2a }), inv); olho.position.y = -PI_.alt / 2 - 1.2;   // (o olho logo abaixo da ponta)
  const iris = malha(new THREE.RingGeometry(2.2, 2.6, 40), aditivo(VERMELHO, 0.8), inv); iris.position.y = -PI_.alt / 2 - 1.2; iris.rotation.x = Math.PI / 2;
  const varre = malha(new THREE.TorusGeometry(lado * 0.95, 0.12, 6, 64), corSala(aditivo(VERMELHO, 0.8)), mg); varre.rotation.x = Math.PI / 2;
  // os ESTILHAÇOS negros orbitando
  const NS = o.low ? 10 : 24, shard = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1, 0), negro, NS); geos.push(shard.geometry); shard.frustumCulled = false; mg.add(shard);
  // (em volta do cubo, ABAIXO do mirante: antes subiam até atravessar a laje dele)
  const orb = Array.from({ length: NS }, (_, i) => ({ r: lado * 0.85 + (i % 4) * 1.2, y: 4 + ((i * 37) % 22), v: 0.12 + (i % 4) * 0.05, f: i * 2.4, s: 0.6 + (i % 3) * 0.4 }));
  // o feixe vermelho subindo do olho pro céu
  const feixe = malha(new THREE.CylinderGeometry(0.5, 1.4, 200, 12, 1, true), corSala(aditivo(VERMELHO, 0.14)), mg); feixe.position.y = PI_.y + PI_.alt / 2 + 100;
  for (const x of [inv, varre, shard, feixe, olho, iris]) x.userData.semLote = true;

  const e = new THREE.Euler(), sc = new THREE.Vector3(), olhoMat = olho.material as THREE.MeshBasicMaterial, irisMat = iris.material as THREE.MeshBasicMaterial, arestaMat = arestas.material as THREE.LineBasicMaterial;
  // o FLUXO: a cor da sala andando pela paleta, o referencial (o grupo vai girado/espelhado dentro do lounge) e o OLHO
  // que acende quando sai uma onda (o fluxo nasce nele)
  const cA = new THREE.Color();
  anim.push((_, t) => {
    fluxo.uT.value = t;
    group.updateWorldMatrix(true, false); fluxo.uDoMundo.value.copy(group.matrixWorld).invert();
    const k = ((t / FLUXO_CYBER.ciclo) % 1) * (PALETA_CYBER.length - 1), i = Math.floor(k), f = k - i;
    fluxo.uCor.value.copy(PALETA_CYBER[i]!).lerp(PALETA_CYBER[i + 1]!, f * f * (3 - 2 * f));
    fluxo.uFrente.value.copy(fluxo.uCor.value).lerp(cA.set(0xffffff), 0.55);
    for (const m of naCor) m.color.copy(fluxo.uCor.value);
    const nasce = ondaEm(fluxo, fluxo.uFonte.value.x, fluxo.uFonte.value.y, fluxo.uFonte.value.z);   // (a onda saindo do olho)
    olhoMat.color.copy(fluxo.uCor.value).lerp(cA.set(0xffffff), 0.5 * nasce); olho.scale.setScalar(1 + 0.35 * nasce);
    irisMat.color.copy(fluxo.uCor.value); arestaMat.color.copy(fluxo.uCor.value).lerp(cA.set(0xffffff), 0.4 * nasce);
  });
  anim.push((_, t) => { (est.uniforms.uT!.value as number) = t;
    inv.rotation.y = t * 0.15; inv.position.y = PI_.y + Math.sin(t * 0.6) * 1.2;
    iris.scale.setScalar(1 + 0.15 * Math.sin(t * 2.3)); (iris.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.sin(t * 2.3);
    varre.position.y = ((t * 4) % (lado * 1.5 + 4)); (varre.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.sin(Math.PI * (varre.position.y / (lado * 1.5 + 4)));
    orb.forEach((s, i) => { const a = s.f + t * s.v; q.setFromEuler(e.set(t * 0.7 + i, t * 0.5, i)); shard.setMatrixAt(i, m4.compose(v.set(Math.cos(a) * s.r, s.y + Math.sin(t * 0.8 + i) * 1.2, Math.sin(a) * s.r), q, sc.setScalar(s.s))); });
    shard.instanceMatrix.needsUpdate = true;
  });

  return {
    group, alvos,
    raios() { return raios.splice(0); },
    capsulaDentro(id) { capsDentro.id = id; },
    estilhacos() {
      const out: { x: number; y: number; z: number; r: number }[] = [], w = new THREE.Vector3();
      if (!shard.visible || !group.parent) return out;
      shard.updateWorldMatrix(true, false);
      for (let i = 0; i < NS; i++) { shard.getMatrixAt(i, m4); w.setFromMatrixPosition(m4).applyMatrix4(shard.matrixWorld); out.push({ x: w.x, y: w.y, z: w.z, r: orb[i]!.s * 1.15 }); }
      return out;
    },
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { teloes.dispose(); group.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
