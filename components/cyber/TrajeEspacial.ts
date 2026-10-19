/**
 * O TRAJE ESPACIAL de combate (as armas de fogo): placas montadas DIRETO nos ossos do esqueleto mixamo do AvatarLuz —
 * o mesmo que toca as animações do rifle (public/anim/rifle). Assim as poses de mira/andar/virar/morrer ficam como
 * foram gravadas e as mãos fecham na arma sem a correção do corpo VRM (que tem braços de outro comprimento).
 *
 * Cada peça é uma casca (torneada, de seção oval) entre um osso e o filho, presa ao osso (`attach`): segue a
 * animação sem deformar malha nenhuma. O capacete é FECHADO com uma VISEIRA de vidro na frente — o rosto de anime
 * do VRM fica lá dentro (AvatarVrm `rosto`: só o rosto à mostra, os olhos presos na `ancoraRosto`).
 * O traço é de DESENHO, como o resto do avatar anime (components/cyber/AvatarAnime): cel shading em faixas chapadas, o
 * brilho de borda na cor do jogador e o CONTORNO DE TINTA em cada peça; o vidro é chapado, com os reflexos em faixa.
 */
import * as THREE from "three";
import { mostrarCaminho } from "./matrizes";
import { tintaFixa, toon } from "./AvatarAnime";

export type TrajeHandle = {
  /** o ponto (filho da cabeça mixamo) onde ficam os OLHOS do rosto VRM, dentro do capacete */
  ancoraRosto: THREE.Object3D;
  /** o capacete no tamanho do ROSTO que vai dentro: pela distância entre os olhos (m) — o rosto de anime é maior que a
   *  cabeça do soldado; nunca menor que o padrão */
  ajustarCapacete(distOlhos: number): void;
  visivel(on: boolean): void;
  recolorir(hex: string): void;
  dispose(): void;
};

const OSSO = (m: THREE.Object3D, n: string) => m.getObjectByName(`mixamorig${n}`) ?? null;

/** o perfil de uma casca torneada ao longo de y (0..len), raio r1 → r2, com as pontas arredondadas */
function perfil(len: number, r1: number, r2: number, extA: number, extB: number, n = 12): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], tot = len + extA + extB, e = 0.22;
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = -extA + u * tot, k = Math.min(1, u / e, (1 - u) / e);
    const r = (r1 + (r2 - r1) * u) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
    pts.push(new THREE.Vector2(Math.max(r, i === 0 || i === n ? 0 : 0.002), y));
  }
  return pts;
}

export function vestirTraje(modelo: THREE.Object3D, o: { cor: string; low: boolean }): TrajeHandle | null {
  const quadril = OSSO(modelo, "Hips"), cabeca = OSSO(modelo, "Head"), pescoco = OSSO(modelo, "Neck");
  const bE = OSSO(modelo, "LeftArm"), bD = OSSO(modelo, "RightArm");
  if (!quadril || !cabeca || !pescoco || !bE || !bD) return null;

  // monta NA POSE DE BIND (o esqueleto pode estar no meio de uma animação): guarda, põe em bind, monta, devolve
  let sk: THREE.Skeleton | null = null;
  modelo.traverse((x) => { if (!sk && (x as THREE.SkinnedMesh).isSkinnedMesh) sk = (x as THREE.SkinnedMesh).skeleton; });
  const salvos: [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][] = [];
  modelo.traverse((x) => { if ((x as THREE.Bone).isBone) salvos.push([x, x.position.clone(), x.quaternion.clone(), x.scale.clone()]); });
  (sk as THREE.Skeleton | null)?.pose();
  modelo.updateMatrixWorld(true);

  const P = (x: THREE.Object3D) => x.getWorldPosition(new THREE.Vector3());
  const W = P(bE).distanceTo(P(bD));   // a largura dos ombros: a régua de todas as peças
  const lat = P(bE).sub(P(bD)).normalize(), cima = P(cabeca).sub(P(quadril)).normalize();
  const frente = new THREE.Vector3().crossVectors(lat, cima).normalize(); lat.crossVectors(cima, frente).normalize();

  const seg = o.low ? 10 : 16;
  const cor = new THREE.Color(o.cor);
  const matPlaca = toon(0xf4f5ff, { rim: cor, rimForca: 0.55, brilho: 0.25 });
  const matMalha = toon(0x2b2e3d, { rim: cor, rimForca: 0.4, brilho: 0.15 });
  const matMetal = toon(0x9097a8, { brilho: 0.6 });
  const matLuz = new THREE.MeshBasicMaterial({ color: cor });
  const matVidro = new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const matReflexo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
  const matDentro = new THREE.MeshBasicMaterial({ color: 0x07080c, side: THREE.BackSide });
  const matTinta = tintaFixa(W * 0.026);
  const comTinta = new Set<THREE.Material>([matPlaca, matMalha, matMetal]);
  const geos: THREE.BufferGeometry[] = [], pecas: THREE.Object3D[] = [];

  const mBase = new THREE.Matrix4(), xA = new THREE.Vector3(), zA = new THREE.Vector3();
  /** a base (mundo) de uma peça: y = `dir`, x = o `ref` (lateral do corpo) projetado, z = x × y */
  const base = (dir: THREE.Vector3, ref: THREE.Vector3) => {
    xA.copy(ref).addScaledVector(dir, -ref.dot(dir)); if (xA.lengthSq() < 1e-6) xA.copy(frente).addScaledVector(dir, -frente.dot(dir)); xA.normalize();
    zA.crossVectors(xA, dir).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(mBase.makeBasis(xA, dir, zA));
  };
  const prender = (osso: THREE.Object3D, m: THREE.Object3D) => {
    // o CONTORNO DE TINTA: a mesma geometria, inflada, só as faces de trás (filha da peça — segue junto)
    const tintas: [THREE.Mesh, THREE.Mesh][] = [];
    m.traverse((x) => { const k = x as THREE.Mesh; if (k.isMesh && comTinta.has(k.material as THREE.Material)) tintas.push([k, new THREE.Mesh(k.geometry, matTinta)]); });
    for (const [k, t] of tintas) k.add(t);
    osso.attach(m); mostrarCaminho(m); pecas.push(m); m.traverse((x) => { x.frustumCulled = false; });
  };
  /** uma CASCA de `a` até `b` (ou `len` m na direção `dir` a partir de `a`), presa em `osso` */
  const casca = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, op: { achata?: number; extA?: number; extB?: number; ref?: THREE.Vector3 } = {}) => {
    const d = b.clone().sub(a), len = Math.max(0.01, d.length()); d.normalize();
    const g = new THREE.LatheGeometry(perfil(len, r1, r2, op.extA ?? 0, op.extB ?? 0), seg); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.copy(base(d, op.ref ?? lat)); m.scale.set(1, 1, op.achata ?? 1);
    prender(osso, m); return m;
  };
  const esfera = (osso: THREE.Object3D, c: THREE.Vector3, r: number, mat: THREE.Material) => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); prender(osso, m); return m;
  };
  /** um anel de LUZ em volta do osso (no ponto `c`, plano perpendicular a `dir`) */
  const anel = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, r: number, tubo: number, mat: THREE.Material = matLuz) => {
    const g = new THREE.TorusGeometry(r, tubo, 6, seg + 4); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); prender(osso, m); return m;
  };

  // ── o TRONCO ──
  const esp = OSSO(modelo, "Spine"), esp2 = OSSO(modelo, "Spine2");
  if (esp && esp2) {
    casca(quadril, P(quadril).addScaledVector(cima, -0.06), P(esp), W * 0.42, W * 0.4, matPlaca, { achata: 0.7, extA: 0.04, extB: 0.02 });
    casca(esp, P(esp), P(esp2), W * 0.37, W * 0.4, matMalha, { achata: 0.72 });
    const peito = casca(esp2, P(esp2).addScaledVector(cima, -0.05), P(pescoco), W * 0.5, W * 0.42, matPlaca, { achata: 0.66, extB: 0.02 });
    // a faixa de luz no peito (um arco na frente)
    const g = new THREE.TorusGeometry(W * 0.3, W * 0.012, 4, 24, Math.PI * 0.7); geos.push(g);
    const f = new THREE.Mesh(g, matLuz); f.position.copy(P(esp2)).addScaledVector(cima, W * 0.18).addScaledVector(frente, W * 0.33);
    f.quaternion.copy(base(cima, lat)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, Math.PI * 0.65))); prender(esp2, f);
    anel(esp, P(esp), cima, W * 0.39, W * 0.018);   // a cintura
    void peito;
  }
  // a GOLA (o anel de metal onde o capacete encaixa)
  anel(pescoco, P(pescoco).addScaledVector(cima, 0.02), cima, W * 0.24, W * 0.05, matMetal);
  anel(pescoco, P(pescoco).addScaledVector(cima, 0.045), cima, W * 0.235, W * 0.014);

  // ── o CAPACETE: casca fechada com a abertura na frente + a viseira de vidro + o fundo escuro ──
  const capacete = new THREE.Group();
  const R = W * 0.46, centro = P(cabeca).addScaledVector(cima, W * 0.24).addScaledVector(frente, W * 0.03);
  capacete.position.copy(centro); capacete.quaternion.copy(base(cima, lat));   // (local: y = cima, z = frente)
  {
    const ab = 0.62, tTopo = 0.3 * Math.PI, tBaixo = 0.74 * Math.PI;   // a abertura: ±ab rad em volta da frente, entre tTopo e tBaixo
    const fr = Math.PI / 2;   // (no SphereGeometry, φ = π/2 é o +z)
    const partes = [
      new THREE.SphereGeometry(R, seg + 8, 12, 0, Math.PI * 2, 0, tTopo),
      new THREE.SphereGeometry(R, seg + 8, 8, fr + ab, Math.PI * 2 - 2 * ab, tTopo, tBaixo - tTopo),
      new THREE.SphereGeometry(R, seg + 8, 6, 0, Math.PI * 2, tBaixo, Math.PI * 0.86 - tBaixo),
    ];
    for (const g of partes) { geos.push(g); capacete.add(new THREE.Mesh(g, matPlaca)); }
    const gD = new THREE.SphereGeometry(R * 0.985, seg + 4, 12, 0, Math.PI * 2, 0, Math.PI * 0.86); geos.push(gD); capacete.add(new THREE.Mesh(gD, matDentro));
    const gV = new THREE.SphereGeometry(R * 1.012, seg + 4, 8, fr - ab - 0.06, 2 * ab + 0.12, tTopo - 0.06, tBaixo - tTopo + 0.12); geos.push(gV);
    const viseira = new THREE.Mesh(gV, matVidro); viseira.renderOrder = 2; capacete.add(viseira);
    // os REFLEXOS do vidro, como se desenha: duas faixas brancas inclinadas no canto de cima
    for (const [dphi, larg, ini, comp] of [[0.38, 0.13, 0.36, 0.22], [0.16, 0.05, 0.38, 0.16]] as const) {
      const gr = new THREE.SphereGeometry(R * 1.02, 6, 4, fr + dphi, larg, Math.PI * ini, Math.PI * comp); geos.push(gr);
      const rf = new THREE.Mesh(gr, matReflexo); rf.rotation.z = -0.35; rf.renderOrder = 3; capacete.add(rf);
    }
    // a moldura da viseira: um friso de luz em cima e as luzes laterais
    const gF = new THREE.TorusGeometry(R * 1.02, W * 0.012, 4, 20, 2 * ab + 0.12); geos.push(gF);
    const friso = new THREE.Mesh(gF, matLuz); friso.rotation.set(Math.PI / 2, 0, -(fr + ab + 0.06) + Math.PI); friso.position.y = Math.cos(tTopo - 0.06) * R * 1.02; friso.scale.setScalar(Math.sin(tTopo - 0.06)); capacete.add(friso);
    for (const s of [-1, 1]) { const gl = new THREE.CylinderGeometry(W * 0.05, W * 0.05, W * 0.06, 12); geos.push(gl); const l = new THREE.Mesh(gl, matMetal); l.rotation.z = Math.PI / 2; l.position.set(s * R * 0.98, 0, -R * 0.05); capacete.add(l); const gl2 = new THREE.CircleGeometry(W * 0.03, 12); geos.push(gl2); const l2 = new THREE.Mesh(gl2, matLuz); l2.rotation.y = s * Math.PI / 2; l2.position.set(s * (R * 0.98 + W * 0.031), 0, -R * 0.05); capacete.add(l2); }
  }
  prender(cabeca, capacete);
  const escCapacete = capacete.scale.clone();   // (o `attach` compensou a escala do osso: o ajuste multiplica esta)
  // onde os OLHOS do rosto ficam: um pouco à frente do centro do capacete, na altura da viseira
  const ancoraRosto = new THREE.Object3D(); ancoraRosto.position.set(0, R * 0.05, R * 0.3); capacete.add(ancoraRosto);

  // ── os BRAÇOS e as LUVAS ──
  for (const L of ["Left", "Right"] as const) {
    const s = L === "Left" ? 1 : -1, braco = OSSO(modelo, `${L}Arm`), ante = OSSO(modelo, `${L}ForeArm`), mao = OSSO(modelo, `${L}Hand`);
    if (!braco || !ante || !mao) continue;
    const pb = P(braco), pa = P(ante), pm = P(mao);
    // a ombreira: meia casca grande por cima do ombro
    const ombro = esfera(braco, pb.clone().addScaledVector(cima, W * 0.03), W * 0.2, matPlaca); ombro.scale.set(1.05, 0.8, 0.95);
    casca(braco, pb, pa, W * 0.15, W * 0.13, matPlaca, { extA: 0.02, ref: frente });
    esfera(ante, pa, W * 0.12, matMalha);
    casca(ante, pa, pm, W * 0.14, W * 0.12, matPlaca, { extB: 0.01, ref: frente });
    anel(mao, pm.clone().addScaledVector(pm.clone().sub(pa).normalize(), -0.01), pm.clone().sub(pa), W * 0.12, W * 0.013);   // o punho
    // a luva: a palma até a base do dedo médio, e cada falange
    const med = OSSO(modelo, `${L}HandMiddle1`);
    if (med) casca(mao, pm, P(med), W * 0.1, W * 0.1, matMalha, { achata: 0.48, extA: 0.01, extB: 0.012, ref: pm.clone().sub(pa).cross(cima).multiplyScalar(s) });
    for (const d of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      for (let k = 1; k <= 3; k++) {
        const f = OSSO(modelo, `${L}Hand${d}${k}`); if (!f) continue;
        const prox = OSSO(modelo, `${L}Hand${d}${k + 1}`), pf = P(f);
        const fim = prox ? P(prox) : pf.clone().add(pf.clone().sub(P(f.parent!)).normalize().multiplyScalar(0.022));
        casca(f, pf, fim, W * (d === "Thumb" ? 0.042 : 0.036), W * 0.032, matMalha, { extA: 0.004, extB: 0.006 });
      }
    }
    void s;
  }
  // ── as PERNAS e as BOTAS ──
  for (const L of ["Left", "Right"] as const) {
    const coxa = OSSO(modelo, `${L}UpLeg`), canela = OSSO(modelo, `${L}Leg`), pe = OSSO(modelo, `${L}Foot`), dedo = OSSO(modelo, `${L}ToeBase`);
    if (!coxa || !canela || !pe) continue;
    const pc = P(coxa), pj = P(canela), pp = P(pe);
    casca(coxa, pc, pj, W * 0.24, W * 0.18, matPlaca, { extA: 0.03 });
    const joelho = esfera(canela, pj.clone().addScaledVector(frente, W * 0.06), W * 0.14, matPlaca); joelho.scale.set(1, 1.1, 0.8);
    casca(canela, pj, pp, W * 0.17, W * 0.14, matPlaca, { extB: 0.02 });
    anel(pe, pp.clone().addScaledVector(cima, W * 0.1), pp.clone().sub(pj), W * 0.15, W * 0.014);   // o tornozelo
    if (dedo) {
      const pd = P(dedo), chao = pp.clone().addScaledVector(cima, -pp.clone().sub(pd).dot(cima));
      casca(pe, pp.clone().addScaledVector(pd.clone().sub(pp), -0.25), pd, W * 0.17, W * 0.15, matMalha, { achata: 0.85, ref: lat });
      const ponta = pd.clone().add(pd.clone().sub(pp).projectOnPlane(cima).normalize().multiplyScalar(W * 0.3));
      casca(dedo, pd, ponta, W * 0.14, W * 0.1, matMalha, { achata: 0.62, extB: 0.01, ref: lat });
      void chao;
    }
  }

  // devolve a pose em que o esqueleto estava
  for (const [x, p, q, s] of salvos) { x.position.copy(p); x.quaternion.copy(q); x.scale.copy(s); }
  modelo.updateMatrixWorld(true);

  return {
    ancoraRosto,
    ajustarCapacete(d) { capacete.scale.copy(escCapacete).multiplyScalar(d > 0 ? Math.max(1, (d * 1.9) / R) : 1); },
    visivel(on) { for (const p of pecas) p.visible = on; },
    recolorir(hex) { matLuz.color.set(hex); },
    dispose() { for (const p of pecas) p.removeFromParent(); for (const g of geos) g.dispose(); for (const m of [matPlaca, matMalha, matMetal, matLuz, matVidro, matReflexo, matDentro, matTinta]) m.dispose(); },
  };
}
