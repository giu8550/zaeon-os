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
/** o botão de enviar do chat é um ↑ (CoworkComposer) — o texto usa o MESMO símbolo */
export const TAREFA_ENVIAR = "Agora é só apertar ↑ ou Enter";
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
    avancaEm: [{ evento: EVT_PERCURSO_ABERTO }],
    suaVez: "Clica no ✦ pra gerar; pronto, clica de novo pra abrir o mapa",
    dica: "✦ Gere o percurso e abra o mapa",
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
  if (estado === "gerando") return "Gerando o teu percurso… ⏳ leva uns segundos, pode esperar aqui";
  if (estado === "ativa") return "Pronto! 🎉 Clica no ✦ de novo pra abrir o mapa";
  return padrao;
}

// v2: o roteiro novo — quem só viu o passeio antigo (v1) ganha o novo uma vez
const CHAVE = "zaeon.tour.sala.v2";
/** #613: "Rever tutorial do laboratório" (Configurações) */
export const esquecerTourSala = () => { try { localStorage.removeItem(CHAVE); } catch { /* ignore */ } };
export const tourSalaVisto = (): boolean => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; } };
/** `geracao`: a do começo do tour — se a pessoa pediu "Rever tutorial" depois (noutra aba), não marca */
export const marcarTourSalaVisto = (geracao?: string) => {
  if (!geracaoValida(geracao)) return;
  try { localStorage.setItem(CHAVE, "1"); } catch { /* ignore */ }
  try { void fetch("/api/onboard/tour", { method: "POST" }).catch(() => {}); } catch { /* sem rede */ }
};
/** mostra o tour? Nunca no tutorial (a missão tem o tour dela), nunca no celular (a sidebar some), uma vez só */
export const deveMostrarTourSala = (o: { noTutorial: boolean; largura: number; visto: boolean; outroTour: boolean }) =>
  !o.noTutorial && !o.visto && !o.outroTour && o.largura >= 768;

/** um tour do laboratório está na tela agora (o do Escritório espera ele acabar) */
let tourNaTela = false;
export const tourDoLabAtivo = () => tourNaTela;
export const marcarTourDoLabAtivo = (v: boolean) => { tourNaTela = v; };
