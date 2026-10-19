/**
 * O TRAJE de combate (as armas de fogo): peças montadas DIRETO nos ossos do esqueleto mixamo do AvatarLuz — o mesmo
 * que toca as animações do rifle (public/anim/rifle). Assim as poses de mira/andar/virar/morrer ficam como foram
 * gravadas e as mãos fecham na arma sem a correção do corpo VRM (que tem braços de outro comprimento).
 *
 * O desenho segue a "armadura extrema" EVA-00 (PUBG × Evangelion), animificada: capacete branco com a CRISTA dourada e
 * a viseira âmbar (o rosto de anime do VRM aparece lá dentro — AvatarVrm `rosto`), gola alta e colete dourados com o X
 * azul-marinho, o SOBRETUDO branco aberto na frente (as abas presas nas coxas: balançam com as pernas), as faixas
 * verde·branca·vermelha nas mangas, antebraços/luvas/calça azul-marinho e os triângulos dourados nas canelas.
 * O traço é de DESENHO (components/cyber/AvatarAnime): cel shading em faixas chapadas, o brilho de borda na cor do
 * jogador e o CONTORNO DE TINTA nas peças fechadas.
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

/** as cores (a EVA-00 do PUBG) */
export const CORES_TRAJE = { branco: 0xf3f4fb, ouro: 0xf2b431, marinho: 0x39406f, escuro: 0x1d2036, verde: 0x2f9a5e, vermelho: 0xd8333d, viseira: 0xffc94d } as const;

const OSSO = (m: THREE.Object3D, n: string) => m.getObjectByName(`mixamorig${n}`) ?? null;

/** o perfil de uma casca torneada ao longo de y (0..len), raio r1 → r2; `redondo` arredonda as pontas (peça fechada) */
function perfil(len: number, r1: number, r2: number, extA: number, extB: number, redondo = true, n = 12): THREE.Vector2[] {
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

  const seg = o.low ? 10 : 18;
  const cor = new THREE.Color(o.cor), C = CORES_TRAJE;
  const matBranco = toon(C.branco, { rim: cor, rimForca: 0.5, brilho: 0.22 });
  const matForro = toon(0xd9dbe8, { brilho: 0 }); matForro.side = THREE.DoubleSide;   // o sobretudo (aberto: os dois lados)
  const matOuro = toon(C.ouro, { rim: new THREE.Color(0xfff1c2), rimForca: 0.45, brilho: 0.5 }); matOuro.side = THREE.DoubleSide;
  const matMarinho = toon(C.marinho, { rim: cor, rimForca: 0.45, brilho: 0.3 });
  const matEscuro = toon(C.escuro, { rim: cor, rimForca: 0.35, brilho: 0.2 });
  const matVerde = toon(C.verde, { brilho: 0 }), matVermelho = toon(C.vermelho, { brilho: 0 });
  for (const m of [matVerde, matVermelho]) m.side = THREE.DoubleSide;
  const matLuz = new THREE.MeshBasicMaterial({ color: cor });
  const matVidro = new THREE.MeshBasicMaterial({ color: C.viseira, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const matReflexo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const matDentro = new THREE.MeshBasicMaterial({ color: 0x07080c, side: THREE.BackSide });
  const matTinta = tintaFixa(W * 0.024);
  const comTinta = new Set<THREE.Material>([matBranco, matMarinho, matEscuro]);
  const mats: THREE.Material[] = [matBranco, matForro, matOuro, matMarinho, matEscuro, matVerde, matVermelho, matLuz, matVidro, matReflexo, matDentro, matTinta];
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
  type OpCasca = { achata?: number; extA?: number; extB?: number; ref?: THREE.Vector3; phi?: [number, number]; reto?: boolean };
  /** uma CASCA de `a` até `b`, presa em `osso`; `phi` = [início, comprimento] só um pedaço da volta (aba, sobretudo) */
  const casca = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, op: OpCasca = {}) => {
    const d = b.clone().sub(a), len = Math.max(0.01, d.length()); d.normalize();
    const g = new THREE.LatheGeometry(perfil(len, r1, r2, op.extA ?? 0, op.extB ?? 0, !op.reto && !op.phi), seg, op.phi?.[0] ?? 0, op.phi?.[1] ?? Math.PI * 2); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.copy(base(d, op.ref ?? lat)); m.scale.set(1, 1, op.achata ?? 1);
    prender(osso, m); return m;
  };
  const esfera = (osso: THREE.Object3D, c: THREE.Vector3, r: number, mat: THREE.Material) => {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); prender(osso, m); return m;
  };
  const anel = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, r: number, tubo: number, mat: THREE.Material = matLuz) => {
    const g = new THREE.TorusGeometry(r, tubo, 6, seg + 4); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); prender(osso, m); return m;
  };
  /** uma placa chata (caixa) no ponto `c`, com o y em `dir` e a face (z) pra `face` */
  const placa = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, face: THREE.Vector3, w: number, h: number, e: number, mat: THREE.Material, giro = 0) => {
    const g = new THREE.BoxGeometry(w, h, e); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c);
    const y = dir.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    m.quaternion.setFromRotationMatrix(mBase.makeBasis(x, y, z)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), giro));
    prender(osso, m); return m;
  };
  /** um TRIÂNGULO chato (a ponta pra baixo) — os da canela */
  const triangulo = (osso: THREE.Object3D, c: THREE.Vector3, face: THREE.Vector3, lado: number, mat: THREE.Material) => {
    const s = new THREE.Shape(); s.moveTo(-lado / 2, lado * 0.35); s.lineTo(lado / 2, lado * 0.35); s.lineTo(0, -lado * 0.5); s.closePath();
    const g = new THREE.ShapeGeometry(s); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c);
    const z = face.clone().normalize(), y = cima.clone().addScaledVector(z, -cima.dot(z)).normalize(), x = new THREE.Vector3().crossVectors(y, z);
    m.quaternion.setFromRotationMatrix(mBase.makeBasis(x, y, z)); prender(osso, m); return m;
  };

  // ── o TRONCO: a calça/cinto, o colete DOURADO com o X marinho, a gola alta e o SOBRETUDO aberto ──
  const esp = OSSO(modelo, "Spine"), esp2 = OSSO(modelo, "Spine2");
  if (esp && esp2) {
    casca(quadril, P(quadril).addScaledVector(cima, -0.07), P(esp), W * 0.43, W * 0.41, matMarinho, { achata: 0.72, extA: 0.04, extB: 0.02 });
    anel(quadril, P(quadril).addScaledVector(cima, 0.02), cima, W * 0.42, W * 0.03, matEscuro);   // o cinto
    // a barriga: marinho com as nervuras (o "acolchoado" da referência)
    casca(esp, P(esp), P(esp2), W * 0.38, W * 0.4, matMarinho, { achata: 0.72 });
    for (const k of [0.25, 0.5, 0.75]) anel(esp, P(esp).lerp(P(esp2), k), cima, W * 0.385, W * 0.012, matEscuro);
    // o COLETE dourado no peito, com o X marinho na frente
    const pe2 = P(esp2), pn = P(pescoco);
    casca(esp2, pe2.clone().addScaledVector(cima, -0.06), pn, W * 0.49, W * 0.42, matOuro, { achata: 0.66, extB: 0.02 });
    const meioPeito = pe2.clone().lerp(pn, 0.45).addScaledVector(frente, W * 0.33);
    for (const s of [-1, 1]) placa(esp2, meioPeito, cima, frente, W * 0.1, W * 0.62, W * 0.03, matMarinho, s * 0.62);
    placa(esp2, pe2.clone().addScaledVector(cima, -0.02).addScaledVector(frente, W * 0.31), lat, frente, W * 0.07, W * 0.5, W * 0.025, matEscuro);   // a faixa embaixo do colete
    // o SOBRETUDO no tronco: aberto na frente (φ de 0,55 a 2π − 0,55), do quadril aos ombros
    casca(esp2, P(quadril).addScaledVector(cima, -0.04), pn.clone().addScaledVector(cima, -0.01), W * 0.5, W * 0.53, matForro, { achata: 0.74, phi: [0.55, Math.PI * 2 - 1.1] });
    // as LAPELAS: as duas abas da gola do casaco, viradas pra fora
    for (const s of [-1, 1]) {
      const c = pn.clone().addScaledVector(cima, -W * 0.18).addScaledVector(frente, W * 0.33).addScaledVector(lat, s * W * 0.22);
      placa(esp2, c, cima, frente.clone().addScaledVector(lat, s * 0.6), W * 0.17, W * 0.42, W * 0.02, matBranco, s * 0.25);
    }
  }
  // a GOLA ALTA dourada (onde o capacete encaixa), um pouco aberta na frente
  casca(pescoco, P(pescoco).addScaledVector(cima, -0.03), P(pescoco).addScaledVector(cima, W * 0.22), W * 0.3, W * 0.27, matOuro, { phi: [0.35, Math.PI * 2 - 0.7], reto: true });

  // ── o CAPACETE: branco com a crista dourada, a viseira âmbar (o rosto aparece) e o queixo marinho ──
  const capacete = new THREE.Group();
  const R = W * 0.46, centro = P(cabeca).addScaledVector(cima, W * 0.24).addScaledVector(frente, W * 0.03);
  capacete.position.copy(centro); capacete.quaternion.copy(base(cima, lat));   // (local: y = cima, z = frente)
  {
    const ab = 0.66, tTopo = 0.3 * Math.PI, tBaixo = 0.72 * Math.PI;   // a abertura: ±ab rad em volta da frente, entre tTopo e tBaixo
    const fr = Math.PI / 2;   // (no SphereGeometry, φ = π/2 é o +z)
    const cascas: [THREE.SphereGeometry, THREE.Material][] = [
      [new THREE.SphereGeometry(R, seg + 8, 12, 0, Math.PI * 2, 0, tTopo), matBranco],
      [new THREE.SphereGeometry(R, seg + 8, 8, fr + ab, Math.PI * 2 - 2 * ab, tTopo, tBaixo - tTopo), matBranco],
      [new THREE.SphereGeometry(R, seg + 8, 6, 0, Math.PI * 2, tBaixo, Math.PI * 0.86 - tBaixo), matMarinho],   // o queixo/máscara de baixo
    ];
    for (const [g, m] of cascas) { geos.push(g); capacete.add(new THREE.Mesh(g, m)); }
    const gD = new THREE.SphereGeometry(R * 0.985, seg + 4, 12, 0, Math.PI * 2, 0, Math.PI * 0.86); geos.push(gD); capacete.add(new THREE.Mesh(gD, matDentro));
    const gV = new THREE.SphereGeometry(R * 1.012, seg + 4, 8, fr - ab - 0.06, 2 * ab + 0.12, tTopo - 0.06, tBaixo - tTopo + 0.12); geos.push(gV);
    const viseira = new THREE.Mesh(gV, matVidro); viseira.renderOrder = 2; capacete.add(viseira);
    // os REFLEXOS do vidro, como se desenha: duas faixas brancas no canto de cima
    for (const [dphi, larg, ini, comp] of [[0.4, 0.13, 0.34, 0.2], [0.18, 0.05, 0.36, 0.14]] as const) {
      const gr = new THREE.SphereGeometry(R * 1.02, 6, 4, fr + dphi, larg, Math.PI * ini, Math.PI * comp); geos.push(gr);
      const rf = new THREE.Mesh(gr, matReflexo); rf.rotation.z = -0.35; rf.renderOrder = 3; capacete.add(rf);
    }
    // a CRISTA dourada: uma faixa da testa até a nuca, por cima
    // (o arco nasce no +x e gira no plano xy: o giro em z o começa acima da viseira; o Ry(−π/2) leva o +x pra frente)
    const gC = new THREE.TorusGeometry(R * 1.015, W * 0.05, 6, 24, Math.PI * 0.82); geos.push(gC);
    const crista = new THREE.Mesh(gC, matOuro); crista.rotation.set(0, -Math.PI / 2, Math.PI / 2 - tTopo + 0.12); crista.scale.set(1, 1, 0.6); capacete.add(crista);
    // a moldura da viseira (ouro em cima) e as "orelhas" com a luz do jogador
    const gF = new THREE.TorusGeometry(R * 1.025, W * 0.018, 4, 20, 2 * ab + 0.12); geos.push(gF);
    const friso = new THREE.Mesh(gF, matOuro); friso.rotation.set(Math.PI / 2, 0, -(fr + ab + 0.06) + Math.PI); friso.position.y = Math.cos(tTopo - 0.06) * R * 1.02; friso.scale.setScalar(Math.sin(tTopo - 0.06)); capacete.add(friso);
    for (const s of [-1, 1]) {
      const gl = new THREE.CylinderGeometry(W * 0.07, W * 0.07, W * 0.07, 14); geos.push(gl); const l = new THREE.Mesh(gl, matBranco); l.rotation.z = Math.PI / 2; l.position.set(s * R * 0.96, -R * 0.05, -R * 0.08); capacete.add(l);
      const gl2 = new THREE.CircleGeometry(W * 0.04, 14); geos.push(gl2); const l2 = new THREE.Mesh(gl2, matLuz); l2.rotation.y = s * Math.PI / 2; l2.position.set(s * (R * 0.96 + W * 0.036), -R * 0.05, -R * 0.08); capacete.add(l2);
    }
  }
  prender(cabeca, capacete);
  const escCapacete = capacete.scale.clone();   // (o `attach` compensou a escala do osso: o ajuste multiplica esta)
  // onde os OLHOS do rosto ficam: um pouco à frente do centro do capacete, na altura da viseira
  const ancoraRosto = new THREE.Object3D(); ancoraRosto.position.set(0, R * 0.05, R * 0.3); capacete.add(ancoraRosto);

  // ── os BRAÇOS: a manga branca do sobretudo (com as faixas), o antebraço marinho com nervuras, a luva ──
  for (const L of ["Left", "Right"] as const) {
    const braco = OSSO(modelo, `${L}Arm`), ante = OSSO(modelo, `${L}ForeArm`), mao = OSSO(modelo, `${L}Hand`);
    if (!braco || !ante || !mao) continue;
    const pb = P(braco), pa = P(ante), pm = P(mao), dBraco = pa.clone().sub(pb).normalize(), dAnte = pm.clone().sub(pa).normalize();
    // o ombro do casaco: uma calota branca, larga
    const ombro = esfera(braco, pb.clone().addScaledVector(cima, W * 0.02), W * 0.2, matBranco); ombro.scale.set(1.1, 0.78, 1);
    casca(braco, pb, pa, W * 0.19, W * 0.165, matBranco, { extA: 0.02, ref: frente });
    // as FAIXAS verde · branca · vermelha (o emblema da manga), por fora do braço
    for (const [k, mt] of [[0.2, matVerde], [0.32, matVermelho]] as const) {
      const a = pb.clone().addScaledVector(dBraco, pb.distanceTo(pa) * k);
      casca(braco, a, a.clone().addScaledVector(dBraco, W * 0.07), W * 0.197, W * 0.195, mt, { ref: frente, phi: [0, Math.PI * 2], reto: true });
    }
    // o punho da manga, dobrado, no cotovelo
    anel(ante, pa.clone().addScaledVector(dAnte, 0.01), dAnte, W * 0.16, W * 0.045, matBranco);
    casca(ante, pa, pm, W * 0.145, W * 0.13, matMarinho, { extB: 0.01, ref: frente });
    for (const k of [0.35, 0.55, 0.75]) anel(ante, pa.clone().lerp(pm, k), dAnte, W * 0.143 - k * W * 0.012, W * 0.011, matEscuro);
    anel(mao, pm.clone().addScaledVector(dAnte, -0.012), dAnte, W * 0.13, W * 0.022, matOuro);   // a braçadeira dourada
    // a luva: a palma até a base do dedo médio (com o nó dourado) e cada falange
    const med = OSSO(modelo, `${L}HandMiddle1`), ind = OSSO(modelo, `${L}HandIndex1`), mind = OSSO(modelo, `${L}HandPinky1`);
    if (med) {
      const ladoMao = ind && mind ? P(ind).sub(P(mind)).normalize() : lat;
      casca(mao, pm, P(med), W * 0.1, W * 0.1, matEscuro, { achata: 0.48, extA: 0.01, extB: 0.012, ref: ladoMao });
      const costas = new THREE.Vector3().crossVectors(P(med).sub(pm).normalize(), ladoMao).normalize().multiplyScalar(L === "Left" ? 1 : -1);
      placa(mao, pm.clone().lerp(P(med), 0.75).addScaledVector(costas, W * 0.05), P(med).sub(pm), costas, W * 0.16, W * 0.06, W * 0.03, matOuro);
    }
    for (const d of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      for (let k = 1; k <= 3; k++) {
        const f = OSSO(modelo, `${L}Hand${d}${k}`); if (!f) continue;
        const prox = OSSO(modelo, `${L}Hand${d}${k + 1}`), pf = P(f);
        const fim = prox ? P(prox) : pf.clone().add(pf.clone().sub(P(f.parent!)).normalize().multiplyScalar(0.022));
        casca(f, pf, fim, W * (d === "Thumb" ? 0.042 : 0.036), W * 0.032, matEscuro, { extA: 0.004, extB: 0.006 });
      }
    }
  }
  // ── as PERNAS: calça marinho, joelheira, canela com o triângulo dourado, bota; e as ABAS do sobretudo ──
  let compCoxa = 0.45;
  for (const L of ["Left", "Right"] as const) {
    const coxa = OSSO(modelo, `${L}UpLeg`), canela = OSSO(modelo, `${L}Leg`), pe = OSSO(modelo, `${L}Foot`), dedo = OSSO(modelo, `${L}ToeBase`);
    if (!coxa || !canela || !pe) continue;
    const pc = P(coxa), pj = P(canela), pp = P(pe), s = L === "Left" ? 1 : -1; compCoxa = pc.distanceTo(pj);
    casca(coxa, pc, pj, W * 0.23, W * 0.18, matMarinho, { extA: 0.03 });
    const joelho = esfera(canela, pj.clone().addScaledVector(frente, W * 0.06), W * 0.14, matMarinho); joelho.scale.set(1, 1.1, 0.8);
    casca(canela, pj, pp, W * 0.165, W * 0.14, matMarinho, { extB: 0.02 });
    placa(canela, pj.clone().lerp(pp, 0.4).addScaledVector(frente, W * 0.13), pp.clone().sub(pj), frente, W * 0.16, pj.distanceTo(pp) * 0.7, W * 0.04, matEscuro);   // a caneleira
    triangulo(canela, pj.clone().lerp(pp, 0.62).addScaledVector(frente, W * 0.155), frente, W * 0.13, matOuro);
    if (dedo) {
      const pd = P(dedo);
      casca(pe, pp.clone().addScaledVector(pd.clone().sub(pp), -0.25), pd, W * 0.17, W * 0.15, matEscuro, { achata: 0.85, ref: lat });
      const ponta = pd.clone().add(pd.clone().sub(pp).projectOnPlane(cima).normalize().multiplyScalar(W * 0.3));
      casca(dedo, pd, ponta, W * 0.14, W * 0.1, matEscuro, { achata: 0.62, extB: 0.01, ref: lat });
    }
    // a ABA do sobretudo nesta perna: da cintura até abaixo do joelho, por fora e atrás (φ = 0 são as costas aqui);
    // presa na coxa — vai com a perna, como o casaco abre andando
    const centroAba = s * (Math.PI / 2 - 0.45);
    casca(coxa, pc.clone().addScaledVector(cima, 0.08), pc.clone().addScaledVector(baixo, compCoxa * 1.35), W * 0.33, W * 0.46, matForro, { ref: lat, phi: [centroAba - 1.45, 2.9] });
  }
  // a ABA de trás do sobretudo (entre as pernas, presa no quadril)
  casca(quadril, P(quadril).addScaledVector(cima, 0.06), P(quadril).addScaledVector(baixo, compCoxa * 1.35), W * 0.44, W * 0.6, matForro, { ref: lat, phi: [-0.55, 1.1] });

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
