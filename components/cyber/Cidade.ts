/**
 * Cidade — a ZAEON, a ilha no céu (a base do dono), acima do buraco negro. Mesmo idioma da Zaeon do chão (cristal, gelo,
 * granizo, fogo contido, querubins, contraste frio×quente), maior e mais rica, no conceito das cidades flutuantes:
 *  - ilha monumental de cristal (montanha INVERTIDA: larga em cima, ápice embaixo) com estalactites, quedas de luz,
 *    andares de servidores iluminados no casco e uma AGULHA afiada descendo do ápice (só rocha: sem luz na ponta);
 *  - ilhotas flutuantes em volta, com aglomerados de cristal;
 *  - muralhas de granizo + 4 torres com pontas luminosas; línguas de fogo na borda (cintilar lento, sem estrobo);
 *  - a ZAEON MEGA (2,5× mais larga): CAPELA monumental (pilares + cúpula estelar + tambor + 2ª cúpula + pináculo)
 *    vazia por dentro — só o GLOBO de luz no centro (os livros e os servidores saíram);
 *  - a ESCADA DE ENERGIA (faixa de luz fluindo, corrimão de vidro; leva quem pisa nela) da borda oeste até a PLATAFORMA DO
 *    LOUNGE, na altura do início da ponta da capela — o clube em cima dela é components/cyber/Salas.ts;
 *  - portal de volta (mini disco de acreção); farol no topo (a nave-QG fica atracada PAIRANDO ao lado, sem hangar);
 *  - no CHÃO, embaixo do buraco negro: o anel de entrada (o portal).
 * Layout em lib/cyber/ceu.ts (o mesmo que a colisão usa). `low` reduz partículas/segmentos/ilhotas;
 * `prefers-reduced-motion` deixa fogo/vórtices quase parados. dispose() completo.
 */
import * as THREE from "three";
import { ALTURA_LOUNGE, BOIA_ILHOTA, CAPELA, CIDADE, ESCADA_LOUNGE, ILHOTAS, computadoresLocais } from "@/lib/cyber/ceu";
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
  /** telas dos DESKTOPS da capela (InstancedMesh; instanceId = índice em computadoresLocais) — clicar = estudar */
  computadores: THREE.InstancedMesh;
  /** alvos do portal de entrada (anel no chão) */
  portalChao: THREE.Object3D;
  atualizar(dt: number, t: number): void;
  dispose(): void;
  /** a tela da TV do lounge (clicável: o dono escreve o recado pro QG do Andrei) */
  tvLounge: THREE.Mesh | null;
  /** o som do lounge: as caixas (de onde a música sai), o toca-discos (onde se abre o player) e o "está tocando" */
  caixasLounge: THREE.Object3D[]; tocaDiscos: THREE.Object3D | null; somTocando(on: boolean, nivel?: number): void;
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
  const fria = add(new THREE.PointLight(0x7fe9ff, 2.2, 480)); fria.position.set(0, 55, 0);
  const quente = low ? null : add(new THREE.PointLight(0xff8a3c, 1.6, 280)); quente?.position.set(0, 15, 0);
  /** o setor da escada do lounge (a oeste): a muralha, as torres e o fogo da borda abrem ali */
  const naAberturaDaEscada = (x: number, z: number) => x < 0 && Math.abs(z) < ESCADA_LOUNGE.meia + 5;   // no `low`, só a fria

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
  const DECKS = [0.16, 0.34, 0.52], NJ = low ? 48 : 90;
  const janelas = add(new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 1.1, 1.8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), DECKS.length * NJ));
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
  const NE = low ? 50 : 110, estal = add(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), vidro({ color: 0xcfe9ff, emissive: ICE, emissiveIntensity: 0.4, roughness: 0.1, metalness: 0, transmission: 0.8, thickness: 0.5, transparent: true, opacity: 0.75 }, 0.7), NE));
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < NE; i++) { const a = Math.random() * 6.283, r = 4 + Math.random() * (R - 8), yS = -H * (1 - r / R); const len = (3 + Math.random() * 9) * (H / 34), w = 0.5 + Math.random() * 1.6; p.set(Math.cos(a) * r, yS - len / 2 + 0.5, Math.sin(a) * r); s.set(w, len, w); estal.setMatrixAt(i, m.compose(p, q, s)); }
    estal.instanceMatrix.needsUpdate = true; estal.computeBoundingSphere(); }

  // ── quedas de luz escorrendo pelas bordas ──
  const NQ = low ? 4 : 6, PQ = low ? 16 : 24, QUEDA = H + 50;
  const quedas = Array.from({ length: NQ * PQ }, (_, i) => ({ a: (Math.floor(i / PQ) / NQ) * Math.PI * 2 + 0.2, y: -Math.random() * QUEDA, sp: 6 + Math.random() * 8, j: (Math.random() - 0.5) * 1.2 }));
  const qGeo = new THREE.BufferGeometry(); qGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(quedas.length * 3), 3));
  const qPts = add(new THREE.Points(qGeo, new THREE.PointsMaterial({ size: 0.5, map: starTex, color: 0x9fe8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }))); qPts.frustumCulled = false;

  // ── piso: disco frio + anéis concêntricos + raios (a "rosa dos ventos" da cidade) ──
  add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, low ? 64 : 128), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.25 })), ilha, true).position.y = -0.3;
  // as LINHAS do piso: um padrão REGULAR na escala de gente (antes: 5 anéis com espaços desiguais e 16 raios de 126 m
  // — na Zaeon mega aquilo ficava torto e enorme): anéis finos a cada 18 m da capela até a borda (um mais aceso a cada 3)
  // e 48 raios, também a cada 3 um mais forte
  { const r0 = CIDADE.cidadela.r + 12, passo = 18, aneis: number[] = [], fortes: number[] = [];
    for (let r = r0, k = 0; r < R - 4; r += passo, k++) (k % 3 === 0 ? fortes : aneis).push(r);
    const anelGeo = (lista: number[]) => { const pts: number[] = [], N = low ? 96 : 192; for (const r of lista) for (let i = 0; i < N; i++) { const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2; pts.push(Math.cos(a0) * r, 0.03, Math.sin(a0) * r, Math.cos(a1) * r, 0.03, Math.sin(a1) * r); } const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3)); return g; };
    add(new THREE.LineSegments(anelGeo(aneis), new THREE.LineBasicMaterial({ color: COLD, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending })));
    add(new THREE.LineSegments(anelGeo(fortes), new THREE.LineBasicMaterial({ color: COLD, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending })));
    const raios: number[] = [], raiosF: number[] = [], NR = 48;
    for (let i = 0; i < NR; i++) { const a = (i / NR) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); (i % 3 === 0 ? raiosF : raios).push(c * r0, 0.03, s * r0, c * (R - 4), 0.03, s * (R - 4)); }
    for (const [l, op] of [[raios, 0.1], [raiosF, 0.22]] as const) { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(l), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: COLD, transparent: true, opacity: op, blending: THREE.AdditiveBlending }))); } }

  // ── muralhas de granizo (instanciadas) + 4 torres ──
  const NW = Math.round((low ? 44 : 64) * CIDADE.muralhaR / 53), mur = add(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), vidro({ color: 0xcfe9ff, emissive: ICE, emissiveIntensity: 0.25, roughness: 0.1, metalness: 0, transmission: 0.9, thickness: 0.8, transparent: true, opacity: 0.6, side: THREE.DoubleSide }, 0.45), NW), ilha, true);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let n = 0;
    for (let i = 0; i < NW; i++) { const a = (i / NW) * Math.PI * 2, h = 6.5 + (i % 3) * 2.6; p.set(Math.cos(a) * CIDADE.muralhaR, h / 2, Math.sin(a) * CIDADE.muralhaR); if (naAberturaDaEscada(p.x, p.z)) continue; q.setFromAxisAngle(up, -a); s.set(4, h, 1.6); mur.setMatrixAt(n++, m.compose(p, q, s)); }
    mur.count = n; mur.instanceMatrix.needsUpdate = true; mur.computeBoundingSphere(); }
  const torreMat = vidro({ color: 0xdff0ff, emissive: ICE, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0, transmission: 0.85, thickness: 0.8, transparent: true, opacity: 0.75 }, 0.7);
  const pontas: THREE.Mesh[] = [];
  const NT = 16, ATR = 48;   // 16 torres na muralha (a Zaeon mega)
  for (let k = 0; k < NT; k++) {
    const a = Math.PI / NT + (k / NT) * Math.PI * 2, x = Math.cos(a) * CIDADE.muralhaR, z = Math.sin(a) * CIDADE.muralhaR;
    const torre = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, ATR, 8), torreMat), ilha, true); torre.position.set(x, ATR / 2, z);
    const ponta = add(new THREE.Mesh(new THREE.OctahedronGeometry(2.6), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })));
    ponta.scale.y = 1.8; ponta.position.set(x, ATR + 3.9, z); pontas.push(ponta);
  }

  // ── línguas de fogo na borda + anel de brasa (sem estrobo) ──
  const texFogo = glow("rgba(255,225,170,.95)", "rgba(255,120,40,.3)");
  const NF = low ? 36 : 64, fogos = Array.from({ length: NF }, (_, i) => {
    const a = (i / NF) * Math.PI * 2, s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texFogo, color: FIRE[i % 3]!, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.position.set(Math.cos(a) * (R - 0.8), 2.4, Math.sin(a) * (R - 0.8)); s.scale.set(3.4, 5, 1); if (naAberturaDaEscada(s.position.x, s.position.z)) s.visible = false;
    return { s, ph: Math.random() * 6.283 };
  });
  const brasa = add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.8, 0.2, 8, low ? 64 : 120), new THREE.MeshBasicMaterial({ color: 0xff7a2c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending })));
  brasa.rotation.x = Math.PI / 2; brasa.position.y = 0.4;

  // ── CAPELA monumental (a cidadela, 3× maior): pilares + coroamento + cúpula estelar + tambor + 2ª cúpula + PONTA +
  //    farol. Por dentro, vazia: só o GLOBO de luz no centro (os livros e os servidores saíram) ──
  const { cidadela } = CIDADE, CA = cidadela.altura, RC = cidadela.r + 1, ACH = CAPELA.achata;
  const pil = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(1.9, 2.4, CA, 10), torreMat, cidadela.pilares), ilha, true);
  { const m = new THREE.Matrix4(); for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; pil.setMatrixAt(i, m.makeTranslation(Math.cos(a) * cidadela.r, CA / 2, Math.sin(a) * cidadela.r)); } pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); }
  const coroaMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x66c8ff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
  for (const [y, rr] of [[CA, 1.4], [0.4, 0.9]] as const) { const t = add(new THREE.Mesh(new THREE.TorusGeometry(cidadela.r, rr, 8, low ? 96 : 192), coroaMat)); t.rotation.x = Math.PI / 2; t.position.y = y; }
  const domoMat = vidro({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }, 0.4);
  const cupula = add(new THREE.Mesh(new THREE.SphereGeometry(RC, low ? 32 : 56, low ? 14 : 24, 0, Math.PI * 2, 0, Math.PI / 2), domoMat));
  cupula.position.y = CA; cupula.scale.y = ACH;
  // nervuras da cúpula (meridianos, um por pilar) — dão estrutura à casca
  { const lin: number[] = [], NS = 12; for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2;
      for (let k = 0; k < NS; k++) { const p0 = (k / NS) * 1.3, p1 = ((k + 1) / NS) * 1.3; lin.push(Math.cos(a) * Math.cos(p0) * RC, CA + Math.sin(p0) * RC * ACH, Math.sin(a) * Math.cos(p0) * RC, Math.cos(a) * Math.cos(p1) * RC, CA + Math.sin(p1) * RC * ACH, Math.sin(a) * Math.cos(p1) * RC); } }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lin), 3)); add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending }))); }
  { const N = low ? 120 : 260, pv = new Float32Array(N * 3); for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, ph = Math.random() * Math.PI / 2, r = RC - 0.8; pv[i * 3] = Math.cos(a) * Math.cos(ph) * r; pv[i * 3 + 1] = CA + Math.sin(ph) * r * ACH; pv[i * 3 + 2] = Math.sin(a) * Math.cos(ph) * r; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pv, 3)); add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.7, map: starTex, color: 0xbfe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); }
  // 2º andar: tambor de vidro sobre a cúpula (com costelas de luz) + cúpula menor + PONTA de cristal (o lounge flutua
  // na altura em que ela começa — lib/cyber/ceu `inicioDaPonta`)
  const RT = CAPELA.tamborR, yT0 = CA + Math.sqrt(RC * RC - RT * RT) * ACH - 1, AT = CAPELA.tamborAlt;
  const tambor = add(new THREE.Mesh(new THREE.CylinderGeometry(RT * 0.92, RT, AT, low ? 20 : 32, 1, true), domoMat)); tambor.position.y = yT0 + AT / 2;
  { const N = low ? 12 : 18, g = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, AT, 0.8), coroaMat, N), m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; g.setMatrixAt(i, m.makeTranslation(Math.cos(a) * RT * 0.96, yT0 + AT / 2, Math.sin(a) * RT * 0.96)); }
    g.instanceMatrix.needsUpdate = true; g.computeBoundingSphere(); add(g); }
  const anelT = add(new THREE.Mesh(new THREE.TorusGeometry(RT * 0.92, 0.8, 8, low ? 48 : 96), coroaMat)); anelT.rotation.x = Math.PI / 2; anelT.position.y = yT0 + AT;
  const cupula2 = add(new THREE.Mesh(new THREE.SphereGeometry(RT * 0.92, low ? 20 : 36, low ? 10 : 18, 0, Math.PI * 2, 0, Math.PI / 2), vidro({ color: 0x0a1830, emissive: 0x3a6ab0, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.3, transmission: 0.4, thickness: 1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }, 0.5)));
  cupula2.position.y = yT0 + AT; cupula2.scale.y = 0.9;
  const yPin = yT0 + AT + RT * 0.92 * 0.9 - 0.5, LPIN = CAPELA.pontaLen;
  const pinaculo = add(new THREE.Mesh(new THREE.ConeGeometry(4, LPIN, 6), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true })));
  pinaculo.position.y = yPin + LPIN / 2;
  const yFarol = yPin + LPIN + 2;
  const farolMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const feixe = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 4.5, 120, 16, 1, true), farolMat)); feixe.position.y = yFarol + 60;
  const farol = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(220,250,255,1)", "rgba(120,200,255,.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); farol.scale.set(22, 22, 1); farol.position.y = yFarol;

  // o GLOBO no centro da capela: mesa redonda + esfera de pontos de luz girando + um anel em volta
  add(new THREE.Mesh(new THREE.CylinderGeometry(CIDADE.mesaHolo.r, CIDADE.mesaHolo.r * 1.1, 2.2, 32), new THREE.MeshStandardMaterial({ color: 0x10213e, emissive: 0x2b6bd0, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })), ilha, true).position.y = 1.1;
  const RG = CIDADE.mesaHolo.r * 0.75, YG = 2.2 + RG + 1.5, NG = low ? 420 : 900, gp = new Float32Array(NG * 3);
  for (let i = 0; i < NG; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u); gp[i * 3] = s * Math.cos(th) * RG; gp[i * 3 + 1] = YG + u * RG; gp[i * 3 + 2] = s * Math.sin(th) * RG; }
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  const globo = add(new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.22, map: starTex, color: 0x8fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const aroGlobo = add(new THREE.Mesh(new THREE.TorusGeometry(RG * 1.35, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  aroGlobo.position.y = YG; aroGlobo.rotation.x = Math.PI / 2 - 0.35;

  // os DESKTOPS (monitores verticais com a "página" de luz; a tela é o mesh clicável) em anel, virados pro globo
  const pagina = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 256; const g = c.getContext("2d")!;
    g.fillStyle = "#06223a"; g.fillRect(0, 0, 128, 256); g.fillStyle = "#66e6ff"; g.fillRect(10, 12, 108, 8);
    g.fillStyle = "rgba(143,232,255,.75)"; for (let i = 0; i < 16; i++) g.fillRect(12, 34 + i * 13, 50 + ((i * 37) % 54), 5);
    g.strokeStyle = "#9fe8ff"; g.lineWidth = 3; g.strokeRect(2, 2, 124, 252);
    const t = new THREE.CanvasTexture(c); texturas.push(t); return t; })();
  const mons = computadoresLocais(), LM = CIDADE.monitores.largura, HM = LM * 1.6, YM = HM / 2 + 0.6;
  const matMon = new THREE.MeshStandardMaterial({ color: 0x16203c, roughness: 0.45, metalness: 0.35, emissive: 0x16264f, emissiveIntensity: 0.45 });
  const molduraMon = add(new THREE.InstancedMesh(new THREE.BoxGeometry(LM, HM, 0.3), matMon, mons.length), ilha, true);
  const peMon = add(new THREE.InstancedMesh(new THREE.BoxGeometry(LM * 0.5, 0.6, 1.4), matMon, mons.length), ilha, true);
  const telas = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(LM * 0.85, HM * 0.88), new THREE.MeshBasicMaterial({ map: pagina, transparent: true, opacity: 0.92, side: THREE.DoubleSide }), mons.length), ilha, true);
  const brilhoMon = add(new THREE.InstancedMesh(new THREE.PlaneGeometry(LM * 1.2, HM * 1.1), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), mons.length));
  { const mx = new THREE.Matrix4(), mq = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), mp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const em = (m: { x: number; z: number; rot: number }, ly: number, lz: number) => mp.set(m.x + lz * Math.sin(m.rot), ly, m.z + lz * Math.cos(m.rot));
    mons.forEach((m, i) => {
      mq.setFromAxisAngle(up, m.rot);
      molduraMon.setMatrixAt(i, mx.compose(em(m, YM, -0.15), mq, um)); peMon.setMatrixAt(i, mx.compose(em(m, 0.3, -0.15), mq, um));
      telas.setMatrixAt(i, mx.compose(em(m, YM, 0.02), mq, um)); brilhoMon.setMatrixAt(i, mx.compose(em(m, YM, -0.32), mq, um));
    });
    for (const im of [molduraMon, peMon, telas, brilhoMon]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); } }

  // ── a ESCADA DE ENERGIA do lounge: uma faixa de luz FLUINDO (setas correndo pra cima) da borda oeste até a porta da
  //    plataforma do lounge, partículas subindo pelo corredor, corrimão de vidro com friso aceso. Ela LEVA quem pisa na
  //    boca (lib/cyber/ceu `bocaDaEscada`) — o avatar vai surfando numa prancha de luz ──
  let fluxoMat: THREE.ShaderMaterial | null = null, fluxoPts: { geo: THREE.BufferGeometry; d: { u: number; lat: number; y: number; v: number }[] } | null = null;
  { const E2 = ESCADA_LOUNGE, H2 = ALTURA_LOUNGE, larg = E2.meia * 2;
    const x0 = E2.dir.x * E2.ini, x1 = E2.dir.x * E2.fim, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, 0.05, -E2.meia, x1, H2 + 0.05, -E2.meia, x1, H2 + 0.05, E2.meia, x0, 0.05, E2.meia]), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    fluxoMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uLen: { value: E2.len / larg } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; uniform float uLen; varying vec2 vUv;
        void main(){
          float x = vUv.x * uLen * 3.0, y = vUv.y - 0.5;
          float seta = fract(x - abs(y) * 1.6 - uT * 1.4);            // setas em "V" correndo pro lounge
          float faixa = smoothstep(0.0, 0.08, seta) * smoothstep(0.32, 0.12, seta);
          float borda = smoothstep(0.38, 0.5, abs(y));                 // as bordas acesas
          float pulso = 0.6 + 0.4 * sin(vUv.x * 40.0 - uT * 6.0);
          vec3 c = mix(vec3(0.25, 0.85, 1.0), vec3(0.72, 0.55, 1.0), vUv.x);
          float a = 0.16 + 0.55 * faixa + 0.6 * borda * pulso;
          gl_FragColor = vec4(c * a * 1.4, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const fluxo = add(new THREE.Mesh(g, fluxoMat)); fluxo.renderOrder = 2;
    // a "pele" de baixo (sólida, pra faixa ter corpo visto de lado/de baixo) e o chão escuro do corredor
    const pele = new THREE.BufferGeometry(); pele.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, -0.25, -E2.meia, x1, H2 - 0.25, -E2.meia, x1, H2 - 0.25, E2.meia, x0, -0.25, E2.meia]), 3)); pele.setIndex([0, 2, 1, 0, 3, 2]); pele.computeVertexNormals();
    add(new THREE.Mesh(pele, new THREE.MeshBasicMaterial({ color: 0x10306a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })));
    // partículas subindo pelo corredor
    const NFP = low ? 70 : 160, d = Array.from({ length: NFP }, () => ({ u: Math.random() * E2.len, lat: (Math.random() - 0.5) * larg * 0.9, y: Math.random() * 1.6, v: 6 + Math.random() * 8 }));
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NFP * 3), 3));
    const pts = add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.5, map: starTex, color: 0x9fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); pts.frustumCulled = false;
    fluxoPts = { geo: pg, d };
    // corrimão de vidro (um paralelogramo de cada lado, acompanhando a inclinação) + friso aceso no alto + viga embaixo
    const vidroCorr = vidro({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.3, side: THREE.DoubleSide }, 0.3);
    const friso: number[] = [];
    for (const sl of [-1, 1]) {
      const z = sl * (E2.meia + 0.25), x0 = E2.dir.x * E2.ini, x1 = E2.dir.x * E2.fim, g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([x0, 0, z, x1, H2, z, x1, H2 + 1.3, z, x0, 0, z, x1, H2 + 1.3, z, x0, 1.3, z]), 3)); g.computeVertexNormals();
      add(new THREE.Mesh(g, vidroCorr));
      friso.push(x0, 1.3, z, x1, H2 + 1.3, z);
    }
    const gf = new THREE.BufferGeometry(); gf.setAttribute("position", new THREE.BufferAttribute(new Float32Array(friso), 3));
    add(new THREE.LineSegments(gf, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })));
    const incl = Math.atan2(H2, E2.len), viga = add(new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(E2.len, H2), 0.6, 1.4), new THREE.MeshBasicMaterial({ color: 0x66e6ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
    viga.position.set(E2.dir.x * (E2.ini + E2.len / 2), H2 / 2 - 0.9, 0); viga.rotation.z = E2.dir.x * incl;   // sobe pro lado do lounge (−x)
  }
  // ── a PLATAFORMA DO LOUNGE (só a base; o clube em cima é o Salas): disco de gelo com aro de luz + montanha invertida
  //    de cristal por baixo (como as ilhotas) e o brilho antigravidade ──
  { const L = CIDADE.salas.lounge, base = new THREE.Group(); base.position.set(L.x, ALTURA_LOUNGE, L.z); add(base);
    add(new THREE.Mesh(new THREE.CylinderGeometry(L.r + 1, L.r - 1, 1.8, low ? 48 : 96), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.25 })), base, true).position.y = -0.95;
    const cone = add(new THREE.Mesh(new THREE.ConeGeometry(L.r - 2, 56, low ? 9 : 14, 1, false), rocha), base, true); cone.rotation.x = Math.PI; cone.position.y = -1.8 - 28;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3, c = add(new THREE.Mesh(new THREE.ConeGeometry(8 + (k % 2) * 4, 26 + (k % 3) * 8, 7, 1, false), rocha), base); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * L.r * 0.55, -1.8 - (13 + (k % 3) * 4), Math.sin(a) * L.r * 0.55); }
    const aroL = add(new THREE.Mesh(new THREE.TorusGeometry(L.r + 1, 0.3, 6, low ? 64 : 128), new THREE.MeshBasicMaterial({ color: 0xb98cff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })), base); aroL.rotation.x = Math.PI / 2; aroL.position.y = -0.1;
    const anti = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(185,140,255,.9)", "rgba(102,230,255,.2)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), base); anti.position.y = -40; anti.scale.setScalar(46);
  }

  // (sem hangar: a nave-QG do dono fica PAIRANDO atracada ao lado da ilha — lib/cyber/naveQG `poseDaDoca`)

  // ── SALAS (lounge) ──
  const salas = criarSalas(ilha, { low, texturas, estrela: starTex, paredeMat: vidro({ color: 0x0a1830, emissive: 0x2a3a70, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.3, thickness: 1, transparent: true, opacity: 0.32, side: THREE.DoubleSide }, 0.3) });
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
  const CN = low ? 80 : 180, cher = Array.from({ length: CN }, () => ({ a: Math.random() * 6.283, r: CIDADE.cidadela.r + 6 + Math.random() * 90, y: 6 + Math.random() * 70, sp: 0.02 + Math.random() * 0.07 }));
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
    group: raiz, ilha, rotulo, alvos, computadores: telas, portalChao: peDisco, tvLounge: salas.tv, caixasLounge: salas.caixas, tocaDiscos: salas.tocaDiscos, somTocando: (on: boolean, nivel?: number) => salas.somTocando(on, nivel), alturaIlhota: (k: number) => ilhotas[k]?.g.position.y ?? CIDADE.pisoY, mostrarRecadoNaTV: (t: string | null) => salas.mostrarRecado(t),
    atualizar(dt, t) {
      ilha.position.y = CIDADE.pisoY + Math.sin(t * 0.3) * 0.25 * vel;
      for (const f of fogos) { const p = 0.72 + 0.28 * Math.sin(t * 1.8 + f.ph) * fogoAmp; f.s.scale.set(3.4 * (0.9 + p * 0.25), 5 * (0.8 + p * 0.4), 1); (f.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.3 * p; }
      if (quente) quente.intensity = 1.4 + 0.3 * Math.sin(t * 1.6) * fogoAmp;
      (brasa.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 1.4) * fogoAmp;
      pontas.forEach((p, i) => { (p.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 1.2 + i); p.rotation.y += dt * 0.4 * vel; });
      farol.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.1);
      salas.atualizar(dt, t);
      estac.atualizar(t);
      globo.rotation.y += dt * 0.25 * vel; aroGlobo.rotation.z += dt * 0.2 * vel;
      // a escada de energia: as setas correm, as partículas sobem pelo corredor
      if (fluxoMat) fluxoMat.uniforms.uT!.value = t * vel;
      if (fluxoPts) { const E2 = ESCADA_LOUNGE, H2 = ALTURA_LOUNGE, a = fluxoPts.geo.attributes.position!.array as Float32Array;
        fluxoPts.d.forEach((p, i) => { p.u = (p.u + p.v * dt * vel) % E2.len; a[i * 3] = E2.dir.x * (E2.ini + p.u); a[i * 3 + 1] = H2 * (p.u / E2.len) + 0.2 + p.y; a[i * 3 + 2] = p.lat; });
        fluxoPts.geo.attributes.position!.needsUpdate = true; }
      aro.rotation.z += dt * 0.3 * vel; discoP.rotation.z += dt * 0.5 * vel;
      // quedas de luz
      { const a = qGeo.attributes.position!.array as Float32Array;
        quedas.forEach((q, i) => { q.y -= q.sp * dt * vel; if (q.y < -QUEDA) q.y = 0; const r = R - 0.5 + Math.min(4, -q.y * 0.05); a[i * 3] = Math.cos(q.a) * r + q.j; a[i * 3 + 1] = q.y; a[i * 3 + 2] = Math.sin(q.a) * r; });
        qGeo.attributes.position!.needsUpdate = true; }
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
