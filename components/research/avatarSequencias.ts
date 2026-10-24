/**
 * As 3 SEQUÊNCIAS da avatar enquanto a resposta é gerada (o roteiro: lib/research/sequenciaAvatar) — a parte visual,
 * dentro da cena do worker (components/research/avatarCena). O dono: "os olhos brilham enquanto ela pensa, depois ela
 * flutuando e buscando coisas na internet — um conjunto de hologramas em quadrado, bem sci-fi e cyberpunk, de uma IA
 * que controla as coisas na net"; depois: "uma câmera que se afaste mais, mais telas e mais efeitos visíveis nelas; ela
 * sobe e fica digitando num teclado virtual enquanto olha as telas; bem cyberpunk e detalhado, com efeitos como blur,
 * ainda leve" e "a cena fica melhor se ela estiver LEVITANDO, não só em pé".
 *  - OLHOS: dois brilhos nos ossos dos olhos (por cima do cabelo), pulsando;
 *  - REDE (a busca): ela levita (pose de flutuação: o corpo é da cena, aqui só os números) e DIGITA num TECLADO
 *    holográfico, olhando as telas; a câmera se afasta e orbita devagar. As telas, em CAMADAS de profundidade:
 *    · a TELA PRINCIPAL atrás dela — a página que a ARANHA (procedural, à moda do cyohei9907/web-crawlers — código
 *      nosso) raspa: cada pata que pousa abre um anel de glitch na página e às vezes solta um PACOTE até a cabeça dela;
 *    · um ARCO de telas em volta dela (código, gráficos, matriz, radar, ondas…), cada uma um shader: o conteúdo rola,
 *      uma faixa de varredura passa, piscam, dão glitch com aberração cromática; halos atrás (o "bloom" barato);
 *    · telas LONGE desfocadas e telas PERTO da câmera fora de foco (o blur é pré-calculado na textura: custo zero);
 *    · CHUVA de dados, FEIXES do teclado às telas, ANÉIS girando sob ela;
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
  /** 0..1: a pose de levitação (a cena dobra as pernas e sobe o corpo) */
  levitar: number;
  /** 0..1: a câmera se afasta; `orbita` = o ângulo (rad) que ela gira em volta */
  abrir: number; orbita: number;
  /** 0..1: digitando no teclado holográfico; as mãos vão até `maos` (mundo) */
  digitar: number; maos: { esq: THREE.Vector3; dir: THREE.Vector3 };
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

  // a CHUVA de dados (riscos caindo num cilindro em volta dela)
  const NCHUVA = 140, chuvaPos = new Float32Array(NCHUVA * 6), chuvaCor = new Float32Array(NCHUVA * 6), chuva = Array.from({ length: NCHUVA }, () => ({ x: 0, y: 0, z: 0, v: 0, l: 0 }));
  const novaGota = (g: (typeof chuva)[number], topo = false) => { const a = aleat(0, Math.PI * 2), r = aleat(0.35, 1.5); g.x = Math.sin(a) * r; g.z = -Math.abs(Math.cos(a)) * r * aleat(0.4, 1); g.y = topo ? aleat(0.6, 0.9) : aleat(-0.7, 0.9); g.v = aleat(0.25, 0.8); g.l = aleat(0.03, 0.14); };
  chuva.forEach((g, i) => { novaGota(g); const c = Math.random() < 0.7 ? CIANO : MAGENTA; for (let k = 0; k < 2; k++) c.toArray(chuvaCor, i * 6 + k * 3); });
  const chuvaGeo = guarda(new THREE.BufferGeometry()); chuvaGeo.setAttribute("position", new THREE.BufferAttribute(chuvaPos, 3)); chuvaGeo.setAttribute("color", new THREE.BufferAttribute(chuvaCor, 3));
  const chuvaMat = guarda(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const chuvaLinhas = new THREE.LineSegments(chuvaGeo, chuvaMat); chuvaLinhas.frustumCulled = false; rede.add(chuvaLinhas);

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
  const TECLADO = { w: 0.36, h: 0.13 };
  const toquesTecla = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(CIANO)); s.scale.setScalar(0.06); teclado.add(s); return { s, vida: 0 }; });
  const maos = { esq: new THREE.Vector3(), dir: new THREE.Vector3() };
  const dedos = [{ alvo: new THREE.Vector2(0.24, 0.5), prox: 0, aperta: 0 }, { alvo: new THREE.Vector2(0.76, 0.5), prox: 0, aperta: 0 }];
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

  // ── o estado (zerado a cada troca de avatar) ──
  const w = { olhos: 0, rede: 0, arvore: 0, cerebro: 0, levitar: 0, abrir: 0, digitar: 0 };
  let ultimaSeq: Sequencia | null = null, ultimoCiclo = -1, proxSinapse = 0, inicioRede = 0;
  const peito = new THREE.Vector3(), quadrilV = new THREE.Vector3(), pOlho = new THREE.Vector3(), paraCam = new THREE.Vector3(), camDir = new THREE.Vector3(), camDireita = new THREE.Vector3(), camCima = new THREE.Vector3();
  const zerar = () => {
    for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] = 0;
    ultimaSeq = null; ultimoCiclo = -1; ar.iniciada = false;
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
    if (nova && s?.seq === "buscar") inicioRede = agora;
    // os pesos de cada parte (os olhos ficam acesos a geração toda, mais fortes pensando; ela levita depois do pensar)
    w.olhos = chegar(w.olhos, s ? (s.seq === "pensar" ? 1 : 0.55) : 0, dt, 5);
    w.rede = chegar(w.rede, s?.seq === "buscar" ? env : 0, dt, 4);
    w.arvore = chegar(w.arvore, s?.seq === "arvore" ? env : 0, dt, 4);
    w.cerebro = chegar(w.cerebro, s?.seq === "cerebro" ? env : 0, dt, 4);
    w.levitar = chegar(w.levitar, s && s.seq !== "pensar" ? 1 : 0, dt, 1.8);
    w.abrir = chegar(w.abrir, s?.seq === "buscar" ? 1 : s && s.seq !== "pensar" ? 0.45 : 0, dt, 1.3);
    w.digitar = chegar(w.digitar, s?.seq === "buscar" && s.u > 0.08 && s.u < 0.94 ? 1 : 0, dt, 4);
    const orbita = Math.sin((agora - inicioRede) * 0.32) * 0.38 * w.abrir;
    const olhar = Math.sin(agora * 0.55) * 0.32 + Math.sin(agora * 1.7) * 0.06;
    const algo = w.olhos + w.rede + w.arvore + w.cerebro + w.levitar > 0.005;
    raiz.visible = algo;
    const res: ResultadoSeq = { levitar: w.levitar, abrir: w.abrir, orbita, digitar: w.digitar, maos, olhar, seq: s?.seq ?? null, nova };
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
      m.position.set(0, quadrilV.y - 0.95 - i * 0.05, 0.02);   // (bem abaixo dos pés: o vão mostra que ela flutua) m.rotation.z = agora * (i ? -0.5 : 0.32);
      (m.material as THREE.MeshBasicMaterial).opacity = w.levitar * (i ? 0.5 : 0.75) * (0.85 + 0.15 * Math.sin(agora * 3 + i));
    });

    // REDE: as telas, a chuva, o teclado, os feixes e a aranha
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
        t.u.opac!.value = e * (t.camada === "longe" ? 0.45 : t.camada === "perto" ? 0.32 : 0.92);
        for (const v of t.u.toques!.value as THREE.Vector4[]) v.z = Math.max(0, v.z - dt * 1.6);
        if (t.camada === "perto") {
          const o = pertoOff[telas.indexOf(t) - (telas.length - pertoOff.length)]!;
          t.mesh.position.copy(cam.position).addScaledVector(camDir, o[2]).addScaledVector(camDireita, o[0]).addScaledVector(camCima, o[1]).sub(rede.position);
          t.mesh.quaternion.copy(cam.quaternion);
        } else {
          t.mesh.position.set(t.base.x, t.base.y + Math.sin(agora * 0.9 + t.atraso * 30) * 0.008, t.base.z);
          if (t.olhar) t.mesh.lookAt(aux.set(0, peito.y + 0.02, 0));
        }
        t.mesh.scale.set(t.w * (0.2 + 0.8 * e), t.h * e, 1);
        if (t.halo) { t.halo.position.copy(t.mesh.position).addScaledVector(aux2.copy(t.mesh.position).setY(0).normalize(), 0.02); (t.halo.material as THREE.SpriteMaterial).opacity = e * 0.28; }
      }
      // a CHUVA de dados
      chuva.forEach((g, i) => {
        g.y -= g.v * dt; if (g.y < -0.75) novaGota(g, true);
        chuvaPos.set([g.x, g.y, g.z, g.x, g.y + g.l, g.z], i * 6);
      });
      chuvaGeo.attributes.position!.needsUpdate = true; chuvaMat.opacity = 0.75 * w.rede;

      // a ARANHA anda pela página
      if (!ar.iniciada) { ar.pos.set(aleat(-0.3, 0.3), -0.2, PAREDE_Z); aranha.scale.setScalar(ESCALA); ar.alvo.copy(ar.pos); ar.iniciada = true; for (const p of pernas) { ideal(p, p.pe); p.passo = 1; } }
      ar.pausa -= dt;
      if (ar.pos.distanceTo(ar.alvo) < 0.02 && ar.pausa <= 0) { ar.alvo.set((Math.random() < 0.5 ? -1 : 1) * aleat(0.15, 0.42), aleat(-0.24, 0.32), ar.pos.z); ar.pausa = aleat(0.1, 0.45); }
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
            if (Math.random() < 0.3) soltarPacote(aux.copy(p.pe).add(rede.position), cabeca, 0.75, 0.25);
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
      const vis = sstep((w.rede - 0.3) / 0.5);
      pernasMat.opacity = vis; juntasMat.opacity = vis; corpoMat.opacity = vis * 0.95;
      (brilhoAranha.material as THREE.SpriteMaterial).opacity = vis * (0.6 + 0.4 * Math.sin(agora * 7));
      for (const o of olhosAranha) (o.material as THREE.SpriteMaterial).opacity = vis;
    }

    // o TECLADO: à frente da cintura dela, inclinado; os dedos "batem" em teclas (as mãos vão até `maos`)
    if (teclado.visible) {
      teclado.position.set(0, peito.y - 0.2, peito.z + 0.3);
      teclado.rotation.set(-0.62, 0, 0);
      tecladoMat.opacity = Math.min(1, Math.max(w.digitar, w.rede) * 1.2) * (0.85 + 0.15 * Math.sin(agora * 11));
      teclado.updateMatrixWorld(true);
      dedos.forEach((d, i) => {
        if (agora > d.prox) {   // a próxima tecla (cada mão no seu lado do teclado)
          d.alvo.set(i ? aleat(0.55, 0.92) : aleat(0.08, 0.45), aleat(0.2, 0.85)); d.prox = agora + aleat(0.09, 0.2); d.aperta = 1;
          const t = toquesTecla[i]!; t.vida = 1; t.s.position.set((d.alvo.x - 0.5) * TECLADO.w, (d.alvo.y - 0.5) * TECLADO.h, 0.005);
          if (Math.random() < 0.18 && w.rede > 0.5) { const alvo = telas[feixeAlvo[Math.floor(Math.random() * NFEIXE)]!]!; teclado.localToWorld(aux.copy(t.s.position)); soltarPacote(aux, aux2.copy(alvo.mesh.position).add(rede.position), 0.5, 0.05); }
        }
        d.aperta = Math.max(0, d.aperta - dt * 9);
        // a mão: 4 cm acima da tecla (o punho), descendo no toque
        teclado.localToWorld(aux.set((d.alvo.x - 0.5) * TECLADO.w, (d.alvo.y - 0.5) * TECLADO.h - 0.03, 0.045 - d.aperta * 0.025));
        (i ? maos.esq : maos.dir).copy(aux);
        const t = toquesTecla[i]!; t.vida = Math.max(0, t.vida - dt * 5);
        (t.s.material as THREE.SpriteMaterial).opacity = t.vida * w.digitar; t.s.scale.setScalar(0.03 + 0.04 * t.vida);
      });
      // os FEIXES do teclado às telas
      teclado.localToWorld(aux.set(0, 0, 0));
      for (let i = 0; i < NFEIXE; i++) {
        if (Math.random() < dt * 2) feixeAlvo[i] = 1 + Math.floor(Math.random() * 16);
        const alvo = telas[feixeAlvo[i]!]!; aux2.copy(alvo.mesh.position).add(rede.position);
        feixePos.set([aux.x, aux.y, aux.z, aux2.x, aux2.y, aux2.z], i * 6);
      }
      feixeGeo.attributes.position!.needsUpdate = true; feixeMat.opacity = w.rede * 0.28 * (0.6 + 0.4 * Math.random());
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
    return res;
  };

  return {
    atualizar, zerar,
    estado: () => ({ ...w, seq: ultimaSeq, visivel: raiz.visible, rede: rede.visible, telas: telas.length, aranha: ar.pos.toArray().map((x) => +x.toFixed(2)) }),
    dispose: () => { cena.remove(raiz); for (const d of descartaveis) d.dispose(); },
  };
}
