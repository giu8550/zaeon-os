/**
 * As 3 SEQUÊNCIAS da avatar enquanto a resposta é gerada (o roteiro: lib/research/sequenciaAvatar) — a parte visual,
 * dentro da cena do worker (components/research/avatarCena). O dono: "os olhos brilham enquanto ela pensa, depois ela
 * flutuando e buscando coisas na internet (a internet: um conjunto de hologramas em quadrado — uma cena bem sci-fi e
 * cyberpunk de uma IA que controla as coisas na net); se o assunto pede, uma árvore de habilidades ou um cérebro".
 *  - OLHOS: dois brilhos nos ossos dos olhos (por cima do cabelo), pulsando;
 *  - REDE: uma parede de hologramas quadrados atrás dela (páginas abstratas, ciano/magenta, varredura) + uns na frente;
 *    a ARANHA (procedural, à moda do cyohei9907/web-crawlers — código nosso) rasteja por eles: 8 patas com joelho por
 *    IK no plano, passo alternado; cada pata que pousa num painel dá GLITCH nele e solta um PACOTE de dados que voa até
 *    a cabeça dela;
 *  - ÁRVORE: uma árvore de habilidades holográfica cresce à frente do peito, nó por nó;
 *  - CÉREBRO: partículas que se juntam num cérebro girando, com sinapses piscando.
 */
import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { envelope, sequenciaEm, type Sequencia } from "@/lib/research/sequenciaAvatar";
import { ctx2d, novoCanvas } from "@/lib/cyber/canvas2d";

const CIANO = new THREE.Color("#5ff2ff"), MAGENTA = new THREE.Color("#ff3df2"), VERDE = new THREE.Color("#7dffb2"), OURO = new THREE.Color("#ffd36b");
const aleat = (a: number, b: number) => a + Math.random() * (b - a);
const sstep = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

/** uma "página da web" abstrata (sem texto legível): cabeçalho, blocos, linhas, varredura e moldura */
function paginaHolo(variante: number): THREE.CanvasTexture {
  const c = novoCanvas(192, 136), g = ctx2d(c), cor = variante % 2 ? "255,61,242" : "95,242,255";
  g.fillStyle = "rgba(4,10,26,.82)"; g.fillRect(0, 0, 192, 136);
  g.fillStyle = `rgba(${cor},.85)`; g.fillRect(0, 0, 192, 14);
  g.fillStyle = "rgba(4,10,26,.9)"; for (let i = 0; i < 3; i++) g.fillRect(6 + i * 9, 4, 5, 5);
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(${cor},${0.25 + (i % 3) * 0.18})`; g.fillRect(10, 24 + i * 14, 40 + ((i * 37 + variante * 23) % 90), 5); }
  g.fillStyle = `rgba(${cor},.35)`; g.fillRect(132, 24, 50, 40 + (variante % 3) * 12);
  g.strokeStyle = `rgba(${cor},.9)`; g.lineWidth = 1.5; g.strokeRect(132, 24, 50, 40 + (variante % 3) * 12);
  g.fillStyle = "rgba(200,250,255,.07)"; for (let y = 0; y < 136; y += 3) g.fillRect(0, y, 192, 1);
  g.strokeStyle = `rgba(${cor},1)`; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 189, 133);
  const t = new THREE.CanvasTexture(c as HTMLCanvasElement); t.colorSpace = THREE.SRGBColorSpace; return t;
}

type Painel = { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: THREE.Vector3; w: number; h: number; atraso: number; glitch: number; frente: boolean };
type Perna = { lado: number; k: number; pe: THREE.Vector3; de: THREE.Vector3; para: THREE.Vector3; passo: number };

export type Sequencias = {
  /** a cada quadro: `gerandoHa` = s desde que a resposta começou (null = não está gerando) */
  atualizar: (o: { agora: number; dt: number; gerandoHa: number | null; vrm: VRM | null; cam: THREE.Camera }) => { levitar: number; abrir: number; seq: Sequencia | null; nova: boolean };
  zerar: () => void;
  /** (dev) os pesos e a sequência agora */
  estado: () => Record<string, unknown>;
  dispose: () => void;
};

export function criarSequencias(cena: THREE.Scene, estrela: THREE.Texture): Sequencias {
  const descartaveis: { dispose: () => void }[] = [];
  const guarda = <T extends { dispose: () => void }>(x: T) => { descartaveis.push(x); return x; };
  const raiz = new THREE.Group(); cena.add(raiz);
  /** `porCima` = desenha por cima de tudo (os OLHOS, que o cabelo tampa); o resto respeita a profundidade (a aranha atrás dela) */
  const brilhoMat = (cor: THREE.Color, porCima = false) => guarda(new THREE.SpriteMaterial({ map: estrela, color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !porCima }));

  // ── OLHOS ──
  const olhos = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(CIANO, true)); s.scale.setScalar(0.05); s.renderOrder = 10; raiz.add(s); return s; });
  const nucleos = [0, 1].map(() => { const s = new THREE.Sprite(brilhoMat(new THREE.Color("#ffffff"), true)); s.scale.setScalar(0.016); s.renderOrder = 11; raiz.add(s); return s; });

  // ── REDE: a parede de hologramas ──
  const rede = new THREE.Group(); raiz.add(rede);
  const texturas = [0, 1, 2, 3].map((v) => guarda(paginaHolo(v)));
  const geoPainel = guarda(new THREE.PlaneGeometry(1, 1));
  const paineis: Painel[] = [];
  const PAREDE_Z = -0.38;
  const addPainel = (x: number, y: number, z: number, w: number, h: number, frente: boolean) => {
    const mat = guarda(new THREE.MeshBasicMaterial({ map: texturas[paineis.length % 4]!.clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, ...(frente ? { blending: THREE.AdditiveBlending } : {}) }));
    guarda(mat.map!);
    const mesh = new THREE.Mesh(geoPainel, mat); mesh.scale.set(w, h, 1); mesh.renderOrder = frente ? 6 : 0; rede.add(mesh);
    paineis.push({ mesh, mat, base: new THREE.Vector3(x, y, z), w, h, atraso: paineis.length * 0.045, glitch: 0, frente });
  };
  const COLS = [-0.4, -0.22, 0, 0.22, 0.4];   // a parede é mais larga que ela: os painéis aparecem dos dois lados
  for (let r = 0; r < 5; r++) for (const x of COLS) addPainel(x + aleat(-0.015, 0.015), -0.32 + r * 0.15 + aleat(-0.015, 0.015), PAREDE_Z + aleat(-0.03, 0.03), 0.16, 0.11, false);
  const NFUNDO = paineis.length;
  addPainel(-0.2, 0.05, 0.22, 0.1, 0.07, true); addPainel(0.21, -0.12, 0.2, 0.09, 0.065, true); addPainel(0.18, 0.2, 0.16, 0.08, 0.06, true);
  // as LINHAS da rede (os fios entre os painéis do fundo), acendendo junto
  const fiosPos: number[] = [];
  for (let i = 0; i < NFUNDO; i++) { const a = paineis[i]!, b = paineis[(i + COLS.length) % NFUNDO]!; fiosPos.push(a.base.x, a.base.y, a.base.z, b.base.x, b.base.y, b.base.z); }
  const fiosGeo = guarda(new THREE.BufferGeometry()); fiosGeo.setAttribute("position", new THREE.Float32BufferAttribute(fiosPos, 3));
  const fiosMat = guarda(new THREE.LineBasicMaterial({ color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  rede.add(new THREE.LineSegments(fiosGeo, fiosMat));

  // ── a ARANHA ──
  const aranha = new THREE.Group(); rede.add(aranha);
  const ESCALA = 2.3;   // (a aranha e as patas, no tamanho em que se lê no painel)
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
  // as JUNTAS acesas (joelhos e pés): a linha do WebGL tem 1 px — os pontos de luz fazem a aranha ler de longe
  const juntasGeo = guarda(new THREE.BufferGeometry()); juntasGeo.setAttribute("position", pernasGeo.attributes.position!);
  const juntasMat = guarda(new THREE.PointsMaterial({ size: 0.014, map: estrela, color: CIANO, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  const juntas = new THREE.Points(juntasGeo, juntasMat); juntas.frustumCulled = false; rede.add(juntas);
  const ar = { pos: new THREE.Vector3(0, 0, PAREDE_Z + 0.03), vel: new THREE.Vector3(), alvo: new THREE.Vector3(), rumo: 0, pausa: 0, iniciada: false, grupo: 0 };
  /** onde o pé de cada perna "quer" estar (no referencial da parede) */
  const ideal = (p: Perna, out: THREE.Vector3) => {
    const frente = [0.05, 0.022, -0.012, -0.046][p.k]! * ESCALA, lat = (0.05 + (p.k === 1 || p.k === 2 ? 0.008 : 0)) * ESCALA;
    const c = Math.cos(ar.rumo), s = Math.sin(ar.rumo);   // rumo: 0 = subindo (+y)
    const lx = p.lado * lat, ly = frente;
    return out.set(ar.pos.x + lx * c - ly * s, ar.pos.y + lx * s + ly * c, ar.pos.z);
  };
  const quadril = (p: Perna, out: THREE.Vector3) => {
    const c = Math.cos(ar.rumo), s = Math.sin(ar.rumo), lx = p.lado * 0.01 * ESCALA, ly = (0.01 - p.k * 0.007) * ESCALA;
    return out.set(ar.pos.x + lx * c - ly * s, ar.pos.y + lx * s + ly * c, ar.pos.z);
  };
  const aux = new THREE.Vector3(), aux2 = new THREE.Vector3(), joelho = new THREE.Vector3();

  // ── PACOTES de dados (dos painéis pra cabeça dela) ──
  const NPAC = 24, pacPos = new Float32Array(NPAC * 3), pacGeo = guarda(new THREE.BufferGeometry());
  pacGeo.setAttribute("position", new THREE.BufferAttribute(pacPos, 3));
  const pacMat = guarda(new THREE.PointsMaterial({ size: 0.022, map: estrela, color: MAGENTA, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  const pacotes = new THREE.Points(pacGeo, pacMat); pacotes.frustumCulled = false; raiz.add(pacotes);
  const pac = Array.from({ length: NPAC }, () => ({ vivo: false, t: 0, de: new THREE.Vector3(), mundo: true }));
  const cabeca = new THREE.Vector3(0, 1.45, 0);

  // o CAMPO de projeção (um disco escuro e translúcido com o anel aceso) atrás da árvore e do cérebro: sem ele, a luz
  // somada some em cima da roupa clara
  const campoTex = (() => {
    const c = novoCanvas(256, 256), g = ctx2d(c), gr = g.createRadialGradient(128, 128, 10, 128, 128, 126);
    gr.addColorStop(0, "rgba(2,8,26,.92)"); gr.addColorStop(0.72, "rgba(4,14,38,.82)"); gr.addColorStop(0.9, "rgba(20,120,170,.55)"); gr.addColorStop(0.94, "rgba(95,242,255,.95)"); gr.addColorStop(1, "rgba(95,242,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(95,242,255,.25)"; g.lineWidth = 1; for (let r = 30; r < 110; r += 22) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    const t = new THREE.CanvasTexture(c as HTMLCanvasElement); t.colorSpace = THREE.SRGBColorSpace; return guarda(t);
  })();
  const geoCampo = guarda(new THREE.PlaneGeometry(1, 1));
  const novoCampo = () => { const m = guarda(new THREE.MeshBasicMaterial({ map: campoTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); const me = new THREE.Mesh(geoCampo, m); me.renderOrder = 4; return me; };

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
  const w = { olhos: 0, rede: 0, arvore: 0, cerebro: 0, levitar: 0, abrir: 0 };
  let ultimaSeq: Sequencia | null = null, ultimoCiclo = -1, proxSinapse = 0;
  const peito = new THREE.Vector3(), pOlho = new THREE.Vector3(), paraCam = new THREE.Vector3();
  const zerar = () => {
    for (const k of Object.keys(w) as (keyof typeof w)[]) w[k] = 0;
    ultimaSeq = null; ultimoCiclo = -1; ar.iniciada = false;
    for (const p of pac) p.vivo = false;
    for (const p of paineis) p.glitch = 0;
    raiz.visible = false;
  };
  zerar();

  const chegar = (atual: number, alvo: number, dt: number, vel = 3.5) => atual + (alvo - atual) * (1 - Math.exp(-dt * vel));

  const atualizar: Sequencias["atualizar"] = ({ agora, dt, gerandoHa, vrm, cam }) => {
    const s = gerandoHa === null ? null : sequenciaEm(gerandoHa);
    const env = s ? envelope(s.u, s.seq === "pensar" ? 0.25 : 0.1, 0.1) : 0;
    const nova = !!s && (s.seq !== ultimaSeq || s.ciclo !== ultimoCiclo);
    if (s) { ultimaSeq = s.seq; ultimoCiclo = s.ciclo; } else { ultimaSeq = null; ultimoCiclo = -1; }
    // os pesos de cada parte (os olhos ficam acesos a geração toda, mais fortes pensando)
    w.olhos = chegar(w.olhos, s ? (s.seq === "pensar" ? 1 : 0.55) : 0, dt, 5);
    w.rede = chegar(w.rede, s?.seq === "buscar" ? env : 0, dt, 4);
    w.arvore = chegar(w.arvore, s?.seq === "arvore" ? env : 0, dt, 4);
    w.cerebro = chegar(w.cerebro, s?.seq === "cerebro" ? env : 0, dt, 4);
    w.levitar = chegar(w.levitar, s && s.seq !== "pensar" ? 1 : 0, dt, 2);
    w.abrir = chegar(w.abrir, s?.seq === "buscar" ? 1 : s && s.seq !== "pensar" ? 0.5 : 0, dt, 1.6);
    const algo = w.olhos + w.rede + w.arvore + w.cerebro > 0.005;
    raiz.visible = algo;
    if (!algo || !vrm) return { levitar: w.levitar, abrir: w.abrir, seq: s?.seq ?? null, nova };

    const h = vrm.humanoid;
    (h.getRawBoneNode("upperChest") ?? h.getRawBoneNode("chest"))?.getWorldPosition(peito);
    h.getRawBoneNode("head")?.getWorldPosition(cabeca);

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

    // REDE + ARANHA
    rede.visible = w.rede > 0.005;
    if (rede.visible) {
      rede.position.set(0, peito.y, 0);
      for (const p of paineis) {
        const e = sstep((w.rede - p.atraso * 0.6) / 0.4);
        p.glitch = Math.max(0, p.glitch - dt);
        const g = p.glitch > 0, flick = g ? (Math.random() < 0.5 ? 0.4 : 1) : 1;
        p.mesh.position.set(p.base.x + (g ? aleat(-0.008, 0.008) : 0), p.base.y + Math.sin(agora * 1.1 + p.atraso * 20) * 0.006, p.base.z);
        p.mesh.scale.set(p.w * (0.3 + 0.7 * e), p.h * e * (g ? aleat(0.85, 1.1) : 1), 1);
        p.mat.opacity = e * (p.frente ? 0.55 : 0.9) * flick;
        p.mat.color.copy(g ? MAGENTA : WHITE);
        if (p.mat.map) p.mat.map.offset.x = g ? aleat(-0.04, 0.04) : 0;
        if (p.frente) p.mesh.lookAt(cam.position);
      }
      fiosMat.opacity = 0.35 * w.rede;
      // a aranha anda pela parede (do lado de cá dos painéis)
      if (!ar.iniciada) { ar.pos.set(Math.random() < 0.5 ? -0.33 : 0.33, -0.28, PAREDE_Z + 0.035); aranha.scale.setScalar(ESCALA); ar.alvo.copy(ar.pos); ar.iniciada = true; for (const p of pernas) { ideal(p, p.pe); p.passo = 1; } }
      ar.pausa -= dt;
      if (ar.pos.distanceTo(ar.alvo) < 0.02 && ar.pausa <= 0) { ar.alvo.set((Math.random() < 0.5 ? -1 : 1) * aleat(0.2, 0.42), aleat(-0.3, 0.33), ar.pos.z); /* (mais pelas laterais, onde ela não tampa) */ ar.pausa = aleat(0.15, 0.6); }
      if (ar.pausa <= 0) {
        aux.copy(ar.alvo).sub(ar.pos); const d = aux.length();
        if (d > 1e-4) {
          const rumoAlvo = Math.atan2(-aux.x, aux.y); let dr = rumoAlvo - ar.rumo; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
          ar.rumo += dr * Math.min(1, dt * 6);
          ar.pos.addScaledVector(aux.normalize(), Math.min(d, dt * 0.2));
        }
      }
      aranha.position.copy(ar.pos); aranha.rotation.set(0, 0, ar.rumo);
      // as PATAS: grupos alternados (0,2 de um lado com 1,3 do outro); passo com arco pra fora da parede
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
          if (p.passo >= 1) {   // POUSOU: o painel embaixo dá glitch e às vezes solta um pacote
            p.pe.z = ar.pos.z;
            for (const pn of paineis) {
              if (pn.frente) continue;
              if (Math.abs(p.pe.x - pn.base.x) < pn.w / 2 && Math.abs(p.pe.y - pn.base.y) < pn.h / 2) {
                pn.glitch = 0.22;
                if (Math.random() < 0.3) { const q = pac.find((x) => !x.vivo); if (q) { q.vivo = true; q.t = 0; q.de.copy(p.pe).add(rede.position); } }
                break;
              }
            }
          }
        }
      }
      if (pernas.every((p) => p.passo >= 1 || (p.k + (p.lado > 0 ? 1 : 0)) % 2 !== ar.grupo)) ar.grupo = 1 - ar.grupo;
      // joelhos (IK no plano da parede, o joelho pra fora e saltado pra frente)
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

    // PACOTES: do painel até a cabeça dela, em arco
    pacotes.visible = pac.some((p) => p.vivo);
    if (pacotes.visible) {
      pac.forEach((p, i) => {
        if (!p.vivo) { pacPos.set([0, -99, 0], i * 3); return; }
        p.t += dt / 0.7; if (p.t >= 1) { p.vivo = false; pacPos.set([0, -99, 0], i * 3); return; }
        const u = sstep(p.t);
        aux.lerpVectors(p.de, cabeca, u); aux.z += Math.sin(u * Math.PI) * 0.25; aux.y += Math.sin(u * Math.PI) * 0.06;
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
    return { levitar: w.levitar, abrir: w.abrir, seq: s?.seq ?? null, nova };
  };

  return {
    atualizar, zerar,
    estado: () => ({ ...w, seq: ultimaSeq, visivel: raiz.visible, rede: rede.visible, aranha: ar.pos.toArray().map((x) => +x.toFixed(2)), painel0: paineis[0]!.mat.opacity.toFixed(2) }),
    dispose: () => { cena.remove(raiz); for (const d of descartaveis) d.dispose(); },
  };
}

const WHITE = new THREE.Color(1, 1, 1);
