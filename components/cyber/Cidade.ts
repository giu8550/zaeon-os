/**
 * Cidade — a ZAEON, a ilha no céu, o coração do hiperespaço (sem chão embaixo: só o vazio). Mesmo idioma da Recepção (cristal, gelo,
 * granizo, fogo contido, querubins, contraste frio×quente), maior e mais rica, no conceito das cidades flutuantes:
 *  - a ilha é uma LAJE de vidro com a borda de rocha (a montanha invertida e a agulha embaixo saíram — out/2026);
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
import { rotDaSala, espelhoDe, ALTURA_LOUNGE, BOIA_ILHOTA, CAPELA, CAPELA_NA_ZAEON, inicioDaPonta, ESTACOES_NA_CAPELA, FOGO_NA_BORDA, TORRES_NA_BORDA, CIDADE, GLOBO_CAPELA, ESCADAS, ILHOTAS, alturaDoFio, type NomeSala, TORRES_MURALHA, anguloDaTorre, naAberturaDaEscada } from "@/lib/cyber/ceu";
import { glowTex } from "./CenaCosmica";
import { liberar } from "./Landmark";
import { criarEscadasDePedra } from "./EscadaPiramide";
import { criarSalas, type SalasHandle } from "./Salas";
import { criarSalaoCosmico, type SalaoCosmicoHandle } from "./TemploCosmico";
import { criarTemplo } from "./Templo";
import { criarTempestade } from "./Tempestade";
import { criarPisoEstacionamento } from "./Estacionamento";
import { criarPisosEstudo } from "./EstacionamentosEstudo";
import { LOTES } from "@/lib/cyber/motos";
import { NOS } from "@/lib/cyber/buracos";
import { criarBuracoPortal } from "./BuracoPortal";
import { criarFiosCosmicos } from "./FiosCosmicos";
import { saidaDaSala } from "@/lib/cyber/fiosCosmicos";
import { criarTrafegoCeu } from "./TrafegoCeu";
/** o tráfego simulado (carros e motos indo e vindo dos buracos negros): desligado até o fluxo REAL de gente */
const TRAFEGO_NO_CEU = false as boolean;
import { NIVEIS_SEPARADOS, type IdNivel } from "@/lib/cyber/nivelAtivo";
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
  /** mostra SÓ o nível (lib/cyber/nivelAtivo): a central (o hub) ou uma sala; `null` = tudo (o modo antigo) */
  mostrarNivel(n: IdNivel | null): void;
  /** onde a pessoa está (MUNDO) — as pistas: a tempestade do buraco negro cresce quando ela chega perto */
  jogadorEm(p: { x: number; y: number; z: number }): void;
  /** MONTA uma sala (o nível dela: a laje, o conteúdo, o templo, a garagem, a tempestade, a pista de saída) — com os
   *  níveis separados, só a sala da pessoa existe; DESMONTA libera a memória dela */
  montarSala(n: NomeSala): void; desmontarSala(n: NomeSala): void; salaMontada(n: NomeSala): boolean;
  /** o grupo de um nível da Zaeon (o engine põe nele o que é de uma sala — o relicário, os livros…) */
  grupoDoNivel(n: "zaeon" | NomeSala): THREE.Group;
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
  /** de onde sai o som calmo dos LOUNGES ESTUDANTIS do Templo Cósmico (components/cyber/TemploEstudo) */
  caixasEstudo: THREE.Object3D[];
  /** os raios da tempestade do campus de TI que caíram desde a última leitura (mundo) — o engine toca o trovão */
  raiosCampus(): { x: number; y: number; z: number }[];
  /** a cápsula da torre de TI em que eu estou (a vista de dentro), ou null */
  capsulaDentro(id: string | null): void;
  /** os ESTILHAÇOS girando em volta do cubo da torre de TI (mundo; vazio fora do lounge) — o engine empurra quem encosta */
  estilhacos(): { x: number; y: number; z: number; r: number }[];
  /** mostra na TV o último recado enviado (null = some) */
  mostrarRecadoNaTV(texto: string | null): void;
  /** a porta da CÚPULA da guardiã (o Templo Cósmico): aberta pra quem venceu o duelo de linguagem da Examiner */
  cupulaAberta(aberta: boolean): void;
  /** até onde a câmera desenha agora (m): os buracos negros das pistas ficam aquém (components/cyber/FiosCosmicos) */
  vistaCosmica(m: number): void;
  /** altura ATUAL do topo da ilhota k (com a flutuação já aplicada) — o engine pousa/anda nela */
  alturaIlhota(k: number): number;
  /** o SHOW do lounge durante a música (lib/cyber/showLounge) e a fumaça do ritual no topo do lounge (0..1) */
  showLounge(e: import("@/lib/cyber/showLounge").EstadoShow, ritual: number, olho?: number): void;
  /** um relâmpago da névoa do lounge (`alvoMundo` = onde cai) */
  raioNoLounge(vel?: number, alvoMundo?: THREE.Vector3): void;
  /** a FUMAÇA E OS TROVÕES do ritual (lib/cyber/ritual): a intensidade (0..1) e se os raios caem — no topo da capela, das
   *  salas de estudo e do templo (o do lounge é a névoa do show); `torre` = a fumaça EXTRA da torre do templo (os
   *  anunciadores: a escadaria vermelha) */
  tempestade(intensidade: number, raios: boolean, torre?: number): void;
  /** a ESCADARIA do templo ficando vermelha (0..1 — os anunciadores, com a música) */
  escadaria(vermelho: number): void;
  /** as batidas da música do lounge (contador) e a força do momento */
  batidasLounge(): number; pulsoLounge(): number;
  /** estoura um relâmpago na tempestade do templo agora — caindo em `alvoMundo` (o buraco negro do DJ) ou à toa */
  raioNoTemplo(alvoMundo?: THREE.Vector3): void;
  /** quem está na Zaeon agora (local da ilha) — os motores de energia do Observatório reagem */
  presencas(p: { x: number; z: number }[]): void;
  /** de onde sai o som dos DROIDS das estações (seguem os droids — components/cyber/DroidsObservadores) */
  somDroids: import("./DroidsObservadores").ObservadoresHandle["emissores"];
};

const COLD = 0xbfe8ff, ICE = 0x9fd0ff, FIRE = [0xffe3b0, 0xffb45a, 0xff7a2c];
const ROTULO_CSS = "position:absolute;transform:translate(-50%,-100%);font:800 13px system-ui,sans-serif;letter-spacing:.08em;padding:4px 12px;border-radius:999px;color:#ffe9c2;background:rgba(18,10,8,.65);border:1px solid rgba(255,190,120,.5);box-shadow:0 0 18px rgba(255,160,80,.35);white-space:nowrap;pointer-events:none;display:none;";

export function criarCidade(opts: { low: boolean; starTex: THREE.Texture; /** o RAIO saiu do topo da capela (mundo) — o som */ aoRaio?: (em: THREE.Vector3) => void; /** a 1ª bulha do coração (mundo: o globo) — o som */ aoBater?: (em: THREE.Vector3) => void; /** caiu um raio da tempestade do templo (mundo) — o trovão */ aoTrovao?: (em: THREE.Vector3) => void }): CidadeHandle {
  const { low, starTex } = opts;
  const rm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const raiz = new THREE.Group();
  const ilha = new THREE.Group(); ilha.position.set(CIDADE.centro.x, CIDADE.pisoY, CIDADE.centro.z); raiz.add(ilha);
  const alvos: THREE.Object3D[] = [];
  // os NÍVEIS (lib/cyber/nivelAtivo): a central (o hub) e cada sala num grupo próprio — só o do nível da pessoa aparece.
  // Cada um é um LIMITE dos lotes estáticos (components/cyber/lotes): esconder um não leva pedaços dos outros junto
  const novoNivel = (nome: string) => { const g = new THREE.Group(); g.name = `nivel-${nome}`; g.userData.lote = "limite"; ilha.add(g); return g; };
  const hub = novoNivel("zaeon");
  const grupoSala = Object.fromEntries((Object.keys(CIDADE.salas) as NomeSala[]).map((n) => [n, novoNivel(n)])) as Record<NomeSala, THREE.Group>;
  const add = <T extends THREE.Object3D>(o: T, pai: THREE.Object3D = hub, alvo = false) => { pai.add(o); if (alvo) alvos.push(o); return o; };
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
  // SEM A MONTANHA INVERTIDA (out/2026, o dono: "as superfícies de baixo não existem"): a ilha é a LAJE de vidro — a
  // borda (uma casca de `H` m de rocha) e o fundo de vidro, de onde se vê o universo (e a praça, 40 m abaixo, pela borda)
  const casca = add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, low ? 64 : 128, 1, true), rocha), hub, true);
  casca.position.y = -H / 2 - 0.05; casca.renderOrder = SOB_O_VIDRO;
  // (os 3 espinhos, os andares de servidores com as janelas e os anéis, as estalactites e as quedas de luz saíram — o dono: a base da cidadela é LIMPA, só a rocha e a agulha)

  // ── piso: disco frio + anéis concêntricos + raios (a "rosa dos ventos" da cidade) ──
  // o PISO é de VIDRO, no material da cúpula da capela: o universo aparece em cima e embaixo, e as linhas e as veias
  // azuis do coração (CoracaoZaeon) correm por cima dele. Um disco só (uma face, sem bordas): desenhado ANTES de todo
  // transparente e sem gravar profundidade, então o que está embaixo (janelas, estalactites, estrelas) aparece através
  // dele. Continua alvo do clique/câmera (o raycast não olha a opacidade)
  const piso = add(new THREE.Mesh(new THREE.CircleGeometry(R, low ? 64 : 128), vidro({ color: 0x0a1830, emissive: 0x2a4a80, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, side: THREE.DoubleSide }, 0.4)), hub, true);   // (dupla face: de baixo, a laje de vidro)
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
    const torre = add(new THREE.Mesh(new THREE.CylinderGeometry(2.6, TORRES_MURALHA.rBase, ATR, 8), torreMat), hub, true); torre.position.set(x, ATR / 2, z);
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
    const pil = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(1.9, 2.4, CA, 10), torreMat, cidadela.pilares), hub, true);
    { const m = new THREE.Matrix4(); for (let i = 0; i < cidadela.pilares; i++) { const a = (i / cidadela.pilares) * Math.PI * 2; pil.setMatrixAt(i, m.makeTranslation(Math.cos(a) * cidadela.r, CA / 2, Math.sin(a) * cidadela.r)); } pil.instanceMatrix.needsUpdate = true; pil.computeBoundingSphere(); }
    const coroaMat = new THREE.MeshStandardMaterial({ color: 0x0c1a30, emissive: 0x66c8ff, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.4 });
    { const t = add(new THREE.Mesh(new THREE.TorusGeometry(cidadela.r, 1.4, 8, low ? 96 : 192), coroaMat)); t.rotation.x = Math.PI / 2; t.position.y = CA; }   // (só a coroa do alto: o anel azul de baixo saiu — o dono, out/2026)
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
    if (!low) { const feixe = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 4.5, 120, 16, 1, true), farolMat)); feixe.position.y = yFarol + 60; } else farolMat.dispose();   // (leve: sem o cone de luz de 120 m)
    farol = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glow("rgba(220,250,255,1)", "rgba(120,200,255,.4)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); farol.scale.set(22, 22, 1); farol.position.y = yFarol;
  }

  // o GLOBO no centro da capela: mesa redonda + esfera de pontos de luz girando + um anel em volta
  const mesaGlobo = add(new THREE.Mesh(new THREE.CylinderGeometry(CIDADE.mesaHolo.r, CIDADE.mesaHolo.r * 1.1, 2.2, 32), new THREE.MeshStandardMaterial({ color: 0x10213e, emissive: 0x2b6bd0, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 })), hub, true) as THREE.Mesh; mesaGlobo.position.y = 1.1;
  const RG = GLOBO_CAPELA.r, YG = GLOBO_CAPELA.y, NG = low ? 420 : 900, gp = new Float32Array(NG * 3);
  for (let i = 0; i < NG; i++) { const u = Math.random() * 2 - 1, th = Math.random() * 6.283, s = Math.sqrt(1 - u * u); gp[i * 3] = s * Math.cos(th) * RG; gp[i * 3 + 1] = YG + u * RG; gp[i * 3 + 2] = s * Math.sin(th) * RG; }
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute("position", new THREE.BufferAttribute(gp, 3));
  const globo = add(new THREE.Points(gGeo, new THREE.PointsMaterial({ size: 0.22, map: starTex, color: 0x8fe8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const aroGlobo = add(new THREE.Mesh(new THREE.TorusGeometry(RG * 1.35, 0.12, 6, 96), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
  aroGlobo.position.y = YG; aroGlobo.rotation.x = Math.PI / 2 - 0.35;

  // ── as ESCADAS DE PEDRA (out/2026, no lugar dos fios de energia): o estilo de El Castillo — degraus, balaustradas,
  //    cabeças de serpente no pé e a muralha embaixo; a Sala do Saber no topo da pirâmide (components/cyber/EscadaPiramide) ──
  const COR_SALA: Record<NomeSala, number> = { lounge: 0xb98cff, garagem: 0xffb46b, biblioteca: 0x7fb8ff, jardim: 0x7dffb0 };
  if (!NIVEIS_SEPARADOS) { const ep = criarEscadasDePedra({ low, cores: COR_SALA }); add(ep.group); alvos.push(...ep.alvos); }   // (níveis separados: sem escadas — os fios cósmicos e os buracos negros)
  // ── as PISTAS CÓSMICAS (no lugar das escadas): o fluxo de luz até o buraco negro massivo de cada canto (components/cyber/FiosCosmicos) ──
  const fios = NIVEIS_SEPARADOS ? criarFiosCosmicos({ low, cores: COR_SALA, starTex, alcanceVista: low ? 1800 : 3600, aoTrovao: (p) => { if (opts.aoTrovao) { hub.updateMatrixWorld(); opts.aoTrovao(p.clone().applyMatrix4(hub.matrixWorld)); } } }) : null;
  const euLocal = { x: 0, y: -1e4, z: 0 };   // (onde a pessoa está, local da ilha — o engine conta a cada quadro)
  if (fios) { add(fios.group, ilha); alvos.push(...fios.alvos); fios.group.traverse((n) => { n.userData.semLote = true; }); }   // (anima: fora dos lotes)
  // ── o TRÁFEGO DO CÉU: carros e motos pelos anéis de voo, saindo e entrando nos buracos negros (components/cyber/TrafegoCeu) ──
  // (o TRÁFEGO de mentira das pistas saiu — out/2026, o dono: "queremos fluxo real; vemos isso depois" — `TRAFEGO_NO_CEU`)
  const trafego = NIVEIS_SEPARADOS && TRAFEGO_NO_CEU ? criarTrafegoCeu({ low, starTex }) : null;
  if (trafego) { add(trafego.group, ilha); trafego.group.traverse((n) => { n.userData.semLote = true; }); }
  // ── as SALAS (os níveis — lib/cyber/nivelAtivo): cada uma é MONTADA só quando a pessoa entra nela e DESMONTADA quando
  //    sai (com os níveis separados, só o nível da pessoa existe de verdade: carrega um de cada vez — o jogo leve em
  //    qualquer máquina). Sem os níveis, todas montam no carregamento, como antes ──
  const vidroSala = vidro({ color: 0x0a1830, emissive: 0x2a3a70, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3, transmission: 0.3, thickness: 1, transparent: true, opacity: 0.32, side: THREE.DoubleSide }, 0.3);
  // os ESTACIONAMENTOS das IAs (pra fora de cada sala; as motos paradas são do components/cyber/FrotaIA): criados uma vez,
  // cada um guardado pra sala mais perto (entra junto com ela); os do piso da central ficam no hub
  const pisosDaSala = new Map<NomeSala, THREE.Object3D[]>();
  { const pe = criarPisosEstudo({ low, onde: "zaeon" });
    for (const c of [...pe.children]) {
      const p = c.position; if (p.y < 30) { add(c); continue; }
      let melhor: NomeSala = "lounge", dm = Infinity;
      for (const n of Object.keys(CIDADE.salas) as NomeSala[]) { const L = CIDADE.salas[n], d = Math.hypot(p.x - L.x, p.z - L.z); if (d < dm) { dm = d; melhor = n; } }
      pe.remove(c); pisosDaSala.set(melhor, [...(pisosDaSala.get(melhor) ?? []), c]);
    } }
  type SalaViva = { salas: SalasHandle; templo: ReturnType<typeof criarTemplo> | null; salao: SalaoCosmicoHandle | null; estacs: ReturnType<typeof criarPisoEstacionamento>[]; tempestade: { h: ReturnType<typeof criarTempestade>; g: THREE.Group } | null; saida: ReturnType<typeof criarFiosCosmicos> | null; texturas: THREE.Texture[]; alvos: THREE.Object3D[]; extras: THREE.Object3D[] };
  const vivas = new Map<NomeSala, SalaViva>();
  function montarSala(n: NomeSala): SalaViva {
    const ja = vivas.get(n); if (ja) return ja;
    const g = grupoSala[n], L = CIDADE.salas[n], tex: THREE.Texture[] = [], meus: THREE.Object3D[] = [], extras: THREE.Object3D[] = [];
    const por = <T extends THREE.Object3D>(o: T, alvo = false) => { g.add(o); extras.push(o); if (alvo) meus.push(o); return o; };
    // a PLATAFORMA (a laje de gelo com o aro de luz)
    const base = por(new THREE.Group()); base.position.set(L.x, ALTURA_LOUNGE, L.z);
    const laje = new THREE.Mesh(new THREE.CylinderGeometry(L.r + 1, L.r - 1, 1.8, low ? 48 : 96), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.25 })); laje.position.y = -0.95; base.add(laje); meus.push(laje);
    const aroL = new THREE.Mesh(new THREE.TorusGeometry(L.r + 1, 0.3, 6, low ? 64 : 128), new THREE.MeshBasicMaterial({ color: COR_SALA[n], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending })); aroL.rotation.x = Math.PI / 2; aroL.position.y = -0.1; base.add(aroL);
    // o CONTEÚDO (o Salas): só esta sala
    const antes = new Set(g.children);
    const salas = criarSalas(ilha, { paiDaSala: () => g, apenas: [n], low, texturas: tex, estrela: starTex, paredeMat: vidroSala, aoTrovao: opts.aoTrovao }); meus.push(...salas.alvos);
    for (const c of g.children) if (!antes.has(c) && !extras.includes(c)) extras.push(c);   // (o que o Salas pôs no grupo da sala)
    // o TEMPLO (lib/cyber/templo — no referencial do lounge)
    let templo: SalaViva["templo"] = null;
    let salao: SalaViva["salao"] = null;
    if (n === "lounge") {
      templo = criarTemplo({ low, paredeMat: vidroSala, estrela: starTex, aoTrovao: opts.aoTrovao }); templo.group.position.set(L.x, ALTURA_LOUNGE, L.z); templo.group.rotation.y = rotDaSala(L); if (espelhoDe(L)) templo.group.scale.x = -1; por(templo.group); meus.push(...templo.alvos);
      // o SALÃO central do Templo Cósmico (lib/cyber/temploCosmico): a chegada, a pirâmide e a ponte pro lounge
      salao = criarSalaoCosmico({ low, paredeMat: vidroSala }); salao.group.position.set(L.x, ALTURA_LOUNGE, L.z); salao.group.rotation.y = rotDaSala(L); if (espelhoDe(L)) salao.group.scale.x = -1; por(salao.group); meus.push(...salao.alvos); salao.cupula(cupulaAberta);
    }
    // os ESTACIONAMENTOS da GARAGEM (o piso; as motos e os robôs são do engine)
    const estacs = n !== "garagem" ? [] : LOTES.filter((l) => l.id === "garagem").map((l) => { const e = criarPisoEstacionamento({ low, parado: rm, lote: l }); e.group.position.set(l.x - CIDADE.centro.x, l.alt, l.z - CIDADE.centro.z); e.group.rotation.y = l.rot; por(e.group, true); return e; });
    for (const c of pisosDaSala.get(n) ?? []) por(c);
    // a TEMPESTADE do ritual no topo (a biblioteca e o jardim)
    let tempestade: SalaViva["tempestade"] = null;
    if (n === "biblioteca" || n === "jardim") {
      const tg = por(new THREE.Group()); tg.position.set(L.x, 0, L.z);
      const h = criarTempestade({ low, yBase: ALTURA_LOUNGE + 24, yTopo: ALTURA_LOUNGE + 44, raioMax: L.r + 24, alvoPonta: new THREE.Vector3(0, ALTURA_LOUNGE + 26, 0), nuvens: low ? 28 : 60 });
      tg.add(h.group); h.group.traverse((x) => { x.userData.semLote = true; }); h.definir(ritualAgora.i, ritualAgora.raios); tempestade = { h, g: tg };
    }
    // a PISTA DE SAÍDA (o fluxo da porta antiga até o buraco negro que leva de volta pro hub)
    const saida = NIVEIS_SEPARADOS ? criarFiosCosmicos({ pistas: [saidaDaSala(n)], low, cores: COR_SALA, starTex, alcanceVista: low ? 1800 : 3600, aoTrovao: (p) => { if (opts.aoTrovao) { g.updateMatrixWorld(); opts.aoTrovao(p.clone().applyMatrix4(g.matrixWorld)); } } }) : null;
    if (saida) { por(saida.group); saida.group.traverse((x) => { x.userData.semLote = true; }); saida.vista(vistaAgora); }
    alvos.push(...meus);
    const v: SalaViva = { salas, templo, salao, estacs, tempestade, saida, texturas: tex, alvos: meus, extras };
    if (n === "lounge" && recadoAgora) salas.mostrarRecado(recadoAgora);
    vivas.set(n, v); return v;
  }
  function desmontarSala(n: NomeSala) {
    const v = vivas.get(n); if (!v) return;
    vivas.delete(n);
    for (const a of v.alvos) { const k = alvos.indexOf(a); if (k >= 0) alvos.splice(k, 1); }
    v.templo?.dispose(); v.salao?.dispose(); v.tempestade?.h.dispose(); v.saida?.dispose();
    const guardar = new Set(pisosDaSala.get(n) ?? []);   // (os estacionamentos voltam pra gaveta: montam de novo na próxima)
    for (const o of v.extras) { o.removeFromParent(); if (!guardar.has(o)) liberar(o, []); }
    for (const t of v.texturas) t.dispose();
    // os LOTES que o engine fundiu (components/cyber/lotes) penduram direto no grupo da sala: saem junto
    for (const o of [...grupoSala[n].children]) if (o.name === "lote") { o.removeFromParent(); (o as THREE.Mesh).geometry?.dispose(); }
  }
  const vivaLounge = () => vivas.get("lounge") ?? null;
  let cupulaAberta = false;
  let vistaAgora = low ? 1800 : 3600;   // (o alcance da câmera agora: quem monta uma sala depois já começa certo)   // (a porta da cúpula da guardiã: quem monta o lounge depois já abre/fecha certo)
  let recadoAgora: string | null = null;   // (o recado da TV do lounge: quem monta o lounge depois já mostra)
  // (o estado do ritual: quem monta uma sala no meio dele já começa com a fumaça certa)
  const ritualAgora = { i: 0, raios: false };
  if (!NIVEIS_SEPARADOS) for (const n of Object.keys(CIDADE.salas) as NomeSala[]) montarSala(n);   // (o modo antigo: tudo junto)

  // ── as CABINES DE ESTUDO da hierarquia (professores junto dos pilares da capela, doutores atrás, mestrandos depois —
  //    lib/cyber/credenciais; os graduandos estudam no chão em volta das supertrees) ──
  add(criarCabinesEstudo({ low }).group);

  // ── o BURACO NEGRO da cidade: o nó central da rede de túneis (pisou no anel = escolhe o destino) ──
  const pt = CIDADE.portalTunel, bnc = criarBuracoPortal(hub, { x: pt.x, y: 0, z: pt.z, anelR: pt.r, h: NOS.zaeon.bh.h, r: NOS.zaeon.bh.r, low, starTex });
  texturas.push(...bnc.texturas);
  // o pedestal escuro em volta do anel (o anel fica rente ao piso)
  add(new THREE.Mesh(new THREE.CylinderGeometry(pt.r + 1.4, pt.r + 1.7, 0.18, 40), new THREE.MeshStandardMaterial({ color: 0x14203a, emissive: 0x1b2b55, emissiveIntensity: 0.5 })), hub, true).position.set(pt.x, -0.06, pt.z);

  // ── querubins orbitando a cidadela ──
  const CN = low ? 0 : 180, cher = Array.from({ length: CN }, () => ({ a: Math.random() * 6.283, r: CIDADE.cidadela.r + 6 + Math.random() * 90, y: 6 + Math.random() * 70, sp: 0.02 + Math.random() * 0.07 }));
  const cGeo = new THREE.BufferGeometry(); cGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(CN * 3), 3));
  const cPts = add(new THREE.Points(cGeo, new THREE.PointsMaterial({ size: 0.3, map: starTex, color: 0xeaf4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }))); cPts.frustumCulled = false; cPts.visible = CN > 0;   // (leve: sem os querubins)

  // ── ilhotas flutuantes em volta (montanhas invertidas + cristais na BORDA), cada uma com sua flutuação ──
  //    Layout FIXO em lib/cyber/ceu.ts (ILHOTAS) — o mesmo da colisão: dá pra pousar no topo e andar nele.
  //    Todas aparecem (também no celular): a colisão tem que ser a mesma pra todo mundo.
  const ilhotas: { g: THREE.Group; y0: number; ph: number }[] = [];
  const extrasDoHub: THREE.Object3D[] = [];   // (fora da `ilha`, mas do hub: as ilhotas)
  const cristalMat = new THREE.MeshStandardMaterial({ color: 0x0a1626, emissive: 0x66e6ff, emissiveIntensity: 1.1, roughness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
  ILHOTAS.forEach((il, k) => {
    const rr = il.r, y0 = CIDADE.pisoY + il.dy;
    const g = new THREE.Group(); g.position.set(CIDADE.centro.x + il.x, y0, CIDADE.centro.z + il.z); raiz.add(g);
    // piso: a face de CIMA fica exatamente na altura do grupo (= a altura da colisão)
    const topo = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, 0.4, low ? 8 : 16), new THREE.MeshStandardMaterial({ color: 0x0a2440, emissive: COLD, emissiveIntensity: 0.3 })); topo.position.y = -0.2; g.add(topo);
    const aro = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.1, 0.06, 6, 48), new THREE.MeshBasicMaterial({ color: COLD, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })); aro.rotation.x = Math.PI / 2; aro.position.y = 0.02; g.add(aro);
    for (let j = 0; j < 5; j++) { const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + ((j * 37 + k * 11) % 10) / 16), cristalMat); cr.scale.y = 2 + ((j * 13 + k) % 10) / 7; const aa = (j / 5) * 6.283 + k, d = rr * 0.86; cr.position.set(Math.cos(aa) * d, 1.1, Math.sin(aa) * d); g.add(cr); }
    ilhotas.push({ g, y0, ph: il.fase });
    extrasDoHub.push(g);
  });

  // ── a FUMAÇA E OS TROVÕES do ritual (lib/cyber/ritual) no topo da CAPELA e das SALAS DE ESTUDO (o templo tem a dele e o
  //    lounge, a névoa do show): nuvens girando e raios caindo — o som é do engine (`aoTrovao`) ──
  const tempestades: { h: ReturnType<typeof criarTempestade>; g: THREE.Group }[] = [];
  { const yP = inicioDaPonta(), L = CAPELA.pontaLen;
    const nova = (x: number, z: number, y0: number, y1: number, raio: number, alvoY: number, nuvens: number, dono?: NomeSala) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); (dono ? grupoSala[dono] : hub).add(g);
      const h = criarTempestade({ low, yBase: y0, yTopo: y1, raioMax: raio, alvoPonta: new THREE.Vector3(0, alvoY, 0), nuvens });
      g.add(h.group); h.group.traverse((n) => { n.userData.semLote = true; }); h.definir(0, false); tempestades.push({ h, g });
    };
    if (CAPELA_NA_ZAEON) nova(0, 0, yP + L * 0.25, yP + L * 0.85, 150, yP + L * 0.7, low ? 50 : 110);   // a capela (a ponta fura a fumaça)
  }
  const ondeTrovejou = new THREE.Vector3();

  // o CORAÇÃO (o globo bate; veias azuis por toda a cidade e subindo a capela; o raio no topo) e as ESTAÇÕES DOS AGENTES
  const coracao = CAPELA_NA_ZAEON ? criarCoracao({ low }) : null; if (coracao) hub.add(coracao.group);
  const estacoes = ESTACOES_NA_CAPELA ? criarEstacoes({ low }) : null; if (estacoes) hub.add(estacoes.group);   // (saíram na reforma da capela)
  // o OBSERVATÓRIO DA TERRA + os 4 AUTÓDROMOS (lib/cyber/terra) e os DROIDS OBSERVADORES
  const distrito = criarDistritoTerra({ low, parado: rm }); hub.add(distrito.group); alvos.push(...distrito.alvos);
  const observadores = criarObservadores({ low }); hub.add(observadores.group);
  // fora do lote estático (lotes.ts): o coração (pulsa por EVENTO — o raio — que a simulação da montagem não vê), as
  // estações (já instanciadas) e os droids (andam). O distrito entra: anima pelo relógio (a simulação vê) e materiais compartilhados
  for (const g of [...(coracao ? [coracao.group] : []), ...(estacoes ? [estacoes.group] : []), observadores.group]) g.traverse((n) => { n.userData.semLote = true; });
  const matGlobo = globo.material as THREE.PointsMaterial, matMesa = mesaGlobo.material as THREE.MeshStandardMaterial, matAro = aroGlobo.material as THREE.MeshBasicMaterial;
  const topoMundo = new THREE.Vector3(), globoMundo = new THREE.Vector3();

  const rotulo = document.createElement("div"); rotulo.style.cssText = ROTULO_CSS; rotulo.textContent = "Zaeon";
  const fogoAmp = rm ? 0.12 : 1, vel = rm ? 0.2 : 1;

  return {
    group: raiz, ilha, rotulo, alvos,
    mostrarNivel(n) {
      const tudo = n === null;
      hub.visible = tudo || n === "zaeon"; for (const e of extrasDoHub) e.visible = hub.visible;
      // as PISTAS, os buracos negros dos cantos e o TRÁFEGO são o CÉU: aparecem de qualquer nível aberto (a praça, a Solana)
      const ceu = tudo || n === "zaeon" || n === "praca" || n === "solana"; if (fios) fios.group.visible = ceu; if (trafego) trafego.group.visible = ceu;
      for (const nome of Object.keys(grupoSala) as NomeSala[]) grupoSala[nome].visible = tudo || n === nome;
    },
    jogadorEm(p) { euLocal.x = p.x - CIDADE.centro.x; euLocal.y = p.y - ilha.position.y; euLocal.z = p.z - CIDADE.centro.z; },
    grupoDoNivel: (n) => (n === "zaeon" ? hub : grupoSala[n]), portalTunel: bnc.alvo,
    // (as salas montam e desmontam: o que é delas vem da que está MONTADA agora)
    montarSala: (n) => { montarSala(n); }, desmontarSala, salaMontada: (n) => vivas.has(n),
    get tvLounge() { return vivaLounge()?.salas.tv ?? null; }, get plataformas() { return [...vivas.values()].flatMap((v) => v.salas.plataformas); },
    get caixasLounge() { return vivaLounge()?.salas.caixas ?? []; }, get caixasAmbiente() { return [...vivas.values()].flatMap((v) => v.salas.ambiente); }, get caixasEstudo() { return vivaLounge()?.salao?.caixasEstudo ?? []; }, raiosCampus() { return vivaLounge()?.salao?.raiosCampus() ?? []; }, capsulaDentro(id) { vivaLounge()?.salao?.capsulaDentro(id); }, estilhacos() { return vivaLounge()?.salao?.estilhacos() ?? []; }, get tocaDiscos() { return vivaLounge()?.salas.tocaDiscos ?? null; },
    somTocando: (on: boolean, nivel?: number) => { for (const v of vivas.values()) v.salas.somTocando(on, nivel); }, alturaIlhota: (k: number) => ilhotas[k]?.g.position.y ?? CIDADE.pisoY, presencas: (p) => distrito.presencas(p), mostrarRecadoNaTV: (t: string | null) => { recadoAgora = t; vivaLounge()?.salas.mostrarRecado(t); }, cupulaAberta: (aberta: boolean) => { cupulaAberta = aberta; vivaLounge()?.salao?.cupula(aberta); }, vistaCosmica: (m: number) => { vistaAgora = m; fios?.vista(m); for (const v of vivas.values()) v.saida?.vista(m); },
    somDroids: observadores.emissores,
    showLounge: (e, ritual, olho) => vivaLounge()?.salas.show(e, ritual, olho),
    raioNoLounge: (vel, alvo) => vivaLounge()?.salas.raioNoLounge(vel, alvo),
    tempestade: (i, raios, torre = 0) => {
      ritualAgora.i = i; ritualAgora.raios = raios;
      vivaLounge()?.templo?.tempestade(Math.max(i, torre), raios || torre > 0.2);
      for (const tp of tempestades) tp.h.definir(i, raios);
      for (const v of vivas.values()) v.tempestade?.h.definir(i, raios);
    },
    escadaria: (v) => vivaLounge()?.templo?.escadaria(v),
    batidasLounge: () => vivaLounge()?.salas.batidas() ?? 0, pulsoLounge: () => vivaLounge()?.salas.pulso() ?? 0,
    raioNoTemplo: (alvo) => vivaLounge()?.templo?.raioAgora(alvo),
    atualizar(dt, t) {
      // a ilha BOIA (25 cm, ciclo de ~21 s): só move quando andou 1 cm — mexer nela força recalcular as matrizes dos
      // ~1.300 nós da cidade; a cada quadro andaria menos de meio milímetro (components/cyber/matrizes)
      { const y = CIDADE.pisoY + Math.sin(t * 0.3) * 0.25 * vel; if (Math.abs(y - ilha.position.y) > 0.01) ilha.position.y = y; }
      for (const f of fogos) { const p = 0.72 + 0.28 * Math.sin(t * 1.8 + f.ph) * fogoAmp; f.s.scale.set(3.4 * (0.9 + p * 0.25), 5 * (0.8 + p * 0.4), 1); (f.s.material as THREE.SpriteMaterial).opacity = 0.5 + 0.3 * p; }
      if (quente) quente.intensity = 1.4 + 0.3 * Math.sin(t * 1.6) * fogoAmp;
      if (brasa) (brasa.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.15 * Math.sin(t * 1.4) * fogoAmp;
      pontas.forEach((p, i) => { (p.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.3 + 0.4 * Math.sin(t * 1.2 + i); p.rotation.y += dt * 0.4 * vel; });
      if (farol) farol.material.opacity = 0.75 + 0.2 * Math.sin(t * 1.1);
      // (os NÍVEIS escondidos nem animam — só o da pessoa: components/cyber/Cidade `mostrarNivel`)
      for (const [n, v] of vivas) {
        if (!grupoSala[n].visible) continue;
        v.salas.atualizar(dt, t); v.templo?.atualizar(dt, t); v.salao?.atualizar(dt, t);
        for (const e of v.estacs) e.atualizar(t);
        if (v.tempestade && v.tempestade.h.group.visible) { const c = v.tempestade.h.atualizar(t); if (c && opts.aoTrovao) { v.tempestade.g.updateMatrixWorld(); opts.aoTrovao(ondeTrovejou.copy(c).applyMatrix4(v.tempestade.g.matrixWorld)); } }
        v.saida?.atualizar(dt * vel, t, euLocal);
      }
      for (const tp of tempestades) { if (!tp.h.group.visible || !tp.g.parent?.visible) continue; const c = tp.h.atualizar(t); if (c && opts.aoTrovao) { tp.g.updateMatrixWorld(); opts.aoTrovao(ondeTrovejou.copy(c).applyMatrix4(tp.g.matrixWorld)); } }
      if (hub.visible) {
      globo.rotation.y += dt * 0.25 * vel; aroGlobo.rotation.z += dt * 0.2 * vel;
      // o CORAÇÃO bate: o globo incha de luz, a mesa e o aro acendem; o pulso corre nas veias; o raio sai do topo
      { const ev = coracao ? coracao.atualizar(dt, t) : { raio: false, tum: false }, b = coracao ? coracao.batida() : 0;
        matGlobo.size = 0.22 * (1 + 0.9 * b); matMesa.emissiveIntensity = 0.6 + 1.6 * b; matAro.opacity = 0.55 + 0.4 * b;
        estacoes?.atualizar(dt, t, b);
        distrito.atualizar(dt, t); observadores.atualizar(dt);
        if (ev.raio && opts.aoRaio) { const tp = TOPO_DA_CAPELA(); opts.aoRaio(topoMundo.set(tp.x, tp.y, tp.z).applyMatrix4(ilha.matrixWorld)); }
        if (ev.tum && opts.aoBater) opts.aoBater(globoMundo.set(0, GLOBO_CAPELA.y, 0).applyMatrix4(ilha.matrixWorld)); }
      bnc.atualizar(dt * vel, t);
      // querubins
      { const a = cGeo.attributes.position!.array as Float32Array;
        cher.forEach((c, i) => { c.a += dt * c.sp * vel; a[i * 3] = Math.cos(c.a) * c.r; a[i * 3 + 1] = c.y + Math.sin(t * 0.5 + i) * 0.3; a[i * 3 + 2] = Math.sin(c.a) * c.r; });
        cGeo.attributes.position!.needsUpdate = true; }
      ilhotas.forEach((il, i) => { il.g.position.y = il.y0 + Math.sin(t * 0.25 + il.ph) * BOIA_ILHOTA * vel; il.g.rotation.y += dt * 0.01 * (i % 2 ? 1 : -1) * vel; });
      }   // (fim do que é do hub)
      if (fios?.group.visible) fios.atualizar(dt * vel, t, euLocal);
      if (trafego?.group.visible) trafego.atualizar(Date.now() / 1000);   // (o relógio de TODO MUNDO: o mesmo trânsito pra quem olha)
    },
    dispose() { rotulo.remove(); fios?.dispose(); for (const n of [...vivas.keys()]) desmontarSala(n); trafego?.dispose(); for (const tp of tempestades) tp.h.dispose(); coracao?.dispose(); estacoes?.dispose(); distrito.dispose(); observadores.dispose(); liberar(raiz, texturas); },
  };
}
