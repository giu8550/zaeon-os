/**
 * Nave — o veículo do dono (fica no hangar da Zaeon): um DISCO VOADOR alienígena grande e imponente. Casco escuro
 * metálico com veios de luz e uma crista, espinhos de cristal em volta da aba, CÚPULA de vidro alta onde se vê o
 * PILOTO (o avatar real de quem pilota — o engine o põe no `assento`), o anel de luzes da borda girando (o "eixo
 * giratório") e um halo externo tracejado girando ao contrário, três orbes luminosos na barriga, pernas de pouso que
 * recolhem em voo. Voando: núcleo e veios acendem, rastro de plasma atrás (cresce com a velocidade) e, pairando,
 * feixe + pulsos de energia descendo. Tudo em ondas LENTAS, sem estrobo; `prefers-reduced-motion` aquieta.
 * A origem do group é o ponto de apoio no chão; física do voo em lib/cyber/voo.ts.
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";

export type NaveHandle = {
  group: THREE.Group;
  /** malhas pro clique (embarcar) */
  alvos: THREE.Object3D[];
  /** onde o piloto fica (dentro da cúpula) — o engine posiciona o avatar aqui enquanto pilota */
  assento: THREE.Object3D;
  /** `voando`: recolhe as pernas e acende tudo; `vel` (0..1) = rastro e giro; `curva` inclina */
  atualizar(o: { dt: number; t: number; voando: boolean; vel: number; curva: number }): void;
  dispose(): void;
};

/** escala do disco (o modelo é ~7,5 m de diâmetro em 1×) */
export const ESCALA_NAVE = 2.1;
const ALIEN = new THREE.Color(0x8bffcf);   // verde-ciano "alienígena" das luzes
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function criarNave(opts: { cor?: string; low: boolean }): NaveHandle {
  const cor = new THREE.Color(opts.cor ?? "#2f7bff");
  const raiz = new THREE.Group();
  const corpo = new THREE.Group(); raiz.add(corpo);   // inclinação/flutuação aqui; posição/yaw na raiz
  const alvos: THREE.Object3D[] = [];
  const seg = opts.low ? 32 : 64, parado = reducedMotion();
  const aditivo = (c: THREE.ColorRepresentation, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });

  // casco: disco com barriga funda, aba fina e uma CRISTA no dorso
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a98a8, roughness: 0.3, metalness: 0.45, emissive: 0x10302c, emissiveIntensity: 0.5 });
  const perfil = [[0, -0.62], [1.1, -0.66], [2.4, -0.46], [3.5, -0.12], [3.78, 0.0], [3.6, 0.16], [2.9, 0.34], [2.55, 0.5], [2.3, 0.46], [1.75, 0.62], [0, 0.68]].map(([r, y]) => new THREE.Vector2(r!, y!));
  const casco = new THREE.Mesh(new THREE.LatheGeometry(perfil, seg), metal); corpo.add(casco); alvos.push(casco);
  // veios de luz no dorso (anéis finos) + friso na aba
  const veioMat = aditivo(ALIEN, 0.5);
  for (const [r, y] of [[3.05, 0.3], [2.5, 0.53], [1.95, 0.6]] as const) { const v = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 4, seg), veioMat); v.rotation.x = Math.PI / 2; v.position.y = y; corpo.add(v); }
  const friso = new THREE.Mesh(new THREE.TorusGeometry(3.68, 0.05, 6, seg), aditivo(ALIEN, 0.75)); friso.rotation.x = Math.PI / 2; friso.position.y = 0.05; corpo.add(friso);

  // espinhos de cristal em volta da aba (apontando pra fora e um pouco pra baixo)
  const cristal = new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: ALIEN, emissiveIntensity: 0.9, roughness: 0.2, flatShading: true });
  const NE = opts.low ? 6 : 8;
  for (let i = 0; i < NE; i++) {
    const a = (i / NE) * Math.PI * 2 + Math.PI / NE, e = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 5), cristal);
    e.position.set(Math.cos(a) * 3.9, -0.08, Math.sin(a) * 3.9); e.rotation.set(0, 0, 0);
    e.lookAt(Math.cos(a) * 9, -1.6, Math.sin(a) * 9); e.rotateX(Math.PI / 2); corpo.add(e);
  }

  // CÚPULA alta de vidro com o piloto dentro (o avatar real vai no `assento`)
  const cupula = new THREE.Mesh(new THREE.SphereGeometry(1.55, seg, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbff4ff, emissive: 0x1d5f6a, emissiveIntensity: 0.35, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  cupula.scale.y = 1.05; cupula.position.y = 0.62; corpo.add(cupula); alvos.push(cupula);
  const aroCupula = new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.05, 6, seg), aditivo(cor.clone().lerp(ALIEN, 0.5), 0.8)); aroCupula.rotation.x = Math.PI / 2; aroCupula.position.y = 0.64; corpo.add(aroCupula);
  const assento = new THREE.Object3D(); assento.position.set(0, 0.66, 0); corpo.add(assento);
  const luzInterna = new THREE.PointLight(ALIEN.getHex(), 0.8, 6); luzInterna.position.set(0, 1.6, 0); corpo.add(luzInterna);

  // o "EIXO GIRATÓRIO": anel de luzes da borda (gira) + halo externo tracejado (gira ao contrário)
  const NL = opts.low ? 14 : 22, aro = new THREE.Group(); corpo.add(aro);
  const luzes: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < NL; i++) {
    const a = (i / NL) * Math.PI * 2, mat = new THREE.MeshBasicMaterial({ color: ALIEN.clone().lerp(new THREE.Color(0xffffff), 0.2), transparent: true, opacity: 0.8 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), mat); l.position.set(Math.cos(a) * 3.55, -0.04, Math.sin(a) * 3.55); aro.add(l); luzes.push(mat);
  }
  const halo = new THREE.Group(); halo.position.y = -0.1; halo.rotation.x = 0.06; corpo.add(halo);
  const haloMat = aditivo(ALIEN, 0.35), NH = opts.low ? 12 : 18;
  for (let i = 0; i < NH; i++) { const arco = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.04, 4, 8, (Math.PI * 2) / NH * 0.6), haloMat); arco.rotation.set(Math.PI / 2, 0, (i / NH) * Math.PI * 2); halo.add(arco); }

  // barriga: núcleo + três ORBES luminosos girando + anel
  const tex = glowTex("rgba(200,255,230,1)", "rgba(90,255,190,.3)");
  const nucleo = new THREE.Mesh(new THREE.CircleGeometry(1.0, seg), aditivo(ALIEN, 0.6)); nucleo.material.side = THREE.DoubleSide;
  nucleo.rotation.x = Math.PI / 2; nucleo.position.y = -0.67; corpo.add(nucleo);
  const anelBaixo = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.07, 6, seg), aditivo(ALIEN, 0.55)); anelBaixo.rotation.x = Math.PI / 2; anelBaixo.position.y = -0.55; corpo.add(anelBaixo);
  const orbes = new THREE.Group(); orbes.position.y = -0.6; corpo.add(orbes);
  const orbeMat = new THREE.MeshBasicMaterial({ color: 0xd8fff0 });
  const brilhosOrbe: THREE.SpriteMaterial[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, o = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), orbeMat); o.position.set(Math.cos(a) * 2.2, -0.1, Math.sin(a) * 2.2); orbes.add(o);
    const g = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }); const sp = new THREE.Sprite(g); sp.scale.set(1.8, 1.8, 1); sp.position.copy(o.position); orbes.add(sp); brilhosOrbe.push(g);
  }
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilho.scale.set(8, 8, 1); brilho.position.y = -1.0; corpo.add(brilho);

  // pairando: feixe suave + pulsos de energia descendo (anéis que crescem e somem)
  const feixeMat = aditivo(ALIEN, 0); feixeMat.side = THREE.DoubleSide;
  const feixe = new THREE.Mesh(new THREE.ConeGeometry(2.0, 5, seg, 1, true), feixeMat); feixe.position.y = -3.1; feixe.visible = false; corpo.add(feixe);
  const pulsos = [0, 0.5].map((fase) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, seg), aditivo(ALIEN, 0)); m.rotation.x = Math.PI / 2; corpo.add(m); return { m, fase }; });

  // rastro de plasma atrás (−z local; a frente é +z), cresce com a velocidade
  const RN = opts.low ? 40 : 90, rPos = new Float32Array(RN * 3), rDados = Array.from({ length: RN }, () => ({ u: Math.random(), a: Math.random() * 6.283, r: Math.random() }));
  const rGeo = new THREE.BufferGeometry(); rGeo.setAttribute("position", new THREE.BufferAttribute(rPos, 3));
  const rMat = new THREE.PointsMaterial({ size: 0.6, map: tex, color: ALIEN.clone().lerp(new THREE.Color(0xffffff), 0.35), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const rastro = new THREE.Points(rGeo, rMat); rastro.frustumCulled = false; corpo.add(rastro);

  // pernas de pouso (recolhem em voo)
  const trem = new THREE.Group(); corpo.add(trem);
  const escuro = new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2, x = Math.cos(a) * 1.9, z = Math.sin(a) * 1.9;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.75, 8), escuro); p.position.set(x, -0.62, z); p.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); trem.add(p);
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 12), escuro); pe.position.set(x * 1.08, -0.98, z * 1.08); trem.add(pe);
  }

  raiz.scale.setScalar(ESCALA_NAVE);
  let inclina = 0, voo = 0, giro = 0;
  return {
    group: raiz, alvos, assento,
    atualizar({ dt, t, voando, vel, curva }) {
      voo += ((voando ? 1 : 0) - voo) * Math.min(1, dt * 3);
      trem.scale.y = Math.max(0.01, 1 - voo); trem.visible = voo < 0.95;
      corpo.position.y = 1.0 + voo * (parado ? 0 : Math.sin(t * 1.1) * 0.12);   // em solo apoia nas pernas; em voo, flutua
      inclina += (Math.max(-0.3, Math.min(0.3, -curva * 0.45)) * voo - inclina) * Math.min(1, dt * 4);
      corpo.rotation.z = inclina;
      // eixo giratório: luzes da borda giram (mais rápido com velocidade) com onda de brilho LENTA; o halo gira ao contrário
      giro += dt * (parado ? 0.05 : 0.3 + 0.9 * Math.min(1, vel)) * (0.4 + 0.6 * voo);
      aro.rotation.y = giro; halo.rotation.y = -giro * 0.6; orbes.rotation.y = -giro * 0.8;
      luzes.forEach((m, i) => { m.opacity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.5 - (i / luzes.length) * Math.PI * 2)) * (0.5 + 0.5 * voo); });
      haloMat.opacity = 0.12 + 0.35 * voo;
      veioMat.opacity = 0.35 + 0.4 * voo * (0.75 + 0.25 * Math.sin(t * 1.3));
      (nucleo.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.55 * voo;
      (brilho.material as THREE.SpriteMaterial).opacity = 0.12 + 0.35 * voo;
      brilhosOrbe.forEach((g, i) => { g.opacity = 0.3 + 0.4 * voo * (0.7 + 0.3 * Math.sin(t * 1.4 + i * 2)); });
      luzInterna.intensity = 0.6 + 0.8 * voo;
      // pairando devagar: feixe + pulsos descendo
      const paira = voando && vel < 0.15 ? 1 : 0;
      feixeMat.opacity += (paira * 0.1 - feixeMat.opacity) * Math.min(1, dt * 2); feixe.visible = feixeMat.opacity > 0.005;
      for (const p of pulsos) {
        const u = parado ? 0.5 : (t * 0.45 + p.fase) % 1, mat = p.m.material as THREE.MeshBasicMaterial;
        p.m.scale.setScalar(1 + u * 2.4); p.m.position.y = -0.8 - u * 3.5; mat.opacity = paira * voo * 0.5 * (1 - u); p.m.visible = mat.opacity > 0.005;
      }
      // rastro de plasma: partículas escorrendo pra trás, comprimento ∝ velocidade
      const L = 2 + 6 * Math.min(1, vel);
      rMat.opacity = 0.95 * voo * Math.min(1, vel * 2.5); rastro.visible = rMat.opacity > 0.01;
      if (rastro.visible) {
        for (let i = 0; i < RN; i++) {
          const d = rDados[i]!; if (!parado) d.u = (d.u + dt * (0.6 + vel)) % 1;
          const rr = (0.25 + d.r * 0.9) * (1 - d.u * 0.7), a = d.a + t * 2;
          rPos[i * 3] = Math.cos(a) * rr; rPos[i * 3 + 1] = -0.2 + Math.sin(a) * rr * 0.35; rPos[i * 3 + 2] = -3.4 - d.u * L;
        }
        rGeo.attributes.position!.needsUpdate = true;
      }
    },
    dispose() { liberar(raiz, [tex]); },
  };
}
