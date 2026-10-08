/**
 * CyberEngine — a cena RPG do cyberespaço (HANDOFF lounge cósmico): três.js imperativo, isolado do React.
 * Cenário fixo (CenaCosmica) + uma BASE DE ESTUDO por pessoa (BaseEstudo, fixa e privada) + "seres de luz"
 * (AvatarLuz). Movimento WASD/joystick/clique, correr, voar de mochila a jato (ESPAÇO), câmera orbital livre (+pinça), colisão que desliza
 * na borda das bases, sentar ao parar na própria base, monitor destacável (hover) que leva à Sala de Estudos.
 * Rede = só o que o hook de sala entrega (remotos + enviarPos); aqui não há fetch/Pusher.
 */
import * as THREE from "three";
import { corDaArmadura } from "@/lib/cyber/cores";
import { BASE_COLLIDER_R, BASE_INTERACT_R, baseNoQG, basesDosMembros, localParaMundo, spawnDaBase, type LayoutBase, type NivelBase } from "@/lib/cyber/bases";
import { empurrarParaFora, type Colisor } from "@/lib/cyber/colisao";
import { decidirClique, rotuloMonitor } from "@/lib/cyber/clique";
import { POIS, bordaDoPOI, colisoresDosPOIs, marcoNav, naPracaPOI, poiPerto, type POI } from "@/lib/cyber/landmarks";
import { alturaEm, colisoresDoAlto, deEscada, resolverPasso, type MarcoNav } from "@/lib/cyber/nav";
import { limitarPitch, poseDaCamera } from "@/lib/cyber/camera";
import { ALTURA_CORPO_ILHOTA, BURACO_NEGRO, CAMPO_DJ, CIDADE, alturaNaCidade, foraDaTorreDJ, naCabineDJ, naPistaDeDanca, naTorreDJ, pontoDaCabineDJ, rumoDaPista, rumoDoDJ, bocaDaEscada, bocaDoElevador, naEscadaDoLounge, posDaViagem, TORRE_DJ, VIAGEM_ESCADA, ALTURA_LOUNGE, PALCO as PALCO_LOUNGE, naSala, ILHOTAS, computadorPerto, foraDaIlha, pisoDeVoo, pisoNoAr, ilhotaEm, mundo, naIlhaPrincipal, resolverCidade, resolverCidadeLivre, solidosDaCidade } from "@/lib/cyber/ceu";
import { VOO, chaoDoVoo, passoVooSub, pilaresDoMarco, type EstadoVoo, type Pilar } from "@/lib/cyber/voo";
import { JET, impactoDoPouso, passoHorizontalJet, passoVertical, resolverNoAr, somDoJato, tetoDoJet, type QGNoAr } from "@/lib/cyber/jet";
import { proximoQuadro, type Qualidade } from "@/lib/cyber/dispositivo";
import { QualidadeAdaptativa } from "@/lib/cyber/qualidadeAdaptativa";
import { DISTANCIA, PASSOS, cadenciaPasso, eventosNave, fatorCristais, fatorLeito, gatilhoVooInicial, gatilhosVoo, intervaloNeuronio, somNaveInicial, type Dist, type EstadoGatilhoVoo, type EstadoSomNave } from "@/lib/cyber/audio";
import { musica } from "@/lib/audio/musica";
import { criarAudioCyber, type AudioCyberHandle, type LoopSom } from "./AudioCyber";
import { criarSomLounge, type SomLoungeHandle } from "./SomLounge";
import type { SomLounge } from "@/lib/lounge3d/musica";
import { rotaPara, seguirRota, type DestinoRota, type Waypoint } from "@/lib/cyber/rota";
import { criarCidade, type CidadeHandle } from "./Cidade";
import { criarHoloRecado, type HoloRecadoHandle } from "./HoloRecado";
import { HOLO_NA_BASE } from "@/lib/cyber/recado";
import type { RecadoQG } from "@/lib/lounge3d/tipos";
import { criarUniversidade, type UniversidadeHandle } from "./Universidade";
import { naUniversidade, UNIVERSIDADE } from "@/lib/cyber/universidade";
import { CAMPI, IDS_CAMPI, type IdCampus } from "@/lib/cyber/campi";
import { criarCampus, type CampusHandle } from "./Campus";
import { PLATAFORMAS, alturaDoAndar, andarDoPouso, andarNaPlataforma, decolaDaPlataforma, elevadorAqui, noArNaPlataforma, pilaresDasPlataformas, plataformaPerto, pousosNaPlataforma, tetoNaPlataforma, type IdPlataforma } from "@/lib/cyber/plataformas";
import { PRACA, QUEDA_VAZIO, naPraca } from "@/lib/cyber/praca";
import { CHEGADA_NAVE, NOS, bocaDJMundo, chegadaDJMundo, destinosDe, naBocaDJ, naBocaNave, noDoAnel, type IdNo } from "@/lib/cyber/buracos";
import { DROID } from "@/lib/cyber/agentes";
import { NASCIMENTO, RITMO_FALA, ROTEIRO, TUBOS, cumpriu, tuboDe } from "@/lib/cyber/onboarding";
import { criarDroid, type DroidHandle } from "./Droid";
import { criarPraca, type PracaHandle } from "./Praca";
import { criarBercario, type BercarioHandle } from "./Bercario";
import { criarSolanaHouse, type SolanaHouseHandle } from "./SolanaHouse";
import { DECK_ANTIGO, GIRO_PLANTA, noCorredorDaRampa, NAVE_QG, RAIO_REDOMA, acaoNaNave, alturaDoConves, alturaNoBordo, andarNaNave, RAMPA, naPontaDaRampa, naRampaLaFora, paraLocal, paraMundo, pertoDaEntrada, poseDaDoca, pousoNaNave, rampaDaNave, redomaAberta, type Bordo, type PoseNave } from "@/lib/cyber/naveQG";
import { ESCALA_NAVE, ESCALA_NAVE_V, criarNave, type NaveHandle } from "./Nave";
import { criarLandmark, type LandmarkHandle } from "./Landmark";
import { atualizarCamuflagem, camuflarGrupo, pararCamuflagem } from "./camuflagem";
import { criarMoto, type MotoHandle } from "./Moto";
import { criarVelocidadeTela, type VelocidadeTela } from "./VelocidadeTela";
import { ALTURA_LANCAMENTO, FABRICA, LOTES, MOTO, PLATAFORMA_MOTO, baseDoRobo, lookDaVaga, esvaziou, fabricaNova, largadasValidas, motoParaMontar, moverRobo, passoFabrica, progressoDaVaga, vagas, type AlvoMoto, type Fabrica, type Lote, type MotoLargada, type MotoMontada } from "@/lib/cyber/motos";
import { criarRoboMotos, type RoboMotosHandle } from "./RoboMotos";
import { PILOTAGEM, motoParada, passoMotoSub, sensacaoDeVelocidade, type ComandoMoto, type EstadoMoto } from "@/lib/cyber/motoFisica";
import { LOOPS_MOTO, eventosDaMoto, mixDaMoto, setaAcesa, somMotoParada, type EstadoSomMoto } from "@/lib/cyber/somMoto";
import { interpolar, moverRelativoCamera } from "@/lib/lounge3d/sala";
import type { Presenca } from "@/lib/lounge3d/tipos";
import { criarCenaCosmica, type CenaCosmicaHandle } from "./CenaCosmica";
import { atualizarRegiao, criarRegiao, soltarRegiao, type RegiaoCena } from "./regioesCena";
import { fundirEstaticos } from "./lotes";
import type { Regiao } from "@/lib/cyber/regioes";
import { TELA_BASE, criarBase, type BaseEstudoHandle } from "./BaseEstudo";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { carregarModeloAvatar, criarAvatarLuz, type AvatarLuzHandle, type Montado } from "./AvatarLuz";

/**
 * Vêm do SERVIDOR (GET da sala), o cliente só pinta: `fundador` = dono — a base dele fica na ZAEON (a ilha no céu).
 * Regalias são validadas na API.
 */
export type PessoaCyber = { id: string; name: string; color: string; fundador?: boolean };
/** o TÚNEL de um buraco negro: de onde se entrou e pra onde dá pra ir */
export type TunelAberto = { origem: IdNo; destinos: { id: IdNo; nome: string; desc: string }[] };
/** o TOUR da anfitriã (lib/cyber/onboarding): o passo atual — o React mostra a fala */
export type EstadoGuia = { passo: number; total: number; id: string; titulo: string; agente: string; cor: string };
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
  /** capas de efeito por aparelho (lib/cyber/dispositivo): pixel ratio, antialias, limite de fps */
  qualidade?: Qualidade;
  /** teclado sempre ouvido (tela cheia). Na janela da landing só com o mouse em cima (não rouba ESPAÇO/rolagem da página). */
  teclasSempre: boolean;
  remotos?: { current: Map<string, Presenca> };
  enviarPos?: (p: { x: number; z: number; facing: number; moving: boolean; sit: boolean; topo: boolean; ceu: boolean; voo?: { y: number; yaw: number }; naveParada?: { x: number; y: number; z: number; yaw: number }; jet?: number; alt?: number; moto?: MotoMontada; motoLargada?: MotoLargada }) => void;
  /** pontos de interesse (marcos megalíticos) — flag NEXT_PUBLIC_CYBER_LANDMARKS */
  landmarks?: boolean;
  /** clicou num marco estando perto → painel (nome, org, link) */
  onLandmark?: (poi: POI) => void;
  /** entrou/saiu do topo da Zaeon (o React mostra o "Descer") */
  onTopo?: (noTopo: boolean) => void;
  /** entrou num BURACO NEGRO da rede (lib/cyber/buracos): o React abre o túnel com os destinos e chama `viajarPeloTunel` */
  onTunel?: (t: TunelAberto) => void;
  /** pisou numa boca do PAR do dono (nave ↔ cabine do DJ): o React pede acesso ao servidor e chama `atravessarBuracoDono` */
  onBuracoDono?: (para: "dj" | "nave") => void;
  /** um aviso curto pra pessoa (caiu no vazio, buraco negro só do dono…) */
  onAviso?: (msg: string) => void;
  /** NASCE num tubo de ensaio do berçário e faz o tour da anfitriã (o React decide: 1ª vez no hiperespaço novo) */
  nascer?: boolean;
  /** o passo do tour mudou (null = acabou/pulou) */
  onGuia?: (g: EstadoGuia | null) => void;
  /** um AGENTE falou (o Droid, no tutorial): o balão sai em cima dele e o React põe a fala no chat (só local) */
  onFalaAgente?: (f: { id: string; nome: string; cor: string; texto: string }) => void;
  /** clicou na nave estando perto → o React pede acesso ao servidor e chama `embarcar()` */
  onEmbarcar?: () => void;
  /** estado da nave/cidade pra UI (botões Embarcar / Sair / Voltar) */
  /** a AÇÃO de contexto mudou (o que o F faz agora: "Estudar", "Montar na moto"…) ou acabou (null) */
  onAcao?: (a: { rotulo: string } | null) => void;
  onEstadoQG?: (s: { noCeu: boolean; navePerto: boolean; pilotando: boolean; pousado: boolean; moto: boolean; motoPerto: boolean }) => void;
  /** HUD de voo (pilotando): altímetro — só quando muda (≤ 10×/s) */
  onVoo?: (h: { y: number }) => void;
  /** atalho de rota em andamento (piloto automático) ou null (chegou / cancelado) */
  onRota?: (destino: DestinoRota | null) => void;
  /** o dono clicou na TV do lounge da Zaeon (perto dela) → abre a caixa do recado pro mural da Recepção */
  onAbrirRecado?: () => void;
  /** o dono ESTACIONOU a nave-QG (largou o leme): onde ela ficou parada — o React guarda na sala (todos a veem ali) */
  onNaveParada?: (pose: PoseNave) => void;
  /** o dono usou o TOCA-DISCOS do lounge (F perto dele) → abre o player de música */
  onAbrirSom?: () => void;
  /** URL de uma música da playlist do lounge (rota da sala); sem isto (modo solo/prévia) o lounge fica sem som */
  urlMusica?: (arq: string) => string;
  /** as poses remotas JÁ chegam suavizadas (netcode do Colyseus: interpolação + dead reckoning) → usa direto, sem
   *  um 2º lerp (que só somaria atraso) */
  remotosSuaves?: boolean;
  onPerto?: (perto: boolean) => void;
  onFalarCom?: (nome: string | null) => void;
  onEntrarEstudo?: () => void;
  onSessao?: (go: string) => void;
  onPronto?: () => void;
};

type Ator = { id: string; name: string; color: string; av: AvatarLuzHandle; pos: THREE.Vector3; facing: number; moving: boolean; sit: number; tag: HTMLDivElement; alt: number;
  /** na cabine do DJ do lounge (0..1, suavizado): fone na cabeça, mãos na controladora */
  dj?: number;
  /** parado na pista do lounge (0..1, suavizado): dançando */
  danca?: number;
  /** sendo levado pela ESCADA DE ENERGIA (0..1, suavizado): surfando na prancha de luz */
  surf?: number;
  /** remotos: tempo acumulado desde a última animação (de longe/fora da tela anima menos vezes por segundo) */
  acum?: number;
  /** remotos: no topo da Zaeon / pilotando (só valem pra quem o servidor marcou fundador) / na cidade (qualquer um) */
  topo?: boolean; ceu?: boolean; nave?: NaveHandle | null; naveYaw?: number;
  /** a nave-QG dele estacionada (ele não está pilotando): fica parada ali, à vista de todos */
  naveP?: { x: number; y: number; z: number; yaw: number } | null;
  /** remotos: voando de mochila a jato (altura no mundo) e a velocidade vertical estimada */
  jet?: number; vyJet?: number;
  /** remotos: sons da nave dele (loops idle/voo) e passos */
  somNave?: { idle: LoopSom; voo: LoopSom; g: EstadoGatilhoVoo; voava: boolean; ev: EstadoSomNave; yAnt: number | null; vy: number } | null; passoT?: number; perto?: boolean;
  /** remotos: o jato contínuo da mochila dele + a última velocidade vertical no ar (pro baque do pouso) */
  somJet?: LoopSom[] | null; vyUlt?: number;
  /** voz ao vivo (WebRTC) presa ao avatar; `falando` = segurando o push-to-talk agora */
  vozH?: { remover(): void } | null; falando?: boolean;
  /** remotos: montado numa moto voadora (vaga, altura, rumo) */
  moto?: MotoMontada | null;
  /** remotos: a moto que ele ESTACIONOU (fica lá até ele montar noutra ou sair) */
  motoLargada?: MotoLargada | null };
/** um balão de fala preso a quem fala (uma pessoa ou o Droid: só a posição e a altura importam) */
type Fala = { el: HTMLDivElement; ator: { pos: THREE.Vector3; alt: number }; ate: number };

/** cor da mesa da Recepção (a da anfitriã) */
const COR_QG = "#ffd36b";
/** a moto de um piloto (montada ou estacionada): o modelo animado, o look (a vaga: cor + carenagem, pro pool), a vaga de origem,
 *  os loops do motor e o estágio do som no quadro anterior, e o rumo/altura anteriores (curva e subida) */
type InstMoto = { h: MotoHandle; g: THREE.Group; /** o de fora: o pool liga/desliga ESTE (o corte por distância mexe no `g`) */ casca: THREE.Group; look: string; s: number; loops: Record<(typeof LOOPS_MOTO)[number], LoopSom> | null; som: EstadoSomMoto; yawAnt: number; yAnt: number | null; vy: number };
/** sensibilidade do olhar livre (rad por pixel do mouse) */
const SENS_OLHAR = 0.0026;
/** o que não pode virar lote (components/cyber/lotes): os alvos de clique/câmera e TUDO dentro deles (o raycast é recursivo) */
/** lotes da nave: simula a redoma abrindo, alguém a bordo, a rampa, o convés por dentro e o voo (o engine devolve o
 *  estado certo no quadro seguinte: chama aBordo/abrirCabine/rampa/verDentro todo quadro) */
const loteNave = (h: NaveHandle) => {
  fundirEstaticos(h.group, { passo: (k, t) => { h.abrirCabine(k % 2 === 0); h.aBordo(k % 3 === 0); h.rampa((k % 4) / 3, k % 2 === 0); h.verDentro(k % 5 < 2); h.atualizar({ dt: 1 / 30, t, voando: k % 4 < 2, vel: (k % 3) / 2, curva: Math.sin(t), fechada: k % 2 === 1 }); }, manter: comDescendentes([...h.alvos, h.assento]) });
  h.abrirCabine(false); h.aBordo(false); h.verDentro(false);
  for (let i = 0; i < 6; i++) h.atualizar({ dt: 1, t: 0, voando: false, vel: 0, curva: 0 });   // volta ao repouso (pernas, raios, redoma)
};
const comDescendentes = (objs: (THREE.Object3D | null | undefined)[]) => { const out: THREE.Object3D[] = []; for (const o of objs) o?.traverse((n) => { out.push(n); }); return out; };

/** as áreas das 3 grandes regiões (a caixa automática pegaria o anel do elevador / o portal lá no chão) */
const cil = (c: { x: number; z: number }, r: number, y: number, abaixo: number, acima: number) => () => ({ x: c.x, z: c.z, r, y0: y - abaixo, y1: y + acima });
const AREA_ZAEON = cil(CIDADE.centro, Math.max(CIDADE.bordaR + 90, -CIDADE.salas.lounge.x + CIDADE.salas.lounge.r + 10), CIDADE.pisoY, CIDADE.ilhaAltura + CIDADE.agulha.altura + 10, 220);   // + ilhotas, a escada e o lounge
const AREA_UNILAB = cil(UNIVERSIDADE.centro, UNIVERSIDADE.discoR, UNIVERSIDADE.y, 100, 80);
const AREA_SOLANA = cil(PLATAFORMAS.solana.centro, PLATAFORMAS.solana.r + 10, PLATAFORMAS.solana.y, 40, 40);
const DICA_MIRA_CSS = "position:absolute;left:50%;bottom:92px;transform:translateX(-50%);font:600 12px system-ui,sans-serif;color:#cfeaff;background:rgba(8,14,34,.62);border:1px solid rgba(150,220,255,.3);padding:5px 12px;border-radius:999px;pointer-events:none;white-space:nowrap;";
const TAG_CSS = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);font:700 11px system-ui,sans-serif;padding:2px 8px;border-radius:999px;background:rgba(10,8,30,.62);border:1px solid rgba(160,140,255,.3);white-space:nowrap;pointer-events:none;";
const FALA_CSS = "position:absolute;left:0;top:0;transform:translate(-50%,-100%);max-width:200px;font:12.5px system-ui,sans-serif;color:#eee8ff;background:rgba(14,12,36,.82);border:1px solid;padding:6px 10px;border-radius:12px;pointer-events:none;overflow-wrap:anywhere;";

export class CyberEngine {
  private o: CyberOpts;
  private R: THREE.WebGLRenderer;
  private cam: THREE.PerspectiveCamera;
  private cena: CenaCosmicaHandle;
  private bases = new Map<string, BaseEstudoHandle>();
  private layouts = new Map<string, LayoutBase>();
  /** a mesa + cristais da RECEPÇÃO (centro do salão): a mesa da Zaeon, a anfitriã */
  private baseQG: BaseEstudoHandle | null = null;
  /** a ILHA da praça (as bases, o heliporto) — o hiperespaço não tem chão */
  private praca: PracaHandle | null = null;
  /** o berçário dos tubos de ensaio (ao lado da Recepção) */
  private bercario: BercarioHandle | null = null;
  /** o DROID (lib/cyber/agentes): o agente de onboarding — o corpo (um ofanim), onde está, o rótulo e a âncora do balão.
   *  É SÓ deste cliente (cada pessoa tem o seu; nada vai pela rede) */
  private droid: { h: DroidHandle; pos: THREE.Vector3; alt: number; tag: HTMLDivElement; fala: { pos: THREE.Vector3; alt: number } } | null = null;
  /** NASCENDO no tubo (s desde o começo) — sem andar até o vidro abrir */
  private nascendo: { t: number; tubo: number } | null = null;
  /** o TUTORIAL do Droid: o passo, quantas falas dele já saíram, o relógio da fala, se já está ESPERANDO a pessoa cumprir
   *  (`ativo`) e o que ela fez desde então (`andou`, `motoAndou`, `tunel`, a altura do chão de onde voou) */
  private guia: { passo: number; fala: number; falaT: number; ativo: boolean; andou: number; motoAndou: number; tunel: boolean; pisoY: number; prev: { x: number; z: number } } | null = null;
  /** o farol do alvo do tour (uma coluna de luz) */
  private farol: THREE.Mesh | null = null;
  /** dentro do TÚNEL de um buraco negro (escolhendo o destino): parado até o React responder */
  private tunel: TunelAberto | null = null;
  /** a boca do par do dono só dispara de novo depois de sair dela; o aviso de "só o dono" sai 1× por entrada */
  private bocaDonoArmada = true;
  private colisores: Colisor[] = [];
  private pessoas = new Map<string, PessoaCyber>();
  /** ids na ORDEM canônica dos membros (define a base de cada um). */
  private ordem: string[] = [];
  /** marcos megalíticos (Zaeon…) e o estado "no topo da Zaeon" do dono */
  private lms: LandmarkHandle[] = [];
  /** REGIÕES por distância (components/cyber/regioesCena): de longe some o detalhe e a animação para */
  private regioes = new Map<THREE.Object3D, RegiaoCena>();
  /** a viagem na ESCADA DE ENERGIA do lounge (lib/cyber/ceu `bocaDaEscada`): sobe ou desce sozinha, surfando */
  private viagem: { tipo: "escada" | "elevador"; sentido: "sobe" | "desce"; t: number } | null = null;
  /** QUALIDADE ADAPTATIVA (lib/cyber/qualidadeAdaptativa): o pixel ratio do perfil é o teto; a escada multiplica */
  private qa!: QualidadeAdaptativa; private prBase = 1; private ultimoDesenho = 0;
  private frustum = new THREE.Frustum(); private mProj = new THREE.Matrix4(); private esfAtor = new THREE.Sphere();
  private noTopo = false;
  /** em qual marco andável estou no ALTO (escada/plataforma), e a altura do chão sob mim */
  private altoEm: string | null = null; private yNav = 0;
  /** clique na escada vindo do chão: primeiro o pé, depois o ponto clicado */
  private alvoDepois: THREE.Vector2 | null = null;
  /** CIDADE ZAEON (céu) + a NAVE do dono */
  private cidade: CidadeHandle | null = null;
  /** o holograma do recado do dono, ao lado da tela de trabalho da base do QG (do Andrei) */
  private holo: HoloRecadoHandle | null = null; private recadoId: string | null | undefined = undefined;
  /** a Universidade (castelo no chão, ao norte da praça) */
  private univ: UniversidadeHandle | null = null;
  /** os OUTROS CAMPI flutuantes (UFC, Unifor, UECE — lib/cyber/campi) */
  private campi: { id: IdCampus; h: CampusHandle; area: () => Regiao }[] = [];
  /** a Solana House (Superteam Brasil) — disco flutuante com prédio de 3 andares + rooftop */
  private solana: SolanaHouseHandle | null = null;
  /** o player do toca-discos do lounge (a música sai das caixas, sincronizada pra sala toda) */
  private somLounge: SomLoungeHandle | null = null;
  /** em pé num LUGAR FLUTUANTE (universidade / Solana House) e em que andar (lib/cyber/plataformas) */
  private plat: { id: IdPlataforma; andar: number } | null = null;
  private nave: NaveHandle | null = null;
  /** a nave-QG: mora PAIRANDO na doca ao lado da Zaeon (ou onde o dono a estacionou — `setNaveQG`) */
  private naveEst: EstadoVoo = { ...poseDaDoca(), vx: 0, vy: 0, vz: 0 };
  /** A BORDO da nave-QG, andando no convés: a posição LOCAL (no referencial da nave — ela pode estar voando) */
  private bordo: Bordo | null = null;
  /** saí voando de mochila pela redoma aberta: o casco da própria nave não me empurra até eu passar do dorso */
  private saindoPelaRedoma = false;
  /** o dono já mexeu na nave nesta sessão (o estado salvo na sala não passa por cima) */
  private naveMexida = false;
  private pilotando = false; private pousado = true; private voY = { subir: false, descer: false }; private yawAnt = 0;
  /** direcional na tela (desktop) e "Pousar" (desce sozinho até encostar; qualquer comando manual cancela) */
  private botDir = { x: 0, z: 0 }; private autoPouso = false; private rota: { destino: DestinoRota; pontos: Waypoint[] } | null = null; private cmdVoo = { subir: false, descer: false };
  /** HUD de voo em 3D/DOM: marcador de pouso, anel da borda da ilha, indicadores dos destinos */
  private hudVoo: { marca: THREE.Mesh; borda: THREE.Mesh; chave: string; t: number } | null = null;
  private portalArmado = true;   // o anel de um buraco negro só dispara de novo depois de sair dele
  private estadoQG = "";
  private eu!: Ator;
  private remotos = new Map<string, Ator>();
  private falas: Fala[] = [];
  private raf = 0; private vivo = true; private visivel = true;
  /** limite de quadros (celular/aparelho fraco) e pausa (celular em pé, esperando girar) */
  private fpsMax = 0; private ultimoQuadro = 0; private pausado = false;
  private clock = new THREE.Clock();
  private ray = new THREE.Raycaster();
  private rayCam = new THREE.Raycaster();
  private ro: ResizeObserver; private io: IntersectionObserver | null = null;
  private w = 1; private h = 1;
  // estado de jogo
  private menu: boolean; private holdT = 0; private espaco = false;
  private keys: Record<string, boolean> = {}; private joy = { x: 0, y: 0, on: false }; private correr = false;
  private alvo: THREE.Vector2 | null = null;
  /** mochila a jato (no lugar do pulo): `tecla` = segurando ESPAÇO/VOAR; no ar, `y` é a altura no mundo */
  private jet = { tecla: false, noAr: false, y: 0, vy: 0 };
  /** velocidade horizontal no ar (embalo do impulso da mochila) e se os jatos estão empurrando pra frente agora */
  private jetV = { x: 0, z: 0 }; private impulsoFrente = false;
  /** em pé numa ILHOTA (índice em ILHOTAS) — a altura vem da flutuação dela; passou da borda, cai */
  private ilhota: number | null = null;
  /** MOTOS VOADORAS (lib/cyber/motos): as das VAGAS são decoração ESTÁTICA (um lote por moto: barata) e sempre
   *  prontas — quem monta LEVA a moto e o ROBÔ de cada estacionamento fabrica outra na vaga (`fabricas`). A moto de cada
   *  piloto é uma INSTÂNCIA animada (`instMotos`, chave "<dono>:r" montada / "<dono>:p" estacionada; dono "eu" = eu),
   *  criada sob demanda e reaproveitada por look (`poolMotos`). `loops`/`som` = o som por estágio (lib/cyber/somMoto). */
  /** `g` = a posição na vaga (o corte por distância mexe nele); `moto` = a moto em si (some/se forma com o robô) */
  private vagaMotos: { g: THREE.Group; moto: THREE.Object3D; alvos: THREE.Object3D[] }[] = [];
  /** `efeitoEm` = a vaga onde está a luz da fabricação (fica lá até o clarão acabar) */
  private fabricas: { lote: Lote; f: Fabrica; robo: RoboMotosHandle; pos: { x: number; y: number; z: number }; rumo: number; efeitoEm: number | null }[] = [];
  private instMotos = new Map<string, InstMoto>();
  private poolMotos = new Map<string, InstMoto[]>();
  /** remotos: o que cada um montava no quadro anterior ("vaga|de") — montou de uma VAGA → ela esvaziou */
  private motoVista = new Map<string, string>();
  /** montado: a vaga de ORIGEM da moto (o look) e `motoDe` = de quem era a estacionada que peguei (eu mesmo, inclusive) */
  private motoDe: string | undefined = undefined;
  private moto: number | null = null; private motoEst: EstadoMoto = motoParada(0, 0, 0, 0); private motoPousado = true;
  /** cliquei numa moto longe: anda até ela e monta ao chegar */
  private motoAlvo: AlvoMoto | null = null;
  /** a moto que EU estacionei: fica onde desci (não volta pra vaga) — os outros veem pela minha presença */
  private motoLargada: MotoLargada | null = null;
  /** botão ⚡ da moto apertado; a câmera volta pra trás da moto a partir de `camSegueEm` (mexeu o mouse = espera) */
  private boostBotao = false; private camSegueEm = 0; private acelMoto = 0;
  /** a sensação de velocidade na tela (suavizada): FOV, blur radial, linhas de velocidade, tremida do boost */
  private velTela = 0; private fovBase = 0; private fxVel: VelocidadeTela | null = null;
  /** a capela, a laje do lounge e a torre do DJ: sólidos pra quem VOA (moto/nave) — fixos, calculados uma vez (a torre
   *  é um campo de força pra quem não é o dono: só ele pousa na cabine) */
  private readonly solidosCidade: Pilar[];
  private montadoTmp = { maoE: new THREE.Vector3(), maoD: new THREE.Vector3(), peE: new THREE.Vector3(), peD: new THREE.Vector3() };
  /** em pé no dorso da nave (depois de sair dela, ou pousando nela de mochila) */
  private sobreNave = false;
  // ── ÁUDIO (components/cyber/AudioCyber): loops presos aos objetos + one-shots nos eventos ──
  private som!: AudioCyberHandle;
  private somLoops: { leito?: LoopSom; naveIdle?: LoopSom; naveVoo?: LoopSom; jet?: LoopSom[] } = {};
  /** subir/descer da MINHA nave: o som sai 1× no começo da ação (gatilhosVoo) */
  private gatilhoNave = gatilhoVooInicial();
  private somCristais = new Map<string, LoopSom>();
  private passoT = 0; private passoI = 0; private neuronioT = 9; private somNave = somNaveInicial(); private tVivo = 0; private somEntrada = false;
  private sitT = 0; private perto = false; private falandoCom: Ator | null = null;
  private hoverBase: string | null = null; private sobContainer = false;
  private camAz = 0; private camPitch = 0.16; private camDist = 9; private camT = new THREE.Vector3(0, 1.2, 0);
  private ptrs = new Map<number, { x: number; y: number }>(); private drag: { x: number; y: number; az: number; pitch: number } | null = null; private moved = false; private pinch0 = 0; private dist0 = 9;
  /** OLHAR LIVRE (tela cheia, mouse): o 1º clique trava o ponteiro (pointer lock) e daí mexer o mouse gira a câmera,
   *  sem segurar botão. Sem mira e sem clique de ação: as ações são pela tecla F (ver `acaoPerto`). Esc solta. */
  private olharLivre = false; private travando = false; private dicaMira: HTMLDivElement | null = null;
  /** a AÇÃO de contexto agora (o que o F faz) — o React mostra o chip "F · rótulo" */
  private acaoChave = "";
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
    this.solidosCidade = solidosDaCidade(!!opts.eu.fundador);
    const { container, low } = opts;
    this.w = Math.max(1, container.clientWidth); this.h = Math.max(1, container.clientHeight);
    const q = opts.qualidade;
    this.R = new THREE.WebGLRenderer({ antialias: q ? q.antialias : !low, powerPreference: "high-performance" });
    this.prBase = Math.min(q ? q.pixelRatioMax : low ? 1.25 : 1.5, window.devicePixelRatio || 1);   // tela retina a 2× custava ~78% mais pixels
    this.R.setPixelRatio(this.prBase);
    this.R.setSize(this.w, this.h, false);
    this.fpsMax = q?.fpsMax ?? 0;
    this.qa = new QualidadeAdaptativa(this.fpsMax);
    this.R.autoClear = false; this.R.outputColorSpace = THREE.SRGBColorSpace;
    const cv = this.R.domElement; cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:" + (opts.menu ? "pan-y" : "none");
    container.appendChild(cv);
    this.cam = new THREE.PerspectiveCamera(45, this.w / this.h, 0.15, 3600);   // mapa de raio 1500 (os campi na borda: de um lado se vê o outro)
    this.cena = criarCenaCosmica(low, this.w / this.h);
    // a ILHA da praça (sempre: sem chão, as bases precisam de onde ficar)
    { const pr = criarPraca({ low, starTex: this.cena.starTex }); camuflarGrupo(pr.group);
      fundirEstaticos(pr.group, { passo: (_, t) => pr.atualizar(1 / 30, t), manter: [pr.piso] });
      this.cena.scene.add(pr.group); this.praca = pr; }
    if (opts.landmarks) for (const poi of POIS) {
      const lm = criarLandmark(poi, { low, starTex: this.cena.starTex });
      camuflarGrupo(lm.group);   // holograma: sem PBR nem luzes (components/cyber/camuflagem)
      fundirEstaticos(lm.group, { passo: (k, t) => { lm.donoPresente(k % 2 === 0); lm.atualizar(1 / 30, t); }, manter: comDescendentes([...lm.alvos, lm.topo, lm.monitorTopo, lm.escada]) });
      this.cena.scene.add(lm.group); this.lms.push(lm);   // sem rótulo na tela (interface limpa); o nome sai no painel do clique
    }
    if (opts.landmarks) {
      this.cidade = criarCidade({ low, starTex: this.cena.starTex });
      camuflarGrupo(this.cidade.group);
      { const c = this.cidade;   // lotes: simula com e sem música (o palco, as caixas e a pista pulsam com o grave)
        fundirEstaticos(c.group, { passo: (k, t) => { c.somTocando(k % 3 !== 0, (k % 5) / 4); c.atualizar(1 / 30, t); }, manter: [...comDescendentes([...c.alvos, c.portalTunel, c.tvLounge]), ...[c.tocaDiscos, ...c.caixasLounge].filter((x): x is THREE.Object3D => !!x)] });   // a mesa do DJ e as bocas das caixas: só o próprio nó (é posição/som, não clique)
        c.somTocando(false); for (let i = 0; i < 6; i++) c.atualizar(1, 0); }
      this.cena.scene.add(this.cidade.group);
      this.bercario = criarBercario(this.cidade.ilha, { low });   // os tubos de ensaio, ao lado da Recepção (flutuam com a ilha)
      if (baseNoQG()) { this.holo = criarHoloRecado(); this.cena.scene.add(this.holo.group); }
      this.univ = criarUniversidade({ low, starTex: this.cena.starTex }); camuflarGrupo(this.univ.group); this.cena.scene.add(this.univ.group);
      { const u = this.univ; fundirEstaticos(u.group, { passo: (_, t) => u.atualizar(1 / 30, t), manter: comDescendentes(u.alvosCamera) }); }
      for (const id of IDS_CAMPI) {   // os outros campi: prédios instanciados (o lote só junta a fundação/placas)
        const C = CAMPI[id], h = criarCampus(id, { low }); this.cena.scene.add(h.group);
        fundirEstaticos(h.group, { passo: (_, t) => h.atualizar(1 / 30, t), manter: comDescendentes(h.alvosCamera) });
        this.campi.push({ id, h, area: cil(C.centro, C.r, C.y, Math.min(220, C.r * 0.6) + 20, 110) });
      }
      this.solana = criarSolanaHouse({ low, starTex: this.cena.starTex }); camuflarGrupo(this.solana.group); this.cena.scene.add(this.solana.group);
      { const so = this.solana; fundirEstaticos(so.group, { passo: (_, t) => so.atualizar(1 / 30, t) }); }
      pararCamuflagem(typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
      this.nave = criarNave({ low, cor: "#2f7bff" }); loteNave(this.nave); this.cena.scene.add(this.nave.group);
      // as motos das VAGAS: paradas pra sempre → um lote estático cada (o robô repõe; quem monta leva uma instância)
      vagas().forEach((v, i) => {
        const h = criarMoto({ ...lookDaVaga(i), low });
        for (let k = 0; k < 6; k++) h.atualizar({ dt: 1, t: 0, voando: false, vel: 0, curva: 0 });
        fundirEstaticos(h.group, { manter: comDescendentes(h.alvos) });
        const g = new THREE.Group(); g.add(h.group); g.position.set(v.x, this.yDaVaga(v), v.z); g.rotation.y = v.yaw;
        this.cena.scene.add(g); this.vagaMotos.push({ g, moto: h.group, alvos: h.alvos });
      });
      // o ROBÔ de cada estacionamento, pousado na plataforma dele
      for (const l of LOTES) {
        const robo = criarRoboMotos({ low }), b = baseDoRobo(l), y = this.yDoLote(l) + 1.6;
        robo.group.position.set(b.x, y, b.z); this.cena.scene.add(robo.group, robo.efeito);
        this.fabricas.push({ lote: l, f: fabricaNova(), robo, pos: { x: b.x, y, z: b.z }, rumo: l.rot, efeitoEm: null });
      }
      const marca = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.2, 40), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      marca.rotation.x = -Math.PI / 2; marca.visible = false; this.cena.scene.add(marca);
      const borda = new THREE.Mesh(new THREE.TorusGeometry(CIDADE.bordaR, 0.14, 6, low ? 64 : 128), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      borda.rotation.x = Math.PI / 2; borda.position.set(CIDADE.centro.x, CIDADE.pisoY, CIDADE.centro.z); borda.visible = false; this.cena.scene.add(borda);
      this.hudVoo = { marca, borda, chave: "", t: 0 };
      // o FAROL do tour: uma coluna de luz no alvo do passo (some fora do tour)
      const farol = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 60, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcf6e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      farol.visible = false; this.cena.scene.add(farol); this.farol = farol;
    }

    this.som = criarAudioCyber({ camera: this.cam, cena: this.cena.scene, low });
    if (this.cidade?.caixasLounge.length && opts.urlMusica) this.somLounge = criarSomLounge({ audio: this.som, caixas: this.cidade.caixasLounge, urlDe: opts.urlMusica });
    this.setPessoas([...opts.membros]);
    if (this.cidade) this.criarDroid();
    this.montarSom();
    this.ligarEntradas();
    this.ro = new ResizeObserver(() => this.redimensionar()); this.ro.observe(container);
    if (typeof IntersectionObserver !== "undefined") { this.io = new IntersectionObserver((e) => { this.visivel = !!e[0]?.isIntersecting; }); this.io.observe(container); }
    this.clock.start();
    this.raf = requestAnimationFrame((t) => this.loop(t));
    if (process.env.NODE_ENV !== "production") (window as unknown as { __cyber?: CyberEngine }).__cyber = this;   // depuração em dev
  }
  /** estado pra depuração/testes em dev */
  get debug() { return { x: this.eu.pos.x, z: this.eu.pos.z, alt: this.eu.alt, altoEm: this.altoEm, noTopo: this.noTopo, pilotando: this.pilotando, pousado: this.pousado, nave: { ...this.naveEst }, moto: this.moto, motoEst: { ...this.motoEst }, motoPousado: this.motoPousado, plat: this.plat, bordo: this.bordo, noAr: this.jet.noAr, tunel: this.tunel?.origem ?? null, guia: this.guia?.passo ?? null, guiaAlvo: this.guia ? ROTEIRO[this.guia.passo]?.alvo ?? null : null, bocaDJ: bocaDJMundo(), nascendo: !!this.nascendo, droid: this.droid ? { fase: this.droid.h.fase(), x: this.droid.pos.x, z: this.droid.pos.z, alt: this.droid.alt } : null, guiaAtivo: this.guia?.ativo ?? null }; }

  /** Reconstrói bases/atores quando a lista de membros muda (alguém entrou na sala). */
  setPessoas(lista: PessoaCyber[]) {
    const ids = lista.map((p) => p.id);
    if (!ids.includes(this.o.eu.id)) { lista = [...lista, this.o.eu]; ids.push(this.o.eu.id); }
    for (const p of lista) this.pessoas.set(p.id, p);
    this.ordem = ids;
    // bases especiais (só com os marcos na cena): o dono na ZAEON (céu)
    this.layouts = basesDosMembros(ids, undefined, { ceu: this.cidade ? ids.filter((id) => this.ehFundador(id)) : [] });
    for (const [id, lay] of this.layouts) {
      const existente = this.bases.get(id);
      if (existente) { if (existente.layout.x !== lay.x || existente.layout.z !== lay.z || existente.layout.nivel !== lay.nivel) existente.mover(lay); continue; }
      const b = criarBase(lay, this.corDe(id), this.cena.starTex, this.o.low); this.loteBase(b);
      b.group.position.y = this.yDoNivel(lay.nivel);
      this.cena.scene.add(b.group); this.bases.set(id, b);
      if (this.som && (!this.o.low || id === this.o.eu.id)) this.somCristais.set(id, this.som.loop("crystals", b.group, { dist: DISTANCIA.cristais }));
    }
    // a Recepção sempre tem a mesa e os cristais no centro do salão: a mesa da anfitriã
    const lqg = this.zaeon() ? baseNoQG() : null;
    if (lqg && !this.baseQG) { this.baseQG = criarBase(lqg, COR_QG, this.cena.starTex, this.o.low); this.loteBase(this.baseQG); this.baseQG.group.position.y = this.yDoNivel("qg"); this.cena.scene.add(this.baseQG.group); }
    if (!lqg && this.baseQG) { this.soltar(this.baseQG.group); this.baseQG.dispose(); this.baseQG = null; }
    for (const a of [this.eu, ...this.remotos.values()]) { if (!a) continue; const c = this.corDe(a.id); if (c !== a.color) { a.color = c; a.av.recolorir(c); a.tag.style.color = c; } }
    // colisão: bases do anel + marcos (a MESMA lista; empurrarParaFora faz o deslizar)
    this.colisores = [...this.layouts.values()].filter((l) => !l.nivel).map((l) => ({ x: l.x, z: l.z, r: BASE_COLLIDER_R }))
      .concat(colisoresDosPOIs(this.lms.map((l) => l.poi).filter((poi) => !poi.nav)));   // marcos andáveis: lib/cyber/nav
    if (!this.eu) {
      const lay = this.layouts.get(this.o.eu.id), sp = spawnDaBase(lay);
      this.eu = this.novoAtor(this.o.eu, sp.x, sp.z);
      if (lay?.nivel) this.entrarNivel(lay.nivel);   // nasce lá em cima, na frente da própria base (Zaeon)
      if (this.menu) { const s = this.assento(); this.eu.pos.set(s.x, 0, s.z); this.eu.facing = this.rotAssento(); this.eu.sit = 1; this.sitT = 1; }
      else this.eu.facing = lay?.nivel ? this.rotAssento() + Math.PI : Math.atan2(-sp.x, -sp.z);
      this.camT.set(this.eu.pos.x, 1.2 + this.yDoNivel(lay?.nivel), this.eu.pos.z);
      if (!this.menu && !(this.o.nascer && this.nascerNoTubo())) this.spawnNaNave();   // quem chega nasce no tubo; o dono, a bordo da nave
    }
  }

  /** Armadura: a minha é azul; a dos outros vem da ordem canônica dos membros (lib/cyber/cores). */
  private corDe(id: string) { return corDaArmadura(this.ordem, id, this.o.eu.id); }

  private novoAtor(p: PessoaCyber, x: number, z: number): Ator {
    const cor = this.corDe(p.id);
    const av = criarAvatarLuz(cor, this.cena.starTex, this.o.low, this.gltf); av.aura(this.qa.atual.aura);
    av.group.position.set(x, 0, z); this.cena.scene.add(av.group);
    const tag = document.createElement("div"); tag.style.cssText = TAG_CSS + "color:" + cor + ";"; tag.textContent = p.id === this.o.eu.id ? "" : p.name; this.o.overlay.appendChild(tag);   // o próprio avatar não leva rótulo
    return { id: p.id, name: p.name, color: cor, av, pos: new THREE.Vector3(x, 0, z), facing: 0, moving: false, sit: 0, tag, alt: 0 };
  }
  private removerAtor(a: Ator) { a.vozH?.remover(); a.vozH = null; this.soltarSomNave(a); this.soltarSomJet(a); a.nave?.dispose(); a.nave = null; a.av.dispose(); a.tag.remove(); this.falas = this.falas.filter((f) => { if (f.ator === a) { f.el.remove(); return false; } return true; }); }

  // ───────────── API pública (React → engine) ─────────────
  iniciar(go = "viajar") {
    if (!this.menu) return; this.menu = false; this.holdT = 0;
    this.o.els.menu && (this.o.els.menu.style.display = "none"); if (this.o.els.hold) this.o.els.hold.style.width = "0%";
    this.som.ativar();   // o whoosh de entrada sai em atualizarSom, quando o buffer chegar
    this.R.domElement.style.touchAction = "none";
    if (!(this.o.nascer && this.nascerNoTubo())) this.spawnNaNave();   // saiu da vista/menu: quem chega nasce no tubo; o dono, a bordo
    this.o.onSessao?.(go);
  }
  setJoystick(x: number, y: number) { this.joy.x = x; this.joy.y = y; this.joy.on = Math.hypot(x, y) > 0.15; }
  /** pausa a cena (ex.: celular em pé esperando girar) — não renderiza nem simula */
  pausar(on: boolean) { this.pausado = on; if (!on) this.clock.getDelta(); }
  alternarCorrer(): boolean { this.correr = !this.correr; return this.correr; }
  /** ESPAÇO / botão VOAR (segurar): decola e sobe; soltar cai planando até pousar */
  comandoJet(on: boolean) {
    this.jet.tecla = on;
    if (!on || this.jet.noAr || this.menu || this.pilotando || this.moto !== null || this.noTopo || this.viagem || this.nascendo || this.tunel) return;
    if (this.bordo) {   // a bordo: da CABINE (redoma aberta) sai-se voando por cima; da RAMPA, lá fora, pula-se; dentro de casa não
      const pelaRedoma = redomaAberta(this.bordo, this.pilotando);
      if (!pelaRedoma && !naRampaLaFora(this.bordo)) return;
      this.eu.alt = (this.poseNave() ? alturaDoConves(this.poseNave()!) : this.eu.alt) + alturaNoBordo(this.bordo, this.quedaRampa());
      this.bordo = null; this.saindoPelaRedoma = pelaRedoma;
    }
    if (this.sobreNave) { this.sobreNave = false; this.jet = { tecla: true, noAr: true, y: this.eu.alt, vy: 0 }; this.sitT = 0; this.alvo = null; this.alvoDepois = null; this.som.tocar("jump", this.eu.av.group.position, { dist: DISTANCIA.eu }); return; }
    // decola da praça, do piso do salão da Recepção ou da Zaeon (céu) — da escada não. Do salão da Recepção (que fica
    // no piso da Zaeon) o voo é o da Zaeon
    if (this.altoEm && !this.noCeu) { const z = this.zaeon(), mn = z ? marcoNav(z.poi) : null; if (!mn || this.yNav < mn.nav.pisoY - 0.01) return; this.altoEm = z && z.poi.base !== undefined ? "ceu" : null; this.yNav = this.altoEm ? CIDADE.pisoY : 0; }
    if (this.plat && !decolaDaPlataforma(this.plat.id, this.plat.andar, this.eu.pos)) return;   // dentro de casa (Solana House) não
    this.jet = { tecla: true, noAr: true, y: this.eu.alt, vy: 0 }; this.sitT = 0; this.alvo = null; this.alvoDepois = null; this.jetV = { x: 0, z: 0 }; this.ilhota = null; this.plat = null; this.bordo = null;
    this.som.tocar("jump", this.eu.av.group.position, { dist: DISTANCIA.eu });
  }
  /** um marco andável apoiado na PRAÇA pra quem voa (marco + alto das muralhas, com a flutuação) — hoje nenhum: a
   *  Recepção fica no piso da Zaeon (o voo de lá é o da Zaeon, com o pouso no salão em `passoNoAr`) */
  private qgNoAr(): QGNoAr | null { const z = this.zaeon(), mn = z && naPracaPOI(z.poi) ? marcoNav(z.poi) : null; return z && mn ? { ...mn, topoMuralhas: this.pilaresZaeon(z)[0]!.topo } : null; }
  /** a RECEPÇÃO (o marco andável no piso da Zaeon) */
  private recepcao(): { lm: LandmarkHandle; mn: MarcoNav } | null { const z = this.zaeon(), mn = z && z.poi.base !== undefined ? marcoNav(z.poi) : null; return z && mn ? { lm: z, mn } : null; }
  /** um quadro no ar: subir/cair, colisão por altura e pouso (chão, escada/salão do QG ou piso da Zaeon) */
  /** saiu do chão sem querer (borda da Zaeon / de uma ilhota): começa a cair DAQUI (queda normal da mochila) */
  private cairDaqui(embalo = { x: 0, z: 0 }) {
    this.jet = { tecla: false, noAr: true, y: this.eu.alt, vy: 0 }; this.jetV = { ...embalo };   // sai andando pra frente, não despenca rente à parede
    this.altoEm = null; this.ilhota = null; this.plat = null; this.bordo = null; this.sitT = 0; this.alvo = null; this.alvoDepois = null;
  }
  /** os corpos das ilhotas como sólidos de voo (do topo — com a flutuação — até o cone afinar) */
  private pilaresDasIlhotas(): Pilar[] {
    if (!this.cidade) return [];
    return ILHOTAS.map((il, k) => { const w = mundo(il), topo = this.cidade!.alturaIlhota(k); return { x: w.x, z: w.z, r: il.r, topo, base: topo - il.r * ALTURA_CORPO_ILHOTA }; });
  }
  private passoNoAr(eu: Ator, prev: { x: number; z: number }, dt: number) {
    const yAnt = this.jet.y;
    // pousa no DORSO da nave parada (vindo de cima)
    const naveParadaAqui = !!this.nave && !this.pilotando && this.nave.group.visible, topo = naveParadaAqui ? this.topoNave() : -Infinity;
    const dNave = Math.hypot(eu.pos.x - this.naveEst.x, eu.pos.z - this.naveEst.z);
    const sobreODorso = naveParadaAqui && dNave < CyberEngine.TOPO_NAVE_R && !(dNave < RAIO_REDOMA && this.redomaChamando());   // o vão da redoma aberta não é piso
    if (this.noCeu) {
      const base = this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY;
      // teto e paredes baixas contados do PISO de onde se voa (no lounge, 88 m acima da central: antes caía de lá)
      const pisoAqui = base + pisoDeVoo(eu.pos, yAnt - base);
      const v = passoVertical(this.jet.y, this.jet.vy, this.jet.tecla, dt, pisoAqui + tetoDoJet(null), this.impulsoFrente);
      const baixo = v.y - pisoAqui < JET.alturaBases ? this.colisoresDoNivel("ceu") : [], naves = v.y < topo - 0.2 ? this.colisoresDeNaves(CIDADE.pisoY) : [];
      let q = empurrarParaFora(resolverCidadeLivre(eu.pos), [...baixo, ...naves]);
      // a CABINE DO DJ é do dono: pra todo o resto a torre é um campo de força (não se pousa lá em cima de mochila)
      if (!this.ehFundador(this.o.eu.id) && v.y < base + ALTURA_LOUNGE + TORRE_DJ.topo + CAMPO_DJ && naTorreDJ(q, 0.6)) q = foraDaTorreDJ(q);
      // a RECEPÇÃO: pousa no salão (vindo de cima); por baixo do salão a ilha dela é sólida
      const rc = this.recepcao();
      if (rc) {
        const pisoM = this.yDoNivel("qg"), dx = q.x - rc.mn.x, dz = q.z - rc.mn.z, d = Math.hypot(dx, dz);
        if (d <= rc.mn.nav.bordaR - 0.3 && yAnt >= pisoM - 0.05 && v.y <= pisoM && v.vy <= 0) {
          eu.pos.x = q.x; eu.pos.z = q.z; this.jet.y = pisoM; this.jet.noAr = false; this.altoEm = rc.lm.poi.id; this.yNav = rc.mn.nav.pisoY; this.somPouso(v.vy); return;
        }
        if (v.y < pisoM - 0.3 && d < rc.mn.nav.chaoR && v.y > base - 1) { const k = d > 1e-4 ? rc.mn.nav.chaoR / d : 1; q = { x: rc.mn.x + (d > 1e-4 ? dx * k : rc.mn.nav.chaoR), z: rc.mn.z + (d > 1e-4 ? dz * k : 0) }; }
      }
      eu.pos.x = q.x; eu.pos.z = q.z; this.jet.y = v.y; this.jet.vy = v.vy;
      const piso = pisoNoAr(q, v.y - base);   // a escada e o lounge só são piso pra quem vem de CIMA deles
      if (piso === null) { this.altoEm = null; return; }   // voou pra fora da Zaeon: céu livre (cai)
      if (sobreODorso && yAnt >= topo - 0.05 && v.y <= topo && v.vy <= 0) { this.jet.noAr = false; this.sobreNave = true; this.somPouso(v.vy); return; }
      const chao = base + piso;
      if (v.y <= chao && v.vy <= 0) { this.jet.y = chao; this.jet.noAr = false; this.yNav = CIDADE.pisoY; this.somPouso(v.vy); }
      return;
    }
    // perto de um LUGAR FLUTUANTE (universidade / Solana House): teto, paredes e pouso relativos ao disco dele
    const pid = plataformaPerto(eu.pos, this.jet.y);
    if (pid) {
      const P = PLATAFORMAS[pid], base = P.y, tetoP = base + tetoNaPlataforma(pid);
      const v = passoVertical(this.jet.y, this.jet.vy, this.jet.tecla, dt, yAnt > tetoP ? Math.max(tetoP, yAnt) : tetoP, this.impulsoFrente);
      const q = noArNaPlataforma(pid, eu.pos, v.y - base, yAnt - base);
      eu.pos.x = q.x; eu.pos.z = q.z; this.jet.y = v.y; this.jet.vy = v.vy;
      if (v.vy <= 0) for (const yRel of pousosNaPlataforma(pid, q)) {   // do mais alto pro mais baixo: o 1º cruzado é onde pousa
        const yF = base + yRel;
        if (yAnt >= yF - 0.05 && v.y <= yF) { this.plat = { id: pid, andar: andarDoPouso(pid, yRel) }; this.jet.noAr = false; this.somPouso(v.vy); return; }
      }
      return;
    }
    const qg = this.qgNoAr(), z = this.zaeon();
    // teto da mochila: perto do chão é pouco acima do QG; quem vem CAINDO do céu não é puxado pra baixo de uma vez
    // (o teto vira a altura atual: segurar o espaço PAIRA, não sobe)
    const tetoBase = tetoDoJet(qg), teto0 = yAnt > tetoBase ? Math.max(tetoBase, yAnt) : tetoBase;
    const pnPerto = this.pilotando ? null : this.poseNave(), pertoDaNave = !!pnPerto && Math.hypot(eu.pos.x - pnPerto.x, eu.pos.z - pnPerto.z) < NAVE_QG.raio + 20;
    const teto = this.saindoPelaRedoma || pertoDaNave ? Math.max(teto0, (pnPerto ? pnPerto.y + 2.2 * ESCALA_NAVE_V : this.topoNave()) + 12) : teto0;   // perto da nave (ou saindo pela redoma): dá pra subir acima do dorso — e voltar pra ela
    const v = passoVertical(this.jet.y, this.jet.vy, this.jet.tecla, dt, teto, this.impulsoFrente);
    if (this.cidade && v.y > 40) {   // lá em cima: a ilha da Zaeon e as ilhotas são pousos (e corpos sólidos)
      const topoIlha = this.cidade.ilha.position.y;
      if (naIlhaPrincipal(eu.pos) && yAnt >= topoIlha - 0.05 && v.y <= topoIlha && v.vy <= 0) {
        this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; this.jet.noAr = false; this.somPouso(v.vy); return;
      }
      for (let k = 0; k < ILHOTAS.length; k++) {
        const t = this.cidade.alturaIlhota(k);
        if (ilhotaEm(eu.pos) === k && yAnt >= t - 0.05 && v.y <= t && v.vy <= 0) { this.ilhota = k; this.jet.noAr = false; this.somPouso(v.vy); return; }
      }
      // corpos sólidos: a ilha (por baixo / de lado) e as ilhotas (de lado / por baixo)
      const f = foraDaIlha({ x: eu.pos.x, y: v.y, z: eu.pos.z }); eu.pos.x = f.x; eu.pos.z = f.z; if (f.y !== v.y) { v.y = f.y; v.vy = Math.min(0, v.vy); }
      for (const p of this.pilaresDasIlhotas()) {
        const dx = eu.pos.x - p.x, dz = eu.pos.z - p.z, d = Math.hypot(dx, dz);
        if (d >= p.r || v.y >= p.topo || v.y <= p.base!) continue;
        if (yAnt <= p.base! + 0.3) { v.y = p.base!; v.vy = Math.min(0, v.vy); continue; }   // bateu a cabeça por baixo
        const k = d > 1e-4 ? p.r / d : 1; eu.pos.x = p.x + (d > 1e-4 ? dx * k : p.r); eu.pos.z = p.z + (d > 1e-4 ? dz * k : 0);
      }
    }
    const q: { x: number; z: number } = resolverNoAr(prev, eu.pos, v.y, yAnt, qg, v.y < topo - 0.2 ? [...this.colisores, ...this.colisoresDeNaves(this.naveEst.y)] : this.colisores);
    eu.pos.x = q.x; eu.pos.z = q.z; this.jet.y = v.y; this.jet.vy = v.vy;
    if (v.y < QUEDA_VAZIO) { this.renascer(); return; }   // caiu no VAZIO (não há chão): renasce na praça
    if (pnPerto && v.vy <= 0) {   // de mochila na nave: pelo vão da REDOMA (aberta) cai-se na cabine; na RAMPA, pousa-se nela
      const base = alturaDoConves(pnPerto), b = pousoNaNave(paraLocal(pnPerto, q), yAnt - base, v.y - base, this.redomaChamando(), rampaDaNave(pnPerto).queda);
      if (b) { this.bordo = b; this.jet.noAr = false; this.saindoPelaRedoma = false; this.jetV = { x: 0, z: 0 }; const w = paraMundo(pnPerto, b); eu.pos.x = w.x; eu.pos.z = w.z; this.somPouso(v.vy); return; }
    }
    if (sobreODorso && yAnt >= topo - 0.05 && v.y <= topo && v.vy <= 0) { this.jet.noAr = false; this.sobreNave = true; this.somPouso(v.vy); return; }
    // o chão embaixo: o piso da PRAÇA (a ilha) — fora dela é o vazio (continua caindo)
    const chao = naPraca(q) ? PRACA.y : -Infinity, chaoVisto = chao > 0 && z ? chao + this.boia(z) : chao;
    if (v.y <= chaoVisto && v.vy <= 0) {
      this.jet.noAr = false; this.somPouso(v.vy);
      if (chao > 0.01 && z) { this.altoEm = z.poi.id; this.yNav = chao; } else { this.altoEm = null; this.yNav = 0; }
    }
  }
  /** Balão de fala sobre a pessoa (chat da sala). */
  falar(userId: string, texto: string) {
    const a = userId === this.o.eu.id ? this.eu : this.remotos.get(userId); if (!a) return;
    if (userId !== this.o.eu.id) this.som.tocar("chat-pop");
    this.falas = this.falas.filter((f) => { if (f.ator === a) { f.el.remove(); return false; } return true; });
    const el = document.createElement("div"); el.style.cssText = FALA_CSS + "border-color:" + a.color + ";"; el.textContent = texto.slice(0, 140);
    this.o.overlay.appendChild(el); this.falas.push({ el, ator: a, ate: performance.now() + 4200 });
  }
  get minhaBase(): LayoutBase | undefined { return this.layouts.get(this.o.eu.id); }
  /** altura do piso de um nível de base: chão, Zaeon (ilha no céu, flutuando) ou salão do QG (flutuando) */
  private yDoNivel(n?: NivelBase): number {
    if (n === "ceu") return this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY;
    if (n === "qg") { const z = this.zaeon(), mn = z ? marcoNav(z.poi) : null; return mn && z ? (z.poi.base ?? 0) + mn.nav.pisoY + this.boia(z) : 0; }
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
    this.noTopo = true; this.altoEm = null; this.alvo = null; this.alvoDepois = null; this.sitT = 0; this.jet.noAr = false; this.sobreNave = false; this.ilhota = null; this.plat = null; this.bordo = null;
    this.eu.pos.set(p.x, 0, p.z); this.o.onTopo?.(true); this.som.tocar("rise", this.eu.av.group.position, { dist: DISTANCIA.perto }); return true;
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

  // ───────────── Cidade Zaeon (céu), a REDE DE BURACOS NEGROS e a nave ─────────────
  get noCeu() { return this.altoEm === "ceu"; }
  /** em pé na Zaeon: no piso dela ou no salão/escada da Recepção (que fica no piso dela) */
  private get naZaeon() { return this.noCeu || (!!this.altoEm && !!this.recepcao() && this.altoEm === this.recepcao()!.lm.poi.id); }
  /** teleporte (corte seco — o React faz o túnel/fade): aparece no ponto `p` (mundo) do nó `id`, a pé, sem nada */
  private irParaNo(id: IdNo, p: { x: number; z: number; rumo: number } = NOS[id].chegada) {
    this.viagem = null; this.tunel = null;
    this.pilotando = false; this.noTopo = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0; this.falandoCom = null;
    this.jet.noAr = false; this.jetV = { x: 0, z: 0 }; this.sobreNave = false; this.ilhota = null; this.bordo = null; this.motoAlvo = null;
    this.plat = id === "zaeon" || id === "praca" ? null : { id, andar: 0 };
    this.altoEm = id === "zaeon" ? "ceu" : null; this.yNav = id === "zaeon" ? CIDADE.pisoY : 0;
    this.eu.pos.set(p.x, 0, p.z); this.eu.facing = p.rumo; this.camAz = p.rumo + Math.PI;
    const y = id === "zaeon" ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) : NOS[id].y;
    this.eu.alt = y; this.camT.set(p.x, y + 1.2, p.z); this.portalArmado = !noDoAnel(p, y);
    this.som.tocar("rise", new THREE.Vector3(p.x, y + 1, p.z), { dist: DISTANCIA.perto });
  }
  /** o TÚNEL: o React escolheu o destino (`null` = desistiu: fica onde está, fora do túnel) */
  viajarPeloTunel(destino: IdNo | null) {
    if (!this.tunel) return;
    if (!destino || destino === this.tunel.origem || !NOS[destino]) { this.tunel = null; return; }
    if (destino === "zaeon" && !this.cidade) { this.tunel = null; return; }
    this.irParaNo(destino);
  }
  // ───────────── NASCIMENTO no tubo + o TOUR da anfitriã + os AGENTES (lib/cyber/onboarding, lib/cyber/agentes) ─────────────
  /** saindo do tubo depois de nascer (o vidro dele não empurra até sair) */
  private saindoDoTubo: number | null = null;
  /** nasce no TUBO DE ENSAIO do berçário (ao lado da Recepção): parado até o vidro abrir; a anfitriã vem buscar */
  private nascerNoTubo(): boolean {
    if (!this.cidade || !this.bercario || this.menu) return false;
    const i = tuboDe(this.o.eu.id), tb = TUBOS[i]!;
    this.irParaNo("zaeon", { x: tb.x, z: tb.z, rumo: tb.rumo }); this.portalArmado = true;
    this.nascendo = { t: 0, tubo: i }; this.bercario.nascer(i);
    this.camPitch = 0.12; this.camDist = 4.6;   // a câmera PERTO (dentro da ilha, por baixo da tampa do tubo): o Droid nasce de frente pra nós
    this.guia = this.novoGuia(0); this.emitirGuia();
    return true;
  }
  /** o corpo do DROID (escondido até o tutorial começar: aparece num mini portal) */
  private criarDroid() {
    const h = criarDroid({ low: this.o.low }); this.cena.scene.add(h.group);
    const tag = document.createElement("div"); tag.style.cssText = TAG_CSS + "color:" + DROID.cor + ";display:none;"; tag.textContent = `${DROID.nome} ✦`; this.o.overlay.appendChild(tag);
    const pos = new THREE.Vector3(); this.droid = { h, pos, alt: 0, tag, fala: { pos, alt: 0 } };
  }
  /** a mesa da Recepção (o lar do Droid): lá, F chama ele de novo */
  private casaDoAgente(): { x: number; z: number; y: number; rumo: number } {
    const lay = baseNoQG(); if (!lay) { const d = DROID.lar; return { x: d.x, z: d.z, y: CIDADE.pisoY, rumo: 0 }; }
    const s = localParaMundo(lay, 0, -0.15); return { ...s, y: this.yDoNivel("qg"), rumo: lay.rot + Math.PI };
  }
  /** os tubos (na linha da muralha) são sólidos pra quem anda no piso da Zaeon — só os perto (são centenas) e menos o de
   *  quem está nascendo/saindo */
  private colisoresDosTubos(): Colisor[] {
    if (!this.bercario) return [];
    const p = this.eu.pos, out: Colisor[] = [];
    TUBOS.forEach((tb, i) => { if (i !== this.saindoDoTubo && i !== this.nascendo?.tubo && Math.abs(tb.x - p.x) < 6 && Math.abs(tb.z - p.z) < 6) out.push({ x: tb.x, z: tb.z, r: 1.4 }); });
    return out;
  }
  private novoGuia(passo: number) { return { passo, fala: 0, falaT: 0, ativo: false, andou: 0, motoAndou: 0, tunel: false, pisoY: this.eu.alt, prev: { x: this.eu.pos.x, z: this.eu.pos.z } }; }
  private emitirGuia() {
    if (!this.guia) { this.o.onGuia?.(null); return; }
    const p = ROTEIRO[this.guia.passo]!;
    this.o.onGuia?.({ passo: this.guia.passo, total: ROTEIRO.length, id: p.id, titulo: p.titulo, agente: DROID.nome, cor: DROID.cor });
  }
  private encerrarGuia() { this.guia = null; this.emitirGuia(); }
  /** o tutorial: "Próximo" (pula o passo — dev), "Pular" (o Droid se despede no portal) e "Refazer" (chamado na Recepção) */
  guiaProximo() { if (!this.guia || this.nascendo) return; this.irProPasso(this.guia.passo + 1); }
  guiaPular() { if (this.guia) { this.encerrarGuia(); this.droid?.h.sumir(); } }
  guiaRefazer() { if (!this.cidade || this.menu) return; this.guia = this.novoGuia(1); this.emitirGuia(); }
  private irProPasso(n: number) {
    if (n >= ROTEIRO.length) { this.encerrarGuia(); this.droid?.h.sumir(); return; }
    this.guia = this.novoGuia(n); this.emitirGuia();
    this.som.tocar("near-ping", this.eu.av.group.position, { dist: DISTANCIA.perto });
  }
  /** um balão de fala sobre quem fala (uma pessoa ou o Droid); `ms` = quanto fica (Infinity = até a próxima fala) */
  private balao(a: { pos: THREE.Vector3; alt: number }, texto: string, cor: string, ms = 4200) {
    this.falas = this.falas.filter((f) => { if (f.ator === a) { f.el.remove(); return false; } return true; });
    const el = document.createElement("div"); el.style.cssText = FALA_CSS + "border-color:" + cor + ";"; el.textContent = texto.slice(0, 160);
    this.o.overlay.appendChild(el); this.falas.push({ el, ator: a, ate: performance.now() + ms });
  }
  /** o Droid FALA: balão em cima dele + a fala no chat (só local) */
  private droidFala(texto: string, ultima: boolean) {
    const d = this.droid; if (!d) return;
    this.balao(d.fala, texto, DROID.cor, ultima ? Infinity : RITMO_FALA.entre * 1000 + 400);
    this.o.onFalaAgente?.({ id: DROID.id, nome: DROID.nome, cor: DROID.cor, texto });
  }
  /** por quadro: o vidro do tubo e a saída dele; o TUTORIAL: as falas do Droid (uma depois da outra), a espera pela
   *  pessoa cumprir (lib/cyber/onboarding `cumpriu`) e o farol do alvo */
  private atualizarNascimentoEGuia(dt: number) {
    const eu = this.eu;
    if (this.nascendo) {
      this.nascendo.t += dt;
      if (this.nascendo.t >= NASCIMENTO.sai) {
        const tb = TUBOS[this.nascendo.tubo]!; this.saindoDoTubo = this.nascendo.tubo; this.nascendo = null;
        this.alvo = new THREE.Vector2(tb.x + Math.sin(tb.rumo) * 2.6, tb.z + Math.cos(tb.rumo) * 2.6); this.alvoDepois = null;   // sai andando do tubo
      }
    }
    if (this.saindoDoTubo !== null) { const tb = TUBOS[this.saindoDoTubo]!; if (Math.hypot(eu.pos.x - tb.x, eu.pos.z - tb.z) > 2.2) this.saindoDoTubo = null; }
    const farol = this.farol, g = this.guia;
    if (!g) { if (farol) farol.visible = false; return; }
    const passo = ROTEIRO[g.passo]!;
    if (passo.cond.tipo === "nascer") { if (!this.nascendo) this.irProPasso(g.passo + 1); return; }
    // o que a pessoa fez desde a instrução
    const dx = eu.pos.x - g.prev.x, dz = eu.pos.z - g.prev.z; g.prev = { x: eu.pos.x, z: eu.pos.z };
    if (g.ativo) {
      if (this.moto !== null) g.motoAndou += Math.hypot(this.motoEst.vx, this.motoEst.vz) * dt;
      else if (!this.jet.noAr && !this.viagem && Math.hypot(dx, dz) < 2) g.andou += Math.hypot(dx, dz);   // (um teleporte não conta)
    } else if (!this.jet.noAr) g.pisoY = eu.alt;
    // as falas: só com o Droid já ali (saiu do portal)
    if (this.droid?.h.fase() === "visivel") {
      g.falaT += dt;
      if (g.fala < passo.falas.length && g.falaT >= (g.fala === 0 ? 0.35 : RITMO_FALA.entre)) { this.droidFala(passo.falas[g.fala]!, g.fala === passo.falas.length - 1); g.fala++; g.falaT = 0; }
      else if (g.fala >= passo.falas.length && !g.ativo && g.falaT >= RITMO_FALA.antesDeConferir) { g.ativo = true; g.andou = 0; g.motoAndou = 0; g.tunel = false; }
    }
    if (passo.cond.tipo === "fim") {   // o fim: ele se despede e some no portal
      if (g.fala >= passo.falas.length && g.falaT >= RITMO_FALA.fimSome && this.droid) { this.droid.h.sumir(); this.falas = this.falas.filter((f) => { if (f.ator === this.droid!.fala) { f.el.remove(); return false; } return true; }); this.encerrarGuia(); }
    } else if (g.ativo && cumpriu(passo.cond, { nascendo: !!this.nascendo, andou: g.andou, noAr: this.jet.noAr ? this.jet.y - g.pisoY : 0, pertoDesktop: this.noCeu && computadorPerto(eu.pos, 4.5) >= 0, naMoto: this.moto !== null, motoAndou: g.motoAndou, tunel: g.tunel })) this.irProPasso(g.passo + 1);
    if (farol) {
      const a = this.guia ? ROTEIRO[this.guia.passo]?.alvo ?? null : null;
      farol.visible = !!a && !this.nascendo && this.naZaeon;
      if (a && farol.visible) { farol.position.set(a.x, (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + 28, a.z); (farol.material as THREE.MeshBasicMaterial).opacity = 0.16 + 0.08 * Math.sin(performance.now() * 0.003); }
    }
  }
  /** o DROID: aparece num mini portal do lado da pessoa (quando o tutorial começa — e de novo depois de um teleporte);
   *  vai PLANANDO do lado dela, ou NA FRENTE quando o passo é "vem comigo até…"; olha pra ela; some no portal no fim */
  private atualizarAgentes(dt: number, t: number) {
    const d = this.droid; if (!d) return;
    const eu = this.eu, fase = d.h.fase(), passo = this.guia ? ROTEIRO[this.guia.passo] : undefined;
    const quer = !!this.guia && !this.nascendo && !this.menu && passo?.cond.tipo !== "nascer";
    // pra onde ele vai: do lado da pessoa — ou, num passo "vem comigo até…", ELE VAI: voa rumo ao alvo e, se a pessoa
    // ficar pra trás, para e espera por ela (virado pra ela)
    const a = passo?.alvo, altAlvo = eu.alt + 2.3;
    const lidera = !!a && this.naZaeon && !this.tunel;   // "vem comigo até…": ele VAI até lá e espera lá
    // NA FRENTE da pessoa, no campo de visão (a câmera olha por cima do ombro): ~5 m à frente, um pouco de lado pra não
    // tapar o personagem — é ali que ele nasce do portal, de frente pros nossos olhos
    const vx0 = -Math.sin(this.camAz), vz0 = -Math.cos(this.camAz);
    const alvo = { x: eu.pos.x + vx0 * 5.2 - vz0 * 1.2, z: eu.pos.z + vz0 * 5.2 + vx0 * 1.2 };
    if (quer && fase === "oculto") { d.pos.set(alvo.x, 0, alvo.z); d.alt = altAlvo; d.h.aparecer(); this.som.tocar(this.som.temSom("cyber-enter") ? "cyber-enter" : "rise", d.h.group.position, { dist: DISTANCIA.perto }); this.som.tocar("rise", d.h.group.position, { dist: DISTANCIA.perto }); }
    else if (!quer && (fase === "visivel" || fase === "entrando") && !this.guia) d.h.sumir();
    else if (fase === "visivel") {
      const longe = Math.hypot(d.pos.x - eu.pos.x, d.pos.z - eu.pos.z);
      if (lidera && a) {
        // ele VAI: voa direto pro alvo (um pouco mais rápido que quem anda — dá pra ver ele indo e seguir) e, chegando,
        // fica PAIRANDO lá em cima do alvo, esperando a pessoa chegar
        const vx = a.x - d.pos.x, vz = a.z - d.pos.z, dd = Math.hypot(vx, vz);
        if (dd > 0.6) { const v = Math.min(9, 2 + dd * 0.6), k = Math.min(dd, v * dt); d.pos.x += (vx / dd) * k; d.pos.z += (vz / dd) * k; }
        const yAlvo = (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + 3.2;
        d.alt += (yAlvo - d.alt) * Math.min(1, dt * 2);
      } else if (longe > 60 || Math.abs(altAlvo - d.alt) > 30) d.h.sumir();   // ficou pra trás (teleporte, túnel, queda): some e reaparece do lado
      else {
        const dx = alvo.x - d.pos.x, dz = alvo.z - d.pos.z, dist = Math.hypot(dx, dz);
        const v = Math.min(80, 1.2 + dist * 2.4), k = Math.min(dist, v * dt); if (dist > 1e-3) { d.pos.x += (dx / dist) * k; d.pos.z += (dz / dist) * k; }
        d.alt += (altAlvo - d.alt) * Math.min(1, dt * 3);
      }
    }
    if (fase === "oculto" && !d.h.group.visible) { d.tag.style.display = "none"; return; }
    d.h.group.position.set(d.pos.x, d.alt, d.pos.z);
    d.fala.alt = d.alt - 1.0;
    d.h.atualizar(dt, t, Math.atan2(eu.pos.x - d.pos.x, eu.pos.z - d.pos.z));
  }


  /** caiu no VAZIO: renasce na praça, na frente da própria base (o fundador, na Zaeon) */
  private renascer() {
    const lay = this.layouts.get(this.o.eu.id);
    const naZaeon = lay?.nivel === "ceu" && !!this.cidade;
    if (naZaeon) this.irParaNo("zaeon");
    else { const sp = spawnDaBase(lay); this.irParaNo("praca", { ...sp, rumo: Math.atan2(-sp.x, -sp.z) }); }
    this.o.onAviso?.(`Você caiu no vazio — de volta ${naZaeon ? "à Zaeon" : "à praça"}.`);
  }
  /** o PAR do dono (o React já validou no servidor): da nave → cabine do DJ; da cabine → a bordo da nave */
  atravessarBuracoDono(para: "dj" | "nave") {
    if (!this.ehFundador(this.o.eu.id) || this.menu) return;
    this.viagem = null; this.tunel = null; this.pilotando = false; this.noTopo = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0;
    this.jet.noAr = false; this.jetV = { x: 0, z: 0 }; this.sobreNave = false; this.ilhota = null; this.plat = null; this.bocaDonoArmada = false;
    if (para === "dj") {
      const c = chegadaDJMundo();
      this.bordo = null; this.altoEm = "ceu"; this.yNav = CIDADE.pisoY;
      this.eu.pos.set(c.x, 0, c.z); this.eu.facing = rumoDoDJ(); this.camAz = rumoDoDJ() + Math.PI;
      const y = (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + alturaNaCidade(c); this.eu.alt = y; this.camT.set(c.x, y + 1.2, c.z);
    } else {
      const p = this.poseNave(); if (!p) return;
      this.altoEm = null; this.yNav = 0; this.bordo = { ...CHEGADA_NAVE, nivel: 0 };
      const w = paraMundo(p, this.bordo); this.eu.pos.set(w.x, 0, w.z); this.eu.facing = p.yaw; this.camAz = p.yaw + Math.PI;
      this.eu.alt = alturaDoConves(p); this.camT.set(w.x, this.eu.alt + 1.2, w.z);
    }
    this.som.tocar("rise", this.eu.av.group.position, { dist: DISTANCIA.perto });
  }
  /** embarca na nave (precisa estar perto dela) */
  embarcar() {
    // assume o LEME (só a bordo, na ponte; o React já validou no servidor que é o dono)
    if (!this.nave || this.pilotando || this.moto !== null || !this.bordo || acaoNaNave(this.bordo, true) !== "pilotar" || !this.ehFundador(this.o.eu.id)) return;
    this.pilotando = true; this.bordo = null; this.autoPouso = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0; this.naveMexida = true;
    this.naveEst = { ...this.naveEst, vx: 0, vy: 0, vz: 0 };
    this.pousado = this.naveEst.y - chaoDoVoo(this.naveEst, this.solidosDeVoo()) < 0.35;
    this.eu.tag.style.display = "none";
  }
  /** LARGA O LEME: a nave para onde está (pousada ou PAIRANDO no ar — é estacionária) e eu fico de pé na ponte */
  desembarcar() {
    if (!this.pilotando) return;
    this.pararRota(); this.autoPouso = false; this.voY.subir = this.voY.descer = false;
    const n = this.naveEst; this.naveEst = { ...n, vx: 0, vy: 0, vz: 0 };
    this.pilotando = false; this.bordo = { ...NAVE_QG.emPe, nivel: 1 };   // de pé na cabine: a redoma abre
    this.eu.facing = n.yaw; this.eu.av.group.visible = true;
    if (this.ehFundador(this.o.eu.id)) this.o.onNaveParada?.({ x: n.x, y: n.y, z: n.z, yaw: n.yaw });
  }
  /** SPAWN do dono: dentro da nave-QG, de pé na CABINE DE COMANDO (redoma aberta), olhando pra proa — onde quer que
   *  ela esteja estacionada (a posição é no referencial da nave). Os outros nascem como antes. */
  private spawnNaNave(): boolean {
    if (!this.nave || !this.ehFundador(this.o.eu.id)) return false;
    const p = this.poseNave(); if (!p) return false;
    this.altoEm = null; this.yNav = 0; this.noTopo = false; this.ilhota = null; this.plat = null; this.sobreNave = false;
    this.jet.noAr = false; this.sitT = 0; this.eu.sit = 0; this.alvo = null; this.alvoDepois = null;
    this.bordo = { ...NAVE_QG.emPe, nivel: 1 };
    const w = paraMundo(p, this.bordo); this.eu.pos.set(w.x, 0, w.z); this.eu.facing = p.yaw;
    this.camAz = p.yaw + Math.PI;   // a câmera atrás de mim, olhando pra proa
    this.camT.set(w.x, alturaDoConves(p) + NAVE_QG.cabine + 1.2, w.z);
    return true;
  }
  /** a nave-QG que está À VISTA (a minha cópia, ou a do dono quando ele está online com ela) e a pose dela */
  private poseNave(): (PoseNave & { h: NaveHandle }) | null {
    if (!this.ehFundador(this.o.eu.id)) for (const a of this.remotos.values()) if (a.nave) return a.naveP ? { ...a.naveP, h: a.nave } : { x: a.pos.x, y: a.alt, z: a.pos.z, yaw: a.naveYaw ?? 0, h: a.nave };
    return this.nave ? { x: this.naveEst.x, y: this.naveEst.y, z: this.naveEst.z, yaw: this.naveEst.yaw, h: this.nave } : null;
  }
  /** ENTRA na nave (perto da porta de trás, lá fora — a pé ou de mochila): aparece no corredor, olhando pra proa */
  entrarNaNave() {
    const p = this.poseNave(); if (!p || this.pilotando || this.moto !== null) return;
    this.altoEm = null; this.yNav = 0; this.noTopo = false; this.ilhota = null; this.plat = null; this.sobreNave = false; this.jet.noAr = false; this.jetV = { x: 0, z: 0 };
    this.sitT = 0; this.alvo = null; this.alvoDepois = null;
    this.bordo = { x: 0, z: NAVE_QG.portaDentro.z + 1.4, nivel: 0 };
    const w = paraMundo(p, this.bordo); this.eu.pos.set(w.x, 0, w.z); this.eu.facing = p.yaw;
    this.som.tocar("near-ping", this.eu.av.group.position, { dist: DISTANCIA.eu });
  }
  /** quanto a rampa desce agora (onde a nave está) */
  private quedaRampa(): number { const p = this.poseNave(); return p ? rampaDaNave(p).queda : NAVE_QG.deck; }
  /** a porta dá em chão firme: a nave pousada no chão ou na doca (a saída na ilha da Zaeon, na altura do piso) */
  private saidaSegura(): boolean {
    const p = this.poseNave(); if (!p) return false;
    if (p.y < 1.5) return naPraca(paraMundo(p, NAVE_QG.saida));   // pousada na altura da praça: só se a rampa dá NELA (fora é o vazio)
    return naIlhaPrincipal(paraMundo(p, NAVE_QG.saida)) && Math.abs(alturaDoConves(p) - CIDADE.pisoY) < 1.5;
  }
  /** SAI pela porta de trás: aparece no fim da rampa, na altura do convés — pousada, desce pro chão; PAIRANDO, cai
   *  (e dá pra voar de mochila): a nave é estacionária, dá pra sair dela no ar */
  sairDaNave() {
    const p = this.poseNave(); if (!p || !this.bordo) return;
    const w = paraMundo(p, NAVE_QG.saida); this.bordo = null;
    this.eu.pos.set(w.x, 0, w.z); this.eu.facing = p.yaw + Math.PI; this.eu.alt = alturaDoConves(p);
    this.cairDaqui();
  }
  /** onde a nave-QG ficou estacionada (vem da sala): vale enquanto o dono não mexe nela nesta sessão */
  setNaveQG(pose: PoseNave | null) {
    if (!pose || this.pilotando || this.naveMexida) return;
    // pose salva numa DOCA ANTIGA (a Zaeon já foi a 230 e a 290 m; a nave já teve o convés a 7 m): ignora → doca nova
    for (const d of [NAVE_QG.deck, DECK_ANTIGO]) for (const h of [230, 290]) if (Math.abs(pose.y + d - h) < 1.5) return;
    // atracada na Zaeon de hoje mas com o convés da nave antiga (maior): acerta a altura pro convés novo
    if (Math.abs(pose.y + DECK_ANTIGO - CIDADE.pisoY) < 1.5) pose = { ...pose, y: CIDADE.pisoY - NAVE_QG.deck };
    // na doca (de qualquer jeito que tenha sido salva): a doca de hoje — de frente pra Zaeon, a rampa na borda
    { const d = poseDaDoca(); if (Math.hypot(pose.x - d.x, pose.z - d.z) < 20 && Math.abs(pose.y - d.y) < 10) pose = d; }
    this.naveEst = { ...this.naveEst, ...pose, vx: 0, vy: 0, vz: 0 };
  }
  /** botões de movimento na tela: SUBIR/DESCER (segurar) */
  comandoVoo(c: { subir?: boolean; descer?: boolean }) { if (c.subir !== undefined) this.voY.subir = c.subir; if (c.descer !== undefined) this.voY.descer = c.descer; if (c.subir || c.descer) this.autoPouso = false; }
  /** botões de movimento na tela: direcional (x = direita, z = trás; relativo à câmera, como WASD) */
  direcaoVoo(x: number, z: number) { this.botDir.x = x; this.botDir.z = z; if (x || z) this.autoPouso = false; }
  /** atalho: a nave voa sozinha (com as mesmas entradas dos botões) até pousar no destino; qualquer botão cancela */
  irPara(destino: DestinoRota): boolean {
    if (!this.pilotando) return false;
    const pontos = rotaPara(destino, this.naveEst);
    if (!pontos.length) return false;
    this.rota = { destino, pontos }; this.autoPouso = false; this.o.onRota?.(destino); return true;
  }
  pararRota() { if (this.rota) { this.rota = null; this.o.onRota?.(null); } }
  /** "Pousar": desce sozinho até encostar no chão embaixo (mapa, cidade ou topo da Zaeon) */
  pousar() { if ((this.pilotando && !this.pousado) || (this.moto !== null && !this.motoPousado)) this.autoPouso = true; }
  /** as motos estacionadas que valem (as minhas e as dos outros; some a que alguém pegou) */
  private largadasAgora() {
    const euId = this.o.eu.id;
    return largadasValidas([{ id: euId, moto: this.moto !== null ? { s: this.moto, y: 0, yaw: 0, de: this.motoDe } : null, motoLargada: this.motoLargada }, ...[...this.remotos.values()].map((a) => ({ id: a.id, moto: a.moto, motoLargada: a.motoLargada }))]);
  }
  /** a vaga `i` tem moto pronta (o robô não está fabricando nela)? */
  private vagaPronta(i: number) { const v = vagas()[i]; return !!v && progressoDaVaga(this.fabricas[v.lote]!.f, i) >= 1; }
  /** o que dá pra montar perto (vaga pronta ou estacionada), no mesmo nível dos meus pés — a pé */
  private motoAoAlcance(): AlvoMoto | null { return this.podeMontar() ? motoParaMontar(this.eu.pos, this.eu.alt, (i) => this.vagaPronta(i), (v) => this.yDaVaga(v), this.largadasAgora()) : null; }
  /** a pé, no chão do mapa ou no piso da Zaeon (os dois estacionamentos) */
  private podeMontar() { return !this.menu && !this.pilotando && this.moto === null && !this.jet.noAr && (!this.altoEm || this.noCeu) && !this.noTopo && !this.sobreNave && this.ilhota === null && this.plat === null && this.bordo === null && this.vagaMotos.length > 0; }
  /** ninguém (eu, os outros, motos estacionadas) em cima da vaga `s` — o robô espera liberar pra fabricar */
  private vagaLivre(s: number) {
    const v = vagas()[s]; if (!v) return false;
    const y = this.yDaVaga(v), perto = (p: { x: number; z: number }, alt: number) => Math.hypot(p.x - v.x, p.z - v.z) < 2.6 && Math.abs(alt - y) < 4;
    if (perto(this.moto !== null ? this.motoEst : this.eu.pos, this.moto !== null ? this.motoEst.y : this.eu.alt)) return false;
    for (const a of this.remotos.values()) if (perto(a.pos, a.alt)) return false;
    return !this.largadasAgora().some(({ m }) => perto(m, m.y));
  }
  /** a VAGA `s` esvaziou (alguém levou a moto): o robô do lote dela vem fabricar outra */
  private tomarVaga(s: number) { const v = vagas()[s]; if (v && this.vagaPronta(s)) esvaziou(this.fabricas[v.lote]!.f, s); }
  /** MONTA: numa VAGA (leva a moto — o robô repõe) ou numa ESTACIONADA (a minha ou a de outra pessoa: `de` avisa o dono) */
  montar(alvo: AlvoMoto | null = this.motoAoAlcance()): boolean {
    if (!alvo || !this.podeMontar()) return false;
    let p: { x: number; y: number; z: number; yaw: number } | null = null;
    let lancar = false;
    if (alvo.tipo === "vaga") { const v = vagas()[alvo.s]; if (v && this.vagaPronta(alvo.s)) { p = { x: v.x, y: this.yDaVaga(v), z: v.z, yaw: v.yaw }; lancar = true; } }
    else p = this.largadasAgora().find((l) => l.dono === alvo.dono)?.m ?? null;
    if (!p || Math.abs(p.y - this.eu.alt) > 2.5 || Math.hypot(this.eu.pos.x - p.x, this.eu.pos.z - p.z) > MOTO.alcance) return false;
    if (alvo.tipo === "vaga") { this.tomarVaga(alvo.s); this.motoDe = undefined; }
    else { this.motoDe = alvo.dono; if (alvo.dono === this.o.eu.id) { this.motoLargada = null; this.renomearInst("eu:p", "eu:r"); } }   // a minha estacionada: a mesma moto (sem trocar)
    // da VAGA: a moto já sai da plataforma PAIRANDO na altura de lançamento (acima do "rente ao chão": anda na hora)
    const y0 = lancar ? p.y - PLATAFORMA_MOTO.altura + ALTURA_LANCAMENTO : p.y;
    this.motoAlvo = null; this.moto = alvo.s; this.motoEst = motoParada(p.x, y0, p.z, p.yaw); this.camAz = p.yaw + Math.PI; this.camSegueEm = 0;
    this.altoEm = null; this.yNav = 0;   // montado, o nível é o da moto
    this.motoPousado = !lancar; this.autoPouso = false;
    this.sitT = 0; this.alvo = null; this.alvoDepois = null; this.falandoCom = null; this.jetV = { x: 0, z: 0 };
    return true;
  }
  /** a altura de um lote (o da Zaeon flutua com a ilha) */
  private yDoLote(l: Lote) { return l.ceu ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) : 0; }
  /** a altura da moto PARADA numa vaga: em cima da plataforma de lançamento (no chão, ou no piso da Zaeon, que flutua) */
  private yDaVaga(v: { ceu: boolean }) { return (v.ceu ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) : 0) + PLATAFORMA_MOTO.altura; }
  /** DESCE da moto (pousada): fica ao lado dela e a moto FICA ALI estacionada (é um veículo — é minha até eu estacionar
   *  outra ou sair); os outros veem pela minha presença. No piso da Zaeon → anda na ilha; noutro alto → cai dali */
  /** dá pra descer da moto aqui? Pousada num piso de verdade — na altura da praça, só EM CIMA dela (fora é o vazio) */
  private desceDaMotoAqui() { const m = this.motoEst; return this.moto !== null && this.motoPousado && (m.y > 0.5 || naPraca(m)); }
  desmontar() {
    if (this.moto === null || !this.desceDaMotoAqui()) return;
    const m = this.motoEst, lx = Math.cos(m.yaw), lz = -Math.sin(m.yaw);   // a esquerda de quem pilota
    this.motoLargada = { s: this.moto, x: m.x, y: m.y, z: m.z, yaw: m.yaw };
    this.soltarInst("eu:p"); this.renomearInst("eu:r", "eu:p");   // a MESMA moto fica ali (a estacionada antiga some)
    this.moto = null; this.motoDe = undefined; this.autoPouso = false; this.voY.subir = false; this.voY.descer = false;
    this.eu.pos.set(m.x + lx * 1.6, 0, m.z + lz * 1.6); this.eu.facing = m.yaw;
    // pousada em qualquer piso da Zaeon (plataforma central, escada, lounge, palco, cabine do DJ) → anda ali
    if (naIlhaPrincipal(this.eu.pos) && Math.abs(m.y - (CIDADE.pisoY + alturaNaCidade(this.eu.pos))) < 1.5) { this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; this.portalArmado = false; }
    else if (m.y > 0.5) { this.eu.alt = m.y; this.cairDaqui(); }
  }
  /** o dono manda onde a nave dele está estacionada (presença `naveParada`) — sem hangar, sempre que não está pilotando */
  private naveForaDoHangar() { return !!this.nave && this.ehFundador(this.o.eu.id); }   // sem hangar: a nave do dono está sempre "parada em algum lugar"
  /** (pra quem NÃO é o dono) o dono está online com a nave → a minha cópia some (só existe uma nave) */
  private naveDoDonoFora() { if (this.ehFundador(this.o.eu.id)) return false; for (const a of this.remotos.values()) if (a.nave) return true; return false; }
  // ───────────── áudio ─────────────
  /** loops fixos do mundo + destrave. O gesto (o "Iniciar" da landing, ou o 1º clique/toque/tecla) só DESTRAVA: o som do
   *  cyberespaço só liga ao ENTRAR de fato na cena 3D (fora do menu) — na landing/menu, nada do cyberespaço toca. */
  private montarSom() {
    const s = this.som;
    this.somLoops.leito = s.loop("space-bed", null);
    const bn = new THREE.Object3D(); bn.position.set(BURACO_NEGRO.x, BURACO_NEGRO.y, BURACO_NEGRO.z); this.cena.scene.add(bn);
    s.volumeLoop(s.loop("blackhole-hum", bn, { dist: DISTANCIA.grande }), 1);
    this.somLoops.jet = this.loopsDoJato(this.eu.av.group, DISTANCIA.eu);   // contínuo enquanto se segura o ESPAÇO
    if (this.nave) { this.somLoops.naveIdle = s.loop("ship-idle", this.nave.group, { dist: DISTANCIA.grande }); this.somLoops.naveVoo = s.loop("ship-flight", this.nave.group, { dist: DISTANCIA.naveLocal }); }
    const destravar = () => { musica().destravar(); if (!this.menu) s.ativar(); };
    if (musica().destravado && !this.menu) s.ativar();
    // na fase de CAPTURA: o canvas/HUD param a propagação dos cliques, mas o gesto tem que destravar o áudio mesmo assim
    for (const ev of ["pointerdown", "keydown", "touchstart"] as const) { window.addEventListener(ev, destravar, { once: true, passive: true, capture: true }); this.cleanups.push(() => window.removeEventListener(ev, destravar, { capture: true })); }
  }
  /** um passo sutil (alterna os 3 arquivos; volume e afinação variam um pouco — nada de passo "carimbado") */
  private tocarPasso(a: Ator, dist: Dist = DISTANCIA.eu) {
    this.passoI = (this.passoI + 1 + Math.floor(Math.random() * 2)) % PASSOS.length;
    this.som.tocar(PASSOS[this.passoI]!, a.av.group.position, { dist, volume: 0.8 + Math.random() * 0.3, taxa: 0.93 + Math.random() * 0.12 });
  }
  /** pousou (mochila): o pouso + o BAQUE do corpo no chão, mais forte (e mais grave) quanto mais rápido caía */
  private somPouso(vy: number) {
    this.jetV = { x: 0, z: 0 }; this.impulsoFrente = false;   // pousou: acabou o embalo
    const f = impactoDoPouso(vy), em = this.eu.av.group.position;
    this.som.tocar("land", em, { dist: DISTANCIA.eu, volume: 0.6 + 0.4 * f });
    this.som.tocar("baque", em, { dist: DISTANCIA.eu, volume: 0.3 + 0.7 * f, taxa: 1.12 - 0.3 * f });
  }
  private soltarSomJet(a: Ator) { if (a.somJet) { for (const l of a.somJet) this.som.soltarLoop(l); a.somJet = null; } }
  /** o jato da mochila em 2 camadas (ronco gravado + sopro sintetizado) presas a um objeto */
  private loopsDoJato(obj: THREE.Object3D, dist: Dist): LoopSom[] { return [this.som.loop("jetpack", obj, { dist }), this.som.loop("jato-sopro", obj, { dist })]; }
  /** volume/afinação do jato pelo empuxo; o sopro sobe mais que o ronco quando se segura (ataque rápido, solta suave) */
  private ajustarJato(ls: LoopSom[], noAr: boolean, segurando: boolean, vy: number) {
    const sj = somDoJato(noAr, segurando, vy), vel = sj.volume > 0.5 ? 14 : 4;
    ls.forEach((l, i) => { this.som.volumeLoop(l, i === 0 ? sj.volume : sj.volume * (segurando ? 1 : 0.5), vel); this.som.taxaLoop(l, i === 0 ? sj.taxa : sj.taxa * 1.05); });
  }
  private soltarSomNave(a: Ator) { if (!a.somNave) return; this.som.soltarLoop(a.somNave.idle); this.som.soltarLoop(a.somNave.voo); a.somNave = null; }
  /** por quadro: leito (cross-fade com a música da intro), nave (idle/voo/decolagem/pouso), cristais, neurônios, colegas */
  private atualizarSom(dt: number) {
    const s = this.som; this.tVivo += dt;
    // a entrada no cyberespaço (tela cheia, sem menu): o whoosh toca assim que o som estiver pronto
    if (!this.somEntrada && !this.menu && s.temSom("cyber-enter")) { this.somEntrada = true; s.tocar("cyber-enter"); }
    // o leito do espaço abaixa quando a música do toca-discos está tocando e eu estou no lounge (não briga com ela)
    const td = this.somLounge?.tocando && this.noCeu && this.cidade?.tocaDiscos ? this.cidade.tocaDiscos.getWorldPosition(this.tmp) : null;
    const naMusica = !!td && Math.hypot(this.eu.pos.x - td.x, this.eu.pos.z - td.z) < 22;
    if (this.somLoops.leito) s.volumeLoop(this.somLoops.leito, fatorLeito(musica().estado) * (naMusica ? 0.25 : 1));
    // cristais: só com o MEU avatar perto da base (no mesmo piso) — o ouvinte é a câmera, que fica longe do avatar
    for (const [id, l] of this.somCristais) {
      const b = this.layouts.get(id), mesmoPiso = b && (b.nivel ?? "chao") === this.nivelDe(this.o.eu.id);
      s.volumeLoop(l, mesmoPiso ? fatorCristais(Math.hypot(this.eu.pos.x - b.x, this.eu.pos.z - b.z)) : 0);
    }
    // a MINHA mochila: jato contínuo (ataque rápido ao apertar, solta suave), mais agudo subindo
    if (this.somLoops.jet) this.ajustarJato(this.somLoops.jet, this.jet.noAr, this.jet.tecla || this.impulsoFrente, this.jet.tecla ? this.jet.vy : 3);
    // a MINHA nave: idle parada, voo em movimento; decolagem/pouso nas transições; pilotando quase não paneia
    if (this.nave && this.somLoops.naveIdle && this.somLoops.naveVoo) {
      const voando = this.pilotando && !this.pousado, vel = Math.hypot(this.naveEst.vx, this.naveEst.vz) / VOO.vel;
      s.volumeLoop(this.somLoops.naveVoo, voando ? 0.35 + 0.65 * Math.min(1, vel) : 0);
      s.volumeLoop(this.somLoops.naveIdle, voando || !this.nave.group.visible ? 0 : 1);
      s.distanciaLoop(this.somLoops.naveIdle, this.pilotando ? DISTANCIA.naveLocal : DISTANCIA.grande);
      // SUBIR/DESCER: o som sai UMA vez, no começo da ação (apertou), preso à nave; depois fica só o som de voo
      const g = gatilhosVoo(this.gatilhoNave, { subindo: this.pilotando && this.cmdVoo.subir && this.naveEst.y < VOO.yMax - 0.3, descendo: this.pilotando && !this.pousado && this.cmdVoo.descer }, dt);
      this.gatilhoNave = g.e;
      if (g.sobe) s.tocar("ship-takeoff", null, { dist: DISTANCIA.naveLocal, seguir: this.nave.group });
      if (g.desce) s.tocar("ship-landing", null, { dist: DISTANCIA.naveLocal, seguir: this.nave.group });
      // tocar o chão = impacto (1×)
      const n = this.naveEst, ev = eventosNave(this.somNave, { pousado: this.pousado, vy: n.vy, altura: n.y - chaoDoVoo(n, this.pilotando ? this.solidosDeVoo() : []) }, dt);
      this.somNave = ev.e;
      if (this.pilotando) {
        const em = this.nave.group.position, d = { dist: DISTANCIA.naveLocal };
        if (ev.pousou) s.tocar("ship-touchdown", em, d);
      }
    }
    // neurônios subindo da minha base: um brilho de vez em quando (se estou por perto)
    this.neuronioT -= dt;
    if (this.neuronioT <= 0) {
      this.neuronioT = intervaloNeuronio(Math.random());
      const l = this.minhaBase; if (l && this.distBase(this.o.eu.id, this.eu.pos) < 25) this.som.tocar("neuron-chime", new THREE.Vector3(l.x, this.yDoNivel(l.nivel) + 2.5, l.z), { dist: DISTANCIA.perto });
    }
    // colegas: passos (perto), e um ping quando fico perto de alguém (dá pra conversar)
    for (const a of this.remotos.values()) {
      const d = a.pos.distanceTo(this.eu.pos);
      const pisadas = a.av.passosNovos();
      if (a.moving && a.jet === undefined && !a.nave && !a.moto && d < 15) {
        if (pisadas !== null) for (let k = 0; k < pisadas; k++) this.tocarPasso(a, DISTANCIA.perto);
        else { a.passoT = (a.passoT ?? 0) + dt; if (a.passoT >= cadenciaPasso(false)) { a.passoT = 0; this.tocarPasso(a, DISTANCIA.perto); } }
      }
      // mochila do colega: jato posicional (vem do lado certo); ao pousar, o baque dele
      if (a.jet !== undefined) {
        if (!a.somJet) a.somJet = this.loopsDoJato(a.av.group, DISTANCIA.padrao);
        const vy = a.vyJet ?? 0; this.ajustarJato(a.somJet, true, vy > -3, vy); a.vyUlt = vy;
      } else if (a.somJet) {
        const f = impactoDoPouso(a.vyUlt ?? 0); s.tocar("baque", a.av.group.position, { dist: DISTANCIA.perto, volume: 0.3 + 0.7 * f, taxa: 1.12 - 0.3 * f });
        this.soltarSomJet(a);
      }
      const pertoAgora = d < 3;
      if (pertoAgora && !a.perto) s.tocar("near-ping", a.av.group.position, { dist: DISTANCIA.perto });
      a.perto = pertoAgora;
    }
    s.atualizar(dt);
  }
  private vozPendente = new Map<string, MediaStream>();
  /** a VOZ de alguém (WebRTC) chegou → sai pelo avatar dele (posicional); null = acabou. Se o avatar ainda não
   *  existe (a voz chegou antes da 1ª pose), espera ele aparecer. */
  vozDe(userId: string, stream: MediaStream | null) {
    const a = this.remotos.get(userId);
    if (!a) { if (stream) this.vozPendente.set(userId, stream); else this.vozPendente.delete(userId); return; }
    a.vozH?.remover(); a.vozH = null;
    if (stream) a.vozH = this.som.voz(a.av.group, stream);   // sem gesto ainda: a voz espera na fila do AudioCyber
  }
  /** o recado ATUAL do dono pro QG: holograma ao lado da tela do Andrei + a TV do lounge; recado NOVO (depois de
   *  carregar) acende o holograma e toca um ping lá */
  setRecado(r: RecadoQG | null) {
    const novo = this.recadoId !== undefined && !!r && r.id !== this.recadoId;
    this.recadoId = r?.id ?? null;
    this.holo?.mostrar(r, novo);
    this.cidade?.mostrarRecadoNaTV(r?.texto ?? null);
    if (novo && this.holo) this.som.tocar("neuron-chime", this.holo.group.position.clone().setY(this.holo.group.position.y + 2.2), { dist: DISTANCIA.padrao });
  }
  /** a playlist/estado do toca-discos do lounge (da sala) + a diferença de relógio servidor − cliente (ms) */
  setSomLounge(som: SomLounge | null, offsetMs = 0) { this.somLounge?.aplicar(som, offsetMs); }
  /** releitura das preferências de som (o React chama ao mudar liga/desliga ou volume) */
  aplicarPrefsSom() { this.som.aplicarPrefs(); }

  /** uma INSTÂNCIA animada (a moto de um piloto) do look da vaga `s`: do pool, ou nova */
  private pegarInst(s: number): InstMoto {
    const look = String(s), livre = this.poolMotos.get(look)?.pop();   // o look é da vaga (cor + carenagem)
    if (livre) { livre.s = s; livre.casca.visible = true; livre.som = somMotoParada; livre.yAnt = null; return livre; }
    const h = criarMoto({ ...lookDaVaga(s), low: this.o.low });
    fundirEstaticos(h.group, { passo: (k, t) => h.atualizar({ dt: 1 / 30, t, voando: k % 2 === 0, vel: (k % 4) / 3, curva: Math.sin(t), vy: Math.cos(t) * 5, boost: k % 3 === 0 ? 1 : 0, seta: (k % 3) - 1 }), manter: comDescendentes(h.alvos) });
    const casca = new THREE.Group(); casca.add(h.group); this.cena.scene.add(casca);
    return { h, g: h.group, casca, look, s, loops: null, som: somMotoParada, yawAnt: 0, yAnt: null, vy: 0 };
  }
  /** devolve a instância da chave pro pool (som desligado, escondida) */
  private soltarInst(chave: string) {
    const m = this.instMotos.get(chave); if (!m) return;
    this.instMotos.delete(chave);
    if (m.loops) { for (const l of Object.values(m.loops)) this.som.soltarLoop(l); m.loops = null; }
    if (m.som.montada) this.som.tocar("moto-desliga", m.g.position, { dist: DISTANCIA.padrao });
    m.casca.visible = false; const p = this.poolMotos.get(m.look) ?? []; p.push(m); this.poolMotos.set(m.look, p);
  }
  private renomearInst(de: string, para: string) { const m = this.instMotos.get(de); if (!m) return; this.instMotos.delete(de); this.instMotos.set(para, m); }

  /** as MOTOS a cada quadro: quem pegou moto de uma vaga (ela esvazia), os ROBÔS fabricando, as motos das vagas (se
   *  formando), e as INSTÂNCIAS (a minha e as dos outros: montadas e estacionadas). Devolve quem monta qual. */
  private atualizarMotos(dt: number, t: number): Map<Ator, MotoHandle> {
    const euId = this.o.eu.id;
    // 1) alguém (remoto) montou de uma VAGA → ela esvaziou (montar numa estacionada traz `de`)
    for (const a of this.remotos.values()) {
      const k = a.moto ? `${a.moto.s}|${a.moto.de ?? ""}` : "", antes = this.motoVista.get(a.id) ?? "";
      if (k && k !== antes && !a.moto!.de) this.tomarVaga(a.moto!.s);
      this.motoVista.set(a.id, k);
    }
    for (const id of this.motoVista.keys()) if (!this.remotos.has(id)) this.motoVista.delete(id);
    // alguém pegou a moto que eu tinha estacionado: ela é dele agora
    if (this.motoLargada && [...this.remotos.values()].some((a) => a.moto?.de === euId)) { this.motoLargada = null; this.soltarInst("eu:p"); }
    // 2) os ROBÔS: voam até a próxima vaga vazia, fabricam, voltam pra base
    const vs = vagas();
    for (const fb of this.fabricas) {
      const tr = fb.f.tarefa, base = baseDoRobo(fb.lote), yl = this.yDoLote(fb.lote);
      const alvo = tr ? { x: vs[tr.s]!.x, y: this.yDaVaga(vs[tr.s]!) + FABRICA.altura, z: vs[tr.s]!.z } : { x: base.x, y: yl + 1.6, z: base.z };
      const ant = fb.pos; fb.pos = moverRobo(fb.pos, alvo, dt);
      const dx = fb.pos.x - ant.x, dz = fb.pos.z - ant.z; if (Math.hypot(dx, dz) > 0.02) fb.rumo = Math.atan2(dx, dz);
      const chegou = Math.hypot(fb.pos.x - alvo.x, fb.pos.y - alvo.y, fb.pos.z - alvo.z) < 0.25;
      // o robô só sai depois que quem levou a moto FOI EMBORA (a vaga livre por FABRICA.espera s) e só fabrica com ela livre
      const pronta = passoFabrica(fb.f, dt, !!tr && chegou, (s) => this.vagaLivre(s));
      fb.robo.group.position.set(fb.pos.x, fb.pos.y, fb.pos.z);
      // a luz da fabricação fica na vaga em que ele trabalha; pronta → clarão (a luz acaba ali mesmo)
      if (fb.f.tarefa?.fase === "fabrica") fb.efeitoEm = fb.f.tarefa.s;
      if (pronta !== null) fb.robo.clarao();
      if (fb.efeitoEm !== null) { const v = vs[fb.efeitoEm]!; fb.robo.efeito.position.set(v.x, this.yDaVaga(v), v.z); }
      const fab = fb.f.tarefa?.fase === "fabrica" ? progressoDaVaga(fb.f, fb.f.tarefa.s) : null;
      if (this.regiaoPerto(fb.robo.group, "robo-motos")) fb.robo.atualizar({ dt, t, progresso: fab, rumo: fab !== null ? vs[fb.f.tarefa!.s]!.yaw : fb.rumo });
    }
    // 3) as motos das VAGAS: na vaga (a Zaeon flutua); vazia some; sendo fabricada vai SE FORMANDO de baixo pra cima
    this.vagaMotos.forEach((m, i) => {
      const v = vs[i]!, k = progressoDaVaga(this.fabricas[v.lote]!.f, i);
      m.moto.visible = k > 0.001; m.g.position.set(v.x, this.yDaVaga(v), v.z);
      const e = k >= 1 ? 1 : 0.02 + 0.98 * (1 - Math.pow(1 - k, 3)); m.moto.scale.set(1, e, 1);
    });
    // 4) as INSTÂNCIAS que devem existir agora (montadas e estacionadas)
    type Quer = { s: number; quem: Ator | null; pose?: { x: number; y: number; z: number; yaw: number } };
    const quer = new Map<string, Quer>();
    if (this.moto !== null) quer.set("eu:r", { s: this.moto, quem: this.eu });
    for (const a of this.remotos.values()) if (a.moto) quer.set(`${a.id}:r`, { s: a.moto.s, quem: a });
    for (const { dono, m } of this.largadasAgora()) quer.set(`${dono === euId ? "eu" : dono}:p`, { s: m.s, quem: null, pose: m });
    // a mesma moto troca de papel (montada ↔ estacionada) sem sumir: reaproveita a do outro papel, mesma vaga de origem
    for (const [k, q] of quer) {
      if (this.instMotos.has(k) && this.instMotos.get(k)!.s === q.s) continue;
      const irma = k.endsWith(":r") ? k.slice(0, -2) + ":p" : k.slice(0, -2) + ":r", im = this.instMotos.get(irma);
      if (im && im.s === q.s && !quer.has(irma)) { this.soltarInst(k); this.renomearInst(irma, k); }
      else if (this.instMotos.has(k)) this.soltarInst(k);
    }
    for (const k of [...this.instMotos.keys()]) if (!quer.has(k)) this.soltarInst(k);
    const montadas = new Map<Ator, MotoHandle>();
    for (const [k, q] of quer) {
      let m = this.instMotos.get(k); if (!m) { m = this.pegarInst(q.s); this.instMotos.set(k, m); }
      const quem = q.quem, g = m.g;
      let voando = false, vel = 0, inclina: number | undefined, boost = 0, guidao = 0;
      if (quem === this.eu) { const e = this.motoEst; g.position.set(e.x, e.y, e.z); g.rotation.y = e.yaw; voando = !this.motoPousado; vel = Math.hypot(e.vx, e.vz) / VOO.vel; inclina = e.inclina; boost = e.boost ? 1 : 0; guidao = e.guidao; }
      else if (quem?.moto) { g.position.set(quem.pos.x, quem.alt, quem.pos.z); g.rotation.y = quem.moto.yaw; voando = quem.moving || quem.alt > chaoDoVoo({ x: quem.pos.x, y: quem.alt, z: quem.pos.z }, this.solidosCidade) + 0.5; vel = quem.moving ? 1 : 0; }   // (pousada na Zaeon, a 450 m, não é "voando")
      else if (q.pose) { g.position.set(q.pose.x, q.pose.y, q.pose.z); g.rotation.y = q.pose.yaw; }
      if (quem) montadas.set(quem, m.h);
      let d = g.rotation.y - m.yawAnt; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m.yawAnt = g.rotation.y;
      const y = g.position.y; m.vy = m.yAnt === null || dt <= 0 ? 0 : m.vy + ((y - m.yAnt) / dt - m.vy) * Math.min(1, dt * 4); m.yAnt = y;
      const curva = d / Math.max(dt, 1e-3);
      if (quem && quem !== this.eu) guidao = Math.max(-1, Math.min(1, -curva * 2.5));   // dos outros: o guidão sai do giro (direita = rumo diminui)
      const seta = quem && voando ? setaAcesa(guidao, t) : 0;
      m.h.atualizar({ dt, t, voando, vel, curva, vy: m.vy, inclina, boost, seta });
      // SOM por estágio (lib/cyber/somMoto): loops do motor (que faz a lenta)/vento/turbina + one-shots (partida, decola, boost,
      // freio, pouso, desliga — o pisca é só luz). A minha moto quase não paneia
      const minha = quem === this.eu, dist = minha ? DISTANCIA.naveLocal : DISTANCIA.padrao;
      const est: EstadoSomMoto = quem ? { montada: true, voando, vel: minha ? Math.hypot(this.motoEst.vx, this.motoEst.vz) / PILOTAGEM.vel : quem.moving ? 0.8 : 0, acel: minha ? this.acelMoto : 0, boost: boost > 0, seta } : somMotoParada;
      for (const ev of eventosDaMoto(m.som, est)) this.som.tocar(ev, g.position, { dist, seguir: g });
      m.som = est;
      if (quem && !m.loops) m.loops = Object.fromEntries(LOOPS_MOTO.map((n) => [n, this.som.loop(n, g, { dist })])) as Record<(typeof LOOPS_MOTO)[number], LoopSom>;
      if (!quem && m.loops) { for (const l of Object.values(m.loops)) this.som.soltarLoop(l); m.loops = null; }
      if (m.loops) { const mix = mixDaMoto(est); for (const n of LOOPS_MOTO) { this.som.volumeLoop(m.loops[n], mix[n].vol, n === "moto-turbina" ? 6 : undefined); this.som.taxaLoop(m.loops[n], mix[n].taxa); } }
    }
    return montadas;
  }
  /** encaixa um avatar na moto: quadril no banco, mãos nos punhos, pés nas pedaleiras (IK do AvatarLuz) */
  private naMoto(av: AvatarLuzHandle, h: MotoHandle | undefined): Montado | null {
    if (!h) return null;
    h.group.updateWorldMatrix(true, true);
    h.assento.getWorldPosition(av.group.position); av.olharPara(h.group.rotation.y);
    const v = this.montadoTmp, p = h.pontos;
    p.maoE.getWorldPosition(v.maoE); p.maoD.getWorldPosition(v.maoD); p.peE.getWorldPosition(v.peE); p.peD.getWorldPosition(v.peD);
    return { w: 1, ...v };
  }
  /** as motos PARADAS na vaga são sólidas pra quem anda (círculo do tamanho do corpo) */
  private colisoresDeMotos(): Colisor[] {
    const out: Colisor[] = [], vs = vagas();
    vs.forEach((v, i) => { if (Math.abs(this.yDaVaga(v) - this.eu.alt) < 2.5) out.push({ x: v.x, z: v.z, r: PLATAFORMA_MOTO.r }); });   // a plataforma (com ou sem moto)
    for (const { m } of this.largadasAgora()) if (Math.abs(m.y - this.eu.alt) < 2.5) out.push({ x: m.x, z: m.z, r: 1.1 });   // as paradas no MEU nível
    return out;
  }
  /** altura do dorso da nave (onde se fica em pé) e o raio andável lá em cima */
  private topoNave(): number { return this.naveEst.y + 2.2 * ESCALA_NAVE_V; }
  private static readonly TOPO_NAVE_R = 2.2 * ESCALA_NAVE;
  /** o quanto a câmera se afasta (roda do mouse / pinça) — a nave-QG tem 68 m */
  private static readonly CAM_MAX = 70;
  /** colisores das naves PARADAS (o disco inteiro) pra quem anda/voa baixo no mesmo nível — não se atravessa a nave */
  private colisoresDeNaves(alt: number): Colisor[] {
    const R = 3.75 * ESCALA_NAVE, out: Colisor[] = [];
    if (this.saindoPelaRedoma) return [];   // saindo pela redoma: o próprio casco não empurra
    { const p = this.poseNave(); if (p && this.redomaChamando() && Math.hypot(this.eu.pos.x - p.x, this.eu.pos.z - p.z) < RAIO_REDOMA) return []; }   // entrando pelo vão da redoma
    const noCorpo = (y: number) => alt > y - 1 && alt < y + 2.2 * ESCALA_NAVE_V;   // o casco vai do chão até o dorso
    // o CORREDOR DA RAMPA (atrás da nave) fica aberto: o fim da rampa fica DENTRO do raio do casco — com o círculo
    // inteiro, ninguém chegava andando nela (pousada no chão, a nave ficava sem entrada)
    const naRampaDe = (p: PoseNave) => noCorredorDaRampa(p, this.eu.pos);
    if (this.nave && !this.pilotando && this.nave.group.visible && noCorpo(this.naveEst.y) && !naRampaDe(this.naveEst)) out.push({ x: this.naveEst.x, z: this.naveEst.z, r: R });
    for (const a of this.remotos.values()) if (a.nave && a.naveP && noCorpo(a.naveP.y) && !naRampaDe(a.naveP)) out.push({ x: a.naveP.x, z: a.naveP.z, r: R });
    return out;
  }
  /** põe um avatar SENTADO no assento do piloto, na cabine da nave */
  private noAssento(av: AvatarLuzHandle, nave: NaveHandle) {
    nave.group.updateWorldMatrix(true, true); nave.assento.getWorldPosition(this.tmp);
    av.group.position.copy(this.tmp);
  }
  /** lá fora, perto da porta de trás da nave-QG (dá pra entrar) */
  /** voltando pra nave de mochila (no ar ou em pé no dorso, perto da redoma e acima do convés): a redoma ABRE pra mim */
  private redomaChamando(): boolean {
    if (this.pilotando || this.bordo || !(this.jet.noAr || this.sobreNave)) return false;
    const p = this.poseNave(); return !!p && Math.hypot(this.eu.pos.x - p.x, this.eu.pos.z - p.z) < RAIO_REDOMA + 14 && this.eu.alt > alturaDoConves(p) + 2;
  }
  private navePerto() { const p = this.poseNave(); return !!p && !this.bordo && !this.pilotando && pertoDaEntrada(p, this.eu.pos, this.eu.alt); }
  /** sólidos de voo da Zaeon: corpo (até o alto das muralhas) e cúpula (topo do dono), acompanhando a flutuação */
  private pilaresZaeon(z: LandmarkHandle): Pilar[] {
    const mn = marcoNav(z.poi), b = z.poi.base;
    const ps = mn ? pilaresDoMarco({ x: mn.x, z: mn.z, chaoR: mn.nav.chaoR, altura: (b ?? 0) + z.poi.altura + this.boia(z), escala: z.poi.escala ?? 1, cupula: !!z.topo }) : [];
    return b === undefined ? ps : ps.map((p) => ({ ...p, base: b - 1 }));   // apoiado no piso da Zaeon: sólido só dali pra cima
  }
  /** sólidos pra nave: os marcos andáveis como cilindros (quem vem de cima pousa no topo) */
  private solidosDeVoo(): Pilar[] { return [...this.solidosCidade, ...this.marcosNav().flatMap(({ lm }) => this.pilaresZaeon(lm)), ...(this.univ ? pilaresDasPlataformas() : []), ...this.pilaresDasIlhotas(), ...this.pilaresDaNaveQG()]; }
  /** a nave-QG parada é sólida pra quem voa (moto, a nave dos outros): pousa-se no dorso dela */
  private pilaresDaNaveQG(): Pilar[] { if (this.pilotando) return []; const p = this.poseNave(); return p ? [{ x: p.x, z: p.z, r: NAVE_QG.raio, topo: p.y + 2.2 * ESCALA_NAVE_V, base: p.y + 0.5 }] : []; }

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
  private boia(lm: LandmarkHandle | undefined) { return lm ? lm.group.position.y - (lm.poi.base ?? 0) - lm.poi.altura : 0; }
  private marcosNav(): { lm: LandmarkHandle; mn: MarcoNav }[] { return this.lms.flatMap((lm) => { const mn = marcoNav(lm.poi); return mn ? [{ lm, mn }] : []; }); }
  /** altura do chão em (x,z) na PRAÇA considerando os marcos andáveis dela (sem estado — remotos; quem está noutro
   *  lugar manda a altura na presença) */
  private alturaChao(p: { x: number; z: number }) {
    let y = 0;
    for (const { lm, mn } of this.marcosNav()) { if (!naPracaPOI(lm.poi)) continue; const h = alturaEm(mn, p); if (h > y) y = h + (h >= mn.nav.pisoY - 1e-6 ? this.boia(lm) : 0); }
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

  /** Passo na PRAÇA ou num marco andável (escada/plataforma — lib/cyber/nav) + os colisores (bases, outros marcos).
   *  A praça é uma ILHA: passou da borda, cai no vazio. Do pé da escada da Recepção volta-se pro piso da Zaeon. */
  private resolverChao(eu: Ator, prev: { x: number; z: number }, dt: number) {
    const navs = this.marcosNav();
    if (this.altoEm) {
      const cur = navs.find((n) => n.lm.poi.id === this.altoEm);
      if (cur) {
        const r = resolverPasso(cur.mn, true, prev, eu.pos);
        const q = r.alto ? empurrarParaFora(r, this.colisoresDoNivel("qg")) : r;   // a mesa da anfitriã no centro do salão
        eu.pos.x = q.x; eu.pos.z = q.z; this.yNav = r.y;
        if (!r.alto) { const naZaeon = cur.lm.poi.base !== undefined; this.altoEm = naZaeon ? "ceu" : null; this.yNav = naZaeon ? CIDADE.pisoY : 0; }
        return;
      }
      this.altoEm = null;
    }
    let q = { x: eu.pos.x, z: eu.pos.z };
    for (const { lm, mn } of navs) {
      if (!naPracaPOI(lm.poi)) continue;
      const r = resolverPasso(mn, false, prev, q);
      if (r.alto) { this.altoEm = lm.poi.id; this.yNav = r.y; eu.pos.x = r.x; eu.pos.z = r.z; return; }
      q = r;
    }
    q = empurrarParaFora(q, [...this.colisores, ...this.colisoresDeNaves(0), ...this.colisoresDeMotos()]);
    eu.pos.x = q.x; eu.pos.z = q.z; this.yNav = 0;
    if (!this.jet.noAr && !naPraca(q)) this.cairDaqui({ x: (q.x - prev.x) / Math.max(dt, 1e-3), z: (q.z - prev.z) / Math.max(dt, 1e-3) });   // a borda da praça: o vazio (no ar a queda já é do passoNoAr)
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
      if (k === " " || k === "spacebar") { if (this.pilotando || this.moto !== null) { this.voY.subir = true; e.preventDefault(); return; } if (!this.menu) { this.comandoJet(true); e.preventDefault(); } return; }
      if (k === "f" && !this.menu) { if (!e.repeat) this.executarAcao(); e.preventDefault(); return; }   // F = a ação de contexto (estudar, montar, embarcar, descer…)
      if (k === "p" && (this.pilotando || this.moto !== null)) { this.pousar(); e.preventDefault(); return; }   // P = pousar (no desktop não há o botão)
      if ((k === "e" || k === "q") && (this.pilotando || this.moto !== null)) { this.voY[k === "e" ? "subir" : "descer"] = true; this.autoPouso = false; e.preventDefault(); return; }
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { this.keys[k] = true; e.preventDefault(); }
    });
    on("keyup", (e) => { const k = e.key.toLowerCase(); if (k === "shift") { this.keys.shift = false; return; } if (k === " " || k === "spacebar") { this.espaco = false; this.voY.subir = false; this.comandoJet(false); return; } if (k === "e") this.voY.subir = false; if (k === "q") this.voY.descer = false; this.keys[k] = false; });
    // olhar livre: trava/solta o ponteiro
    const aoTravar = () => {
      this.olharLivre = document.pointerLockElement === cv; this.drag = null; this.ptrs.clear();
      if (this.olharLivre && this.dicaMira) { this.dicaMira.remove(); this.dicaMira = null; }   // a dica só até a 1ª vez
      if (this.olharLivre) { this.hoverBase = null; cv.style.cursor = ""; }
    };
    document.addEventListener("pointerlockchange", aoTravar); this.cleanups.push(() => document.removeEventListener("pointerlockchange", aoTravar));
    if (this.podeOlharLivre(true)) {
      const dica = document.createElement("div"); dica.style.cssText = DICA_MIRA_CSS; dica.textContent = "Clique na cena: o mouse passa a mover a câmera · Esc solta"; this.o.overlay.appendChild(dica); this.dicaMira = dica;
      this.cleanups.push(() => { dica.remove(); if (document.pointerLockElement === cv) document.exitPointerLock(); });
    }
    onC("pointerdown", (e) => {
      if (this.olharLivre) return;   // mouse travado: clicar não faz nada (as ações são no F)
      if (e.pointerType === "mouse" && e.button === 0 && this.podeOlharLivre()) {   // 1º clique: trava o mouse (não é um clique de ação)
        this.travando = true;
        try { const pr = cv.requestPointerLock() as unknown as Promise<void> | undefined; pr?.catch?.(() => { this.travando = false; }); } catch { this.travando = false; }
        return;
      }
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.pinch0 = Math.hypot(a!.x - b!.x, a!.y - b!.y); this.dist0 = this.camDist; }
      this.drag = { x: e.clientX, y: e.clientY, az: this.camAz, pitch: this.camPitch }; this.moved = false;
    });
    on("pointermove", (e) => {
      if (this.olharLivre) {   // mexer o mouse = girar a câmera (direita gira pra direita; pra baixo olha pra baixo)
        this.camSegueEm = performance.now() + 1500; this.camAz -= e.movementX * SENS_OLHAR; this.camPitch = limitarPitch(this.camPitch + e.movementY * SENS_OLHAR * 0.85);
        return;
      }
      if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.ptrs.size === 2 && this.pinch0) { const [a, b] = [...this.ptrs.values()]; this.camDist = Math.min(CyberEngine.CAM_MAX, Math.max(6, (this.dist0 * this.pinch0) / Math.max(20, Math.hypot(a!.x - b!.x, a!.y - b!.y)))); this.moved = true; return; }
      if (!this.drag) { if (e.target === cv) this.passarMouse(e.clientX, e.clientY); return; }
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
      this.camSegueEm = performance.now() + 1500; this.camAz = this.drag.az - dx * 0.006; this.camPitch = limitarPitch(this.drag.pitch + dy * 0.005);   // arrastar pra baixo até o chão → olhar pro céu
    });
    on("pointerup", (e) => {
      if (this.travando) { this.travando = false; return; }
      if (this.olharLivre) return;
      const era = this.ptrs.size; this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2) this.pinch0 = 0;
      if (this.drag && !this.moved && era === 1) this.clicar(e.clientX, e.clientY);
      if (!this.ptrs.size) this.drag = null;
    });
    on("pointercancel", (e) => { this.ptrs.delete(e.pointerId); if (!this.ptrs.size) { this.drag = null; this.pinch0 = 0; } });
    onC("pointerenter", () => { this.sobContainer = true; });
    onC("pointerleave", () => { this.sobContainer = false; this.hoverBase = null; cv.style.cursor = ""; });
    onC("wheel", (e) => { if (this.menu) return; /* menu: a página continua rolando */ e.preventDefault(); this.camDist = Math.min(CyberEngine.CAM_MAX, Math.max(6, this.camDist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });
  }

  /** olhar livre só na tela cheia (fora do menu/landing), com mouse de verdade (no celular é arrastar/joystick) */
  private podeOlharLivre(ignorarMenu = false) {
    return (ignorarMenu || !this.menu) && this.o.teclasSempre && typeof document !== "undefined" && "exitPointerLock" in document && !!window.matchMedia?.("(pointer: fine)").matches;
  }
  /** a AÇÃO de contexto (tecla F / chip na tela), pela prioridade: sair do veículo pousado → estudar → montar na moto →
   *  embarcar na nave (dono) → recado na TV do lounge (dono) → falar com quem está do lado → abrir o marco perto */
  private acaoPerto(): { id: string; rotulo: string; fazer: () => void } | null {
    if (this.menu) return null;
    if (this.pilotando) return { id: `leme-${this.pousado}`, rotulo: this.pousado ? "Largar o leme" : "Estacionar aqui (largar o leme)", fazer: () => this.desembarcar() };
    if (this.bordo) {   // A BORDO: o leme (dono), o terminal de estudos, a porta
      const a = acaoNaNave(this.bordo, this.ehFundador(this.o.eu.id));
      if (a === "pilotar") return { id: "pilotar", rotulo: "Pilotar a nave", fazer: () => this.o.onEmbarcar?.() };
      if (a === "estudar") return { id: "estudar-nave", rotulo: "Estudar (meu desktop)", fazer: () => this.o.onEntrarEstudo?.() };
      if (a === "sair" && this.saidaSegura()) return { id: "sair-nave", rotulo: "Sair da nave", fazer: () => this.sairDaNave() };   // pairando no ar: desce-se pela rampa (e pula-se de mochila)
      return null;
    }
    if (this.moto !== null) return this.desceDaMotoAqui() ? { id: "descer-moto", rotulo: "Descer da moto", fazer: () => this.desmontar() } : null;
    if (this.jet.noAr || this.nascendo || this.tunel) return null;
    const el = this.plat ? elevadorAqui(this.plat.id, this.plat.andar, this.eu.pos) : null;
    if (el && this.plat) { const pl = this.plat; return { id: `elevador-${pl.andar}`, rotulo: el.rotulo, fazer: () => { pl.andar = el.proximo; this.som.tocar("near-ping", this.eu.av.group.position, { dist: DISTANCIA.eu }); } }; }
    const estudar = { id: "estudar", rotulo: "Estudar", fazer: () => this.o.onEntrarEstudo?.() };
    if (this.perto || this.noTopo || (this.noCeu && computadorPerto(this.eu.pos, 4) >= 0)) return estudar;
    const m = this.motoAoAlcance(); if (m) return { id: m.tipo === "vaga" ? `moto-${m.s}` : `moto-${m.dono}`, rotulo: "Montar na moto", fazer: () => { this.montar(m); } };
    if (this.nave && this.navePerto()) return { id: "entrar-nave", rotulo: "Entrar na nave", fazer: () => this.entrarNaNave() };
    if (this.noCeu && this.cidade?.tocaDiscos && this.ehFundador(this.o.eu.id)) {
      const td = this.cidade.tocaDiscos.getWorldPosition(this.tmp);
      if (Math.hypot(this.eu.pos.x - td.x, this.eu.pos.z - td.z) < 2.6) return { id: "som", rotulo: "Mesa do DJ", fazer: () => this.o.onAbrirSom?.() };
    }
    if (this.noCeu && this.cidade?.tvLounge && this.ehFundador(this.o.eu.id)) {
      const tv = this.cidade.tvLounge.getWorldPosition(this.tmp);
      if (Math.hypot(this.eu.pos.x - tv.x, this.eu.pos.z - tv.z) < 7) return { id: "recado", rotulo: "Escrever recado pro QG", fazer: () => this.o.onAbrirRecado?.() };
    }
    // na RECEPÇÃO, perto da mesa (o lar do Droid): chamar ele de novo (refaz o tutorial)
    if (!this.guia && this.droid && this.altoEm && !this.noCeu) { const c = this.casaDoAgente(); if (Math.hypot(this.eu.pos.x - c.x, this.eu.pos.z - c.z) < 5 && Math.abs(this.eu.alt - c.y) < 2.5) return { id: "chamar-droid", rotulo: `Chamar o ${DROID.nome}`, fazer: () => this.guiaRefazer() }; }
    let colega: Ator | null = null, dc = 3.0;
    for (const a of this.remotos.values()) { const d = Math.hypot(a.pos.x - this.eu.pos.x, a.pos.z - this.eu.pos.z); if (d < dc && Math.abs(a.alt - this.eu.alt) < 2) { dc = d; colega = a; } }
    if (colega) { const c = colega; return { id: `falar-${c.id}`, rotulo: `Falar com ${c.name}`, fazer: () => { this.falandoCom = c; this.alvo = null; this.o.onFalarCom?.(c.name); c.av.olharPara(Math.atan2(this.eu.pos.x - c.pos.x, this.eu.pos.z - c.pos.z)); } }; }
    // perto de um BURACO NEGRO da rede: F também entra (além de pisar no anel)
    { const no = this.noPerto(); if (no) return { id: `tunel-${no}`, rotulo: "Entrar no buraco negro", fazer: () => this.abrirTunel(no) }; }
    if ((!this.altoEm || this.noCeu) && !this.noTopo) {
      const poi = poiPerto(this.eu.pos, this.lms.map((l) => l.poi).filter((x) => !!x.link || x.acesso === "dono"));
      if (poi) return { id: `marco-${poi.id}`, rotulo: poi.nome, fazer: () => { this.alvo = null; this.o.onLandmark?.(poi); } };
    }
    return null;
  }
  /** F (ou o chip na tela): faz a ação de contexto de agora */
  executarAcao() { const a = this.acaoPerto(); if (a) a.fazer(); }
  /** o nó da rede de buracos negros perto (a até 2,5 m da borda do anel, no piso dele), ou null */
  private noPerto(): IdNo | null {
    if (this.menu || this.jet.noAr || this.moto !== null || this.pilotando || this.bordo || this.noTopo) return null;
    for (const id of Object.keys(NOS) as IdNo[]) {
      const n = NOS[id]; if (Math.abs(this.eu.alt - n.y) > 3) continue;
      if (Math.hypot(this.eu.pos.x - n.anel.x, this.eu.pos.z - n.anel.z) < n.anel.r + 2.5) return id;
    }
    return null;
  }
  /** entra no TÚNEL do buraco negro `origem`: fica parado e o React mostra os destinos (`viajarPeloTunel`) */
  private abrirTunel(origem: IdNo) {
    if (this.tunel) return;
    this.tunel = { origem, destinos: destinosDe(origem).filter((d) => d.id !== "zaeon" || !!this.cidade) };
    if (this.guia?.ativo) this.guia.tunel = true;   // o tutorial do Droid pedia isso
    this.portalArmado = false; this.alvo = null; this.alvoDepois = null; this.sitT = 0;
    this.keys = {}; this.joy = { x: 0, y: 0, on: false };   // as teclas seguradas não continuam andando lá dentro
    this.som.tocar("rise", this.eu.av.group.position, { dist: DISTANCIA.perto });
    this.o.onTunel?.(this.tunel);
  }

  /** solta o mouse (o React chama ao abrir um painel ou focar o chat) */
  soltarMouse() { if (this.olharLivre && typeof document !== "undefined") document.exitPointerLock(); }

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
    if (this.pilotando || this.moto !== null || this.nascendo || this.tunel) return;   // em voo, arrastar gira a câmera; clique não faz nada
    this.motoAlvo = null;
    const sob = this.monitorSob(cx, cy);
    this.ray.setFromCamera(this.ndc(cx, cy), this.cam);
    // uma MOTO parada: perto = monta; longe = anda até a vaga
    if (this.vagaMotos.length && (!this.altoEm || this.noCeu) && !this.noTopo) {
      // as candidatas: as motos prontas das vagas e as estacionadas, no MEU nível
      const cands: { alvo: AlvoMoto; alvos: THREE.Object3D[]; p: { x: number; y: number; z: number; yaw: number } }[] = [];
      vagas().forEach((v, i) => { if (this.vagaPronta(i)) cands.push({ alvo: { tipo: "vaga", s: i }, alvos: this.vagaMotos[i]!.alvos, p: { x: v.x, y: this.yDaVaga(v), z: v.z, yaw: v.yaw } }); });
      for (const { dono, m } of this.largadasAgora()) { const im = this.instMotos.get(`${dono === this.o.eu.id ? "eu" : dono}:p`); if (im) cands.push({ alvo: { tipo: "largada", dono, s: m.s }, alvos: im.h.alvos, p: m }); }
      const c = cands.find((x) => Math.abs(x.p.y - this.eu.alt) < 2.5 && this.ray.intersectObjects(x.alvos, true).length > 0);
      if (c) {
        if (!this.montar(c.alvo)) { const lx = Math.cos(c.p.yaw), lz = -Math.sin(c.p.yaw); this.alvo = new THREE.Vector2(c.p.x + lx * 1.4, c.p.z + lz * 1.4); this.alvoDepois = null; this.falandoCom = null; this.motoAlvo = c.alvo; }
        return;
      }
    }
    // a NAVE (perto da porta) → entrar
    if (this.nave && this.ray.intersectObjects(this.nave.alvos, true).length && this.navePerto()) { this.entrarNaNave(); return; }
    // na CIDADE: computador perto = Sala de Estudos; senão anda no piso
    if (this.cidade && this.noCeu) {
      if (sob === this.o.eu.id && this.perto) { this.o.onEntrarEstudo?.(); return; }   // a minha base, na Zaeon
      // os DESKTOPS da capela (Sala de Estudos / biblioteca)
      const hc = this.ray.intersectObject(this.cidade.computadores, false)[0];
      if (hc && computadorPerto(this.eu.pos, 4) >= 0) { this.o.onEntrarEstudo?.(); return; }
      // a TV do LOUNGE: o dono escreve o recado pro QG do Andrei (perto dela)
      if (this.cidade.tvLounge && this.ray.intersectObject(this.cidade.tvLounge, false).length) {
        const tv = this.cidade.tvLounge.getWorldPosition(new THREE.Vector3());
        if (Math.hypot(this.eu.pos.x - tv.x, this.eu.pos.z - tv.z) < 14) { this.o.onAbrirRecado?.(); return; }
      }
      const h = this.ray.intersectObjects(this.cidade.alvos, true)[0];
      if (h) { const q = resolverCidade({ x: h.point.x, z: h.point.z }); this.alvo = new THREE.Vector2(q.x, q.z); this.alvoDepois = null; }
      return;
    }
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
    const h = this.praca ? this.ray.intersectObject(this.praca.piso)[0] : undefined;   // o piso da praça (fora dela é o vazio)
    if (h) { const p = empurrarParaFora({ x: h.point.x, z: h.point.z }, this.colisores); this.alvo = new THREE.Vector2(p.x, p.z); this.alvoDepois = null; this.falandoCom = null; this.o.onFalarCom?.(null); }
  }

  private redimensionar() {
    const c = this.o.container; this.w = Math.max(1, c.clientWidth); this.h = Math.max(1, c.clientHeight);
    this.R.setSize(this.w, this.h, false); this.cam.aspect = this.w / this.h; this.cam.updateProjectionMatrix();
  }

  private vProj = new THREE.Vector3(); private vHud = new THREE.Vector3(); private vCamA = new THREE.Vector3(); private vCamB = new THREE.Vector3();
  private proj(v: THREE.Vector3) { const p = this.vProj.copy(v).project(this.cam); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, vis: p.z < 1 }; }
  /** põe um rótulo do HUD no ponto (x,y) da tela por TRANSFORM (só compõe: não refaz o layout) e só escreve o que mudou */
  private noHud(el: HTMLElement, x: number, y: number, vis: boolean) {
    const d = vis ? "block" : "none"; if (el.style.display !== d) el.style.display = d;
    if (vis) el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-100%)`;
  }

  /** a região dessa raiz deve ANIMAR neste quadro? Cria a região na 1ª vez; de longe esconde o detalhe e, bem longe,
   *  a região inteira (pela posição da câmera do quadro anterior — a diferença de um quadro não se vê) */
  private regiaoPerto(raiz: THREE.Object3D, nome: string, area?: () => Regiao): boolean {
    let r = this.regioes.get(raiz);
    if (!r) { r = criarRegiao(nome, raiz, { area }); this.regioes.set(raiz, r); }
    return atualizarRegiao(r, this.cam.position);
  }
  /** lotes da base: simula perto/longe, hover e energia (a tela, os cristais e as linhas reagem) */
  private loteBase(b: BaseEstudoHandle) {
    fundirEstaticos(b.group, { passo: (k, t) => b.atualizar({ dt: 1 / 30, t, ativa: k % 2 === 0, hover: k % 3 === 0, perto: k % 4 < 2, energia: (k % 5) / 4 }), manter: comDescendentes([b.monitor]) });
    for (let k = 0; k < 6; k++) b.atualizar({ dt: 1, t: 0, ativa: false, hover: false, perto: false, energia: 0 });   // volta ao repouso
  }
  /** aplica o degrau da qualidade adaptativa: resolução (o pixel ratio do perfil × o degrau) e a aura dos avatares
   *  (a nebulosa lê o degrau direto no desenho) — nada recompila */
  private aplicarQualidade() {
    const d = this.qa.atual;
    this.R.setPixelRatio(this.prBase * d.dpr);
    for (const a of [this.eu, ...this.remotos.values()]) a?.av.aura(d.aura);
  }
  private soltar(raiz: THREE.Object3D) { const r = this.regioes.get(raiz); if (r) { soltarRegiao(r); this.regioes.delete(raiz); } }

  private atualizarCamera(dt = 1 / 60) {
    const l = this.minhaBase;
    if (this.menu && l) {
      const pm = Math.min(2.4, Math.max(1, 0.9 / this.cam.aspect));   // retrato: afasta p/ caber a base
      const rel = localParaMundo(l, -2.6 * pm, 4.8 * pm);
      const yb = this.yDoNivel(l.nivel);
      this.cam.position.lerp(this.vCamA.set(rel.x, yb + 2.5 + 0.9 * (pm - 1), rel.z), 0.06);
      this.camT.lerp(this.vCamA.set(l.x, yb + (pm > 1 ? 0.1 : 1.4), l.z), 0.06); this.cam.lookAt(this.camT);
      return;
    }
    // de moto o alvo segue por TEMPO (não por quadro): a 60 m/s, 0,12/quadro deixava a câmera ~17 m pra trás; assim
    // fica ~v/12 (≈ 5 m no boost) — a moto "puxa" um pouco à frente, que dá a sensação de arrancada
    this.camT.lerp(this.vCamA.set(this.eu.pos.x, 1.2 + this.eu.alt, this.eu.pos.z), this.moto !== null ? 1 - Math.exp(-dt * 12) : 0.12);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    // MOTO: câmera de perseguição — volta sozinha pra TRÁS da moto (com atraso: a curva aparece na tela), a não ser
    // que a pessoa tenha mexido o mouse/arrastado há pouco; afasta um pouco com a velocidade
    if (this.moto !== null && performance.now() > this.camSegueEm) {
      let d = this.motoEst.yaw + Math.PI - this.camAz; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.camAz += d * (1 - Math.exp(-dt * 2.6));
    }
    let dist = this.pilotando ? Math.max(this.camDist, 75) : this.moto !== null ? Math.max(this.camDist, 9) + 2.2 * this.velTela : this.camDist;
    // câmera em 3ª pessoa: perto de um marco (ilha flutuante, muralhas), se a estrutura fica ENTRE a câmera e o
    // personagem, a câmera se aproxima (senão a ilha cobre a tela)
    const marco = this.lms.find((l) => Math.hypot(this.eu.pos.x - l.poi.x, this.eu.pos.z - l.poi.z) < l.poi.interactR * 1.8);
    if (marco && !this.noTopo) {
      const alvoOlho = this.vCamA.set(this.camT.x, this.camT.y + 0.8, this.camT.z);
      const dir = this.vCamB.set(Math.sin(this.camAz) * cp, sp, Math.cos(this.camAz) * cp).normalize();
      this.rayCam.set(alvoOlho, dir); this.rayCam.far = dist;
      const h = this.rayCam.intersectObjects(marco.alvos, true)[0];
      if (h) dist = Math.max(2.2, h.distance - 0.6);
    }
    // num campus: um prédio entre a câmera e o personagem → a câmera se aproxima
    const campusAqui = this.plat ? this.campi.find((c) => c.id === this.plat!.id) : undefined;
    if (campusAqui) {
      const alvoOlho = this.vCamA.set(this.camT.x, this.camT.y + 0.8, this.camT.z);
      const dir = this.vCamB.set(Math.sin(this.camAz) * cp, sp, Math.cos(this.camAz) * cp).normalize();
      this.rayCam.set(alvoOlho, dir); this.rayCam.far = dist;
      const h = this.rayCam.intersectObjects(campusAqui.h.alvosCamera, false)[0];
      if (h) dist = Math.max(2.2, h.distance - 0.6);
    }
    // na universidade: muralhas, paredes, torres e telhados entre a câmera e o personagem → a câmera se aproxima
    if (this.univ && this.plat?.id === "univ" && naUniversidade(this.eu.pos)) {
      const alvoOlho = this.vCamA.set(this.camT.x, this.camT.y + 0.8, this.camT.z);
      const dir = this.vCamB.set(Math.sin(this.camAz) * cp, sp, Math.cos(this.camAz) * cp).normalize();
      this.rayCam.set(alvoOlho, dir); this.rayCam.far = dist;
      const h = this.rayCam.intersectObjects(this.univ.alvosCamera, false)[0];
      if (h) dist = Math.max(2.2, h.distance - 0.6);
    }
    // órbita livre: por cima olha pro personagem; arrastando pra baixo encosta no chão e o olhar sobe pro céu
    const c = poseDaCamera({ olho: { x: this.camT.x, y: this.camT.y + 0.8, z: this.camT.z }, az: this.camAz, pitch: this.camPitch, dist, chaoY: this.eu.alt });
    this.cam.position.set(c.pos.x, c.pos.y, c.pos.z);
    this.cam.lookAt(c.olhar.x, c.olhar.y, c.olhar.z);
    // SENSAÇÃO DE VELOCIDADE (moto): o FOV abre com a velocidade (+12°, ~+14° no boost) e, no boost, a câmera treme de leve
    const alvoVel = this.moto !== null && !this.motoPousado ? sensacaoDeVelocidade(this.motoEst) : 0;
    this.velTela += (alvoVel - this.velTela) * (1 - Math.exp(-dt * (alvoVel > this.velTela ? 3 : 1.8)));
    if (!this.fovBase) this.fovBase = this.cam.fov;
    const fov = this.fovBase + 12 * Math.min(1.15, this.velTela);
    if (Math.abs(fov - this.cam.fov) > 0.02) { this.cam.fov = fov; this.cam.updateProjectionMatrix(); }
    if (this.moto !== null && this.motoEst.boost) { const a = 0.045 * this.velTela, t = performance.now() * 0.001; this.cam.position.x += Math.sin(t * 47) * a; this.cam.position.y += Math.sin(t * 61 + 1) * a; }
  }

  /** as entradas da MOTO: W/S (ou joystick pra frente/trás, ▲▼) = acelerador/freio; A/D (joystick de lado, ◀▶) = guidão;
   *  Espaço/E/SUBIR sobe; Q/DESCER desce; Shift ou ⚡ = boost. Não é relativo à câmera: W é sempre a frente da moto */
  private comandoDeMoto(): ComandoMoto {
    let acel = 0, giro = 0;
    if (this.keys.w || this.keys.arrowup) acel += 1; if (this.keys.s || this.keys.arrowdown) acel -= 1;
    if (this.keys.a || this.keys.arrowleft) giro -= 1; if (this.keys.d || this.keys.arrowright) giro += 1;
    if (this.joy.on) { acel -= this.joy.y; giro += this.joy.x; }
    acel -= this.botDir.z; giro += this.botDir.x;
    const subir = this.voY.subir, descer = this.voY.descer, boost = !!this.keys.shift || this.boostBotao;
    if (acel || subir || descer) this.autoPouso = false;
    return { acel: Math.max(-1, Math.min(1, acel)), giro: Math.max(-1, Math.min(1, giro)), subir, descer: descer || this.autoPouso, boost };
  }
  /** botão ⚡ (segurar) da moto */
  boostMoto(v: boolean) { this.boostBotao = v; }
  /** o tanque de boost (0..1) e se está aceso — o HUD lê */
  get tanqueMoto() { return this.moto === null ? null : { tanque: this.motoEst.tanque, aceso: this.motoEst.boost }; }

  // ───────────── loop ─────────────
  private loop(now: number) {
    if (!this.vivo) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    // limite de fps no COMPASSO (o relógio segue: o dt do próximo quadro cobre o pulo); na janela da landing (menu,
    // vista de fora) basta 30 fps
    const q = proximoQuadro(this.menu ? (this.fpsMax > 0 ? Math.min(this.fpsMax, 30) : 30) : this.fpsMax, now, this.ultimoQuadro);
    if (this.pausado || q.pular) return;
    this.ultimoQuadro = q.ultimo;
    const dtReal = Math.min(VOO.dtMax, this.clock.getDelta()), dt = Math.min(0.05, dtReal), t = now * 0.001;   // o voo usa o dt REAL (independente de FPS)
    if (!this.visivel || document.hidden) return;
    atualizarCamuflagem(t);   // o relógio único de todos os hologramas do mapa
    const eu = this.eu, euId = this.o.eu.id;

    // MENU: segurar ESPAÇO p/ viajar; personagem fica sentado contemplando
    if (this.menu) {
      if (this.espaco) { this.holdT += dt; if (this.o.els.hold) this.o.els.hold.style.width = Math.min(100, (this.holdT / 1.2) * 100) + "%"; if (this.holdT >= 1.2) this.iniciar("viajar"); }
      else if (this.holdT > 0) { this.holdT = Math.max(0, this.holdT - dt * 2); if (this.o.els.hold) this.o.els.hold.style.width = (this.holdT / 1.2) * 100 + "%"; }
      const s = this.assento(); eu.pos.set(s.x, 0, s.z); eu.facing = this.rotAssento(); this.sitT = 1; eu.moving = false;
    } else if (this.moto !== null) {
      // MOTO: pilotagem de moto (lib/cyber/motoFisica) — W/S acelera/freia, A/D esterça, Shift/⚡ boost
      const c = this.comandoDeMoto(); this.acelMoto = c.acel;
      const r = passoMotoSub(this.motoEst, c, dtReal, this.solidosDeVoo(), MOTO.teto);
      this.motoEst = r.s; this.motoPousado = r.pousado; if (r.pousado) this.autoPouso = false;
      eu.pos.set(r.s.x, 0, r.s.z); eu.facing = r.s.yaw; eu.moving = Math.hypot(r.s.vx, r.s.vz) > 1; this.sitT = 0;   // "andando" = a moto em movimento (o netcode extrapola)
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
        if (f.chegou) { if (this.rota.destino === "zaeon") this.naveEst = { ...poseDaDoca(), vx: 0, vy: 0, vz: 0 }; this.pararRota(); }   // na Zaeon, encaixa na doca (a porta na borda da ilha)
      }
      const r = passoVooSub(this.naveEst, cmd, dtReal, this.solidosDeVoo());
      this.naveEst = r.s; this.pousado = r.pousado; if (r.pousado) this.autoPouso = false;
      eu.pos.set(r.s.x, 0, r.s.z); eu.facing = r.s.yaw; eu.moving = false; this.sitT = 0;
    } else {
      let ix = 0, iz = 0;
      if (this.keys.w || this.keys.arrowup) iz -= 1; if (this.keys.s || this.keys.arrowdown) iz += 1;
      if (this.keys.a || this.keys.arrowleft) ix -= 1; if (this.keys.d || this.keys.arrowright) ix += 1;
      if (this.joy.on) { ix += this.joy.x; iz += this.joy.y; }
      if (this.nascendo || this.tunel) { ix = 0; iz = 0; this.alvo = null; this.alvoDepois = null; }   // dentro do tubo / do túnel: parado
      const correndo = this.keys.shift || this.correr, spd = correndo ? 7.5 : 4;
      let andando = false;
      if (this.bordo) { const pn = this.poseNave(); if (pn) { const w = paraMundo(pn, this.bordo); eu.pos.x = w.x; eu.pos.z = w.z; } }   // a nave pode ter andado (o dono pilotando)
      const prev = { x: eu.pos.x, z: eu.pos.z };
      const dir = moverRelativoCamera(ix, iz, this.camAz);
      const vel = this.noTopo ? 2 : spd;   // no topo: passos curtos na plataforma
      if (this.jet.noAr) {
        // NO AR: o IMPULSO da mochila move — W (frente) a toda, lados/trás mais devagar; soltou, segue no embalo
        const frente = iz < -0.3 && Math.abs(ix) <= Math.abs(iz) + 1e-6;
        this.impulsoFrente = !!dir && frente;
        this.jetV = passoHorizontalJet(this.jetV, dir ? { x: dir.wx * (frente ? JET.velFrente : JET.velLado), z: dir.wz * (frente ? JET.velFrente : JET.velLado) } : null, dt);
        eu.pos.x += this.jetV.x * dt; eu.pos.z += this.jetV.z * dt;
        const sp = Math.hypot(this.jetV.x, this.jetV.z);
        if (sp > 0.6) { eu.facing = Math.atan2(this.jetV.x, this.jetV.z); andando = true; }
        if (dir) { this.alvo = null; this.alvoDepois = null; this.falandoCom = null; }
      }
      else if (dir) { this.jetV = { x: 0, z: 0 }; this.impulsoFrente = false; this.motoAlvo = null; eu.pos.x += dir.wx * dt * vel; eu.pos.z += dir.wz * dt * vel; this.alvo = null; this.alvoDepois = null; andando = true; eu.facing = Math.atan2(dir.wx, dir.wz); this.falandoCom = null; }
      else if (this.alvo) {
        const dx = this.alvo.x - eu.pos.x, dz = this.alvo.y - eu.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.12) { eu.pos.x += (dx / d) * dt * 4; eu.pos.z += (dz / d) * dt * 4; andando = true; eu.facing = Math.atan2(dx, dz); } else { this.alvo = this.alvoDepois; this.alvoDepois = null; }
      }
      // sentar ao parar perto da PRÓPRIA base
      const querSentar = this.distBase(euId, eu.pos) < BASE_INTERACT_R && !andando && !this.alvo && !this.jet.noAr && !this.sobreNave;
      this.sitT += ((querSentar ? 1 : 0) - this.sitT) * Math.min(1, dt * 3);
      // passos (alternando 3 arquivos) só andando no chão/piso
      // no compasso do PÉ (pisada da animação); sem modelo, a cadência fixa de reserva
      const pisadas = eu.av.passosNovos();
      if (andando && !this.jet.noAr) {
        if (pisadas !== null) for (let k = 0; k < pisadas; k++) this.tocarPasso(eu);
        else { this.passoT += dt; if (this.passoT >= cadenciaPasso(!!correndo)) { this.passoT = 0; this.tocarPasso(eu); } }
      } else this.passoT = cadenciaPasso(!!correndo) * 0.6;
      if (this.jet.noAr) this.passoNoAr(eu, prev, dt);   // mochila a jato: colisão por altura + pouso
      if (this.saindoPelaRedoma && (!this.jet.noAr || this.jet.y > this.topoNave() + 1)) this.saindoPelaRedoma = false;
      else if (this.sobreNave) {
        // em pé no dorso: passou da borda → cai (gravidade da mochila, sem empuxo) até o chão/piso embaixo
        const d = Math.hypot(eu.pos.x - this.naveEst.x, eu.pos.z - this.naveEst.z);
        if (d > CyberEngine.TOPO_NAVE_R || d < RAIO_REDOMA) { this.sobreNave = false; this.jet = { tecla: false, noAr: true, y: this.topoNave(), vy: 0 }; }   // pela borda: cai fora; pelo vão da redoma (aberta): cai na cabine
      }
      else if (this.bordo) {   // A BORDO: anda no convés (paredes, móveis, reator) no referencial da nave
        const pn = this.poseNave();
        if (!pn) this.bordo = null;
        else {
          const quer = paraLocal(pn, eu.pos), q = andarNaNave(quer, this.bordo); this.bordo = q; const w = paraMundo(pn, q); eu.pos.x = w.x; eu.pos.z = w.z;   // inclusive a escada (sobe/desce de nível) e a rampa
          const ra = rampaDaNave(pn);
          if (naPontaDaRampa(q) && ra.desce && quer.z < q.z - 0.01) {   // andando pra fora no fim da rampa: desce na ILHA (doca) ou no CHÃO (pousada)
            const f = paraMundo(pn, { x: q.x, z: NAVE_QG.saida.z - 1 }); this.bordo = null; eu.pos.x = f.x; eu.pos.z = f.z;
            if (ra.desce === "ilha") { this.altoEm = "ceu"; this.yNav = CIDADE.pisoY; this.portalArmado = false; } else { this.altoEm = null; this.yNav = 0; }
          }
        }
      }
      else if (this.sitT > 0.05) { const s = this.assento(); eu.pos.x += (s.x - eu.pos.x) * Math.min(1, dt * 3); eu.pos.z += (s.z - eu.pos.z) * Math.min(1, dt * 3); eu.facing = this.rotAssento(); }
      else if (this.noTopo) { const e = this.eixoTopo()!, lim = 2.0 * this.escalaZaeon(); const dx = eu.pos.x - e.x, dz = eu.pos.z - e.z, d = Math.hypot(dx, dz); if (d > lim) { eu.pos.x = e.x + (dx / d) * lim; eu.pos.z = e.z + (dz / d) * lim; } }   // não cai da plataforma
      else if (this.noCeu && this.viagem) {
        // a ESCADA DE ENERGIA leva: a posição segue o fluxo (as teclas não mexem), sem passo nem pulo
        const v = this.viagem; v.t += dt; const k = Math.min(1, v.t / (v.tipo === "escada" ? VIAGEM_ESCADA.dur : TORRE_DJ.elevador.dur)), q = posDaViagem(v.tipo, v.sentido, k);
        eu.pos.x = q.p.x; eu.pos.z = q.p.z; eu.facing = q.rumo; andando = false; this.alvo = null; this.alvoDepois = null;
        if (k >= 1) { this.viagem = null; this.som.tocar("near-ping", eu.av.group.position, { dist: DISTANCIA.perto }); }
      }
      else if (this.noCeu) {
        // a RECEPÇÃO fica no piso da Zaeon: do pé da escada sobe-se pro salão; a ilha dela (o cone) é sólida
        const rc = this.recepcao();
        if (rc) { const r = resolverPasso(rc.mn, false, prev, eu.pos); eu.pos.x = r.x; eu.pos.z = r.z; if (r.alto) { this.altoEm = rc.lm.poi.id; this.yNav = r.y; } }
        // sem parede invisível na borda: passou do piso da ilha → cai
        const q = this.noCeu ? empurrarParaFora(resolverCidadeLivre(eu.pos), [...this.colisoresDoNivel("ceu"), ...this.colisoresDeNaves(CIDADE.pisoY), ...this.colisoresDeMotos(), ...this.colisoresDosTubos()]) : { x: eu.pos.x, z: eu.pos.z }; eu.pos.x = q.x; eu.pos.z = q.z; if (this.noCeu) this.yNav = CIDADE.pisoY;
        if (!this.noCeu) { /* subiu pro pé da escada da Recepção: o resto é dela (resolverChao) */ }
        else if (!naIlhaPrincipal(q)) this.cairDaqui({ x: (q.x - prev.x) / Math.max(dt, 1e-3), z: (q.z - prev.z) / Math.max(dt, 1e-3) });
        // pisou na boca da escada de energia: ela te leva (pra cima, da central; pra baixo, do lounge)
        // (ou no anel do ELEVADOR DE LUZ da torre do DJ: só desce, da cabine até o palco)
        else {
          const be = bocaDoElevador(q), boca = be ?? bocaDaEscada(q);
          if (boca && !this.jet.noAr) { this.viagem = { tipo: be ? "elevador" : "escada", sentido: boca, t: 0 }; this.alvo = null; this.alvoDepois = null; this.som.tocar("rise", eu.av.group.position, { dist: DISTANCIA.perto }); }
        }
      }
      else if (this.plat) {   // num LUGAR FLUTUANTE: anda com as colisões do andar; passou da borda do disco → cai
        const r = andarNaPlataforma(this.plat.id, this.plat.andar, eu.pos); eu.pos.x = r.x; eu.pos.z = r.z;
        if (r.fora) this.cairDaqui({ x: (eu.pos.x - prev.x) / Math.max(dt, 1e-3), z: (eu.pos.z - prev.z) / Math.max(dt, 1e-3) });
      }
      else if (this.ilhota !== null) {   // em pé numa ilhota: anda livre no topo; passou da borda dela → cai
        if (ilhotaEm(eu.pos, 0.2) !== this.ilhota) this.cairDaqui({ x: (eu.pos.x - prev.x) / Math.max(dt, 1e-3), z: (eu.pos.z - prev.z) / Math.max(dt, 1e-3) });
      }
      else this.resolverChao(eu, prev, dt);
      if (!this.bordo && !this.jet.noAr && !this.sobreNave && !this.noTopo && this.plat === null && this.ilhota === null && (this.noCeu || !this.altoEm)) {   // a pé na ilha (doca) ou no chão (pousada): pisou no fim da rampa → a bordo
        const pn = this.poseNave(), ra = pn ? rampaDaNave(pn) : null;
        if (pn && ra && ra.desce === (this.noCeu ? "ilha" : "chao")) {
          const l = paraLocal(pn, eu.pos), la = paraLocal(pn, prev);   // só quem anda PRA nave (quem acabou de descer não volta)
          if (Math.abs(l.x) < RAMPA.meia && Math.abs(l.z - RAMPA.z0) < 1.6 && l.z > la.z + 1e-4) { this.bordo = { x: Math.max(-0.9, Math.min(0.9, l.x)), z: RAMPA.z0 + 0.5, nivel: 0 }; this.altoEm = null; this.yNav = 0; }
        }
      }
      eu.moving = andando;
      if (this.motoAlvo !== null && !this.alvo) { const k = this.motoAlvo; this.motoAlvo = null; this.montar(k); }   // chegou na moto clicada
    }
    eu.sit = this.sitT;
    // DJ: parado na cabine do lounge (a pé) → é puxado pro lugar atrás da mesa e olha pra pista; o avatar põe o fone
    const souDJ = this.noCeu && !this.menu && !eu.moving && !this.jet.noAr && this.moto === null && !this.pilotando && !this.sobreNave && !this.bordo && naCabineDJ(eu.pos);
    eu.dj = (eu.dj ?? 0) + ((souDJ ? 1 : 0) - (eu.dj ?? 0)) * Math.min(1, dt * 4);
    if (souDJ) { const c = pontoDaCabineDJ(), k = Math.min(1, dt * 4); eu.pos.x += (c.x - eu.pos.x) * k; eu.pos.z += (c.z - eu.pos.z) * k; eu.facing = rumoDoDJ(); }
    eu.surf = (eu.surf ?? 0) + ((this.viagem ? 1 : 0) - (eu.surf ?? 0)) * Math.min(1, dt * 5);
    // DANÇA: parado na PISTA do lounge → dança virado pro palco
    const danco = this.noCeu && !this.menu && !eu.moving && !this.jet.noAr && this.moto === null && !this.pilotando && !souDJ && naPistaDeDanca(eu.pos);
    eu.danca = (eu.danca ?? 0) + ((danco ? 1 : 0) - (eu.danca ?? 0)) * Math.min(1, dt * 3);
    if (danco) eu.facing = rumoDaPista();
    const lmAlto = this.altoEm ? this.lms.find((l) => l.poi.id === this.altoEm) : undefined;
    const pnAlt = this.bordo ? this.poseNave() : null;
    eu.alt = pnAlt && this.bordo ? alturaDoConves(pnAlt) + alturaNoBordo(this.bordo, rampaDaNave(pnAlt).queda)
      : this.moto !== null ? this.motoEst.y
      : this.pilotando ? this.naveEst.y
      : this.jet.noAr ? this.jet.y
      : this.sobreNave ? this.topoNave()
      : this.plat ? PLATAFORMAS[this.plat.id].y + alturaDoAndar(this.plat.id, this.plat.andar)
      : this.ilhota !== null && this.cidade ? this.cidade.alturaIlhota(this.ilhota)
      : this.noCeu && this.viagem ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + posDaViagem(this.viagem.tipo, this.viagem.sentido, Math.min(1, this.viagem.t / (this.viagem.tipo === "escada" ? VIAGEM_ESCADA.dur : TORRE_DJ.elevador.dur))).y   // sendo levado: a altura do caminho
      : this.noCeu ? (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + alturaNaCidade(eu.pos)   // + o PALCO do lounge (escada = rampa)
      : this.noTopo ? this.alturaTopo() : (lmAlto?.poi.base ?? 0) + this.yNav + (lmAlto && marcoNav(lmAlto.poi) && this.yNav >= marcoNav(lmAlto.poi)!.nav.pisoY - 1e-6 ? this.boia(lmAlto) : 0);
    if (this.nascendo) eu.alt += 0.35;   // em pé no pedestal do tubo

    // BURACOS NEGROS: pisou no anel de um nó da rede → o TÚNEL (escolhe o destino); a pé, fora de veículo, no piso
    if (!this.menu && !this.pilotando && this.moto === null && !this.jet.noAr && !this.sobreNave && !this.bordo && !this.noTopo && !this.nascendo && !this.tunel && (!this.plat || this.plat.andar === 0)) {
      const no = noDoAnel(eu.pos, eu.alt);
      if (no && this.portalArmado) this.abrirTunel(no);
      else if (!no) this.portalArmado = true;
    }
    // o PAR DO DONO: a boca na cabine do DJ (lá em cima da torre) e a da nave (sala de reuniões)
    if (!this.menu && !this.pilotando && this.moto === null && !this.jet.noAr && !this.tunel) {
      const naBoca = this.bordo ? naBocaNave(this.bordo) : this.noCeu && naBocaDJ(eu.pos) && eu.alt > (this.cidade ? this.cidade.ilha.position.y : CIDADE.pisoY) + ALTURA_LOUNGE + TORRE_DJ.topo - 0.5;
      if (naBoca && this.bocaDonoArmada) {
        this.bocaDonoArmada = false;
        if (this.ehFundador(this.o.eu.id)) this.o.onBuracoDono?.(this.bordo ? "dj" : "nave");
        else this.o.onAviso?.("Só o dono atravessa este buraco negro.");
      } else if (!naBoca) this.bocaDonoArmada = true;
    }

    // estar perto da própria base = estado de estudo (luz/cristais/botão)
    const perto = this.distBase(euId, eu.pos) < BASE_INTERACT_R;
    if (perto !== this.perto) { this.perto = perto; this.o.onPerto?.(perto); if (perto) this.som.tocar("near-ping", eu.av.group.position, { dist: DISTANCIA.perto }); }

    // rede: eu → difusão; remotos → atores
    if (!this.menu) this.o.enviarPos?.({ x: eu.pos.x, z: eu.pos.z, facing: eu.facing, moving: eu.moving, sit: this.sitT > 0.5, topo: this.noTopo, ceu: this.naZaeon, ...(this.jet.noAr ? { jet: Math.round(this.jet.y * 100) / 100 } : {}), ...(this.sobreNave || this.ilhota !== null || this.plat || this.bordo || this.viagem || this.nascendo || (this.altoEm && !this.noCeu) ? { alt: Math.round(eu.alt * 100) / 100 } : {}), ...(this.moto !== null ? { moto: { s: this.moto, y: Math.round(this.motoEst.y * 100) / 100, yaw: this.motoEst.yaw, ...(this.motoDe ? { de: this.motoDe } : {}) } } : {}), ...(this.motoLargada ? { motoLargada: this.motoLargada } : {}), ...(this.pilotando ? { voo: { y: this.naveEst.y, yaw: this.naveEst.yaw } } : this.naveForaDoHangar() ? { naveParada: { x: this.naveEst.x, y: this.naveEst.y, z: this.naveEst.z, yaw: this.naveEst.yaw } } : {}) });
    this.sincronizarRemotos(dt, t);
    this.atualizarNascimentoEGuia(dt);
    this.atualizarAgentes(dt, t);

    // motos (antes dos avatares: quem está montado encaixa no banco/guidão/pedaleiras da moto já posicionada)
    const ocupadas = this.atualizarMotos(dt, t);
    // avatares
    eu.av.group.position.set(eu.pos.x, eu.alt, eu.pos.z); eu.av.olharPara(eu.facing);
    // fora (vista da landing / menu): MEDITANDO em frente ao computador; na base: digitando; no ar: jatos acesos
    eu.av.animar({ andando: eu.moving && !this.jet.noAr && this.moto === null, correndo: !!(this.keys.shift || this.correr) && eu.moving && this.moto === null, sentado: this.menu || this.pilotando ? 0 : this.sitT, meditando: this.menu && !this.pilotando ? 1 : 0, pilotando: this.pilotando ? 1 : 0, jato: this.jet.noAr ? (this.jet.tecla ? 1 : this.impulsoFrente ? 0.9 : 0.35) : 0, ar: this.jet.noAr ? { vy: this.jet.vy, movendo: eu.moving } : null, montado: this.moto !== null ? this.naMoto(eu.av, ocupadas.get(this.eu)) : null, dj: eu.dj ?? 0, danca: eu.danca ?? 0, surf: eu.surf ?? 0, dt, t });
    for (const a of this.remotos.values()) {
      const pilota = !!a.nave && !a.naveP, monta = a.moto ? ocupadas.get(a) ?? null : null;
      const ehDJ = !!a.ceu && !a.moving && a.jet === undefined && !pilota && monta === null && naCabineDJ(a.pos);   // a posição dele já vem puxada pra cabine pelo engine dele
      a.dj = (a.dj ?? 0) + ((ehDJ ? 1 : 0) - (a.dj ?? 0)) * Math.min(1, dt * 4);
      const dancando = !!a.ceu && !a.moving && a.jet === undefined && !pilota && monta === null && !ehDJ && naPistaDeDanca(a.pos);
      a.danca = (a.danca ?? 0) + ((dancando ? 1 : 0) - (a.danca ?? 0)) * Math.min(1, dt * 3);
      // na escada só se está sendo levado; no elevador da torre, quem está no ar dentro da coluna de luz
      const qs = naSala(CIDADE.salas.lounge, a.pos.x - CIDADE.centro.x, a.pos.z - CIDADE.centro.z), naColuna = Math.hypot(qs.x, qs.z - TORRE_DJ.elevador.sobe) < 1.6 && a.alt > CIDADE.pisoY + ALTURA_LOUNGE + PALCO_LOUNGE.h + 0.6;
      const surfando = !!a.ceu && a.jet === undefined && (naEscadaDoLounge(a.pos) || naColuna);
      a.surf = (a.surf ?? 0) + ((surfando ? 1 : 0) - (a.surf ?? 0)) * Math.min(1, dt * 5);
      a.av.group.position.set(a.pos.x, a.alt, a.pos.z); a.av.olharPara(pilota ? a.naveYaw ?? a.facing : a.facing);
      // de longe / fora da tela o avatar anima menos vezes por segundo (o mixer + IK de cada um custa); fora da tela
      // nem desenha (a malha com skinning não tem esfera confiável: frustumCulled=false) — perto continua animando
      // mesmo atrás de mim (o passo dele soa)
      const dCam = this.cam.position.distanceTo(a.av.group.position), naTela = this.frustum.intersectsSphere(this.esfAtor.set(a.av.group.position, 2.2)) || dCam < 4;
      a.av.group.visible = naTela;
      const cada = dCam < 25 ? 0 : !naTela ? (dCam < 60 ? 0.1 : Infinity) : dCam > 120 ? 0.1 : dCam > 40 ? 0.05 : 0;
      a.acum = (a.acum ?? 0) + dt;
      if (a.acum >= cada) { a.av.animar({ montado: monta !== null ? this.naMoto(a.av, monta) : null, andando: a.moving && a.jet === undefined && !pilota && monta === null && (a.surf ?? 0) < 0.5, sentado: pilota || monta !== null ? 0 : a.sit, pilotando: pilota ? 1 : 0, jato: a.jet !== undefined ? (a.vyJet ?? 0) > -3 ? 0.9 : 0.3 : 0, ar: a.jet !== undefined ? { vy: a.vyJet ?? 0, movendo: a.moving } : null, dj: a.dj ?? 0, danca: a.danca ?? 0, surf: a.surf ?? 0, dt: Math.min(0.1, a.acum), t }); a.acum = 0; }
      if (a.nave && a.naveP) { a.nave.group.position.set(a.naveP.x, a.naveP.y, a.naveP.z); a.nave.group.rotation.y = a.naveP.yaw + GIRO_PLANTA; a.nave.atualizar({ dt, t, voando: false, vel: 0, curva: 0 }); }
      else if (a.nave) { a.nave.group.position.set(a.pos.x, a.alt, a.pos.z); a.nave.group.rotation.y = (a.naveYaw ?? 0) + GIRO_PLANTA; a.nave.atualizar({ dt, t, voando: a.alt > 0.5, vel: a.moving ? 1 : 0, curva: 0, fechada: true }); this.noAssento(a.av, a.nave); }
    }

    // cidade + a minha nave (parada onde pousou, ou comigo dentro)
    if (this.cidade && this.regiaoPerto(this.cidade.group, "zaeon", AREA_ZAEON)) { this.cidade.atualizar(dt, t); this.bercario?.atualizar(dt, t); }
    if (this.praca && this.regiaoPerto(this.praca.group, "praca")) this.praca.atualizar(dt, t);
    if (this.somLounge) { this.somLounge.atualizar(dt); this.cidade?.somTocando(this.somLounge.tocando, this.somLounge.nivel); }
    if (this.holo) {   // o holograma acompanha a base do QG (que flutua junto com o marco)
      const lay = baseNoQG(), w = lay ? localParaMundo(lay, HOLO_NA_BASE.x, HOLO_NA_BASE.z) : null;
      if (lay && w) { this.holo.group.position.set(w.x, this.yDoNivel("qg"), w.z); this.holo.group.rotation.y = lay.rot + HOLO_NA_BASE.giro; }
      this.holo.atualizar(dt, t);
    }
    if (this.univ && this.regiaoPerto(this.univ.group, "unilab", AREA_UNILAB)) this.univ.atualizar(dt, t);
    for (const c of this.campi) if (this.regiaoPerto(c.h.group, `campus-${c.id}`, c.area)) c.h.atualizar(dt, t);
    if (this.solana && this.regiaoPerto(this.solana.group, "solana", AREA_SOLANA)) this.solana.atualizar(dt, t);
    if (this.nave) {
      const n = this.naveEst, curva = (n.yaw - this.yawAnt) / Math.max(dt, 1e-3); this.yawAnt = n.yaw;
      this.nave.group.position.set(n.x, n.y, n.z); this.nave.group.rotation.y = n.yaw + GIRO_PLANTA;   // estacionária: fica exatamente onde parou (a frente, com a rampa, no rumo)
      this.nave.group.visible = this.pilotando || !this.naveDoDonoFora();
      this.nave.atualizar({ dt, t, voando: this.pilotando && !this.pousado, vel: Math.hypot(n.vx, n.vz) / VOO.vel, curva, fechada: this.pilotando });
      if (this.pilotando) this.noAssento(eu.av, this.nave);   // o piloto aparece na cadeira, na cabine do centro
    }
    // a redoma da cabine abre (e o dorso fica translúcido na MINHA tela) enquanto eu estou a bordo
    { const pn = this.bordo ? this.poseNave() : null, abre = redomaAberta(this.bordo, this.pilotando);
      const chama = this.redomaChamando() ? this.poseNave() : null;   // voltando de mochila: abre pra eu entrar
      for (const h of [this.nave, ...[...this.remotos.values()].map((a) => a.nave)]) { if (!h) continue; const minha = !!pn && pn.h === h; h.aBordo(minha); h.abrirCabine((minha && abre) || (!!chama && chama.h === h)); }
      const pv = this.poseNave(); if (pv) { const ra = rampaDaNave(pv); pv.h.rampa(ra.queda, ra.desce === null); }   // a rampa acompanha onde a nave está
      // camuflada: o convés por dentro só é desenhado com EU a bordo — de fora (mesmo de perto) só a silhueta; a GPU agradece
      const dentro = !!pv && (!!this.bordo || this.pilotando);
      for (const h of [this.nave, ...[...this.remotos.values()].map((a) => a.nave)]) if (h) h.verDentro(dentro && !!pv && pv.h === h); }
    this.atualizarHudVoo(now);
    this.atualizarSom(dt);
    const navePerto = !this.pilotando && !!this.nave && this.navePerto();
    const naMoto = this.moto !== null, motoPertoAgora = !!this.motoAoAlcance(), pousado = naMoto ? this.motoPousado : this.pousado;
    const est = `${this.noCeu}|${navePerto}|${this.pilotando}|${pousado}|${naMoto}|${motoPertoAgora}`;
    const ac = this.acaoPerto(), ch = ac ? `${ac.id}|${ac.rotulo}` : "";
    if (ch !== this.acaoChave) { this.acaoChave = ch; this.o.onAcao?.(ac ? { rotulo: ac.rotulo } : null); }
    if (est !== this.estadoQG) { this.estadoQG = est; this.o.onEstadoQG?.({ noCeu: this.noCeu, navePerto, pilotando: this.pilotando, pousado, moto: naMoto, motoPerto: motoPertoAgora }); }

    // marcos: animação + a "estátua" do dono some quando o dono real está lá em cima
    const donoNoTopo = this.noTopo || [...this.remotos.values()].some((a) => a.topo);
    for (const lm of this.lms) { if (this.regiaoPerto(lm.group, lm.poi.id)) lm.atualizar(dt, t); if (lm.topo) lm.donoPresente(donoNoTopo); }

    // bases
    for (const [id, b] of this.bases) {
      const alguemPerto = id === euId ? perto : [...this.remotos.values()].some((a) => a.id === id && this.distBase(id, a.pos) < BASE_INTERACT_R);
      if (b.layout.nivel) b.group.position.y = this.yDoNivel(b.layout.nivel);
      // energia = o dono SENTADO na cabine (fluxo mãos → tela)
      const energia = id === euId ? this.sitT : (this.remotos.get(id)?.sit ?? 0);
      if (this.regiaoPerto(b.group, "base")) b.atualizar({ dt, t, ativa: alguemPerto, hover: this.hoverBase === id, perto: id === euId && perto, energia });
    }
    if (this.baseQG) { this.baseQG.group.position.y = this.yDoNivel("qg"); if (this.regiaoPerto(this.baseQG.group, "base-qg")) this.baseQG.atualizar({ dt, t, ativa: false, hover: false, perto: false }); }
    // motos: de longe some a moto inteira (ninguém vê 2 m de moto a 1 km); a montada está sempre perto da câmera
    for (const m of this.vagaMotos) this.regiaoPerto(m.g, "moto");
    for (const m of this.instMotos.values()) this.regiaoPerto(m.g, "moto");

    this.atualizarCamera(dt);
    this.cena.atualizar({ dt, t, cam: this.cam, aspect: this.cam.aspect });
    this.atualizarHud(now);
    const desenhar = () => { this.R.clear(); this.cena.desenharFundo(this.R, this.qa.atual.nebulosa); this.R.clearDepth(); this.R.render(this.cena.scene, this.cam); };
    // moto rápida (components/cyber/VelocidadeTela): as LINHAS de velocidade estilo anime + vinheta ligam SEMPRE (são
    // baratas); o BLUR radial só quando a qualidade deixa (fora do modo low e dos degraus baixos — é uma tela inteira a mais)
    if (this.velTela > 0.03) {
      this.fxVel ??= criarVelocidadeTela({ amostrasMsaa: this.R.getContext().getContextAttributes()?.antialias ? 4 : 0 });
      this.fxVel.render(this.R, this.velTela, t, desenhar, this.qa.atual.aura && !this.o.low);
    } else desenhar();
    // o frustum deste quadro (os avatares remotos do próximo quadro usam pra saber se estão na tela)
    this.mProj.multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.mProj);
    // qualidade adaptativa: só mede jogando (o menu/landing roda a 30 e confundiria a medida)
    if (!this.menu && this.ultimoDesenho > 0 && this.qa.registrar(now - this.ultimoDesenho) !== null) this.aplicarQualidade();
    this.ultimoDesenho = now;
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
          if (this.tVivo > 3) this.som.tocar("join", a.pos);   // quem já estava quando entrei não "chega"
          if (!this.pessoas.has(id)) this.setPessoas([...this.ordem.map((i) => this.pessoas.get(i)!), { id, name: p.name, color: p.color }]);
        }
        if (this.o.remotosSuaves) {
          const andou = Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > 0.004;
          a.pos.x = p.x; a.pos.z = p.z; a.facing = p.facing; a.moving = andou || p.moving === true;
        } else {
          const r = interpolar({ x: a.pos.x, z: a.pos.z, facing: a.facing }, { x: p.x, z: p.z, facing: p.facing }, dt);
          a.pos.x = r.x; a.pos.z = r.z; a.facing = r.facing; a.moving = r.moving || p.moving === true;
        }
        a.falando = p.falando === true;   // voz (push-to-talk): 🎙 no rótulo
        const pendente = this.vozPendente.get(id); if (pendente) { this.vozPendente.delete(id); this.vozDe(id, pendente); }
        a.sit += ((p.sit ? 1 : 0) - a.sit) * Math.min(1, dt * 3);
        // "no topo" só vale pra quem o SERVIDOR marcou como fundador (client event forjado não sobe ninguém)
        // regalias (topo/nave) só pra quem o SERVIDOR marcou como fundador — a Zaeon (céu) é aberta
        const fund = !!this.pessoas.get(id)?.fundador;
        a.topo = p.topo === true && this.ehFundador(id);
        a.ceu = p.ceu === true;   // a Zaeon é aberta a todos (o topo e a nave continuam do dono)
        const voando = fund && !!p.voo, parada = fund && !voando && p.naveParada ? p.naveParada : null;
        if ((voando || parada) && !a.nave && this.cidade) {
          a.nave = criarNave({ low: this.o.low, cor: a.color }); loteNave(a.nave); this.cena.scene.add(a.nave.group);
          a.somNave = { idle: this.som.loop("ship-idle", a.nave.group, { dist: DISTANCIA.grande }), voo: this.som.loop("ship-flight", a.nave.group, { dist: DISTANCIA.grande }), g: gatilhoVooInicial(), voava: voando, ev: somNaveInicial(!voando), yAnt: null, vy: 0 };   // já chega voando: sem decolagem fantasma
        }
        if (!voando && !parada && a.nave) { this.soltarSomNave(a); a.nave.dispose(); a.nave = null; }
        if (a.nave && a.somNave) {
          // a nave do OUTRO é posicional cheia: decolagem/pouso/voo vêm do lado certo e somem com a distância
          const sn = a.somNave, y = voando ? p.voo!.y : null;
          if (y !== null && sn.yAnt !== null && dt > 0) sn.vy += ((y - sn.yAnt) / dt - sn.vy) * Math.min(1, dt * 4); else sn.vy = 0;
          sn.yAnt = y;
          const ev = eventosNave(sn.ev, { pousado: !voando, vy: sn.vy, altura: y === null ? 0 : y - chaoDoVoo({ x: p.x, y, z: p.z }) }, dt); sn.ev = ev.e;
          const em = a.nave.group.position, d = { dist: DISTANCIA.grande };
          if (ev.pousou) this.som.tocar("ship-touchdown", em, d);
          // o colega começou a subir/descer (pela velocidade vertical, com histerese): o som sai 1×, preso à nave dele
          const g = gatilhosVoo(sn.g, { subindo: voando && sn.vy > (sn.g.subindo ? 3 : 6), descendo: voando && sn.vy < (sn.g.descendo ? -3 : -6) }, dt); sn.g = g.e;
          if (g.sobe) this.som.tocar("ship-takeoff", null, { dist: DISTANCIA.grande, seguir: a.nave.group });
          if (g.desce) this.som.tocar("ship-landing", null, { dist: DISTANCIA.grande, seguir: a.nave.group });
          sn.voava = voando; this.som.volumeLoop(a.somNave.voo, voando ? 1 : 0); this.som.volumeLoop(a.somNave.idle, voando ? 0 : 1);
        }
        a.naveP = parada;
        a.moto = !voando && p.moto ? p.moto : null;   // moto: qualquer pessoa (sem regalia)
        a.motoLargada = p.motoLargada ?? null;
        const jetAnt = a.jet; a.jet = !voando && !a.moto && typeof p.jet === "number" ? p.jet : undefined;
        if (a.jet !== undefined && jetAnt !== undefined && dt > 0) a.vyJet = (a.vyJet ?? 0) + (((a.jet - jetAnt) / dt) - (a.vyJet ?? 0)) * Math.min(1, dt * 4); else a.vyJet = 0;
        const altAlvo = voando ? p.voo!.y : a.moto ? a.moto.y : a.jet !== undefined ? a.jet : typeof p.alt === "number" ? p.alt : a.topo ? this.alturaTopo() : a.ceu ? CIDADE.pisoY + alturaNaCidade(a.pos) : this.alturaChao(a.pos);
        a.alt += (altAlvo - a.alt) * (Math.abs(altAlvo - a.alt) > 40 ? 1 : Math.min(1, dt * 6));   // portal = corte seco
        if (voando) a.naveYaw = p.voo!.yaw;
        void t;
      }
      // saiu da sala: o personagem some; a BASE fica (bases vivem em this.bases)
      for (const [id, a] of this.remotos) if (!src.has(id)) { this.som.tocar("leave", a.av.group.position); this.removerAtor(a); this.remotos.delete(id); if (this.falandoCom === a) { this.falandoCom = null; this.o.onFalarCom?.(null); } }
    }
  }

  /** HUD de voo: marcador de pouso sob a nave, anel na borda da ilha e o altímetro pro React (sem marcadores na tela) */
  private atualizarHudVoo(now: number) {
    const h = this.hudVoo; if (!h) return;
    const naMoto = this.moto !== null, voando = (this.pilotando || naMoto) && !this.menu, n = naMoto ? this.motoEst : this.naveEst, boiaCidade = this.cidade ? this.cidade.ilha.position.y - CIDADE.pisoY : 0;
    const solidos = voando ? this.solidosDeVoo() : [];
    h.marca.visible = voando && !naMoto && !this.pousado;   // o marcador de pouso no chão é só da nave (na moto, o dono pediu sem)
    if (h.marca.visible) { const c = chaoDoVoo(n, solidos); h.marca.position.set(n.x, c + (c === CIDADE.pisoY ? boiaCidade : 0) + 0.1, n.z); }
    h.borda.visible = voando && !naMoto && Math.hypot(n.x - CIDADE.centro.x, n.z - CIDADE.centro.z) < CIDADE.bordaR + 60;
    if (h.borda.visible) h.borda.position.y = CIDADE.pisoY + boiaCidade + 0.4;
    // altímetro (React), só quando muda e no máx. 10×/s
    if (!voando || now - h.t < 100) return;
    const chave = String(Math.round(n.y));
    if (chave !== h.chave) { h.chave = chave; h.t = now; this.o.onVoo?.({ y: Math.max(0, Math.round(n.y)) }); }
  }

  private atualizarHud(now: number) {
    const { eu } = this;
    if (this.dicaMira) this.dicaMira.style.display = this.menu ? "none" : "block";
    const atores = [eu, ...this.remotos.values()];
    { const d = this.droid; if (d) { const vis = d.h.group.visible && !this.menu; if (vis) { const s = this.proj(this.vHud.set(d.pos.x, d.alt + 1.25, d.pos.z)); this.noHud(d.tag, s.x, s.y, s.vis); } else if (d.tag.style.display !== "none") d.tag.style.display = "none"; } }
    for (const a of atores) {
      if (a === eu) { a.tag.style.display = "none"; continue; }   // o próprio avatar não leva nome
      const s = this.proj(this.vHud.set(a.pos.x, 2.1 + a.sit * -0.3 + a.alt, a.pos.z));
      this.noHud(a.tag, s.x, s.y, !this.menu && s.vis && a.av.group.visible);
      { const perto = eu.pos.distanceTo(a.pos) < 3.0, borda = a.falando ? "#9affd0" : perto ? "#fff" : "", txt = (a.falando ? "🎙 " : perto ? "💬 " : "") + a.name;
        if (a.tag.style.borderColor !== borda) a.tag.style.borderColor = borda; if (a.tag.textContent !== txt) a.tag.textContent = txt; }
    }
    for (let i = this.falas.length - 1; i >= 0; i--) {
      const f = this.falas[i]!; if (now > f.ate) { f.el.remove(); this.falas.splice(i, 1); continue; }
      const p = this.proj(this.vHud.set(f.ator.pos.x, 2.4 + f.ator.alt, f.ator.pos.z)); this.noHud(f.el, Math.min(this.w - 108, Math.max(108, p.x)), Math.max(70, p.y), p.vis);   // o balão não sai da tela
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
    if (this.droid) { this.droid.h.dispose(); this.droid.tag.remove(); }
    this.praca?.dispose(); this.bercario?.dispose(); if (this.farol) { this.farol.geometry.dispose(); (this.farol.material as THREE.Material).dispose(); }
    for (const b of this.bases.values()) b.dispose(); this.baseQG?.dispose();
    for (const lm of this.lms) lm.dispose();
    this.somLounge?.dispose(); this.som.dispose();
    this.cidade?.dispose(); this.holo?.dispose(); this.univ?.dispose(); for (const c of this.campi) c.h.dispose(); this.solana?.dispose(); this.nave?.dispose(); for (const m of [...this.instMotos.values(), ...[...this.poolMotos.values()].flat()]) m.h.dispose();
    for (const m of this.vagaMotos) { m.g.traverse((x) => { const k = x as THREE.Mesh; k.geometry?.dispose(); }); m.g.removeFromParent(); }
    for (const m of [...this.instMotos.values(), ...[...this.poolMotos.values()].flat()]) m.casca.removeFromParent();
    for (const f of this.fabricas) f.robo.dispose();
    if (this.hudVoo) for (const m of [this.hudVoo.marca, this.hudVoo.borda]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    this.fxVel?.dispose(); this.cena.dispose(); this.R.dispose(); this.R.forceContextLoss(); this.R.domElement.remove();
  }
}
