/**
 * AcessoriosVrm — os acessórios dos personagens que o VRoid não tem, feitos em código no mesmo DESENHO anime (cel
 * shading + contorno de tinta — components/cyber/AvatarAnime) e presos aos OSSOS do VRM, então acompanham a pose:
 *  - "foneNoPescoco": o fone over-ear branco descansando em volta do pescoço (o da Nina no card): o arco passa por trás
 *    da nuca e as conchas ficam dos lados, apoiadas nas clavículas;
 *  - "presilhaLapis": a presilha amarela em forma de LÁPIS na franja (Nina);
 *  - "oculosRedondos": os óculos de aro fino dourado, redondos (Aura);
 *  - "presilhaEstrela": a presilha de ESTRELA prateada na franja (Aura);
 *  - "oculosRetangulares": os óculos de armação preta retangular (Téo);
 *  - "golaCircuito": o friso de CIRCUITO verde que brilha na borda do capuz (Téo);
 *  - "gravataCarmesim": a gravata vermelha no decote do blazer (Examiner);
 *  - "distintivoPrata": o distintivo prateado em forma de escudo no peito, do lado esquerdo dela (Examiner);
 *  - "mechaCarmesim": a mecha vermelha na franja, do lado direito dela (Examiner) — o VRoid não pinta mecha por mecha;
 *  - "presilhaRelogio": o enfeite redondo de RELÓGIO dourado na base do rabo de cavalo (Zenita);
 *  - "golaAlta": a gola rulê (turtleneck) creme em volta do pescoço (Zenita);
 *  - Scholar: "monoculo"; Zaeon: "pingenteTriangulo", "linhasCiano"; Caio: "gravataAzul", "canetaPrata"; Davi e
 *    Farmácia: "distintivoPrata"; Enfermagem: "cruzEnfermagem"; Medicina: "estetoscopio"; Farmácia: "oculosRetPrata";
 *    Química: "oculosProtecao", "frascoVerde"; Engenharia Civil: "capacete", "coleteRefletivo";
 *  - Giulia (jogadora): "golaFrenteUnica", "cintoCorda", "pulseiraContas", "brincos".
 * As medidas são em metros, no espaço dos ossos do VRM (VRM 1.0: em repouso, eixos alinhados ao mundo, +Z = frente).
 */
import * as THREE from "three";
import type { VRM, VRMHumanBoneName } from "@pixiv/three-vrm";
import { tintaFixa, toon } from "./AvatarAnime";
import { fundirEstaticos } from "./lotes";
import { mostrarCaminho } from "./matrizes";
import type { AcessorioVrm } from "@/lib/cyber/estiloAvatar";

export type AcessoriosHandle = { dispose(): void };

const TINTA = 0.004;
/** os materiais COMPARTILHADOS de um personagem (1 tinta + 1 toon por cor): assim cada acessório vira 1 lote por material
 *  (components/cyber/lotes) — antes cada pecinha tinha os 2 dela (o Examiner sozinho somava ~60 draw calls) */
const compartilhados = new WeakMap<THREE.Material[], { tinta: THREE.Material; toons: Map<string, THREE.Material> }>();
function materiais(mats: THREE.Material[], cor: THREE.ColorRepresentation): [THREE.Material, THREE.Material] {
  let c = compartilhados.get(mats);
  if (!c) { c = { tinta: tintaFixa(TINTA), toons: new Map() }; compartilhados.set(mats, c); mats.push(c.tinta); }
  const k = new THREE.Color(cor).getHexString();
  let m = c.toons.get(k); if (!m) { m = toon(cor, { brilho: 0.25 }); c.toons.set(k, m); mats.push(m); }
  return [m, c.tinta];
}
/** uma malha desenhada: o material toon + o contorno (casca invertida) */
function desenhada(g: THREE.BufferGeometry, cor: THREE.ColorRepresentation, mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const [m, t] = materiais(mats, cor);
  geos.push(g);
  const grupo = new THREE.Group(), corpo = new THREE.Mesh(g, m), traco = new THREE.Mesh(g, t);
  corpo.frustumCulled = traco.frustumCulled = false; traco.raycast = () => {};
  grupo.add(corpo, traco);
  return grupo;
}

/** o fone em volta do pescoço (no osso do pescoço): arco atrás, conchas dos lados, um pouco abaixo do queixo */
function fone(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), R = 0.105;   // largo: passa POR FORA do capuz do moletom
  // o arco: meia volta por TRÁS do pescoço (de um lado ao outro), deitado e um pouco inclinado pra frente
  const arco = desenhada(new THREE.TorusGeometry(R, 0.009, 8, 32, Math.PI), 0xf4f4f6, mats, geos);
  arco.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI); g.add(arco);
  for (const lado of [-1, 1]) {
    const concha = desenhada(new THREE.CylinderGeometry(0.042, 0.038, 0.032, 20), 0xf4f4f6, mats, geos);
    concha.rotation.z = Math.PI / 2; concha.position.set(lado * (R + 0.004), -0.012, 0.012);
    concha.rotation.y = lado * 0.35;   // viradas um pouco pra frente, como quando o fone está no pescoço
    const almofada = desenhada(new THREE.TorusGeometry(0.03, 0.009, 6, 20), 0x3a3d48, mats, geos);
    almofada.rotation.y = Math.PI / 2; almofada.position.set(-lado * 0.016, 0, 0); concha.add(almofada);
    g.add(concha);
  }
  g.position.set(0, 0.05, 0.025);   // um pouco à frente e acima: apoiado sobre a gola, visível de frente
  return g;
}

/** a presilha de lápis (no osso da cabeça): amarela com a ponta de madeira e o grafite, na franja do lado esquerdo dela */
function presilha(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const corpo = desenhada(new THREE.CylinderGeometry(0.0065, 0.0065, 0.05, 6), 0xffcf3a, mats, geos); g.add(corpo);
  const madeira = desenhada(new THREE.ConeGeometry(0.0065, 0.014, 6), 0xf3d2a2, mats, geos); madeira.position.y = 0.032; g.add(madeira);
  const grafite = desenhada(new THREE.ConeGeometry(0.0025, 0.006, 6), 0x2a2a2a, mats, geos); grafite.position.y = 0.0405; g.add(grafite);
  const borracha = desenhada(new THREE.CylinderGeometry(0.0066, 0.0066, 0.008, 6), 0xf28aa8, mats, geos); borracha.position.y = -0.029; g.add(borracha);
  g.rotation.z = -1.0;   // deitada na diagonal sobre a franja
  g.position.set(0.055, 0.135, 0.085);
  return g;
}

/** os óculos redondos de aro fino dourado (no osso da cabeça), na altura dos olhos */
function oculos(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), OURO = 0xd8b45a, R = 0.0185, X = 0.031;
  for (const lado of [-1, 1]) {
    const aro = desenhada(new THREE.TorusGeometry(R, 0.0022, 6, 28), OURO, mats, geos); aro.position.set(lado * X, 0, 0); g.add(aro);
    const haste = desenhada(new THREE.CylinderGeometry(0.0018, 0.0018, 0.1, 5), OURO, mats, geos);
    haste.rotation.x = Math.PI / 2; haste.position.set(lado * (X + R + 0.004), 0.004, -0.05); g.add(haste);
  }
  const ponte = desenhada(new THREE.TorusGeometry(0.008, 0.0018, 5, 12, Math.PI), OURO, mats, geos); ponte.position.set(0, 0.004, 0); g.add(ponte);
  g.position.set(0, 0.079, 0.1);
  return g;
}

/** a presilha de estrela prateada (no osso da cabeça), na franja do lado direito dela */
function estrela(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const sh = new THREE.Shape(), n = 5, R = 0.019, r = 0.008;
  for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2 + Math.PI / 2, rr = k % 2 ? r : R; if (k) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }).translate(0, 0, -0.002);
  const g = desenhada(geo, 0xdfe6f2, mats, geos);
  g.rotation.set(-0.3, -0.5, 0.3); g.position.set(-0.072, 0.118, 0.082);
  return g;
}

/** os óculos de armação preta retangular (no osso da cabeça) */
function oculosRet(mats: THREE.Material[], geos: THREE.BufferGeometry[], PRETO: THREE.ColorRepresentation = 0x15171c): THREE.Group {
  const g = new THREE.Group(), L = 0.042, A = 0.024, X = 0.033, e = 0.004;
  for (const lado of [-1, 1]) {
    for (const [w, h, x, y] of [[L, e, 0, A / 2], [L, e, 0, -A / 2], [e, A, -L / 2, 0], [e, A, L / 2, 0]] as const) {
      const b = desenhada(new THREE.BoxGeometry(w, h, 0.004), PRETO, mats, geos); b.position.set(lado * X + x, y, 0); g.add(b);
    }
    const haste = desenhada(new THREE.BoxGeometry(0.003, 0.003, 0.1), PRETO, mats, geos); haste.position.set(lado * (X + L / 2 + 0.003), A / 2 - 0.003, -0.05); g.add(haste);
  }
  const ponte = desenhada(new THREE.BoxGeometry(0.024, 0.003, 0.004), PRETO, mats, geos); ponte.position.set(0, A / 2 - 0.004, 0); g.add(ponte);
  g.position.set(0, 0.09, 0.118);
  return g;
}

/** o friso de circuito verde na borda do capuz (no osso do pescoço): uma linha que brilha (não leva tinta — é luz) */
function golaCircuito(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), cor = 0x2bf59a;
  const m = new THREE.MeshBasicMaterial({ color: cor, toneMapped: false }); mats.push(m);
  const arco = new THREE.TorusGeometry(0.115, 0.0035, 5, 40, Math.PI * 1.3); geos.push(arco);
  const a = new THREE.Mesh(arco, m); a.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI * 1.35 / 2 + Math.PI / 2 - 0.1); g.add(a);
  g.position.set(0, 0.02, -0.01);
  return g;
}

const CARMESIM = 0xc41e3a;
/** a gravata (no osso do pescoço): o nó logo abaixo da gola e a lâmina descendo pelo decote, inclinada pra acompanhar
 *  o peito */
function gravata(mats: THREE.Material[], geos: THREE.BufferGeometry[], cor: THREE.ColorRepresentation = CARMESIM): THREE.Group {
  const g = new THREE.Group();
  const no = desenhada(new THREE.CylinderGeometry(0.014, 0.01, 0.022, 4), cor, mats, geos); no.rotation.y = Math.PI / 4; g.add(no);
  // a lâmina: um trapézio fino que alarga pra baixo e termina em ponta
  const sh = new THREE.Shape(); sh.moveTo(-0.009, 0); sh.lineTo(0.009, 0); sh.lineTo(0.017, -0.1); sh.lineTo(0, -0.118); sh.lineTo(-0.017, -0.1); sh.closePath();
  const lamina = desenhada(new THREE.ExtrudeGeometry(sh, { depth: 0.005, bevelEnabled: false }), cor, mats, geos);
  lamina.position.set(0, -0.01, 0.004); lamina.rotation.x = -0.68; g.add(lamina);
  g.position.set(0, -0.005, 0.085);
  return g;
}

/** o distintivo (no osso do peito superior): um escudo prateado pequeno, do lado esquerdo dela */
function distintivo(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const sh = new THREE.Shape(); sh.moveTo(-0.017, 0.018); sh.lineTo(0.017, 0.018); sh.lineTo(0.017, -0.002); sh.quadraticCurveTo(0.014, -0.016, 0, -0.024); sh.quadraticCurveTo(-0.014, -0.016, -0.017, -0.002); sh.closePath();
  const g = desenhada(new THREE.ExtrudeGeometry(sh, { depth: 0.004, bevelEnabled: false }), 0xd9dee8, mats, geos);
  g.scale.setScalar(0.8); g.position.set(0.085, 0.03, 0.12); g.rotation.y = 0.25;
  return g;
}

/** o enfeite de relógio (no osso da cabeça): um relógio redondo dourado com o mostrador creme e os ponteiros, preso na
 *  base do rabo de cavalo, no alto da cabeça */
function relogio(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), OURO = 0xe0b04a;
  const aro = desenhada(new THREE.CylinderGeometry(0.021, 0.021, 0.008, 24), OURO, mats, geos); aro.rotation.x = Math.PI / 2; g.add(aro);
  const mostrador = desenhada(new THREE.CylinderGeometry(0.016, 0.016, 0.002, 24), 0xfbf3df, mats, geos); mostrador.rotation.x = Math.PI / 2; mostrador.position.z = 0.0045; g.add(mostrador);
  for (const [c, a] of [[0.011, 0.3], [0.008, 2.2]] as const) {
    const p = desenhada(new THREE.BoxGeometry(0.0022, c, 0.0015), 0x3a2a12, mats, geos);
    p.position.set(Math.sin(a) * c / 2, Math.cos(a) * c / 2, 0.006); p.rotation.z = -a; g.add(p);
  }
  g.position.set(0, 0.185, -0.098); g.rotation.x = -0.75;   // no prendedor do rabo de cavalo, no alto da cabeça, virado pra cima
  return g;
}

/** a gola rulê (no osso do pescoço): um tubo de tricô creme dobrado em volta do pescoço */
function golaAlta(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const tubo = desenhada(new THREE.CylinderGeometry(0.049, 0.055, 0.045, 24, 1, true), 0xf1e8d4, mats, geos); g.add(tubo);
  const dobra = desenhada(new THREE.TorusGeometry(0.05, 0.007, 8, 24), 0xf1e8d4, mats, geos); dobra.rotation.x = Math.PI / 2; dobra.position.y = 0.022; g.add(dobra);
  g.position.set(0, 0.012, 0.006);
  return g;
}

/** um material que BRILHA (luz, sem tinta nem sombra) */
function luzMat(cor: THREE.ColorRepresentation, mats: THREE.Material[]) { const m = new THREE.MeshBasicMaterial({ color: cor, toneMapped: false }); mats.push(m); return m; }

/** a caneta-tinteiro prateada presa no bolso do colete (no peito superior, do lado esquerdo dele) */
function caneta(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const corpo = desenhada(new THREE.CylinderGeometry(0.0045, 0.0045, 0.07, 8), 0xc9ced6, mats, geos); g.add(corpo);
  const clipe = desenhada(new THREE.BoxGeometry(0.002, 0.03, 0.003), 0xe6e9ee, mats, geos); clipe.position.set(0, 0.012, 0.005); g.add(clipe);
  g.position.set(0.075, -0.02, 0.118); g.rotation.z = 0.05;
  return g;
}

/** o monóculo dourado no olho direito (no osso da cabeça) e a correntinha descendo até o peito */
function monoculo(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), OURO = 0xd8b45a;
  const aro = desenhada(new THREE.TorusGeometry(0.019, 0.0024, 6, 28), OURO, mats, geos); g.add(aro);
  const curva = new THREE.CatmullRomCurve3([[-0.019, -0.006, 0], [-0.03, -0.06, -0.01], [-0.035, -0.13, 0.0], [-0.03, -0.2, 0.01]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const cord = new THREE.TubeGeometry(curva, 20, 0.0012, 4, false); geos.push(cord);
  const m = new THREE.MeshBasicMaterial({ color: OURO }); mats.push(m); g.add(new THREE.Mesh(cord, m));
  return g;
}

/** o pingente de TRIÂNGULO ciano (luz) num colar fino (no osso do pescoço) */
function pingente(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const colar = new THREE.TorusGeometry(0.06, 0.0012, 4, 32, Math.PI); geos.push(colar);
  const c = new THREE.Mesh(colar, luzMat(0xbff6ff, mats)); c.rotation.set(Math.PI / 2 + 0.9, 0, Math.PI); c.position.set(0, -0.035, 0.03); g.add(c);
  const sh = new THREE.Shape(); sh.moveTo(0, -0.014); sh.lineTo(0.012, 0.008); sh.lineTo(-0.012, 0.008); sh.closePath();
  const tri = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false }); geos.push(tri);
  const t = new THREE.Mesh(tri, luzMat(0x22d3ee, mats)); t.position.set(0, -0.085, 0.095); g.add(t);
  return g;
}

/** os frisos de luz ciano descendo pela frente da jaqueta branca (no peito superior) */
function linhasCiano(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), m = luzMat(0x5eead4, mats);
  for (const x of [-0.045, 0.045]) { const b = new THREE.BoxGeometry(0.0035, 0.2, 0.002); geos.push(b); const l = new THREE.Mesh(b, m); l.position.set(x, -0.06, 0.118); l.rotation.x = -0.12; g.add(l); }
  return g;
}

/** o broche da enfermagem: um quadradinho vermelho com a cruz branca (no peito, do lado esquerdo dela) */
function cruz(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const base = desenhada(new THREE.BoxGeometry(0.026, 0.026, 0.003), 0xd23b3b, mats, geos); g.add(base);
  for (const [w, h] of [[0.016, 0.005], [0.005, 0.016]] as const) { const b = new THREE.BoxGeometry(w, h, 0.0015); geos.push(b); const m = new THREE.MeshBasicMaterial({ color: 0xffffff }); mats.push(m); const x = new THREE.Mesh(b, m); x.position.z = 0.0022; g.add(x); }
  g.position.set(0.08, 0.02, 0.112); g.rotation.y = 0.25;
  return g;
}

/** o ESTETOSCÓPIO (no osso do pescoço): o tubo passa por trás do pescoço e as duas pontas descem pela frente; numa delas,
 *  o diafragma prateado */
function estetoscopio(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), TUBO = 0x23262d;
  for (const lado of [-1, 1]) {
    const curva = new THREE.CatmullRomCurve3([[0, 0.035, -0.07], [lado * 0.078, 0.025, -0.02], [lado * 0.095, -0.02, 0.075], [lado * 0.08, -0.1, 0.145], [lado * 0.062, -0.19, 0.16]].map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    g.add(desenhada(new THREE.TubeGeometry(curva, 24, 0.0055, 6, false), TUBO, mats, geos));
  }
  const disco = desenhada(new THREE.CylinderGeometry(0.018, 0.018, 0.008, 20), 0xc9ced6, mats, geos); disco.rotation.x = Math.PI / 2; disco.position.set(0.062, -0.205, 0.165); g.add(disco);
  return g;
}

/** os ÓCULOS DE PROTEÇÃO levantados na testa (no osso da cabeça): a faixa em volta da cabeça e as lentes largas */
function oculosProtecao(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const faixa = desenhada(new THREE.TorusGeometry(0.098, 0.006, 6, 40), 0x2a2d33, mats, geos); faixa.rotation.x = Math.PI / 2 - 0.35; g.add(faixa);
  for (const lado of [-1, 1]) {
    const lente = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.012), new THREE.MeshBasicMaterial({ color: 0xcfe7ef, transparent: true, opacity: 0.55 }));
    geos.push(lente.geometry); mats.push(lente.material as THREE.Material);
    lente.position.set(lado * 0.03, 0.03, 0.097); lente.rotation.x = -0.35; g.add(lente);
    const aro = desenhada(new THREE.BoxGeometry(0.054, 0.034, 0.008), 0x8d939c, mats, geos); aro.position.copy(lente.position).add(new THREE.Vector3(0, 0, -0.004)); aro.rotation.x = -0.35; g.add(aro);
  }
  g.position.set(0, 0.14, 0);
  return g;
}

/** o broche de FRASCO verde (no peito, do lado esquerdo dele) */
function frasco(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const bojo = desenhada(new THREE.ConeGeometry(0.012, 0.018, 12), 0x4ade80, mats, geos); g.add(bojo);
  const gargalo = desenhada(new THREE.CylinderGeometry(0.004, 0.004, 0.01, 8), 0xe2e8f0, mats, geos); gargalo.position.y = 0.013; g.add(gargalo);
  g.position.set(0.08, 0.02, 0.118);
  return g;
}

/** o CAPACETE de obra branco (no osso da cabeça), com o escudinho prateado na frente */
function capacete(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const casco = desenhada(new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4f5f7, mats, geos); casco.scale.set(1.12, 0.95, 1.22); g.add(casco);
  const aba = desenhada(new THREE.CylinderGeometry(0.135, 0.135, 0.008, 28), 0xf4f5f7, mats, geos); aba.scale.set(1.1, 1, 1.25); aba.position.z = 0.012; g.add(aba);
  const crista = desenhada(new THREE.BoxGeometry(0.025, 0.012, 0.22), 0xe9eaee, mats, geos); crista.position.set(0, 0.112, 0.005); g.add(crista);
  const esc = distintivo(mats, geos); esc.position.set(0, 0.06, 0.143); esc.rotation.set(-0.35, 0, 0); esc.scale.setScalar(0.7); g.add(esc);
  g.position.set(0, 0.115, -0.005);
  return g;
}

/** o COLETE refletivo laranja (no peito): aberto na frente, com duas faixas prateadas em volta */
function colete(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), abre = 0.55;
  const corpo = desenhada(new THREE.CylinderGeometry(0.175, 0.17, 0.4, 28, 1, true, abre / 2, Math.PI * 2 - abre), 0xf47a1f, mats, geos); g.add(corpo);
  for (const y of [-0.06, -0.13]) {
    const f = new THREE.CylinderGeometry(0.177, 0.176, 0.022, 28, 1, true, abre / 2, Math.PI * 2 - abre); geos.push(f);
    const m = new THREE.MeshBasicMaterial({ color: 0xe6e9ef, side: THREE.DoubleSide }); mats.push(m);
    const fx = new THREE.Mesh(f, m); fx.position.y = y; g.add(fx);
  }
  g.scale.set(1.1, 1, 0.9); g.position.set(0, -0.1, -0.015);
  return g;
}

/** a GOLA da blusa frente única (no pescoço): a faixa preta alta em volta do pescoço, presa atrás */
function golaFrenteUnica(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  const faixa = desenhada(new THREE.CylinderGeometry(0.047, 0.05, 0.032, 24, 1, true), 0x141418, mats, geos); g.add(faixa);
  // as duas alças descendo da gola até o decote da blusa, deixando o recorte gota no meio
  for (const lado of [-1, 1]) {
    const alca = desenhada(new THREE.BoxGeometry(0.022, 0.07, 0.006), 0x141418, mats, geos);
    alca.position.set(lado * 0.024, -0.045, 0.05); alca.rotation.set(-0.35, 0, lado * 0.32); g.add(alca);
  }
  g.position.set(0, 0.012, 0.004);
  return g;
}

/** o CINTO de corda trançada branca (no quadril), amarrado na frente com as duas pontas de franja caindo */
function cintoCorda(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), BRANCO = 0xf2efe6;
  const volta = desenhada(new THREE.TorusGeometry(0.135, 0.007, 6, 40), BRANCO, mats, geos); volta.rotation.x = Math.PI / 2; volta.scale.set(1.0, 0.8, 1); g.add(volta);
  const no = desenhada(new THREE.SphereGeometry(0.014, 10, 8), BRANCO, mats, geos); no.position.set(0, 0, 0.108); g.add(no);
  for (const [dx, comp] of [[-0.012, 0.16], [0.014, 0.13]] as const) {
    const ponta = desenhada(new THREE.CylinderGeometry(0.005, 0.005, comp, 6), BRANCO, mats, geos); ponta.position.set(dx, -comp / 2, 0.112); g.add(ponta);
    const franja = desenhada(new THREE.ConeGeometry(0.011, 0.03, 8), BRANCO, mats, geos); franja.position.set(dx, -comp - 0.012, 0.112); franja.rotation.x = Math.PI; g.add(franja);
  }
  g.position.set(0, 0.07, 0.01);
  return g;
}

/** a PULSEIRA de contas escuras (no pulso direito dela) */
function pulseira(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group(), n = 14, R = 0.03;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, conta = desenhada(new THREE.SphereGeometry(0.0055, 8, 6), 0x2a2420, mats, geos);
    conta.position.set(0, Math.cos(a) * R, Math.sin(a) * R); g.add(conta);
  }
  g.position.set(-0.01, 0, 0);
  return g;
}

/** os BRINCOS: pontinhos claros no lóbulo das duas orelhas (na cabeça) */
function brincos(mats: THREE.Material[], geos: THREE.BufferGeometry[]): THREE.Group {
  const g = new THREE.Group();
  for (const lado of [-1, 1]) { const b = desenhada(new THREE.SphereGeometry(0.006, 10, 8), 0xf3efe6, mats, geos); b.position.set(lado * 0.074, 0.035, 0.0); g.add(b); }
  return g;
}

/** a MECHA carmesim: pinta mechas DE VERDADE do cabelo do VRM (não é peça por cima). O cabelo do VRoid é uma malha só,
 *  feita de mechas soltas (cada uma é um pedaço conexo da malha): escolhe as da frente, do lado direito dela, que descem
 *  da risca até o queixo (medidas na pose de repouso, a partir do osso da cabeça), e passa os triângulos delas pra um
 *  material próprio — o mesmo MToon do cabelo, em carmesim liso */
const MECHA = { x: [-0.072, -0.05], zMin: 0.06, alturaMin: 0.18 } as const;
function pintarMecha(vrm: VRM, cor: THREE.ColorRepresentation): (() => void) | null {
  let malha: THREE.SkinnedMesh | null = null;
  vrm.scene.traverse((o) => { const m = o as THREE.SkinnedMesh; if (!malha && m.isSkinnedMesh && (Array.isArray(m.material) ? m.material : [m.material]).some((x) => /_Hair_00_HAIR/.test(x.name) && !/HairBack/.test(x.name))) malha = m; });
  const hm = malha as THREE.SkinnedMesh | null, cabeca = vrm.humanoid.getRawBoneNode("head");
  if (!hm || !cabeca || !hm.geometry.index || !Array.isArray(hm.material)) return null;
  const g = hm.geometry, pos = g.attributes.position as THREE.BufferAttribute, idx = g.index!, n = pos.count;
  const bi = hm.skeleton.bones.indexOf(cabeca as THREE.Bone); if (bi < 0) return null;
  const pc = new THREE.Vector3().setFromMatrixPosition(hm.skeleton.boneInverses[bi]!.clone().invert());
  // as mechas = os pedaços conexos da malha (union-find pelos triângulos)
  const pai = new Int32Array(n).map((_, i) => i);
  const raiz = (i: number): number => { while (pai[i] !== i) { pai[i] = pai[pai[i]!]!; i = pai[i]!; } return i; };
  for (let t = 0; t < idx.count; t += 3) { const a = raiz(idx.getX(t)); pai[raiz(idx.getX(t + 1))] = a; pai[raiz(idx.getX(t + 2))] = a; }
  const v = new THREE.Vector3(), soma = new Map<number, { n: number; x: number; z: number; y0: number; y1: number }>();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(hm.bindMatrix).sub(pc);
    const r = raiz(i), c = soma.get(r) ?? { n: 0, x: 0, z: 0, y0: 9, y1: -9 };
    c.n++; c.x += v.x; c.z += v.z; c.y0 = Math.min(c.y0, v.y); c.y1 = Math.max(c.y1, v.y); soma.set(r, c);
  }
  const escolhidas = new Set([...soma].filter(([, c]) => { const x = c.x / c.n; return x >= MECHA.x[0] && x <= MECHA.x[1] && c.z / c.n >= MECHA.zMin && c.y1 - c.y0 >= MECHA.alturaMin; }).map(([r]) => r));
  if (!escolhidas.size) return null;
  // os triângulos das mechas escolhidas vão pro fim do índice, num grupo com o material carmesim
  const resto: number[] = [], delas: number[] = [];
  for (let t = 0; t < idx.count; t += 3) (escolhidas.has(raiz(idx.getX(t))) ? delas : resto).push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  const original = { index: idx, groups: g.groups.map((x) => ({ ...x })), material: hm.material };
  const mats = hm.material, principal = mats.findIndex((m) => !(m as { isOutline?: boolean }).isOutline), traco = mats.findIndex((m) => (m as { isOutline?: boolean }).isOutline);
  const pintada = mats[principal]!.clone() as THREE.Material & { color?: THREE.Color; shadeColorFactor?: THREE.Color; map?: THREE.Texture | null; shadeMultiplyTexture?: THREE.Texture | null };
  const c = new THREE.Color(cor); pintada.map = null; pintada.shadeMultiplyTexture = null; pintada.color?.copy(c); pintada.shadeColorFactor?.copy(c).multiplyScalar(0.55); pintada.needsUpdate = true;
  const Arr = (idx.array as Uint16Array | Uint32Array).constructor as Uint16ArrayConstructor | Uint32ArrayConstructor;
  g.setIndex(new THREE.BufferAttribute(new Arr([...resto, ...delas]), 1));
  g.clearGroups(); g.addGroup(0, resto.length, principal); g.addGroup(resto.length, delas.length, mats.length);
  if (traco >= 0) g.addGroup(0, resto.length + delas.length, traco);
  hm.material = [...mats, pintada];
  return () => {
    g.setIndex(original.index); g.clearGroups(); for (const x of original.groups) g.addGroup(x.start, x.count, x.materialIndex);
    hm.material = original.material; pintada.dispose();
  };
}

/** veste os acessórios no VRM (cada um no seu osso); `dispose()` tira e solta tudo */
export function vestirAcessorios(vrm: VRM, lista: readonly AcessorioVrm[]): AcessoriosHandle {
  const mats: THREE.Material[] = [], geos: THREE.BufferGeometry[] = [], postos: THREE.Object3D[] = [], desfazer: (() => void)[] = [];
  const osso = (n: VRMHumanBoneName) => vrm.humanoid.getRawBoneNode(n);
  type Osso = "neck" | "head" | "upperChest" | "hips" | "rightHand";
  const TABELA: Record<Exclude<AcessorioVrm, "mechaCarmesim">, [Osso, () => THREE.Group]> = {
    foneNoPescoco: ["neck", () => fone(mats, geos)], golaCircuito: ["neck", () => golaCircuito(mats, geos)], golaAlta: ["neck", () => golaAlta(mats, geos)],
    gravataCarmesim: ["neck", () => gravata(mats, geos)], gravataAzul: ["neck", () => gravata(mats, geos, 0x3b6fd8)],
    estetoscopio: ["neck", () => estetoscopio(mats, geos)], pingenteTriangulo: ["neck", () => pingente(mats, geos)],
    distintivoPrata: ["upperChest", () => distintivo(mats, geos)], canetaPrata: ["upperChest", () => caneta(mats, geos)],
    linhasCiano: ["upperChest", () => linhasCiano(mats, geos)], cruzEnfermagem: ["upperChest", () => cruz(mats, geos)],
    frascoVerde: ["upperChest", () => frasco(mats, geos)], coleteRefletivo: ["upperChest", () => colete(mats, geos)],
    presilhaLapis: ["head", () => presilha(mats, geos)], oculosRedondos: ["head", () => oculos(mats, geos)], presilhaEstrela: ["head", () => estrela(mats, geos)],
    oculosRetangulares: ["head", () => oculosRet(mats, geos)], oculosRetPrata: ["head", () => oculosRet(mats, geos, 0xb9c0ca)],
    presilhaRelogio: ["head", () => relogio(mats, geos)], monoculo: ["head", () => monoculo(mats, geos)],
    oculosProtecao: ["head", () => oculosProtecao(mats, geos)], capacete: ["head", () => capacete(mats, geos)],
    golaFrenteUnica: ["neck", () => golaFrenteUnica(mats, geos)], cintoCorda: ["hips", () => cintoCorda(mats, geos)],
    pulseiraContas: ["rightHand", () => pulseira(mats, geos)], brincos: ["head", () => brincos(mats, geos)],
  };
  for (const a of lista) {
    if (a === "mechaCarmesim") { const d = pintarMecha(vrm, CARMESIM); if (d) desfazer.push(d); continue; }
    const [qual, fazer] = TABELA[a];
    const pai = qual === "neck" ? osso("neck") ?? osso("upperChest") : qual === "upperChest" ? osso("upperChest") ?? osso("chest") : osso(qual);
    if (!pai) continue;
    const obj = fazer();
    pai.add(obj); postos.push(obj); mostrarCaminho(obj);   // (os ossos vazios ficam escondidos — components/cyber/matrizes)
    // os ÓCULOS vão onde os olhos estão (os ossos dos olhos do VRM, no referencial da cabeça) — cada rosto tem a sua
    // proporção
    if (a === "oculosRedondos" || a === "oculosRetangulares" || a === "oculosRetPrata" || a === "monoculo") {
      const oe = osso("leftEye"), od = osso("rightEye");
      if (oe && od) {
        vrm.scene.updateMatrixWorld(true);
        // o monóculo vai só no olho DIREITO (o do VRM: rightEye); os óculos, no meio dos dois
        const m = a === "monoculo" ? od.getWorldPosition(new THREE.Vector3()) : oe.getWorldPosition(new THREE.Vector3()).add(od.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
        pai.worldToLocal(m);
        const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(pai.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(vrm.scene.getWorldQuaternion(new THREE.Quaternion())));
        obj.position.copy(m).addScaledVector(frente, 0.078);   // o osso do olho é o CENTRO do globo ocular: a lente fica ~7,8 cm à frente
      }
    }
    // as pecinhas não se mexem dentro do acessório: viram 1 malha por material, presa ao osso como antes
    fundirEstaticos(obj);
  }
  return {
    dispose() {
      for (const o of postos) o.removeFromParent();
      for (const d of desfazer) d();
      for (const m of mats) m.dispose();
      for (const g of geos) g.dispose();
    },
  };
}
