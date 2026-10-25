/**
 * As 3 SEQUÊNCIAS da avatar enquanto a resposta é gerada (o roteiro: lib/research/sequenciaAvatar) — a parte visual,
 * dentro da cena do worker (components/research/avatarCena). O dono: "os olhos brilham enquanto ela pensa, depois ela
 * flutuando e buscando coisas na internet — um conjunto de hologramas em quadrado, bem sci-fi e cyberpunk, de uma IA
 * que controla as coisas na net"; depois: "uma câmera que se afaste mais, mais telas e mais efeitos visíveis nelas; ela
 * sobe e fica digitando num teclado virtual enquanto olha as telas; bem cyberpunk e detalhado, com efeitos como blur,
 * ainda leve" e "a cena fica melhor se ela estiver LEVITANDO, não só em pé".
 *  - OLHOS: dois brilhos nos ossos dos olhos (por cima do cabelo), pulsando;
 *  Depois: "a chuva é feia, tire; níveis de evento — rápido: a aranha passeando em cima da tela e se ALIMENTANDO
 *  das telas; mais de 5 s: a aranha vira ENERGIA e RAIOS aparecem; ela pode ficar de pé — o ângulo da câmera é que
 *  tem que ser bacana pra mostrar mais da cena".
 *  - REDE (raspar/energia): ela fica DE PÉ e COMANDA as telas de MÃOS ABERTAS (sem teclado — o dono não quer digitar),
 *    fica em três-quartos, derivando devagar. As telas, em CAMADAS de profundidade:
 *    · a TELA PRINCIPAL atrás dela — a página que a ARANHA (procedural, à moda do cyohei9907/web-crawlers — código
 *      nosso) raspa: cada pata que pousa abre um anel de glitch na página; parada, ela SE ALIMENTA de uma tela do arco
 *      (a tela é drenada num fluxo de partículas até ela, e a aranha brilha mais a cada refeição);
 *    · ENERGIA (passou de 5 s): a aranha vira uma esfera de energia que sobe por trás dela, e RAIOS em ziguezague
 *      saltam da esfera pras telas (cada raio que acerta dá glitch na tela);
 *    · um ARCO de telas em volta dela (código, gráficos, matriz, radar, ondas…), cada uma um shader: o conteúdo rola,
 *      uma faixa de varredura passa, piscam, dão glitch com aberração cromática; halos atrás (o "bloom" barato);
 *    · telas LONGE desfocadas e telas PERTO da câmera fora de foco (o blur é pré-calculado na textura: custo zero);
 *    · FEIXES das MÃOS às telas, ANÉIS girando no chão sob ela;
 *  - ÁRVORE: uma árvore de habilidades holográfica cresce à frente do peito, nó por nó;
 *  - CÉREBRO: partículas que se juntam num cérebro girando, com sinapses piscando.
 */
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { envelope, sequenciaEm, type Sequencia } from "@/lib/research/sequenciaAvatar";
import { ctx2d, novoCanvas, type Canvas2D } from "@/lib/cyber/canvas2d";

const CIANO = new THREE.Color("#5ff2ff"), MAGENTA = new THREE.Color("#ff3df2"), VERDE = new THREE.Color("#7dffb2"), OURO = new THREE.Color("#ffd36b"), AMBAR = new THREE.Color("#ffb347");
const aleat = (a: number, b: number) => a + Math.random() * (b - a);
const sstep = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const textura = (c: Canvas2D) => { const t = new THREE.CanvasTexture(c as HTMLCanvasElement); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t; };

// ───────────────────────── o CONTEÚDO das telas (canvas, desenhado uma vez) ─────────────────────────
const CORES = ["95,242,255", "255,61,242", "255,211,107", "125,255,178"];
/** uma tela "alta" (256×512: a tela mostra metade e rola) — 6 tipos de conteúdo */
function conteudo(tipo: number, semente: number): Canvas2D {
  const c = novoCanvas(256, 512), g = ctx2d(c), r = (() => { let s = semente * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const cor = CORES[tipo % CORES.length]!, cor2 = CORES[(tipo + 1) % CORES.length]!;
  g.fillStyle = "rgba(3,8,22,.86)"; g.fillRect(0, 0, 256, 512);
  if (tipo === 0) {   // CÓDIGO: linhas de "tokens" coloridos com indentação
    for (let y = 8; y < 512; y += 11) { let x = 8 + Math.floor(r() * 4) * 12; const n = 1 + Math.floor(r() * 5); for (let k = 0; k < n && x < 240; k++) { const w = 8 + r() * 40; g.fillStyle = `rgba(${CORES[Math.floor(r() * 4)]},${0.5 + r() * 0.5})`; g.fillRect(x, y, w, 4); x += w + 5; } }
  } else if (tipo === 1) {   // GRÁFICOS: barras, uma curva e números
    for (let b = 0; b < 4; b++) {
      const y0 = 20 + b * 125; g.strokeStyle = `rgba(${cor},.35)`; g.strokeRect(8, y0, 240, 105);
      for (let i = 0; i < 18; i++) { const h = 10 + r() * 80; g.fillStyle = `rgba(${i % 5 ? cor : cor2},.75)`; g.fillRect(14 + i * 13, y0 + 100 - h, 8, h); }
      g.beginPath(); g.strokeStyle = `rgba(${cor2},1)`; g.lineWidth = 2; for (let i = 0; i <= 24; i++) { const x = 10 + i * 10, y = y0 + 50 + Math.sin(i * 0.6 + b) * 25 + (r() - 0.5) * 18; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
    }
  } else if (tipo === 2) {   // MATRIZ: colunas de caracteres
    g.font = "bold 13px monospace"; const ch = "01アイウエオカキクケコABCDEF<>/{}#$%";
    for (let x = 6; x < 256; x += 13) for (let y = 14; y < 512; y += 15) { if (r() < 0.25) continue; g.fillStyle = `rgba(${r() < 0.1 ? "255,255,255" : r() < 0.5 ? cor : CORES[3]},${0.35 + r() * 0.65})`; g.fillText(ch[Math.floor(r() * ch.length)]!, x, y); }
  } else if (tipo === 3) {   // RADAR: círculos, varredura, alvos
    for (let b = 0; b < 2; b++) {
      const cx = 128, cy = 128 + b * 256; g.strokeStyle = `rgba(${cor},.5)`;
      for (let k = 1; k <= 5; k++) { g.beginPath(); g.arc(cx, cy, k * 22, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(cx - 115, cy); g.lineTo(cx + 115, cy); g.moveTo(cx, cy - 115); g.lineTo(cx, cy + 115); g.stroke();
      for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = r() * 105; g.fillStyle = `rgba(${k % 3 ? cor2 : "255,255,255"},1)`; g.fillRect(cx + Math.cos(a) * d - 3, cy + Math.sin(a) * d - 3, 6, 6); }
    }
  } else if (tipo === 4) {   // ONDAS: osciloscópio + espectro
    for (let b = 0; b < 6; b++) {
      const y0 = 40 + b * 82; g.beginPath(); g.strokeStyle = `rgba(${b % 2 ? cor : cor2},1)`; g.lineWidth = 2;
      for (let x = 0; x <= 256; x += 4) { const y = y0 + Math.sin(x * 0.05 * (1 + b * 0.3) + b) * 18 * Math.sin(x * 0.01 + b); if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      for (let i = 0; i < 32; i++) { const h = r() * 22; g.fillStyle = `rgba(${cor},.5)`; g.fillRect(i * 8, y0 + 40 - h, 6, h); }
    }
  } else {   // PÁGINA: cabeçalho, imagens, parágrafos
    for (let bl = 0; bl < 4; bl++) {
      const y0 = bl * 128; g.fillStyle = `rgba(${cor},.85)`; g.fillRect(0, y0, 256, 12);
      g.fillStyle = `rgba(${cor2},.3)`; g.fillRect(10, y0 + 22, 90, 60); g.strokeStyle = `rgba(${cor2},.9)`; g.strokeRect(10, y0 + 22, 90, 60);
      for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(230,245,255,${0.3 + r() * 0.4})`; g.fillRect(i < 5 ? 110 : 10, y0 + 24 + i * 11, (i < 5 ? 60 : 150) + r() * 70, 4); }
    }
  }
  return c;
}
/** a mesma tela DESFOCADA (o blur pré-calculado: reduz e amplia — funciona em qualquer navegador, inclusive no worker) */
function desfocar(src: Canvas2D, fator = 6): Canvas2D {
  const p = novoCanvas(Math.max(8, Math.floor(src.width / fator)), Math.max(8, Math.floor(src.height / fator))), gp = ctx2d(p);
  gp.imageSmoothingEnabled = true; gp.drawImage(src as CanvasImageSource, 0, 0, p.width, p.height);
  const g2 = novoCanvas(src.width, src.height), g = ctx2d(g2); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(p as CanvasImageSource, 0, 0, src.width, src.height); return g2;
}

// ───────────────────────── o SHADER das telas ─────────────────────────
const TELA_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TELA_FRAG = /* glsl */ `
  uniform sampler2D mapa; uniform float tempo, opac, glitch, rolar, semente, nitida; uniform vec3 cor; uniform vec4 toques[4];
  varying vec2 vUv;
  float h(float n){ return fract(sin(n) * 43758.5453); }
  void main(){
    vec2 uv = vUv;
    // GLITCH: faixas horizontais que escorregam
    float faixa = floor(uv.y * 26.0), gl = glitch * step(0.62, h(faixa + floor(tempo * 24.0) + semente));
    uv.x += gl * (h(faixa * 3.1 + tempo) - 0.5) * 0.18;
    // os TOQUES da aranha: um anel de glitch que se abre em volta de cada pata que pousou
    float anel = 0.0;
    for (int i = 0; i < 4; i++) { vec4 t = toques[i]; if (t.z <= 0.0) continue; float d = distance(vUv * vec2(1.6, 1.0), t.xy * vec2(1.6, 1.0)); float r = (1.0 - t.z) * 0.12; anel += smoothstep(0.012, 0.0, abs(d - r)) * t.z; uv.x += smoothstep(r + 0.03, r, d) * 0.012 * t.z; }
    // o conteúdo ROLA (a textura é alta: a tela mostra metade)
    vec2 c = vec2(uv.x, fract(uv.y * 0.5 + tempo * rolar + semente));
    float ab = 0.004 + gl * 0.02 + anel * 0.01;   // aberração cromática
    vec4 tx = vec4(texture2D(mapa, c + vec2(ab, 0.0)).r, texture2D(mapa, c).g, texture2D(mapa, c - vec2(ab, 0.0)).b, texture2D(mapa, c).a);
    // moldura, cabeçalho, cantos, varredura, linhas de tela, piscar
    float bx = min(vUv.x, 1.0 - vUv.x), by = min(vUv.y, 1.0 - vUv.y), borda = smoothstep(0.012 * nitida + 0.004, 0.0, min(bx, by * 1.4));
    float canto = step(min(bx, by), 0.04) * step(max(bx, by), 0.09) * nitida;
    float cab = step(0.93, vUv.y) * (0.55 + 0.45 * step(0.5, fract(vUv.x * 9.0 - tempo * 0.8)));
    float varre = smoothstep(0.035, 0.0, abs(vUv.y - fract(-tempo * 0.42 + semente)));
    float linhas = 0.86 + 0.14 * sin(vUv.y * 420.0);
    float pisca = 0.86 + 0.14 * h(floor(tempo * 18.0) + semente * 7.0);
    vec3 col = tx.rgb * linhas + cor * (borda * 1.2 + canto + cab * 0.55 + varre * 0.55 + anel * 1.4) + vec3(1.0) * gl * 0.15;
    float a = (tx.a * 0.82 + borda + canto * 0.8 + cab * 0.5 + varre * 0.35 + anel) * opac * pisca;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

type Tela = { mesh: THREE.Mesh; u: Record<string, THREE.IUniform>; base: THREE.Vector3; w: number; h: number; atraso: number; glitch: number; camada: "arco" | "longe" | "perto" | "principal"; halo?: THREE.Sprite; olhar: boolean };
type Perna = { lado: number; k: number; pe: THREE.Vector3; de: THREE.Vector3; para: THREE.Vector3; passo: number };

export type ResultadoSeq = {
  /** 0..1: a câmera se afasta; `orbita` = o ângulo (rad) que ela gira em volta */
  abrir: number; orbita: number;
  /** 0..1: intensidade da REDE (vestigial — as mãos agora posam sempre por `maosPeso`); `maos` = alvos (mundo) */
  digitar: number; maos: { esq: THREE.Vector3; dir: THREE.Vector3 };
  /** 0..1: as mãos posam numa cena de poder (telepatia/leitura/feitiço) — o corpo leva os punhos a `maos` por IK */
  maosPeso: number;
  /** quanto a cabeça inclina (rad, + = pra baixo): lendo olha pro livro, telepata ergue o rosto */
  cabecaTilt: number;
  /** pra onde ela olha (rad, guinada) varrendo as telas */
  olhar: number;
  seq: Sequencia | null; nova: boolean;
};
export type Sequencias = {
  /** a cada quadro: `gerandoHa` = s desde que a resposta começou (null = não está gerando) */
  atualizar: (o: { agora: number; dt: number; gerandoHa: number | null; vrm: VRM | null; cam: THREE.Camera }) => ResultadoSeq;
  zerar: () => void;
  /** (dev) os pesos e a sequência agora */
  estado: () => Record<string, unknown>;
  /** o REBAIXAMENTO (a cena passou do orçamento por quadro): 1 = sem as telas longe/perto e os halos; 2 = metade do
   *  arco e sem os feixes */
  qualidade: (q: 0 | 1 | 2) => void;
  dispose: () => void;
};

export function criarSequencias(cena: THREE.Scene, estrela: THREE.Texture): Sequencias {
  const descartaveis: { dispose: () => void }[] = [];
  const guarda = <T extends { dispose: () => void }>(x: T) => { descartaveis.push(x); return x; };
  const raiz = new THREE.Group(); cena.add(raiz);
  /** `porCima` = desenha por cima de tudo (os OLHOS, que o cabelo tampa); o resto respeita a profundidade */
  const brilhoMat = (cor: THREE.Color, porCima = false) => guarda(new THREE.SpriteMaterial({ map: estrela, color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !porCima }));
  const aux = new THREE.Vector3(), aux2 = new THREE.Vector3(), joelho = new THREE.Vector3();

  // ── OLHOS ──
  const olhos = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(CIANO, true)); s.scale.setScalar(0.05); s.renderOrder = 10; raiz.add(s); return s; });
  const nucleos = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(new THREE.Color("#ffffff"), true)); s.scale.setScalar(0.016); s.renderOrder = 11; raiz.add(s); return s; });

  // ── REDE: o palco da busca (centrado no peito dela; segue a altura dela) ──
  const rede = new THREE.Group(); raiz.add(rede);
  const conteudos = Array.from({ length: 6 }, (_, i) => conteudo(i, i + 1));
  const texNitida = conteudos.map((c) => guarda(textura(c)));
  const texBorrada = conteudos.map((c) => guarda(textura(desfocar(c, 7))));
  const texPrincipal = guarda(textura(conteudo(5, 42)));
  const geoTela = guarda(new THREE.PlaneGeometry(1, 1));
  const telas: Tela[] = [];
  const novaTela = (camada: Tela["camada"], x: number, y: number, z: number, w: number, h: number, mapa: THREE.Texture, cor: THREE.Color, o: { aditiva?: boolean; nitida?: number; olhar?: boolean; halo?: boolean } = {}) => {
    const u: Record<string, THREE.IUniform> = {
      mapa: { value: mapa }, tempo: { value: 0 }, opac: { value: 0 }, glitch: { value: 0 }, rolar: { value: aleat(0.02, 0.07) * (Math.random() < 0.5 ? 1 : -1) },
      semente: { value: Math.random() }, nitida: { value: o.nitida ?? 1 }, cor: { value: cor.clone() }, toques: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
    };
    const mat = guarda(new THREE.ShaderMaterial({ uniforms: u, vertexShader: TELA_VERT, fragmentShader: TELA_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...(o.aditiva ? { blending: THREE.AdditiveBlending } : {}) }));
    const mesh = new THREE.Mesh(geoTela, mat); mesh.scale.set(w, h, 1); mesh.renderOrder = camada === "perto" ? 9 : camada === "arco" ? 3 : 1; rede.add(mesh);
    let halo: THREE.Sprite | undefined;
    if (o.halo) { halo = new THREE.Sprite(brilhoMat(cor)); halo.scale.set(w * 1.9, h * 2.2, 1); halo.renderOrder = 0; rede.add(halo); }
    telas.push({ mesh, u, base: new THREE.Vector3(x, y, z), w, h, atraso: aleat(0, 0.45), glitch: 0, camada, halo, olhar: o.olhar ?? true });
  };
  // a TELA PRINCIPAL (a página que a aranha raspa), atrás dela
  const PRINC = { z: -0.62, w: 0.95, h: 0.62 };
  novaTela("principal", 0, 0.06, PRINC.z, PRINC.w, PRINC.h, texPrincipal, CIANO, { olhar: false, halo: true });
  const principal = telas[0]!;
  // o ARCO de telas em volta dela (0° = atrás; ±100° = já do lado da câmera)
  const R_ARCO = 0.78;
  [[-104, 0.02], [-84, 0.28], [-80, -0.2], [-58, 0.36], [-52, 0.02], [-46, -0.3], [46, -0.3], [52, 0.04], [58, 0.36], [80, -0.22], [84, 0.26], [104, 0.0], [-26, 0.48], [26, 0.48], [-118, -0.18], [118, 0.22]]
    .forEach(([ang, y], i) => {
      const a = (ang! * Math.PI) / 180, w = aleat(0.2, 0.3), h = w * aleat(0.55, 0.75);
      novaTela("arco", Math.sin(a) * R_ARCO, y!, -Math.cos(a) * R_ARCO, w, h, texNitida[i % 6]!, i % 3 === 1 ? MAGENTA : i % 5 === 0 ? AMBAR : CIANO, { halo: true });
    });
  // as LONGE (desfocadas)
  for (let i = 0; i < 14; i++) { const a = aleat(-2.2, 2.2), R = aleat(1.5, 2.1), w = aleat(0.3, 0.5); novaTela("longe", Math.sin(a) * R, aleat(-0.5, 0.7), -Math.cos(a) * R, w, w * 0.62, texBorrada[i % 6]!, i % 2 ? MAGENTA : CIANO, { nitida: 0.3 }); }
  // as PERTO da câmera (fora de foco: bokeh) — a posição é refeita a cada quadro, no espaço da câmera
  const pertoOff = [[-0.21, 0.13, 0.55], [0.23, -0.16, 0.6], [0.2, 0.2, 0.75]] as const;
  pertoOff.forEach((_, i) => novaTela("perto", 0, 0, 0, 0.16, 0.1, texBorrada[(i + 2) % 6]!, i % 2 ? CIANO : MAGENTA, { aditiva: true, nitida: 0.2, olhar: false }));


  // os ANÉIS sob ela (girando em sentidos opostos)
  const anelTex = (() => {
    const c = novoCanvas(256, 256), g = ctx2d(c); g.translate(128, 128);
    g.strokeStyle = "rgba(95,242,255,.95)"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g.beginPath(); g.arc(0, 0, 104, a, a + 0.16); g.stroke(); }
    g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 88, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,61,242,.9)"; for (let k = 0; k < 60; k++) { const a = (k / 60) * Math.PI * 2; g.fillRect(Math.cos(a) * 95 - 1, Math.sin(a) * 95 - 1, 2, k % 5 ? 2 : 6); }
    return guarda(textura(c));
  })();
  const aneis = [0.62, 0.42].map((s, i) => {
    const m = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: anelTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: i ? MAGENTA : CIANO })));
    m.rotation.x = -Math.PI / 2; m.scale.setScalar(s); raiz.add(m); return m;
  });

  // o TECLADO holográfico (à frente da cintura, inclinado pra ela) + o brilho das teclas tocadas
  const teclado = new THREE.Group(); raiz.add(teclado);
  const tecladoTex = (() => {
    const c = novoCanvas(512, 180), g = ctx2d(c);
    g.fillStyle = "rgba(20,90,140,.55)"; g.fillRect(0, 0, 512, 180); g.strokeStyle = "rgba(150,250,255,1)"; g.lineWidth = 6; g.strokeRect(3, 3, 506, 174);
    g.lineWidth = 3; const linhas = [12, 12, 11, 10]; linhas.forEach((n, l) => { const kw = 472 / 12, x0 = 20 + l * 10; for (let k = 0; k < n; k++) g.strokeRect(x0 + k * kw, 16 + l * 36, kw - 6, 28); });
    g.strokeRect(120, 160 - 4, 270, 16);
    return guarda(textura(c));
  })();
  const tecladoMat = guarda(new THREE.MeshBasicMaterial({ map: tecladoTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: CIANO }));
  const tecladoPlano = new THREE.Mesh(geoTela, tecladoMat); tecladoPlano.scale.set(0.36, 0.13, 1); teclado.add(tecladoPlano);
  const toquesTecla = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(CIANO)); s.scale.setScalar(0.06); teclado.add(s); return { s, vida: 0 }; });
  const maos = { esq: new THREE.Vector3(), dir: new THREE.Vector3() };
  // os FEIXES (do teclado às telas do arco), piscando
  const NFEIXE = 7, feixePos = new Float32Array(NFEIXE * 6), feixeGeo = guarda(new THREE.BufferGeometry()); feixeGeo.setAttribute("position", new THREE.BufferAttribute(feixePos, 3));
  const feixeMat = guarda(new THREE.LineBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const feixes = new THREE.LineSegments(feixeGeo, feixeMat); feixes.frustumCulled = false; raiz.add(feixes);
  const feixeAlvo = Array.from({ length: NFEIXE }, () => 1 + Math.floor(Math.random() * 16));

  // ── a ARANHA (na tela principal) ──
  const aranha = new THREE.Group(); rede.add(aranha);
  const ESCALA = 2.3;
  const corpoMat = guarda(new THREE.MeshBasicMaterial({ color: 0x07070f, transparent: true, opacity: 0 }));
  const corpo = new THREE.Mesh(guarda(new THREE.SphereGeometry(1, 12, 8)), corpoMat); corpo.scale.set(0.016, 0.022, 0.01); aranha.add(corpo);
  const abdomen = new THREE.Mesh(corpo.geometry, corpoMat); abdomen.scale.set(0.022, 0.03, 0.013); abdomen.position.set(0, -0.034, 0); aranha.add(abdomen);
  const brilhoAranha = new THREE.Sprite(brilhoMat(MAGENTA)); brilhoAranha.scale.setScalar(0.07); brilhoAranha.position.set(0, -0.034, 0.012); aranha.add(brilhoAranha);
  const olhosAranha = [-1, 1].map((s) => { const o = new THREE.Sprite(brilhoMat(CIANO)); o.scale.setScalar(0.016); o.position.set(s * 0.006, 0.016, 0.01); aranha.add(o); return o; });
  const pernas: Perna[] = [];
  for (const lado of [-1, 1]) for (let k = 0; k < 4; k++) pernas.push({ lado, k, pe: new THREE.Vector3(), de: new THREE.Vector3(), para: new THREE.Vector3(), passo: 1 });
  const pernasPos = new Float32Array(8 * 4 * 3), pernasGeo = guarda(new THREE.BufferGeometry());
  pernasGeo.setAttribute("position", new THREE.BufferAttribute(pernasPos, 3));
  const pernasMat = guarda(new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pernasLinha = new THREE.LineSegments(pernasGeo, pernasMat); pernasLinha.frustumCulled = false; rede.add(pernasLinha);
  const juntasGeo = guarda(new THREE.BufferGeometry()); juntasGeo.setAttribute("position", pernasGeo.attributes.position!);
  const juntasMat = guarda(new THREE.PointsMaterial({ size: 0.014, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const juntas = new THREE.Points(juntasGeo, juntasMat); juntas.frustumCulled = false; rede.add(juntas);
  const PAREDE_Z = PRINC.z + 0.025;
  const ar = { pos: new THREE.Vector3(0, 0, PAREDE_Z), alvo: new THREE.Vector3(), rumo: 0, pausa: 0, iniciada: false, grupo: 0, toque: 0 };
  const ideal = (p: Perna, out: THREE.Vector3) => {
    const frente = [0.05, 0.022, -0.012, -0.046][p.k]! * ESCALA, lat = (0.05 + (p.k === 1 || p.k === 2 ? 0.008 : 0)) * ESCALA;
    const c = Math.cos(ar.rumo), s = Math.sin(ar.rumo), lx = p.lado * lat, ly = frente;
    return out.set(ar.pos.x + lx * c - ly * s, ar.pos.y + lx * s + ly * c, ar.pos.z);
  };
  const quadril = (p: Perna, out: THREE.Vector3) => {
    const c = Math.cos(ar.rumo), s = Math.sin(ar.rumo), lx = p.lado * 0.01 * ESCALA, ly = (0.01 - p.k * 0.007) * ESCALA;
    return out.set(ar.pos.x + lx * c - ly * s, ar.pos.y + lx * s + ly * c, ar.pos.z);
  };

  // ── PACOTES de dados (da página pra cabeça dela; do teclado pras telas) ──
  const NPAC = 32, pacPos = new Float32Array(NPAC * 3), pacGeo = guarda(new THREE.BufferGeometry());
  pacGeo.setAttribute("position", new THREE.BufferAttribute(pacPos, 3));
  const pacMat = guarda(new THREE.PointsMaterial({ size: 0.024, map: estrela, color: MAGENTA, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pacotes = new THREE.Points(pacGeo, pacMat); pacotes.frustumCulled = false; raiz.add(pacotes);
  const pac = Array.from({ length: NPAC }, () => ({ vivo: false, t: 0, dur: 0.7, de: new THREE.Vector3(), para: new THREE.Vector3(), arco: 0.25 }));
  const soltarPacote = (de: THREE.Vector3, para: THREE.Vector3, dur = 0.7, arco = 0.25) => { const q = pac.find((x) => !x.vivo); if (q) { q.vivo = true; q.t = 0; q.dur = dur; q.arco = arco; q.de.copy(de); q.para.copy(para); } };
  const cabeca = new THREE.Vector3(0, 1.45, 0);

  // ── a ENERGIA (a aranha transformada) e os RAIOS ──
  const esfera = new THREE.Group(); raiz.add(esfera);
  const esferaCamadas = ([[MAGENTA, 0.7], [CIANO, 0.36], [new THREE.Color("#ffffff"), 0.14]] as const).map(([cor, tam]) => { const sp = new THREE.Sprite(brilhoMat(cor as THREE.Color)); sp.scale.setScalar(tam); sp.renderOrder = 8; esfera.add(sp); return { sp, tam }; });
  const NORB = 36, orbPos = new Float32Array(NORB * 3), orbGeo = guarda(new THREE.BufferGeometry()); orbGeo.setAttribute("position", new THREE.BufferAttribute(orbPos, 3));
  const orbMat = guarda(new THREE.PointsMaterial({ size: 0.02, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const orbitas = new THREE.Points(orbGeo, orbMat); orbitas.frustumCulled = false; esfera.add(orbitas);
  const NRAIO = 6, SEG = 12, raioPos = new Float32Array(NRAIO * SEG * 6), raioGeo = guarda(new THREE.BufferGeometry()); raioGeo.setAttribute("position", new THREE.BufferAttribute(raioPos, 3));
  const raioMat = guarda(new THREE.LineBasicMaterial({ color: new THREE.Color("#c9f9ff"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const raios = new THREE.LineSegments(raioGeo, raioMat); raios.frustumCulled = false; raios.renderOrder = 8; raiz.add(raios);
  // a 2ª linha de cada raio (deslocada um tiquinho, magenta): o raio fica "grosso" com 1 px de WebGL
  const raio2Geo = guarda(new THREE.BufferGeometry()); raio2Geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NRAIO * SEG * 6), 3));
  const raio2Mat = guarda(new THREE.LineBasicMaterial({ color: MAGENTA, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const raios2 = new THREE.LineSegments(raio2Geo, raio2Mat); raios2.frustumCulled = false; raiz.add(raios2);
  const pontas = Array.from({ length: NRAIO }, () => { const sp = new THREE.Sprite(brilhoMat(CIANO)); sp.scale.setScalar(0.09); raiz.add(sp); return sp; });
  const en = { pos: new THREE.Vector3(), de: new THREE.Vector3(), desde: 0, proxRaio: 0, ativa: false };
  const pontaRaio = new THREE.Vector3(), meioRaio = new THREE.Vector3();
  /** um raio em ziguezague de `a` a `b` (deslocamento do meio, maior no centro) */
  const desenharRaio = (i: number, a: THREE.Vector3, b: THREE.Vector3) => {
    const arr = raioPos, arr2 = raio2Geo.attributes.position!.array as Float32Array; let px = a.x, py = a.y, pz = a.z;
    for (let k = 1; k <= SEG; k++) {
      const u = k / SEG, amp = Math.sin(u * Math.PI) * 0.06;
      meioRaio.lerpVectors(a, b, u); if (k < SEG) meioRaio.add(pontaRaio.set(aleat(-amp, amp), aleat(-amp, amp), aleat(-amp, amp)));
      const o = (i * SEG + k - 1) * 6;
      arr.set([px, py, pz, meioRaio.x, meioRaio.y, meioRaio.z], o);
      arr2.set([px + 0.006, py + 0.005, pz, meioRaio.x + 0.006, meioRaio.y + 0.005, meioRaio.z], o);
      px = meioRaio.x; py = meioRaio.y; pz = meioRaio.z;
    }
  };
  // a ARANHA se alimentando: qual tela ela está drenando, e o quanto já comeu
  const ali = { tela: -1, ate: 0, proxGota: 0, fome: 0 };
  const drenada = new Map<number, number>();

  // o CAMPO de projeção atrás da árvore e do cérebro (sem ele, a luz somada some em cima da roupa clara)
  const campoTex = (() => {
    const c = novoCanvas(256, 256), g = ctx2d(c), gr = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    gr.addColorStop(0, "rgba(2,8,26,.92)"); gr.addColorStop(0.72, "rgba(4,14,38,.82)"); gr.addColorStop(0.9, "rgba(20,120,170,.55)"); gr.addColorStop(0.94, "rgba(95,242,255,.95)"); gr.addColorStop(1, "rgba(95,242,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(95,242,255,.25)"; g.lineWidth = 1; for (let r = 30; r < 110; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    return guarda(textura(c));
  })();
  const novoCampo = () => { const m = guarda(new THREE.MeshBasicMaterial({ map: campoTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); const me = new THREE.Mesh(geoTela, m); me.renderOrder = 4; return me; };

  // ── ÁRVORE de habilidades ──
  type No = { pai: number; nivel: number; pos: THREE.Vector3 };
  const nos: No[] = [{ pai: -1, nivel: 0, pos: new THREE.Vector3(0, 0, 0) }];
  const crescer = (i: number, ang: number, nivel: number) => {
    if (nivel > 3) return;
    const filhos = nivel === 0 ? 3 : 2, abre = nivel === 0 ? 1.15 : 0.62 / nivel;
    for (let f = 0; f < filhos; f++) {
      const a = ang + (f / (filhos - 1) - 0.5) * abre, L = 0.072 - nivel * 0.01;
      const p = nos[i]!.pos.clone().add(new THREE.Vector3(Math.sin(a) * L, Math.cos(a) * L, aleat(-0.015, 0.015)));
      nos.push({ pai: i, nivel: nivel + 1, pos: p }); crescer(nos.length - 1, a, nivel + 1);
    }
  };
  crescer(0, 0, 0);
  const arvore = new THREE.Group(); raiz.add(arvore);
  const campoArvore = novoCampo(); campoArvore.scale.setScalar(0.36); campoArvore.position.set(0, 0.13, -0.03); arvore.add(campoArvore);
  const arvNosPos = new Float32Array(nos.length * 3), arvNosCor = new Float32Array(nos.length * 3), arvNosGeo = guarda(new THREE.BufferGeometry());
  arvNosGeo.setAttribute("position", new THREE.BufferAttribute(arvNosPos, 3)); arvNosGeo.setAttribute("color", new THREE.BufferAttribute(arvNosCor, 3));
  nos.forEach((n, i) => { const c = n.nivel === 0 ? CIANO : n.nivel < 3 ? VERDE : OURO; c.toArray(arvNosCor, i * 3); });
  const arvNosMat = guarda(new THREE.PointsMaterial({ size: 0.03, map: estrela, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const arvNos = new THREE.Points(arvNosGeo, arvNosMat); arvNos.renderOrder = 5; arvore.add(arvNos);
  const arvArestasPos = new Float32Array((nos.length - 1) * 6), arvArestasGeo = guarda(new THREE.BufferGeometry());
  arvArestasGeo.setAttribute("position", new THREE.BufferAttribute(arvArestasPos, 3));
  const arvArestasMat = guarda(new THREE.LineBasicMaterial({ color: VERDE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const arvArestas = new THREE.LineSegments(arvArestasGeo, arvArestasMat); arvArestas.frustumCulled = false; arvArestas.renderOrder = 5; arvore.add(arvArestas);
  const MAX_NIVEL = 4;

  // ── CÉREBRO ──
  const NCER = 520, cerAlvo = new Float32Array(NCER * 3), cerSolto = new Float32Array(NCER * 3), cerPos = new Float32Array(NCER * 3), cerCor = new Float32Array(NCER * 3);
  for (let i = 0; i < NCER; i++) {
    const hem = i % 2 ? 1 : -1, u = Math.random() * Math.PI * 2, v = Math.acos(aleat(-1, 1));
    const giro = 1 + 0.09 * Math.sin(u * 7) * Math.sin(v * 9);
    const x = hem * (0.034 + Math.abs(Math.sin(v) * Math.cos(u)) * 0.058 * giro), y = Math.cos(v) * 0.056 * giro + 0.004, z = Math.sin(v) * Math.sin(u) * 0.078 * giro;
    cerAlvo.set([x, y, z], i * 3);
    const d = aleat(0.25, 0.5), a = Math.random() * Math.PI * 2, b = aleat(-1, 1);
    cerSolto.set([Math.cos(a) * d * Math.sqrt(1 - b * b), b * d, Math.sin(a) * d * Math.sqrt(1 - b * b)], i * 3);
    MAGENTA.clone().lerp(CIANO, Math.random()).toArray(cerCor, i * 3);
  }
  const cerebro = new THREE.Group(); raiz.add(cerebro);
  const campoCerebro = novoCampo(); campoCerebro.scale.setScalar(0.3); campoCerebro.position.z = -0.1;
  const giroCerebro = new THREE.Group(); cerebro.add(campoCerebro, giroCerebro);
  const cerGeo = guarda(new THREE.BufferGeometry()); cerGeo.setAttribute("position", new THREE.BufferAttribute(cerPos, 3)); cerGeo.setAttribute("color", new THREE.BufferAttribute(cerCor, 3));
  const cerMat = guarda(new THREE.PointsMaterial({ size: 0.017, map: estrela, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const cerPontos = new THREE.Points(cerGeo, cerMat); cerPontos.frustumCulled = false; cerPontos.renderOrder = 5; giroCerebro.add(cerPontos);
  const NSIN = 40, sinPos = new Float32Array(NSIN * 6), sinGeo = guarda(new THREE.BufferGeometry());
  sinGeo.setAttribute("position", new THREE.BufferAttribute(sinPos, 3));
  const sinMat = guarda(new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const sinapses = new THREE.LineSegments(sinGeo, sinMat); sinapses.frustumCulled = false; sinapses.renderOrder = 5; giroCerebro.add(sinapses);
  const novasSinapses = () => {
    for (let s = 0; s < NSIN; s++) {
      const a = Math.floor(Math.random() * NCER); let b = a, melhor = 1e9;
      for (let t = 0; t < 12; t++) { const c = Math.floor(Math.random() * NCER), dx = cerAlvo[a * 3]! - cerAlvo[c * 3]!, dy = cerAlvo[a * 3 + 1]! - cerAlvo[c * 3 + 1]!, dz = cerAlvo[a * 3 + 2]! - cerAlvo[c * 3 + 2]!, d = dx * dx + dy * dy + dz * dz; if (c !== a && d < melhor) { melhor = d; b = c; } }
      sinPos.set(cerAlvo.subarray(a * 3, a * 3 + 3), s * 6); sinPos.set(cerAlvo.subarray(b * 3, b * 3 + 3), s * 6 + 3);
    }
    sinGeo.attributes.position!.needsUpdate = true;
  };
  novasSinapses();

  // ═══════════════════════ PODERES CÓSMICOS (o laço da geração longa) ═══════════════════════
  // texturas de uso comum: um ANEL fino e luminoso, e um SIGILO rúnico (ticks + glifos num círculo)
  const ondaTex = (() => {
    const c = novoCanvas(128, 128), g = ctx2d(c), gr = g.createRadialGradient(64, 64, 40, 64, 64, 62);
    gr.addColorStop(0, "rgba(95,242,255,0)"); gr.addColorStop(0.82, "rgba(95,242,255,0)"); gr.addColorStop(0.9, "rgba(170,250,255,.95)"); gr.addColorStop(0.96, "rgba(95,242,255,.6)"); gr.addColorStop(1, "rgba(95,242,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return guarda(textura(c));
  })();
  const sigiloTex = (() => {
    const c = novoCanvas(256, 256), g = ctx2d(c); g.translate(128, 128);
    g.strokeStyle = "rgba(255,211,107,.95)"; g.lineWidth = 3; for (const R of [118, 86]) { g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 2; for (let k = 0; k < 48; k++) { const a = (k / 48) * Math.PI * 2, r0 = 86, r1 = k % 4 ? 100 : 112; g.beginPath(); g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); g.stroke(); }
    g.strokeStyle = "rgba(255,61,242,.9)"; g.lineWidth = 2.5; for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 - Math.PI / 2, b = ((k + 3) / 7) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 80, Math.sin(a) * 80); g.lineTo(Math.cos(b) * 80, Math.sin(b) * 80); g.stroke(); }   // o heptagrama no meio
    const runas = ["ᚨ", "ᛉ", "ᛟ", "ᚾ", "ᛊ", "ᛏ", "ᛗ", "ᛒ", "ᚦ", "ᛚ", "ᚲ", "ᛖ"];
    g.font = "22px serif"; g.fillStyle = "rgba(201,249,255,.9)"; g.textAlign = "center"; g.textBaseline = "middle"; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.save(); g.rotate(a); g.fillText(runas[k]!, 0, -103); g.restore(); }
    return guarda(textura(c));
  })();

  // ── TELEPATIA: ondas da mente saindo da cabeça + um halo de pensamentos sugados pra dentro ──
  const telepatia = new THREE.Group(); raiz.add(telepatia);
  const ondas = [0, 1, 2].map((i) => { const m = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: ondaTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: i === 1 ? MAGENTA : CIANO }))); m.renderOrder = 7; telepatia.add(m); return { m, fase: i / 3 }; });
  const NPENS = 48, pensPos = new Float32Array(NPENS * 3), pensGeo = guarda(new THREE.BufferGeometry()); pensGeo.setAttribute("position", new THREE.BufferAttribute(pensPos, 3));
  const pensBase = Array.from({ length: NPENS }, () => { const a = Math.random() * Math.PI * 2, b = Math.acos(aleat(-1, 1)), r = aleat(0.34, 0.6); return { dir: new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b) * 0.7, Math.sin(b) * Math.sin(a)), r, fase: Math.random() * Math.PI * 2 }; });
  const pensMat = guarda(new THREE.PointsMaterial({ size: 0.02, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pensamentos = new THREE.Points(pensGeo, pensMat); pensamentos.frustumCulled = false; telepatia.add(pensamentos);

  // ── LEITURA: um livro holográfico aberto flutuando à frente, páginas com texto, glifos subindo pra cabeça ──
  const livro = new THREE.Group(); raiz.add(livro);
  const pagTex = (() => { const c = novoCanvas(256, 256), g = ctx2d(c); g.fillStyle = "rgba(10,40,70,.35)"; g.fillRect(0, 0, 256, 256); g.strokeStyle = "rgba(170,250,255,.85)"; g.lineWidth = 4; g.strokeRect(6, 6, 244, 244); g.lineWidth = 3; for (let l = 0; l < 13; l++) { const y = 26 + l * 17, w = aleat(60, 232); g.beginPath(); g.moveTo(18, y); g.lineTo(18 + w, y); g.stroke(); } return guarda(textura(c)); })();
  const pagMat = () => guarda(new THREE.MeshBasicMaterial({ map: pagTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: CIANO }));
  const pagE = new THREE.Mesh(geoTela, pagMat()), pagD = new THREE.Mesh(geoTela, pagMat()), folha = new THREE.Mesh(geoTela, pagMat());
  pagE.scale.set(0.2, 0.26, 1); pagD.scale.set(0.2, 0.26, 1); folha.scale.set(0.2, 0.26, 1);
  pagE.position.set(-0.105, 0, 0); pagD.position.set(0.105, 0, 0); pagE.rotation.y = 0.33; pagD.rotation.y = -0.33;
  const lombada = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: ondaTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: OURO }))); lombada.scale.set(0.03, 0.27, 1);
  livro.add(pagE, pagD, folha, lombada); const flip = { t: 1, prox: 0 };

  // ── FEITIÇO: um sigilo rúnico girando à frente das palmas, carrega e ESTOURA num pulso de partículas ──
  const feitico = new THREE.Group(); raiz.add(feitico);
  const sigilos = [0, 1].map((i) => { const m = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: sigiloTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: i ? MAGENTA : OURO }))); m.scale.setScalar(i ? 0.19 : 0.3); feitico.add(m); return m; });
  const nucleoFeitico = new THREE.Sprite(brilhoMat(new THREE.Color("#fff4d6"))); nucleoFeitico.scale.setScalar(0.08); feitico.add(nucleoFeitico);
  const NEST = 40, estPos = new Float32Array(NEST * 3), estGeo = guarda(new THREE.BufferGeometry()); estGeo.setAttribute("position", new THREE.BufferAttribute(estPos, 3));
  const estMat = guarda(new THREE.PointsMaterial({ size: 0.03, map: estrela, color: OURO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const estouro = new THREE.Points(estGeo, estMat); estouro.frustumCulled = false; feitico.add(estouro);
  const estDir = Array.from({ length: NEST }, () => { const a = Math.random() * Math.PI * 2, b = Math.acos(aleat(-1, 1)); return new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)); });

  // ── TELECINESE: cristais levitando e orbitando entre as mãos erguidas ──
  const telecinese = new THREE.Group(); raiz.add(telecinese);
  const corCris = [MAGENTA, CIANO, new THREE.Color("#c9b8ff")];
  const cristais = Array.from({ length: 10 }, (_, i) => { const sp = new THREE.Sprite(brilhoMat(corCris[i % 3]!)); sp.scale.setScalar(0.028 + (i % 3) * 0.012); telecinese.add(sp); return { sp, a: Math.random() * Math.PI * 2, r: aleat(0.11, 0.26), y: aleat(-0.12, 0.16), vel: aleat(0.6, 1.3) * (Math.random() < 0.5 ? 1 : -1), fase: Math.random() * 7 }; });
  const nucleoTele = new THREE.Sprite(brilhoMat(new THREE.Color("#e8ddff"))); nucleoTele.scale.setScalar(0.06); telecinese.add(nucleoTele);

  // ── PORTAL: uma fenda dimensional (anel + vórtice girando) se abre à frente ──
  const portal = new THREE.Group(); raiz.add(portal);
  const vortexTex = (() => {
    const c = novoCanvas(256, 256), g = ctx2d(c); g.translate(128, 128);
    for (let b = 0; b < 5; b++) { g.strokeStyle = b % 2 ? "rgba(191,138,255,.8)" : "rgba(95,242,255,.7)"; g.lineWidth = 7 - b; g.beginPath(); for (let t = 0; t < 120; t++) { const an = t * 0.26 + b * 1.25, r = 6 + t * 0.95; const x = Math.cos(an) * r, y = Math.sin(an) * r; t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    return guarda(textura(c));
  })();
  const vortex = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: vortexTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color("#b98aff") }))); vortex.scale.setScalar(0.34);
  const anelPortal = new THREE.Mesh(geoTela, guarda(new THREE.MeshBasicMaterial({ map: ondaTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: MAGENTA }))); anelPortal.scale.setScalar(0.42);
  portal.add(vortex, anelPortal);
  const NPV = 26, pvPos = new Float32Array(NPV * 3), pvGeo = guarda(new THREE.BufferGeometry()); pvGeo.setAttribute("position", new THREE.BufferAttribute(pvPos, 3));
  const pvMat = guarda(new THREE.PointsMaterial({ size: 0.02, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pvPontos = new THREE.Points(pvGeo, pvMat); pvPontos.frustumCulled = false; portal.add(pvPontos);
  const pvBase = Array.from({ length: NPV }, () => ({ a: Math.random() * Math.PI * 2, r: aleat(0.2, 0.42), fase: Math.random() }));

  // ── CONSTELAÇÃO: ela desenha um mapa estelar no ar — estrelas surgem e se ligam, o dedo traçando ──
  const constel = new THREE.Group(); raiz.add(constel);
  const ESTRELAS: [number, number][] = ([[-0.16, 0.2], [-0.05, 0.12], [0.03, 0.22], [0.12, 0.08], [0.17, -0.05], [0.04, -0.1], [-0.06, -0.04], [-0.17, -0.12], [-0.02, 0.0]] as [number, number][]).map(([x, y]) => [x * 1.35, y * 1.35]);
  const cnPos = new Float32Array(ESTRELAS.length * 3), cnGeo = guarda(new THREE.BufferGeometry()); cnGeo.setAttribute("position", new THREE.BufferAttribute(cnPos, 3));
  const cnMat = guarda(new THREE.PointsMaterial({ size: 0.065, map: estrela, color: new THREE.Color("#dbe8ff"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const cnPontos = new THREE.Points(cnGeo, cnMat); cnPontos.frustumCulled = false; constel.add(cnPontos);
  const cnLinPos = new Float32Array((ESTRELAS.length - 1) * 6), cnLinGeo = guarda(new THREE.BufferGeometry()); cnLinGeo.setAttribute("position", new THREE.BufferAttribute(cnLinPos, 3));
  const cnLinMat = guarda(new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const cnLinhas = new THREE.LineSegments(cnLinGeo, cnLinMat); cnLinhas.frustumCulled = false; constel.add(cnLinhas);
  const ponta = new THREE.Sprite(brilhoMat(new THREE.Color("#ffffff"))); ponta.scale.setScalar(0.05); constel.add(ponta);   // a ponta do dedo que traça

  // ── o estado (zerado a cada troca de avatar) ──
  const w = { olhos: 0, rede: 0, aranha: 0, energia: 0, arvore: 0, cerebro: 0, abrir: 0, digitar: 0, telepatia: 0, leitura: 0, feitico: 0, telecinese: 0, portal: 0, constelacao: 0, maos: 0 };
  let ultimaSeq: Sequencia | null = null, ultimoCiclo = -1, proxSinapse = 0, inicioGeracao = 0, lado = 1;
  const peito = new THREE.Vector3(), quadrilV = new THREE.Vector3(), pOlho = new THREE.Vector3(), paraCam = new THREE.Vector3(), camDir = new THREE.Vector3(), camDireita = new THREE.Vector3(), camCima = new THREE.Vector3();
  const zerar = () => {
    for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] = 0;
    ultimaSeq = null; ultimoCiclo = -1; ar.iniciada = false; en.ativa = false; ali.tela = -1; ali.fome = 0; drenada.clear();
    for (const p of pac) p.vivo = false;
    for (const t of telas) { t.glitch = 0; for (const v of t.u.toques!.value as THREE.Vector4[]) v.set(0, 0, 0, 0); }
    raiz.visible = false;
  };
  zerar();

  const chegar = (atual: number, alvo: number, dt: number, vel = 3.5) => atual + (alvo - atual) * (1 - Math.exp(-dt * vel));

  const atualizar: Sequencias["atualizar"] = ({ agora, dt, gerandoHa, vrm, cam }) => {
    const s = gerandoHa === null ? null : sequenciaEm(gerandoHa);
    const env = s ? envelope(s.u, s.seq === "pensar" ? 0.25 : 0.1, 0.1) : 0;
    const nova = !!s && (s.seq !== ultimaSeq || s.ciclo !== ultimoCiclo);
    if (s) { ultimaSeq = s.seq; ultimoCiclo = s.ciclo; } else { ultimaSeq = null; ultimoCiclo = -1; }
    if (nova && s?.seq === "pensar") { inicioGeracao = agora; lado = Math.random() < 0.5 ? -1 : 1; }   // cada resposta, um lado da câmera
    // os pesos de cada parte (os olhos ficam acesos a geração toda, mais fortes pensando; ela levita depois do pensar)
    w.olhos = chegar(w.olhos, s ? (s.seq === "pensar" ? 1 : 0.55) : 0, dt, 5);
    const naRede = s?.seq === "raspar" || s?.seq === "energia";
    w.rede = chegar(w.rede, naRede ? 1 : 0, dt, 3.5);
    w.aranha = chegar(w.aranha, s?.seq === "raspar" ? 1 : 0, dt, 3);
    w.energia = chegar(w.energia, s?.seq === "energia" ? env : 0, dt, 4);
    w.arvore = chegar(w.arvore, s?.seq === "arvore" ? env : 0, dt, 4);
    w.cerebro = chegar(w.cerebro, s?.seq === "cerebro" ? env : 0, dt, 4);
    w.telepatia = chegar(w.telepatia, s?.seq === "telepatia" ? env : 0, dt, 4);
    w.leitura = chegar(w.leitura, s?.seq === "leitura" ? env : 0, dt, 4);
    w.feitico = chegar(w.feitico, s?.seq === "feitico" ? env : 0, dt, 4);
    w.telecinese = chegar(w.telecinese, s?.seq === "telecinese" ? env : 0, dt, 4);
    w.portal = chegar(w.portal, s?.seq === "portal" ? env : 0, dt, 4);
    w.constelacao = chegar(w.constelacao, s?.seq === "constelacao" ? env : 0, dt, 4);
    w.abrir = chegar(w.abrir, naRede ? 1 : s && s.seq !== "pensar" ? 0.55 : 0, dt, 1.3);
    w.digitar = chegar(w.digitar, naRede ? 1 : 0, dt, 4);
    // as mãos posam nas cenas de poder (o corpo faz o IK pros alvos de cada cena)
    const COM_MAOS: Partial<Record<Sequencia, number>> = { raspar: w.rede, energia: w.rede, telepatia: w.telepatia, leitura: w.leitura, feitico: w.feitico, telecinese: w.telecinese, portal: w.portal, constelacao: w.constelacao };
    const poseMaos = (s && COM_MAOS[s.seq]) || 0;
    w.maos = chegar(w.maos, poseMaos, dt, 4);
    // a câmera em TRÊS-QUARTOS (cada resposta de um lado), derivando devagar
    const orbita = (lado * 0.5 + Math.sin((agora - inicioGeracao) * 0.22) * 0.12) * w.abrir;
    const olhar = Math.sin(agora * 0.55) * 0.32 + Math.sin(agora * 1.7) * 0.06;
    // a cabeça: lendo baixa pro livro; telepata e constelação erguem; conjurando/telecinese olham as mãos
    const cabecaTilt = w.leitura * 0.42 + w.feitico * 0.12 + w.telecinese * 0.08 + w.portal * 0.06 - w.telepatia * 0.14 - w.constelacao * 0.22;
    const algo = w.olhos + w.rede + w.arvore + w.cerebro + w.energia + w.telepatia + w.leitura + w.feitico + w.telecinese + w.portal + w.constelacao > 0.005;
    raiz.visible = algo;
    const res: ResultadoSeq = { abrir: w.abrir, orbita, digitar: w.digitar, maos, maosPeso: w.maos, cabecaTilt, olhar, seq: s?.seq ?? null, nova };
    if (!algo || !vrm) return res;

    const h = vrm.humanoid;
    (h.getRawBoneNode("upperChest") ?? h.getRawBoneNode("chest"))?.getWorldPosition(peito);
    h.getRawBoneNode("head")?.getWorldPosition(cabeca);
    h.getRawBoneNode("hips")?.getWorldPosition(quadrilV);
    cam.getWorldDirection(camDir); camDireita.crossVectors(camDir, cam.up).normalize(); camCima.crossVectors(camDireita, camDir).normalize();

    // OLHOS: nos ossos dos olhos (ou na frente da cabeça), puxados um tiquinho pra câmera
    const pulso = 0.75 + 0.25 * Math.sin(agora * (ultimaSeq === "pensar" ? 9 : 4));
    (["leftEye", "rightEye"] as const).forEach((osso, i) => {
      const n = h.getRawBoneNode(osso);
      if (n) n.getWorldPosition(pOlho); else pOlho.copy(cabeca).add(aux.set(i ? -0.03 : 0.03, 0.03, 0.06));
      paraCam.copy(cam.position).sub(pOlho).normalize();
      pOlho.addScaledVector(paraCam, 0.03);
      olhos[i]!.position.copy(pOlho); nucleos[i]!.position.copy(pOlho);
      (olhos[i]!.material as THREE.SpriteMaterial).opacity = w.olhos * pulso;
      (nucleos[i]!.material as THREE.SpriteMaterial).opacity = w.olhos * 0.9;
      olhos[i]!.scale.setScalar(0.05 + 0.05 * w.olhos * pulso);
    });

    // os ANÉIS sob ela (a levitação toda)
    aneis.forEach((m, i) => {
      m.position.set(0, 0.01 + i * 0.004, 0.02); m.rotation.z = agora * (i ? -0.5 : 0.32);   // (no chão, sob os pés dela)
      (m.material as THREE.MeshBasicMaterial).opacity = w.rede * (i ? 0.5 : 0.75) * (0.85 + 0.15 * Math.sin(agora * 3 + i));
    });

    // REDE: as telas, o teclado, os feixes, a aranha (se alimentando) e a energia
    rede.visible = w.rede > 0.005;
    teclado.visible = w.digitar > 0.01 || w.rede > 0.01;
    feixes.visible = rede.visible;
    if (rede.visible) {
      rede.position.set(0, peito.y, 0);
      for (const t of telas) {
        const e = sstep((w.rede - t.atraso) / 0.4);
        t.glitch = Math.max(0, t.glitch - dt);
        if (t.camada !== "principal" && Math.random() < dt * 0.35) t.glitch = aleat(0.08, 0.25);   // um glitch de vez em quando
        t.u.tempo!.value = agora; t.u.glitch!.value = t.glitch > 0 ? 1 : 0;
        const dr = drenada.get(telas.indexOf(t)) ?? 0;   // a aranha comeu essa tela: ela apaga e encolhe, e volta devagar
        t.u.opac!.value = e * (t.camada === "longe" ? 0.45 : t.camada === "perto" ? 0.32 : 0.92) * (1 - 0.8 * dr);
        for (const v of t.u.toques!.value as THREE.Vector4[]) v.z = Math.max(0, v.z - dt * 1.6);
        if (t.camada === "perto") {
          const o = pertoOff[telas.indexOf(t) - (telas.length - pertoOff.length)]!;
          t.mesh.position.copy(cam.position).addScaledVector(camDir, o[2]).addScaledVector(camDireita, o[0]).addScaledVector(camCima, o[1]).sub(rede.position);
          t.mesh.quaternion.copy(cam.quaternion);
        } else {
          t.mesh.position.set(t.base.x, t.base.y + Math.sin(agora * 0.9 + t.atraso * 30) * 0.008, t.base.z);
          if (t.olhar) t.mesh.lookAt(aux.set(0, peito.y + 0.02, 0));
        }
        t.mesh.scale.set(t.w * (0.2 + 0.8 * e) * (1 - 0.35 * dr), t.h * e * (1 - 0.35 * dr), 1);
        if (t.halo) { t.halo.position.copy(t.mesh.position).addScaledVector(aux2.copy(t.mesh.position).setY(0).normalize(), 0.02); (t.halo.material as THREE.SpriteMaterial).opacity = e * 0.28; }
      }

      // a ARANHA anda pela página
      if (!ar.iniciada) { ar.pos.set(aleat(-0.3, 0.3), -0.2, PAREDE_Z); aranha.scale.setScalar(ESCALA); ar.alvo.copy(ar.pos); ar.iniciada = true; for (const p of pernas) { ideal(p, p.pe); p.passo = 1; } }
      ar.pausa -= dt;
      if (ar.pos.distanceTo(ar.alvo) < 0.02 && ar.pausa <= 0) {
        ar.alvo.set((Math.random() < 0.5 ? -1 : 1) * aleat(0.15, 0.42), aleat(-0.24, 0.32), ar.pos.z);
        // parou: SE ALIMENTA de uma tela do arco (ela é drenada num fluxo até a aranha)
        if (w.aranha > 0.5 && Math.random() < 0.65) { ali.tela = 1 + Math.floor(Math.random() * 16); ali.ate = agora + aleat(0.9, 1.4); ar.pausa = ali.ate - agora; telas[ali.tela]!.glitch = 0.3; }
        else ar.pausa = aleat(0.1, 0.4);
      }
      if (ali.tela >= 0) {
        if (agora > ali.ate) { ali.tela = -1; ali.fome = Math.min(1, ali.fome + 0.25); }
        else {
          drenada.set(ali.tela, Math.min(1, (drenada.get(ali.tela) ?? 0) + dt * 0.9));
          if (agora > ali.proxGota) { const tl = telas[ali.tela]!; soltarPacote(aux.copy(tl.mesh.position).add(rede.position).add(aux2.set(aleat(-0.05, 0.05), aleat(-0.03, 0.03), 0)), aux2.copy(ar.pos).add(rede.position), 0.42, 0.04); ali.proxGota = agora + 0.035; }
        }
      }
      for (const [k, v] of drenada) { const nv = k === ali.tela ? v : v - dt * 0.3; if (nv <= 0) drenada.delete(k); else drenada.set(k, nv); }
      if (ar.pausa <= 0) {
        aux.copy(ar.alvo).sub(ar.pos); const d = aux.length();
        if (d > 1e-4) {
          const rumoAlvo = Math.atan2(-aux.x, aux.y); let dr = rumoAlvo - ar.rumo; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
          ar.rumo += dr * Math.min(1, dt * 6);
          ar.pos.addScaledVector(aux.normalize(), Math.min(d, dt * 0.22));
        }
      }
      aranha.position.copy(ar.pos); aranha.rotation.set(0, 0, ar.rumo);
      const andando = ar.pausa <= 0, grupoLivre = pernas.every((p) => p.passo >= 1 || (p.k + (p.lado > 0 ? 1 : 0)) % 2 === ar.grupo);
      for (const p of pernas) {
        const meu = (p.k + (p.lado > 0 ? 1 : 0)) % 2;
        ideal(p, aux2);
        if (p.passo >= 1 && andando && meu === ar.grupo && grupoLivre && p.pe.distanceTo(aux2) > 0.022 * ESCALA) {
          p.de.copy(p.pe); p.para.copy(aux2).addScaledVector(aux.set(-Math.sin(ar.rumo), Math.cos(ar.rumo), 0), 0.018 * ESCALA); p.passo = 0;
        }
        if (p.passo < 1) {
          p.passo = Math.min(1, p.passo + dt / 0.11);
          p.pe.lerpVectors(p.de, p.para, sstep(p.passo)); p.pe.z = ar.pos.z + Math.sin(p.passo * Math.PI) * 0.018 * ESCALA;
          if (p.passo >= 1) {   // POUSOU: um anel de glitch na página, e às vezes um pacote até a cabeça dela
            p.pe.z = ar.pos.z;
            const toques = principal.u.toques!.value as THREE.Vector4[];
            toques[ar.toque++ % 4]!.set((p.pe.x - principal.base.x) / PRINC.w + 0.5, (p.pe.y - principal.base.y) / PRINC.h + 0.5, 1, 0);
            if (Math.random() < 0.12) soltarPacote(aux.copy(p.pe).add(rede.position), cabeca, 0.75, 0.25);
          }
        }
      }
      if (pernas.every((p) => p.passo >= 1 || (p.k + (p.lado > 0 ? 1 : 0)) % 2 !== ar.grupo)) ar.grupo = 1 - ar.grupo;
      pernas.forEach((p, i) => {
        quadril(p, aux);
        const d = aux.distanceTo(p.pe), L = 0.034 * ESCALA, alt = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
        joelho.addVectors(aux, p.pe).multiplyScalar(0.5);
        aux2.subVectors(p.pe, aux).normalize();
        joelho.x += -aux2.y * p.lado * alt * 0.8; joelho.y += aux2.x * p.lado * alt * 0.8; joelho.z += alt + 0.006;
        pernasPos.set([aux.x, aux.y, aux.z, joelho.x, joelho.y, joelho.z, joelho.x, joelho.y, joelho.z, p.pe.x, p.pe.y, p.pe.z], i * 12);
      });
      pernasGeo.attributes.position!.needsUpdate = true;
      const vis = sstep((Math.min(w.rede, w.aranha) - 0.2) / 0.5);
      pernasMat.opacity = vis; juntasMat.opacity = vis; corpoMat.opacity = vis * 0.95;
      (brilhoAranha.material as THREE.SpriteMaterial).opacity = vis * (0.6 + 0.4 * Math.sin(agora * 7));
      brilhoAranha.scale.setScalar(0.07 + 0.07 * ali.fome + (ali.tela >= 0 ? 0.03 * Math.sin(agora * 30) : 0));   // (cresce a cada refeição)
      for (const o of olhosAranha) (o.material as THREE.SpriteMaterial).opacity = vis;
    }

    // COMANDO: ela controla as telas com as MÃOS ABERTAS erguidas — SEM teclado, SEM digitar (o dono pediu). Os feixes
    // de energia saem das mãos pras telas; de vez em quando um pacote de dados voa até uma tela. (O teclado e o brilho
    // das teclas ficam escondidos; o `teclado` só serve de âncora pros raios da energia mirarem perto das mãos.)
    teclado.visible = false; tecladoMat.opacity = 0;
    for (const t of toquesTecla) (t.s.material as THREE.SpriteMaterial).opacity = 0;
    if (w.rede > 0.01) {
      const centro = aux.copy(peito).addScaledVector(camCima, 0.12).addScaledVector(camDir, -0.1);   // o ponto entre as mãos
      teclado.position.copy(centro);
      maos.esq.copy(centro).addScaledVector(camDireita, 0.22);
      maos.dir.copy(centro).addScaledVector(camDireita, -0.22);
      for (let i = 0; i < NFEIXE; i++) {
        if (Math.random() < dt * 2) feixeAlvo[i] = 1 + Math.floor(Math.random() * 16);
        const alvo = telas[feixeAlvo[i]!]!; aux2.copy(alvo.mesh.position).add(rede.position);
        const origem = i % 2 ? maos.esq : maos.dir;
        feixePos.set([origem.x, origem.y, origem.z, aux2.x, aux2.y, aux2.z], i * 6);
      }
      feixeGeo.attributes.position!.needsUpdate = true; feixeMat.opacity = w.rede * 0.3 * (0.6 + 0.4 * Math.random());
      if (Math.random() < dt * 4 && w.rede > 0.5) { const alvo = telas[feixeAlvo[Math.floor(Math.random() * NFEIXE)]!]!; soltarPacote(maos.dir, aux2.copy(alvo.mesh.position).add(rede.position), 0.5, 0.05); }
    }

    // PACOTES
    pacotes.visible = pac.some((p) => p.vivo);
    if (pacotes.visible) {
      pac.forEach((p, i) => {
        if (!p.vivo) { pacPos.set([0, -99, 0], i * 3); return; }
        p.t += dt / p.dur; if (p.t >= 1) { p.vivo = false; pacPos.set([0, -99, 0], i * 3); return; }
        const u = sstep(p.t);
        aux.lerpVectors(p.de, p.para, u); aux.z += Math.sin(u * Math.PI) * p.arco; aux.y += Math.sin(u * Math.PI) * 0.06;
        pacPos.set([aux.x, aux.y, aux.z], i * 3);
      });
      pacGeo.attributes.position!.needsUpdate = true;
    }

    // ENERGIA: a aranha vira uma esfera que sobe por trás dela; RAIOS em ziguezague saltam pras telas
    const vEn = w.energia, comEnergia = vEn > 0.01;
    esfera.visible = raios.visible = raios2.visible = comEnergia; for (const p of pontas) p.visible = comEnergia;
    if (comEnergia) {
      if (!en.ativa) { en.ativa = true; en.desde = agora; en.de.copy(ar.iniciada ? aux.copy(ar.pos).add(rede.position) : aux.set(0, peito.y, -0.5)); en.proxRaio = 0; }
      const u = sstep((agora - en.desde) / 1.4);
      en.pos.lerpVectors(en.de, aux.set(-lado * 0.28, peito.y + 0.42, -0.22), u);   // (por cima, do lado oposto à câmera: não some atrás da cabeça) en.pos.y += Math.sin(agora * 1.7) * 0.015;
      esfera.position.copy(en.pos);
      const pul = 0.85 + 0.15 * Math.sin(agora * 12) + (Math.random() < 0.08 ? 0.3 : 0);
      esferaCamadas.forEach(({ sp, tam }, i) => { (sp.material as THREE.SpriteMaterial).opacity = vEn * (i === 2 ? 1 : 0.85) * Math.min(1, pul); sp.scale.setScalar(tam * (0.5 + 0.5 * u) * pul); });
      for (let i = 0; i < NORB; i++) { const ang = agora * (1.6 + (i % 3) * 0.7) + i * 2.4, r = 0.07 + 0.035 * Math.sin(i * 1.3 + agora); orbPos.set([Math.cos(ang) * r, Math.sin(agora * 2.6 + i) * 0.05, Math.sin(ang) * r], i * 3); }
      orbGeo.attributes.position!.needsUpdate = true; orbMat.opacity = vEn;
      if (agora > en.proxRaio && u > 0.3) {
        en.proxRaio = agora + aleat(0.05, 0.11);
        for (let i = 0; i < NRAIO; i++) {
          if (i < 4) { const k = 1 + Math.floor(Math.random() * 16), tl = telas[k]!; aux2.copy(tl.mesh.position).add(rede.position); tl.glitch = Math.max(tl.glitch, 0.15); }
          else if (i === 4) aux2.copy(teclado.position);
          else aux2.set(principal.base.x + aleat(-0.4, 0.4), principal.base.y + aleat(-0.25, 0.25), principal.base.z).add(rede.position);
          desenharRaio(i, en.pos, aux2); pontas[i]!.position.copy(aux2);
        }
        raioGeo.attributes.position!.needsUpdate = true; raio2Geo.attributes.position!.needsUpdate = true;
      }
      raioMat.opacity = u * vEn * (0.8 + 0.2 * Math.random()); raio2Mat.opacity = u * vEn * 0.8;
      for (const p of pontas) (p.material as THREE.SpriteMaterial).opacity = u * vEn * aleat(0.4, 1);
    } else en.ativa = false;

    // ÁRVORE: cresce do peito pra cima, nível por nível
    arvore.visible = w.arvore > 0.005;
    if (arvore.visible) {
      arvore.position.set(0, peito.y - 0.22, peito.z + 0.3); arvore.lookAt(cam.position);
      const cres = s?.seq === "arvore" ? Math.min(1, s.u * 1.6) * MAX_NIVEL : MAX_NIVEL;
      nos.forEach((n, i) => {
        const e = sstep(cres - n.nivel + 0.5);
        if (n.pai < 0) { arvNosPos.set([n.pos.x, n.pos.y, n.pos.z], 0); return; }
        const pai = nos[n.pai]!.pos;
        aux.lerpVectors(pai, n.pos, e);
        arvNosPos.set(e > 0.02 ? [aux.x, aux.y, aux.z] : [pai.x, pai.y, pai.z], i * 3);
        arvArestasPos.set([pai.x, pai.y, pai.z, aux.x, aux.y, aux.z], (i - 1) * 6);
      });
      arvNosGeo.attributes.position!.needsUpdate = true; arvArestasGeo.attributes.position!.needsUpdate = true;
      arvNosMat.opacity = w.arvore; arvNosMat.size = 0.032 + 0.008 * Math.sin(agora * 5);
      (campoArvore.material as THREE.MeshBasicMaterial).opacity = w.arvore * 0.95;
      arvArestasMat.opacity = w.arvore * 0.8;
    }

    // CÉREBRO: as partículas se juntam e ele gira; as sinapses piscam
    cerebro.visible = w.cerebro > 0.005;
    if (cerebro.visible) {
      cerebro.position.set(0, peito.y - 0.1, peito.z + 0.3); cerebro.lookAt(cam.position); giroCerebro.rotation.y = agora * 0.6;
      (campoCerebro.material as THREE.MeshBasicMaterial).opacity = w.cerebro * 0.95;
      const junta = sstep(s?.seq === "cerebro" ? s.u * 2.2 : 1);
      for (let i = 0; i < NCER * 3; i++) cerPos[i] = cerSolto[i]! + (cerAlvo[i]! - cerSolto[i]!) * junta;
      cerGeo.attributes.position!.needsUpdate = true;
      cerMat.opacity = w.cerebro;
      if (agora > proxSinapse) { novasSinapses(); proxSinapse = agora + aleat(0.15, 0.35); }
      sinMat.opacity = w.cerebro * junta * (0.5 + 0.5 * Math.random());
    }

    // TELEPATIA: ondas concêntricas saindo da cabeça + os pensamentos num halo, sugados pra dentro
    telepatia.visible = w.telepatia > 0.005;
    if (telepatia.visible) {
      for (const o of ondas) {
        const u = (agora * 0.5 + o.fase) % 1;
        o.m.position.copy(cabeca); o.m.quaternion.copy(cam.quaternion); o.m.scale.setScalar(0.12 + u * 0.8);
        (o.m.material as THREE.MeshBasicMaterial).opacity = w.telepatia * sstep(1 - u) * sstep(u * 4) * 0.85;
      }
      const suga = 0.55 + 0.45 * Math.sin(agora * 1.5);
      for (let i = 0; i < NPENS; i++) {
        const p = pensBase[i]!, rr = p.r * (0.5 + 0.5 * ((Math.sin(agora * 0.8 + p.fase) + 1) / 2)) * (0.45 + 0.55 * suga);
        aux.copy(cabeca).addScaledVector(p.dir, rr); pensPos.set([aux.x, aux.y, aux.z], i * 3);
      }
      pensGeo.attributes.position!.needsUpdate = true; pensMat.opacity = w.telepatia * 0.9;
      maos.esq.copy(cabeca).addScaledVector(camDireita, 0.12).addScaledVector(camDir, 0.04).addScaledVector(camCima, -0.03);
      maos.dir.copy(cabeca).addScaledVector(camDireita, -0.12).addScaledVector(camDir, 0.04).addScaledVector(camCima, -0.03);
    }

    // LEITURA: o livro holográfico à frente (ENTRE ela e a câmera: -camDir), páginas virando, glifos subindo pra cabeça
    livro.visible = w.leitura > 0.005;
    if (livro.visible) {
      livro.position.copy(peito).addScaledVector(camDir, -0.26).addScaledVector(camCima, -0.1);
      livro.quaternion.copy(cam.quaternion); livro.rotateX(0.6); livro.updateMatrixWorld(true);
      const op = w.leitura;
      for (const m of [pagE, pagD, lombada]) (m.material as THREE.MeshBasicMaterial).opacity = op * 0.9;
      flip.t = Math.min(1, flip.t + dt / 0.5);
      if (agora > flip.prox) { flip.t = 0; flip.prox = agora + aleat(1.4, 2.8); }
      const vir = flip.t < 1;
      (folha.material as THREE.MeshBasicMaterial).opacity = vir ? op : 0;
      if (vir) { folha.position.set(0, 0, 0.003); folha.rotation.set(0, 0.33 - sstep(flip.t) * 0.66, 0); }
      if (Math.random() < dt * 7) { livro.localToWorld(aux.set(aleat(-0.1, 0.1), aleat(-0.05, 0.05), 0.02)); soltarPacote(aux, cabeca, aleat(0.6, 0.9), 0.14); }
      livro.localToWorld(aux.set(0.17, -0.13, 0.04)); maos.esq.copy(aux);
      livro.localToWorld(aux2.set(-0.17, -0.13, 0.04)); maos.dir.copy(aux2);
    }

    // FEITIÇO: o sigilo rúnico girando entre as palmas, carrega e ESTOURA num pulso
    feitico.visible = w.feitico > 0.005;
    if (feitico.visible) {
      const u = s?.seq === "feitico" ? s.u : 1;
      aux.copy(peito).addScaledVector(camDir, -0.34).addScaledVector(camCima, -0.1);
      feitico.position.copy(aux); feitico.quaternion.copy(cam.quaternion); feitico.updateMatrixWorld(true);
      const carga = sstep(Math.min(1, u * 1.6)), brilho = 0.85 + 0.15 * Math.sin(agora * 10);
      sigilos[0]!.rotation.z = agora * 0.6; sigilos[1]!.rotation.z = -agora * 0.9;
      sigilos[0]!.scale.setScalar(0.3 * (0.4 + 0.6 * carga)); sigilos[1]!.scale.setScalar(0.19 * (0.4 + 0.6 * carga));
      for (const m of sigilos) (m.material as THREE.MeshBasicMaterial).opacity = w.feitico * brilho;
      (nucleoFeitico.material as THREE.SpriteMaterial).opacity = w.feitico * carga; nucleoFeitico.scale.setScalar(0.05 + 0.06 * carga * brilho);
      const burst = sstep((u - 0.76) / 0.24);
      for (let i = 0; i < NEST; i++) { aux2.copy(feitico.position).addScaledVector(estDir[i]!, burst * 0.5); estPos.set([aux2.x, aux2.y, aux2.z], i * 3); }
      estGeo.attributes.position!.needsUpdate = true; estMat.opacity = w.feitico * burst * (1 - burst) * 4;
      feitico.localToWorld(aux.set(0.17, -0.06, 0.08)); maos.esq.copy(aux);
      feitico.localToWorld(aux2.set(-0.17, -0.06, 0.08)); maos.dir.copy(aux2);
    }

    // TELECINESE: cristais orbitando/levitando entre as mãos erguidas
    telecinese.visible = w.telecinese > 0.005;
    if (telecinese.visible) {
      aux.copy(peito).addScaledVector(camDir, -0.3).addScaledVector(camCima, -0.02);
      telecinese.position.copy(aux);
      for (const c of cristais) {
        c.a += dt * c.vel;
        c.sp.position.set(Math.cos(c.a) * c.r, c.y + Math.sin(agora * 1.2 + c.fase) * 0.03, Math.sin(c.a) * c.r * 0.5);
        (c.sp.material as THREE.SpriteMaterial).opacity = w.telecinese * (0.65 + 0.35 * Math.sin(agora * 5 + c.fase));
      }
      nucleoTele.position.set(0, 0, 0); (nucleoTele.material as THREE.SpriteMaterial).opacity = w.telecinese * (0.6 + 0.4 * Math.sin(agora * 3));
      maos.esq.copy(telecinese.position).addScaledVector(camDireita, 0.17).addScaledVector(camCima, -0.13);
      maos.dir.copy(telecinese.position).addScaledVector(camDireita, -0.17).addScaledVector(camCima, -0.13);
    }

    // PORTAL: a fenda (anel + vórtice) abre à frente, partículas espiralando pra dentro; as mãos a enquadram
    portal.visible = w.portal > 0.005;
    if (portal.visible) {
      const u = s?.seq === "portal" ? s.u : 1;
      aux.copy(peito).addScaledVector(camDir, -0.42).addScaledVector(camCima, 0.02);
      portal.position.copy(aux); portal.quaternion.copy(cam.quaternion); portal.updateMatrixWorld(true);
      const abre = sstep(Math.min(1, u * 1.5));
      vortex.rotation.z = agora * 0.9; vortex.scale.setScalar(0.3 * abre);
      anelPortal.rotation.z = -agora * 0.3; anelPortal.scale.setScalar(0.42 * abre);
      (vortex.material as THREE.MeshBasicMaterial).opacity = w.portal * 0.9;
      (anelPortal.material as THREE.MeshBasicMaterial).opacity = w.portal * (0.8 + 0.2 * Math.sin(agora * 6));
      for (let i = 0; i < NPV; i++) { const p = pvBase[i]!, tt = (agora * 0.5 + p.fase) % 1, rr = p.r * (1 - sstep(tt)) * abre, an = p.a + tt * 7; pvPos.set([Math.cos(an) * rr, Math.sin(an) * rr, tt * 0.1], i * 3); }
      pvGeo.attributes.position!.needsUpdate = true; pvMat.opacity = w.portal * abre;
      portal.localToWorld(aux.set(0.22, -0.02, 0.04)); maos.esq.copy(aux);
      portal.localToWorld(aux2.set(-0.22, -0.02, 0.04)); maos.dir.copy(aux2);
    }

    // CONSTELAÇÃO: as estrelas surgem em sequência e se ligam; o dedo (mão direita) traça, o rosto ergue
    constel.visible = w.constelacao > 0.005;
    if (constel.visible) {
      const u = s?.seq === "constelacao" ? s.u : 1;
      aux.copy(peito).addScaledVector(camDir, -0.34).addScaledVector(camCima, 0.13);
      constel.position.copy(aux); constel.quaternion.copy(cam.quaternion); constel.updateMatrixWorld(true);
      const prog = u * ESTRELAS.length;
      for (let i = 0; i < ESTRELAS.length; i++) { const e = ESTRELAS[i]!; cnPos.set(prog > i ? [e[0], e[1], 0] : [0, -99, 0], i * 3); }
      cnGeo.attributes.position!.needsUpdate = true; cnMat.opacity = w.constelacao * (0.8 + 0.2 * Math.sin(agora * 4));
      for (let i = 0; i < ESTRELAS.length - 1; i++) { const a = ESTRELAS[i]!, b = ESTRELAS[i + 1]!; cnLinPos.set(prog > i + 1 ? [a[0], a[1], 0, b[0], b[1], 0] : [0, -99, 0, 0, -99, 0], i * 6); }
      cnLinGeo.attributes.position!.needsUpdate = true; cnLinMat.opacity = w.constelacao * 0.7;
      const idx = Math.min(ESTRELAS.length - 1, Math.floor(prog)), e = ESTRELAS[idx]!;
      ponta.position.set(e[0], e[1], 0.02); (ponta.material as THREE.SpriteMaterial).opacity = w.constelacao;
      constel.localToWorld(aux.set(e[0], e[1], 0.05)); maos.dir.copy(aux);
      maos.esq.copy(peito).addScaledVector(camDireita, 0.14).addScaledVector(camCima, -0.28);
    }
    return res;
  };

  return {
    atualizar, zerar,
    qualidade: (q) => {
      telas.forEach((t, i) => {
        const fora = (q >= 1 && (t.camada === "longe" || t.camada === "perto")) || (q >= 2 && t.camada === "arco" && i % 2 === 0);
        t.mesh.visible = !fora; if (t.halo) t.halo.visible = q < 1 && !fora;
      });
      feixeMat.visible = q < 2;
    },
    estado: () => ({ ...w, comendo: ali.tela, fome: ali.fome, seq: ultimaSeq, visivel: raiz.visible, rede: rede.visible, telas: telas.length, aranha: ar.pos.toArray().map((x) => +x.toFixed(2)) }),
    dispose: () => { cena.remove(raiz); for (const d of descartaveis) d.dispose(); },
  };
}
