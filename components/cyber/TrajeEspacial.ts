/**
 * O TRAJE de combate (as armas de fogo): peças montadas DIRETO nos ossos do esqueleto mixamo do AvatarLuz — o mesmo
 * que toca as animações do rifle (public/anim/rifle). Assim as poses de mira/andar/virar/morrer ficam como foram
 * gravadas e as mãos fecham na arma sem a correção do corpo VRM (que tem braços de outro comprimento).
 *
 * O desenho é o ASTRONAUTA 2.0: a estética 3D do avatar padrão (o soldado do three.js), mas com a essência de uma
 * armadura de fuzileiro espacial (a referência do dono — a de oliva com viseira dourada): placas OLIVA grossas e
 * chanfradas (poucos lados, facetas de metal), a MALHA escura com nervuras nas juntas, o peitoral com a placa do meio
 * e as TIRAS cruzadas com fivelas, ombreiras grandes, as almofadas BRANCAS FURADAS nos antebraços e nos tornozelos,
 * as placas grandes das coxas, joelheiras robustas e botas de sola grossa. O capacete tem a VISEIRA DOURADA espelhada —
 * um pouco transparente: o rosto de anime do VRM aparece atrás dela (AvatarVrm `rosto`). Sem a mochila do jato
 * (AvatarLuz `traje`). Os frisos acesos levam a cor do jogador.
 */
import * as THREE from "three";
import { mostrarCaminho } from "./matrizes";

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

export const CORES_TRAJE = { oliva: 0x5d6240, malha: 0x26272b, borracha: 0x18191c, branco: 0xd9dad3, furo: 0x1a1a1d, ouro: 0xd8a537 } as const;

const OSSO = (m: THREE.Object3D, n: string) => m.getObjectByName(`mixamorig${n}`) ?? null;

/** o perfil de uma casca torneada ao longo de y (0..len), raio r1 → r2; `redondo` arredonda as pontas (peça fechada);
 *  `bojo` estufa o meio */
function perfil(len: number, r1: number, r2: number, extA: number, extB: number, redondo = true, n = 10, bojo = 0): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], tot = len + extA + extB, e = 0.2;
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = -extA + u * tot, k = redondo ? Math.min(1, u / e, (1 - u) / e) : 1;
    const r = (r1 + (r2 - r1) * u) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) * (1 + bojo * Math.sin(Math.PI * u));
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

  const seg = o.low ? 10 : 18;
  const cor = new THREE.Color(o.cor), C = CORES_TRAJE;
  // (o cyberespaço é escuro: um pouco de emissivo deixa a armadura legível em qualquer canto, como o avatar padrão)
  const placa = (cor0: number, ext: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: cor0, roughness: 0.5, metalness: 0.25, flatShading: true, side: THREE.DoubleSide, emissive: cor0, emissiveIntensity: 0.12, ...ext });
  const matOliva = placa(C.oliva), matOlivaLisa = placa(C.oliva, { flatShading: false });   // (o capacete e as ombreiras: lisos)
  const matMalha = new THREE.MeshStandardMaterial({ color: C.malha, roughness: 0.85, metalness: 0.05, emissive: C.malha, emissiveIntensity: 0.15 });
  const matBorracha = placa(C.borracha, { roughness: 0.9, metalness: 0 });
  const matBranco = placa(C.branco, { roughness: 0.6, metalness: 0.05, emissiveIntensity: 0.1 });
  const matFuro = new THREE.MeshStandardMaterial({ color: C.furo, roughness: 0.9 });
  const matLuz = new THREE.MeshBasicMaterial({ color: cor });
  const matVisor = new THREE.MeshPhysicalMaterial({ color: C.ouro, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, emissive: 0x3a2a08, emissiveIntensity: 0.6 });
  const matDentro = new THREE.MeshBasicMaterial({ color: 0x07080c, side: THREE.BackSide });
  const mats: THREE.Material[] = [matOliva, matOlivaLisa, matMalha, matBorracha, matBranco, matFuro, matLuz, matVisor, matDentro];
  const geos: THREE.BufferGeometry[] = [], pecas: THREE.Object3D[] = [];

  const mBase = new THREE.Matrix4(), xA = new THREE.Vector3(), zA = new THREE.Vector3();
  /** a base (mundo) de uma peça: y = `dir`, x = o `ref` (lateral do corpo) projetado, z = x × y. No lathe, φ = 0 é o +z
   *  e φ = π/2 o +x (a esquerda do corpo): no tronco (y pra cima) φ = 0 é a FRENTE; nas pernas (y pra baixo), as COSTAS */
  const base = (dir: THREE.Vector3, ref: THREE.Vector3) => {
    xA.copy(ref).addScaledVector(dir, -ref.dot(dir)); if (xA.lengthSq() < 1e-6) xA.copy(frente).addScaledVector(dir, -frente.dot(dir)); xA.normalize();
    zA.crossVectors(xA, dir).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(mBase.makeBasis(xA, dir, zA));
  };
  const prender = (osso: THREE.Object3D, m: THREE.Object3D) => { osso.attach(m); mostrarCaminho(m); pecas.push(m); m.traverse((x) => { x.frustumCulled = false; }); };
  type OpCasca = { achata?: number; extA?: number; extB?: number; ref?: THREE.Vector3; phi?: [number, number]; reto?: boolean; lados?: number; bojo?: number };
  /** uma CASCA de `a` até `b`, presa em `osso`; `phi` = [centro, largura] só um pedaço da volta (as placas abertas);
   *  poucos `lados` = chanfrada */
  const casca = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, op: OpCasca = {}) => {
    const d = b.clone().sub(a), len = Math.max(0.01, d.length()); d.normalize();
    const ph = op.phi;
    const g = new THREE.LatheGeometry(perfil(len, r1, r2, op.extA ?? 0, op.extB ?? 0, !op.reto && !ph, 10, op.bojo ?? 0.08), op.lados ?? 8, ph ? ph[0] - ph[1] / 2 : 0, ph ? ph[1] : Math.PI * 2); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.copy(base(d, op.ref ?? lat)); m.scale.set(1, 1, op.achata ?? 1);
    prender(osso, m); return m;
  };
  /** NERVURAS da malha (os anéis de borracha nas juntas) de `a` a `b` */
  const nervuras = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, n: number, r: number, achata = 1) => {
    const d = b.clone().sub(a).normalize();
    for (let i = 0; i < n; i++) {
      const g = new THREE.TorusGeometry(r, r * 0.12, 6, seg); geos.push(g);
      const m = new THREE.Mesh(g, matBorracha); m.position.copy(a).lerp(b, (i + 0.5) / n); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d); m.scale.set(1, achata, 1); prender(osso, m);
    }
  };
  const esfera = (osso: THREE.Object3D, c: THREE.Vector3, r: number, mat: THREE.Material, lados = 8) => {
    const g = new THREE.SphereGeometry(r, lados, Math.max(4, Math.round(lados / 2))); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); prender(osso, m); return m;
  };
  /** um disco/botão (cilindro curto) com a face pra `normal` */
  const disco = (osso: THREE.Object3D, c: THREE.Vector3, normal: THREE.Vector3, r: number, e: number, mat: THREE.Material, lados = 10) => {
    const g = new THREE.CylinderGeometry(r, r, e, lados); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize()); prender(osso, m); return m;
  };
  /** uma TIRA (cinta) de `a` a `b`, achatada contra o corpo (a face pra `face`) */
  const tira = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, face: THREE.Vector3, larg = W * 0.07) => {
    const d = b.clone().sub(a), g = new THREE.CylinderGeometry(larg / 2, larg / 2, d.length(), 6); geos.push(g);
    const m = new THREE.Mesh(g, matBorracha); m.position.copy(a).lerp(b, 0.5);
    const y = d.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    m.quaternion.setFromRotationMatrix(mBase.makeBasis(x, y, z)); m.scale.set(1, 1, 0.28); prender(osso, m); return m;
  };
  /** a ALMOFADA BRANCA FURADA (antebraço, tornozelo): um pedaço de casca branco (φ = [centro, largura]) com os furos
   *  escuros em grade */
  const furada = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, centro: number, larg: number, ref: THREE.Vector3) => {
    casca(osso, a, b, r, r, matBranco, { ref, phi: [centro, larg], reto: true, lados: 10, bojo: 0.05 });
    const d = b.clone().sub(a), len = d.length(); d.normalize();
    const x0 = ref.clone().addScaledVector(d, -ref.dot(d)).normalize(), z0 = new THREE.Vector3().crossVectors(x0, d).normalize();
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) {
      const ph = centro + j * larg * 0.27 + (i % 2 ? larg * 0.13 : 0), radial = z0.clone().multiplyScalar(Math.cos(ph)).addScaledVector(x0, Math.sin(ph));
      esfera(osso, a.clone().addScaledVector(d, len * (0.25 + i * 0.25)).addScaledVector(radial, r * 1.03), W * 0.017, matFuro, 6);
    }
  };

  // ── o TRONCO ──
  const esp = OSSO(modelo, "Spine"), esp1 = OSSO(modelo, "Spine1"), esp2 = OSSO(modelo, "Spine2");
  let compCoxa = 0.45;
  { const c = OSSO(modelo, "LeftUpLeg"), j = OSSO(modelo, "LeftLeg"); if (c && j) compCoxa = P(c).distanceTo(P(j)); }
  if (esp && esp1 && esp2) {
    const pq = P(quadril), ps = P(esp), ps1 = P(esp1), ps2 = P(esp2), pn = P(pescoco);
    // a malha por baixo, com as nervuras dos lados da barriga
    casca(quadril, pq.clone().addScaledVector(cima, -0.08), ps, W * 0.4, W * 0.36, matMalha, { achata: 0.72, extA: 0.04, lados: seg });
    casca(esp, ps, ps2, W * 0.34, W * 0.38, matMalha, { achata: 0.7, lados: seg });
    nervuras(esp, ps, ps1, 3, W * 0.345, 0.72);
    // o PEITORAL: largo, chanfrado (8 lados), e a PLACA DO MEIO em relevo
    casca(esp2, ps1.clone().addScaledVector(cima, -0.01), pn.clone().addScaledVector(cima, -0.03), W * 0.42, W * 0.53, matOliva, { achata: 0.68, extB: 0.03 });
    casca(esp2, ps1.clone(), ps2.clone().lerp(pn, 0.75), W * 0.47, W * 0.55, matOliva, { achata: 0.7, phi: [0, 1.15], reto: true, lados: 4 });
    // a placa da BARRIGA (só na frente) e a de trás
    casca(esp1, ps.clone().addScaledVector(cima, -0.02), ps1.clone().addScaledVector(cima, 0.03), W * 0.39, W * 0.41, matOliva, { achata: 0.7, phi: [0, 1.4], reto: true, lados: 5 });
    casca(esp1, ps.clone().addScaledVector(cima, 0.02), ps1, W * 0.37, W * 0.4, matOliva, { achata: 0.72, phi: [Math.PI, 1.6], reto: true, lados: 5 });
    // a GOLA de borracha com nervuras
    casca(pescoco, pn.clone().addScaledVector(cima, -0.03), pn.clone().addScaledVector(cima, W * 0.12), W * 0.27, W * 0.24, matMalha, { reto: true, lados: seg });
    nervuras(pescoco, pn, pn.clone().addScaledVector(cima, W * 0.12), 2, W * 0.255);
    // as TIRAS cruzadas no peito: do ombro até o lado oposto da cintura, com as FIVELAS
    const fP = W * 0.37;
    for (const s of [-1, 1]) {
      const a = pn.clone().addScaledVector(lat, s * W * 0.25).addScaledVector(frente, fP * 0.75).addScaledVector(cima, -W * 0.05);
      const b = ps1.clone().addScaledVector(lat, -s * W * 0.22).addScaledVector(frente, fP * 0.92);
      tira(esp2, a, b, frente);
      disco(esp2, a.clone().lerp(b, 0.22).addScaledVector(frente, W * 0.02), frente, W * 0.045, W * 0.03, matOliva);
    }
    // um friso aceso (a luz do jogador) embaixo da placa do meio
    const gL = new THREE.TorusGeometry(W * 0.2, W * 0.01, 4, 16, Math.PI * 0.6); geos.push(gL);
    const friso = new THREE.Mesh(gL, matLuz); friso.position.copy(ps1).addScaledVector(cima, W * 0.02).addScaledVector(frente, fP * 0.62);
    friso.quaternion.copy(base(cima, lat)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.3, 0, Math.PI * 0.2))); prender(esp2, friso);
    // a COQUILHA (a placa entre as pernas) e a placa de trás do quadril — y pra baixo: φ = π é a frente
    casca(quadril, pq.clone().addScaledVector(cima, 0.03), pq.clone().addScaledVector(baixo, compCoxa * 0.35), W * 0.42, W * 0.2, matOliva, { ref: lat, phi: [Math.PI, 0.9], reto: true, lados: 3 });
    casca(quadril, pq.clone().addScaledVector(cima, 0.05), pq.clone().addScaledVector(baixo, compCoxa * 0.1), W * 0.43, W * 0.44, matOliva, { ref: lat, phi: [0, 2.2], reto: true, lados: 5 });
    const gC = new THREE.TorusGeometry(W * 0.41, W * 0.03, 5, seg); geos.push(gC);   // o cinto de borracha
    const cinto = new THREE.Mesh(gC, matBorracha); cinto.position.copy(pq).addScaledVector(cima, 0.04); cinto.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cima); cinto.scale.set(1, 0.72, 1); prender(quadril, cinto);
  }

  // ── o CAPACETE: casca oliva, a VISEIRA DOURADA espelhada (meio transparente: o rosto aparece), o queixo e as orelhas ──
  const capacete = new THREE.Group();
  const R = W * 0.46, centro = P(cabeca).addScaledVector(cima, W * 0.24).addScaledVector(frente, W * 0.03);
  capacete.position.copy(centro); capacete.quaternion.copy(base(cima, lat));   // (local: y = cima, z = frente, x = a esquerda)
  {
    const ab = 0.78, tTopo = 0.2 * Math.PI, tBaixo = 0.66 * Math.PI, fr = Math.PI / 2;   // a viseira: grande, da testa ao queixo
    const casco = (g: THREE.BufferGeometry, m: THREE.Material) => { geos.push(g); const k = new THREE.Mesh(g, m); capacete.add(k); return k; };
    casco(new THREE.SphereGeometry(R, seg + 6, 10, 0, Math.PI * 2, 0, tTopo), matOlivaLisa);
    casco(new THREE.SphereGeometry(R, seg + 6, 8, fr + ab, Math.PI * 2 - 2 * ab, tTopo, tBaixo - tTopo), matOlivaLisa);
    casco(new THREE.SphereGeometry(R, seg + 6, 6, 0, Math.PI * 2, tBaixo, Math.PI * 0.86 - tBaixo), matOlivaLisa).scale.set(1, 1, 1.12);   // o queixo, avançado
    casco(new THREE.SphereGeometry(R * 0.985, seg, 10, 0, Math.PI * 2, 0, Math.PI * 0.86), matDentro);
    const v = casco(new THREE.SphereGeometry(R * 1.02, seg + 6, 10, fr - ab - 0.05, 2 * ab + 0.1, tTopo - 0.05, tBaixo - tTopo + 0.1), matVisor);
    v.renderOrder = 2; v.scale.set(1, 1, 1.08);
    // a SOBRANCELHA (a aba de cima da viseira) e a respiração do queixo
    const gS = new THREE.TorusGeometry(R * 1.04, W * 0.035, 4, 12, 2 * ab + 0.15); geos.push(gS);
    const sob = new THREE.Mesh(gS, matOliva); sob.rotation.set(Math.PI / 2, 0, -(fr + ab + 0.075) + Math.PI); sob.position.y = Math.cos(tTopo - 0.05) * R * 1.03; sob.scale.setScalar(Math.sin(tTopo - 0.05) * 1.02); capacete.add(sob);
    const gR = new THREE.CylinderGeometry(W * 0.06, W * 0.07, W * 0.06, 8); geos.push(gR);
    const resp = new THREE.Mesh(gR, matBorracha); resp.rotation.x = Math.PI / 2; resp.position.set(0, -R * 0.62, R * 0.78); capacete.add(resp);
    // as ORELHAS: um módulo de cada lado (o da esquerda com a luz do jogador)
    for (const s of [-1, 1]) {
      const gO = new THREE.CylinderGeometry(W * 0.1, W * 0.11, W * 0.08, 6); geos.push(gO);
      const or = new THREE.Mesh(gO, matOliva); or.rotation.z = Math.PI / 2; or.position.set(s * R * 0.95, -R * 0.12, -R * 0.08); capacete.add(or);
      const gl = new THREE.CircleGeometry(W * 0.035, 10); geos.push(gl);
      const l = new THREE.Mesh(gl, s > 0 ? matLuz : matBorracha); l.rotation.y = s * Math.PI / 2; l.position.set(s * (R * 0.95 + W * 0.042), -R * 0.12, -R * 0.08); capacete.add(l);
    }
  }
  prender(cabeca, capacete);
  const escCapacete = capacete.scale.clone();   // (o `attach` compensou a escala do osso: o ajuste multiplica esta)
  const ancoraRosto = new THREE.Object3D(); ancoraRosto.position.set(0, R * 0.05, R * 0.3); capacete.add(ancoraRosto);

  // ── os BRAÇOS ──
  for (const L of ["Left", "Right"] as const) {
    const braco = OSSO(modelo, `${L}Arm`), ante = OSSO(modelo, `${L}ForeArm`), mao = OSSO(modelo, `${L}Hand`);
    if (!braco || !ante || !mao) continue;
    const s = L === "Left" ? 1 : -1;
    const pb = P(braco), pa = P(ante), pm = P(mao), dBraco = pa.clone().sub(pb).normalize(), dAnte = pm.clone().sub(pa).normalize();
    const fora = lat.clone().multiplyScalar(s), clav = OSSO(modelo, `${L}Shoulder`) ?? braco;
    const phCima = s > 0 ? 0 : Math.PI;   // (no braço, φ = 0 é pra cima do lado esquerdo e pra baixo do direito)
    casca(braco, pb, pa, W * 0.15, W * 0.13, matMalha, { extA: 0.02, ref: frente, lados: seg });
    // a OMBREIRA: grande e arredondada, chanfrada, por cima do ombro (no osso do ombro)
    const om = esfera(clav, pb.clone().addScaledVector(cima, W * 0.03).addScaledVector(fora, W * 0.06), W * 0.24, matOlivaLisa, seg);
    om.scale.set(1.15, 0.85, 1.1);
    // a placa do braço (por fora/cima) e a dobra de borracha do cotovelo
    casca(braco, pb.clone().addScaledVector(dBraco, W * 0.18), pb.clone().lerp(pa, 0.92), W * 0.17, W * 0.155, matOliva, { ref: frente, phi: [phCima, 3.2], reto: true, lados: 5 });
    nervuras(ante, pa.clone().addScaledVector(dAnte, -0.02), pa.clone().addScaledVector(dAnte, 0.04), 2, W * 0.13);
    // o ANTEBRAÇO: grosso, chanfrado, e a almofada BRANCA FURADA por fora, perto do pulso
    casca(ante, pa.clone().addScaledVector(dAnte, 0.03), pm, W * 0.17, W * 0.15, matOliva, { ref: frente, extB: 0.01, bojo: 0.12 });
    furada(ante, pa.clone().lerp(pm, 0.62), pa.clone().lerp(pm, 0.98), W * 0.158, phCima, 1.8, frente);
    // a luva: palma e dedos de borracha, a placa oliva nas costas
    const med = OSSO(modelo, `${L}HandMiddle1`), ind = OSSO(modelo, `${L}HandIndex1`), mind = OSSO(modelo, `${L}HandPinky1`);
    if (med) {
      const ladoMao = ind && mind ? P(ind).sub(P(mind)).normalize() : lat;
      casca(mao, pm, P(med), W * 0.1, W * 0.1, matBorracha, { achata: 0.5, extA: 0.01, extB: 0.012, ref: ladoMao, lados: 10 });
      const costas = new THREE.Vector3().crossVectors(P(med).sub(pm).normalize(), ladoMao).normalize().multiplyScalar(s);
      casca(mao, pm.clone().addScaledVector(costas, W * 0.02), P(med).addScaledVector(costas, W * 0.02), W * 0.11, W * 0.105, matOliva, { ref: ladoMao, achata: 0.5, phi: [0, 1.6], reto: true, lados: 4 });
    }
    for (const d of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      for (let k = 1; k <= 3; k++) {
        const f = OSSO(modelo, `${L}Hand${d}${k}`); if (!f) continue;
        const prox = OSSO(modelo, `${L}Hand${d}${k + 1}`), pf = P(f);
        const fim = prox ? P(prox) : pf.clone().add(pf.clone().sub(P(f.parent!)).normalize().multiplyScalar(0.022));
        casca(f, pf, fim, W * (d === "Thumb" ? 0.045 : 0.038), W * 0.034, matBorracha, { extA: 0.004, extB: 0.006, lados: 8 });
      }
    }
  }
  // ── as PERNAS ──
  for (const L of ["Left", "Right"] as const) {
    const coxa = OSSO(modelo, `${L}UpLeg`), canela = OSSO(modelo, `${L}Leg`), pe = OSSO(modelo, `${L}Foot`), dedo = OSSO(modelo, `${L}ToeBase`);
    if (!coxa || !canela || !pe) continue;
    const s = L === "Left" ? 1 : -1;
    const pc = P(coxa), pj = P(canela), pp = P(pe), dCoxa = pj.clone().sub(pc).normalize();
    casca(coxa, pc, pj, W * 0.23, W * 0.18, matMalha, { extA: 0.03, lados: seg });
    // as PLACAS GRANDES da coxa: a da frente/fora (y pra baixo: φ = π a frente, ±π/2 fora), grossa, até o joelho
    casca(coxa, pc.clone().addScaledVector(dCoxa, 0.02), pj.clone().addScaledVector(dCoxa, -0.05), W * 0.27, W * 0.22, matOliva, { ref: lat, phi: [Math.PI - s * 0.5, 3.0], reto: true, lados: 6, bojo: 0.1 });
    nervuras(canela, pj.clone().addScaledVector(dCoxa, -0.04), pj.clone().addScaledVector(dCoxa, 0.03), 2, W * 0.17);
    // a JOELHEIRA: robusta, chanfrada, um pouco acima do joelho
    const jo = esfera(canela, pj.clone().addScaledVector(frente, W * 0.1).addScaledVector(cima, W * 0.03), W * 0.15, matOliva, 6);
    jo.scale.set(1.1, 1.2, 0.8);
    // a CANELA: chanfrada, com o friso aceso de fora
    casca(canela, pj.clone().addScaledVector(dCoxa, 0.06), pp, W * 0.2, W * 0.15, matOliva, { extB: 0.02, reto: true, lados: 7, bojo: 0.12 });
    const gF = new THREE.CylinderGeometry(W * 0.008, W * 0.008, pj.distanceTo(pp) * 0.5, 4); geos.push(gF);
    const fr = new THREE.Mesh(gF, matLuz); fr.position.copy(pj.clone().lerp(pp, 0.45)).addScaledVector(lat, s * W * 0.19).addScaledVector(frente, W * 0.03); fr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pp.clone().sub(pj).normalize()); prender(canela, fr);
    // o TORNOZELO: a faixa BRANCA FURADA em volta (φ = π a frente)
    furada(canela, pj.clone().lerp(pp, 0.84), pp.clone().addScaledVector(dCoxa, 0.02), W * 0.158, Math.PI, 3.6, lat);
    // a BOTA: o cano oliva, o peito do pé e a SOLA grossa de borracha
    if (dedo) {
      const pd = P(dedo), dirPe = pd.clone().sub(pp).projectOnPlane(cima).normalize();
      const chao = pp.clone().addScaledVector(cima, -pp.clone().sub(pd).dot(cima)).addScaledVector(baixo, W * 0.05);
      casca(pe, pp.clone().addScaledVector(dirPe, -W * 0.1), pd.clone().addScaledVector(dirPe, W * 0.05), W * 0.18, W * 0.16, matOliva, { achata: 0.85, ref: lat, lados: 6 });
      casca(dedo, pd, pd.clone().addScaledVector(dirPe, W * 0.24), W * 0.16, W * 0.12, matOliva, { achata: 0.65, ref: lat, lados: 6 });
      // a sola: grossa, embaixo do pé inteiro, do calcanhar à ponta
      casca(pe, chao.clone().addScaledVector(dirPe, -W * 0.16), chao.clone().addScaledVector(dirPe, pd.distanceTo(pp) + W * 0.3), W * 0.15, W * 0.13, matBorracha, { ref: lat, achata: 0.35, lados: 8 });   // (x = lateral: larga; z achatado = fina na vertical)
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
