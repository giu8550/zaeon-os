/**
 * Relicario — o RELICÁRIO DO SABER (lib/cyber/relicario) na Sala do Saber: uma CABINE de metal negro (base octogonal
 * em dois degraus, 6 pilares com o filete de ouro por dentro, vidro escuro nos fundos, a coroa com a faixa de runas e a
 * agulha) cheia de CRISTAIS (ciano e violeta, saindo do chão e orbitando), levitando um LIVRO DOURADO aberto num feixe
 * de luz. A frente (+z) é aberta, de frente pra porta da sala.
 *
 * `tocar(...)` roda a ENTREGA (a mesma cena pra todo mundo da sala — o engine recebe o evento EV_RELICARIO): o item VOA
 * de quem entregou até o livro, o livro folheia, as páginas sobem em espiral até o HOLOGRAMA DA ZAEON (o retrato dela no
 * shader de holograma, lendo) em cima da cabine, com a plaquinha "LENDO · título"; no fim, o VEREDITO — aceito: onda e
 * cristais em OURO, ela sorri; recusado: onda VERMELHA. Tudo no referencial da ilha (o engine põe no grupo dela).
 */
import * as THREE from "three";
import { glowTex } from "./CenaCosmica";
import { HOLO_FRAG, HOLO_VERT } from "./HoloZaeon";
import { RITMO_RELICARIO, faseDoRelicario } from "@/lib/cyber/relicario";
import { tronUiOn, dePurplear } from "@/lib/cyber/neon";

export type RelicarioHandle = {
  group: THREE.Group;
  /** o que o clique acerta (a cabine e o livro) */
  alvos: THREE.Object3D[];
  /** roda a cena de uma entrega: `de` = de onde o item sai (MUNDO; null = da frente da cabine); `decorrido` = quantos s
   *  já passaram (quem entra no meio da cena) */
  tocar(o: { de: THREE.Vector3 | null; aceito: boolean; titulo: string; nome: string; cor: string; decorrido?: number }): void;
  /** tem uma entrega rodando agora? */
  ocupado(): boolean;
  atualizar(dt: number, t: number, cam: THREE.Vector3): void;
  dispose(): void;
};

const LIVRO_Y = 3.7, HOLO_Y = 11.4, HOLO_TAM = 5.2, R_PILAR = 2.75, ALT_PILAR = 6.2, BASE_Y = 0.75;
const ESTADOS = ["idle", "think", "blink", "talk_half", "smile", "angry"] as const;
type Estado = (typeof ESTADOS)[number];

/** a plaquinha (canvas) — título em cima, linha de baixo menor */
function plaquinha(c: HTMLCanvasElement, cima: string, baixo: string, cor: string) {
  const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(6,8,18,.82)"; g.beginPath(); g.roundRect(6, 6, c.width - 12, c.height - 12, 18); g.fill();
  g.strokeStyle = cor; g.lineWidth = 3; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = cor; g.font = "800 30px system-ui, sans-serif"; g.fillText(cima.length > 34 ? `${cima.slice(0, 33)}…` : cima, c.width / 2, c.height * 0.38);
  g.fillStyle = "rgba(240,246,255,.82)"; g.font = "500 22px system-ui, sans-serif"; g.fillText(baixo.length > 44 ? `${baixo.slice(0, 43)}…` : baixo, c.width / 2, c.height * 0.72);
}

export function criarRelicario(o: { low: boolean }): RelicarioHandle {
  const g = new THREE.Group(); g.name = "relicario";
  const geos: THREE.BufferGeometry[] = [], mats: THREE.Material[] = [], texs: THREE.Texture[] = [];
  const G = <T extends THREE.BufferGeometry>(x: T) => { geos.push(x); return x; };
  const M = <T extends THREE.Material>(x: T) => { mats.push(x); return x; };
  const T = <T2 extends THREE.Texture>(x: T2) => { texs.push(x); return x; };
  const add = (pai: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); pai.add(m); return m; };
  const aditivo = (c: number, op = 1) => M(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));

  // os MATERIAIS: o metal negro (quase espelhado), o ouro, os filetes de luz dourada e os cristais
  const metal = M(new THREE.MeshStandardMaterial({ color: 0x07080b, metalness: 0.92, roughness: 0.3, emissive: 0x05070d, emissiveIntensity: 1 }));
  const ouro = M(new THREE.MeshStandardMaterial({ color: 0xffc46b, metalness: 1, roughness: 0.22, emissive: 0x7a4c00, emissiveIntensity: 0.9 }));
  const filete = M(new THREE.MeshBasicMaterial({ color: 0xffd28a }));
  const vidro = M(new THREE.MeshStandardMaterial({ color: 0x0b1430, metalness: 0.7, roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
  const cristalA = M(new THREE.MeshStandardMaterial({ color: 0x8ff0ff, emissive: 0x23a6ff, emissiveIntensity: 1.7, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.86 }));
  const cristalB = M(new THREE.MeshStandardMaterial({ color: 0xcfa8ff, emissive: 0x7a3dff, emissiveIntensity: 1.6, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.86 }));
  const tGlow = T(glowTex("rgba(255,236,190,1)", "rgba(255,180,80,0.3)")), tGlowC = T(glowTex("rgba(170,240,255,0.9)", "rgba(60,150,255,0.25)"));
  const alvos: THREE.Object3D[] = [];

  // ── a BASE: octógono em dois degraus, o aro de ouro e o degrau da frente (com a plaquinha) ──
  alvos.push(add(g, G(new THREE.CylinderGeometry(3.4, 3.62, 0.46, 8)), metal, 0, 0.23, 0));
  alvos.push(add(g, G(new THREE.CylinderGeometry(3.0, 3.1, 0.3, 8)), metal, 0, 0.6, 0));
  for (const [r, y] of [[3.52, 0.47], [3.06, 0.76]] as const) { const aro = add(g, G(new THREE.TorusGeometry(r, 0.035, 4, 8)), filete, 0, y, 0); aro.rotation.x = Math.PI / 2; aro.rotation.z = Math.PI / 8; }
  add(g, G(new THREE.BoxGeometry(2.6, 0.22, 0.9)), metal, 0, 0.11, 3.75);
  {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96; plaquinha(c, "RELICÁRIO DO SABER", "entregue o que tem valor · F", "#ffc46b");
    const tx = T(new THREE.CanvasTexture(c)); tx.colorSpace = THREE.SRGBColorSpace;
    const pl = add(g, G(new THREE.PlaneGeometry(2.2, 0.41)), M(new THREE.MeshBasicMaterial({ map: tx, transparent: true })), 0, 0.3, 3.53); pl.rotation.x = -0.35;
  }

  // ── os PILARES (6, a frente aberta entre os dois da frente), com o filete de ouro por dentro e o capitel ──
  const pilares = new THREE.Group(); g.add(pilares);
  const gPilar = G(new THREE.BoxGeometry(0.4, ALT_PILAR, 0.52)), gFilete = G(new THREE.BoxGeometry(0.07, ALT_PILAR - 0.6, 0.02)), gCap = G(new THREE.BoxGeometry(0.66, 0.32, 0.78));
  const angPilar: number[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6; angPilar.push(a);
    const p = new THREE.Group(); p.position.set(Math.sin(a) * R_PILAR, BASE_Y + ALT_PILAR / 2, Math.cos(a) * R_PILAR); p.rotation.y = a; pilares.add(p);
    alvos.push(add(p, gPilar, metal));
    add(p, gFilete, filete, 0, 0, -0.27);
    add(p, gCap, metal, 0, ALT_PILAR / 2 + 0.12, 0);
    add(p, gCap, metal, 0, -ALT_PILAR / 2 + 0.16, 0);
  }
  // o VIDRO escuro nos 3 vãos de trás (a cabine; a frente e os lados da frente ficam abertos)
  for (let k = 2; k < 5; k++) {
    const a = (angPilar[k]! + angPilar[k + 1]!) / 2, r = R_PILAR * Math.cos(Math.PI / 6);
    const v = add(g, G(new THREE.PlaneGeometry(R_PILAR - 0.35, ALT_PILAR - 0.5)), vidro, Math.sin(a) * r, BASE_Y + ALT_PILAR / 2, Math.cos(a) * r); v.rotation.y = a;
  }

  // ── a COROA: o anel sextavado, a faixa de RUNAS douradas girando, a agulha com a ponta acesa ──
  const yCoroa = BASE_Y + ALT_PILAR + 0.3;
  { const an = add(g, G(new THREE.TorusGeometry(2.95, 0.18, 6, 6)), metal, 0, yCoroa, 0); an.rotation.x = Math.PI / 2; an.rotation.z = Math.PI / 6; }
  { const an = add(g, G(new THREE.TorusGeometry(2.95, 0.035, 4, 6)), filete, 0, yCoroa + 0.22, 0); an.rotation.x = Math.PI / 2; an.rotation.z = Math.PI / 6; }
  const cr = document.createElement("canvas"); cr.width = 1024; cr.height = 64;
  { const x = cr.getContext("2d")!; x.fillStyle = "rgba(255,214,140,.95)"; x.font = "bold 40px serif"; x.textBaseline = "middle"; const glifos = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ✦"; for (let i = 0; i < 26; i++) x.fillText(glifos[i % glifos.length]!, 8 + i * 39, 34); }
  const tRunas = T(new THREE.CanvasTexture(cr)); tRunas.wrapS = THREE.RepeatWrapping; tRunas.repeat.set(2, 1);
  const runas = add(g, G(new THREE.CylinderGeometry(2.7, 2.7, 0.42, 36, 1, true)), M(new THREE.MeshBasicMaterial({ map: tRunas, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), 0, yCoroa - 0.55, 0);
  add(g, G(new THREE.ConeGeometry(1.05, 2.3, 6)), metal, 0, yCoroa + 1.35, 0);
  const ponta = add(g, G(new THREE.OctahedronGeometry(0.26)), ouro, 0, yCoroa + 2.65, 0);

  // ── os CRISTAIS: o aglomerado no chão da cabine, os do pé dos pilares e os que orbitam o livro ──
  const gCristal = G(new THREE.OctahedronGeometry(1, 0));
  const cristais: { m: THREE.Mesh; base: number }[] = [];
  const cristal = (x: number, z: number, h: number, w: number, incl: number, ang: number, mat: THREE.Material) => {
    const m = add(g, gCristal, mat, x, BASE_Y + h * 0.42, z); m.scale.set(w, h, w); m.rotation.set(incl * Math.cos(ang), ang, incl * Math.sin(ang)); cristais.push({ m, base: m.position.y }); return m;
  };
  const N = o.low ? 6 : 11;
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + 0.4, r = 0.5 + (i % 3) * 0.55; cristal(Math.sin(a) * r, Math.cos(a) * r - 0.2, 1.1 + ((i * 7) % 5) * 0.32, 0.26 + (i % 2) * 0.08, 0.32, a, i % 2 ? cristalB : cristalA); }
  if (!o.low) for (const a of angPilar) for (const d of [-0.32, 0.32]) cristal(Math.sin(a + d * 0.3) * (R_PILAR + 0.55), Math.cos(a + d * 0.3) * (R_PILAR + 0.55), 0.7 + Math.abs(d), 0.18, 0.5 * Math.sign(d), a, d > 0 ? cristalA : cristalB);
  const orbita = new THREE.Group(); orbita.position.y = LIVRO_Y; g.add(orbita);
  const NO = o.low ? 4 : 6;
  for (let i = 0; i < NO; i++) { const a = (i / NO) * Math.PI * 2, m = add(orbita, gCristal, i % 2 ? cristalB : cristalA, Math.sin(a) * 1.25, Math.sin(i * 1.7) * 0.25, Math.cos(a) * 1.25); m.scale.set(0.09, 0.26, 0.09); }
  const brilhoCristais = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlowC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })));
  brilhoCristais.scale.setScalar(5.5); brilhoCristais.position.y = BASE_Y + 1.1; g.add(brilhoCristais);
  const luz = o.low ? null : new THREE.PointLight(0x7fd8ff, 7, 16, 1.6); if (luz) { luz.position.y = LIVRO_Y; g.add(luz); }

  // ── o LIVRO DOURADO levitando num feixe: as capas em V, o miolo, a lombada e a página que folheia ──
  const livro = new THREE.Group(); livro.position.y = LIVRO_Y; g.add(livro);
  const feixe = add(g, G(new THREE.CylinderGeometry(0.16, 0.7, LIVRO_Y - BASE_Y, 20, 1, true).translate(0, (LIVRO_Y - BASE_Y) / 2, 0)), aditivo(0xffd9a0, 0.22), 0, BASE_Y, 0);
  const gCapa = G(new THREE.BoxGeometry(0.88, 0.07, 1.18).translate(0.44, 0, 0)), gMiolo = G(new THREE.BoxGeometry(0.8, 0.13, 1.08).translate(0.42, 0.07, 0));
  const papel = M(new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0x8a6a2a, emissiveIntensity: 0.55, roughness: 0.8 }));
  const lados: THREE.Group[] = [];
  for (const s of [1, -1]) {
    const lado = new THREE.Group(); lado.scale.x = s; livro.add(lado); lados.push(lado);
    alvos.push(add(lado, gCapa, ouro)); add(lado, gMiolo, papel);
  }
  add(livro, G(new THREE.CylinderGeometry(0.07, 0.07, 1.18, 8).rotateX(Math.PI / 2)), ouro);
  const folha = new THREE.Group(); livro.add(folha);
  add(folha, G(new THREE.PlaneGeometry(0.78, 1.04).translate(0.41, 0, 0).rotateX(-Math.PI / 2)), M(new THREE.MeshBasicMaterial({ color: 0xfff6e0, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }))).position.y = 0.15;
  const brilhoLivro = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 })));
  brilhoLivro.scale.setScalar(3.4); livro.add(brilhoLivro);

  // ── o HOLOGRAMA DA ZAEON lendo (em cima da cabine), o cone de leitura até o livro e a plaquinha ──
  const holo = new THREE.Group(); holo.position.y = HOLO_Y; holo.visible = false; g.add(holo);
  const texsZ: Partial<Record<Estado, THREE.Texture>> = {}, loader = new THREE.TextureLoader();
  const uni = { uMap: { value: null as THREE.Texture | null }, uT: { value: 0 }, uRevela: { value: 0 }, uAlpha: { value: 1 }, uGlitch: { value: 0 }, uTem: { value: 0 }, uIra: { value: 0 } };
  let texturasCarregadas = false;
  const carregarTexturas = () => {
    if (texturasCarregadas) return; texturasCarregadas = true;   // só na 1ª entrega (ninguém paga o download à toa)
    for (const e of ESTADOS) loader.load(`/avatars/zaeon/${e}.webp`, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; texsZ[e] = tx; texs.push(tx); if (e === "think" || (!uni.uMap.value && e === "idle")) { uni.uMap.value = tx; uni.uTem.value = 1; } });
  };
  const rosto = add(holo, G(new THREE.PlaneGeometry(HOLO_TAM, HOLO_TAM)), M(new THREE.ShaderMaterial({ uniforms: uni, vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
  const halo = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlowC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 })));
  halo.scale.setScalar(HOLO_TAM * 1.5); halo.position.z = -0.2; holo.add(halo);
  const cone = add(g, G(new THREE.CylinderGeometry(HOLO_TAM * 0.32, 0.25, HOLO_Y - HOLO_TAM * 0.45 - LIVRO_Y, 24, 1, true).translate(0, (HOLO_Y - HOLO_TAM * 0.45 - LIVRO_Y) / 2, 0)), aditivo(0x7fe8ff, 0.12), 0, LIVRO_Y, 0);
  cone.visible = false;
  const cPlaca = document.createElement("canvas"); cPlaca.width = 640; cPlaca.height = 120;
  const tPlaca = T(new THREE.CanvasTexture(cPlaca)); tPlaca.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tPlaca, transparent: true, depthWrite: false }))); placa.scale.set(5.2, 0.98, 1); placa.position.y = HOLO_Y - HOLO_TAM * 0.5 - 0.35; placa.visible = false; g.add(placa);
  // as PÁGINAS subindo em espiral do livro até ela
  const cPag = document.createElement("canvas"); cPag.width = 64; cPag.height = 84;
  { const x = cPag.getContext("2d")!; x.fillStyle = "rgba(220,250,255,.92)"; x.fillRect(2, 2, 60, 80); x.fillStyle = "rgba(30,90,140,.75)"; for (let i = 0; i < 9; i++) x.fillRect(8, 10 + i * 7.5, 48 - (i % 3) * 9, 2.5); }
  const tPag = T(new THREE.CanvasTexture(cPag)), NPAG = o.low ? 5 : 9;
  const paginas = Array.from({ length: NPAG }, (_, i) => { const s = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tPag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }))); s.scale.set(0.42, 0.55, 1); s.visible = false; g.add(s); return { s, fase: i / NPAG }; });

  // ── a ENTREGA: o item voando, a onda do veredito ──
  const voador = new THREE.Group(); voador.visible = false; g.add(voador);
  const matVoador = M(new THREE.MeshStandardMaterial({ color: 0x7fe8ff, emissive: 0x2a9cff, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.3 }));
  add(voador, G(new THREE.BoxGeometry(0.5, 0.12, 0.66)), matVoador);
  const rastro = new THREE.Sprite(M(new THREE.SpriteMaterial({ map: tGlowC, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); rastro.scale.setScalar(1.8); voador.add(rastro);
  const onda = add(g, G(new THREE.TorusGeometry(1, 0.07, 6, 64)), aditivo(0xffd28a, 1), 0, LIVRO_Y, 0); onda.rotation.x = Math.PI / 2; onda.visible = false;

  const NOMRA = new THREE.Color(0x23a6ff), NOMRB = new THREE.Color(0x7a3dff), OURO = new THREE.Color(0xffb02e), VERMELHO = new THREE.Color(0xff2a2a);
  const de = new THREE.Vector3(), alvoLivro = new THREE.Vector3(0, LIVRO_Y, 0), tmp = new THREE.Vector3(), wpos = new THREE.Vector3();
  // a cena corre no RELÓGIO DE PAREDE (t0): quem entra no meio ou se afasta e volta vê o mesmo instante que a sala
  let cena: { t0: number; aceito: boolean; titulo: string; nome: string; placaVeredito: boolean } | null = null, estado: Estado = "idle", troca = 0, k = 0;
  const usar = (e: Estado) => { const tx = texsZ[e] ?? texsZ.think ?? texsZ.idle; if (tx && uni.uMap.value !== tx) uni.uMap.value = tx; estado = e; };
  const s3 = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

  if (tronUiOn()) dePurplear(g);   // TRON: o Relicário do Saber em ciano/preto

  return {
    group: g, alvos,
    tocar({ de: deMundo, aceito, titulo, nome, cor, decorrido = 0 }) {
      carregarTexturas();
      g.updateMatrixWorld(true);
      if (deMundo) de.copy(g.worldToLocal(tmp.copy(deMundo))).setY(Math.max(1, de.y + 1.2)); else de.set(0, 1.4, 6);
      cena = { t0: performance.now() - Math.max(0, decorrido) * 1000, aceito, titulo, nome, placaVeredito: false };
      matVoador.color.set(cor); plaquinha(cPlaca, `LENDO · ${titulo}`, `entregue por ${nome}`, "#7fe8ff"); tPlaca.needsUpdate = true;
      uni.uIra.value = 0;
    },
    ocupado: () => !!cena,
    atualizar(dt, t, cam) {
      // o de sempre: o livro respira e gira devagar, os cristais pulsam, as runas giram, a órbita
      livro.position.y = LIVRO_Y + Math.sin(t * 1.1) * 0.12; livro.rotation.y += dt * (cena ? 0 : 0.35);
      orbita.rotation.y += dt * 0.5; runas.rotation.y -= dt * 0.18; ponta.rotation.y += dt * 1.2;
      for (let i = 0; i < cristais.length; i++) { const c = cristais[i]!; c.m.position.y = c.base + Math.sin(t * 1.3 + i) * 0.03; }
      const abre = 0.42;
      if (!cena) {
        for (const [i, l] of lados.entries()) l.rotation.z = (i ? -1 : 1) * abre;
        folha.rotation.z = abre; voador.visible = false; onda.visible = false; holo.visible = false; cone.visible = false; placa.visible = false;
        for (const p of paginas) p.s.visible = false;
        (cristalA as THREE.MeshStandardMaterial).emissive.lerp(NOMRA, Math.min(1, dt * 2)); (cristalB as THREE.MeshStandardMaterial).emissive.lerp(NOMRB, Math.min(1, dt * 2));
        if (luz) luz.color.lerp(NOMRA, Math.min(1, dt * 2));
        (feixe.material as THREE.MeshBasicMaterial).opacity = 0.22;
        return;
      }
      const s = (performance.now() - cena.t0) / 1000, fase = faseDoRelicario(s), R = RITMO_RELICARIO;
      // 1) o ITEM voa (arco) de quem entregou até o livro
      voador.visible = fase === "voando";
      if (fase === "voando") {
        const u = s3(s / R.voo); voador.position.lerpVectors(de, alvoLivro, u); voador.position.y += Math.sin(u * Math.PI) * 3;
        voador.rotation.y += dt * 6; voador.scale.setScalar(1 - u * 0.6);
      }
      // 2) a LEITURA: o livro abre e folheia, as páginas sobem até o holograma dela, que aparece em cima da cabine
      const lendo = fase === "lendo" || fase === "veredito", sl = s - R.voo;
      holo.visible = lendo; cone.visible = fase === "lendo"; placa.visible = lendo;
      const aberto = lendo ? 1.15 : abre;
      for (const [i, l] of lados.entries()) l.rotation.z += ((i ? -1 : 1) * aberto - l.rotation.z) * Math.min(1, dt * 4);
      folha.rotation.z = fase === "lendo" ? aberto - ((sl * 2.2) % 1) * aberto * 2 : aberto;   // a página vira, de novo e de novo
      (feixe.material as THREE.MeshBasicMaterial).opacity = fase === "lendo" ? 0.4 + Math.sin(t * 9) * 0.08 : 0.22;
      if (lendo) {
        k = fase === "lendo" ? Math.min(1, sl / 0.9) : Math.max(0, 1 - (s - R.voo - R.leitura - (R.veredito - 1.2)) / 1.2);
        uni.uT.value = t; uni.uRevela.value = s3(k); uni.uAlpha.value = s3(Math.min(1, k * 1.4)); uni.uGlitch.value = k < 1 || Math.sin(t * 0.8) > 0.94 ? 1 : 0;
        holo.position.y = HOLO_Y + Math.sin(t * 0.9) * 0.18;
        holo.getWorldPosition(wpos); rosto.rotation.y = Math.atan2(cam.x - wpos.x, cam.z - wpos.z); halo.material.opacity = 0.5 * k;
        (cone.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 6) * 0.04;
        // a cara: lendo = concentrada (think) com piscadas e um murmúrio; o veredito = sorriso ou a cara fechada
        troca -= dt;
        if (fase === "veredito") usar(cena.aceito ? "smile" : "angry");
        else if (troca <= 0) { troca = 0.5 + Math.random() * 0.9; const r = Math.random(); usar(r < 0.6 ? "think" : r < 0.8 ? "talk_half" : "blink"); }
        uni.uIra.value = fase === "veredito" && !cena.aceito ? 0.55 : 0;
        for (const p of paginas) {
          p.s.visible = fase === "lendo";
          if (!p.s.visible) continue;
          const u = (sl * 0.32 + p.fase) % 1, a = u * Math.PI * 4 + p.fase * 6;
          p.s.position.set(Math.sin(a) * (0.6 + u * 1.6), LIVRO_Y + 0.3 + u * (HOLO_Y - HOLO_TAM * 0.4 - LIVRO_Y), Math.cos(a) * (0.6 + u * 1.6));
          (p.s.material as THREE.SpriteMaterial).opacity = Math.sin(u * Math.PI) * 0.9;
        }
      }
      // 3) o VEREDITO: a onda (ouro ou vermelha), os cristais e a luz na cor dele, a plaquinha
      if (fase === "veredito") {
        const sv = s - R.voo - R.leitura, cor = cena.aceito ? OURO : VERMELHO;
        if (!cena.placaVeredito) { cena.placaVeredito = true; plaquinha(cPlaca, cena.aceito ? "ACEITO ✦" : "AINDA NÃO", cena.aceito ? `${cena.titulo} tem valor — recompensa liberada` : `${cena.titulo} — volte quando estiver completo`, cena.aceito ? "#ffc46b" : "#ff6b6b"); tPlaca.needsUpdate = true; }
        onda.visible = sv < 1.6; onda.scale.setScalar(0.5 + sv * 6); (onda.material as THREE.MeshBasicMaterial).color.copy(cor); (onda.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - sv / 1.6);
        (cristalA as THREE.MeshStandardMaterial).emissive.lerp(cor, Math.min(1, dt * 3)); (cristalB as THREE.MeshStandardMaterial).emissive.lerp(cor, Math.min(1, dt * 3));
        if (luz) luz.color.lerp(cor, Math.min(1, dt * 3));
      }
      if (fase === "fim") cena = null;
    },
    dispose() {
      for (const x of geos) x.dispose(); for (const m of mats) m.dispose(); for (const x of texs) x.dispose();
      g.removeFromParent();
    },
  };
}
