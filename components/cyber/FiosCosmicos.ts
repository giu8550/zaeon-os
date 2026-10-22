/**
 * FiosCosmicos — as PISTAS CÓSMICAS da Zaeon (lib/cyber/fiosCosmicos): LEVES — cada pista é um FLUXO de luz (uma
 * linha tênue na cor da sala + as partículas correndo por ela até o buraco negro) e, no canto do
 * mapa, o BURACO NEGRO MASSIVO (o horizonte, o anel de fótons, o disco de acreção girando, a aura) envolto numa
 * TEMPESTADE (as nuvens e os raios de components/cyber/Tempestade) que cresce quanto mais perto se chega.
 * Referencial: o LOCAL da ilha (o grupo vai dentro do hub).
 */
import * as THREE from "three";
import { FIO, fiosCosmicos, pertoDoBuraco, pontoDoFio, type FioCosmico, type V3 } from "@/lib/cyber/fiosCosmicos";
import type { NomeSala } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { criarTempestade } from "./Tempestade";

export type FiosCosmicosHandle = {
  group: THREE.Group; alvos: THREE.Object3D[];
  /** onde a pessoa está (LOCAL da ilha): a tempestade e o brilho do buraco negro crescem quando ela chega perto */
  atualizar(dt: number, t: number, eu?: V3): void;
  /** até onde (m) a câmera desenha AGORA (a qualidade adaptativa encurta): o buraco negro fica sempre aquém disso */
  vista(m: number): void;
  dispose(): void;
};

const RUIDO = `float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  vec3 paleta(float x){ return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + x)); }`;
/** o DISCO DE ACREÇÃO (out/2026, o dono: "mais fluidez, cosmicalidade e psicodelia"): o redemoinho de plasma girando em
 *  rotação DIFERENCIAL (o de dentro mais rápido), em fios de ruído, mais brilhante de um lado (o doppler), com as cores
 *  GIRANDO na paleta cósmica e o branco quente na borda de dentro. Polar a partir da posição (o anel no plano xy) */
function materialDisco(R: number, r0: number, r1: number, intensidade: number, leve = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    // (LEVE: o ruído com 2 oitavas e sem os fios finos — o disco é grande na tela e o fbm de 4 oitavas, 2× por pixel, pesava)
    defines: leve ? { LEVE: "" } : {},
    uniforms: { uT: { value: 0 }, uR0: { value: R * r0 }, uR1: { value: R * r1 }, uI: { value: intensidade }, uMatiz: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: "varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform float uT, uR0, uR1, uI, uMatiz; varying vec2 vP; ${RUIDO}
      void main(){
        float r = length(vP), a = atan(vP.y, vP.x), rn = clamp((r - uR0) / (uR1 - uR0), 0.0, 1.0);
        float giro = uT * (0.9 / (0.18 + rn));
        #ifdef LEVE
        float n = n2(vec2(a * 3.0 + giro, rn * 7.0 - uT * 0.25)) * 0.65 + n2(vec2(a * 6.0 + giro, rn * 14.0)) * 0.35, fio = 0.0;
        #else
        float n = fbm(vec2(a * 3.0 + giro, rn * 7.0 - uT * 0.25)), fio = fbm(vec2(a * 9.0 + giro * 1.7, rn * 22.0));
        #endif
        float brilho = pow(1.0 - rn, 1.5) * (0.35 + 0.9 * n + 0.5 * smoothstep(0.55, 0.9, fio)) * (0.55 + 0.6 * (0.5 + 0.5 * sin(a + 0.7)));
        vec3 cor = mix(paleta(rn * 0.7 + n * 0.5 + uT * 0.04 + uMatiz), vec3(1.0, 0.92, 0.78), smoothstep(0.25, 0.0, rn) * 0.8);
        float borda = smoothstep(0.0, 0.04, rn) * smoothstep(1.0, 0.75, rn);
        gl_FragColor = vec4(cor * brilho * borda * uI, 1.0);
      }`,
  });
}
/** a que distância (m, do horizonte) o buraco negro carrega o resto (a tempestade, a poeira, a lente) */
const LOD_PERTO = 4000;
const aditivo = (cor: THREE.ColorRepresentation, op: number) => new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

export function criarFiosCosmicos(o: { /** as pistas a desenhar (padrão: as do hub) */ pistas?: readonly FioCosmico[]; low: boolean; cores: Record<NomeSala, number>; starTex: THREE.Texture; /** até onde (m) a câmera enxerga: mais longe que isso, o buraco negro é trazido pra perto,
   *  ENCOLHIDO na mesma proporção (do ponto de vista de quem olha, idêntico) — os buracos ficam a ~8 km */ alcanceVista?: number; /** um raio da tempestade de um buraco negro caiu (LOCAL da ilha): o trovão */ aoTrovao?: (p: THREE.Vector3) => void }): FiosCosmicosHandle {
  const group = new THREE.Group(); group.name = "pistas-cosmicas";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [], alvos: THREE.Object3D[] = [];
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D) => { geos.push(g); mats.push(m); const x = new THREE.Mesh(g, m); x.frustumCulled = false; pai.add(x); return x; };
  const halo = glowTex("rgba(255,255,255,0.9)", "rgba(150,120,255,0.18)"); texs.push(halo);
  const sprite = (cor: THREE.ColorRepresentation, op: number, escala: number, pai: THREE.Object3D) => { const m = new THREE.SpriteMaterial({ map: halo, color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }); mats.push(m); const s = new THREE.Sprite(m); s.scale.setScalar(escala); pai.add(s); return s; };
  type Vivo = { f: FioCosmico; disco: THREE.Group; aura: THREE.Sprite; tempestade: ReturnType<typeof criarTempestade> | null; fazerTempestade: () => ReturnType<typeof criarTempestade>; pts: THREE.Points; tg: THREE.Group; bn: THREE.Group; lente: THREE.Object3D; shaders: THREE.ShaderMaterial[]; anel: THREE.MeshBasicMaterial; poeira: THREE.ShaderMaterial; matiz: number };
  const vivos: Vivo[] = [];

  for (const f of o.pistas ?? fiosCosmicos()) {
    const cor = new THREE.Color(o.cores[f.sala]), clara = cor.clone().lerp(new THREE.Color(0xffffff), 0.5);
    const g = new THREE.Group(); g.name = `pista-${f.sala}`; group.add(g);
    // (sem a linha nem as partículas da pista — out/2026, o dono: entre a plataforma e o buraco negro, só o FLUXO DE
    //  VEÍCULOS — components/cyber/TrafegoCeu; quem é levado continua indo pela mesma pista)
    // (sem boca nem coluna de luz: o fluxo É o caminho — quem chega perto dele é levado)
    // ── o BURACO NEGRO MASSIVO do canto ──
    const bn = new THREE.Group(); bn.position.set(f.bn.x, f.bn.y, f.bn.z); g.add(bn);
    const R = f.bn.r, shaders: THREE.ShaderMaterial[] = [];
    // o HORIZONTE (negro) e a borda dele acesa (o fresnel: o anel de luz contornando a silhueta, mudando de cor)
    malha(new THREE.SphereGeometry(R, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }), bn);
    const borda = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uMatiz: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
      fragmentShader: `uniform float uT, uMatiz; varying vec3 vN; varying vec3 vV; ${RUIDO}
        void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 4.0); gl_FragColor = vec4(mix(vec3(1.0, 0.9, 0.75), paleta(uT * 0.06 + uMatiz), 0.55) * f * 1.6, 1.0); }` });
    shaders.push(borda); malha(new THREE.SphereGeometry(R * 1.06, 48, 32), borda, bn);
    sprite(0xffe9c8, 0.75, R * 2.4, bn);
    // (o halo na cor da sala — a cor que se vê de longe; do tamanho do disco, pra um não encostar no outro no céu)
    const aura = sprite(cor, 0.5, o.low ? R * 4 : R * 6.5, bn);   // (no leve, menor: uma aura do tamanho da tela inteira somando luz pesava)
    // o DISCO DE ACREÇÃO (inclinado) e o anel de FÓTONS colado no horizonte
    const disco = new THREE.Group(); disco.rotation.set(-Math.PI / 2 + 0.3, 0, 0.2); bn.add(disco);
    const mDisco = materialDisco(R, 1.12, 4.4, 1.25, o.low); shaders.push(mDisco); malha(new THREE.RingGeometry(R * 1.12, R * 4.4, o.low ? 64 : 192, o.low ? 3 : 6), mDisco, disco);
    const anel = aditivo(0xfff1d6, 0.95); malha(new THREE.TorusGeometry(R * 1.1, R * 0.025, 6, 128), anel, disco);
    // a LENTE: a luz do disco de TRÁS dobrada pela gravidade — o arco por cima e por baixo do horizonte (Interstellar),
    // sempre de frente pra quem olha
    const lente = new THREE.Group(); bn.add(lente);
    if (!o.low) { const mLente = materialDisco(R, 1.04, 1.9, 0.8); shaders.push(mLente); malha(new THREE.RingGeometry(R * 1.04, R * 1.9, 160, 3), mLente, lente); }   // (no leve, sem a lente)
    // (os JATOS nos polos saíram — out/2026, o dono)
    // a POEIRA caindo em ESPIRAL (no shader: cada grão gira cada vez mais rápido até sumir no horizonte)
    const N = o.low ? 140 : 1600, sem = new Float32Array(N * 3); for (let i = 0; i < N; i++) sem.set([Math.random() * 6.283, Math.random(), 0.04 + Math.random() * 0.08], i * 3);
    const gp = new THREE.BufferGeometry(); gp.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3)); gp.setAttribute("aSem", new THREE.BufferAttribute(sem, 3)); geos.push(gp);
    const poeira = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uR: { value: R }, uMapa: { value: o.starTex }, uMatiz: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aSem; uniform float uT, uR; varying float vK;
        void main(){ float k = fract(uT * aSem.z + aSem.y); float r = uR * mix(5.5, 1.05, k * k); float a = aSem.x + k * k * 9.0 + uT * 0.2;
          vec3 p = vec3(cos(a) * r, sin(a) * r, (aSem.y - 0.5) * uR * 0.5 * (1.0 - k)); vK = k;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = clamp(2600.0 / -mv.z, 1.0, 9.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMapa; uniform float uT, uMatiz; varying float vK; ${RUIDO}
        void main(){ vec4 tx = texture2D(uMapa, gl_PointCoord); gl_FragColor = vec4(mix(paleta(vK * 0.6 + uT * 0.05 + uMatiz), vec3(1.0), vK * vK) * tx.a * (0.3 + 0.9 * vK), 1.0); }` });
    shaders.push(poeira); mats.push(poeira); const pts = new THREE.Points(gp, poeira); pts.frustumCulled = false; disco.add(pts);
    for (const m of shaders) if (!mats.includes(m)) mats.push(m);
    // ── a TEMPESTADE em volta: nuvens escuras girando e raios — fraca de longe, forte chegando ──
    const tg = new THREE.Group(); tg.position.set(f.bn.x, 0, f.bn.z); g.add(tg);
    // (LOD — out/2026, o dono: "de longe, não deixe-os carregados completamente": a tempestade só NASCE quando se chega
    //  perto e é LIBERADA ao se afastar; de longe ficam a silhueta, o disco colorido e o halo)
    const fazerTempestade = () => { const h = criarTempestade({ low: o.low, yBase: f.bn.y - 70, yTopo: f.bn.y + 90, raioMax: R * 4.7, alvoPonta: new THREE.Vector3(0, f.bn.y, 0), cor: cor.clone().multiplyScalar(0.35), semAbismo: true, densidade: o.low ? 0.45 : 0.7, nuvens: o.low ? 14 : 90 }); tg.add(h.group); h.definir(0.25, false); return h; };
    vivos.push({ f, disco, aura, tempestade: null, fazerTempestade, tg, bn, lente, shaders, anel, poeira, pts, matiz: vivos.length * 0.25 });
  }

  const raio = new THREE.Vector3(), lenteAlvo = new THREE.Vector3(); let vista = (o.alcanceVista ?? 2600) * 0.72;
  /** põe `obj` (de posição real `x,y,z`) a no máximo `vista` m de quem olha, encolhido na mesma proporção — e, longe,
   *  um pouco MAIOR que o real (até `realce`×: o farol no horizonte que chama pra ir até lá) */
  const aproximar = (obj: THREE.Object3D, x: number, y: number, z: number, eu: V3 | undefined, realce = 1) => {
    const d = eu ? Math.hypot(x - eu.x, y - eu.y, z - eu.z) : 0, k = eu && d > vista ? vista / d : 1;
    const longe = eu ? Math.max(0, Math.min(1, (d - 1500) / 4000)) : 0, r = 1 + (realce - 1) * longe;
    obj.position.set(eu ? eu.x + (x - eu.x) * k : x, eu ? eu.y + (y - eu.y) * k : y, eu ? eu.z + (z - eu.z) * k : z); obj.scale.setScalar(k * r);
  };
  return {
    group, alvos,
    atualizar(dt, t, eu) {
      for (const v of vivos) {
        v.disco.rotation.z += dt * 0.05;
        // (sem o exagero de longe — o realce 2,6× fazia o buraco negro encher o céu do hub; agora, o tamanho de verdade)
        aproximar(v.bn, v.f.bn.x, v.f.bn.y, v.f.bn.z, eu, 1); aproximar(v.tg, v.f.bn.x, 0, v.f.bn.z, eu, 1);
        // o LOD: perto (< 4 km do horizonte), a tempestade, a poeira e a lente; longe, só o essencial (e a memória livre)
        const dist = eu ? Math.hypot(eu.x - v.f.bn.x, eu.y - v.f.bn.y, eu.z - v.f.bn.z) - v.f.bn.r : 0, perto = dist < LOD_PERTO;
        if (perto && !v.tempestade) v.tempestade = v.fazerTempestade();
        else if (!perto && v.tempestade && dist > LOD_PERTO * 1.4) { v.tempestade.dispose(); v.tempestade = null; }
        v.pts.visible = perto; v.lente.visible = perto;
        for (const m of v.shaders) { m.uniforms.uT!.value = t; m.uniforms.uMatiz!.value = v.matiz; }
        v.anel.color.setHSL((t * 0.03 + v.matiz) % 1, 0.6, 0.85);
        if (eu) { v.bn.updateMatrixWorld(); lenteAlvo.set(eu.x, eu.y, eu.z); v.bn.parent?.localToWorld(lenteAlvo); v.lente.lookAt(lenteAlvo); }   // (a lente sempre de frente pra quem olha)
        // o quanto a pessoa está perto do buraco negro: a tempestade (e os raios) e a aura crescem
        const k = eu ? pertoDoBuraco(v.f, eu) : 0;
        v.tempestade?.definir(0.25 + 0.75 * k, !o.low && k > 0.15);   // (no leve, sem os raios)
        (v.aura.material as THREE.SpriteMaterial).opacity = 0.45 + 0.4 * k;
        const caiu = v.tempestade?.atualizar(t);
        if (caiu && o.aoTrovao) o.aoTrovao(raio.copy(caiu).multiplyScalar(v.tg.scale.x).add(v.tg.position));
      }
    },
    vista(m) { vista = Math.max(600, m * 0.72); },
    dispose() { group.removeFromParent(); for (const v of vivos) v.tempestade?.dispose(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose(); },
  };
}
