/**
 * CarroHex — o CARRO VOADOR do cyberespaço (out/2026, as referências do dono): um casco baixo, largo e curvo revestido
 * de HEXÁGONOS (alongados no comprimento, com frestas pretas) — a lataria em laranja/vermelho, os hexágonos escuros do
 * VIDRO na frente do cockpit, o hexágono lateral grande e ACESO de cada lado, o CHASSI preto brilhante com a saia, as
 * luzes brancas, os LEDs verdes e os PROPULSORES embaixo (ele paira — não tem rodas).
 *
 * É ENTRÁVEL: as PORTAS são os hexágonos de cada lado do cockpit (com o hexágono aceso) e abrem em TESOURA, como as
 * da Lamborghini — sobem girando na dobradiça da frente — revelando o COCKPIT (o banco, o painel com 3 telas, o manche).
 * `abrir(k)` 0..1; `assento` = onde o piloto senta.
 *
 * Referencial: +z = a FRENTE, +y = cima, y = 0 = a base da saia (o carro paira acima do chão).
 */
import * as THREE from "three";
import { fundirEstaticos } from "./lotes";
import type { CorCarro } from "@/lib/cyber/carros";

export type CarroHandle = {
  group: THREE.Group;
  /** onde o quadril do piloto fica (no referencial do carro) e pra onde ele olha (+z) */
  assento: THREE.Object3D;
  /** os pontos das mãos (o manche) e dos pés (o assoalho) — a IK do piloto */
  pontos: { maoE: THREE.Object3D; maoD: THREE.Object3D; peE: THREE.Object3D; peD: THREE.Object3D };
  /** 0 = fechado, 1 = aberto (as portas de hexágono levantadas em tesoura) */
  abrir(k: number): void;
  /** quantos hexágonos do vidro abrem (o som da cabine — lib/cyber/somCarro `sonsDaCabine` — marca cada um) */
  readonly nVidros: number;
  atualizar(t: number, dt: number, o?: { vel?: number; ligado?: boolean }): void;
  dispose(): void;
};

/** a PLANTA (vista de cima): um hexágono alongado — a frente pontuda em +z, a traseira em −z */
const PLANTA: readonly [number, number][] = [[0, 2.55], [1.25, 1.0], [1.3, -1.1], [0, -1.85], [-1.3, -1.1], [-1.25, 1.0]];   // (o chassi termina com a cabine: a cauda passa por cima, solta)
/** o CASCO (ver `superficie`): a meia-largura, a altura, o meio-comprimento e a base */
const CASCO = { a: 1.38, b: 0.86, c: 2.8, y0: 0.55 } as const;   // (mais ALTO: a cabine puxada pra cima, como a de um helicóptero)
/** os HEXÁGONOS, medidos em METROS na vista de cima (o mesmo tamanho no carro todo — não amassam nas pontas): o raio,
 *  o quanto esticam no comprimento (aerodinâmico), o raio dos CANTOS arredondados (fração da aresta) e a junta (m) */
const HEX = { r: 0.6, alonga: 1.3, arred: 0.34, junta: 0.028 } as const;
/** o afastamento (m) da PLACA e do FORRO (a junta embaixo) da superfície — longe o bastante pra não brigarem na tela */
const PLACA = 0.022, FORRO = 0.006;
/** as PORTAS (tesoura, "Lamborghini"): a dobradiça na frente de cada lado (altura e z), onde fica o hexágono lateral e
 *  o quanto sobem/abrem pra fora */
const PORTA = { pivoY: 0.78, pivoZ: 0.85, ladoZ: 0.0, sobe: 0.95, abre: 0.12 } as const;
/** o VIDRO que abre (os hexágonos do lado do passageiro): DESTRAVA (sobe uns centímetros), DESLIZA pra frente por cima
 *  do para-brisa e fica EMPILHADO flutuando ali (cada um um pouco mais alto) — em cascata, antes da porta do passageiro.
 *  `destrava` (m), `desliza` (m pra frente) e `degrau` (m a mais de altura por placa na pilha) */
const VIDRO = { destrava: 0.06, desliza: 1.15, degrau: 0.07, inclina: 0.1 } as const;
/** de que é cada hexágono pela posição (u = lado, v = frente/trás, ambos −1..1) */
function tipoDoHex(u: number, v: number): "vidro" | "porta-e" | "porta-d" | "lataria" {
  if (v > -0.22 && v < 0.62 && Math.abs(u) < 0.5) return "vidro";                  // o vidro: a bolha escura sobre o cockpit, na frente
  return portaOuLataria(u, v);
}
/** o hexágono do vidro ABRE? só os perto da porta do PASSAGEIRO (o do meio e o do lado direito: u ≤ 0) — os da frente não */
const abreDoVidro = (u: number, v: number) => u < 0.05 && v < 0.35;
function portaOuLataria(u: number, v: number): "porta-e" | "porta-d" | "lataria" {
  if (v > -0.3 && v <= 0.3 && Math.abs(u) >= 0.5) return u > 0 ? "porta-e" : "porta-d";   // os lados do cockpit: as portas
  return "lataria";
}
/** a superfície do casco (sem o afastamento): u = de um lado ao outro (−1..1), v = de trás pra frente (−1..1). A FORMA
 *  aerodinâmica das refs: comprido e baixo, as pontas afinando (a largura cai nas pontas), o ponto mais alto no cockpit
 *  (um pouco à frente do meio) e a traseira descendo comprida e suave */
/** a FORMA de helicóptero (referências: Airbus RACER e H160, Bell 360 Invictus — fuselagem estreita "de tubarão", a
 *  parte de baixo da traseira SUBINDO a partir da cabine até um BRAÇO de cauda fino, e na ponta a barbatana com o rotor
 *  embutido no anel, inclinada, com estabilizadores biplano na frente dela):
 *  `cauda` = o comprimento da traseira (× o meio-comprimento), `sobe` = o quanto a base dela sobe (m) até o braço,
 *  `braco` = a espessura do braço (fração da altura), `afina` = o quanto a largura cai até ele, `barriga` = a espessura
 *  de baixo do braço (m) */
const TRASEIRA = { cauda: 1.45, sobe: 0.42, braco: 0.2, afina: 0.68, barriga: 0.16 } as const;
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** o comprimento (m) de cada lado: a frente e a traseira (mais longa) */
const zDe = (v: number) => CASCO.c * v * (v < 0 ? TRASEIRA.cauda : 1);
const vDe = (Z: number) => Z / (CASCO.c * (Z < 0 ? TRASEIRA.cauda : 1));
/** a BASE do casco: no chassi na cabine; atrás dela SOBE (a parte de baixo da cauda de helicóptero) */
const baseEm = (v: number) => CASCO.y0 + TRASEIRA.sobe * sm(-0.22, -0.7, v);
/** a largura: na frente afina num BICO estreito (o "tubarão"); atrás, cai até o braço da cauda */
const larguraEm = (v: number) => v >= 0 ? Math.pow(Math.max(0, 1 - Math.pow(v, 1.7)), 0.62)
  : Math.pow(Math.max(0, 1 - Math.pow(-v, 2.2)), 0.5) * (1 - TRASEIRA.afina * sm(-0.2, -0.7, v)) + 0.06 * sm(-0.5, -0.8, v) * (1 - Math.pow(-v, 8));
function superficie(u: number, v: number): THREE.Vector3 {
  const { a, b } = CASCO;
  const largura = larguraEm(v);
  // o PERFIL: a cabine alta um pouco à frente do meio; o bico desce afilado; atrás, cai até o braço da cauda (fino e reto)
  const pico = 0.18, d = v >= pico ? (v - pico) / (1 - pico) : (pico - v) / (1 + pico);   // 0 no pico, 1 nas pontas
  let perfil = Math.pow(Math.max(0, 1 - Math.pow(d, v >= pico ? 1.45 : 2.0)), v >= pico ? 0.85 : 0.65);
  if (v < 0) perfil = Math.max(perfil * (1 - 0.55 * sm(-0.25, -0.65, v)), TRASEIRA.braco * (1 - sm(-0.93, -1, v) * 0.7));   // o BRAÇO de cauda
  const corte = Math.pow(Math.max(0, 1 - u * u), 0.42);   // (a seção: arredondada em cima, caindo nos lados)
  return new THREE.Vector3(a * u * largura, baseEm(v) + b * perfil * corte, zDe(v));
}
/** o ponto da superfície do casco em (u, v), afastado `sobe` dela (pela normal) */
function pontoDoCasco(u: number, v: number, sobe: number): THREE.Vector3 {
  const e = 0.004, p = superficie(u, v);
  if (!sobe) return p;
  const du = superficie(Math.min(1, u + e), v).sub(superficie(Math.max(-1, u - e), v)), dv = superficie(u, Math.min(1, v + e)).sub(superficie(u, Math.max(-1, v - e)));
  const n = new THREE.Vector3().crossVectors(dv, du).normalize(); if (n.y < 0) n.negate();
  return p.addScaledVector(n, sobe);
}
/** a normal da superfície em (u, v) (diferenças finitas) */
function normalDoCasco(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.004, du = superficie(Math.min(1, u + e), v).sub(superficie(Math.max(-1, u - e), v)), dv = superficie(u, Math.min(1, v + e)).sub(superficie(u, Math.max(-1, v - e)));
  out.crossVectors(dv, du).normalize(); if (out.y < 0) out.negate(); return out;
}
/** da VISTA DE CIMA (X, Z em metros) pro (u, v) da superfície — o que passa da beira fica na beira */
function uvDoPlano(X: number, Z: number): [number, number] {
  const v = Math.max(-0.995, Math.min(0.995, vDe(Z)));
  return [Math.max(-0.995, Math.min(0.995, X / (CASCO.a * Math.max(0.04, larguraEm(v))))), v];
}
/** o CENTRO (X, Z) do hexágono da malha que contém o ponto (X, Z) — coordenadas axiais (hexágonos de ponta no comprimento) */
function centroDoHex(X: number, Z: number): [number, number] {
  const R = HEX.r, z = Z / HEX.alonga, qf = ((Math.sqrt(3) / 3) * X - z / 3) / R, rf = ((2 / 3) * z) / R, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf); const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [R * Math.sqrt(3) * (q + r / 2), R * 1.5 * r * HEX.alonga];
}
/** o CONTORNO do hexágono de centro (cX, cZ) na vista de cima: os cantos ARREDONDADOS (uma curva em cada canto) e
 *  encolhido pela junta. `arred` 0 = cantos vivos (o vidro: as peças dele se encaixam sem fresta) */
function contornoDoHex(cX: number, cZ: number, junta: number, arred: number): [number, number][] {
  const R = HEX.r - junta, cantos = [0, 1, 2, 3, 4, 5].map((k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return [cX + R * Math.cos(a), cZ + R * Math.sin(a) * HEX.alonga] as const; });
  const out: [number, number][] = [], NC = 5, NA = 3;
  for (let i = 0; i < 6; i++) {
    const p = cantos[i]!, a = cantos[(i + 5) % 6]!, b = cantos[(i + 1) % 6]!;
    const ini: [number, number] = [p[0] + (a[0] - p[0]) * arred * 0.5, p[1] + (a[1] - p[1]) * arred * 0.5], fim: [number, number] = [p[0] + (b[0] - p[0]) * arred * 0.5, p[1] + (b[1] - p[1]) * arred * 0.5];
    for (let j = 0; j <= NC; j++) { const t = j / NC, w0 = (1 - t) * (1 - t), w1 = 2 * t * (1 - t), w2 = t * t; out.push([w0 * ini[0] + w1 * p[0] + w2 * fim[0], w0 * ini[1] + w1 * p[1] + w2 * fim[1]]); }   // a curva do canto
    const prox: [number, number] = [b[0] + (p[0] - b[0]) * arred * 0.5, b[1] + (p[1] - b[1]) * arred * 0.5];
    for (let j = 1; j < NA; j++) { const t = j / NA; out.push([fim[0] + (prox[0] - fim[0]) * t, fim[1] + (prox[1] - fim[1]) * t]); }   // a aresta (em pedaços: acompanha a curva do casco)
  }
  return out;
}
/** a PLACA de um hexágono RENTE ao casco: o contorno (na vista de cima) projetado na superfície, afastado `sobe`, com
 *  anéis por dentro e a NORMAL DA SUPERFÍCIE em cada vértice — a luz corre contínua de uma placa pra outra (o carro lê
 *  como uma peça lisa e aerodinâmica, só com as juntas desenhando os hexágonos) */
function placaNoCasco(contorno: [number, number][], cX: number, cZ: number, sobe: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [], n = new THREE.Vector3(), ANEIS = [0.34, 0.68, 1];
  const vert = (X: number, Z: number) => { const [u, v] = uvDoPlano(X, Z), p = superficie(u, v); normalDoCasco(u, v, n); p.addScaledVector(n, sobe); pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); return pos.length / 3 - 1; };
  const c0 = vert(cX, cZ), L = contorno.length, aneis = ANEIS.map((k) => contorno.map(([X, Z]) => vert(cX + (X - cX) * k, cZ + (Z - cZ) * k)));
  // (a ordem dos vértices deixa a FRENTE dos triângulos pra fora — senão a luz batia no lado de dentro e a placa ficava preta)
  for (let i = 0; i < L; i++) { const j = (i + 1) % L; idx.push(c0, aneis[0]![j]!, aneis[0]![i]!); }
  for (let a = 0; a < ANEIS.length - 1; a++) for (let i = 0; i < L; i++) { const j = (i + 1) % L, p = aneis[a]!, q = aneis[a + 1]!; idx.push(p[i]!, q[j]!, q[i]!, p[i]!, p[j]!, q[j]!); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
/** pinta os vértices (a degradê da lataria) */
function pintar(g: THREE.BufferGeometry, cor: (p: THREE.Vector3) => THREE.Color) {
  const pos = g.attributes.position!, col = new Float32Array(pos.count * 3), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { const c = cor(p.fromBufferAttribute(pos, i)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

/** a COR da lataria (lib/cyber/carros `CorCarro`): um giro de matiz sobre o laranja/vermelho original e a
 *  saturação/claridade a somar */
const girar = (c: THREE.Color, k?: CorCarro) => (k ? c.offsetHSL(k.matiz, k.sat ?? 0, k.luz ?? 0) : c);

type Mats = Record<"chassi" | "saia" | "laranja" | "laranja2" | "brilhoCauda" | "chama" | "chamaNucleo" | "clarao" | "junta" | "brilhoVidro" | "aceso" | "vidro" | "dentro" | "banco" | "tela" | "branco" | "verde" | "jato", THREE.Material>;

function criarMats(cor?: CorCarro): Mats {
  // a lataria: do vermelho (em cima, atrás) ao laranja (embaixo, na frente) — cor por vértice, como a degradê das refs
  const M: Mats = {
    chassi: new THREE.MeshPhysicalMaterial({ color: 0x07080b, metalness: 0.4, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }),
    saia: new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.3, roughness: 0.55 }),
    laranja: new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),
    brilhoVidro: new THREE.LineBasicMaterial({ color: 0xffa64d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    brilhoCauda: new THREE.MeshBasicMaterial({ color: 0xffa64d }),
    chama: new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    chamaNucleo: new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    clarao: new THREE.SpriteMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,210,1)"); gr.addColorStop(0.35, "rgba(255,140,40,.7)"); gr.addColorStop(1, "rgba(255,80,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    laranja2: new THREE.MeshPhysicalMaterial({ color: 0xd9431f, metalness: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide }),   // (as aletas: o vermelho-laranja da traseira)
    junta: new THREE.MeshStandardMaterial({ color: 0x8a2a12, metalness: 0.2, roughness: 0.45, side: THREE.DoubleSide }),   // (a junta entre os hexágonos: lataria mais escura, não preta)
    aceso: new THREE.MeshStandardMaterial({ color: 0xffb02e, emissive: 0xff8a10, emissiveIntensity: 1.1, roughness: 0.35, flatShading: true, side: THREE.DoubleSide }),
    vidro: new THREE.MeshPhysicalMaterial({ color: 0x05070c, metalness: 0.2, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide }),   // (escuro e espelhado — opaco: o interior não aparece)
    dentro: new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.8, side: THREE.DoubleSide }),
    banco: new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.6, metalness: 0.1 }),
    tela: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    branco: new THREE.MeshBasicMaterial({ color: 0xf2f6ff }),
    verde: new THREE.MeshBasicMaterial({ color: 0x3dff7a }),
    jato: new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  // a COR da frota: as peças da lataria (as aletas, as juntas, o hexágono aceso e os brilhos) giram junto
  if (cor) for (const m of [M.laranja2, M.junta, M.aceso, M.brilhoCauda, M.brilhoVidro] as (THREE.Material & { color: THREE.Color; emissive?: THREE.Color })[]) { girar(m.color, cor); if (m.emissive) girar(m.emissive, cor); }
  return M;
}

export function criarCarroHex(o: { low: boolean; cor?: CorCarro }): CarroHandle {
  const group = new THREE.Group(); group.name = "carro-hex";
  const M = criarMats(o.cor), geos: THREE.BufferGeometry[] = [], extras: THREE.Texture[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D = group) => { geos.push(g); const k = new THREE.Mesh(g, m); pai.add(k); return k; };
  const vermelho = girar(new THREE.Color(0xd8341e), o.cor), laranja = girar(new THREE.Color(0xff7a2a), o.cor), claro = girar(new THREE.Color(0xffb38a), o.cor);
  const corDaLataria = (p: THREE.Vector3) => { const k = THREE.MathUtils.clamp((p.y - 0.55) / 0.66 * 0.55 + (-p.z + 2.95) / 5.9 * 0.45, 0, 1); return laranja.clone().lerp(vermelho, k).lerp(claro, Math.max(0, 0.3 - Math.abs(p.x) * 0.25) * (p.y > 1.1 ? 1 : 0)); };

  // ── o CHASSI (a faixa preta brilhante) e a SAIA por baixo ──
  const forma = (k: number) => { const s = new THREE.Shape(); PLANTA.forEach(([x, z], i) => (i ? s.lineTo(x * k, -z * k) : s.moveTo(x * k, -z * k))); s.closePath(); return s; };
  const chassi = add(new THREE.ExtrudeGeometry(forma(1.02), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: o.low ? 1 : 3 }), M.chassi);
  chassi.rotation.x = -Math.PI / 2; chassi.position.y = 0.3;
  const saia = add(new THREE.ExtrudeGeometry(forma(0.78), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }), M.saia);
  saia.rotation.x = -Math.PI / 2; saia.position.y = 0.1;
  // os "PÉS" angulosos da saia (os blocos embaixo das refs) e os PROPULSORES (discos acesos)
  const jatos: THREE.Mesh[] = [];
  for (const [x, z] of [[0.9, 1.25], [-0.9, 1.25], [0.95, -0.95], [-0.95, -0.95]] as const) {
    const pe = add(new THREE.BoxGeometry(0.36, 0.12, 0.5), M.saia); pe.position.set(x, 0.06, z); pe.rotation.y = x * z > 0 ? 0.3 : -0.3;
    const j = add(new THREE.CircleGeometry(0.15, 20), M.jato); j.rotation.x = Math.PI / 2; j.position.set(x, -0.005, z); jatos.push(j);
  }
  // as LUZES: as faixas brancas (frente, traseira e laterais) e os LEDs verdes
  for (const [x, y, z, w, ry] of [[0, 0.42, 2.56, 0.5, 0], [0, 0.42, -1.88, 0.8, 0], [1.33, 0.4, -0.1, 0.9, Math.PI / 2], [-1.33, 0.4, -0.1, 0.9, Math.PI / 2]] as const) {
    const f = add(new THREE.BoxGeometry(w, 0.025, 0.02), M.branco); f.position.set(x, y, z); f.rotation.y = ry;
  }
  for (const [x, z] of [[1.3, 0.7], [-1.3, 0.7], [1.33, -0.9], [-1.33, -0.9], [0.45, 2.0], [-0.45, 2.0]] as const) {
    const l = add(new THREE.SphereGeometry(0.035, 8, 6), M.verde); l.position.set(x, 0.5, z);
  }
  // o LOGO ("zaeon") na lateral do chassi
  const texLogo = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d")!; g.fillStyle = "rgba(0,0,0,0)"; g.fillRect(0, 0, 256, 64); g.fillStyle = "#e9edf5"; g.font = "italic 600 40px system-ui, sans-serif"; g.fillText("zaeon", 40, 46); return c; })());
  extras.push(texLogo);
  const matLogo = new THREE.MeshBasicMaterial({ map: texLogo, transparent: true, depthWrite: false });
  for (const s of [1, -1]) { const lg = add(new THREE.PlaneGeometry(0.62, 0.16), matLogo); lg.position.set(s * 1.34, 0.42, 0.45); lg.rotation.y = s * Math.PI / 2; }

  // ── o CASCO de HEXÁGONOS: hexágonos grandes de cantos arredondados, RENTES à superfície (só a junta fina os desenha).
  // No meio da frente, os do VIDRO (escuros, contínuos); nos lados do cockpit, os das PORTAS (que sobem junto com o
  // hexágono lateral aceso); o resto, a lataria fixa ──
  const fixo = new THREE.Group(); group.add(fixo);
  const portas = [-1, 1].map((lado) => { const g = new THREE.Group(); g.position.set(lado * 1.3, PORTA.pivoY, PORTA.pivoZ); g.userData.lado = lado; group.add(g); return g; });
  const noPivo = (pivo: THREE.Object3D, g: THREE.BufferGeometry) => { g.translate(-pivo.position.x, -pivo.position.y, -pivo.position.z); return g; };
  const s3 = Math.sqrt(3), vidros: { g: THREE.Group; eixo: THREE.Vector3; ordem: number; base: THREE.Vector3; frenteT: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
    const cX = HEX.r * s3 * (q + r / 2), cZ = HEX.r * 1.5 * r * HEX.alonga;   // o centro (em metros, na vista de cima)
    if (cZ > CASCO.c + HEX.r || cZ < -CASCO.c * TRASEIRA.cauda - HEX.r || Math.abs(cX) > CASCO.a * larguraEm(Math.max(-1, Math.min(1, vDe(cZ)))) + HEX.r * 0.9) continue;   // (fora do carro)
    const [cu, cv] = uvDoPlano(cX, cZ), tipo = tipoDoHex(cu, cv);
    const contorno = contornoDoHex(cX, cZ, HEX.junta, HEX.arred), cheio = contornoDoHex(cX, cZ, 0, 0);
    const placa = placaNoCasco(contorno, cX, cZ, PLACA), forro = placaNoCasco(cheio, cX, cZ, FORRO);   // (a junta fina, na cor da lataria — nada de colmeia)
    if (tipo === "vidro" && !abreDoVidro(cu, cv)) { add(placaNoCasco(cheio, cX, cZ, PLACA), M.vidro, fixo); add(forro, M.chassi, fixo); geos.push(placa); continue; }   // (o resto do vidro: fixo)
    if (tipo === "vidro") {   // o vidro: uma peça escura CONTÍNUA (sem junta) — os do lado do PASSAGEIRO são TAMPAS que levantam
      const [fu, fv] = uvDoPlano(cX, cZ + HEX.r * HEX.alonga * 0.95), g = new THREE.Group(); g.position.copy(pontoDoCasco(fu, fv, PLACA)); group.add(g);
      const eixo = pontoDoCasco(Math.min(1, cu + 0.05), cv, 0).sub(pontoDoCasco(Math.max(-1, cu - 0.05), cv, 0)).normalize();
      add(noPivo(g, placaNoCasco(cheio, cX, cZ, PLACA)), M.vidro, g); add(noPivo(g, placaNoCasco(cheio, cX, cZ, FORRO)), M.chassi, g);
      // o CONTORNO DE LUZ da placa (acende enquanto ela destrava e desliza — o movimento lê no preto sobre preto)
      const linha = contornoDoHex(cX, cZ, 0.01, 0).map(([X, Z]) => { const [u, v] = uvDoPlano(X, Z); return pontoDoCasco(u, v, PLACA + 0.004).sub(g.position); });
      const gl = new THREE.BufferGeometry().setFromPoints(linha); geos.push(gl); g.add(new THREE.LineLoop(gl, M.brilhoVidro));
      // (pra onde ele desliza: a tangente do casco pra FRENTE ali; e a normal — pra onde ele destrava)
    const frenteT = pontoDoCasco(cu, Math.min(1, cv + 0.05), 0).sub(pontoDoCasco(cu, Math.max(-1, cv - 0.05), 0)).normalize();
    vidros.push({ g, eixo, ordem: cv - Math.abs(cu) * 0.3, base: g.position.clone(), frenteT, normal: normalDoCasco(cu, cv) }); geos.push(placa, forro); continue;
    }
    const cor = tipo === "porta-e" || tipo === "porta-d" ? portas[tipo === "porta-e" ? 1 : 0]! : null;
    pintar(placa, corDaLataria);
    if (cor) { add(noPivo(cor, placa), M.laranja, cor); add(noPivo(cor, forro), M.junta, cor); }
    else { add(placa, M.laranja, fixo); add(forro, M.junta, fixo); }
  }
  // o CASCO por baixo de tudo, na cor da junta (fecha o carro: nada do interior aparece pelas frestas nem pela borda) — menos onde
  // ficam as portas (lá quem fecha é o forro da própria porta, que sobe junto)
  {
    const pos: number[] = [], NU = o.low ? 16 : 32, NV = o.low ? 24 : 48;
    const fora = (u: number, v: number) => { const p = superficie(u, v), [cX, cZ] = centroDoHex(p.x, p.z), [cu, cv] = uvDoPlano(cX, cZ), t = tipoDoHex(cu, cv); return t === "porta-e" || t === "porta-d" || (t === "vidro" && abreDoVidro(cu, cv)); };   // (debaixo do que abre: o vão do cockpit)
    for (let i = 0; i < NU; i++) for (let k = 0; k < NV; k++) {
      const P = (a: number, b: number) => [(a / NU) * 2 - 1, (b / NV) * 2 - 1] as const;
      const qd = [P(i, k), P(i + 1, k), P(i + 1, k + 1), P(i, k + 1)];
      const mu = (qd[0]![0] + qd[2]![0]) / 2, mv = (qd[0]![1] + qd[2]![1]) / 2;
      if (fora(mu, mv)) continue;
      for (const [x, y] of [qd[0]!, qd[1]!, qd[2]!, qd[0]!, qd[2]!, qd[3]!]) { const p = pontoDoCasco(x, y, 0); pos.push(p.x, p.y, p.z); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    add(g, M.junta, fixo);
  }
  // o HEXÁGONO LATERAL aceso (a peça grande da porta, como na imagem de lado) com a moldura preta
  for (const p of portas) {
    const lado = p.userData.lado as number, hx = new THREE.Group(); p.add(hx);
    // (posto NA superfície do casco ali — um pouco pra fora dela — e inclinado como ela)
    const [hu, hv] = uvDoPlano(lado * CASCO.a * 0.985, PORTA.ladoZ), sp = pontoDoCasco(hu, hv, 0.035), sn = normalDoCasco(hu, hv);
    hx.position.set(sp.x - p.position.x, Math.max(0.66, sp.y) - p.position.y, sp.z - p.position.z); hx.rotation.set(0, lado * Math.PI / 2, 0); hx.rotateX(-Math.asin(Math.min(0.9, sn.y)));
    const forma = (w: number, h: number) => { const f = new THREE.Shape(); f.moveTo(-w / 2, 0); f.lineTo(-w / 2 + h * 0.6, h / 2); f.lineTo(w / 2 - h * 0.6, h / 2); f.lineTo(w / 2, 0); f.lineTo(w / 2 - h * 0.6, -h / 2); f.lineTo(-w / 2 + h * 0.6, -h / 2); f.closePath(); return f; };
    const moldura = add(new THREE.ShapeGeometry(forma(2.05, 0.62)), M.junta, hx); moldura.position.z = -0.005;
    const luz = add(new THREE.ShapeGeometry(forma(1.86, 0.48)), M.aceso, hx); luz.position.z = 0.012;
    if (lado < 0) { moldura.scale.x = -1; luz.scale.x = -1; }
  }

  // a BARRIGA da cauda: por baixo do braço, fechando o tubo — a parte de baixo SUBINDO da cabine até o braço (o
  // "upsweep" dos helicópteros)
  {
    const pos: number[] = [], NU = o.low ? 6 : 8, NV = o.low ? 10 : 14, v0 = -0.2;   // (poucos polígonos: por baixo quase não se vê)
    const P = (u: number, v: number) => { const t = superficie(u, v), esp = TRASEIRA.barriga * sm(-0.2, -0.5, v) * (1 - sm(-0.9, -1, v) * 0.8); return new THREE.Vector3(t.x, baseEm(v) - esp * Math.pow(Math.max(0, 1 - u * u), 0.5), t.z); };
    for (let i = 0; i < NU; i++) for (let k = 0; k < NV; k++) {
      const u0 = (i / NU) * 2 - 1, u1 = ((i + 1) / NU) * 2 - 1, va = v0 + ((k / NV) * (-0.995 - v0)), vb = v0 + (((k + 1) / NV) * (-0.995 - v0));
      for (const p of [P(u0, va), P(u0, vb), P(u1, vb), P(u0, va), P(u1, vb), P(u1, va)]) pos.push(p.x, p.y, p.z);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    add(g, M.junta, fixo);
  }
  // os EXAUSTORES na ponta da cauda (no lugar da barbatana, do rotor e dos estabilizadores — bem menos polígonos): dois
  // bocais escuros com o miolo aceso e o FOGO saindo pra trás (um cone laranja aditivo com o núcleo azulado e o clarão),
  // que cresce com a velocidade e tremula
  const fogos: { chama: THREE.Mesh; nucleo: THREE.Mesh; clarao: THREE.Sprite }[] = [];
  {
    const vp = -0.975, base = superficie(0, vp), seg = o.low ? 10 : 14;
    const geoBocal = new THREE.CylinderGeometry(0.1, 0.12, 0.34, seg, 1, true), geoMiolo = new THREE.CircleGeometry(0.085, seg), geoAro = new THREE.TorusGeometry(0.1, 0.018, 6, seg);
    const geoChama = new THREE.ConeGeometry(0.085, 1, seg, 1, true), geoNucleo = new THREE.ConeGeometry(0.045, 1, seg, 1, true);
    geoChama.translate(0, -0.5, 0); geoNucleo.translate(0, -0.5, 0);   // (a base do cone no bocal; ele cresce pra trás)
    geos.push(geoBocal, geoMiolo, geoAro, geoChama, geoNucleo);
    for (const sx of [1, -1]) {
      const b = new THREE.Group(); b.position.set(sx * 0.11, base.y + 0.02, base.z - 0.05); b.rotation.x = -Math.PI / 2; fixo.add(b);   // (o +y do bocal = pra TRÁS: o fogo sai por ali)
      b.add(new THREE.Mesh(geoBocal, M.chassi));
      const aro = new THREE.Mesh(geoAro, M.brilhoCauda); aro.position.y = 0.17; aro.rotation.x = Math.PI / 2; b.add(aro);
      const miolo = new THREE.Mesh(geoMiolo, M.chama); miolo.position.y = 0.1; miolo.rotation.x = Math.PI / 2; b.add(miolo);
      const chama = new THREE.Mesh(geoChama, M.chama); chama.rotation.x = Math.PI; chama.position.y = 0.17; b.add(chama);
      const nucleo = new THREE.Mesh(geoNucleo, M.chamaNucleo); nucleo.rotation.x = Math.PI; nucleo.position.y = 0.17; b.add(nucleo);
      const clarao = new THREE.Sprite(M.clarao as THREE.SpriteMaterial); clarao.position.y = 0.22; clarao.scale.setScalar(0.5); b.add(clarao);
      fogos.push({ chama, nucleo, clarao });
    }
  }

  // ── o COCKPIT: a banheira, o banco, o painel com 3 telas e o manche ──
  const cockpit = new THREE.Group(); group.add(cockpit);
  const banheira = add(new THREE.BoxGeometry(1.35, 0.32, 2.3), M.dentro, cockpit); banheira.position.set(0, 0.42, 0.3);
  const assentoMesh = add(new THREE.BoxGeometry(0.6, 0.12, 0.62), M.banco, cockpit); assentoMesh.position.set(0, 0.52, -0.1);
  const encosto = add(new THREE.BoxGeometry(0.6, 0.66, 0.13), M.banco, cockpit); encosto.position.set(0, 0.82, -0.5); encosto.rotation.x = -0.42;   // (reclinado: carro de corrida)
  const cabeca = add(new THREE.BoxGeometry(0.32, 0.2, 0.12), M.banco, cockpit); cabeca.position.set(0, 1.12, -0.66); cabeca.rotation.x = -0.42;
  const texTela = new THREE.CanvasTexture((() => {
    const c = document.createElement("canvas"); c.width = 192; c.height = 128; const g = c.getContext("2d")!;
    g.fillStyle = "#0b1220"; g.fillRect(0, 0, 192, 128); g.strokeStyle = "#7fd8ff"; g.lineWidth = 2; g.strokeRect(4, 4, 184, 120);
    g.fillStyle = "#ffb02e"; g.fillRect(14, 16, 70, 8); g.fillStyle = "#7fd8ff"; for (let i = 0; i < 5; i++) g.fillRect(14, 36 + i * 15, 40 + ((i * 37) % 90), 5);
    g.strokeStyle = "#3dff7a"; g.beginPath(); g.arc(150, 70, 26, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(150, 70); g.lineTo(168, 52); g.stroke();
    return c; })());
  texTela.colorSpace = THREE.SRGBColorSpace; extras.push(texTela);
  const matTela = new THREE.MeshBasicMaterial({ map: texTela });
  const painelDash = add(new THREE.BoxGeometry(1.15, 0.2, 0.32), M.chassi, cockpit); painelDash.position.set(0, 0.78, 0.98); painelDash.rotation.x = 0.35;
  for (const [x, ry] of [[-0.38, 0.28], [0, 0], [0.38, -0.28]] as const) { const tl = add(new THREE.PlaneGeometry(0.34, 0.24), matTela, cockpit); tl.position.set(x, 0.9, 0.9); tl.rotation.set(-0.55, ry, 0); }
  const coluna = add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8), M.chassi, cockpit); coluna.position.set(0, 0.76, 0.7); coluna.rotation.x = 1.05;
  const manche = add(new THREE.TorusGeometry(0.17, 0.025, 6, 20, Math.PI), M.chassi, cockpit); manche.position.set(0, 0.84, 0.56); manche.rotation.set(-0.5, 0, Math.PI);
  const assento = new THREE.Object3D(); assento.position.set(0, 0.6, -0.1); group.add(assento);
  const maoE = new THREE.Object3D(), maoD = new THREE.Object3D(), peE = new THREE.Object3D(), peD = new THREE.Object3D();
  maoE.position.set(0.17, 0.8, 0.56); maoD.position.set(-0.17, 0.8, 0.56); peE.position.set(0.18, 0.36, 1.05); peD.position.set(-0.18, 0.36, 1.05);
  group.add(maoE, maoD, peE, peD);

  // ── a SOMBRA embaixo (ele paira) ──
  const texSombra = new THREE.CanvasTexture((() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })());
  extras.push(texSombra);
  const sombra = add(new THREE.PlaneGeometry(3.4, 5.4), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = -0.5; sombra.userData.semLote = true;

  let aberto = 0;
  // a ordem da CASCATA: os hexágonos do vidro levantam um atrás do outro, da frente pra trás; as portas vêm por último
  vidros.sort((x, y) => y.ordem - x.ordem);
  const suave = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  const aplicar = () => {
    // a ORDEM: a porta do MOTORISTA (esquerda) primeiro; depois, em cascata, os hexágonos do vidro do lado do passageiro;
    // por último a porta do PASSAGEIRO (direita)
    let brilho = 0;
    vidros.forEach((v, i) => {   // DESTRAVA → DESLIZA pra frente → EMPILHA (a de trás por cima da da frente)
      const ini = 0.2 + (vidros.length > 1 ? (i / (vidros.length - 1)) * 0.22 : 0), k = Math.max(0, Math.min(1, (aberto - ini) / 0.4));
      const sobe = suave(k / 0.22), vai = suave((k - 0.15) / 0.85);
      v.g.position.copy(v.base).addScaledVector(v.normal, (VIDRO.destrava + VIDRO.degrau * i) * sobe).addScaledVector(v.frenteT, VIDRO.desliza * vai);
      v.g.quaternion.setFromAxisAngle(v.eixo, -VIDRO.inclina * vai);   // (o bico desce um tiquinho: acompanha o para-brisa)
      brilho = Math.max(brilho, Math.sin(Math.PI * Math.min(1, k * 1.05)) * 0.95 + 0.25 * vai);   // (acende movendo; empilhado, fica um fio aceso)
    });
    (M.brilhoVidro as THREE.LineBasicMaterial).opacity = Math.min(1, brilho);
    // TESOURA: cada porta gira pra CIMA em volta da dobradiça da frente (a traseira dela sobe) e abre um pouco pra fora
    for (const p of portas) {
      const lado = p.userData.lado as number, e = lado > 0 ? suave(aberto / 0.45) : suave((aberto - 0.55) / 0.45);
      p.rotation.set(PORTA.sobe * e, 0, lado * PORTA.abre * e, "ZXY");
    }
  };
  // ── LEVE (out/2026, o dono: "a cidadela mais leve"): eram 87 peças = 87 desenhos POR CARRO (17 carros na Zaeon). A
  //    lataria — tudo o que não mexe — vai pra um CORPO só (é ele que boia) e é fundida por material
  //    (components/cyber/lotes); portas e vidros (abrem), jatos e fogo (pulsam) e os pontos do motorista ficam soltos ──
  const corpo = new THREE.Group(); corpo.name = "carro-corpo";
  for (const c of [...group.children]) if (c !== sombra) corpo.add(c);
  group.add(corpo);
  for (const p of portas) p.userData.lote = "limite";
  for (const v of vidros) v.g.userData.lote = "limite";
  fundirEstaticos(corpo, { manter: [...portas, ...vidros.map((v) => v.g), ...jatos, ...fogos.flatMap((f) => [f.chama, f.nucleo, f.clarao]), assento, maoE, maoD, peE, peD] });
  aplicar();
  return {
    group, assento, pontos: { maoE, maoD, peE, peD }, nVidros: vidros.length,
    abrir(k) { aberto = THREE.MathUtils.clamp(k, 0, 1); aplicar(); },
    atualizar(t, dt, op) {
      void dt;
      const ligado = op?.ligado ?? true, vel = op?.vel ?? 0;
      // pairando: sobe e desce devagar; os propulsores pulsam (mais fortes andando)
      const boia = 0.04 * Math.sin(t * 1.6);
      group.children.forEach((c) => { if (c !== sombra) c.position.y = (c.userData.y0 ??= c.position.y) + boia; });
      const forca = ligado ? 0.6 + 0.4 * Math.min(1, vel / 20) : 0.1;
      (M.jato as THREE.MeshBasicMaterial).opacity = forca * (0.8 + 0.2 * Math.sin(t * 13));
      for (const j of jatos) j.scale.setScalar(0.85 + 0.25 * forca);
      (M.aceso as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + 0.25 * Math.sin(t * 2.2);
      // o FOGO dos exaustores: desligado some; ligado, uma chama curta tremulando que ESTICA com a velocidade
      const v01 = Math.min(1, vel / 40);
      fogos.forEach((f, i) => {
        const treme = 0.85 + 0.15 * Math.sin(t * 31 + i * 2) + 0.08 * Math.sin(t * 57 + i);
        const len = ligado ? (0.28 + 1.1 * v01) * treme : 0;
        f.chama.visible = f.nucleo.visible = f.clarao.visible = len > 0.01;
        f.chama.scale.set(1 + 0.4 * v01, len, 1 + 0.4 * v01); f.nucleo.scale.set(1, len * 0.6, 1);
        f.clarao.scale.setScalar((0.35 + 0.45 * v01) * treme);
      });
      (M.chama as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * v01;
    },
    dispose() { corpo.traverse((n) => { if (n.name === "lote") (n as THREE.Mesh).geometry?.dispose(); }); for (const g of geos) g.dispose(); (M.clarao as THREE.SpriteMaterial).map?.dispose(); for (const m of Object.values(M)) m.dispose(); matLogo.dispose(); matTela.dispose(); for (const x of extras) x.dispose(); group.removeFromParent(); },
  };
}
