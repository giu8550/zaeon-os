/**
 * Cidade — a ZAEON, a ilha no céu, o coração do hiperespaço (sem chão embaixo: só o vazio). Mesmo idioma da Recepção (cristal, gelo,
 * granizo, fogo contido, querubins, contraste frio×quente), maior e mais rica, no conceito das cidades flutuantes:
 *  - ilha monumental de cristal (montanha INVERTIDA: larga em cima, ápice embaixo), LIMPA por baixo — só a rocha e uma
 *    AGULHA afiada descendo do ápice (só rocha: sem luz na ponta);
 *  - ilhotas flutuantes em volta, com aglomerados de cristal;
 *  - 16 torres de cristal com pontas luminosas na borda (entre elas, os TUBOS DE ENSAIO do berçário — Bercario); línguas
 *    de fogo na borda (cintilar lento, sem estrobo);
 *  - a ZAEON MEGA (2,5× mais larga): CAPELA monumental (pilares + cúpula estelar + tambor + 2ª cúpula + pináculo)
 *    vazia por dentro — só o GLOBO de luz no centro (os livros e os servidores saíram);
 *  - a ESCADA DE ENERGIA (faixa de luz fluindo, corrimão de vidro; leva quem pisa nela) da borda oeste até a PLATAFORMA DO
 *    LOUNGE, na altura do início da ponta da capela — o clube em cima dela é components/cyber/Salas.ts;
 *  - o BURACO NEGRO da cidade (o nó central da rede de túneis — components/cyber/BuracoPortal); farol no topo (a
 *    nave-QG fica atracada PAIRANDO ao lado, sem hangar). A Recepção (o lar da Zaeon, a anfitriã) é um marco
 *    (components/cyber/Landmark) e o berçário dos tubos de ensaio é do engine (components/cyber/Bercario).
 * Layout em lib/cyber/ceu.ts (o mesmo que a colisão usa). `low` reduz partículas/segmentos/ilhotas;
 * `prefers-reduced-motion` deixa fogo/vórtices quase parados. dispose() completo.
 */
import * as THREE from "three";
import type { PisoOclusor } from "./oclusaoPisos";
import { rotDaSala, ALTURA_LOUNGE, BOIA_ILHOTA, CAPELA, CAPELA_NA_ZAEON, ESTACOES_NA_CAPELA, FOGO_NA_BORDA, TORRES_NA_BORDA, CIDADE, GLOBO_CAPELA, ESCADAS, ILHOTAS, alturaDoFio, type NomeSala, TORRES_MURALHA, anguloDaTorre, naAberturaDaEscada } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";
import { criarSalas } from "./Salas";
import { criarTemplo } from "./Templo";
import { criarPisoEstacionamento } from "./Estacionamento";
import { criarPisosEstudo } from "./EstacionamentosEstudo";
import { LOTES } from "@/lib/cyber/motos";
import { NOS } from "@/lib/cyber/buracos";
import { criarBuracoPortal } from "./BuracoPortal";
import { criarCoracao } from "./CoracaoZaeon";
import { criarEstacoes } from "./EstacoesAgentes";
import { criarCabinesEstudo } from "./CabinesEstudo";
import { TOPO_DA_CAPELA } from "@/lib/cyber/coracao";
import { criarDistritoTerra } from "./DistritoTerra";
import { criarObservadores } from "./DroidsObservadores";

export type CidadeHandle = {
  group: THREE.Group;
  /** sub-grupo da ilha (em y = pisoY) — o engine soma a flutuação dele a quem está lá em cima */
  ilha: THREE.Group;
  rotulo: HTMLDivElement;
  /** superfícies sólidas (raycast do clique/câmera) */
  alvos: THREE.Object3D[];
  /** o anel do BURACO NEGRO da cidade (o nó central da rede de túneis) — clicar = entrar */
  portalTunel: THREE.Object3D;
  atualizar(dt: number, t: number): void;
  dispose(): void;
  /** a tela da TV do lounge (clicável: o dono escreve o recado pro mural da Recepção) */
  tvLounge: THREE.Mesh | null;
  /** o conteúdo de cada sala por cima do piso (a câmera abaixo da plataforma não enxerga — components/cyber/oclusaoPisos) */
  plataformas: PisoOclusor[];
  /** o som do lounge: as caixas (de onde a música sai), o toca-discos (onde se abre o player) e o "está tocando" */
  caixasLounge: THREE.Object3D[]; tocaDiscos: THREE.Object3D | null; somTocando(on: boolean, nivel?: number): void;
  /** as caixas de som discretas dos espaços de convivência (a música ambiente de cada sala sai delas) */
  caixasAmbiente: { sala: NomeSala; obj: THREE.Object3D }[];
  /** mostra na TV o último recado enviado (null = some) */
  mostrarRecadoNaTV(texto: string | null): void;
  /** altura ATUAL do topo da ilhota k (com a flutuação já aplicada) — o engine pousa/anda nela */
  alturaIlhota(k: number): number;
  /** o SHOW do lounge durante a música (lib/cyber/showLounge) e o olho no ritual */
  showLounge(e: import("@/lib/cyber/showLounge").EstadoShow, olho: number): void;
  /** um relâmpago da névoa do lounge (`alvoMundo` = onde cai, ex.: uma caixa de som) */
  raioNoLounge(vel?: number, alvoMundo?: THREE.Vector3): void;
  /** a TEMPESTADE do templo (o ritual do dono): a intensidade das nuvens (0..1) e se os raios caem */
  tempestade(intensidade: number, raios: boolean): void;
  /** estoura um relâmpago na tempestade do templo agora — caindo em `alvoMundo` (o buraco negro do DJ) ou à toa */
  raioNoTemplo(alvoMundo?: THREE.Vector3): void;
  /** quem está na Zaeon agora (local da ilha) — os motores de energia do Observatório reagem */
  presencas(p: { x: number; z: number }[]): void;
};

const COLD = 0xbfe8ff, ICE = 0x9fd0ff, FIRE = [0xffe3b0, 0xffb45a, 0xff7a2c];
const ROTULO_CSS = "position:absolute;transform:translate(-50%,-100%);font:800 13px system-ui,sans-serif;letter-spacing:.08em;padding:4px 12px;border-radius:999px;color:#ffe9c2;background:rgba(18,10,8,.65);border:1px solid rgba(255,190,120,.5);box-shadow:0 0 18px rgba(255,160,80,.35);white-space:nowrap;pointer-events:none;display:none;";

export function criarCidade(opts: { low: boolean; starTex: THREE.Texture; /** o RAIO saiu do topo da capela (mundo) — o som */ aoRaio?: (em: THREE.Vector3) => void; /** a 1ª bulha do coração (mundo: o globo) — o som */ aoBater?: (em: THREE.Vector3) => void; /** caiu um raio da tempestade do templo (mundo) — o trovão */ aoTrovao?: (em: THREE.Vector3) => void }): CidadeHandle {
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
  const quente = low || !FOGO_NA_BORDA ? null : add(new THREE.PointLight(0xff8a3c, 1.6, 280)); quente?.position.set(0, 15, 0);

  // ── ilha monumental (montanha invertida) + camada de rocha + estalactites ──
  // os cones são ABERTOS em cima (sem tampa): o piso é de vidro e, por ele, vê-se o universo embaixo — de dentro, a
  // casca não desenha (FrontSide) e só aparecem as janelas, as estalactites e o espaço; de fora, a ilha é a mesma.
  // Tudo que fica SOB o piso desenha ANTES do vidro (renderOrder): assim o vidro passa por cima e o tinge — sem isso as
  // estalactites furavam o chão, brancas, como se estivessem em cima dele
  const SOB_O_VIDRO = -2;
  const rocha = vidro({ color: 0x0b1a30, emissive: 0x10325e, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, transmission: 0.2, thickness: 2, transparent: true, opacity: 0.97 }, 0.97);
  const cone = add(new THREE.Mesh(new THREE.ConeGeometry(R, H, low ? 10 : 14, 1, true), rocha), ilha, true);
  cone.rotation.x = Math.PI; cone.position.y = -H / 2 - 0.65; cone.renderOrder = SOB_O_VIDRO;   // o topo do cone fica sob o piso (sem z-fighting)
  // AGULHA: a ponta afiada que desce do ápice (o volume sólido dela está em CIDADE.agulha) + 3 espinhos menores — sem luz
  const AG = CIDADE.agulha, agTopo = -H * 0.7, agFundo = -H - AG.altura, agLen = agTopo - agFundo;
  const agulha = add(new THREE.Mesh(new THREE.ConeGeometry(AG.r * 1.5, agLen, 6, 1, false), rocha), ilha, true);
  agulha.rotation.x = Math.PI; agulha.position.y = agTopo - agLen / 2; agulha.renderOrder = SOB_O_VIDRO;
  // (os 3 espinhos, os andares de servidores com as janelas e os anéis, as estalactites e as quedas de luz saíram — o dono: a base da cidadela é LIMPA, só a rocha e a agulha)

  // ── piso: disco frio + anéis concêntricos + raios (a "rosa dos ventos" da cidade) ──
  // o PISO é de VIDRO, no material da cúpula da capela: o universo aparece em cima e embaixo, e as linhas e as veias
  // azuis do coração (CoracaoZaeon) correm por cima dele. Um disco só (uma face, sem bordas): desenhado ANTES de todo
  // transparente e sem gravar profundidade, então o que está embaixo (janelas, estalactites, estrelas) aparece através
  // dele. Continua alvo do clique/câmera (o raycast não olha a opacidade)
  const piso = add(new THREE.Mesh(new THREE.CircleGeometry(R, low ? 64 : 128), vidro({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3 }, 0.4)), ilha, true);
  piso.rotation.x = -Math.PI / 2; (piso.material as THREE.Material).depthWrite = false; piso.renderOrder = SOB_O_VIDRO + 1;
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

  // ── as TORRES da muralha (cristal com a ponta acesa). Os blocos de granizo entre elas saíram: no lugar deles ficam os
  //    TUBOS DE ENSAIO onde quem chega nasce (components/cyber/Bercario, do engine) ──
  const torreMat = vidro({ color: 0xdff0ff, emissive: ICE, emissiveIntensity: 0.4, roughness: 0.08, metalness: 0, transmission: 0.85, thickness: 0.8, transparent: true, opacity: 0.75 }, 0.7);
  const pontas: THREE.Mesh[] = [];
  const NT = TORRES_MURALHA.n, ATR = TORRES_MURALHA.alt;   // 16 torres na muralha (a Zaeon mega)
  if (TORRES_NA_BORDA) for (let k = 0; k < NT; k++) {
    const a = anguloDaTorre(k), x = Math.cos(a) * CIDADE.muralhaR, z = Math.sin(a) * CIDADE.muralhaR;
    const torre = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, TORRES_MURALHA.rBase, ATR, 8), torreMat), ilha, true); torre.position.set(x, ATR / 2, z);
    const ponta = add(new THREE.Mesh(new THREE.OctahedronGeometry(2.6), new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x9fe8ff, emissiveIntensity: 1.6, roughness: 0.2, flatShading: true })));
    ponta.scale.y = 1.8; ponta.position.set(x, ATR + 3.9, z); pontas.push(ponta);
  }

  // ── línguas de fogo na borda + anel de brasa (sem estrobo) ──
  const texFogo = glow("rgba(255,225,170,.95)", "rgba(255,120,40,.3)");
  const NF = !FOGO_NA_BORDA ? 0 : low ? 36 : 64, fogos = Array.from({ length: NF }, (_, i) => {
    const a = (i / NF) * Math.PI * 2, s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: texFogo, color: FIRE[i % 3]!, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.position.set(Math.cos(a) * (R - 0.8), 2.4, Math.sin(a) * (R - 0.8)); s.scale.set(3.4, 5, 1); if (naAberturaDaEscada(s.position.x, s.position.z)) s.visible = false;
    return { s, ph: Math.random() * 6.283 };
  });
  const brasa = FOGO_NA_BORDA ? add(new THREE.Mesh(new THREE.TorusGeometry(R - 0.8, 0.2, 8, low ? 64 : 120), new THREE.MeshBasicMaterial({ color: 0xff7a2c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending }))) : null;
  if (brasa) { brasa.rotation.x = Math.PI / 2; brasa.position.y = 0.4; }

  // ── CAPELA monumental (a cidadela, 3× maior): pilares + coroamento + cúpula estelar + tambor + 2ª cúpula + PONTA +
  //    farol. Por dentro, vazia: só o GLOBO de luz no centro (os livros e os servidores saíram) ──
  let farol: THREE.Sprite | null = null;
  if (CAPELA_NA_ZAEON) {
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
    farol = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(220,250,255,1)", "rgba(120,200,255,.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); farol.scale.set(22, 22, 1); farol.position.y = yFarol;
  }

  // o GLOBO no centro da capela: mesa redonda + esfera de pontos de luz girando + um anel em volta
  const mesaGlobo = add(new THREE.Mesh(new THREE.CylinderGeometry(CIDADE.mesaHolo.r, CIDADE.mesaHolo.r * 1.1, 2.2, 32), new THREE.MeshStandardMaterial({ color: 0x10213e, emissive: 0x2b6bd0, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })), ilha, true) as THREE.Mesh; mesaGlobo.position.y = 1.1;
  const RG = GLOBO_CAPELA.r, YG = GLOBO_CAPELA.y, NG = low ? 420 : 900, gp = new Float32Array(NG * 3);
  for (let i = 0; i < NG; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u); gp[i * 3] = s * Math.cos(th) * RG; gp[i * 3 + 1] = YG + u * RG; gp[i * 3 + 2] = s * Math.sin(th) * RG; }
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  const globo = add(new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.22, map: starTex, color: 0x8fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const aroGlobo = add(new THREE.Mesh(new THREE.TorusGeometry(RG * 1.35, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  aroGlobo.position.y = YG; aroGlobo.rotation.x = Math.PI / 2 - 0.35;

  // ── os FIOS DE ENERGIA (um por SALA — no lugar das antigas escadas com corrimão): um cabo aceso da borda da central
  //    até a porta da sala, com pulsos de luz correndo pra cima, um halo, faíscas e um POSTE de luz em cada ponta; no
  //    chão, a BOCA (o disco aceso) onde se pisa pra ser puxado (lib/cyber/ceu `FIO`, `alturaDoFio`, `bocaDeEscada`).
  //    Cada fio é montado correndo pro −x local e girado pro rumo da sala ──
  const COR_SALA: Record<NomeSala, number> = { lounge: 0xb98cff, garagem: 0xffb46b, biblioteca: 0x7fb8ff, jardim: 0x7dffb0 };
  let fluxoMat: THREE.ShaderMaterial | null = null;
  const fluxoPts: { geo: THREE.BufferGeometry; d: { u: number; lat: number; y: number; v: number }[]; esc: (typeof ESCADAS)[NomeSala] }[] = [];
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x0c1424, roughness: 0.35, metalness: 0.8, emissive: 0x0a1a36, emissiveIntensity: 0.6 });
  for (const nomeEsc of Object.keys(ESCADAS) as NomeSala[]) {
    const EE = ESCADAS[nomeEsc], gEsc = add(new THREE.Group()); gEsc.rotation.y = Math.PI - CIDADE.salas[nomeEsc].ang;   // −x local → o rumo da sala
    const em = (u: number, dy = 0) => new THREE.Vector3(-(EE.ini + u), alturaDoFio(EE, u) + dy, 0);
    const curva = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, k) => em((k / 12) * EE.len)));
    fluxoMat ??= new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float uT; varying vec2 vUv;
        void main(){
          float p = fract(vUv.x * 9.0 - uT * 0.9);                       // os PULSOS correndo pra sala
          float pulso = smoothstep(0.0, 0.05, p) * smoothstep(0.35, 0.08, p);
          vec3 c = mix(vec3(0.3, 0.85, 1.0), vec3(0.75, 0.6, 1.0), vUv.x);
          gl_FragColor = vec4(c * (0.55 + 1.6 * pulso), 1.0);
        }`,
    });
    add(new THREE.Mesh(new THREE.TubeGeometry(curva, low ? 60 : 140, 0.09, 8, false), fluxoMat), gEsc);   // o cabo
    add(new THREE.Mesh(new THREE.TubeGeometry(curva, low ? 40 : 90, 0.42, 8, false), new THREE.MeshBasicMaterial({ color: COR_SALA[nomeEsc], transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false })), gEsc);   // o halo
    // os POSTES das pontas (o cabo nasce no topo deles) e a BOCA acesa no chão
    for (const [u, base] of [[0, 0], [EE.len, ALTURA_LOUNGE]] as const) {
      const h = alturaDoFio(EE, u) - base + 0.5, poste = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, h, 10), matPoste), gEsc); poste.position.set(-(EE.ini + u), base + h / 2, 1.4);
      const braco = add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.4), matPoste), gEsc); braco.position.set(-(EE.ini + u), alturaDoFio(EE, u), 0.7);
      const anel = add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: COR_SALA[nomeEsc], transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })), gEsc);
      anel.position.copy(em(u)); anel.rotation.y = Math.PI / 2;
    }
    const boca = add(new THREE.Mesh(new THREE.CircleGeometry(EE.meia * 0.55, 40), new THREE.MeshBasicMaterial({ color: COR_SALA[nomeEsc], transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false })), gEsc);
    boca.rotation.x = -Math.PI / 2; boca.position.set(-(EE.ini + 1), 0.05, 0);
    // faíscas correndo pelo cabo
    const NFP = low ? 30 : 70, d = Array.from({ length: NFP }, () => ({ u: Math.random() * EE.len, lat: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.5, v: 8 + Math.random() * 10 }));
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NFP * 3), 3));
    const pts = add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.45, map: starTex, color: 0x9fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), gEsc); pts.frustumCulled = false;
    fluxoPts.push({ geo: pg, d, esc: EE });
  }
  // ── a PLATAFORMA DO LOUNGE (só a base; o clube em cima é o Salas): disco de gelo com aro de luz + montanha invertida
  //    de cristal por baixo (como as ilhotas) e o brilho antigravidade ──
  for (const nomeSala of Object.keys(CIDADE.salas) as NomeSala[]) { const L = CIDADE.salas[nomeSala], base = new THREE.Group(); base.position.set(L.x, ALTURA_LOUNGE, L.z); add(base);
    add(new THREE.Mesh(new THREE.CylinderGeometry(L.r + 1, L.r - 1, 1.8, low ? 48 : 96), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.25 })), base, true).position.y = -0.95;
    const cone = add(new THREE.Mesh(new THREE.ConeGeometry(L.r - 2, 56, low ? 9 : 14, 1, false), rocha), base, true); cone.rotation.x = Math.PI; cone.position.y = -1.8 - 28;
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3, c = add(new THREE.Mesh(new THREE.ConeGeometry(8 + (k % 2) * 4, 26 + (k % 3) * 8, 7, 1, false), rocha), base); c.rotation.x = Math.PI; c.position.set(Math.cos(a) * L.r * 0.55, -1.8 - (13 + (k % 3) * 4), Math.sin(a) * L.r * 0.55); }
    const aroL = add(new THREE.Mesh(new THREE.TorusGeometry(L.r + 1, 0.3, 6, low ? 64 : 128), new THREE.MeshBasicMaterial({ color: COR_SALA[nomeSala], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })), base); aroL.rotation.x = Math.PI / 2; aroL.position.y = -0.1;
    const anti = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(185,140,255,.9)", "rgba(102,230,255,.2)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), base); anti.position.y = -40; anti.scale.setScalar(46);
  }

  // (sem hangar: a nave-QG do dono fica PAIRANDO atracada ao lado da ilha — lib/cyber/naveQG `poseDaDoca`)

  // ── SALAS (lounge) ──
  const vidroSala = vidro({ color: 0x0a1830, emissive: 0x2a3a70, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.3, thickness: 1, transparent: true, opacity: 0.32, side: THREE.DoubleSide }, 0.3);
  const salas = criarSalas(ilha, { low, texturas, estrela: starTex, paredeMat: vidroSala });
  alvos.push(...salas.alvos);
  // ── o TEMPLO (lib/cyber/templo): a escadaria em curva que sai da direita do deck do lounge, a muralha-veia e o templo
  //    com a capela e o sanfoneiro — montado no referencial da sala do lounge ──
  const templo = criarTemplo({ low, paredeMat: vidroSala, estrela: starTex, aoTrovao: opts.aoTrovao });
  { const L = CIDADE.salas.lounge; templo.group.position.set(L.x, ALTURA_LOUNGE, L.z); templo.group.rotation.y = rotDaSala(L); add(templo.group); alvos.push(...templo.alvos); }

  // ── os ESTACIONAMENTOS da GARAGEM (a ala dos veículos — as motos e os robôs são do engine): o piso dos lotes, lá em
  //    cima na plataforma da garagem (flutuando junto com a ilha); entra no clique de andar ──
  const estacs = LOTES.filter((l) => l.id === "garagem").map((l) => {
    const e = criarPisoEstacionamento({ low, parado: rm, lote: l });
    e.group.position.set(l.x - CIDADE.centro.x, l.alt, l.z - CIDADE.centro.z); e.group.rotation.y = l.rot; add(e.group, ilha, true); return e;
  });

  // ── os ESTACIONAMENTOS das salas de estudo e do lounge (pra fora de cada sala, flutuando com a ilha): as IAs chegam
  //    de moto e deixam a moto lá (lib/cyber/estacionamentosEstudo; as motos paradas são do components/cyber/FrotaIA) ──
  add(criarPisosEstudo({ low, onde: "zaeon" }));

  // ── as CABINES DE ESTUDO da hierarquia (professores junto dos pilares da capela, doutores atrás, mestrandos depois —
  //    lib/cyber/credenciais; os graduandos estudam no chão em volta das supertrees) ──
  add(criarCabinesEstudo({ low }).group);

  // ── o BURACO NEGRO da cidade: o nó central da rede de túneis (pisou no anel = escolhe o destino) ──
  const pt = CIDADE.portalTunel, bnc = criarBuracoPortal(ilha, { x: pt.x, y: 0, z: pt.z, anelR: pt.r, h: NOS.zaeon.bh.h, r: NOS.zaeon.bh.r, low, starTex });
  texturas.push(...bnc.texturas);
  // o pedestal escuro em volta do anel (o anel fica rente ao piso)
  add(new THREE.Mesh(new THREE.CylinderGeometry(pt.r + 1.4, pt.r + 1.7, 0.18, 40), new THREE.MeshStandardMaterial({ color: 0x14203a, emissive: 0x1b2b55, emissiveIntensity: 0.5 })), ilha, true).position.set(pt.x, -0.06, pt.z);

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

  // o CORAÇÃO (o globo bate; veias azuis por toda a cidade e subindo a capela; o raio no topo) e as ESTAÇÕES DOS AGENTES
  const coracao = CAPELA_NA_ZAEON ? criarCoracao({ low }) : null; if (coracao) ilha.add(coracao.group);
  const estacoes = ESTACOES_NA_CAPELA ? criarEstacoes({ low }) : null; if (estacoes) ilha.add(estacoes.group);   // (saíram na reforma da capela)
  // o OBSERVATÓRIO DA TERRA + os 4 AUTÓDROMOS (lib/cyber/terra) e os DROIDS OBSERVADORES
  const distrito = criarDistritoTerra({ low, parado: rm }); ilha.add(distrito.group); alvos.push(...distrito.alvos);
  const observadores = criarObservadores({ low }); ilha.add(observadores.group);
  // fora do lote estático (lotes.ts): o coração (pulsa por EVENTO — o raio — que a simulação da montagem não vê), as
  // estações (já instanciadas) e os droids (andam). O distrito entra: anima pelo relógio (a simulação vê) e materiais compartilhados
  for (const g of [...(coracao ? [coracao.group] : []), ...(estacoes ? [estacoes.group] : []), observadores.group]) g.traverse((n) => { n.userData.semLote = true; });
  const matGlobo = globo.material as THREE.PointsMaterial, matMesa = mesaGlobo.material as THREE.MeshStandardMaterial, matAro = aroGlobo.material as THREE.MeshBasicMaterial;
  const topoMundo = new THREE.Vector3(), globoMundo = new THREE.Vector3();

  const rotulo = document.createElement("div"); rotulo.style.cssText = ROTULO_CSS; rotulo.textContent = "Zaeon";
  const fogoAmp = rm ? 0.12 : 1, vel = rm ? 0.2 : 1;

  return {
    group: raiz, ilha, rotulo, alvos, portalTunel: bnc.alvo, tvLounge: salas.tv, plataformas: salas.plataformas, caixasLounge: salas.caixas, caixasAmbiente: salas.ambiente, tocaDiscos: salas.tocaDiscos, somTocando: (on: boolean, nivel?: number) => salas.somTocando(on, nivel), alturaIlhota: (k: number) => ilhotas[k]?.g.position.y ?? CIDADE.pisoY, presencas: (p) => distrito.presencas(p), mostrarRecadoNaTV: (t: string | null) => salas.mostrarRecado(t),
    showLounge: (e, olho) => salas.show(e, olho),
    raioNoLounge: (vel, alvo) => salas.raioNoLounge(vel, alvo),
    tempestade: (i, raios) => templo.tempestade(i, raios),
    raioNoTemplo: (alvo) => templo.raioAgora(alvo),
    atualizar(dt, t) {
      // a ilha BOIA (25 cm, ciclo de ~21 s): só move quando andou 1 cm — mexer nela força recalcular as matrizes dos
      // ~1.300 nós da cidade; a cada quadro andaria menos de meio milímetro (components/cyber/matrizes)
      { const y = CIDADE.pisoY + Math.sin(t * 0.3) * 0.25 * vel; if (Math.abs(y - ilha.position.y) > 0.01) ilha.position.y = y; }
      for (const f of fogos) { const p = 0.72 + 0.28 * Math.sin(t * 1.8 + f.ph) * fogoAmp; f.s.scale.set(3.4 * (0.9 + p * 0.25), 5 * (0.8 + p * 0.4), 1); (f.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.3 * p; }
      if (quente) quente.intensity = 1.4 + 0.3 * Math.sin(t * 1.6) * fogoAmp;
      if (brasa) (brasa.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 1.4) * fogoAmp;
      pontas.forEach((p, i) => { (p.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 1.2 + i); p.rotation.y += dt * 0.4 * vel; });
      if (farol) farol.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.1);
      salas.atualizar(dt, t); templo.atualizar(dt, t);
      for (const e of estacs) e.atualizar(t);
      globo.rotation.y += dt * 0.25 * vel; aroGlobo.rotation.z += dt * 0.2 * vel;
      // o CORAÇÃO bate: o globo incha de luz, a mesa e o aro acendem; o pulso corre nas veias; o raio sai do topo
      { const ev = coracao ? coracao.atualizar(dt, t) : { raio: false, tum: false }, b = coracao ? coracao.batida() : 0;
        matGlobo.size = 0.22 * (1 + 0.9 * b); matMesa.emissiveIntensity = 0.6 + 1.6 * b; matAro.opacity = 0.55 + 0.4 * b;
        estacoes?.atualizar(dt, t, b);
        distrito.atualizar(dt, t); observadores.atualizar(dt);
        if (ev.raio && opts.aoRaio) { const tp = TOPO_DA_CAPELA(); opts.aoRaio(topoMundo.set(tp.x, tp.y, tp.z).applyMatrix4(ilha.matrixWorld)); }
        if (ev.tum && opts.aoBater) opts.aoBater(globoMundo.set(0, GLOBO_CAPELA.y, 0).applyMatrix4(ilha.matrixWorld)); }
      // a escada de energia: as setas correm, as partículas sobem pelo corredor
      if (fluxoMat) fluxoMat.uniforms.uT!.value = t * vel;
      for (const fp of fluxoPts) { const a = fp.geo.attributes.position!.array as Float32Array, E = fp.esc;   // (no referencial do fio: corre pro −x)
        fp.d.forEach((p, i) => { p.u = (p.u + p.v * dt * vel) % E.len; a[i * 3] = -(E.ini + p.u); a[i * 3 + 1] = alturaDoFio(E, p.u) + p.y; a[i * 3 + 2] = p.lat; });
        fp.geo.attributes.position!.needsUpdate = true; }
      bnc.atualizar(dt * vel, t);
      // querubins
      { const a = cGeo.attributes.position!.array as Float32Array;
        cher.forEach((c, i) => { c.a += dt * c.sp * vel; a[i * 3] = Math.cos(c.a) * c.r; a[i * 3 + 1] = c.y + Math.sin(t * 0.5 + i) * 0.3; a[i * 3 + 2] = Math.sin(c.a) * c.r; });
        cGeo.attributes.position!.needsUpdate = true; }
      ilhotas.forEach((il, i) => { il.g.position.y = il.y0 + Math.sin(t * 0.25 + il.ph) * BOIA_ILHOTA * vel; il.g.rotation.y += dt * 0.01 * (i % 2 ? 1 : -1) * vel; });
    },
    dispose() { rotulo.remove(); templo.dispose(); coracao?.dispose(); estacoes?.dispose(); distrito.dispose(); observadores.dispose(); liberar(raiz, texturas); },
  };
}
