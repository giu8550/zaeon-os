/**
 * O TOUR DO LABORATÓRIO (out/2026, v2): a 1ª vez que a pessoa abre o laboratório FORA do tutorial do tablet, a Aura guia
 * o caminho de ouro — pedir um estudo no chat ("Quero estudar sobre…") → conhecer a Sala de Estudos (os blueprints)
 * enquanto o estudo nasce → voltar pro chat e pedir um DIAGRAMA interativo → GERAR O PERCURSO → o mapa pronto.
 * Os passos de ação só andam quando a pessoa FAZ a coisa (o evento chega); os de explicação têm um botão (cta).
 * A 1ª missão do tablet (lib/onboarding/tutorialLab) e o tutorial do metaverso não mudam.
 * Pular/concluir marca como visto (neste navegador) e no servidor (/api/onboard/tour → User.tourDone), uma vez só.
 */
import type { AbaEstudos } from "@/lib/chat/conversasNav";
import { EVT_ABRIR_DOC, KINDS_EM_ABA } from "@/lib/chat/documentos";
import type { EstadoBolinha } from "@/lib/map/bolinha";
import { geracaoValida } from "@/lib/onboarding/geracaoTour";
import { CHAVE_LOCAL, salvarVistoNaConta } from "@/lib/onboarding/vistosConta";

/** o chat da Sala de Estudos mandou uma pergunta (components/study/StudyCoworkChat) */
export const EVT_PERGUNTA_CHAT = "zaeon:chat:pergunta";
/** o mapa do percurso abriu com um mapa pronto (components/cerebro/CerebroPanel) */
export const EVT_PERCURSO_ABERTO = "zaeon:percurso:aberto";
/** #613: o chip de exemplo do "Sua vez" escreve no campo do chat (detail: { texto }) — quem manda é a pessoa */
export const EVT_PREENCHER_CHAT = "zaeon:chat:preencher";
/** #618: o campo do chat ficou com texto ou vazio (detail: boolean) — o contorno do tour passa pro ➤ enviar */
export const EVT_CHAT_TEXTO = "zaeon:chat:texto";
/** #618: com texto no campo, o destaque vai pro ➤ (o botão de enviar DESTE chat, não de outro composer da tela) */
export const ALVO_ENVIAR = '[data-tour="composer-estudos"] [data-tour="enviar"]';
/** #626: o chat começou / terminou um desenho (detail: { fase: "comecou" | "pronto" | "falhou", kind }) */
export const EVT_DESENHO = "zaeon:chat:desenho";
/** #626: a resposta da Aura terminou (o turno do chat fechou) */
export const EVT_TURNO_FIM = "zaeon:chat:turno-fim";
export type FaseDesenho = "comecou" | "pronto" | "falhou";
export const avisarDesenho = (fase: FaseDesenho, kind: string) => { try { window.dispatchEvent(new CustomEvent(EVT_DESENHO, { detail: { fase, kind } })); } catch { /* sem janela */ } };
export const avisarTurnoFim = () => { try { window.dispatchEvent(new Event(EVT_TURNO_FIM)); } catch { /* sem janela */ } };
/** os desenhos que contam pro passo do diagrama (o que abre em aba + o mapa mental) */
export const KINDS_VISUAIS: readonly string[] = [...KINDS_EM_ABA, "mindmap"];

/**
 * #626: o passo do diagrama acompanha o PEDIDO (antes, ele só andava quando o documento abria — bem depois do
 * Enter — e parecia ignorar a pessoa). enviado → (o desenho começou) desenhando → (pronto) o passo anda.
 * A resposta acabou sem desenho, ou o desenho falhou → semDesenho (o cartão volta com o "Já fiz" em destaque).
 */
export type PedidoDesenho = null | "enviado" | "desenhando" | "semDesenho";
export type EventoPedido = { tipo: "pergunta" } | { tipo: "desenho"; fase: FaseDesenho; kind: string } | { tipo: "fim" };
export function proximoPedido(atual: PedidoDesenho, ev: EventoPedido): PedidoDesenho {
  if (ev.tipo === "pergunta") return "enviado";
  // #629: antes do pedido, desenho nenhum conta — o "brinde" da resposta do passo 1 ficava pronto aqui e pulava o passo
  if (atual === null) return null;
  if (ev.tipo === "desenho") {
    if (!KINDS_VISUAIS.includes(ev.kind)) return atual;
    return ev.fase === "comecou" ? "desenhando" : ev.fase === "falhou" ? "semDesenho" : atual;
  }
  return atual === "enviado" ? "semDesenho" : atual;   // fim do turno sem nenhum desenho começar
}
export const AVISO_PEDIDO: Record<"enviado" | "desenhando", string> = {
  enviado: "✓ Pedido enviado! A Aura está respondendo…",
  desenhando: "Desenhando o teu diagrama… ⏳",
};
export const TAREFA_SEM_DESENHO = "Dessa vez não saiu o desenho. Pede de novo, ou clica em “Já fiz” pra seguir.";

/** o botão de enviar do chat é um ↑ (CoworkComposer) — o texto usa o MESMO símbolo */
export const TAREFA_ENVIAR = "Quando terminar, aperta ↑ ou Enter";
/** #629: o contorno só vai pro ↑ depois de a pessoa PARAR de digitar por um instante (uma letra não é um pedido) */
export const ESPERA_DIGITAR_MS = 1500;
/** #613: o botão do percurso mudou de estado (detail: EstadoBolinha) — o cartão diz "gerando…" e depois "pronto" */
export const EVT_PERCURSO_ESTADO = "zaeon:percurso:estado";

/** um evento que faz o passo andar; `kinds` filtra o detail.studioKind (ex.: só os documentos visuais) */
export type Avanco = { evento: string; kinds?: readonly string[] };

export type PassoSala = {
  id: string;
  /** a dica curta do cartão (1 linha, com emoji) */
  dica: string;
  /** o que a Aura diz */
  fala: string;
  /** onde fica o destaque (o 1º seletor que existir na tela) */
  alvos: string[];
  /** #638: o que o cartão também não pode cobrir (o 1º seletor que existir na tela) */
  evitar?: string[];
  /** antes de mostrar, o laboratório vai pra esta sala (e sub-aba / vista do Marketplace) */
  ir?: { tab: "sala-de-estudos" | "pesquisa"; aba?: AbaEstudos; vista?: "vitrine" | "pesquisar" };
  /** passo de AÇÃO: anda quando um destes eventos chega (sem botão de seguir) */
  avancaEm?: Avanco[];
  /** passo de EXPLICAÇÃO: o rótulo do botão que segue */
  cta?: string;
  /** #613: passo de AÇÃO — a tarefa em 1 linha, na caixa "Sua vez" da última caixa (a instrução não some no meio da fala) */
  suaVez?: string;
  /** #613: um exemplo pronto: clicar escreve no chat (EVT_PREENCHER_CHAT) */
  exemplo?: string;
  /** #618: passo que se faz escrevendo no chat — com texto no campo, o contorno vai pro ➤ e a tarefa vira "mandar" */
  noChat?: boolean;
  /** #613: a IA pode responder com outro formato (uma aula em vez do diagrama) — "Já fiz ✓" segue mesmo assim */
  jaFiz?: boolean;
  /** só existe com o mapa do percurso ligado (NEXT_PUBLIC_MAP_HARNESS) */
  precisaMapa?: boolean;
};

export const PASSOS_SALA: PassoSala[] = [
  { id: "iniciar-estudo", ir: { tab: "sala-de-estudos", aba: "meus-estudos" },
    // #618: o campo, e não o botão "Quero estudar sobre…" — o "Sua vez" pede pra escrever (um caminho só)
    alvos: ['[data-tour="composer-estudos"]'], noChat: true,
    avancaEm: [{ evento: EVT_PERGUNTA_CHAT }],
    suaVez: "Escreve um tema no chat e manda", exemplo: "Quero estudar sobre fotossíntese",
    dica: "✨ Me diz no chat um tema pra estudar",
    fala: "Oi! Que bom te ver aqui. 💜 Bora começar: me diz aqui no chat um tema que você quer estudar — a matéria da prova, uma curiosidade, qualquer coisa. Dica: quanto mais específico, melhor (fotossíntese, Revolução Francesa, derivadas). Pode mandar!" },
  { id: "sala-estudos", ir: { tab: "sala-de-estudos", aba: "feed" },
    alvos: ['[data-tour="tab-feed"]'],
    cta: "Bora",
    dica: "🗺️ Sala de Estudos: os teus blueprints",
    fala: "Enquanto eu monto o teu estudo, vem conhecer a tua Sala de Estudos: é lá que cada estudo vira um blueprint, com as fases pra você dominar o assunto — o que estudar, o que construir e o que destrava cada fase." },
  { id: "criar-diagrama", ir: { tab: "sala-de-estudos", aba: "meus-estudos" },
    alvos: ['[data-tour="composer-estudos"]'],
    // #613: qualquer documento visual que abre em aba (diagrama, aula) conta — a IA nem sempre escolhe o diagrama
    avancaEm: [{ evento: EVT_ABRIR_DOC, kinds: [...KINDS_EM_ABA] }],
    suaVez: "Pede um diagrama interativo no chat", exemplo: "Faz um diagrama interativo disso", jaFiz: true, noChat: true,
    dica: "🧭 Peça um diagrama interativo",
    fala: "Pronto — teu estudo nasceu! 🎉 Agora, aqui no chat, pede um diagrama interativo (ex.: “faz um diagrama interativo disso”). Ver o assunto desenhado fixa o conhecimento de um jeito que o texto sozinho não alcança." },
  { id: "gerar-percurso", precisaMapa: true, ir: { tab: "sala-de-estudos", aba: "meus-estudos" },
    alvos: ['[data-tour="gerar-percurso"]'],
    // #638: com um documento aberto, o cartão não cobre a barra de cima dele (o "Exportar" do diagrama)
    evitar: ['[data-tour="doc-topo"]'],
    avancaEm: [{ evento: EVT_PERCURSO_ABERTO }],
    suaVez: "Clica no botão do mapa, em cima da conversa, pra gerar; quando ficar pronto, clica de novo pra abrir",
    dica: "📍 Gere o percurso e abra o mapa",
    fala: "Agora sim: você já tá bem informado sobre o assunto. 💜 Hora de criar um percurso pra não se perder nos estudos — clica aqui pra gerar e, quando ficar pronto, clica de novo pra abrir o mapa." },
  { id: "mapa-pronto", precisaMapa: true,
    alvos: ['[data-tour="percurso-view"]'],
    cta: "Boa jornada! 🚀",
    dica: "🗺️ O teu mapa de estudo",
    fala: "Esse mapa mental é o teu guia: ele quebra qualquer assunto em etapas e passos importantes pra você dominar de verdade, um de cada vez. Tema novo? É só repetir esse caminho. Tô aqui no chat sempre que precisar — boa jornada! 🚀" },
];

/** os passos que valem nesta instalação: sem o mapa do percurso ligado, o tour termina no diagrama */
export const passosDaSala = (mapaLigado: boolean): PassoSala[] => PASSOS_SALA.filter((p) => mapaLigado || !p.precisaMapa);

/** o evento faz o passo andar? (o tipo do documento vem no detail.studioKind) */
export function eventoAvanca(p: PassoSala, evento: string, detail: unknown): boolean {
  const kind = (detail as { studioKind?: string } | null)?.studioKind;
  return !!p.avancaEm?.some((a) => a.evento === evento && (!a.kinds || (!!kind && a.kinds.includes(kind))));
}

/** #613: o "Sua vez" do percurso acompanha o botão — sem isso, a pessoa clicava, nada abria e achava que travou */
export function tarefaDoPercurso(estado: EstadoBolinha | null, padrao: string): string {
  // #626: com o NOME que está escrito no botão (lib/map/bolinha · ROTULO) — o "✦" não existia na tela
  if (estado === "sugerida") return "Clica em “Gerar mapa”, em cima da conversa";
  if (estado === "vazia") return "Clica em “Traçar percurso”, em cima da conversa";
  if (estado === "gerando") return "Gerando o mapa… ⏳ leva uns segundos, pode esperar aqui";
  if (estado === "ativa") return "Pronto! 🎉 Clica em “Ver mapa” pra abrir";
  return padrao;
}

/**
 * #626: o ÚLTIMO estado do botão do percurso fica guardado aqui. O chat avisa quando ele muda, mas monta ANTES do
 * tour — o 1º aviso (ex.: um estudo que já tem mapa, "Ver mapa") se perdia e o cartão mandava gerar de novo.
 */
let estadoPercurso: EstadoBolinha | null = null;
export const estadoPercursoAtual = (): EstadoBolinha | null => estadoPercurso;
export function avisarEstadoPercurso(estado: EstadoBolinha): void {
  estadoPercurso = estado;
  try { window.dispatchEvent(new CustomEvent(EVT_PERCURSO_ESTADO, { detail: estado })); } catch { /* sem janela */ }
}

// v2: o roteiro novo — quem só viu o passeio antigo (v1) ganha o novo uma vez
const CHAVE = CHAVE_LOCAL.sala;   // "zaeon.tour.sala.v2" (#629: a conta guarda também — lib/onboarding/vistosConta)
/** #613: "Rever tutorial do laboratório" (Configurações) */
export const esquecerTourSala = () => { try { localStorage.removeItem(CHAVE); } catch { /* ignore */ } };
export const tourSalaVisto = (): boolean => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; } };
/** `geracao`: a do começo do tour — se a pessoa pediu "Rever tutorial" depois (noutra aba), não marca */
export const marcarTourSalaVisto = (geracao?: string) => {
  if (!geracaoValida(geracao)) return;
  try { localStorage.setItem(CHAVE, "1"); } catch { /* ignore */ }
  salvarVistoNaConta("sala");
  try { void fetch("/api/onboard/tour", { method: "POST" }).catch(() => {}); } catch { /* sem rede */ }
};
/** mostra o tour? Nunca no tutorial (a missão tem o tour dela), nunca no celular (a sidebar some), uma vez só */
export const deveMostrarTourSala = (o: { noTutorial: boolean; largura: number; visto: boolean; outroTour: boolean }) =>
  !o.noTutorial && !o.visto && !o.outroTour && o.largura >= 768;

/** um tour do laboratório está na tela agora (o do Escritório espera ele acabar) */
let tourNaTela = false;
export const tourDoLabAtivo = () => tourNaTela;
export const marcarTourDoLabAtivo = (v: boolean) => { tourNaTela = v; };
