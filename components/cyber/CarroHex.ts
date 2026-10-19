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
 * LEVE (vários carros no mapa, como as motos): o casco é UMA malha lisa com os hexágonos, as juntas, a degradê e o
 * vidro PINTADOS numa textura (feita uma vez); só as peças que abrem (as 2 portas, os 2 vidros que deslizam) são
 * malhas à parte. Material padrão com brilho MODERADO (sem verniz). Geometrias, texturas e materiais são
 * COMPARTILHADOS por todos os carros (`recursos`) — cada carro só tem os grupos e ~14 desenhos; o cockpit só desenha
 * com a cabine aberta.
 *
 * Referencial: +z = a FRENTE, +y = cima, y = 0 = a base da saia (o carro paira acima do chão).
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
/** a TEXTURA do casco cobre a vista de cima: X de −a a +a, Z da ponta da cauda ao bico */
const TEX = { zMin: -CASCO.c * TRASEIRA.cauda - 0.2, zMax: CASCO.c + 0.2, xMax: CASCO.a + 0.1, w: 512, h: 1024 } as const;
const uvDe = (X: number, Z: number): [number, number] => [(X + TEX.xMax) / (2 * TEX.xMax), (Z - TEX.zMin) / (TEX.zMax - TEX.zMin)];

/** uma PLACA (o contorno de um hexágono na vista de cima) RENTE ao casco, afastada `sobe`, com normal e UV */
function placaNoCasco(contorno: [number, number][], cX: number, cZ: number, sobe: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [], n = new THREE.Vector3(), ANEIS = [0.5, 1];
  const vert = (X: number, Z: number) => { const [u, v] = uvDoPlano(X, Z), p = superficie(u, v); normalDoCasco(u, v, n); p.addScaledVector(n, sobe); pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(...uvDe(p.x, p.z)); return pos.length / 3 - 1; };
  const c0 = vert(cX, cZ), L = contorno.length, aneis = ANEIS.map((k) => contorno.map(([X, Z]) => vert(cX + (X - cX) * k, cZ + (Z - cZ) * k)));
  // (a ordem dos vértices deixa a FRENTE dos triângulos pra fora)
  for (let i = 0; i < L; i++) { const j = (i + 1) % L; idx.push(c0, aneis[0]![j]!, aneis[0]![i]!); }
  for (let a = 0; a < ANEIS.length - 1; a++) for (let i = 0; i < L; i++) { const j = (i + 1) % L, p = aneis[a]!, q = aneis[a + 1]!; idx.push(p[i]!, q[j]!, q[i]!, p[i]!, p[j]!, q[j]!); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g.toNonIndexed();
}
/** (pra juntar malhas: tudo sem índice e com normal + uv) */
const prep = (g: THREE.BufferGeometry, uvFixo?: [number, number]) => {
  const n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals();
  if (uvFixo || !n.attributes.uv) { const c = n.attributes.position!.count, a = new Float32Array(c * 2); for (let i = 0; i < c; i++) a.set(uvFixo ?? [0.5, 0.5], i * 2); n.setAttribute("uv", new THREE.BufferAttribute(a, 2)); }
  for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "uv" && k !== "color") n.deleteAttribute(k);
  return n;
};
const juntar = (gs: THREE.BufferGeometry[]) => { const g = mergeGeometries(gs)!; for (const x of gs) x.dispose(); return g; };
const colorir = (g: THREE.BufferGeometry, cor: number) => { const c = new THREE.Color(cor), n = g.attributes.position!.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };

/** a TEXTURA do casco: cada hexágono pintado (o vidro preto, a lataria na degradê do laranja ao vermelho — mais clara
 *  em cima, no meio) e as JUNTAS finas num laranja escuro (o fundo) */
function texturaDoCasco(low: boolean): THREE.CanvasTexture {
  const W = low ? 256 : TEX.w, H = low ? 512 : TEX.h, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!, px = (X: number, Z: number): [number, number] => { const [u, v] = uvDe(X, Z); return [u * W, (1 - v) * H]; };
  g.fillStyle = "#6a1f0c"; g.fillRect(0, 0, W, H);
  const s3 = Math.sqrt(3);
  for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
    const cX = HEX.r * s3 * (q + r / 2), cZ = HEX.r * 1.5 * r * HEX.alonga;
    if (cZ > TEX.zMax + HEX.r || cZ < TEX.zMin - HEX.r || Math.abs(cX) > TEX.xMax + HEX.r) continue;
    const [cu, cv2] = uvDoPlano(cX, cZ), tipo = tipoDoHex(cu, cv2), vidro = tipo === "vidro";
    const ct = contornoDoHex(cX, cZ, vidro ? 0 : HEX.junta, vidro ? 0 : HEX.arred);
    g.beginPath(); ct.forEach(([X, Z], i) => { const [x, y] = px(X, Z); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath();
    if (vidro) { g.fillStyle = "#06070a"; g.fill(); continue; }
    const k = THREE.MathUtils.clamp((-cZ + CASCO.c) / (CASCO.c * (1 + TRASEIRA.cauda)), 0, 1);
    const [x0, y0] = px(cX, cZ - HEX.r * HEX.alonga), [x1, y1] = px(cX, cZ + HEX.r * HEX.alonga), gr = g.createLinearGradient(x0, y0, x1, y1);
    const base = new THREE.Color(0xff7a2a).lerp(new THREE.Color(0xd8341e), k), claro = base.clone().lerp(new THREE.Color(0xffc29a), 0.22);
    gr.addColorStop(0, `#${base.getHexString()}`); gr.addColorStop(1, `#${claro.getHexString()}`);   // (cada placa com um tiquinho de brilho próprio)
    g.fillStyle = gr; g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** os RECURSOS compartilhados por TODOS os carros (geometrias, texturas, materiais) — feitos uma vez */
type Recursos = {
  mats: { casco: THREE.MeshStandardMaterial; chassi: THREE.MeshStandardMaterial; aceso: THREE.MeshBasicMaterial; luzes: THREE.MeshBasicMaterial; jato: THREE.MeshBasicMaterial; cabine: THREE.MeshLambertMaterial; tela: THREE.MeshBasicMaterial; sombra: THREE.MeshBasicMaterial; brilho: THREE.LineBasicMaterial };
  geo: { casco: THREE.BufferGeometry; portas: THREE.BufferGeometry[]; vidros: { g: THREE.BufferGeometry; linha: THREE.BufferGeometry; base: THREE.Vector3; eixo: THREE.Vector3; frente: THREE.Vector3; normal: THREE.Vector3; ordem: number }[]; ladoAceso: THREE.BufferGeometry; chassi: THREE.BufferGeometry; caudaLaranja: THREE.BufferGeometry; caudaEscura: THREE.BufferGeometry; luzes: THREE.BufferGeometry; jatos: THREE.BufferGeometry; cabine: THREE.BufferGeometry; telas: THREE.BufferGeometry; sombra: THREE.BufferGeometry };
  pivoPorta: THREE.Vector3[];
};
const recursos = new Map<boolean, Recursos>();
function criarRecursos(low: boolean): Recursos {
  const texCasco = texturaDoCasco(low);
  const mats: Recursos["mats"] = {
    casco: new THREE.MeshStandardMaterial({ map: texCasco, metalness: 0.25, roughness: 0.34, envMapIntensity: 0.7 }),   // (brilho MODERADO, sem verniz)
    chassi: new THREE.MeshStandardMaterial({ color: 0x0a0b0e, metalness: 0.35, roughness: 0.38 }),
    aceso: new THREE.MeshBasicMaterial({ color: 0xffb54a }),
    luzes: new THREE.MeshBasicMaterial({ vertexColors: true }),
    jato: new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    cabine: new THREE.MeshLambertMaterial({ color: 0x15161b }),
    tela: new THREE.MeshBasicMaterial({ map: (() => { const c = document.createElement("canvas"); c.width = 192; c.height = 128; const g = c.getContext("2d")!; g.fillStyle = "#0b1220"; g.fillRect(0, 0, 192, 128); g.strokeStyle = "#7fd8ff"; g.lineWidth = 2; g.strokeRect(4, 4, 184, 120); g.fillStyle = "#ffb02e"; g.fillRect(14, 16, 70, 8); g.fillStyle = "#7fd8ff"; for (let i = 0; i < 5; i++) g.fillRect(14, 36 + i * 15, 40 + ((i * 37) % 90), 5); g.strokeStyle = "#3dff7a"; g.beginPath(); g.arc(150, 70, 26, 0, Math.PI * 2); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })() }),
    sombra: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 4, 32, 32, 32); gr.addColorStop(0, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() }),
    brilho: new THREE.LineBasicMaterial({ color: 0xffa64d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  // ── o CASCO: a malha lisa (sem as portas e os vidros que abrem) + a barriga da cauda ──
  const NU = low ? 18 : 30, NV = low ? 40 : 72, pos: number[] = [], nor: number[] = [], uv: number[] = [], n = new THREE.Vector3();
  const tipoNoPonto = (u: number, v: number) => { const p = superficie(u, v), [cX, cZ] = centroDoHex(p.x, p.z), [cu, cv] = uvDoPlano(cX, cZ), t = tipoDoHex(cu, cv); return t === "porta-e" || t === "porta-d" || (t === "vidro" && abreDoVidro(cu, cv)) ? `${cX.toFixed(2)},${cZ.toFixed(2)}` : null; };
  const vtx = (u: number, v: number) => { const p = superficie(u, v); normalDoCasco(u, v, n); pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(...uvDe(p.x, p.z)); };
  for (let i = 0; i < NU; i++) for (let k = 0; k < NV; k++) {
    const u0 = (i / NU) * 2 - 1, u1 = ((i + 1) / NU) * 2 - 1, v0 = (k / NV) * 2 - 1, v1 = ((k + 1) / NV) * 2 - 1;
    // (o vão do que abre: só os quadradinhos INTEIROS dentro da peça — a peça, por cima, cobre a borda)
    const t = [tipoNoPonto(u0 * 0.999, v0 * 0.999), tipoNoPonto(u1 * 0.999, v0 * 0.999), tipoNoPonto(u1 * 0.999, v1 * 0.999), tipoNoPonto(u0 * 0.999, v1 * 0.999)];
    if (t[0] && t.every((x) => x === t[0])) continue;
    for (const [a, b] of [[u0, v0], [u0, v1], [u1, v1], [u0, v0], [u1, v1], [u1, v0]] as const) vtx(a, b);
  }
  const cascoTopo = new THREE.BufferGeometry(); cascoTopo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); cascoTopo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); cascoTopo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const barriga = (() => {   // a BARRIGA da cauda (fechando o tubo por baixo: o "upsweep" dos helicópteros)
    const ps: number[] = [], NB = low ? 10 : 16, NVB = low ? 20 : 36, v0 = -0.2;
    const P = (u: number, v: number) => { const t = superficie(u, v), esp = TRASEIRA.barriga * sm(-0.2, -0.5, v) * (1 - sm(-0.9, -1, v) * 0.8); return [t.x, baseEm(v) - esp * Math.pow(Math.max(0, 1 - u * u), 0.5), t.z] as const; };
    for (let i = 0; i < NB; i++) for (let k = 0; k < NVB; k++) {
      const u0 = (i / NB) * 2 - 1, u1 = ((i + 1) / NB) * 2 - 1, va = v0 + (k / NVB) * (-0.995 - v0), vb = v0 + ((k + 1) / NVB) * (-0.995 - v0);
      for (const [u, v] of [[u0, va], [u0, vb], [u1, vb], [u0, va], [u1, vb], [u1, va]] as const) ps.push(...P(u, v));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(ps, 3)); g.computeVertexNormals(); return prep(g, uvDe(0, -CASCO.c * TRASEIRA.cauda * 0.7));
  })();
  const casco = juntar([cascoTopo, barriga]);
  // ── as PEÇAS que abrem: as portas (os hexágonos de cada lado do cockpit) e os hexágonos do vidro do passageiro ──
  const s3 = Math.sqrt(3), portas: THREE.BufferGeometry[][] = [[], []], vidros: Recursos["geo"]["vidros"] = [];
  const pivoPorta = [-1, 1].map((lado) => new THREE.Vector3(lado * 1.3, PORTA.pivoY, PORTA.pivoZ));
  for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
    const cX = HEX.r * s3 * (q + r / 2), cZ = HEX.r * 1.5 * r * HEX.alonga, [cu, cv] = uvDoPlano(cX, cZ), tipo = tipoDoHex(cu, cv);
    if (Math.abs(cZ) > CASCO.c * 1.6 || Math.abs(cX) > CASCO.a + HEX.r) continue;
    const cheio = contornoDoHex(cX, cZ, 0, 0);
    if (tipo === "porta-e" || tipo === "porta-d") { const i = tipo === "porta-e" ? 1 : 0, g = placaNoCasco(cheio, cX, cZ, 0.012); g.translate(-pivoPorta[i]!.x, -pivoPorta[i]!.y, -pivoPorta[i]!.z); portas[i]!.push(g); }
    else if (tipo === "vidro" && abreDoVidro(cu, cv)) {
      const [fu, fv] = uvDoPlano(cX, cZ + HEX.r * HEX.alonga * 0.95), base = pontoDoCasco(fu, fv, 0.012);
      const g = placaNoCasco(cheio, cX, cZ, 0.012); g.translate(-base.x, -base.y, -base.z);
      const linha = new THREE.BufferGeometry().setFromPoints(contornoDoHex(cX, cZ, 0.01, 0).map(([X, Z]) => { const [u, v] = uvDoPlano(X, Z); return pontoDoCasco(u, v, 0.016).sub(base); }));
      vidros.push({ g, linha, base, eixo: pontoDoCasco(Math.min(1, cu + 0.05), cv, 0).sub(pontoDoCasco(Math.max(-1, cu - 0.05), cv, 0)).normalize(), frente: pontoDoCasco(cu, Math.min(1, cv + 0.05), 0).sub(pontoDoCasco(cu, Math.max(-1, cv - 0.05), 0)).normalize(), normal: normalDoCasco(cu, cv), ordem: cv - Math.abs(cu) * 0.3 });
    }
  }
  vidros.sort((x, y) => y.ordem - x.ordem);
  // o HEXÁGONO LATERAL aceso (no referencial da porta de cada lado — o mesmo desenho, espelhado pela porta)
  const forma = (w: number, h: number) => { const f = new THREE.Shape(); f.moveTo(-w / 2, 0); f.lineTo(-w / 2 + h * 0.6, h / 2); f.lineTo(w / 2 - h * 0.6, h / 2); f.lineTo(w / 2, 0); f.lineTo(w / 2 - h * 0.6, -h / 2); f.lineTo(-w / 2 + h * 0.6, -h / 2); f.closePath(); return f; };
  const ladoAceso = new THREE.ShapeGeometry(forma(1.86, 0.48));
  // ── o CHASSI (a faixa preta), a saia e os pés — uma malha ──
  const planta = (k: number) => { const f = new THREE.Shape(); PLANTA.forEach(([x, z], i) => (i ? f.lineTo(x * k, -z * k) : f.moveTo(x * k, -z * k))); f.closePath(); return f; };
  const ch = new THREE.ExtrudeGeometry(planta(1.02), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.06, bevelSegments: low ? 1 : 2 }); ch.rotateX(-Math.PI / 2); ch.translate(0, 0.3, 0);
  const sa = new THREE.ExtrudeGeometry(planta(0.78), { depth: 0.18, bevelEnabled: false }); sa.rotateX(-Math.PI / 2); sa.translate(0, 0.1, 0);
  const pes = [[0.9, 1.25], [-0.9, 1.25], [0.95, -0.95], [-0.95, -0.95]].map(([x, z]) => { const b = new THREE.BoxGeometry(0.36, 0.12, 0.5); b.rotateY(x! * z! > 0 ? 0.3 : -0.3); b.translate(x!, 0.06, z!); return b; });
  const chassi = juntar([ch, sa, ...pes].map((g) => prep(g)));
  // ── a CAUDA: a barbatana com o anel (Fenestron, inclinada 12°) e os estabilizadores biplano — laranja e escura ──
  const vp = -0.93, bc = superficie(0, vp), lc = CASCO.a * larguraEm(vp), cauda = new THREE.Matrix4().makeTranslation(0, bc.y - 0.05, bc.z).multiply(new THREE.Matrix4().makeRotationZ((12 * Math.PI) / 180));
  const fin = new THREE.Shape(); fin.moveTo(-0.55, 0); fin.lineTo(0.25, 0); fin.lineTo(0.05, 0.78); fin.lineTo(-0.3, 0.78); fin.closePath();
  const furo = new THREE.Path(); furo.absarc(-0.12, 0.3, 0.2, 0, Math.PI * 2, true); fin.holes.push(furo);
  const finG = new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }); finG.rotateY(Math.PI / 2); finG.translate(-0.07, 0, 0); finG.applyMatrix4(cauda);
  const estab = [[0.06, 0.5, 0.62], [0.22, 0.38, 0.5]].flatMap(([dy, dz, w]) => { const e = new THREE.BoxGeometry(w! * 2 + lc * 0.6, 0.03, 0.26); e.translate(0, bc.y + dy!, bc.z + dz!); return [e, ...[1, -1].map((sx) => { const p = new THREE.BoxGeometry(0.03, 0.12, 0.26); p.translate(sx * (w! + lc * 0.3), bc.y + dy! + 0.05, bc.z + dz!); return p; })]; });
  const corCauda = uvDe(0, -CASCO.c * TRASEIRA.cauda * 0.8);
  const caudaLaranja = juntar([finG, ...estab].map((g) => prep(g, corCauda)));
  const anel = new THREE.TorusGeometry(0.2, 0.025, 6, low ? 16 : 24); anel.rotateY(Math.PI / 2); anel.translate(0, 0.3, -0.12); anel.applyMatrix4(cauda);
  const disco = new THREE.CircleGeometry(0.18, low ? 12 : 20); disco.rotateY(Math.PI / 2); disco.translate(0, 0.3, -0.12); disco.applyMatrix4(cauda);
  const caudaEscura = juntar([anel, disco].map((g) => prep(g)));
  // ── as LUZES (as faixas brancas e os LEDs verdes — uma malha, cor por vértice) e os PROPULSORES (4 discos) ──
  const luzes = juntar([
    ...([[0, 0.42, 2.56, 0.5, 0], [0, 0.42, -1.88, 0.8, 0], [1.33, 0.4, -0.1, 0.9, Math.PI / 2], [-1.33, 0.4, -0.1, 0.9, Math.PI / 2]] as const).map(([x, y, z, w, ry]) => { const b = new THREE.BoxGeometry(w, 0.025, 0.02); b.rotateY(ry); b.translate(x, y, z); return colorir(prep(b), 0xf2f6ff); }),
    ...([[1.3, 0.7], [-1.3, 0.7], [1.33, -0.9], [-1.33, -0.9], [0.45, 2.0], [-0.45, 2.0]] as const).map(([x, z]) => { const b = new THREE.SphereGeometry(0.035, 6, 4); b.translate(x, 0.5, z); return colorir(prep(b), 0x3dff7a); }),
  ]);
  const jatos = juntar([[0.9, 1.25], [-0.9, 1.25], [0.95, -0.95], [-0.95, -0.95]].map(([x, z]) => { const c = new THREE.CircleGeometry(0.15, 14); c.rotateX(Math.PI / 2); c.translate(x!, -0.005, z!); return prep(c); }));
  // ── o COCKPIT (só aparece com a cabine aberta): a banheira, o banco, o painel, o manche — e as 3 telas ──
  const caixa = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateX(rx); b.translate(x, y, z); return prep(b); };
  const cabine = juntar([caixa(1.35, 0.32, 2.3, 0, 0.42, 0.3), caixa(0.6, 0.12, 0.62, 0, 0.52, -0.1), caixa(0.6, 0.66, 0.13, 0, 0.82, -0.5, -0.42), caixa(0.32, 0.2, 0.12, 0, 1.12, -0.66, -0.42), caixa(1.15, 0.2, 0.32, 0, 0.78, 0.98, 0.35), caixa(0.34, 0.04, 0.04, 0, 0.84, 0.56)]);
  const telas = juntar(([[-0.38, 0.28], [0, 0], [0.38, -0.28]] as const).map(([x, ry]) => { const p = new THREE.PlaneGeometry(0.34, 0.24); p.rotateX(-0.55); p.rotateY(ry); p.translate(x, 0.9, 0.9); return prep(p); }).map((g) => { g.deleteAttribute("uv"); const pl = new THREE.PlaneGeometry(0.34, 0.24).toNonIndexed(); g.setAttribute("uv", pl.attributes.uv!); pl.dispose(); return g; }));
  const sombra = new THREE.PlaneGeometry(3.4, 6.6); sombra.rotateX(-Math.PI / 2); sombra.translate(0, -0.5, -0.6);
  return { mats, geo: { casco, portas: portas.map((ps) => (ps.length ? juntar(ps) : new THREE.BufferGeometry())), vidros, ladoAceso, chassi, caudaLaranja, caudaEscura, luzes, jatos, cabine, telas, sombra }, pivoPorta };
}

export function criarCarroHex(o: { low: boolean }): CarroHandle {
  let R = recursos.get(o.low); if (!R) { R = criarRecursos(o.low); recursos.set(o.low, R); }
  const { mats: M, geo: G } = R;
  const group = new THREE.Group(); group.name = "carro-hex";
  const corpo = new THREE.Group(); group.add(corpo);   // (o que paira — boia de leve)
  const malha = (g: THREE.BufferGeometry, m: THREE.Material, pai: THREE.Object3D = corpo) => { const k = new THREE.Mesh(g, m); pai.add(k); return k; };
  malha(G.casco, M.casco); malha(G.chassi, M.chassi); malha(G.caudaLaranja, M.casco); malha(G.caudaEscura, M.chassi); malha(G.luzes, M.luzes); malha(G.jatos, M.jato);
  const cockpit = new THREE.Group(); cockpit.visible = false; corpo.add(cockpit); malha(G.cabine, M.cabine, cockpit); malha(G.telas, M.tela, cockpit);
  const sombra = new THREE.Mesh(G.sombra, M.sombra); sombra.userData.semLote = true; group.add(sombra);
  // as PORTAS (cada uma um grupo na dobradiça da frente, com os hexágonos dela e o hexágono aceso)
  const portas = [-1, 1].map((lado, i) => {
    const g = new THREE.Group(); g.position.copy(R!.pivoPorta[i]!); g.userData.lado = lado; corpo.add(g);
    malha(G.portas[i]!, M.casco, g);
    const [hu, hv] = uvDoPlano(lado * CASCO.a * 0.985, PORTA.ladoZ), sp = pontoDoCasco(hu, hv, 0.03), sn = normalDoCasco(hu, hv);
    const hx = malha(G.ladoAceso, M.aceso, g); hx.position.set(sp.x - g.position.x, Math.max(0.66, sp.y) - g.position.y, sp.z - g.position.z); hx.rotation.set(0, lado * Math.PI / 2, 0); hx.rotateX(-Math.asin(Math.min(0.9, sn.y))); if (lado < 0) hx.scale.x = -1;
    return g;
  });
  // os VIDROS do passageiro (destravam, deslizam pra frente e empilham — com o contorno de luz enquanto movem)
  const vidros = G.vidros.map((v) => { const g = new THREE.Group(); g.position.copy(v.base); corpo.add(g); malha(v.g, M.casco, g); g.add(new THREE.LineLoop(v.linha, M.brilho)); return { g, v }; });
  // o banco e os pontos da IK do piloto
  const assento = new THREE.Object3D(); assento.position.set(0, 0.6, -0.1); corpo.add(assento);
  const maoE = new THREE.Object3D(), maoD = new THREE.Object3D(), peE = new THREE.Object3D(), peD = new THREE.Object3D();
  maoE.position.set(0.17, 0.8, 0.56); maoD.position.set(-0.17, 0.8, 0.56); peE.position.set(0.18, 0.36, 1.05); peD.position.set(-0.18, 0.36, 1.05);
  corpo.add(maoE, maoD, peE, peD);

  let aberto = 0;
  const suave = (x: number) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
  const aplicar = () => {
    cockpit.visible = aberto > 0.001;
    let brilho = 0;
    vidros.forEach(({ g, v }, i) => {   // DESTRAVA → DESLIZA pra frente → EMPILHA (a de trás por cima da da frente)
      const ini = 0.2 + (vidros.length > 1 ? (i / (vidros.length - 1)) * 0.22 : 0), k = Math.max(0, Math.min(1, (aberto - ini) / 0.4));
      const sobe = suave(k / 0.22), vai = suave((k - 0.15) / 0.85);
      g.position.copy(v.base).addScaledVector(v.normal, (VIDRO.destrava + VIDRO.degrau * i) * sobe).addScaledVector(v.frente, VIDRO.desliza * vai);
      g.quaternion.setFromAxisAngle(v.eixo, -VIDRO.inclina * vai);
      brilho = Math.max(brilho, Math.sin(Math.PI * Math.min(1, k * 1.05)) * 0.95 + 0.25 * vai);
    });
    M.brilho.opacity = Math.min(1, brilho);
    // a ORDEM: a porta do MOTORISTA (esquerda) primeiro; os vidros; por último a porta do PASSAGEIRO (direita)
    for (const p of portas) { const lado = p.userData.lado as number, e = lado > 0 ? suave(aberto / 0.45) : suave((aberto - 0.55) / 0.45); p.rotation.set(PORTA.sobe * e, 0, lado * PORTA.abre * e, "ZXY"); }
  };
  aplicar();
  return {
    group, assento, pontos: { maoE, maoD, peE, peD }, nVidros: vidros.length,
    abrir(k) { const n = THREE.MathUtils.clamp(k, 0, 1); if (n !== aberto) { aberto = n; aplicar(); } },
    atualizar(t, _dt, op) {
      const ligado = op?.ligado ?? true, vel = op?.vel ?? 0;
      corpo.position.y = 0.04 * Math.sin(t * 1.6);   // pairando: sobe e desce devagar
      const forca = ligado ? 0.6 + 0.4 * Math.min(1, vel / 20) : 0.1;
      M.jato.opacity = forca * (0.8 + 0.2 * Math.sin(t * 13));
    },
    dispose() { group.removeFromParent(); },   // (as geometrias e os materiais são COMPARTILHADOS: ficam pros outros carros)
  };
}
