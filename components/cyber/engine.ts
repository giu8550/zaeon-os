/**
 * CyberEngine — a cena RPG do cyberespaço (HANDOFF lounge cósmico): três.js imperativo, isolado do React.
 * Cenário fixo (CenaCosmica) + uma BASE DE ESTUDO por pessoa (BaseEstudo, fixa e privada) + "seres de luz"
 * (AvatarLuz). Movimento WASD/joystick/clique, correr, pular, câmera orbital livre (+pinça), colisão que desliza
 * na borda das bases, sentar ao parar na própria base, monitor destacável (hover) que leva à Sala de Estudos.
 * Rede = só o que o hook de sala entrega (remotos + enviarPos); aqui não há fetch/Pusher.
 */
import * as THREE from "three";
import { corDaArmadura } from "@/lib/cyber/cores";
import { BASE_COLLIDER_R, BASE_INTERACT_R, baseNoQG, basesDosMembros, localParaMundo, spawnDaBase, type LayoutBase, type NivelBase } from "@/lib/cyber/bases";
import { empurrarParaFora, type Colisor } from "@/lib/cyber/colisao";
import { decidirClique, rotuloMonitor } from "@/lib/cyber/clique";
import { POIS, bordaDoPOI, colisoresDosPOIs, marcoNav, poiPerto, type POI } from "@/lib/cyber/landmarks";
import { alturaEm, colisoresDoAlto, deEscada, resolverPasso, type MarcoNav } from "@/lib/cyber/nav";
import { limitarPitch, poseDaCamera } from "@/lib/cyber/camera";
import { CIDADE, computadorPerto, mundo, noPortalEntrada, noPortalVolta, resolverCidade } from "@/lib/cyber/ceu";
import { VOO, chaoDoVoo, passoVooSub, pilaresDoMarco, type EstadoVoo, type Pilar } from "@/lib/cyber/voo";
import { pousoDoQG, rotaPara, seguirRota, type DestinoRota, type Waypoint } from "@/lib/cyber/rota";
import { criarCidade, type CidadeHandle } from "./Cidade";
import { criarNave, type NaveHandle } from "./Nave";
import { criarLandmark, type LandmarkHandle } from "./Landmark";
import { interpolar, moverRelativoCamera } from "@/lib/lounge3d/sala";
import type { Presenca } from "@/lib/lounge3d/tipos";
import { criarCenaCosmica, type CenaCosmicaHandle } from "./CenaCosmica";
import { TELA_BASE, criarBase, type BaseEstudoHandle } from "./BaseEstudo";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle } from "./AvatarLuz";

/**
 * Vêm do SERVIDOR (GET da sala), o cliente só pinta: `fundador` = dono — a base dele fica na ZAEON (a ilha no céu);
 * `qg` = Andrei Bacelar — a base dele fica no centro do salão do QG (o marco andável). Regalias são validadas na API.
 */
export type PessoaCyber = { id: string; name: string; color: string; fundador?: boolean; qg?: boolean };
export type CyberOpts = {
  container: HTMLElement;
  /** camada de tags/falas por cima do canvas (position:absolute; inset:0; pointer-events:none). */
  overlay: HTMLElement;
  els: { menu: HTMLElement | null; hold: HTMLElement | null; monLabel: HTMLElement | null };
  eu: PessoaCyber;
  /** todas as pessoas da sala, na ORDEM dos membros (define a base de cada uma). */
  membros: PessoaCyber[];
  /** começa em modo menu (personagem sentado contemplando; opção do monitor ou ESPAÇO = play). */
  menu: boolean;
  low: boolean;
  /** teclado sempre ouvido (tela cheia). Na janela da landing só com o mouse em cima (não rouba ESPAÇO/rolagem da página). */
  teclasSempre: boolean;
  remotos?: { current: Map<string, Presenca> };
  enviarPos?: (p: { x: number; z: number; facing: number; moving: boolean; sit: boolean; topo: boolean; ceu: boolean; voo?: { y: number; yaw: number }; naveParada?: { x: number; y: number; z: number; yaw: number } }) => void;
  /** pontos de interesse (marcos megalíticos) — flag NEXT_PUBLIC_CYBER_LANDMARKS */
  landmarks?: boolean;
  /** clicou num marco estando perto → painel (nome, org, link) */
  onLandmark?: (poi: POI) => void;
  /** entrou/saiu do topo da Zaeon (o React mostra o "Descer") */
  onTopo?: (noTopo: boolean) => void;
  /** tocou o PORTAL (clicou no buraco negro ou pisou no anel embaixo dele) → o React pede acesso ao servidor */
  onPortalCeu?: () => void;
  /** clicou na nave estando perto → o React pede acesso ao servidor e chama `embarcar()` */
  onEmbarcar?: () => void;
  /** estado da nave/cidade pra UI (botões Embarcar / Sair / Voltar) */
  onEstadoQG?: (s: { noCeu: boolean; navePerto: boolean; pilotando: boolean; pousado: boolean }) => void;
  /** HUD de voo (pilotando): altímetro — só quando muda (≤ 10×/s) */
  onVoo?: (h: { y: number }) => void;
  /** atalho de rota em andamento (piloto automático) ou null (chegou / cancelado) */
  onRota?: (destino: DestinoRota | null) => void;
  onPerto?: (perto: boolean) => void;
  onFalarCom?: (nome: string | null) => void;
  onEntrarEstudo?: () => void;
  onSessao?: (go: string) => void;
  onPronto?: () => void;
};

type Ator = { id: string; name: string; color: string; av: AvatarLuzHandle; pos: THREE.Vector3; facing: number; moving: boolean; sit: number; tag: HTMLDivElement; alt: number;
  /** remotos: no topo da Zaeon / na cidade / pilotando (só valem pra quem o servidor marcou fundador) */
  topo?: boolean; ceu?: boolean; nave?: NaveHandle | null; naveYaw?: number;
  /** a nave dele pousada FORA do hangar (ele já saiu dela): fica parada ali, à vista de todos */
  naveP?: { x: number; y: number; z: number; yaw: number } | null };
type Fala = { el: HTMLDivElement; ator: Ator; ate: number };

/** cor da mesa do QG quando o Andrei não está na sala */
const COR_QG = "#ffd36b";
const TAG_CSS = "position:absolute;transform:translate(-50%,-100%);font:700 11px system-ui,sans-serif;padding:2px 8px;border-radius:999px;background:rgba(10,8,30,.62);border:1px solid rgba(160,140,255,.3);white-space:nowrap;pointer-events:none;";
const FALA_CSS = "position:absolute;transform:translate(-50%,-100%);max-width:200px;font:12.5px system-ui,sans-serif;color:#eee8ff;background:rgba(14,12,36,.82);border:1px solid;padding:6px 10px;border-radius:12px;pointer-events:none;overflow-wrap:anywhere;";

export class CyberEngine {
  private o: CyberOpts;
  private R: THREE.WebGLRenderer;
  private cam: THREE.PerspectiveCamera;
  private cena: CenaCosmicaHandle;
  private bases = new Map<string, BaseEstudoHandle>();
  private layouts = new Map<string, LayoutBase>();
  /** a mesa + cristais do QG do Andrei: fazem PARTE do QG (centro do salão) mesmo quando ele não está nesta sala */
  private baseQG: BaseEstudoHandle | null = null;
  private colisores: Colisor[] = [];
  private pessoas = new Map<string, PessoaCyber>();
  /** ids na ORDEM canônica dos membros (define a base de cada um). */
  private ordem: string[] = [];
  /** marcos megalíticos (Zaeon…) e o estado "no topo da Zaeon" do dono */
  private lms: LandmarkHandle[] = [];
  private noTopo = false;
  /** em qual marco andável estou no ALTO (escada/plataforma), e a altura do chão sob mim */
  private altoEm: string | null = null; private yNav = 0;
  /** clique na escada vindo do chão: primeiro o pé, depois o ponto clicado */
  private alvoDepois: THREE.Vector2 | null = null;
  /** CIDADE ZAEON (céu) + a NAVE do dono */
  private cidade: CidadeHandle | null = null;
  private nave: NaveHandle | null = null;
  private naveEst: EstadoVoo = { ...mundo(CIDADE.hangar), y: CIDADE.pisoY, yaw: Math.PI, vx: 0, vy: 0, vz: 0 };
  private pilotando = false; private pousado = true; private voY = { subir: false, descer: false }; private yawAnt = 0;
  /** direcional na tela (desktop) e "Pousar" (desce sozinho até encostar; qualquer comando manual cancela) */
  private botDir = { x: 0, z: 0 }; private autoPouso = false; private rota: { destino: DestinoRota; pontos: Waypoint[] } | null = null; private cmdVoo = { subir: false, descer: false };
  /** HUD de voo em 3D/DOM: marcador de pouso, anel da borda da ilha, indicadores dos destinos */
  private hudVoo: { marca: THREE.Mesh; borda: THREE.Mesh; chave: string; t: number } | null = null;
  private portalArmado = true;   // o anel de entrada só dispara de novo depois de sair dele
  private estadoQG = "";
  private eu!: Ator;
  private remotos = new Map<string, Ator>();
  private falas: Fala[] = [];
  private raf = 0; private vivo = true; private visivel = true;
  private clock = new THREE.Clock();
  private ray = new THREE.Raycaster();
  private rayCam = new THREE.Raycaster();
  private ro: ResizeObserver; private io: IntersectionObserver | null = null;
  private w = 1; private h = 1;
  // estado de jogo
  private menu: boolean; private holdT = 0; private espaco = false;
  private keys: Record<string, boolean> = {}; private joy = { x: 0, y: 0, on: false }; private correr = false;
  private alvo: THREE.Vector2 | null = null;
  private jumpY = 0; private jumpVy = 0; private chao = true;
  private sitT = 0; private perto = false; private falandoCom: Ator | null = null;
  private hoverBase: string | null = null; private sobContainer = false;
  private camAz = 0; private camPitch = 0.16; private camDist = 9; private camT = new THREE.Vector3(0, 1.2, 0);
  private ptrs = new Map<number, { x: number; y: number }>(); private drag: { x: number; y: number; az: number; pitch: number } | null = null; private moved = false; private pinch0 = 0; private dist0 = 9;
  private prontoDisparado = false;
  private cleanups: Array<() => void> = [];

  private gltf: GLTF | null;

  /** Carrega o GLB humano (uma vez) e cria a engine. Se o modelo não carregar, os avatares ficam só com a luz/neurônios. */
  static async criar(opts: CyberOpts): Promise<CyberEngine> {
    const gltf = await carregarModeloAvatar().catch((e) => { console.warn("[cyber] avatar GLB não carregou:", e); return null; });
    return new CyberEngine(opts, gltf);
  }

  private constructor(opts: CyberOpts, gltf: GLTF | null) {
    this.o = opts; this.menu = opts.menu; this.gltf = gltf;
    const { container, low } = opts;
    this.w = Math.max(1, container.clientWidth); this.h = Math.max(1, container.clientHeight);
    this.R = new THREE.WebGLRenderer({ antialias: !low, powerPreference: "high-performance" });
    this.R.setPixelRatio(Math.min(low ? 1.25 : 1.5, window.devicePixelRatio || 1));   // tela retina a 2× custava ~78% mais pixels this.R.setSize(this.w, this.h, false);
    this.R.autoClear = false; this.R.outputColorSpace = THREE.SRGBColorSpace;
    const cv = this.R.domElement; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:" + (opts.menu ? "pan-y" : "none");
    container.appendChild(cv);
    this.cam = new THREE.PerspectiveCamera(45, this.w / this.h, 0.1, 900);
    this.cena = criarCenaCosmica(low, this.w / this.h);
    if (opts.landmarks) for (const poi of POIS) {
      const lm = criarLandmark(poi, { low, starTex: this.cena.starTex });
      this.cena.scene.add(lm.group); this.lms.push(lm);   // sem rótulo na tela (interface limpa); o nome sai no painel do clique
    }
    if (opts.landmarks) {
      this.cidade = criarCidade({ low, starTex: this.cena.starTex });
      this.cena.scene.add(this.cidade.group);
      this.nave = criarNave({ low, cor: "#2f7bff" }); this.cena.scene.add(this.nave.group);
      const marca = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 40), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      marca.rotation.x = -Math.PI / 2; marca.visible = false; this.cena.scene.add(marca);
      const borda = new THREE.Mesh(new THREE.TorusGeometry(CIDADE.bordaR, 0.14, 6, low ? 64 : 128), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      borda.rotation.x = Math.PI / 2; borda.position.set(CIDADE.centro.x, CIDADE.pisoY, CIDADE.centro.z); borda.visible = false; this.cena.scene.add(borda);
      this.hudVoo = { marca, borda, chave: "", t: 0 };
    }

    this.setPessoas([...opts.membros]);
    this.ligarEntradas();
    this.ro = new ResizeObserver(() => this.redimensionar()); this.ro.observe(container);
    if (typeof IntersectionObserver !== "undefined") { this.io = new IntersectionObserver((e) => { this.visivel = !!e[0]?.isIntersecting; }); this.io.observe(container); }
    this.clock.start();
    this.raf = requestAnimationFrame((t) => this.loop(t));
    if (process.env.NODE_ENV !== "production") (window as unknown as { __cyber?: CyberEngine }).__cyber = this;   // depuração em dev
  }
  /** estado pra depuração/testes em dev */
  get debug() { return { x: this.eu.pos.x, z: this.eu.pos.z, alt: this.eu.alt, altoEm: this.altoEm, noTopo: this.noTopo, pilotando: this.pilotando, pousado: this.pousado, nave: { ...this.naveEst } }; }

  /** Reconstrói bases/atores quando a lista de membros muda (alguém entrou na sala). */
  setPessoas(lista: PessoaCyber[]) {
    const ids = lista.map((p) => p.id);
    if (!ids.includes(this.o.eu.id)) { lista = [...lista, this.o.eu]; ids.push(this.o.eu.id); }
    for (const p of lista) this.pessoas.set(p.id, p);
    this.ordem = ids;
    // bases especiais (só com os marcos na cena): o dono na ZAEON (céu), o Andrei no centro do salão do QG
    const especiais = { ceu: this.cidade ? ids.filter((id) => this.ehFundador(id)) : [], qg: this.zaeon() ? ids.find((id) => this.pessoas.get(id)?.qg && !this.ehFundador(id)) ?? null : null };
    this.layouts = basesDosMembros(ids, undefined, especiais);
    for (const [id, lay] of this.layouts) {
      const existente = this.bases.get(id);
      if (existente) { if (existente.layout.x !== lay.x || existente.layout.z !== lay.z || existente.layout.nivel !== lay.nivel) existente.mover(lay); continue; }
      const b = criarBase(lay, this.corDe(id), this.cena.starTex, this.o.low);
      b.group.position.y = this.yDoNivel(lay.nivel);
      this.cena.scene.add(b.group); this.bases.set(id, b);
    }
    // o QG sempre tem a mesa e os cristais no centro do salão; se o Andrei está na sala, é a base dele (acima)
    const lqg = this.zaeon() && ![...this.layouts.values()].some((l) => l.nivel === "qg") ? baseNoQG() : null;
    if (lqg && !this.baseQG) { this.baseQG = criarBase(lqg, COR_QG, this.cena.starTex, this.o.low); this.baseQG.group.position.y = this.yDoNivel("qg"); this.cena.scene.add(this.baseQG.group); }
    if (!lqg && this.baseQG) { this.baseQG.dispose(); this.baseQG = null; }
    for (const a of [this.eu, ...this.remotos.values()]) { if (!a) continue; const c = this.corDe(a.id); if (c !== a.color) { a.color = c; a.av.recolorir(c); a.tag.style.color = c; } }
    // colisão: bases do anel + marcos (a MESMA lista; empurrarParaFora faz o deslizar)
    this.colisores = [...this.layouts.values()].filter((l) => !l.nivel).map((l) => ({ x: l.x, z: l.z, r: BASE_COLLIDER_R }))
      .concat(colisoresDosPOIs(this.lms.map((l) => l.poi).filter((poi) => !poi.nav)));   // marcos andáveis: lib/cyber/nav
    if (!this.eu) {
      const lay = this.layouts.get(this.o.eu.id), sp = spawnDaBase(lay);
      this.eu = this.novoAtor(this.o.eu, sp.x, sp.z);
      if (lay?.nivel) this.entrarNivel(lay.nivel);   // nasce lá em cima, na frente da própria base (Zaeon ou QG)
      if (this.menu) { const s = this.assento(); this.eu.pos.set(s.x, 0, s.z); this.eu.facing = this.rotAssento(); this.eu.sit = 1; this.sitT = 1; }
      else this.eu.facing = lay?.nivel ? this.rotAssento() + Math.PI : Math.atan2(-sp.x, -sp.z);
      this.camT.set(this.eu.pos.x, 1.2 + this.yDoNivel(lay?.nivel), this.eu.pos.z);
    }
  }

  /** Armadura: a minha é azul; a dos outros vem da ordem canônica dos membros (lib/cyber/cores). */
  private corDe(id: string) { return corDaArmadura(this.ordem, id, this.o.eu.id); }

  private novoAtor(p: PessoaCyber, x: number, z: number): Ator {
    const cor = this.corDe(p.id);
    const av = criarAvatarLuz(cor, this.cena.starTex, this.o.low, this.gltf);
    av.group.position.set(x, 0, z); this.cena.scene.add(av.group);
    const tag = document.createElement("div"); tag.style.cssText = TAG_CSS + "color:" + cor + ";"; tag.textContent = p.id === this.o.eu.id ? "" : p.name; this.o.overlay.appendChild(tag);   // o próprio avatar não leva rótulo
    return { id: p.id, name: p.name, color: cor, av, pos: new THREE.Vector3(x, 0, z), facing: 0, moving: false, sit: 0, tag, alt: 0 };
  }
  private removerAtor(a: Ator) { a.nave?.dispose(); a.nave = null; a.av.dispose(); a.tag.remove(); this.falas = this.falas.filter((f) => { if (f.ator === a) { f.el.remove(); return false; } return true; }); }

  // ───────────── API pública (React → engine) ─────────────
  iniciar(go = "viajar") {
    if (!this.menu) return; this.menu = false; this.holdT = 0;
    this.o.els.menu && (this.o.els.menu.style.display = "none"); if (this.o.els.hold) this.o.els.hold.style.width = "0%";
    this.R.domElement.style.touchAction = "none";
    this.o.onSessao?.(go);
  }
  setJoystick(x: number, y: number) { this.joy.x = x; this.joy.y = y; this.joy.on = Math.hypot(x, y) > 0.15; }
  alternarCorrer(): boolean { this.correr = !this.correr; return this.correr; }
  pular() { if (!this.menu && this.chao && !this.noTopo) { this.jumpVy = 6.5; this.chao = false; } }
  /** Balão de fala sobre a pessoa (chat da sala). */
  falar(userId: string, texto: string) {
    const a = userId === this.o.eu.id ? this.eu : this.remotos.get(userId); if (!a) return;
    this.falas = this.falas.filter((f) => { if (f.ator === a) { f.el.remove(); return false; } return true; });
    const el = document.createElement("div"); el.style.cssText = FALA_CSS + "border-color:" + a.color + ";"; el.textContent = texto.slice(0, 140);
    this.o.overlay.appendChild(el); this.falas.push({ el, ator: a, ate: performance.now() + 4200 });
  }
  get minhaBase(): LayoutBase | undefined { return this.layouts.get(this.o.eu.id); }
  /** altura do piso de um nível de base: chão, Zaeon (ilha no céu, flutuando) ou salão do QG (flutuando) */
  private yDoNivel(n?: NivelBase): number {
    if (n === "ceu") return this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY;
    if (n === "qg") { const z = this.zaeon(), mn = z ? marcoNav(z.poi) : null; return mn ? mn.nav.pisoY + this.boia(z) : 0; }
    return 0;
  }
  /** põe o meu avatar num nível fora do chão (sem pedir nada ao servidor: a base é minha — os outros só desenham
   *  alguém no céu se o SERVIDOR o marcou fundador) */
  private entrarNivel(n: NivelBase) {
    if (n === "ceu") { this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; this.portalArmado = false; return; }
    const z = this.zaeon(), mn = z ? marcoNav(z.poi) : null;
    if (z && mn) { this.altoEm = z.poi.id; this.yNav = mn.nav.pisoY; }
  }
  /** em que nível alguém está (pra base "acender" só com a pessoa no mesmo piso) */
  private nivelDe(id: string): NivelBase | "chao" | "topo" {
    if (id === this.o.eu.id) return this.noCeu ? "ceu" : this.noTopo ? "topo" : this.altoEm ? "qg" : "chao";
    const a = this.remotos.get(id); if (!a) return "chao";
    return a.ceu ? "ceu" : a.topo ? "topo" : a.alt > 2 ? "qg" : "chao";
  }
  /** colisores das bases de um nível fora do chão */
  private colisoresDoNivel(n: NivelBase) {
    const ls = [...this.layouts.values()].filter((l) => l.nivel === n);
    if (n === "qg" && this.baseQG) ls.push(this.baseQG.layout);
    return ls.map((l) => ({ x: l.x, z: l.z, r: BASE_COLLIDER_R }));
  }

  /** Subir ao topo da Zaeon. Só chamar DEPOIS do OK do servidor (POST /api/lounge3d/[id]/topo valida o fundador). */
  subir(): boolean {
    const z = this.zaeon(); if (!z || !this.ehFundador(this.o.eu.id) || this.menu) return false;
    const p = localParaMundo(this.eixoTopo()!, 0, 1.3 * this.escalaZaeon());
    this.noTopo = true; this.altoEm = null; this.alvo = null; this.alvoDepois = null; this.sitT = 0; this.jumpY = 0; this.jumpVy = 0; this.chao = true;
    this.eu.pos.set(p.x, 0, p.z); this.o.onTopo?.(true); return true;
  }
  /** Descer do topo: pousa no salão do QG (dentro das muralhas, perto do portão); sem chão andável, na borda. */
  descer() {
    const z = this.zaeon(); if (!z || !this.noTopo) return;
    const mn = marcoNav(z.poi);
    this.noTopo = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0;
    if (mn) { const q = deEscada(mn, mn.nav.muralhaR - 2.5, 0); this.eu.pos.set(q.x, 0, q.z); this.altoEm = z.poi.id; this.yNav = mn.nav.pisoY; }
    else { const b = bordaDoPOI(z.poi, { x: 0, z: 0 }); this.eu.pos.set(b.x, 0, b.z); }
    this.o.onTopo?.(false);
  }

  // ───────────── Cidade Zaeon (céu) e nave — chamar só DEPOIS do OK do servidor (ação privilegiada) ─────────────
  get noCeu() { return this.altoEm === "ceu"; }
  /** atravessa o portal: aparece na cidade, perto do portal de volta */
  entrarNoCeu() {
    if (!this.cidade || this.menu) return;
    const c = mundo(CIDADE.chegada);
    this.pilotando = false; this.noTopo = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0; this.jumpY = 0; this.chao = true;
    this.eu.pos.set(c.x, 0, c.z); this.eu.facing = Math.atan2(-CIDADE.chegada.x, -CIDADE.chegada.z);
    this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; this.portalArmado = false;
    this.camT.set(c.x, CIDADE.pisoY + 1.2, c.z);   // sem "voar" a câmera: corte seco (o React faz o fade)
  }
  /** portal de volta: reaparece na praça */
  voltarDaCidade() {
    const lay = this.layouts.get(this.o.eu.id), sp = lay && !lay.nivel ? spawnDaBase(lay) : { x: 0, z: 4 };   // base lá em cima → praça
    this.pilotando = false; this.altoEm = null; this.yNav = 0; this.noTopo = false; this.alvo = null; this.alvoDepois = null;
    this.eu.pos.set(sp.x, 0, sp.z); this.camT.set(sp.x, 1.2, sp.z); this.portalArmado = true;
  }
  /** embarca na nave (precisa estar perto dela) */
  embarcar() {
    if (!this.nave || this.pilotando || !this.navePerto()) return;
    if (this.noTopo) this.o.onTopo?.(false);
    this.pilotando = true; this.pousado = true; this.autoPouso = false; this.altoEm = null; this.noTopo = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0;
    this.naveEst = { ...this.naveEst, vx: 0, vy: 0, vz: 0 };
    this.eu.av.group.visible = false; this.eu.tag.style.display = "none";
  }
  /** sai da nave (só pousado): no chão do mapa ou no piso da cidade, ao lado da nave */
  desembarcar() {
    if (!this.pilotando || !this.pousado) return;
    this.pararRota();
    const n = this.naveEst, lado = { x: Math.cos(n.yaw) * 3.4, z: -Math.sin(n.yaw) * 3.4 };
    let q = { x: n.x + lado.x, z: n.z + lado.z };
    const z = this.zaeon(), mz = z ? marcoNav(z.poi) : null, dz = z ? Math.hypot(n.x - z.poi.x, n.z - z.poi.z) : Infinity;
    const [corpoZ, cupulaZ] = z ? this.pilaresZaeon(z) : [];
    if (n.y >= CIDADE.pisoY - 0.5) { q = resolverCidade(q); this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; }
    else if (z && cupulaZ && dz < cupulaZ.r && n.y >= cupulaZ.topo - 0.6) {
      // pousou em cima da cúpula da Zaeon → sai no TOPO (a base do dono; a nave só é pilotada pelo fundador)
      const e = this.eixoTopo()!; this.pilotando = false; this.altoEm = null; this.noTopo = true;
      this.eu.pos.set(e.x, 0, e.z); this.eu.av.group.visible = true; this.o.onTopo?.(true); return;
    }
    else if (z && mz && corpoZ && dz < corpoZ.r && n.y >= corpoZ.topo - 0.6) {
      // pousou sobre as muralhas → desce pro salão (dentro das muralhas, na direção da nave), fora dos sólidos
      const a = Math.atan2(n.z - mz.z, n.x - mz.x), rr = Math.min(dz, mz.nav.muralhaR - 2.5);
      q = empurrarParaFora({ x: mz.x + Math.cos(a) * rr, z: mz.z + Math.sin(a) * rr }, colisoresDoAlto(mz));
      this.altoEm = z.poi.id; this.yNav = mz.nav.pisoY;
    }
    else {
      this.altoEm = null; this.yNav = 0;
      for (const { mn } of this.marcosNav()) q = resolverPasso(mn, false, q, q);
      q = empurrarParaFora(q, this.colisores);
    }
    this.pilotando = false; this.eu.pos.set(q.x, 0, q.z); this.eu.av.group.visible = true;
  }
  /** botões de movimento na tela: SUBIR/DESCER (segurar) */
  comandoVoo(c: { subir?: boolean; descer?: boolean }) { if (c.subir !== undefined) this.voY.subir = c.subir; if (c.descer !== undefined) this.voY.descer = c.descer; if (c.subir || c.descer) this.autoPouso = false; }
  /** botões de movimento na tela: direcional (x = direita, z = trás; relativo à câmera, como WASD) */
  direcaoVoo(x: number, z: number) { this.botDir.x = x; this.botDir.z = z; if (x || z) this.autoPouso = false; }
  /** atalho: a nave voa sozinha (com as mesmas entradas dos botões) até pousar no destino; qualquer botão cancela */
  irPara(destino: DestinoRota): boolean {
    if (!this.pilotando) return false;
    const z = this.zaeon(), mn = z ? marcoNav(z.poi) : null, corpo = z ? this.pilaresZaeon(z)[0] : undefined;
    const pontos = rotaPara(destino, this.naveEst, mn && corpo ? pousoDoQG({ x: mn.x, z: mn.z, dir: mn.nav.escada.dir, muralhaR: mn.nav.muralhaR }, corpo.topo) : undefined);
    if (!pontos.length) return false;
    this.rota = { destino, pontos }; this.autoPouso = false; this.o.onRota?.(destino); return true;
  }
  pararRota() { if (this.rota) { this.rota = null; this.o.onRota?.(null); } }
  /** "Pousar": desce sozinho até encostar no chão embaixo (mapa, cidade ou topo da Zaeon) */
  pousar() { if (this.pilotando && !this.pousado) this.autoPouso = true; }
  /** a nave (de quem pilota) está pousada longe do hangar? → os outros veem ela parada lá (presença `naveParada`) */
  private naveForaDoHangar() { if (!this.nave) return false; const n = this.naveEst, h = mundo(CIDADE.hangar); return Math.hypot(n.x - h.x, n.z - h.z) > 1 || n.y < CIDADE.pisoY - 0.5; }
  /** (pra quem NÃO é o dono) o dono está com a nave fora do hangar → a do hangar some (só existe uma nave) */
  private naveDoDonoFora() { if (this.ehFundador(this.o.eu.id)) return false; for (const a of this.remotos.values()) if (a.nave) return true; return false; }
  private navePerto() { const n = this.naveEst; return Math.hypot(this.eu.pos.x - n.x, this.eu.pos.z - n.z) < 7 && Math.abs(this.eu.alt - n.y) < 7; }
  /** sólidos de voo da Zaeon: corpo (até o alto das muralhas) e cúpula (topo do dono), acompanhando a flutuação */
  private pilaresZaeon(z: LandmarkHandle): Pilar[] { const mn = marcoNav(z.poi); return mn ? pilaresDoMarco({ x: mn.x, z: mn.z, chaoR: mn.nav.chaoR, altura: z.poi.altura + this.boia(z), escala: z.poi.escala ?? 1, cupula: !!z.topo }) : []; }
  /** sólidos pra nave: os marcos andáveis como cilindros (quem vem de cima pousa no topo) */
  private solidosDeVoo(): Pilar[] { return this.marcosNav().flatMap(({ lm }) => this.pilaresZaeon(lm)); }

  // ───────────── marcos / dono ─────────────
  /** o marco com topo de acesso "dono" (Zaeon) */
  private zaeon(): LandmarkHandle | undefined { return this.lms.find((l) => l.poi.acesso === "dono" && l.topo); }
  /** fundador = marcado pelo SERVIDOR (e só faz sentido se a Zaeon está na cena) */
  private ehFundador(id: string) { return !!this.pessoas.get(id)?.fundador && !!this.zaeon(); }
  /** pose do eixo do topo (centro + giro atual do marco) e a altura do topo no mundo */
  private eixoTopo(): LayoutBase | null { const z = this.zaeon(); return z ? { x: z.poi.x, z: z.poi.z, rot: z.group.rotation.y } : null; }
  private escalaZaeon() { return this.zaeon()?.poi.escala ?? 1; }
  private alturaTopo() { const z = this.zaeon(); return z && z.topo ? z.topo.getWorldPosition(this.tmp).y + 0.13 * this.escalaZaeon() : 0; }
  private tmp = new THREE.Vector3();
  /** quanto o marco está "boiando" agora (somado a quem está na plataforma) */
  private boia(lm: LandmarkHandle | undefined) { return lm ? lm.group.position.y - lm.poi.altura : 0; }
  private marcosNav(): { lm: LandmarkHandle; mn: MarcoNav }[] { return this.lms.flatMap((lm) => { const mn = marcoNav(lm.poi); return mn ? [{ lm, mn }] : []; }); }
  /** altura do chão em (x,z) considerando os marcos andáveis (sem estado — remotos) */
  private alturaChao(p: { x: number; z: number }) {
    let y = 0;
    for (const { lm, mn } of this.marcosNav()) { const h = alturaEm(mn, p); if (h > y) y = h + (h >= mn.nav.pisoY - 1e-6 ? this.boia(lm) : 0); }
    return y;
  }

  // ───────────── geometria da minha base (ou do topo, se sou o dono lá em cima) ─────────────
  private assento() {
    if (this.noTopo) { const e = this.eixoTopo(); return e ? localParaMundo(e, 0, 0.4 * this.escalaZaeon()) : { x: 0, z: 0 }; }
    const b = this.minhaBase; return b ? localParaMundo(b, 0, -0.15) : { x: 0, z: 0 };
  }
  private rotAssento() {
    if (this.noTopo) { const e = this.eixoTopo(); return e ? e.rot + Math.PI : 0; }
    const b = this.minhaBase; return b ? b.rot + Math.PI : 0;
  }
  private distBase(id: string, p: { x: number; z: number }) {
    const l = this.layouts.get(id); if (!l || this.nivelDe(id) !== (l.nivel ?? "chao")) return Infinity;   // só no mesmo piso
    return Math.hypot(p.x - l.x, p.z - l.z);
  }

  /** Passo no chão/escada/plataforma: marcos andáveis (lib/cyber/nav) + colisores do chão (bases, outros marcos). */
  private resolverChao(eu: Ator, prev: { x: number; z: number }) {
    const navs = this.marcosNav();
    if (this.altoEm) {
      const cur = navs.find((n) => n.lm.poi.id === this.altoEm);
      if (cur) {
        const r = resolverPasso(cur.mn, true, prev, eu.pos);
        const q = r.alto ? empurrarParaFora(r, this.colisoresDoNivel("qg")) : r;   // a base do Andrei no centro do salão
        eu.pos.x = q.x; eu.pos.z = q.z; this.yNav = r.y;
        if (!r.alto) { this.altoEm = null; this.yNav = 0; }
        return;
      }
      this.altoEm = null;
    }
    let q = { x: eu.pos.x, z: eu.pos.z };
    for (const { lm, mn } of navs) {
      const r = resolverPasso(mn, false, prev, q);
      if (r.alto) { this.altoEm = lm.poi.id; this.yNav = r.y; eu.pos.x = r.x; eu.pos.z = r.z; return; }
      q = r;
    }
    q = empurrarParaFora(q, this.colisores); eu.pos.x = q.x; eu.pos.z = q.z; this.yNav = 0;
  }

  // ───────────── entradas ─────────────
  private digitando() { const a = document.activeElement; return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable); }
  private ligarEntradas() {
    const on = <K extends keyof WindowEventMap>(t: K, f: (e: WindowEventMap[K]) => void) => { window.addEventListener(t, f as EventListener); this.cleanups.push(() => window.removeEventListener(t, f as EventListener)); };
    const cv = this.R.domElement;
    const onC = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => { cv.addEventListener(t, f as EventListener, opt); this.cleanups.push(() => cv.removeEventListener(t, f as EventListener)); };
    on("keydown", (e) => {
      if (this.digitando() || (!this.o.teclasSempre && !this.sobContainer)) return; const k = e.key.toLowerCase();
      if (k === "shift") { this.keys.shift = true; return; }
      if (k === " " || k === "spacebar") { if (this.pilotando) { this.voY.subir = true; e.preventDefault(); return; } if (!this.menu) { this.pular(); e.preventDefault(); } return; }
      if (k === "f" && this.pilotando && this.pousado) { this.desembarcar(); return; }   // na vista (landing) o ESPAÇO não faz nada e a página rola normal
      if ((k === "e" || k === "q") && this.pilotando) { this.voY[k === "e" ? "subir" : "descer"] = true; this.autoPouso = false; e.preventDefault(); return; }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { this.keys[k] = true; e.preventDefault(); }
    });
    on("keyup", (e) => { const k = e.key.toLowerCase(); if (k === "shift") { this.keys.shift = false; return; } if (k === " " || k === "spacebar") { this.espaco = false; this.voY.subir = false; return; } if (k === "e") this.voY.subir = false; if (k === "q") this.voY.descer = false; this.keys[k] = false; });
    onC("pointerdown", (e) => {
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch0 = Math.hypot(a!.x - b!.x, a!.y - b!.y); this.dist0 = this.camDist; }
      this.drag = { x: e.clientX, y: e.clientY, az: this.camAz, pitch: this.camPitch }; this.moved = false;
    });
    on("pointermove", (e) => {
      if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2 && this.pinch0) { const [a, b] = [...this.ptrs.values()]; this.camDist = Math.min(24, Math.max(6, (this.dist0 * this.pinch0) / Math.max(20, Math.hypot(a!.x - b!.x, a!.y - b!.y)))); this.moved = true; return; }
      if (!this.drag) { if (e.target === cv) this.passarMouse(e.clientX, e.clientY); return; }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
      this.camAz = this.drag.az - dx * 0.006; this.camPitch = limitarPitch(this.drag.pitch + dy * 0.005);   // arrastar pra baixo até o chão → olhar pro céu
    });
    on("pointerup", (e) => {
      const era = this.ptrs.size; this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch0 = 0;
      if (this.drag && !this.moved && era === 1) this.clicar(e.clientX, e.clientY);
      if (!this.ptrs.size) this.drag = null;
    });
    on("pointercancel", (e) => { this.ptrs.delete(e.pointerId); if (!this.ptrs.size) { this.drag = null; this.pinch0 = 0; } });
    onC("pointerenter", () => { this.sobContainer = true; });
    onC("pointerleave", () => { this.sobContainer = false; this.hoverBase = null; cv.style.cursor = ""; });
    onC("wheel", (e) => { if (this.menu) return; /* menu: a página continua rolando */ e.preventDefault(); this.camDist = Math.min(24, Math.max(6, this.camDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  private ndc(cx: number, cy: number) { const r = this.R.domElement.getBoundingClientRect(); return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); }
  /** qual monitor (de qual base) está sob o ponteiro, se houver */
  private monitorSob(cx: number, cy: number): string | null {
    if (this.menu) return null;
    this.ray.setFromCamera(this.ndc(cx, cy), this.cam);
    let melhor: { id: string; d: number } | null = null;
    for (const [id, b] of this.bases) { const h = this.ray.intersectObject(b.monitor, false)[0]; if (h && (!melhor || h.distance < melhor.d)) melhor = { id, d: h.distance }; }
    return melhor?.id ?? null;
  }
  private passarMouse(cx: number, cy: number) {
    this.hoverBase = this.monitorSob(cx, cy);
    const meu = this.hoverBase === this.o.eu.id;
    this.R.domElement.style.cursor = meu && this.perto ? "pointer" : "";
  }

  private clicar(cx: number, cy: number) {
    if (this.pilotando) return;   // em voo, arrastar gira a câmera; clique não faz nada
    const sob = this.monitorSob(cx, cy);
    this.ray.setFromCamera(this.ndc(cx, cy), this.cam);
    // a NAVE (estando perto) → embarcar (o React valida no servidor)
    if (this.nave && this.ray.intersectObjects(this.nave.alvos, true).length && this.navePerto()) { this.o.onEmbarcar?.(); return; }
    // na CIDADE: computador perto = Sala de Estudos; senão anda no piso
    if (this.cidade && this.noCeu) {
      if (sob === this.o.eu.id && this.perto) { this.o.onEntrarEstudo?.(); return; }   // a minha base, na Zaeon
      const hc = this.ray.intersectObject(this.cidade.computadores, false)[0];
      if (hc && computadorPerto(this.eu.pos, 3.2) >= 0) { this.o.onEntrarEstudo?.(); return; }
      const h = this.ray.intersectObjects(this.cidade.alvos, true)[0];
      if (h) { const q = resolverCidade({ x: h.point.x, z: h.point.z }); this.alvo = new THREE.Vector2(q.x, q.z); this.alvoDepois = null; }
      return;
    }
    // o BURACO NEGRO é o portal (ou o anel embaixo dele)
    if (this.cidade && (this.ray.intersectObjects(this.cena.buracoNegro, true).length || this.ray.intersectObject(this.cidade.portalChao, false).length)) { this.o.onPortalCeu?.(); return; }
    let colega: Ator | null = null;
    for (const a of this.remotos.values()) if (this.eu.pos.distanceTo(a.pos) < 3.0 && this.ray.intersectObjects(a.av.meshes, true).length) { colega = a; break; }
    // no topo: o chão é a plataforma (só anda nela); o monitor do topo continua valendo
    if (this.noTopo) {
      if (sob === this.o.eu.id) { this.o.onEntrarEstudo?.(); return; }
      const z = this.zaeon(); const hit = z?.topo ? this.ray.intersectObject(z.topo, true)[0] : undefined;
      if (hit && z) { const e = this.eixoTopo()!; const dx = hit.point.x - e.x, dz = hit.point.z - e.z, d = Math.hypot(dx, dz), lim = 2.0 * this.escalaZaeon(), k = d > lim ? lim / d : 1; this.alvo = new THREE.Vector2(e.x + dx * k, e.z + dz * k); }
      return;
    }
    let marco: LandmarkHandle | null = null, hitMarco: THREE.Intersection | null = null;
    for (const lm of this.lms) { const h = this.ray.intersectObjects(lm.alvos, true)[0]; if (h) { marco = lm; hitMarco = h; break; } }
    // no ALTO (escada/plataforma): clicar na estrutura = andar até o ponto (a navegação segura muralhas/borda)
    if (this.altoEm) {
      if (sob === this.o.eu.id && this.perto) { this.o.onEntrarEstudo?.(); return; }
      if (hitMarco) { this.alvo = new THREE.Vector2(hitMarco.point.x, hitMarco.point.z); this.alvoDepois = null; this.falandoCom = null; }
      return;
    }
    // do chão, clicar nos DEGRAUS: primeiro o pé da escada, depois sobe até onde clicou
    if (marco && hitMarco && marco.escada && hitMarco.object === marco.escada) {
      const mn = marcoNav(marco.poi)!; const pe = deEscada(mn, mn.nav.bordaR + mn.nav.escada.comprimento * 0.98, 0);
      this.alvo = new THREE.Vector2(pe.x, pe.z); this.alvoDepois = new THREE.Vector2(hitMarco.point.x, hitMarco.point.z); this.falandoCom = null; return;
    }
    const acao = decidirClique({ noMonitor: sob !== null, baseMinha: sob === this.o.eu.id, pertoDaBase: this.perto, noColega: !!colega, colegaPerto: !!colega, noLandmark: !!marco, landmarkPerto: !!marco && poiPerto(this.eu.pos, [marco.poi])?.id === marco.poi.id });
    if (acao === "monitor") { this.o.onEntrarEstudo?.(); return; }
    if (acao === "landmark" && marco) { this.alvo = null; this.o.onLandmark?.(marco.poi); return; }
    if (acao === "aproximar-landmark" && marco) { const b = bordaDoPOI(marco.poi, this.eu.pos); this.alvo = new THREE.Vector2(b.x, b.z); return; }
    if (acao === "aproximar") {   // clique no meu monitor de longe: vai até a frente da base
      const l = this.minhaBase!; const dx = this.eu.pos.x - l.x, dz = this.eu.pos.z - l.z, d = Math.hypot(dx, dz) || 1;
      const r = BASE_COLLIDER_R + 0.9; this.alvo = new THREE.Vector2(l.x + (dx / d) * r, l.z + (dz / d) * r); this.falandoCom = null; return;
    }
    if (acao === "colega" && colega) {
      this.falandoCom = colega; this.alvo = null; this.o.onFalarCom?.(colega.name);
      colega.av.olharPara(Math.atan2(this.eu.pos.x - colega.pos.x, this.eu.pos.z - colega.pos.z)); return;
    }
    const h = this.ray.intersectObject(this.cena.floor)[0];
    if (h) { const p = empurrarParaFora({ x: h.point.x, z: h.point.z }, this.colisores); this.alvo = new THREE.Vector2(p.x, p.z); this.alvoDepois = null; this.falandoCom = null; this.o.onFalarCom?.(null); }
  }

  private redimensionar() {
    const c = this.o.container; this.w = Math.max(1, c.clientWidth); this.h = Math.max(1, c.clientHeight);
    this.R.setSize(this.w, this.h, false); this.cam.aspect = this.w / this.h; this.cam.updateProjectionMatrix();
  }

  private proj(v: THREE.Vector3) { const p = v.clone().project(this.cam); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, vis: p.z < 1 }; }

  private atualizarCamera() {
    const l = this.minhaBase;
    if (this.menu && l) {
      const pm = Math.min(2.4, Math.max(1, 0.9 / this.cam.aspect));   // retrato: afasta p/ caber a base
      const rel = localParaMundo(l, -2.6 * pm, 4.8 * pm);
      const yb = this.yDoNivel(l.nivel);
      this.cam.position.lerp(new THREE.Vector3(rel.x, yb + 2.5 + 0.9 * (pm - 1), rel.z), 0.06);
      this.camT.lerp(new THREE.Vector3(l.x, yb + (pm > 1 ? 0.1 : 1.4), l.z), 0.06); this.cam.lookAt(this.camT);
      return;
    }
    this.camT.lerp(new THREE.Vector3(this.eu.pos.x, 1.2 + this.eu.alt, this.eu.pos.z), 0.12);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    let dist = this.pilotando ? Math.max(this.camDist, 16) : this.camDist;
    // câmera em 3ª pessoa: perto de um marco (ilha flutuante, muralhas), se a estrutura fica ENTRE a câmera e o
    // personagem, a câmera se aproxima (senão a ilha cobre a tela)
    const marco = this.lms.find((l) => Math.hypot(this.eu.pos.x - l.poi.x, this.eu.pos.z - l.poi.z) < l.poi.interactR * 1.8);
    if (marco && !this.noTopo) {
      const alvoOlho = new THREE.Vector3(this.camT.x, this.camT.y + 0.8, this.camT.z);
      const dir = new THREE.Vector3(Math.sin(this.camAz) * cp, sp, Math.cos(this.camAz) * cp).normalize();
      this.rayCam.set(alvoOlho, dir); this.rayCam.far = dist;
      const h = this.rayCam.intersectObjects(marco.alvos, true)[0];
      if (h) dist = Math.max(2.2, h.distance - 0.6);
    }
    // órbita livre: por cima olha pro personagem; arrastando pra baixo encosta no chão e o olhar sobe pro céu
    const c = poseDaCamera({ olho: { x: this.camT.x, y: this.camT.y + 0.8, z: this.camT.z }, az: this.camAz, pitch: this.camPitch, dist, chaoY: this.eu.alt });
    this.cam.position.set(c.pos.x, c.pos.y, c.pos.z);
    this.cam.lookAt(c.olhar.x, c.olhar.y, c.olhar.z);
  }

  // ───────────── loop ─────────────
  private loop(now: number) {
    if (!this.vivo) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const dtReal = Math.min(VOO.dtMax, this.clock.getDelta()), dt = Math.min(0.05, dtReal), t = now * 0.001;   // o voo usa o dt REAL (independente de FPS)
    if (!this.visivel || document.hidden) return;
    const eu = this.eu, euId = this.o.eu.id;

    // MENU: segurar ESPAÇO p/ viajar; personagem fica sentado contemplando
    if (this.menu) {
      if (this.espaco) { this.holdT += dt; if (this.o.els.hold) this.o.els.hold.style.width = Math.min(100, (this.holdT / 1.2) * 100) + "%"; if (this.holdT >= 1.2) this.iniciar("viajar"); }
      else if (this.holdT > 0) { this.holdT = Math.max(0, this.holdT - dt * 2); if (this.o.els.hold) this.o.els.hold.style.width = (this.holdT / 1.2) * 100 + "%"; }
      const s = this.assento(); eu.pos.set(s.x, 0, s.z); eu.facing = this.rotAssento(); this.sitT = 1; eu.moving = false;
    } else if (this.pilotando) {
      // VOO: WASD/joystick/direcional relativo à câmera; Espaço/E/SUBIR sobe; Shift/Q/DESCER desce; pousa ao encostar
      let ix = 0, iz = 0;
      if (this.keys.w || this.keys.arrowup) iz -= 1; if (this.keys.s || this.keys.arrowdown) iz += 1;
      if (this.keys.a || this.keys.arrowleft) ix -= 1; if (this.keys.d || this.keys.arrowright) ix += 1;
      if (this.joy.on) { ix += this.joy.x; iz += this.joy.y; }
      ix += this.botDir.x; iz += this.botDir.z;
      const subir = this.voY.subir, descerManual = this.voY.descer || !!this.keys.shift;
      this.cmdVoo.subir = subir; this.cmdVoo.descer = descerManual;
      if (ix || iz || subir || descerManual) { this.autoPouso = false; this.pararRota(); }
      const dir = moverRelativoCamera(ix, iz, this.camAz);
      let cmd = { wx: dir?.wx ?? 0, wz: dir?.wz ?? 0, subir, descer: descerManual || this.autoPouso };
      if (this.rota) {   // atalho: o piloto automático aperta os mesmos botões (direção em mundo)
        const f = seguirRota(this.naveEst, this.rota.pontos, this.pousado);
        this.rota.pontos = f.rota; cmd = f.cmd;
        if (f.chegou) this.pararRota();
      }
      const r = passoVooSub(this.naveEst, cmd, dtReal, this.solidosDeVoo());
      this.naveEst = r.s; this.pousado = r.pousado; if (r.pousado) this.autoPouso = false;
      eu.pos.set(r.s.x, 0, r.s.z); eu.facing = r.s.yaw; eu.moving = false; this.sitT = 0;
    } else {
      let ix = 0, iz = 0;
      if (this.keys.w || this.keys.arrowup) iz -= 1; if (this.keys.s || this.keys.arrowdown) iz += 1;
      if (this.keys.a || this.keys.arrowleft) ix -= 1; if (this.keys.d || this.keys.arrowright) ix += 1;
      if (this.joy.on) { ix += this.joy.x; iz += this.joy.y; }
      const correndo = this.keys.shift || this.correr, spd = correndo ? 7.5 : 4;
      let andando = false;
      const prev = { x: eu.pos.x, z: eu.pos.z };
      const dir = moverRelativoCamera(ix, iz, this.camAz);
      const vel = this.noTopo ? 2 : spd;   // no topo: passos curtos na plataforma
      if (dir) { eu.pos.x += dir.wx * dt * vel; eu.pos.z += dir.wz * dt * vel; this.alvo = null; this.alvoDepois = null; andando = true; eu.facing = Math.atan2(dir.wx, dir.wz); this.falandoCom = null; }
      else if (this.alvo) {
        const dx = this.alvo.x - eu.pos.x, dz = this.alvo.y - eu.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.12) { eu.pos.x += (dx / d) * dt * 4; eu.pos.z += (dz / d) * dt * 4; andando = true; eu.facing = Math.atan2(dx, dz); } else { this.alvo = this.alvoDepois; this.alvoDepois = null; }
      }
      // sentar ao parar perto da PRÓPRIA base
      const querSentar = this.distBase(euId, eu.pos) < BASE_INTERACT_R && !andando && !this.alvo && this.chao;
      this.sitT += ((querSentar ? 1 : 0) - this.sitT) * Math.min(1, dt * 3);
      if (this.sitT > 0.05) { const s = this.assento(); eu.pos.x += (s.x - eu.pos.x) * Math.min(1, dt * 3); eu.pos.z += (s.z - eu.pos.z) * Math.min(1, dt * 3); eu.facing = this.rotAssento(); }
      else if (this.noTopo) { const e = this.eixoTopo()!, lim = 2.0 * this.escalaZaeon(); const dx = eu.pos.x - e.x, dz = eu.pos.z - e.z, d = Math.hypot(dx, dz); if (d > lim) { eu.pos.x = e.x + (dx / d) * lim; eu.pos.z = e.z + (dz / d) * lim; } }   // não cai da plataforma
      else if (this.noCeu) { const q = empurrarParaFora(resolverCidade(eu.pos), this.colisoresDoNivel("ceu")); eu.pos.x = q.x; eu.pos.z = q.z; this.yNav = CIDADE.pisoY; }
      else this.resolverChao(eu, prev);
      if (!this.chao) { this.jumpVy -= 20 * dt; this.jumpY += this.jumpVy * dt; if (this.jumpY <= 0) { this.jumpY = 0; this.jumpVy = 0; this.chao = true; } }
      eu.moving = andando;
    }
    eu.sit = this.sitT;
    const lmAlto = this.altoEm ? this.lms.find((l) => l.poi.id === this.altoEm) : undefined;
    eu.alt = this.pilotando ? this.naveEst.y
      : this.noCeu ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY)
      : this.noTopo ? this.alturaTopo() : this.yNav + (lmAlto && marcoNav(lmAlto.poi) && this.yNav >= marcoNav(lmAlto.poi)!.nav.pisoY - 1e-6 ? this.boia(lmAlto) : 0);

    // portais: anel no chão embaixo do buraco negro (entrada) e o da cidade (volta)
    if (this.cidade && !this.pilotando && !this.menu) {
      if (this.noCeu) { if (noPortalVolta(eu.pos)) this.voltarDaCidade(); }
      else if (!this.altoEm && !this.noTopo) {
        const dentro = noPortalEntrada(eu.pos);
        if (dentro && this.portalArmado) { this.portalArmado = false; this.o.onPortalCeu?.(); }
        if (!dentro) this.portalArmado = true;
      }
    }

    // estar perto da própria base = estado de estudo (luz/cristais/botão)
    const perto = this.distBase(euId, eu.pos) < BASE_INTERACT_R;
    if (perto !== this.perto) { this.perto = perto; this.o.onPerto?.(perto); }

    // rede: eu → difusão; remotos → atores
    if (!this.menu) this.o.enviarPos?.({ x: eu.pos.x, z: eu.pos.z, facing: eu.facing, moving: eu.moving, sit: this.sitT > 0.5, topo: this.noTopo, ceu: this.noCeu, ...(this.pilotando ? { voo: { y: this.naveEst.y, yaw: this.naveEst.yaw } } : this.naveForaDoHangar() ? { naveParada: { x: this.naveEst.x, y: this.naveEst.y, z: this.naveEst.z, yaw: this.naveEst.yaw } } : {}) });
    this.sincronizarRemotos(dt, t);

    // avatares
    eu.av.group.position.set(eu.pos.x, this.jumpY + eu.alt, eu.pos.z); eu.av.olharPara(eu.facing);
    eu.av.animar({ andando: eu.moving, correndo: !!(this.keys.shift || this.correr) && eu.moving, sentado: this.sitT, dt, t });
    for (const a of this.remotos.values()) {
      a.av.group.visible = !a.nave || !!a.naveP; a.av.group.position.set(a.pos.x, a.alt, a.pos.z); a.av.olharPara(a.facing); a.av.animar({ andando: a.moving, sentado: a.sit, dt, t });
      if (a.nave && a.naveP) { a.nave.group.position.set(a.naveP.x, a.naveP.y, a.naveP.z); a.nave.group.rotation.y = a.naveP.yaw; a.nave.atualizar({ dt, t, voando: false, vel: 0, curva: 0 }); }
      else if (a.nave) { a.nave.group.position.set(a.pos.x, a.alt, a.pos.z); a.nave.group.rotation.y = a.naveYaw ?? 0; a.nave.atualizar({ dt, t, voando: a.alt > 0.5, vel: a.moving ? 1 : 0, curva: 0 }); }
    }

    // cidade + a minha nave (parada onde pousou, ou comigo dentro)
    if (this.cidade) this.cidade.atualizar(dt, t);
    if (this.nave) {
      const n = this.naveEst, curva = (n.yaw - this.yawAnt) / Math.max(dt, 1e-3); this.yawAnt = n.yaw;
      // pousada no hangar da cidade, acompanha a flutuação da ilha
      const yBase = !this.pilotando && n.y >= CIDADE.pisoY - 0.5 && this.cidade ? this.cidade.ilha.position.y : n.y;
      this.nave.group.position.set(n.x, yBase, n.z); this.nave.group.rotation.y = n.yaw;
      this.nave.group.visible = this.pilotando || !this.naveDoDonoFora();
      this.nave.atualizar({ dt, t, voando: this.pilotando && !this.pousado, vel: Math.hypot(n.vx, n.vz) / VOO.vel, curva });
    }
    this.atualizarHudVoo(now);
    const navePerto = !this.pilotando && !!this.nave && this.navePerto();
    const est = `${this.noCeu}|${navePerto}|${this.pilotando}|${this.pousado}`;
    if (est !== this.estadoQG) { this.estadoQG = est; this.o.onEstadoQG?.({ noCeu: this.noCeu, navePerto, pilotando: this.pilotando, pousado: this.pousado }); }

    // marcos: animação + a "estátua" do dono some quando o dono real está lá em cima
    const donoNoTopo = this.noTopo || [...this.remotos.values()].some((a) => a.topo);
    for (const lm of this.lms) { lm.atualizar(dt, t); if (lm.topo) lm.donoPresente(donoNoTopo); }

    // bases
    for (const [id, b] of this.bases) {
      const alguemPerto = id === euId ? perto : [...this.remotos.values()].some((a) => a.id === id && this.distBase(id, a.pos) < BASE_INTERACT_R);
      if (b.layout.nivel) b.group.position.y = this.yDoNivel(b.layout.nivel);
      // energia = o dono SENTADO na cabine (fluxo mãos → tela)
      const energia = id === euId ? this.sitT : (this.remotos.get(id)?.sit ?? 0);
      b.atualizar({ dt, t, ativa: alguemPerto, hover: this.hoverBase === id, perto: id === euId && perto, energia });
    }
    if (this.baseQG) { this.baseQG.group.position.y = this.yDoNivel("qg"); this.baseQG.atualizar({ dt, t, ativa: false, hover: false, perto: false }); }

    this.atualizarCamera();
    this.cena.atualizar({ dt, t, cam: this.cam, aspect: this.cam.aspect });
    this.atualizarHud(now);
    this.R.clear(); this.R.render(this.cena.bgScene, this.cena.bgCam); this.R.clearDepth(); this.R.render(this.cena.scene, this.cam);
    if (!this.prontoDisparado) { this.prontoDisparado = true; this.o.onPronto?.(); }
  }

  private sincronizarRemotos(dt: number, t: number) {
    const src = this.o.remotos?.current;
    if (src) {
      for (const [id, p] of src) {
        if (id === this.o.eu.id) continue;
        let a = this.remotos.get(id);
        if (!a) {
          a = this.novoAtor({ id, name: p.name, color: p.color }, p.x, p.z);
          a.facing = p.facing; this.remotos.set(id, a);
          if (!this.pessoas.has(id)) this.setPessoas([...this.ordem.map((i) => this.pessoas.get(i)!), { id, name: p.name, color: p.color }]);
        }
        const r = interpolar({ x: a.pos.x, z: a.pos.z, facing: a.facing }, { x: p.x, z: p.z, facing: p.facing }, dt);
        a.pos.x = r.x; a.pos.z = r.z; a.facing = r.facing; a.moving = r.moving || p.moving === true;
        a.sit += ((p.sit ? 1 : 0) - a.sit) * Math.min(1, dt * 3);
        // "no topo" só vale pra quem o SERVIDOR marcou como fundador (client event forjado não sobe ninguém)
        // regalias (topo/céu/nave) só pra quem o SERVIDOR marcou como fundador
        const fund = !!this.pessoas.get(id)?.fundador;
        a.topo = p.topo === true && this.ehFundador(id);
        a.ceu = fund && p.ceu === true;
        const voando = fund && !!p.voo, parada = fund && !voando && p.naveParada ? p.naveParada : null;
        if ((voando || parada) && !a.nave && this.cidade) { a.nave = criarNave({ low: this.o.low, cor: a.color }); this.cena.scene.add(a.nave.group); }
        if (!voando && !parada && a.nave) { a.nave.dispose(); a.nave = null; }
        a.naveP = parada;
        const altAlvo = voando ? p.voo!.y : a.topo ? this.alturaTopo() : a.ceu ? CIDADE.pisoY : this.alturaChao(a.pos);
        a.alt += (altAlvo - a.alt) * (Math.abs(altAlvo - a.alt) > 40 ? 1 : Math.min(1, dt * 6));   // portal = corte seco
        if (voando) a.naveYaw = p.voo!.yaw;
        void t;
      }
      // saiu da sala: o personagem some; a BASE fica (bases vivem em this.bases)
      for (const [id, a] of this.remotos) if (!src.has(id)) { this.removerAtor(a); this.remotos.delete(id); if (this.falandoCom === a) { this.falandoCom = null; this.o.onFalarCom?.(null); } }
    }
  }

  /** HUD de voo: marcador de pouso sob a nave, anel na borda da ilha e o altímetro pro React (sem marcadores na tela) */
  private atualizarHudVoo(now: number) {
    const h = this.hudVoo; if (!h) return;
    const voando = this.pilotando && !this.menu, n = this.naveEst, boiaCidade = this.cidade ? this.cidade.ilha.position.y - CIDADE.pisoY : 0;
    const solidos = voando ? this.solidosDeVoo() : [];
    h.marca.visible = voando && !this.pousado;
    if (h.marca.visible) { const c = chaoDoVoo(n, solidos); h.marca.position.set(n.x, c + (c === CIDADE.pisoY ? boiaCidade : 0) + 0.1, n.z); }
    h.borda.visible = voando && Math.hypot(n.x - CIDADE.centro.x, n.z - CIDADE.centro.z) < 220;
    if (h.borda.visible) h.borda.position.y = CIDADE.pisoY + boiaCidade + 0.4;
    // altímetro (React), só quando muda e no máx. 10×/s
    if (!voando || now - h.t < 100) return;
    const chave = String(Math.round(n.y));
    if (chave !== h.chave) { h.chave = chave; h.t = now; this.o.onVoo?.({ y: Math.max(0, Math.round(n.y)) }); }
  }

  private atualizarHud(now: number) {
    const { eu } = this;
    const atores = [eu, ...this.remotos.values()];
    for (const a of atores) {
      if (a === eu) { a.tag.style.display = "none"; continue; }   // o próprio avatar não leva nome
      const s = this.proj(new THREE.Vector3(a.pos.x, 2.1 + a.sit * -0.3 + a.alt, a.pos.z));
      a.tag.style.left = s.x + "px"; a.tag.style.top = s.y + "px"; a.tag.style.display = this.menu || !s.vis ? "none" : "block";
      { const perto = eu.pos.distanceTo(a.pos) < 3.0; a.tag.style.borderColor = perto ? "#fff" : ""; a.tag.textContent = (perto ? "💬 " : "") + a.name; }
    }
    for (let i = this.falas.length - 1; i >= 0; i--) {
      const f = this.falas[i]!; if (now > f.ate) { f.el.remove(); this.falas.splice(i, 1); continue; }
      const p = this.proj(new THREE.Vector3(f.ator.pos.x, 2.4 + f.ator.alt, f.ator.pos.z)); f.el.style.left = p.x + "px"; f.el.style.top = p.y + "px"; f.el.style.display = p.vis ? "block" : "none";
    }
    // menu projetado no monitor (retrato: fixo, sempre tocável)
    const m = this.o.els.menu;
    if (m && this.menu) {
      if (this.cam.aspect < 0.8) { m.style.display = "flex"; m.style.left = "50%"; m.style.top = "68%"; }
      else { const l = this.minhaBase; if (l) { const mw = localParaMundo(l, 0, TELA_BASE.z); const p = this.proj(new THREE.Vector3(mw.x, TELA_BASE.y + this.yDoNivel(l.nivel), mw.z)); m.style.display = p.vis ? "flex" : "none"; if (p.vis) { m.style.left = p.x + "px"; m.style.top = p.y + "px"; } } }
    }
    // rótulo do monitor em hover
    const lab = this.o.els.monLabel;
    if (lab) {
      if (this.hoverBase && !this.menu) {
        const z = this.zaeon();
        const l = this.layouts.get(this.hoverBase)!, mw = localParaMundo(l, 0, TELA_BASE.z), mon = new THREE.Vector3(mw.x, TELA_BASE.y + TELA_BASE.h / 2 + 0.25 + this.yDoNivel(l.nivel), mw.z);
        const p = this.proj(mon);
        const meu = this.hoverBase === this.o.eu.id;
        lab.textContent = rotuloMonitor({ baseMinha: meu, pertoDaBase: this.perto, dono: this.pessoas.get(this.hoverBase)?.name ?? "alguém" });
        lab.dataset.longe = String(!(meu && this.perto));
        lab.style.left = Math.min(this.w - 110, Math.max(110, p.x)) + "px"; lab.style.top = p.y + "px"; lab.style.display = p.vis ? "block" : "none";
      } else lab.style.display = "none";
    }
  }

  dispose() {
    if (!this.vivo) return;   // idempotente (desmonta ao ir estudar e de novo no cleanup do React)
    this.vivo = false; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.io?.disconnect();
    this.cleanups.forEach((f) => f());
    for (const a of [this.eu, ...this.remotos.values()]) if (a) this.removerAtor(a);
    for (const b of this.bases.values()) b.dispose(); this.baseQG?.dispose();
    for (const lm of this.lms) lm.dispose();
    this.cidade?.dispose(); this.nave?.dispose();
    if (this.hudVoo) for (const m of [this.hudVoo.marca, this.hudVoo.borda]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.cena.dispose(); this.R.dispose(); this.R.forceContextLoss(); this.R.domElement.remove();
  }
}
