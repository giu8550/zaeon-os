/**
 * A ARMADURA de combate (as armas de fogo): peças montadas DIRETO nos ossos do esqueleto mixamo do AvatarLuz — o
 * mesmo que toca as animações do rifle (public/anim/rifle). Assim as poses de mira/andar/virar/morrer ficam como foram
 * gravadas e as mãos fecham na arma sem a correção do corpo VRM (que tem braços de outro comprimento).
 *
 * O desenho: um CAVALEIRO SAGRADO tecnológico e meio ALIENÍGENA (a folha "ホーリーナイト" do dono, sem a capa) — placas
 * brancas com BORDA DOURADA, estufadas como casco (o `bojo`), tudo redondo e pontudo, NADA quadrado: o capacete com a
 * COROA de espinhos curvos e a crista, as OMBREIRAS em cúpulas com a coroa de espinhos e um olho de luz, o NÚCLEO de luz
 * no peito com os fios acesos em V, os ESPINHOS DORSAIS, as lâminas da barriga, a saia e as coxas terminando em GARRAS
 * douradas, espinhos nos antebraços, manoplas com o punho de pontas, joelheiras com aleta e espinho, grevas e botas de
 * BICO com espora. O "tecnológico": os fios, o núcleo e os olhos acesos na cor do jogador. O rosto de anime do VRM
 * aparece atrás da viseira (AvatarVrm `rosto`). Sem a mochila do jato (AvatarLuz `traje`).
 * O traço é de DESENHO (components/cyber/AvatarAnime): cel shading em faixas, o brilho de borda e o CONTORNO DE TINTA.
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

export const CORES_TRAJE = { branco: 0xf5f3ec, ouro: 0xe2b443, malha: 0x272a3f, viseira: 0xa9e4ff } as const;

const OSSO = (m: THREE.Object3D, n: string) => m.getObjectByName(`mixamorig${n}`) ?? null;

/** as FORMAS das placas recortadas (unidades: o tamanho da peça; `c` = o centro, por onde a borda dourada cresce).
 *  Só curvas: m = vai, q = curva (controle, ponto) */
type Cmd = ["m", number, number] | ["q", number, number, number, number];
const FORMAS: Record<"asa" | "chifre" | "dente" | "folha" | "gota" | "garra" | "espinho", { c: [number, number]; d: Cmd[] }> = {
  // a GARRA (a ponta pra baixo, curva como unha): a barra da saia e das coxas
  garra: { c: [0, -0.3], d: [["m", -0.45, 0], ["q", 0, 0.1, 0.45, 0], ["q", 0.32, -0.55, -0.18, -1], ["q", -0.08, -0.45, -0.45, 0]] },
  // o ESPINHO (base larga, curvo pro −x): coroas, costas, antebraços, joelhos
  espinho: { c: [0, 0.3], d: [["m", -0.24, 0], ["q", 0, -0.04, 0.24, 0], ["q", 0.14, 0.55, -0.3, 1], ["q", -0.06, 0.42, -0.24, 0]] },
  // a ASA da ombreira: larga na base, a ponta em cima e pra fora
  asa: { c: [0.45, 0.35], d: [["m", 0, 0], ["q", 0.75, 0.02, 1.1, 0.95], ["q", 0.62, 0.5, 0.05, 0.42], ["q", -0.08, 0.2, 0, 0]] },
  // o CHIFRE do capacete: alto, fino, levemente curvo pra trás
  chifre: { c: [0, 0.35], d: [["m", -0.06, 0], ["q", 0, -0.015, 0.06, 0], ["q", 0.05, 0.6, -0.08, 1], ["q", -0.04, 0.5, -0.06, 0]] },
  // o DENTE (a ponta pra baixo): a barra da saia, o punho da manopla
  dente: { c: [0, -0.35], d: [["m", -0.5, 0], ["q", 0, 0.1, 0.5, 0], ["q", 0.14, -0.42, 0, -1], ["q", -0.14, -0.42, -0.5, 0]] },
  // a FOLHA (aleta): cotoveleira, joelheira, crista
  folha: { c: [0.4, 0.4], d: [["m", 0, 0], ["q", 0.68, 0.12, 0.95, 0.95], ["q", 0.42, 0.72, 0, 0.5], ["q", -0.06, 0.25, 0, 0]] },
  // a GOTA (emblema, costas da mão): oval com a ponta embaixo
  gota: { c: [0, 0], d: [["m", 0, 0.5], ["q", 0.5, 0.45, 0.42, 0], ["q", 0.3, -0.4, 0, -0.62], ["q", -0.3, -0.4, -0.42, 0], ["q", -0.5, 0.45, 0, 0.5]] },
};
function forma(nome: keyof typeof FORMAS, tam: number, k = 1): THREE.Shape {
  const f = FORMAS[nome], s = new THREE.Shape(), T = (x: number, y: number): [number, number] => [((x - f.c[0]) * k + f.c[0]) * tam, ((y - f.c[1]) * k + f.c[1]) * tam];
  for (const c of f.d) {
    if (c[0] === "m") s.moveTo(...T(c[1], c[2]));
    else { const [a, b] = T(c[1], c[2]), [x, y] = T(c[3], c[4]); s.quadraticCurveTo(a, b, x, y); }
  }
  return s;
}

/** o perfil de uma casca torneada ao longo de y (0..len), raio r1 → r2; `redondo` arredonda as pontas (peça fechada);
 *  `bojo` estufa o meio (as placas ficam orgânicas, de casco — não tubos) */
function perfil(len: number, r1: number, r2: number, extA: number, extB: number, redondo = true, n = 12, bojo = 0): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [], tot = len + extA + extB, e = 0.22;
  for (let i = 0; i <= n; i++) {
    const u = i / n, y = -extA + u * tot, k = redondo ? Math.min(1, u / e, (1 - u) / e) : 1;
    const r = (r1 + (r2 - r1) * u) * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k))) * (1 + bojo * Math.sin(Math.PI * u));   // (o BOJO: a placa estufa no meio — orgânica)
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
  const baixo = cima.clone().negate(), tras = frente.clone().negate();

  const seg = o.low ? 12 : 22;
  const cor = new THREE.Color(o.cor), C = CORES_TRAJE;
  const matBranco = toon(C.branco, { rim: cor, rimForca: 0.45, brilho: 0.4 }); matBranco.side = THREE.DoubleSide;
  matBranco.color.multiplyScalar(1.55);   // (a placa BRANCA de desenho: a faixa de sombra fica cinza-clara, não chumbo — a luz satura no branco)
  const matOuro = toon(C.ouro, { rim: new THREE.Color(0xfff0c0), rimForca: 0.4, brilho: 0.55 }); matOuro.side = THREE.DoubleSide;
  const matMalha = toon(C.malha, { rim: cor, rimForca: 0.35, brilho: 0.1 });
  const matLuz = new THREE.MeshBasicMaterial({ color: cor });
  const matVidro = new THREE.MeshBasicMaterial({ color: C.viseira, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const matReflexo = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
  const matDentro = new THREE.MeshBasicMaterial({ color: 0x07080c, side: THREE.BackSide });
  const matTinta = tintaFixa(W * 0.02);
  const comTinta = new Set<THREE.Material>([matBranco, matOuro, matMalha]);
  const mats: THREE.Material[] = [matBranco, matOuro, matMalha, matLuz, matVidro, matReflexo, matDentro, matTinta];
  const geos: THREE.BufferGeometry[] = [], pecas: THREE.Object3D[] = [];

  const mBase = new THREE.Matrix4(), xA = new THREE.Vector3(), zA = new THREE.Vector3();
  /** a base (mundo) de uma peça: y = `dir`, x = o `ref` (lateral do corpo) projetado, z = x × y. No lathe, φ = 0 é o +z
   *  e φ = π/2 o +x (a esquerda do corpo): no tronco (y pra cima) φ = 0 é a FRENTE; nas pernas (y pra baixo), as COSTAS */
  const base = (dir: THREE.Vector3, ref: THREE.Vector3) => {
    xA.copy(ref).addScaledVector(dir, -ref.dot(dir)); if (xA.lengthSq() < 1e-6) xA.copy(frente).addScaledVector(dir, -frente.dot(dir)); xA.normalize();
    zA.crossVectors(xA, dir).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(mBase.makeBasis(xA, dir, zA));
  };
  const comTintaEm = (m: THREE.Object3D) => {
    const tintas: [THREE.Mesh, THREE.Mesh][] = [];
    m.traverse((x) => { const k = x as THREE.Mesh; if (k.isMesh && comTinta.has(k.material as THREE.Material)) tintas.push([k, new THREE.Mesh(k.geometry, matTinta)]); });
    for (const [k, t] of tintas) k.add(t);
  };
  const prender = (osso: THREE.Object3D, m: THREE.Object3D) => {
    comTintaEm(m);   // o CONTORNO DE TINTA: a mesma geometria, inflada, só as faces de trás (filha da peça)
    osso.attach(m); mostrarCaminho(m); pecas.push(m); m.traverse((x) => { x.frustumCulled = false; });
  };
  type OpCasca = { achata?: number; extA?: number; extB?: number; ref?: THREE.Vector3; phi?: [number, number]; reto?: boolean; lados?: number; bojo?: number };
  /** uma CASCA de `a` até `b`, presa em `osso`; `phi` = [centro, largura] só um pedaço da volta (as placas abertas) */
  const casca = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r1: number, r2: number, mat: THREE.Material, op: OpCasca = {}) => {
    const d = b.clone().sub(a), len = Math.max(0.01, d.length()); d.normalize();
    const ph = op.phi;
    const g = new THREE.LatheGeometry(perfil(len, r1, r2, op.extA ?? 0, op.extB ?? 0, !op.reto && !ph, 12, op.bojo ?? (mat === matBranco ? 0.12 : 0.05)), op.lados ?? seg, ph ? ph[0] - ph[1] / 2 : 0, ph ? ph[1] : Math.PI * 2); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a); m.quaternion.copy(base(d, op.ref ?? lat)); m.scale.set(1, 1, op.achata ?? 1);
    prender(osso, m); return m;
  };
  /** LÂMINAS sobrepostas de `a` a `b`, cada uma com um friso dourado na barra */
  const laminas = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, n: number, r1: number, r2: number, op: OpCasca = {}) => {
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = Math.min(1.05, (i + 1.2) / n), ra = r1 + (r2 - r1) * u0, rb = r1 + (r2 - r1) * Math.min(1, u1);
      casca(osso, a.clone().lerp(b, u0), a.clone().lerp(b, u1), ra * 1.03, rb, matBranco, { ...op, reto: true });
      casca(osso, a.clone().lerp(b, u1 - 0.06), a.clone().lerp(b, u1), rb * 1.01, rb * 1.02, matOuro, { ...op, reto: true });
    }
  };
  const esfera = (osso: THREE.Object3D, c: THREE.Vector3, r: number, mat: THREE.Material) => {
    const g = new THREE.SphereGeometry(r, seg, Math.round(seg / 2)); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); prender(osso, m); return m;
  };
  /** uma CÚPULA (calota de esfera) com o topo em `eixo`, a barra dourada na borda; `esc` achata/estica (no referencial
   *  da cúpula: x, y = o eixo, z) */
  const cupula = (osso: THREE.Object3D, c: THREE.Vector3, eixo: THREE.Vector3, ref: THREE.Vector3, r: number, abre: number, esc: [number, number, number]) => {
    const grp = new THREE.Group(), g = new THREE.SphereGeometry(r, seg, Math.round(seg / 2), 0, Math.PI * 2, 0, abre); geos.push(g);
    grp.add(new THREE.Mesh(g, matBranco));
    const gt = new THREE.TorusGeometry(r * Math.sin(abre), W * 0.022, 8, seg + 6); geos.push(gt);
    const borda = new THREE.Mesh(gt, matOuro); borda.rotation.x = Math.PI / 2; borda.position.y = r * Math.cos(abre); grp.add(borda);
    grp.scale.set(...esc); grp.quaternion.copy(base(eixo.clone().normalize(), ref)); grp.position.copy(c);
    prender(osso, grp); return grp;
  };
  const anel = (osso: THREE.Object3D, c: THREE.Vector3, dir: THREE.Vector3, r: number, tubo: number, mat: THREE.Material = matLuz) => {
    const g = new THREE.TorusGeometry(r, tubo, 8, seg + 6); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()); prender(osso, m); return m;
  };
  /** um FIO (a costura acesa entre placas): um cilindro fino e redondo de `a` a `b` */
  const fio = (osso: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material = matLuz, r = W * 0.008) => {
    const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 8); geos.push(g);
    const m = new THREE.Mesh(g, mat); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); prender(osso, m); return m;
  };
  /** uma PLACA RECORTADA (asa, chifre, dente, folha, gota): a forma extrudada com as bordas arredondadas, BRANCA, com a
   *  mesma forma maior e DOURADA atrás (a borda de ouro). `x` = pra onde vai o eixo x da forma, `y` = o eixo y; a face
   *  é x × y. Sem osso: devolve a peça (pra montar dentro de outra) */
  const recorte = (nome: keyof typeof FORMAS, tam: number, c: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, op: { osso?: THREE.Object3D; mat?: THREE.Material; borda?: boolean; esp?: number } = {}) => {
    const esp = op.esp ?? W * 0.035, g = new THREE.Group();
    const ext = (k: number, e: number) => { const ge = new THREE.ExtrudeGeometry(forma(nome, tam, k), { depth: e, bevelEnabled: true, bevelThickness: e * 0.5, bevelSize: Math.min(tam * 0.04, e * 0.6), bevelSegments: 2, curveSegments: 10 }); ge.translate(0, 0, -e / 2); geos.push(ge); return ge; };
    g.add(new THREE.Mesh(ext(1, esp), op.mat ?? matBranco));
    if (op.borda !== false) { const b = new THREE.Mesh(ext(1.14, esp * 0.7), matOuro); b.position.z = -esp * 0.55; g.add(b); }
    const xx = x.clone().normalize(), yy = y.clone().addScaledVector(xx, -y.dot(xx)).normalize(), zz = new THREE.Vector3().crossVectors(xx, yy);
    g.quaternion.setFromRotationMatrix(mBase.makeBasis(xx, yy, zz)); g.position.copy(c);
    if (op.osso) prender(op.osso, g);
    return g;
  };

  // ── o TRONCO ──
  const esp = OSSO(modelo, "Spine"), esp1 = OSSO(modelo, "Spine1"), esp2 = OSSO(modelo, "Spine2");
  let compCoxa = 0.45;
  { const c = OSSO(modelo, "LeftUpLeg"), j = OSSO(modelo, "LeftLeg"); if (c && j) compCoxa = P(c).distanceTo(P(j)); }
  if (esp && esp1 && esp2) {
    const pq = P(quadril), ps = P(esp), ps1 = P(esp1), pn = P(pescoco);
    casca(quadril, pq.clone().addScaledVector(cima, -0.08), ps, W * 0.41, W * 0.37, matMalha, { achata: 0.72, extA: 0.04 });
    casca(esp, ps, P(esp2), W * 0.32, W * 0.34, matMalha, { achata: 0.7 });   // (por dentro das lâminas: não vaza)
    // o PEITORAL: largo em cima, estreito na cintura
    casca(esp2, ps1.clone().addScaledVector(cima, -0.03), pn.clone().addScaledVector(cima, -0.02), W * 0.38, W * 0.52, matBranco, { achata: 0.7, extB: 0.03 });
    // o friso dourado do decote e a GOTA dourada no esterno, com os fios acesos abrindo em V
    anel(esp2, pn.clone().addScaledVector(cima, -0.03), cima, W * 0.33, W * 0.03, matOuro);
    const est = ps1.clone().lerp(pn, 0.62).addScaledVector(frente, W * 0.355);
    // o NÚCLEO: uma esfera de luz no esterno, num engaste dourado
    esfera(esp2, est.clone().addScaledVector(frente, W * 0.01), W * 0.055, matLuz);
    anel(esp2, est, frente.clone().addScaledVector(cima, 0.3), W * 0.075, W * 0.018, matOuro);
    // os ESPINHOS DORSAIS: uma fileira descendo as costas, curvos pra cima
    for (const [osso, p, tam] of [[esp2, P(esp2).lerp(pn, 0.4), 0.3], [esp1, ps1, 0.25], [esp, ps, 0.2]] as const) recorte("espinho", W * tam, p.clone().addScaledVector(tras, W * 0.3), baixo, tras.clone().addScaledVector(cima, 0.55), { osso, esp: W * 0.03 });
    for (const s of [-1, 1]) {
      fio(esp2, est.clone().addScaledVector(cima, -W * 0.1), ps1.clone().lerp(pn, 0.2).addScaledVector(lat, s * W * 0.27).addScaledVector(frente, W * 0.29));
      fio(esp2, est.clone().addScaledVector(lat, s * W * 0.1), ps1.clone().lerp(pn, 0.85).addScaledVector(lat, s * W * 0.36).addScaledVector(frente, W * 0.24));
    }
    // a BARRIGA: 3 lâminas com a barra dourada
    laminas(esp1, ps.clone().addScaledVector(cima, -0.02), ps1.clone().addScaledVector(cima, 0.03), 3, W * 0.37, W * 0.39, { achata: 0.7 });
    // a GOLA alta, com o friso aceso
    casca(pescoco, pn.clone().addScaledVector(cima, -0.03), pn.clone().addScaledVector(cima, W * 0.15), W * 0.32, W * 0.28, matBranco, { reto: true });
    anel(pescoco, pn.clone().addScaledVector(cima, W * 0.15), cima, W * 0.28, W * 0.022, matOuro);
    anel(pescoco, pn.clone().addScaledVector(cima, W * 0.06), cima, W * 0.315, W * 0.01);
    // a SAIA de placas (no quadril — y pra baixo: φ = π é a frente, 0 as costas) e os DENTES dourados na barra
    const barra = compCoxa * 0.5;
    casca(quadril, pq.clone().addScaledVector(cima, 0.04), pq.clone().addScaledVector(baixo, barra), W * 0.43, W * 0.47, matBranco, { ref: lat, phi: [Math.PI, 1.3] });
    casca(quadril, pq.clone().addScaledVector(cima, 0.04), pq.clone().addScaledVector(baixo, barra * 0.85), W * 0.43, W * 0.48, matBranco, { ref: lat, phi: [0, 1.6] });
    anel(quadril, pq.clone().addScaledVector(cima, 0.04), cima, W * 0.43, W * 0.025, matOuro);   // o cinto
    for (const [centro, larg, alt] of [[Math.PI, 1.3, barra], [0, 1.6, barra * 0.85]] as const) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const ph = centro - larg / 2 + (larg * (i + 0.5)) / n, r = W * 0.475;
        const radial = tras.clone().multiplyScalar(Math.cos(ph)).addScaledVector(lat, Math.sin(ph));   // (o φ do lathe → o mundo)
        const tang = new THREE.Vector3().crossVectors(baixo, radial).normalize();
        recorte("garra", W * 0.17, pq.clone().addScaledVector(baixo, alt - W * 0.01).addScaledVector(radial, r), tang, cima.clone().addScaledVector(radial, -0.15), { osso: quadril, mat: matOuro, borda: false, esp: W * 0.02 });
      }
    }
  }

  // ── o CAPACETE: branco, a viseira de vidro (o rosto aparece), a COROA de espinhos e a crista ──
  const capacete = new THREE.Group();
  const R = W * 0.46, centro = P(cabeca).addScaledVector(cima, W * 0.24).addScaledVector(frente, W * 0.03);
  capacete.position.copy(centro); capacete.quaternion.copy(base(cima, lat));   // (local: y = cima, z = frente, x = a esquerda)
  {
    const ab = 0.64, tTopo = 0.3 * Math.PI, tBaixo = 0.72 * Math.PI;
    const fr = Math.PI / 2;   // (no SphereGeometry, φ = π/2 é o +z)
    const cascas: [THREE.SphereGeometry, THREE.Material][] = [
      [new THREE.SphereGeometry(R, seg + 6, 12, 0, Math.PI * 2, 0, tTopo), matBranco],
      [new THREE.SphereGeometry(R, seg + 6, 8, fr + ab, Math.PI * 2 - 2 * ab, tTopo, tBaixo - tTopo), matBranco],
      [new THREE.SphereGeometry(R, seg + 6, 6, 0, Math.PI * 2, tBaixo, Math.PI * 0.86 - tBaixo), matOuro],   // o queixo dourado
    ];
    for (const [g, m] of cascas) { geos.push(g); capacete.add(new THREE.Mesh(g, m)); }
    const gD = new THREE.SphereGeometry(R * 0.985, seg, 12, 0, Math.PI * 2, 0, Math.PI * 0.86); geos.push(gD); capacete.add(new THREE.Mesh(gD, matDentro));
    const gV = new THREE.SphereGeometry(R * 1.012, seg, 8, fr - ab - 0.06, 2 * ab + 0.12, tTopo - 0.06, tBaixo - tTopo + 0.12); geos.push(gV);
    const viseira = new THREE.Mesh(gV, matVidro); viseira.renderOrder = 2; capacete.add(viseira);
    for (const [dphi, larg, ini, comp] of [[0.4, 0.13, 0.34, 0.2], [0.18, 0.05, 0.36, 0.14]] as const) {
      const gr = new THREE.SphereGeometry(R * 1.02, 6, 4, fr + dphi, larg, Math.PI * ini, Math.PI * comp); geos.push(gr);
      const rf = new THREE.Mesh(gr, matReflexo); rf.rotation.z = -0.35; rf.renderOrder = 3; capacete.add(rf);
    }
    // a moldura dourada da viseira
    const gF = new THREE.TorusGeometry(R * 1.025, W * 0.022, 8, 24, 2 * ab + 0.12); geos.push(gF);
    const friso = new THREE.Mesh(gF, matOuro); friso.rotation.set(Math.PI / 2, 0, -(fr + ab + 0.06) + Math.PI); friso.position.y = Math.cos(tTopo - 0.06) * R * 1.02; friso.scale.setScalar(Math.sin(tTopo - 0.06)); capacete.add(friso);
    // a CRISTA: uma aleta curva da testa à nuca
    capacete.add(recorte("folha", R * 1.25, new THREE.Vector3(0, R * 0.78, R * 0.15), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0.15), { esp: W * 0.03 }));
        // a COROA: cinco espinhos curvos pra trás (o do meio maior), saindo do alto da nuca
    for (const [x, tam] of [[-0.62, 0.7], [-0.32, 0.95], [0, 1.15], [0.32, 0.95], [0.62, 0.7]] as const) {
      capacete.add(recorte("espinho", R * tam, new THREE.Vector3(x * R, R * (0.78 - Math.abs(x) * 0.3), -R * 0.45), new THREE.Vector3(0, 0, 1), new THREE.Vector3(x * 0.5, 1, -0.75), { esp: W * 0.028 }));
    }
    // as "orelhas": um disco dourado com a luz no meio
    for (const s of [-1, 1]) {
      const gl = new THREE.CylinderGeometry(W * 0.075, W * 0.075, W * 0.05, seg); geos.push(gl); const l = new THREE.Mesh(gl, matOuro); l.rotation.z = Math.PI / 2; l.position.set(s * R * 0.97, -R * 0.08, -R * 0.06); capacete.add(l);
      const gl2 = new THREE.CircleGeometry(W * 0.038, seg); geos.push(gl2); const l2 = new THREE.Mesh(gl2, matLuz); l2.rotation.y = s * Math.PI / 2; l2.position.set(s * (R * 0.97 + W * 0.026), -R * 0.08, -R * 0.06); capacete.add(l2);
    }
  }
  prender(cabeca, capacete);
  const escCapacete = capacete.scale.clone();   // (o `attach` compensou a escala do osso: o ajuste multiplica esta)
  const ancoraRosto = new THREE.Object3D(); ancoraRosto.position.set(0, R * 0.05, R * 0.3); capacete.add(ancoraRosto);

  // ── os BRAÇOS: a OMBREIRA em asas, as lâminas, a cotoveleira em leque, a braçadeira, a manopla com o punho de pontas ──
  for (const L of ["Left", "Right"] as const) {
    const braco = OSSO(modelo, `${L}Arm`), ante = OSSO(modelo, `${L}ForeArm`), mao = OSSO(modelo, `${L}Hand`);
    if (!braco || !ante || !mao) continue;
    const s = L === "Left" ? 1 : -1;
    const pb = P(braco), pa = P(ante), pm = P(mao), dBraco = pa.clone().sub(pb).normalize(), dAnte = pm.clone().sub(pa).normalize();
    const fora = lat.clone().multiplyScalar(s), clav = OSSO(modelo, `${L}Shoulder`) ?? braco;
    casca(braco, pb, pa, W * 0.14, W * 0.125, matMalha, { extA: 0.02, ref: frente });
    // a OMBREIRA (no osso do OMBRO: com o braço baixo, ela fica): duas CÚPULAS sobrepostas, redondas, com a barra
    // dourada; a COROA de espinhos curvos saindo pra cima e pra fora e um olho de luz na lateral
    const pOmbro = pb.clone().addScaledVector(cima, -W * 0.01).addScaledVector(fora, W * 0.06);
    const eixo1 = cima.clone().addScaledVector(fora, 0.45).normalize(), eixo2 = cima.clone().addScaledVector(fora, 1.1).normalize();
    cupula(clav, pOmbro, eixo1, frente, W * 0.24, Math.PI * 0.5, [1.05, 0.7, 1.1]);
    cupula(clav, pOmbro.clone().addScaledVector(fora, W * 0.12).addScaledVector(cima, -W * 0.08), eixo2, frente, W * 0.2, Math.PI * 0.5, [1, 0.7, 1.05]);
    for (const [k, tam] of [[-1, 0.24], [0, 0.34], [1, 0.24]] as const) {
      const c = pOmbro.clone().addScaledVector(eixo1, W * 0.14).addScaledVector(fora, W * 0.12).addScaledVector(frente, k * W * 0.11);
      recorte("espinho", W * tam, c, frente.clone().multiplyScalar(-1).addScaledVector(fora, 0.2), eixo1.clone().addScaledVector(fora, 0.5).addScaledVector(frente, k * 0.35), { osso: clav, esp: W * 0.035 });
    }
    esfera(clav, pOmbro.clone().addScaledVector(fora, W * 0.3).addScaledVector(cima, -W * 0.06), W * 0.03, matLuz);
    // as lâminas do braço (por cima/fora: no braço, φ = 0 é pra cima do lado esquerdo e pra baixo do direito)
    laminas(braco, pb.clone().addScaledVector(dBraco, W * 0.22), pb.clone().lerp(pa, 0.7), 2, W * 0.18, W * 0.17, { ref: frente, phi: [s > 0 ? 0 : Math.PI, 3.4] });
    anel(braco, pb.clone().lerp(pa, 0.78), dBraco, W * 0.15, W * 0.012);
    // a COTOVELEIRA: a cúpula e a FOLHA em leque pra trás
    esfera(ante, pa, W * 0.13, matBranco);
    recorte("folha", W * 0.32, pa.clone().addScaledVector(tras, W * 0.08), tras, dBraco.clone().negate(), { osso: ante, esp: W * 0.03 });
    // a BRAÇADEIRA: abre no cotovelo, fecha no pulso, com o fio aceso por cima
    casca(ante, pa.clone().addScaledVector(dAnte, 0.02), pm, W * 0.16, W * 0.125, matBranco, { extB: 0.015, ref: frente });
    fio(ante, pa.clone().lerp(pm, 0.25).addScaledVector(frente, W * 0.155), pa.clone().lerp(pm, 0.92).addScaledVector(frente, W * 0.125));
    anel(ante, pa.clone().lerp(pm, 0.2), dAnte, W * 0.158, W * 0.016, matOuro);
    // os ESPINHOS do antebraço (no dorso — pra cima na pose de bind, palmas pra baixo), curvos pro cotovelo
    for (const [k, tam] of [[0.45, 0.2], [0.72, 0.15]] as const) recorte("espinho", W * tam, pa.clone().lerp(pm, k).addScaledVector(cima, W * 0.14), dAnte, cima.clone().addScaledVector(dAnte, -0.7), { osso: ante, esp: W * 0.025 });
    // o PUNHO da manopla: um anel dourado e uma coroa de DENTES apontando pro cotovelo, abrindo pra fora
    const qPunho = pm.clone().addScaledVector(dAnte, -0.02);
    anel(mao, qPunho, dAnte, W * 0.14, W * 0.028, matOuro);
    const r0 = new THREE.Vector3().crossVectors(dAnte, cima).normalize();
    for (let k = 0; k < 7; k++) {
      const radial = r0.clone().applyAxisAngle(dAnte, (k / 7) * Math.PI * 2), tang = new THREE.Vector3().crossVectors(dAnte, radial).normalize();
      recorte("dente", W * 0.12, qPunho.clone().addScaledVector(radial, W * 0.15).addScaledVector(dAnte, -W * 0.05), tang, dAnte.clone().addScaledVector(radial, -0.55), { osso: mao, esp: W * 0.018, borda: false });
    }
    // a mão: a palma de malha, a GOTA nas costas e os dedos brancos
    const med = OSSO(modelo, `${L}HandMiddle1`), ind = OSSO(modelo, `${L}HandIndex1`), mind = OSSO(modelo, `${L}HandPinky1`);
    if (med) {
      const ladoMao = ind && mind ? P(ind).sub(P(mind)).normalize() : lat;
      casca(mao, pm, P(med), W * 0.1, W * 0.1, matMalha, { achata: 0.48, extA: 0.01, extB: 0.012, ref: ladoMao });
      const costas = new THREE.Vector3().crossVectors(P(med).sub(pm).normalize(), ladoMao).normalize().multiplyScalar(s);
      recorte("gota", W * 0.16, pm.clone().lerp(P(med), 0.5).addScaledVector(costas, W * 0.055), ladoMao, P(med).sub(pm).negate(), { osso: mao, esp: W * 0.025 });
    }
    for (const d of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) {
      for (let k = 1; k <= 3; k++) {
        const f = OSSO(modelo, `${L}Hand${d}${k}`); if (!f) continue;
        const prox = OSSO(modelo, `${L}Hand${d}${k + 1}`), pf = P(f);
        const fim = prox ? P(prox) : pf.clone().add(pf.clone().sub(P(f.parent!)).normalize().multiplyScalar(0.022));
        casca(f, pf, fim, W * (d === "Thumb" ? 0.042 : 0.036), W * 0.032, matBranco, { extA: 0.004, extB: 0.006, lados: 10 });
      }
    }
  }
  // ── as PERNAS: as placas da coxa com DENTES, a joelheira com ALETA, a greva, a bota de BICO com espora ──
  for (const L of ["Left", "Right"] as const) {
    const coxa = OSSO(modelo, `${L}UpLeg`), canela = OSSO(modelo, `${L}Leg`), pe = OSSO(modelo, `${L}Foot`), dedo = OSSO(modelo, `${L}ToeBase`);
    if (!coxa || !canela || !pe) continue;
    const s = L === "Left" ? 1 : -1, fora = lat.clone().multiplyScalar(s);
    const pc = P(coxa), pj = P(canela), pp = P(pe), dCoxa = pj.clone().sub(pc).normalize();
    casca(coxa, pc, pj, W * 0.22, W * 0.17, matMalha, { extA: 0.03 });
    // as placas de fora da coxa (y pra baixo: φ = ±π/2 é o lado de fora), em lâminas, com 3 dentes na barra
    const fimTasset = pc.clone().addScaledVector(dCoxa, compCoxa * 0.62);
    laminas(coxa, pc.clone().addScaledVector(cima, 0.05), fimTasset, 2, W * 0.27, W * 0.3, { ref: lat, phi: [s * (Math.PI / 2 + 0.2), 1.9] });
    for (let k = -1; k <= 1; k++) {
      const ph = s * (Math.PI / 2 + 0.2) + k * 0.55;
      const radial = tras.clone().multiplyScalar(Math.cos(ph)).addScaledVector(lat, Math.sin(ph));
      const tang = new THREE.Vector3().crossVectors(dCoxa, radial).normalize();
      recorte("garra", W * 0.15, fimTasset.clone().addScaledVector(radial, W * 0.305), tang, dCoxa.clone().negate().addScaledVector(radial, -0.15), { osso: coxa, mat: matOuro, borda: false, esp: W * 0.02 });
    }
    // a coxote na frente da coxa (φ = π)
    casca(coxa, pc.clone().addScaledVector(dCoxa, compCoxa * 0.42), pj.clone().addScaledVector(dCoxa, -0.03), W * 0.235, W * 0.2, matBranco, { ref: lat, phi: [Math.PI, 2.3] });
    // a JOELHEIRA: a cúpula com o friso dourado, a ALETA de fora e a ponta embaixo
    const cj = pj.clone().addScaledVector(frente, W * 0.08);
    const joelho = esfera(canela, cj, W * 0.16, matBranco); joelho.scale.set(1, 1.15, 0.85);
    recorte("folha", W * 0.27, cj.clone().addScaledVector(fora, W * 0.1), fora, cima.clone().addScaledVector(fora, 0.25), { osso: canela, esp: W * 0.03 });
    recorte("espinho", W * 0.24, cj.clone().addScaledVector(frente, W * 0.1).addScaledVector(cima, W * 0.04), cima.clone().negate(), frente.clone().addScaledVector(cima, 0.6), { osso: canela, esp: W * 0.03 });
    // a GREVA: abre em cima e afina no tornozelo, com a crista dourada e o fio aceso
    casca(canela, pj.clone().addScaledVector(dCoxa, 0.05), pp, W * 0.19, W * 0.14, matBranco, { extB: 0.03, reto: true });
    fio(canela, pj.clone().lerp(pp, 0.2).addScaledVector(frente, W * 0.19), pj.clone().lerp(pp, 0.85).addScaledVector(frente, W * 0.145), matOuro, W * 0.02);
    fio(canela, pj.clone().lerp(pp, 0.25).addScaledVector(frente, W * 0.17).addScaledVector(fora, W * 0.08), pj.clone().lerp(pp, 0.8).addScaledVector(frente, W * 0.13).addScaledVector(fora, W * 0.06));
    anel(canela, pj.clone().lerp(pp, 0.93), pp.clone().sub(pj), W * 0.15, W * 0.022, matOuro);
    // a BOTA de BICO: afina até a ponta, o friso dourado e a ESPORA atrás
    if (dedo) {
      const pd = P(dedo), dirPe = pd.clone().sub(pp).projectOnPlane(cima).normalize();
      casca(pe, pp.clone().addScaledVector(cima, 0.02).addScaledVector(dirPe, -W * 0.08), pd, W * 0.17, W * 0.15, matBranco, { achata: 0.85, ref: lat });
      casca(dedo, pd, pd.clone().addScaledVector(dirPe, W * 0.42).addScaledVector(baixo, W * 0.02), W * 0.15, W * 0.012, matBranco, { achata: 0.6, ref: lat, reto: true });
      anel(dedo, pd, dirPe, W * 0.135, W * 0.018, matOuro);
      const esporaC = pp.clone().addScaledVector(dirPe, -W * 0.2).addScaledVector(baixo, W * 0.05);
      fio(pe, pp.clone().addScaledVector(dirPe, -W * 0.12).addScaledVector(baixo, W * 0.05), esporaC, matOuro, W * 0.015);
      const gE = new THREE.TorusGeometry(W * 0.05, W * 0.012, 6, 10); geos.push(gE);   // a rosetinha da espora
      const roseta = new THREE.Mesh(gE, matOuro); roseta.position.copy(esporaC); roseta.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), lat); prender(pe, roseta);
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
