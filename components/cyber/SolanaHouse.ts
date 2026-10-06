/**
 * SolanaHouse — o QG da Superteam Brasil, flutuando: um prédio de apartamento futurista de 3 andares + ROOFTOP num disco
 * no céu. Vidro escuro com caixilhos finos, lajes com FAIXAS DE LUZ no degradê da Solana (roxo → verde), sacadas de
 * vidro, o tubo do ELEVADOR aceso no canto. Dentro: lobby/coworking (térreo), hacker house (2º), apartamento (3º).
 * Em cima: piscina de borda infinita, bar, espreguiçadeiras, lounge, cabine de DJ e o LOGO da Superteam Brasil num
 * painel grande virado pra chegada. Por baixo, a base com os propulsores antigravidade e o elevador de luz.
 * Layout e colisão em lib/cyber/solana.ts (as mesmas medidas).
 */
import * as THREE from "three";
import { ANDARES_SOLANA, ROOFTOP, SOLANA, moveisDoAndar, paredesDoAndar, type MovelS } from "@/lib/cyber/solana";
import { PLATAFORMAS } from "@/lib/cyber/plataformas";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";
import { criarElevadorDeLuz } from "./ElevadorDeLuz";

export type SolanaHouseHandle = { group: THREE.Group; atualizar(dt: number, t: number): void; dispose(): void };

/** o logo oficial da Superteam Brasil (br.superteam.fun) */
const LOGO_SUPERTEAM = "/assets/cyber/logo-superteam-br.png";
const ROXO = 0x9945ff, VERDE = 0x14f195;

export function criarSolanaHouse(o: { low: boolean; starTex: THREE.Texture }): SolanaHouseHandle {
  const { low } = o, S = SOLANA, P = S.predio, H = ANDARES_SOLANA[ROOFTOP];
  const raiz = new THREE.Group(); raiz.position.set(S.centro.x, S.y, S.centro.z);
  const texturas: THREE.Texture[] = [], anim: ((dt: number, t: number) => void)[] = [];
  const add = <T extends THREE.Object3D>(x: T, pai: THREE.Object3D = raiz) => { pai.add(x); return x; };
  const tela = (w: number, h: number, pintar: (g: CanvasRenderingContext2D, w: number, h: number) => void) => { const c = document.createElement("canvas"); c.width = w; c.height = h; pintar(c.getContext("2d")!, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texturas.push(t); return t; };
  /** textura com o LOGO (redesenha quando a imagem chega); corta a margem lisa do PNG (o "ST" + a bandeira ficam no meio) */
  const comLogo = (w: number, h: number, fundo: string) => {
    const t = tela(w, h, (g) => { g.fillStyle = fundo; g.fillRect(0, 0, w, h); });
    if (typeof Image !== "undefined") {
      const img = new Image();
      img.onload = () => { const c = t.image as HTMLCanvasElement, g = c.getContext("2d")!, k = img.width / 1920, lado = 1100 * k, sx = 420 * k, sy = 520 * k, m = Math.min(w, h); g.fillStyle = fundo; g.fillRect(0, 0, w, h); g.drawImage(img, sx, sy, lado, lado, (w - m) / 2, (h - m) / 2, m, m); t.needsUpdate = true; };
      img.src = LOGO_SUPERTEAM;
    }
    return t;
  };
  const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(), mp = new THREE.Vector3();
  const caixas = (lista: number[][], mat: THREE.Material) => {
    if (!lista.length) return null;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, lista.length);
    lista.forEach((c, i) => { mq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, c[6] ?? 0); im.setMatrixAt(i, mx.compose(mp.set(c[0]!, c[1]!, c[2]!), mq, ms.set(c[3]!, c[4]!, c[5]!))); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return add(im);
  };

  // materiais
  const concreto = new THREE.MeshStandardMaterial({ color: 0x1c1f2e, roughness: 0.55, metalness: 0.35, emissive: 0x0c0e1c, emissiveIntensity: 0.5 });
  const laje = new THREE.MeshStandardMaterial({ color: 0xd9dbe6, roughness: 0.4, metalness: 0.2, emissive: 0x23263a, emissiveIntensity: 0.4 });
  const vidro = new THREE.MeshStandardMaterial({ color: 0x2a2f55, roughness: 0.05, metalness: 0.6, emissive: 0x1a1240, emissiveIntensity: 0.5, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const caixilho = new THREE.MeshStandardMaterial({ color: 0x0b0c14, roughness: 0.3, metalness: 0.9 });
  const madeira = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.6, emissive: 0x24140a, emissiveIntensity: 0.4 });
  const estofado = new THREE.MeshStandardMaterial({ color: 0xece8f5, roughness: 0.85, emissive: 0x2a2440, emissiveIntensity: 0.3 });
  const escuro = new THREE.MeshStandardMaterial({ color: 0x0b0d16, roughness: 0.35, metalness: 0.6 });
  // o degradê da Solana (roxo → verde) numa textura de faixa
  const degrade = tela(256, 8, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#9945ff"); gr.addColorStop(0.5, "#43b4ca"); gr.addColorStop(1, "#14f195"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const faixaMat = new THREE.MeshBasicMaterial({ map: degrade, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });

  // ── DISCO: deck claro + borda escura + aros de luz (roxo e verde) + base com propulsores ──
  const seg = low ? 48 : 96;
  const deckTex = tela(256, 256, (g, w, h) => { g.fillStyle = "#2a2d40"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 2; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke(); } });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(S.r / 4, S.r / 4);
  const deck = add(new THREE.Mesh(new THREE.CircleGeometry(S.r, seg), new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.7, metalness: 0.2, emissive: 0x0e0f1c, emissiveIntensity: 0.4 }))); deck.rotation.x = -Math.PI / 2; deck.position.y = 0.02;
  const borda = add(new THREE.Mesh(new THREE.CylinderGeometry(S.r, S.r - 1, 1.6, seg, 1, true), concreto)); borda.position.y = -0.8;
  for (const [cor, y, r] of [[ROXO, 0.12, S.r], [VERDE, -1.6, S.r - 1]] as const) { const a = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 6, seg), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }))); a.rotation.x = Math.PI / 2; a.position.y = y; }
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0c0a1a, roughness: 0.35, metalness: 0.5, emissive: 0x2a1060, emissiveIntensity: 0.5, flatShading: true });
  const cone = add(new THREE.Mesh(new THREE.ConeGeometry(S.r - 1, 26, low ? 8 : 14, 2), baseMat)); cone.rotation.x = Math.PI; cone.position.y = -1.6 - 13;
  const texAnti = glowTex("rgba(160,110,255,.95)", "rgba(20,241,149,.25)"); texturas.push(texAnti);
  const antis: THREE.Sprite[] = [];
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2, s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texAnti, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); s.position.set(Math.cos(a) * S.r * 0.7, -3.5, Math.sin(a) * S.r * 0.7); s.scale.setScalar(10); antis.push(s); }
  anim.push((_, t) => antis.forEach((s, i) => { s.material.opacity = 0.5 + 0.4 * Math.sin(t * 1.7 + i); }));
  // ELEVADOR DE LUZ (chão ↔ disco)
  const el = PLATAFORMAS.solana;
  anim.push(criarElevadorDeLuz(raiz, { chao: { x: el.anelChao.x - S.centro.x, z: el.anelChao.z - S.centro.z, r: el.anelChao.r, y: -S.y }, disco: { x: el.anelDisco.x - S.centro.x, z: el.anelDisco.z - S.centro.z, r: el.anelDisco.r }, low, cor: VERDE }));
  // caminho de luz do anel até a porta
  const caminho = add(new THREE.Mesh(new THREE.PlaneGeometry(20, 1.6), faixaMat)); caminho.rotation.set(-Math.PI / 2, 0, Math.PI / 2); caminho.position.set(0, 0.04, -12.3);   // o comprido corre em z (do anel à porta), o degradê junto

  // ── O PRÉDIO: lajes (com faixa de luz na borda), sacadas, paredes de vidro com caixilhos, a laje do rooftop ──
  const lx = P.x1 - P.x0, lz = P.z1 - P.z0, cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
  const lajes: number[][] = [], faixas: number[][] = [];
  for (const y of ANDARES_SOLANA) {
    if (y > 0) lajes.push([cx, y - 0.2, cz, lx + 0.6, 0.4, lz + 0.6]);
    else lajes.push([cx, 0.08, cz, lx, 0.16, lz]);
    if (y > 0) { faixas.push([cx, y - 0.2, P.z0 - 0.31, lx + 0.6, 0.12, 0.04], [cx, y - 0.2, P.z1 + 0.31, lx + 0.6, 0.12, 0.04], [P.x0 - 0.31, y - 0.2, cz, 0.04, 0.12, lz + 0.6], [P.x1 + 0.31, y - 0.2, cz, 0.04, 0.12, lz + 0.6]); }
  }
  for (const y of [ANDARES_SOLANA[1], ANDARES_SOLANA[2]]) {   // sacadas (a laje avança pra frente)
    lajes.push([cx, y - 0.2, (S.sacada.z0 + P.z0) / 2, lx + 0.6, 0.4, P.z0 - S.sacada.z0]);
    faixas.push([cx, y - 0.2, S.sacada.z0 - 0.02, lx + 0.6, 0.12, 0.04]);
  }
  caixas(lajes, laje); caixas(faixas, faixaMat);
  // paredes de vidro (as mesmas das colisões) + caixilhos verticais; parede do fundo do térreo opaca (o painel do logo)
  const vidros: number[][] = [], montantes: number[][] = [];
  ANDARES_SOLANA.forEach((y0, andar) => {
    for (const w of paredesDoAndar(andar)) {
      const L = Math.hypot(w.bx - w.ax, w.bz - w.az), giro = -Math.atan2(w.bz - w.az, w.bx - w.ax), wx = (w.ax + w.bx) / 2, wz = (w.az + w.bz) / 2;
      vidros.push([wx, y0 + w.alt / 2, wz, L, w.alt, Math.min(w.esp, 0.12), giro]);
      const ux = (w.bx - w.ax) / (L || 1), uz = (w.bz - w.az) / (L || 1);
      for (let d = 0; d <= L + 0.01; d += w.alt > 2 ? 2 : 3) montantes.push([w.ax + ux * d, y0 + w.alt / 2, w.az + uz * d, 0.08, w.alt, 0.08]);
      if (w.alt > 2) montantes.push([wx, y0 + w.alt - 0.04, wz, L, 0.08, 0.1, giro]);   // travessa no alto
    }
  });
  caixas(vidros, vidro); caixas(montantes, caixilho);
  // aletas de LED verticais nas quinas (degradê)
  for (const [x, z] of [[P.x0 - 0.35, P.z0 - 0.35], [P.x1 + 0.35, P.z0 - 0.35], [P.x0 - 0.35, P.z1 + 0.35], [P.x1 + 0.35, P.z1 + 0.35]] as const) {
    const a = add(new THREE.Mesh(new THREE.BoxGeometry(0.14, H + 1.2, 0.14), faixaMat)); a.position.set(x, (H + 1.2) / 2, z); a.rotation.z = 0;
  }
  // o tubo do ELEVADOR (vidro, aceso por dentro) — do térreo ao rooftop
  const tubo = add(new THREE.Mesh(new THREE.CylinderGeometry(S.elevador.r, S.elevador.r, H + 2.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  tubo.position.set(S.elevador.x, (H + 2.6) / 2, S.elevador.z);
  const tampa = add(new THREE.Mesh(new THREE.CylinderGeometry(S.elevador.r + 0.2, S.elevador.r + 0.2, 0.2, 24), escuro)); tampa.position.set(S.elevador.x, H + 2.7, S.elevador.z);
  const pisoElev: THREE.Mesh[] = [];
  ANDARES_SOLANA.forEach((y0) => { const d = add(new THREE.Mesh(new THREE.CircleGeometry(S.elevador.r, 24), new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }))); d.rotation.x = -Math.PI / 2; d.position.set(S.elevador.x, y0 + 0.05, S.elevador.z); pisoElev.push(d); });
  anim.push((_, t) => { pisoElev.forEach((d, i) => { (d.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.15 * Math.sin(t * 2 + i); }); });

  // ── INTERIORES: os móveis de cada andar (os mesmos retângulos da colisão) com acabamento por tipo ──
  const porMat = new Map<THREE.Material, number[][]>();
  const matDe: Record<MovelS["tipo"], THREE.Material> = { balcao: laje, sofa: estofado, mesa: madeira, pufe: new THREE.MeshStandardMaterial({ color: 0x9945ff, roughness: 0.9, emissive: 0x2a1060, emissiveIntensity: 0.4 }), cama: estofado, ilha: laje, piscina: concreto, bar: madeira, espreguicadeira: estofado, planta: madeira, dj: escuro };
  ANDARES_SOLANA.forEach((y0, andar) => {
    for (const mv of moveisDoAndar(andar)) {
      if (mv.tipo === "piscina" || mv.tipo === "planta") continue;
      const l = porMat.get(matDe[mv.tipo]) ?? []; l.push([(mv.x0 + mv.x1) / 2, y0 + mv.alt / 2, (mv.z0 + mv.z1) / 2, mv.x1 - mv.x0, mv.alt, mv.z1 - mv.z0]); porMat.set(matDe[mv.tipo], l);
    }
  });
  for (const [mat, l] of porMat) caixas(l, mat);
  // plantas (vaso + folhagem) no lobby e no terraço do disco
  const verdeFolha = new THREE.MeshStandardMaterial({ color: 0x1f7a4a, roughness: 0.9, emissive: 0x0a3a20, emissiveIntensity: 0.5, flatShading: true });
  const plantas: [number, number, number][] = [[-11, -1, 0], [11.2, 13.45, 0], ...[-24, -16, 16, 24].map((x) => [x, -10, 0] as [number, number, number]), [-20, 14, 0], [20, 14, 0]];
  for (const [x, z, y0] of plantas) {
    const vaso = add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.7, 10), escuro)); vaso.position.set(x, y0 + 0.35, z);
    const folha = add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), verdeFolha)); folha.position.set(x, y0 + 1.4, z); folha.scale.set(1, 1.4, 1);
  }
  // telas: computadores nas mesas (térreo e 2º), telão da hacker house (com o logo), TV do apartamento
  const telaPc = tela(128, 80, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#1a0b3a"); gr.addColorStop(1, "#0b2a2a"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "#14f195"; for (let i = 0; i < 6; i++) g.fillRect(8, 10 + i * 10, 30 + ((i * 37) % 70), 4); g.fillStyle = "#9945ff"; g.fillRect(w - 36, 12, 26, 52); });
  const monitores: number[][] = [], telasPc: { x: number; y: number; z: number }[] = [];
  for (const andar of [0, 1]) for (const mv of moveisDoAndar(andar).filter((x) => x.tipo === "mesa")) for (let x = mv.x0 + 1; x < mv.x1 - 0.6; x += 2) {
    const y0 = ANDARES_SOLANA[andar]!, z = (mv.z0 + mv.z1) / 2;
    monitores.push([x, y0 + mv.alt + 0.3, z, 0.9, 0.55, 0.05]); telasPc.push({ x, y: y0 + mv.alt + 0.3, z: z - 0.03 });
  }
  caixas(monitores, escuro);
  if (telasPc.length) { const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.84, 0.48), new THREE.MeshBasicMaterial({ map: telaPc }), telasPc.length); telasPc.forEach((t, i) => im.setMatrixAt(i, mx.compose(mp.set(t.x, t.y, t.z), mq.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI), ms.set(1, 1, 1)))); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); add(im); }
  const logoClaro = comLogo(512, 512, "#bbfb64");
  // lobby: o painel do LOGO na parede do fundo (por dentro, virado pra porta)
  const painelLobby = add(new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3), new THREE.MeshBasicMaterial({ map: comLogo(768, 500, "#bbfb64") }))); painelLobby.position.set(-2, 2.1, P.z1 - 0.3); painelLobby.rotation.y = Math.PI;
  // hacker house: o telão
  const telao = add(new THREE.Mesh(new THREE.PlaneGeometry(8, 3.4), new THREE.MeshBasicMaterial({ map: comLogo(1024, 436, "#120a2a") }))); telao.position.set(-4, ANDARES_SOLANA[1] + 2.3, P.z1 - 0.3); telao.rotation.y = Math.PI;
  // apartamento: TV + travesseiros nas camas
  const tv = add(new THREE.Mesh(new THREE.PlaneGeometry(4, 2.3), new THREE.MeshBasicMaterial({ map: telaPc }))); tv.position.set(-7.2, ANDARES_SOLANA[2] + 2, -1.6); tv.rotation.y = 0;
  const travesseiros: number[][] = [];
  for (const mv of moveisDoAndar(2).filter((x) => x.tipo === "cama")) travesseiros.push([(mv.x0 + mv.x1) / 2, ANDARES_SOLANA[2] + mv.alt + 0.1, mv.z1 - 0.5, mv.x1 - mv.x0 - 0.6, 0.2, 0.6]);
  caixas(travesseiros, new THREE.MeshStandardMaterial({ color: 0x9945ff, roughness: 0.9, emissive: 0x2a1060, emissiveIntensity: 0.4 }));

  // ── ROOFTOP: piscina de borda infinita (água animada), bar com banquetas, guarda-sóis, DJ e o PAINEL DO LOGO ──
  const pc = S.piscina, plx = pc.x1 - pc.x0, plz = pc.z1 - pc.z0;
  caixas([[pc.x0 - 0.15, H + 0.25, (pc.z0 + pc.z1) / 2, 0.3, 0.5, plz + 0.3], [pc.x1 + 0.15, H + 0.25, (pc.z0 + pc.z1) / 2, 0.3, 0.5, plz + 0.3], [(pc.x0 + pc.x1) / 2, H + 0.25, pc.z0 - 0.15, plx, 0.5, 0.3], [(pc.x0 + pc.x1) / 2, H + 0.25, pc.z1 + 0.15, plx, 0.5, 0.3]], laje);
  const aguaTex = tela(256, 256, (g, w, h) => { g.fillStyle = "#0a6a8a"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(160,255,240,.35)"; g.lineWidth = 3; for (let i = 0; i < 14; i++) { g.beginPath(); const y = (i / 14) * h; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + i) * 5); g.stroke(); } });
  aguaTex.wrapS = aguaTex.wrapT = THREE.RepeatWrapping; aguaTex.repeat.set(2, 2);
  const agua = add(new THREE.Mesh(new THREE.PlaneGeometry(plx, plz), new THREE.MeshStandardMaterial({ map: aguaTex, color: 0x66e6ff, roughness: 0.05, metalness: 0.3, emissive: 0x0a5a6a, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 })));
  agua.rotation.x = -Math.PI / 2; agua.position.set((pc.x0 + pc.x1) / 2, H + 0.42, (pc.z0 + pc.z1) / 2);
  const luzPiscina = add(new THREE.Mesh(new THREE.PlaneGeometry(plx - 0.4, plz - 0.4), new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }))); luzPiscina.rotation.x = -Math.PI / 2; luzPiscina.position.set(agua.position.x, H + 0.2, agua.position.z);
  anim.push((_, t) => { aguaTex.offset.set(t * 0.02, t * 0.035); });
  // banquetas no bar, guarda-sóis, luz da cabine do DJ
  const bar = moveisDoAndar(ROOFTOP).find((x) => x.tipo === "bar")!, banquetas: number[][] = [];
  for (let x = bar.x0 + 0.6; x < bar.x1; x += 1.2) banquetas.push([x, H + 0.4, bar.z0 - 0.6, 0.45, 0.8, 0.45]);
  caixas(banquetas, escuro);
  for (const x of [-8.8, -2]) {
    const haste = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), escuro)); haste.position.set(x, H + 1.3, 0.3);
    const lona = add(new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xf5f0ff, roughness: 0.8, emissive: 0x30284a, emissiveIntensity: 0.3 }))); lona.position.set(x, H + 2.7, 0.3);
  }
  const dj = moveisDoAndar(ROOFTOP).find((x) => x.tipo === "dj")!, luzesDj: THREE.Mesh[] = [];
  for (let k = 0; k < 6; k++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: k % 2 ? ROXO : VERDE }))); b.position.set(dj.x0 + 0.4 + k * 0.45, H + dj.alt - 0.25, dj.z0 - 0.03); luzesDj.push(b); }
  anim.push((_, t) => luzesDj.forEach((b, i) => { b.visible = Math.sin(t * 6 + i * 1.3) > -0.2; }));
  // o PAINEL do logo: moldura no fundo do rooftop, virado pro sul (pra quem chega pelo elevador de luz)
  const painel = new THREE.Group(); painel.position.set(-3, H, P.z1 - 0.2); add(painel);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 7.6, 0.25), escuro); p.position.set(sx * 3.4, 3.8, 0); painel.add(p); }
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 6.4), new THREE.MeshBasicMaterial({ map: logoClaro, side: THREE.DoubleSide })); placa.position.set(0, 4.3, 0); placa.rotation.y = Math.PI; painel.add(placa);
  const moldura = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.14, 0.1), faixaMat); moldura.position.set(0, 1.05, 0); painel.add(moldura);
  const moldura2 = moldura.clone(); moldura2.position.y = 7.55; painel.add(moldura2);
  // e o logo pequeno sobre a porta do térreo
  const placaPorta = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: logoClaro }))); placaPorta.position.set(0, 3.55, P.z0 - 0.08); placaPorta.rotation.y = Math.PI;
  // as faixas de luz "respiram"
  anim.push((_, t) => { faixaMat.opacity = 0.8 + 0.15 * Math.sin(t * 1.2); });

  const luz = new THREE.PointLight(0xb98cff, low ? 1.2 : 1.8, 70); luz.position.set(0, H + 8, 4); add(luz);

  return {
    group: raiz,
    atualizar(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { liberar(raiz, texturas); },
  };
}
