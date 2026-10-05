/**
 * Cidade — a ZAEON, a ilha no céu (a base do dono), acima do buraco negro. Mesmo idioma da Zaeon do chão (cristal, gelo,
 * granizo, fogo contido, querubins, contraste frio×quente), maior e mais rica, no conceito das cidades flutuantes:
 *  - ilha monumental de cristal (montanha INVERTIDA: larga em cima, ápice embaixo) com estalactites, quedas de luz,
 *    andares de servidores iluminados no casco e uma AGULHA afiada descendo do ápice (só rocha: sem luz na ponta);
 *  - ilhotas flutuantes em volta, com aglomerados de cristal;
 *  - muralhas de granizo + 4 torres com pontas luminosas; línguas de fogo na borda (cintilar lento, sem estrobo);
 *  - CIDADELA monumental (pilares + cúpula estelar + tambor + 2ª cúpula + pináculo) = BIBLIOTECA: anel de estantes com
 *    livros de luz e monitores verticais (clicar = estudar) rodeando a sala; dentro, 4 SALAS DE SERVIDORES (racks com
 *    LEDs e fluxo de dados subindo pra cúpula) em volta da mesa com um globo de luz no centro;
 *  - LOUNGE em pavilhão de vidro (sofá/TV/caixas de som) — components/cyber/Salas.ts;
 *  - HANGAR grande (cabem naves maiores) com pilones de luz; portal de volta (mini disco de acreção); farol no topo;
 *  - no CHÃO, embaixo do buraco negro: o anel de entrada (o portal).
 * Layout em lib/cyber/ceu.ts (o mesmo que a colisão usa). `low` reduz partículas/segmentos/ilhotas;
 * `prefers-reduced-motion` deixa fogo/vórtices quase parados. dispose() completo.
 */
import * as THREE from "three";
import { BOIA_ILHOTA, CIDADE, ILHOTAS, bibliotecaLocais, pilonesDoHangar, servidoresLocais } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";
import { criarSalas } from "./Salas";
import { criarPisoEstacionamento } from "./Estacionamento";
import { LOTE_ZAEON_LOCAL } from "@/lib/cyber/motos";

export type CidadeHandle = {
  group: THREE.Group;
  /** sub-grupo da ilha (em y = pisoY) — o engine soma a flutuação dele a quem está lá em cima */
  ilha: THREE.Group;
  rotulo: HTMLDivElement;
  /** superfícies sólidas (raycast do clique/câmera) */
  alvos: THREE.Object3D[];
  /** telas dos MONITORES da biblioteca (InstancedMesh; instanceId = índice em computadoresLocais) — clicar = estudar */
  computadores: THREE.InstancedMesh;
  /** alvos do portal de entrada (anel no chão) */
  portalChao: THREE.Object3D;
  atualizar(dt: number, t: number): void;
  dispose(): void;
  /** a tela da TV do lounge (clicável: o dono escreve o recado pro QG do Andrei) */
  tvLounge: THREE.Mesh | null;
  /** mostra na TV o último recado enviado (null = some) */
  mostrarRecadoNaTV(texto: string | null): void;
  /** altura ATUAL do topo da ilhota k (com a flutuação já aplicada) — o engine pousa/anda nela */
  alturaIlhota(k: number): number;
};

const COLD = 0xbfe8ff, ICE = 0x9fd0ff, FIRE = [0xffe3b0, 0xffb45a, 0xff7a2c];
const ROTULO_CSS = "position:absolute;transform:translate(-50%,-100%);font:800 13px system-ui,sans-serif;letter-spacing:.08em;padding:4px 12px;border-radius:999px;color:#ffe9c2;background:rgba(18,10,8,.65);border:1px solid rgba(255,190,120,.5);box-shadow:0 0 18px rgba(255,160,80,.35);white-space:nowrap;pointer-events:none;display:none;";

export function criarCidade(opts: { low: boolean; starTex: THREE.Texture }): CidadeHandle {
  const { low, starTex } = opts;
  const rm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const raiz = new THREE.Group();
  const ilha = new THREE.Group(); ilha.position.set(CIDADE.centro.x, CIDADE.pisoY, CIDADE.centro.z); raiz.add(ilha);
  const alvos: THREE.Object3D[] = [];
  const add = <T extends THREE.Object3D>(o: T, pai: THREE.Object3D = ilha, alvo = false) => { pai.add(o); if (alvo) alvos.push(o); return o; };
  // vidro SEMPRE transparente simples: o `transmission` do MeshPhysicalMaterial obriga o three a renderizar a cena
  // inteira de novo num alvo extra a cada quadro — era o maior custo de FPS da cena
  const vidro = (p: THREE.MeshPhysicalMaterialParameters, op: number) =>
    new THREE.MeshStandardMaterial({ color: p.color, emissive: p.emissive, emissiveIntensity: p.emissiveIntensity, roughness: p.roughness, metalness: p.metalness, transparent: true, opacity: op, side: p.side ?? THREE.FrontSide });
  const texturas: THREE.Texture[] = [];
  const glow = (a: string, b: string) => { const t = glowTex(a, b); texturas.push(t); return t; };
  const R = CIDADE.bordaR, H = CIDADE.ilhaAltura;

  // luzes: preenchimento frio no interior + fogo rasante quente
  const fria = add(new THREE.PointLight(0x7fe9ff, 2.2, 190)); fria.position.set(0, 22, 0);
  const quente = low ? null : add(new THREE.PointLight(0xff8a3c, 1.6, 110)); quente?.position.set(0, 6, 0);   // no `low`, só a fria

  // ── ilha monumental (montanha invertida) + camada de rocha + estalactites ──
  const rocha = vidro({ color: 0x0b1a30, emissive: 0x10325e, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, transmission: 0.2, thickness: 2, transparent: true, opacity: 0.97 }, 0.97);
  const cone = add(new THREE.Mesh(new THREE.ConeGeometry(R, H, low ? 10 : 14, 1, false), rocha), ilha, true);
  cone.rotation.x = Math.PI; cone.position.y = -H / 2 - 0.65;   // o topo do cone fica sob o piso (sem z-fighting)
  const cone2 = add(new THREE.Mesh(new THREE.ConeGeometry(R * 0.72, H * 0.7, low ? 8 : 12, 1, false), rocha), ilha, true);
  cone2.rotation.x = Math.PI; cone2.position.set(R * 0.18, -H * 0.42, -R * 0.12); cone2.rotation.y = 0.7;
  const cone3 = add(new THREE.Mesh(new THREE.ConeGeometry(R * 0.6, H * 0.62, low ? 7 : 11, 1, false), rocha), ilha, true);
  cone3.rotation.x = Math.PI; cone3.position.set(-R * 0.2, -H * 0.36, R * 0.16); cone3.rotation.y = 1.9;
  // AGULHA: a ponta afiada que desce do ápice (o volume sólido dela está em CIDADE.agulha) + 3 espinhos menores — sem luz
  const AG = CIDADE.agulha, agTopo = -H * 0.7, agFundo = -H - AG.altura, agLen = agTopo - agFundo;
  const agulha = add(new THREE.Mesh(new THREE.ConeGeometry(AG.r * 1.5, agLen, 6, 1, false), rocha), ilha, true);
  agulha.rotation.x = Math.PI; agulha.position.y = agTopo - agLen / 2;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + 0.5, esp = add(new THREE.Mesh(new THREE.ConeGeometry(AG.r * 0.6, agLen * 0.55, 5, 1, false), rocha));
    esp.position.set(Math.cos(a) * AG.r * 1.3, agTopo - agLen * 0.3, Math.sin(a) * AG.r * 1.3);
    esp.rotation.set(Math.PI - Math.sin(a) * 0.22, 0, Math.cos(a) * 0.22);   // abre um pouco pra fora
  }
  // ANDARES DE SERVIDORES no casco: faixas de janelas acesas + um anel de luz por andar (vistos de baixo)
  const DECKS = [0.16, 0.34, 0.52], NJ = low ? 24 : 40;
  const janelas = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.55, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), DECKS.length * NJ));
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color(), incl = Math.atan(R / H);
    DECKS.forEach((f, d) => {
      const y = -H * f - 0.65, r = R * (1 - f) - 0.25;
      for (let i = 0; i < NJ; i++) {
        const a = ((i + d * 0.5) / NJ) * Math.PI * 2;
        p.set(Math.cos(a) * r, y, Math.sin(a) * r); q.setFromEuler(e.set(0, Math.PI / 2 - a, 0)); q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -incl));
        janelas.setMatrixAt(d * NJ + i, m.compose(p, q, s));
        janelas.setColorAt(d * NJ + i, c.setHex(i % 7 === 3 ? 0xffb45a : i % 3 ? 0x66e6ff : 0x9affd0).multiplyScalar(i % 5 === 1 ? 0.35 : 0.9));
      }
      const anelD = add(new THREE.Mesh(new THREE.TorusGeometry(r + 0.2, 0.09, 6, low ? 48 : 96), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })));
      anelD.rotation.x = Math.PI / 2; anelD.position.y = y - 0.55;
    });
    janelas.instanceMatrix.needsUpdate = true; if (janelas.instanceColor) janelas.instanceColor.needsUpdate = true; janelas.computeBoundingSphere(); }
  const NE = low ? 28 : 60, estal = add(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), vidro({ color: 0xcfe9ff, emissive: ICE, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0, transmission: 0.8, thickness: 0.5, transparent: true, opacity: 0.75 }, 0.7), NE));
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < NE; i++) { const a = Math.random() * 6.283, r = 4 + Math.random() * (R - 8), yS = -H * (1 - r / R); const len = (3 + Math.random() * 9) * (H / 34), w = 0.5 + Math.random() * 1.6; p.set(Math.cos(a) * r, yS - len / 2 + 0.5, Math.sin(a) * r); s.set(w, len, w); estal.setMatrixAt(i, m.compose(p, q, s)); }
    estal.instanceMatrix.needsUpdate = true; estal.computeBoundingSphere(); }

  // ── quedas de luz escorrendo pelas bordas ──
  const NQ = low ? 4 : 6, PQ = low ? 16 : 24, QUEDA = H + 50;
  const quedas = Array.from({ length: NQ * PQ }, (_, i) => ({ a: (Math.floor(i / PQ) / NQ) * Math.PI * 2 + 0.2, y: -Math.random() * QUEDA, sp: 6 + Math.random() * 8, j: (Math.random() - 0.5) * 1.2 }));
  const qGeo = new THREE.BufferGeometry(); qGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(quedas.length * 3), 3));
  const qPts = add(new THREE.Points(qGeo, new THREE.PointsMaterial({ size: 0.5, map: starTex, color: 0x9fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }))); qPts.frustumCulled = false;

  // ── piso: disco frio + anéis concêntricos + raios (a "rosa dos ventos" da cidade) ──
  add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, low ? 32 : 64), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.25 })), ilha, true).position.y = -0.3;
  for (const r of [12, 22, 30, 40, 48]) { const anel = add(new THREE.Mesh(new THREE.RingGeometry(r - 0.08, r + 0.08, 96), new THREE.MeshBasicMaterial({ color: COLD, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }))); anel.rotation.x = -Math.PI / 2; anel.position.y = 0.02; }
  { const lin: number[] = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; lin.push(Math.cos(a) * 20, 0.03, Math.sin(a) * 20, Math.cos(a) * 48, 0.03, Math.sin(a) * 48); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COLD, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }))); }

  // ── muralhas de granizo (instanciadas) + 4 torres ──
  const NW = low ? 44 : 64, mur = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vidro({ color: 0xcfe9ff, emissive: ICE, emissiveIntensity: 0.25, roughness: 0.1, metalness: 0, transmission: 0.9, thickness: 0.8, transparent: true, opacity: 0.6, side: THREE.DoubleSide }, 0.45), NW), ilha, true);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < NW; i++) { const a = (i / NW) * Math.PI * 2, h = 4.5 + (i % 3) * 1.8; p.set(Math.cos(a) * CIDADE.muralhaR, h / 2, Math.sin(a) * CIDADE.muralhaR); q.setFromAxisAngle(up, -a); s.set(4, h, 1.3); mur.setMatrixAt(i, m.compose(p, q, s)); }
    mur.instanceMatrix.needsUpdate = true; mur.computeBoundingSphere(); }
  const torreMat = vidro({ color: 0xdff0ff, emissive: ICE, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0, transmission: 0.85, thickness: 0.8, transparent: true, opacity: 0.75 }, 0.7);
  const pontas: THREE.Mesh[] = [];
  const NT = 8, ATR = 22;   // 8 torres na muralha (mais imponente)
  for (let k = 0; k < NT; k++) {
    const a = Math.PI / NT + (k / NT) * Math.PI * 2, x = Math.cos(a) * CIDADE.muralhaR, z = Math.sin(a) * CIDADE.muralhaR;
    const torre = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, ATR, 8), torreMat), ilha, true); torre.position.set(x, ATR / 2, z);
    const ponta = add(new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })));
    ponta.scale.y = 1.8; ponta.position.set(x, ATR + 2.4, z); pontas.push(ponta);
  }

  // ── línguas de fogo na borda + anel de brasa (sem estrobo) ──
  const texFogo = glow("rgba(255,225,170,.95)", "rgba(255,120,40,.3)");
  const NF = low ? 20 : 32, fogos = Array.from({ length: NF }, (_, i) => {
    const a = (i / NF) * Math.PI * 2, s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texFogo, color: FIRE[i % 3]!, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.position.set(Math.cos(a) * (R - 0.8), 2.4, Math.sin(a) * (R - 0.8)); s.scale.set(3.4, 5, 1); return { s, ph: Math.random() * 6.283 };
  });
  const brasa = add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.8, 0.2, 8, low ? 64 : 120), new THREE.MeshBasicMaterial({ color: 0xff7a2c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })));
  brasa.rotation.x = Math.PI / 2; brasa.position.y = 0.4;

  // ── CIDADELA monumental: pilares + anel de coroamento + cúpula estelar + tambor + 2ª cúpula + pináculo + farol ──
  const { cidadela } = CIDADE, CA = cidadela.altura, RC = cidadela.r + 1, ACH = 0.8;   // ACH: a cúpula é um pouco achatada
  const pil = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.95, CA, 8), torreMat, cidadela.pilares), ilha, true);
  { const m = new THREE.Matrix4(); for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; pil.setMatrixAt(i, m.makeTranslation(Math.cos(a) * cidadela.r, CA / 2, Math.sin(a) * cidadela.r)); } pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); }
  const coroaMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x66c8ff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
  for (const [y, rr] of [[CA, 0.6], [0.2, 0.4]] as const) { const t = add(new THREE.Mesh(new THREE.TorusGeometry(cidadela.r, rr, 8, low ? 64 : 128), coroaMat)); t.rotation.x = Math.PI / 2; t.position.y = y; }
  const domoMat = vidro({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }, 0.4);
  const cupula = add(new THREE.Mesh(new THREE.SphereGeometry(RC, low ? 24 : 40, low ? 12 : 20, 0, Math.PI * 2, 0, Math.PI / 2), domoMat));
  cupula.position.y = CA; cupula.scale.y = ACH;
  // nervuras da cúpula (meridianos, um por pilar) — dão estrutura à casca
  { const lin: number[] = [], NS = 10; for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2;
      for (let k = 0; k < NS; k++) { const p0 = (k / NS) * 1.3, p1 = ((k + 1) / NS) * 1.3; lin.push(Math.cos(a) * Math.cos(p0) * RC, CA + Math.sin(p0) * RC * ACH, Math.sin(a) * Math.cos(p0) * RC, Math.cos(a) * Math.cos(p1) * RC, CA + Math.sin(p1) * RC * ACH, Math.sin(a) * Math.cos(p1) * RC); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }))); }
  { const N = low ? 50 : 110, pv = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, ph = Math.random() * Math.PI / 2, r = RC - 0.4; pv[i * 3] = Math.cos(a) * Math.cos(ph) * r; pv[i * 3 + 1] = CA + Math.sin(ph) * r * ACH; pv[i * 3 + 2] = Math.sin(a) * Math.cos(ph) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pv, 3)); add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.3, map: starTex, color: 0xbfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); }
  { const lin: number[] = []; const r = RC - 1; for (let k = 0; k < 18; k++) { let a = Math.random() * 6.283, ph = 0.2; let px = Math.cos(a) * Math.cos(ph) * r, py = CA + Math.sin(ph) * r * ACH, pz = Math.sin(a) * Math.cos(ph) * r;
      for (let st = 0; st < 5; st++) { a += (Math.random() - 0.5) * 0.5; ph = Math.min(1.4, ph + 0.25); const nx = Math.cos(a) * Math.cos(ph) * r, ny = CA + Math.sin(ph) * r * ACH, nz = Math.sin(a) * Math.cos(ph) * r; lin.push(px, py, pz, nx, ny, nz); px = nx; py = ny; pz = nz; } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending }))); }
  // 2º andar: tambor de vidro sobre a cúpula (com costelas de luz) + cúpula menor + pináculo de cristal
  const RT = 8, yT0 = CA + Math.sqrt(RC * RC - RT * RT) * ACH - 1, AT = 8;
  const tambor = add(new THREE.Mesh(new THREE.CylinderGeometry(RT * 0.92, RT, AT, low ? 16 : 24, 1, true), domoMat)); tambor.position.y = yT0 + AT / 2;
  { const N = low ? 8 : 12, g = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, AT, 0.35), coroaMat, N), m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; g.setMatrixAt(i, m.makeTranslation(Math.cos(a) * RT * 0.96, yT0 + AT / 2, Math.sin(a) * RT * 0.96)); }
    g.instanceMatrix.needsUpdate = true; g.computeBoundingSphere(); add(g); }
  const anelT = add(new THREE.Mesh(new THREE.TorusGeometry(RT * 0.92, 0.35, 8, low ? 32 : 64), coroaMat)); anelT.rotation.x = Math.PI / 2; anelT.position.y = yT0 + AT;
  const cupula2 = add(new THREE.Mesh(new THREE.SphereGeometry(RT * 0.92, low ? 16 : 28, low ? 8 : 14, 0, Math.PI * 2, 0, Math.PI / 2), vidro({ color: 0x0a1830, emissive: 0x3a6ab0, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }, 0.5)));
  cupula2.position.y = yT0 + AT; cupula2.scale.y = 0.9;
  const yPin = yT0 + AT + RT * 0.92 * 0.9 - 0.5, LPIN = 22;
  const pinaculo = add(new THREE.Mesh(new THREE.ConeGeometry(1.7, LPIN, 6), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true })));
  pinaculo.position.y = yPin + LPIN / 2;
  const yFarol = yPin + LPIN + 1;
  const farolMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.2, 60, 16, 1, true), farolMat)); feixe.position.y = yFarol + 30;
  const farol = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(220,250,255,1)", "rgba(120,200,255,.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); farol.scale.set(11, 11, 1); farol.position.y = yFarol;

  // BIBLIOTECA rodeando a sala: estantes com livros de luz e, intercalados, MONITORES verticais (clicáveis = estudar)
  const mods = bibliotecaLocais(), estantes = mods.filter((m) => m.tipo === "estante"), monitores = mods.filter((m) => m.tipo === "monitor");
  const { largura } = CIDADE.biblioteca, ALT = 3.4;
  const matMovel = new THREE.MeshStandardMaterial({ color: 0x16203c, roughness: 0.45, metalness: 0.35, emissive: 0x16264f, emissiveIntensity: 0.45 });
  const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), ms = new THREE.Vector3(1, 1, 1), mp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  /** ponto local (lx, ly, lz) de um módulo → posição na ilha */
  const noModulo = (m: { x: number; z: number; rot: number }, lx: number, ly: number, lz: number) => { const c = Math.cos(m.rot), si = Math.sin(m.rot); return mp.set(m.x + lx * c + lz * si, ly, m.z - lx * si + lz * c); };
  // estantes: fundo + laterais + prateleiras (instanciados)
  const fundo = add(new THREE.InstancedMesh(new THREE.BoxGeometry(largura, ALT, 0.12), matMovel, estantes.length), ilha, true);
  const lado = add(new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, ALT, 0.55), matMovel, estantes.length * 2), ilha, true);
  const PRAT = [0.15, 0.95, 1.75, 2.55, 3.35];
  const prat = add(new THREE.InstancedMesh(new THREE.BoxGeometry(largura - 0.1, 0.06, 0.5), matMovel, estantes.length * PRAT.length), ilha, true);
  const LPP = low ? 8 : 13;   // livros por prateleira
  const livros = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), estantes.length * (PRAT.length - 1) * LPP));
  const CORES_LIVRO = [0x66e6ff, 0xb98cff, 0x9affd0, 0xffd36b, 0x7fb4ff, 0xff9ad5].map((h) => new THREE.Color(h).multiplyScalar(0.75));
  { let iL = 0;
    estantes.forEach((m, i) => {
      mq.setFromAxisAngle(up, m.rot);
      fundo.setMatrixAt(i, mx.compose(noModulo(m, 0, ALT / 2, -0.22), mq, ms));
      lado.setMatrixAt(i * 2, mx.compose(noModulo(m, -largura / 2, ALT / 2, 0), mq, ms)); lado.setMatrixAt(i * 2 + 1, mx.compose(noModulo(m, largura / 2, ALT / 2, 0), mq, ms));
      PRAT.forEach((y, k) => prat.setMatrixAt(i * PRAT.length + k, mx.compose(noModulo(m, 0, y, 0), mq, ms)));
      for (let k = 0; k < PRAT.length - 1; k++) {
        let x = -largura / 2 + 0.18;
        for (let j = 0; j < LPP; j++) {
          const w = 0.12 + Math.random() * 0.1, h = 0.48 + Math.random() * 0.22, inclina = j === LPP - 1 ? 0.25 : 0;
          const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), inclina).premultiply(mq);
          livros.setMatrixAt(iL, mx.compose(noModulo(m, x + w / 2, PRAT[k]! + 0.03 + h / 2, 0.02), q2, new THREE.Vector3(w, h, 0.34)));
          livros.setColorAt(iL, CORES_LIVRO[(i * 7 + k * 3 + j) % CORES_LIVRO.length]!); iL++;
          x += w + 0.015; if (x > largura / 2 - 0.3) break;
        }
      }
    });
    livros.count = iL;
    for (const im of [fundo, lado, prat, livros]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    if (livros.instanceColor) livros.instanceColor.needsUpdate = true; }
  // monitores verticais: moldura + tela com "página" de luz (a tela é o mesh clicável)
  const pagina = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 256; const g = c.getContext("2d")!;
    g.fillStyle = "#06223a"; g.fillRect(0, 0, 128, 256); g.fillStyle = "#66e6ff"; g.fillRect(10, 12, 108, 8);
    g.fillStyle = "rgba(143,232,255,.75)"; for (let i = 0; i < 16; i++) g.fillRect(12, 34 + i * 13, 50 + ((i * 37) % 54), 5);
    g.strokeStyle = "#9fe8ff"; g.lineWidth = 3; g.strokeRect(2, 2, 124, 252);
    const t = new THREE.CanvasTexture(c); texturas.push(t); return t; })();
  const molduraMon = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1.95, 3.1, 0.22), matMovel, monitores.length), ilha, true);
  const telas = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(1.65, 2.75), new THREE.MeshBasicMaterial({ map: pagina, transparent: true, opacity: 0.92, side: THREE.DoubleSide }), monitores.length), ilha, true);
  const brilhoMon = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(2.3, 3.4), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), monitores.length));
  monitores.forEach((m, i) => {
    mq.setFromAxisAngle(up, m.rot);
    molduraMon.setMatrixAt(i, mx.compose(noModulo(m, 0, 1.75, -0.1), mq, ms));
    telas.setMatrixAt(i, mx.compose(noModulo(m, 0, 1.75, 0.02), mq, ms));
    brilhoMon.setMatrixAt(i, mx.compose(noModulo(m, 0, 1.75, -0.13), mq, ms));
  });
  for (const im of [molduraMon, telas, brilhoMon]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  // ── SALAS DE SERVIDORES: 4 alas em arco (racks com LEDs + parede de fundo + teto de vidro) e dados subindo pra cúpula ──
  const SV = CIDADE.servidores, racks = servidoresLocais();
  const rack = add(new THREE.InstancedMesh(new THREE.BoxGeometry(SV.largura, SV.alt, SV.prof), new THREE.MeshStandardMaterial({ color: 0x0b1322, roughness: 0.4, metalness: 0.6, emissive: 0x0d1a33, emissiveIntensity: 0.5 }), racks.length), ilha, true);
  const ledTex = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 256; const g = c.getContext("2d")!;
    g.fillStyle = "#03070f"; g.fillRect(0, 0, 64, 256);
    for (let u = 0; u < 16; u++) { const y = u * 16; g.fillStyle = "rgba(102,230,255,.18)"; g.fillRect(4, y + 13, 56, 1);
      for (let k = 0; k < 6; k++) { const v = (u * 7 + k * 13) % 11; if (v > 6) continue; g.fillStyle = v < 3 ? "#66e6ff" : v < 5 ? "#9affd0" : "#ffb45a"; g.fillRect(8 + k * 8, y + 5, 4, 4); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; texturas.push(t); return t; })();
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const leds = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(SV.largura * 0.84, SV.alt * 0.9), ledMat, racks.length));
  const topoRack = add(new THREE.InstancedMesh(new THREE.BoxGeometry(SV.largura, 0.08, SV.prof), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }), racks.length));
  racks.forEach((r, i) => {
    mq.setFromAxisAngle(up, r.rot);
    rack.setMatrixAt(i, mx.compose(noModulo(r, 0, SV.alt / 2, 0), mq, ms));
    leds.setMatrixAt(i, mx.compose(noModulo(r, 0, SV.alt / 2, SV.prof / 2 + 0.01), mq, ms));
    topoRack.setMatrixAt(i, mx.compose(noModulo(r, 0, SV.alt + 0.04, 0), mq, ms));
  });
  for (const im of [rack, leds, topoRack]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
  const parede = vidro({ color: 0x0a1830, emissive: 0x1f4a8a, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.3, transmission: 0.3, thickness: 1, transparent: true, opacity: 0.4, side: THREE.DoubleSide }, 0.38);
  const tetoMat = new THREE.MeshBasicMaterial({ color: 0x66c8ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const centrosAla: number[] = [];
  for (let i0 = 0; i0 < SV.n; i0 += SV.vaoCada) {
    const a0 = ((i0 + 0.55) / SV.n) * Math.PI * 2, a1 = ((i0 + SV.vaoCada - 0.55) / SV.n) * Math.PI * 2, rf = SV.r + SV.prof / 2 + 0.15;
    centrosAla.push((a0 + a1) / 2);
    // CylinderGeometry: x = r·sen θ, z = r·cos θ → o ângulo a (cos a, sen a) é θ = π/2 − a
    const fundoAla = add(new THREE.Mesh(new THREE.CylinderGeometry(rf, rf, SV.alt + 0.8, 12, 1, true, Math.PI / 2 - a1, a1 - a0), parede)); fundoAla.position.y = (SV.alt + 0.8) / 2;
    const teto = add(new THREE.Mesh(new THREE.RingGeometry(SV.r - 2.6, rf, 16, 1, a0, a1 - a0), tetoMat)); teto.rotation.x = Math.PI / 2; teto.position.y = SV.alt + 0.8;
    const borda: number[] = []; for (let k = 0; k < 12; k++) { const b0 = a0 + ((a1 - a0) * k) / 12, b1 = a0 + ((a1 - a0) * (k + 1)) / 12; for (const rr of [SV.r - 2.6, rf]) borda.push(Math.cos(b0) * rr, SV.alt + 0.8, Math.sin(b0) * rr, Math.cos(b1) * rr, SV.alt + 0.8, Math.sin(b1) * rr); }
    const gb = new THREE.BufferGeometry(); gb.setAttribute("position", new THREE.BufferAttribute(new Float32Array(borda), 3));
    add(new THREE.LineSegments(gb, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })));
  }
  // fluxo de dados: partículas subindo de cada ala até o alto da cúpula
  const ND = low ? 48 : 96, yDados0 = SV.alt + 1, yDados1 = CA + RC * ACH - 2;
  const dados = Array.from({ length: ND }, (_, i) => ({ a: centrosAla[i % centrosAla.length]! + (Math.random() - 0.5) * 0.5, r: SV.r - 0.5 + Math.random() * 1.5, y: yDados0 + Math.random() * (yDados1 - yDados0), sp: 2 + Math.random() * 3 }));
  const dGeo = new THREE.BufferGeometry(); dGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ND * 3), 3));
  const dPts = add(new THREE.Points(dGeo, new THREE.PointsMaterial({ size: 0.28, map: starTex, color: 0x9affd0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }))); dPts.frustumCulled = false;

  add(new THREE.Mesh(new THREE.CylinderGeometry(CIDADE.mesaHolo.r, CIDADE.mesaHolo.r * 1.1, 1, 24), new THREE.MeshStandardMaterial({ color: 0x10213e, emissive: 0x2b6bd0, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })), ilha, true).position.y = 0.5;
  const NG = low ? 160 : 280, gp = new Float32Array(NG * 3);
  for (let i = 0; i < NG; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, r = 1.6, s = Math.sqrt(1 - u * u); gp[i * 3] = s * Math.cos(th) * r; gp[i * 3 + 1] = 3 + u * r; gp[i * 3 + 2] = s * Math.sin(th) * r; }
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  const globo = add(new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.09, map: starTex, color: 0x8fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  // ── HANGAR grande: plataforma + anéis/setas de pouso + pilones de luz (sequência guia) + halo ligando os pilones ──
  const hg = CIDADE.hangar;
  add(new THREE.Mesh(new THREE.CylinderGeometry(hg.r, hg.r + 0.5, 0.3, 64), new THREE.MeshStandardMaterial({ color: 0x10213e, emissive: 0x2b6bd0, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.4 })), ilha, true).position.set(hg.x, 0.15, hg.z);
  const anelMat = new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const [a, b] of [[hg.r - 0.6, hg.r - 0.3], [hg.r * 0.55 - 0.12, hg.r * 0.55 + 0.12], [1.2, 1.5]] as const) { const an = add(new THREE.Mesh(new THREE.RingGeometry(a, b, 96), anelMat)); an.rotation.x = -Math.PI / 2; an.position.set(hg.x, 0.32, hg.z); }
  { const lin: number[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r0 = hg.r * 0.62, r1 = hg.r * 0.86, w = 0.12;
      lin.push(hg.x + Math.cos(a - w) * r1, 0.33, hg.z + Math.sin(a - w) * r1, hg.x + Math.cos(a) * r0, 0.33, hg.z + Math.sin(a) * r0, hg.x + Math.cos(a) * r0, 0.33, hg.z + Math.sin(a) * r0, hg.x + Math.cos(a + w) * r1, 0.33, hg.z + Math.sin(a + w) * r1); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.8 }))); }
  const AP = 6.5, pilonMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x2b6bd0, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.5 });
  const texPilon = glow("rgba(255,230,170,1)", "rgba(255,180,90,.35)");
  const luzesPilon = pilonesDoHangar().map((p) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(hg.pilonR * 0.75, hg.pilonR * 1.2, AP, 8), pilonMat), ilha, true).position.set(p.x, AP / 2, p.z);
    const l = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texPilon, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); l.scale.set(2.4, 2.4, 1); l.position.set(p.x, AP + 0.3, p.z); return l;
  });
  const halo = add(new THREE.Mesh(new THREE.TorusGeometry(hg.r + hg.pilonR + 0.3, 0.07, 6, 128), new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })));
  halo.rotation.x = Math.PI / 2; halo.position.set(hg.x, AP, hg.z);

  // ── SALAS (lounge) ──
  const salas = criarSalas(ilha, { low, texturas, paredeMat: vidro({ color: 0x0a1830, emissive: 0x2a3a70, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.3, thickness: 1, transparent: true, opacity: 0.32, side: THREE.DoubleSide }, 0.3) });
  alvos.push(...salas.alvos);

  // ── ESTACIONAMENTO de motos voadoras (aberto a todos; as motos são do engine) — o piso entra no clique de andar ──
  const estac = criarPisoEstacionamento({ low, parado: rm });
  estac.group.position.set(LOTE_ZAEON_LOCAL.x, 0, LOTE_ZAEON_LOCAL.z); estac.group.rotation.y = LOTE_ZAEON_LOCAL.rot; add(estac.group, ilha, true);

  // ── portal de volta (mini disco de acreção, gira devagar) ──
  const pv = CIDADE.portalVolta;
  const portal = add(new THREE.Group()); portal.position.set(pv.x, 0, pv.z);
  add(new THREE.Mesh(new THREE.CylinderGeometry(pv.r + 0.6, pv.r + 0.8, 0.25, 32), new THREE.MeshStandardMaterial({ color: 0x14203a, emissive: 0x1b2b55, emissiveIntensity: 0.5 })), portal, true);
  const aro = add(new THREE.Mesh(new THREE.TorusGeometry(pv.r, 0.18, 10, 64), new THREE.MeshBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending })), portal);
  aro.position.y = pv.r + 0.3;
  const vort = add(new THREE.Mesh(new THREE.CircleGeometry(pv.r - 0.1, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, side: THREE.DoubleSide })), portal);
  vort.position.y = pv.r + 0.3;
  const discoP = add(new THREE.Mesh(new THREE.RingGeometry(pv.r, pv.r + 1.2, 64), new THREE.MeshBasicMaterial({ color: 0xff7a2c, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })), portal);
  discoP.position.y = pv.r + 0.3; discoP.rotation.x = 0.35;

  // ── querubins orbitando a cidadela ──
  const CN = low ? 40 : 90, cher = Array.from({ length: CN }, () => ({ a: Math.random() * 6.283, r: 21 + Math.random() * 30, y: 4 + Math.random() * 26, sp: 0.05 + Math.random() * 0.15 }));
  const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CN * 3), 3));
  const cPts = add(new THREE.Points(cGeo, new THREE.PointsMaterial({ size: 0.3, map: starTex, color: 0xeaf4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); cPts.frustumCulled = false;

  // ── ilhotas flutuantes em volta (montanhas invertidas + cristais na BORDA), cada uma com sua flutuação ──
  //    Layout FIXO em lib/cyber/ceu.ts (ILHOTAS) — o mesmo da colisão: dá pra pousar no topo e andar nele.
  //    Todas aparecem (também no celular): a colisão tem que ser a mesma pra todo mundo.
  const ilhotas: { g: THREE.Group; y0: number; ph: number }[] = [];
  const cristalMat = new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x66e6ff, emissiveIntensity: 1.1, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
  ILHOTAS.forEach((il, k) => {
    const rr = il.r, y0 = CIDADE.pisoY + il.dy;
    const g = new THREE.Group(); g.position.set(CIDADE.centro.x + il.x, y0, CIDADE.centro.z + il.z); raiz.add(g);
    const c = new THREE.Mesh(new THREE.ConeGeometry(rr, rr * 1.9, low ? 8 : 12), rocha); c.rotation.x = Math.PI; c.position.y = -rr * 0.95 - 0.4; g.add(c);
    // piso: a face de CIMA fica exatamente na altura do grupo (= a altura da colisão)
    const topo = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.4, low ? 8 : 16), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.3 })); topo.position.y = -0.2; g.add(topo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.1, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: COLD, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })); aro.rotation.x = Math.PI / 2; aro.position.y = 0.02; g.add(aro);
    for (let j = 0; j < 5; j++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + ((j * 37 + k * 11) % 10) / 16), cristalMat); cr.scale.y = 2 + ((j * 13 + k) % 10) / 7; const aa = (j / 5) * 6.283 + k, d = rr * 0.86; cr.position.set(Math.cos(aa) * d, 1.1, Math.sin(aa) * d); g.add(cr); }
    ilhotas.push({ g, y0, ph: il.fase });
  });

  // ── PORTAL DE ENTRADA no chão, embaixo do buraco negro ──
  const pe = CIDADE.portalEntrada;
  const portalChao = new THREE.Group(); portalChao.position.set(pe.x, 0.05, pe.z); raiz.add(portalChao);
  const peAnel = new THREE.Mesh(new THREE.RingGeometry(pe.r - 0.6, pe.r, 96), new THREE.MeshBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  peAnel.rotation.x = -Math.PI / 2; portalChao.add(peAnel);
  const peDisco = new THREE.Mesh(new THREE.CircleGeometry(pe.r - 0.6, 64), new THREE.MeshBasicMaterial({ color: 0x05030a, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  peDisco.rotation.x = -Math.PI / 2; peDisco.position.y = 0.01; portalChao.add(peDisco); alvos.push(peDisco);
  const NS = low ? 50 : 90, sw = Array.from({ length: NS }, () => ({ a: Math.random() * 6.283, r: Math.random() * (pe.r - 0.8), y: Math.random() * 12 }));
  const swGeo = new THREE.BufferGeometry(); swGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  const swPts = new THREE.Points(swGeo, new THREE.PointsMaterial({ size: 0.35, map: starTex, color: 0xffd9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); swPts.frustumCulled = false; portalChao.add(swPts);

  const rotulo = document.createElement("div"); rotulo.style.cssText = ROTULO_CSS; rotulo.textContent = "Zaeon";
  const fogoAmp = rm ? 0.12 : 1, vel = rm ? 0.2 : 1;

  return {
    group: raiz, ilha, rotulo, alvos, computadores: telas, portalChao: peDisco, tvLounge: salas.tv, alturaIlhota: (k: number) => ilhotas[k]?.g.position.y ?? CIDADE.pisoY, mostrarRecadoNaTV: (t: string | null) => salas.mostrarRecado(t),
    atualizar(dt, t) {
      ilha.position.y = CIDADE.pisoY + Math.sin(t * 0.3) * 0.25 * vel;
      for (const f of fogos) { const p = 0.72 + 0.28 * Math.sin(t * 1.8 + f.ph) * fogoAmp; f.s.scale.set(3.4 * (0.9 + p * 0.25), 5 * (0.8 + p * 0.4), 1); (f.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.3 * p; }
      if (quente) quente.intensity = 1.4 + 0.3 * Math.sin(t * 1.6) * fogoAmp;
      (brasa.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 1.4) * fogoAmp;
      pontas.forEach((p, i) => { (p.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 1.2 + i); p.rotation.y += dt * 0.4 * vel; });
      farol.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.1);
      salas.atualizar(dt, t);
      estac.atualizar(t);
      luzesPilon.forEach((l, i) => { const k = (t * 1.2 - i / luzesPilon.length) % 1; l.material.opacity = 0.45 + 0.55 * Math.max(0, 1 - Math.abs(k - 0.15) * 4) * vel + 0.2 * (1 - vel); });   // sequência guia (lenta)
      ledTex.offset.y = Math.floor(t * 1.5 * vel) / 16;   // os LEDs "andam" um U por vez (devagar, sem estrobo)
      ledMat.opacity = 0.8 + 0.15 * Math.sin(t * 0.7);
      globo.rotation.y += dt * 0.25 * vel;
      aro.rotation.z += dt * 0.3 * vel; discoP.rotation.z += dt * 0.5 * vel;
      // quedas de luz
      { const a = qGeo.attributes.position!.array as Float32Array;
        quedas.forEach((q, i) => { q.y -= q.sp * dt * vel; if (q.y < -QUEDA) q.y = 0; const r = R - 0.5 + Math.min(4, -q.y * 0.05); a[i * 3] = Math.cos(q.a) * r + q.j; a[i * 3 + 1] = q.y; a[i * 3 + 2] = Math.sin(q.a) * r; });
        qGeo.attributes.position!.needsUpdate = true; }
      // dados subindo das salas de servidores
      { const a = dGeo.attributes.position!.array as Float32Array;
        dados.forEach((d, i) => { d.y += d.sp * dt * vel; if (d.y > yDados1) d.y = yDados0; const k = (d.y - yDados0) / (yDados1 - yDados0), r = d.r * (1 - k * 0.85); a[i * 3] = Math.cos(d.a) * r; a[i * 3 + 1] = d.y; a[i * 3 + 2] = Math.sin(d.a) * r; });
        dGeo.attributes.position!.needsUpdate = true; }
      // querubins
      { const a = cGeo.attributes.position!.array as Float32Array;
        cher.forEach((c, i) => { c.a += dt * c.sp * vel; a[i * 3] = Math.cos(c.a) * c.r; a[i * 3 + 1] = c.y + Math.sin(t * 0.5 + i) * 0.3; a[i * 3 + 2] = Math.sin(c.a) * c.r; });
        cGeo.attributes.position!.needsUpdate = true; }
      // vórtice do portal de entrada (sobe em espiral, devagar)
      { const a = swGeo.attributes.position!.array as Float32Array;
        sw.forEach((s, i) => { s.y += dt * 1.6 * vel; s.a += dt * 0.6 * vel; if (s.y > 14) { s.y = 0; s.r = Math.random() * (pe.r - 0.8); } const r = s.r * (1 - s.y / 18); a[i * 3] = Math.cos(s.a) * r; a[i * 3 + 1] = s.y; a[i * 3 + 2] = Math.sin(s.a) * r; });
        swGeo.attributes.position!.needsUpdate = true; }
      ilhotas.forEach((il, i) => { il.g.position.y = il.y0 + Math.sin(t * 0.25 + il.ph) * BOIA_ILHOTA * vel; il.g.rotation.y += dt * 0.01 * (i % 2 ? 1 : -1) * vel; });
    },
    dispose() { rotulo.remove(); liberar(raiz, texturas); },
  };
}
