/**
 * A ARMADURA de combate (as armas de fogo): placas montadas DIRETO nos ossos do esqueleto mixamo do AvatarLuz — o
 * mesmo que toca as animações do rifle (public/anim/rifle). Assim as poses de mira/andar/virar/morrer ficam como foram
 * gravadas e as mãos fecham na arma sem a correção do corpo VRM (que tem braços de outro comprimento).
 *
 * O formato segue uma armadura de placas de cavaleira (a referência do dono): peitoral com QUILHA e as costuras em V,
 * lâminas sobrepostas na barriga, a placa da frente entre as pernas e as das coxas (tassets), OMBREIRAS grandes em
 * camadas com o emblema, braçadeiras com os anéis de luz, manoplas, JOELHEIRAS grandes com a asa do lado, grevas e
 * botas de placas. Por baixo, a malha escura. O capacete é fechado com a viseira de vidro (o rosto de anime do VRM
 * aparece lá dentro — AvatarVrm `rosto`).
 * O traço é de DESENHO (components/cyber/AvatarAnime): as placas FACETADAS (poucos lados — como papel dobrado), cel
 * shading em faixas, o brilho de borda na cor do jogador e o CONTORNO DE TINTA.
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

export const CORES_TRAJE = { aco: 0xc3c8d6, acoEscuro: 0x6f7690, malha: 0x232741, costura: 0x14172a, emblema: 0x0f4f5a, viseira: 0xa9e4ff } as const;

const OSSO = (m: THREE.Object3D, n: string) => m.getObjectByName(`mixamorig${n}`) ?? null;

/** o perfil de uma casca torneada ao longo de y (0..len), raio r1 → r2; `redondo` arredonda as pontas (peça fechada) */
function perfil(len: number, r1: number, r2: number, extA: number, extB: number, redondo = true, n = 10): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], tot = len + extA + extB, e = 0.22;
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = -extA + u * tot, k = redondo ? Math.min(1, u / e, (1 - u) / e) : 1;
    const r = (r1 + (r2 - r1) * u) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
    pts.push(new THREE.Vector2(Math.max(r, redondo && (i === 0 || i === n) ? 0 : 0.002), y));
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
  const baixo = cima.clone().negate();

  const seg = o.low ? 10 : 16;
  const cor = new THREE.Color(o.cor), C = CORES_TRAJE;
  const facetado = (m: THREE.MeshToonMaterial) => { m.side = THREE.DoubleSide; return m; };   // (as placas abertas: os dois lados; a faceta vem dos poucos lados)
  const matAco = facetado(toon(C.aco, { rim: cor, rimForca: 0.5, brilho: 0.45 }));
  const matAcoEsc = facetado(toon(C.acoEscuro, { rim: cor, rimForca: 0.4, brilho: 0.35 }));
  const matMalha = toon(C.malha, { rim: cor, rimForca: 0.35, brilho: 0.1 });
  const matEmblema = toon(C.emblema, { brilho: 0.2 });
  const matCostura = new THREE.MeshBasicMaterial({ color: C.costura });
  const matLuz = new THREE.MeshBasicMaterial({ color: cor });
  const matVidro = new THREE.MeshBasicMaterial({ color: C.viseira, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const matReflexo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const matDentro = new THREE.MeshBasicMaterial({ color: 0x07080c, side: THREE.BackSide });
  const matTinta = tintaFixa(W * 0.02);
  const comTinta = new Set<THREE.Material>([matAco, matAcoEsc, matMalha, matEmblema]);
  const mats: THREE.Material[] = [matAco, matAcoEsc, matMalha, matEmblema, matCostura, matLuz, matVidro, matReflexo, matDentro, matTinta];
  const geos: THREE.BufferGeometry[] = [], pecas: THREE.Object3D[] = [];

  const mBase = new THREE.Matrix4(), xA = new THREE.Vector3(), zA = new THREE.Vector3();
  /** a base (mundo) de uma peça: y = `dir`, x = o `ref` (lateral do corpo) projetado, z = x × y. No lathe, φ = 0 é o +z
   *  e φ = π/2 o +x (a esquerda do corpo): no tronco (y pra cima) φ = 0 é a FRENTE; nas pernas (y pra baixo), as COSTAS */
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
  type OpCasca = { achata?: number; extA?: number; extB?: number; ref?: THREE.Vector3; phi?: [number, number]; reto?: boolean; lados?: number };
  /** uma CASCA de `a` até `b`, presa em `osso`; `phi` = [centro, largura] só um pedaço da volta (as placas abertas);
   *  `lados` poucos = a placa facetada */
  const casca = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, op: OpCasca = {}) => {
    const d = b.clone().sub(a), len = Math.max(0.01, d.length()); d.normalize();
    const lados = op.lados ?? seg, ph = op.phi;
    const g = new THREE.LatheGeometry(perfil(len, r1, r2, op.extA ?? 0, op.extB ?? 0, !op.reto && !ph), lados, ph ? ph[0] - ph[1] / 2 : 0, ph ? ph[1] : Math.PI * 2); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.copy(base(d, op.ref ?? lat)); m.scale.set(1, 1, op.achata ?? 1);
    prender(osso, m); return m;
  };
  /** LÂMINAS sobrepostas de `a` a `b` (cada uma abre um pouco embaixo e cobre a de baixo) */
  const laminas = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, n: number, r1: number, r2: number, mat: THREE.Material, op: OpCasca = {}) => {
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1.25) / n, ra = r1 + (r2 - r1) * u0, rb = r1 + (r2 - r1) * Math.min(1, u1);
      casca(osso, a.clone().lerp(b, u0), a.clone().lerp(b, Math.min(1.05, u1)), ra * 1.04, rb * 0.98, mat, { ...op, reto: true });
    }
  };
  const esfera = (osso: THREE.Object3D, c: THREE.Vector3, r: number, mat: THREE.Material, lados = seg) => {
    const g = new THREE.SphereGeometry(r, lados, Math.max(4, Math.round(lados / 2))); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); prender(osso, m); return m;
  };
  const anel = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, r: number, tubo: number, mat: THREE.Material = matLuz) => {
    const g = new THREE.TorusGeometry(r, tubo, 5, seg + 4); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); prender(osso, m); return m;
  };
  /** uma placa chata (caixa) no ponto `c`, com o y em `dir` e a face (z) pra `face`, girada `giro` no próprio plano */
  const placa = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, w: number, h: number, e: number, mat: THREE.Material, giro = 0) => {
    const g = new THREE.BoxGeometry(w, h, e); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c);
    const y = dir.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    m.quaternion.setFromRotationMatrix(mBase.makeBasis(x, y, z)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), giro));
    prender(osso, m); return m;
  };
  /** uma COSTURA (o traço fino das juntas entre as placas — na referência, as linhas azuis; aqui na luz do jogador)
   *  de `a` a `b`, rente à face `face` */
  const costura = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, face: THREE.Vector3, mat: THREE.Material = matLuz, larg = W * 0.012) => {
    const d = b.clone().sub(a); placa(osso, a.clone().lerp(b, 0.5), d, face, larg, d.length(), larg * 0.8, mat);
  };

  // ── o TRONCO ──
  const esp = OSSO(modelo, "Spine"), esp1 = OSSO(modelo, "Spine1"), esp2 = OSSO(modelo, "Spine2");
  let compCoxa = 0.45;
  { const c = OSSO(modelo, "LeftUpLeg"), j = OSSO(modelo, "LeftLeg"); if (c && j) compCoxa = P(c).distanceTo(P(j)); }
  if (esp && esp1 && esp2) {
    const pq = P(quadril), ps = P(esp), ps1 = P(esp1), ps2 = P(esp2), pn = P(pescoco);
    // a malha por baixo
    casca(quadril, pq.clone().addScaledVector(cima, -0.08), ps, W * 0.42, W * 0.38, matMalha, { achata: 0.72, extA: 0.04 });
    casca(esp, ps, ps2, W * 0.37, W * 0.4, matMalha, { achata: 0.72 });
    // o PEITORAL: largo em cima, estreito na cintura, com a quilha na frente (8 lados: um vértice bem no meio)
    casca(esp2, ps1.clone().addScaledVector(cima, -0.02), pn.clone().addScaledVector(cima, -0.02), W * 0.39, W * 0.52, matAco, { achata: 0.7, lados: 8, extB: 0.03 });
    // as costuras em V do peitoral (duas, encaixadas) e a linha de baixo
    const fP = W * 0.36;
    for (const [alt, abre] of [[0.62, 0.2], [0.32, 0.17]] as const) {
      const meio = ps1.clone().lerp(pn, alt - 0.2).addScaledVector(frente, fP * 0.98);
      for (const s of [-1, 1]) costura(esp2, meio, ps1.clone().lerp(pn, alt).addScaledVector(lat, s * W * abre).addScaledVector(frente, fP * 0.86), frente);
    }
    // a BARRIGA: 3 lâminas sobrepostas
    laminas(esp1, ps.clone().addScaledVector(cima, -0.02), ps1.clone().addScaledVector(cima, 0.02), 3, W * 0.38, W * 0.4, matAco, { achata: 0.7, lados: 8 });
    // a GOLA (o colar de placas onde o capacete encaixa) com um friso de luz
    casca(pescoco, pn.clone().addScaledVector(cima, -0.03), pn.clone().addScaledVector(cima, W * 0.16), W * 0.33, W * 0.27, matAco, { lados: 8, reto: true });
    anel(pescoco, pn.clone().addScaledVector(cima, W * 0.16), cima, W * 0.27, W * 0.014);
    // a PLACA DA FRENTE entre as pernas (no quadril — y pra baixo: φ = π é a frente), com o recorte em V em cima
    casca(quadril, pq.clone().addScaledVector(cima, 0.03), pq.clone().addScaledVector(baixo, compCoxa * 0.62), W * 0.43, W * 0.46, matAco, { ref: lat, phi: [Math.PI, 1.0], lados: 4 });
    for (const s of [-1, 1]) costura(quadril, pq.clone().addScaledVector(frente, W * 0.44).addScaledVector(cima, -0.005), pq.clone().addScaledVector(frente, W * 0.44).addScaledVector(lat, s * W * 0.2).addScaledVector(cima, 0.04), frente, matLuz);
    // a placa de TRÁS (curta)
    casca(quadril, pq.clone().addScaledVector(cima, 0.03), pq.clone().addScaledVector(baixo, compCoxa * 0.4), W * 0.43, W * 0.47, matAco, { ref: lat, phi: [0, 1.4], lados: 4 });
  }

  // ── o CAPACETE: casca de aço fechada, a viseira de vidro (o rosto aparece), a quilha no topo ──
  const capacete = new THREE.Group();
  const R = W * 0.46, centro = P(cabeca).addScaledVector(cima, W * 0.24).addScaledVector(frente, W * 0.03);
  capacete.position.copy(centro); capacete.quaternion.copy(base(cima, lat));   // (local: y = cima, z = frente)
  {
    const ab = 0.64, tTopo = 0.3 * Math.PI, tBaixo = 0.72 * Math.PI;   // a abertura: ±ab rad em volta da frente, entre tTopo e tBaixo
    const fr = Math.PI / 2;   // (no SphereGeometry, φ = π/2 é o +z)
    const cascas: [THREE.SphereGeometry, THREE.Material][] = [
      [new THREE.SphereGeometry(R, 14, 8, 0, Math.PI * 2, 0, tTopo), matAco],
      [new THREE.SphereGeometry(R, 14, 6, fr + ab, Math.PI * 2 - 2 * ab, tTopo, tBaixo - tTopo), matAco],
      [new THREE.SphereGeometry(R, 14, 4, 0, Math.PI * 2, tBaixo, Math.PI * 0.86 - tBaixo), matAcoEsc],   // o queixo
    ];
    for (const [g, m] of cascas) { geos.push(g); capacete.add(new THREE.Mesh(g, m)); }
    const gD = new THREE.SphereGeometry(R * 0.985, seg, 10, 0, Math.PI * 2, 0, Math.PI * 0.86); geos.push(gD); capacete.add(new THREE.Mesh(gD, matDentro));
    const gV = new THREE.SphereGeometry(R * 1.012, seg, 8, fr - ab - 0.06, 2 * ab + 0.12, tTopo - 0.06, tBaixo - tTopo + 0.12); geos.push(gV);
    const viseira = new THREE.Mesh(gV, matVidro); viseira.renderOrder = 2; capacete.add(viseira);
    for (const [dphi, larg, ini, comp] of [[0.4, 0.13, 0.34, 0.2], [0.18, 0.05, 0.36, 0.14]] as const) {
      const gr = new THREE.SphereGeometry(R * 1.02, 6, 4, fr + dphi, larg, Math.PI * ini, Math.PI * comp); geos.push(gr);
      const rf = new THREE.Mesh(gr, matReflexo); rf.rotation.z = -0.35; rf.renderOrder = 3; capacete.add(rf);
    }
    // a QUILHA no topo (da testa à nuca) e a moldura da viseira em luz
    const gC = new THREE.TorusGeometry(R * 1.01, W * 0.035, 4, 16, Math.PI * 0.85); geos.push(gC);
    const quilha = new THREE.Mesh(gC, matAcoEsc); quilha.rotation.set(0, -Math.PI / 2, Math.PI / 2 - tTopo + 0.1); quilha.scale.set(1, 1, 0.5); capacete.add(quilha);
    const gF = new THREE.TorusGeometry(R * 1.025, W * 0.014, 4, 20, 2 * ab + 0.12); geos.push(gF);
    const friso = new THREE.Mesh(gF, matLuz); friso.rotation.set(Math.PI / 2, 0, -(fr + ab + 0.06) + Math.PI); friso.position.y = Math.cos(tTopo - 0.06) * R * 1.02; friso.scale.setScalar(Math.sin(tTopo - 0.06)); capacete.add(friso);
    // as bochechas: placas que descem do lado da viseira
    for (const s of [-1, 1]) {
      const gb = new THREE.BoxGeometry(W * 0.04, R * 0.7, R * 0.45); geos.push(gb);
      const b = new THREE.Mesh(gb, matAcoEsc); b.position.set(s * R * 0.93, -R * 0.2, R * 0.25); b.rotation.set(0.2, 0, s * 0.12); capacete.add(b);
    }
  }
  prender(cabeca, capacete);
  const escCapacete = capacete.scale.clone();   // (o `attach` compensou a escala do osso: o ajuste multiplica esta)
  const ancoraRosto = new THREE.Object3D(); ancoraRosto.position.set(0, R * 0.05, R * 0.3); capacete.add(ancoraRosto);

  // ── os BRAÇOS: a OMBREIRA em camadas com o emblema, a braçadeira com os anéis, a cotoveleira, a manopla ──
  for (const L of ["Left", "Right"] as const) {
    const braco = OSSO(modelo, `${L}Arm`), ante = OSSO(modelo, `${L}ForeArm`), mao = OSSO(modelo, `${L}Hand`);
    if (!braco || !ante || !mao) continue;
    const s = L === "Left" ? 1 : -1;
    const pb = P(braco), pa = P(ante), pm = P(mao), dBraco = pa.clone().sub(pb).normalize(), dAnte = pm.clone().sub(pa).normalize();
    const fora = lat.clone().multiplyScalar(s);
    casca(braco, pb, pa, W * 0.14, W * 0.125, matMalha, { extA: 0.02, ref: frente });
    // a ombreira: a cúpula facetada + 2 lâminas embaixo (só por cima/fora do braço: no braço, φ = 0 é pra CIMA do
    // lado esquerdo e pra baixo do direito)
    const cimaBraco = s > 0 ? 0 : Math.PI;
    // a cúpula grande, facetada, por cima do ombro — e 3 LÂMINAS descendo o braço, cada uma por cima da de baixo
    const clav = OSSO(modelo, `${L}Shoulder`) ?? braco;   // (a cúpula e o emblema no OMBRO: com o braço baixo, não giram pra fora)
    const domo = esfera(clav, pb.clone().addScaledVector(cima, W * 0.06).addScaledVector(fora, W * 0.05), W * 0.27, matAco, 8); domo.scale.set(1.15, 0.72, 1.15);
    for (const [k, r] of [[0.06, 0.31], [0.17, 0.29], [0.28, 0.27]] as const) {
      const a = pb.clone().addScaledVector(dBraco, W * k).addScaledVector(cima, W * 0.03);
      casca(braco, a, a.clone().addScaledVector(dBraco, W * 0.15), W * r, W * (r + 0.03), matAco, { ref: frente, phi: [cimaBraco, 3.0], lados: 6 });
      costura(braco, a.clone().addScaledVector(dBraco, W * 0.15).addScaledVector(frente, W * (r + 0.02)), a.clone().addScaledVector(dBraco, W * 0.15).addScaledVector(cima, W * (r + 0.03)), frente.clone().add(cima));
    }
    // o EMBLEMA na face da frente/de fora da ombreira (o painel escuro com o zigue-zague de luz, como na referência)
    const faceEm = frente.clone().multiplyScalar(0.75).addScaledVector(fora, 0.65).normalize();
    const cEm = pb.clone().addScaledVector(fora, W * 0.08).addScaledVector(faceEm, W * 0.24).addScaledVector(cima, W * 0.02);
    placa(clav, cEm, cima, faceEm, W * 0.24, W * 0.2, W * 0.03, matEmblema);
    for (let k = -1; k <= 1; k++) placa(clav, cEm.clone().addScaledVector(faceEm, W * 0.018).addScaledVector(cima, k * W * 0.05), new THREE.Vector3().crossVectors(faceEm, cima), faceEm, W * 0.025, W * 0.16, W * 0.01, matLuz, k % 2 ? 0.6 : -0.6);
    // a braçadeira do braço (dois anéis de luz, como na referência)
    anel(braco, pb.clone().lerp(pa, 0.72), dBraco, W * 0.15, W * 0.016);
    anel(braco, pb.clone().lerp(pa, 0.8), dBraco, W * 0.15, W * 0.012);
    // a COTOVELEIRA (facetada) com a asinha de fora
    esfera(ante, pa, W * 0.13, matAco, 6);
    // a BRAÇADEIRA: aberta no cotovelo, fecha no pulso (7 lados)
    casca(ante, pa.clone().addScaledVector(dAnte, 0.02), pm, W * 0.165, W * 0.125, matAco, { extB: 0.015, ref: frente, lados: 7, reto: true });
    anel(ante, pa.clone().lerp(pm, 0.18), dAnte, W * 0.16, W * 0.012);
    costura(ante, pa.clone().lerp(pm, 0.3).addScaledVector(frente, W * 0.15), pa.clone().lerp(pm, 0.9).addScaledVector(frente, W * 0.125), frente);
    // a MANOPLA: o punho largo, a palma de malha, as costas da mão em placa e os dedos de aço escuro
    casca(mao, pm.clone().addScaledVector(dAnte, -0.015), pm.clone().addScaledVector(dAnte, 0.035), W * 0.14, W * 0.15, matAco, { ref: frente, lados: 6, reto: true });
    const med = OSSO(modelo, `${L}HandMiddle1`), ind = OSSO(modelo, `${L}HandIndex1`), mind = OSSO(modelo, `${L}HandPinky1`);
    if (med) {
      const ladoMao = ind && mind ? P(ind).sub(P(mind)).normalize() : lat;
      casca(mao, pm, P(med), W * 0.1, W * 0.1, matMalha, { achata: 0.48, extA: 0.01, extB: 0.012, ref: ladoMao });
      const costas = new THREE.Vector3().crossVectors(P(med).sub(pm).normalize(), ladoMao).normalize().multiplyScalar(s);
      placa(mao, pm.clone().lerp(P(med), 0.55).addScaledVector(costas, W * 0.05), P(med).sub(pm), costas, W * 0.17, W * 0.15, W * 0.03, matAco);
    }
    for (const d of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      for (let k = 1; k <= 3; k++) {
        const f = OSSO(modelo, `${L}Hand${d}${k}`); if (!f) continue;
        const prox = OSSO(modelo, `${L}Hand${d}${k + 1}`), pf = P(f);
        const fim = prox ? P(prox) : pf.clone().add(pf.clone().sub(P(f.parent!)).normalize().multiplyScalar(0.022));
        casca(f, pf, fim, W * (d === "Thumb" ? 0.042 : 0.036), W * 0.032, matAcoEsc, { extA: 0.004, extB: 0.006, lados: 6 });
      }
    }
  }
  // ── as PERNAS: a placa da coxa (tasset) por fora, a coxote na frente, a JOELHEIRA com a asa, a greva, a bota ──
  for (const L of ["Left", "Right"] as const) {
    const coxa = OSSO(modelo, `${L}UpLeg`), canela = OSSO(modelo, `${L}Leg`), pe = OSSO(modelo, `${L}Foot`), dedo = OSSO(modelo, `${L}ToeBase`);
    if (!coxa || !canela || !pe) continue;
    const s = L === "Left" ? 1 : -1, fora = lat.clone().multiplyScalar(s);
    const pc = P(coxa), pj = P(canela), pp = P(pe), dCoxa = pj.clone().sub(pc).normalize();
    casca(coxa, pc, pj, W * 0.22, W * 0.17, matMalha, { extA: 0.03 });
    // a placa de fora da coxa (tasset), em duas lâminas — y pra baixo: φ = ±π/2 é o lado de fora
    laminas(coxa, pc.clone().addScaledVector(cima, 0.06), pc.clone().addScaledVector(dCoxa, compCoxa * 0.5), 2, W * 0.27, W * 0.3, matAco, { ref: lat, phi: [s * Math.PI / 2 + s * 0.25, 1.9], lados: 4 });
    // a coxote: a placa da frente da coxa (φ = π)
    casca(coxa, pc.clone().addScaledVector(dCoxa, compCoxa * 0.4), pj.clone().addScaledVector(dCoxa, -0.03), W * 0.235, W * 0.2, matAco, { ref: lat, phi: [Math.PI, 2.3], lados: 5 });
    // a JOELHEIRA: a cúpula grande facetada, uma lâmina em cima e a asa de fora
    const cj = pj.clone().addScaledVector(frente, W * 0.08);
    const joelho = esfera(canela, cj, W * 0.17, matAco, 7); joelho.scale.set(1, 1.15, 0.8);
    casca(canela, pj.clone().addScaledVector(cima, W * 0.22), pj.clone().addScaledVector(cima, W * 0.1), W * 0.215, W * 0.2, matAco, { ref: lat, phi: [Math.PI, 2.2], lados: 5 });
    placa(canela, pj.clone().addScaledVector(fora, W * 0.16).addScaledVector(frente, W * 0.02), cima, fora.clone().addScaledVector(frente, 0.3), W * 0.2, W * 0.26, W * 0.025, matAcoEsc, s * 0.25);
    // a GREVA (8 lados, alarga em cima e no tornozelo) com a costura da frente e o friso
    casca(canela, pj.clone().addScaledVector(dCoxa, 0.04), pp, W * 0.19, W * 0.15, matAco, { extB: 0.03, lados: 8, reto: true });
    costura(canela, pj.clone().lerp(pp, 0.15).addScaledVector(frente, W * 0.19), pj.clone().lerp(pp, 0.85).addScaledVector(frente, W * 0.155), frente);
    anel(canela, pj.clone().lerp(pp, 0.9), pp.clone().sub(pj), W * 0.155, W * 0.012);
    // a BOTA de placas: o peito do pé em lâminas e a biqueira escura
    if (dedo) {
      const pd = P(dedo), ponta = pd.clone().add(pd.clone().sub(pp).projectOnPlane(cima).normalize().multiplyScalar(W * 0.3));
      casca(pe, pp.clone().addScaledVector(pd.clone().sub(pp), -0.25), pd, W * 0.17, W * 0.15, matAco, { achata: 0.85, ref: lat, lados: 6 });
      casca(dedo, pd, ponta, W * 0.14, W * 0.1, matAcoEsc, { achata: 0.62, extB: 0.01, ref: lat, lados: 6 });
    }
  }

  // devolve a pose em que o esqueleto estava
  for (const [x, p, q, sc] of salvos) { x.position.copy(p); x.quaternion.copy(q); x.scale.copy(sc); }
  modelo.updateMatrixWorld(true);

  return {
    ancoraRosto,
    ajustarCapacete(d) { capacete.scale.copy(escCapacete).multiplyScalar(d > 0 ? Math.max(1, (d * 1.9) / R) : 1); },
    visivel(on) { for (const p of pecas) p.visible = on; },
    recolorir(hex) { matLuz.color.set(hex); },
    dispose() { for (const p of pecas) p.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
