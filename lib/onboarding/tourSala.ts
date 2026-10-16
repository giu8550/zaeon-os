/**
 * O TOUR DA SALA (out/2026): a 1ª vez que a pessoa abre o laboratório FORA do tutorial do tablet, o Droid mostra a sala
 * inteira — o chat da Aura, a Sala de Estudos, o Marketplace (a pesquisa a fundo), as referências na bandeja, a Sala de
 * Pesquisa e, com mais detalhe, as CITAÇÕES. A 1ª missão (lib/onboarding/tutorialLab) mostra só o caminho de gerar a
 * pesquisa; o resto fica pra cá. Só "ver": cada passo anda no Próximo; pular/concluir marca como visto (neste navegador).
 */
import type { AbaEstudos } from "@/lib/chat/conversasNav";

export type PassoSala = {
  id: string;
  /** o que o Droid diz */
  fala: string;
  /** onde fica o destaque (o 1º seletor que existir na tela) */
  alvos: string[];
  /** antes de mostrar, o laboratório vai pra esta sala (e sub-aba / vista do Marketplace) */
  ir?: { tab: "sala-de-estudos" | "pesquisa"; aba?: AbaEstudos; vista?: "vitrine" | "pesquisar" };
};

export const PASSOS_SALA: PassoSala[] = [
  { id: "aura", ir: { tab: "sala-de-estudos", aba: "meus-estudos" }, alvos: ['[data-tour="estudos"]'],
    fala: "Bora conhecer a sala inteira? Este é o chat da Aura: pergunte, peça uma aula, um resumo ou um diagrama. Cada conversa fica guardada logo abaixo." },
  { id: "sala-de-estudos", ir: { tab: "sala-de-estudos", aba: "feed" }, alvos: ['[data-tour="tab-feed"]'],
    fala: "A Sala de Estudos é o seu QUADRO: monte o estudo em seções, notas e perguntas — o blueprint do que você está aprendendo. Dá até pra chamar gente pra estudar junto." },
  { id: "marketplace", ir: { tab: "sala-de-estudos", aba: "community", vista: "vitrine" }, alvos: ['[data-tour="tab-community"]'],
    fala: "O Marketplace é a vitrine: aqui conhecimento vira PRODUTO, e vale ZAEON. Em “pesquisar na literatura” fica a pesquisa a fundo — a IA busca artigos científicos de verdade sobre o seu tema." },
  { id: "referencias", ir: { tab: "sala-de-estudos", aba: "community", vista: "pesquisar" }, alvos: ['[data-tour="bandeja"]', '[data-tour="omega"]'],
    fala: "Em cada resultado, “Salvar” guarda a REFERÊNCIA completa — autor, título, ano e DOI — nesta BANDEJA de fontes. É dela que nasce a pesquisa gerada, e cada fonte vira citação em ABNT." },
  { id: "sala-de-pesquisa", ir: { tab: "pesquisa" }, alvos: ['[data-tour="pasta-conversa"]', '[data-tour="docs-panel"]', '[data-tour="pesquisa"]'],
    fala: "Na Sala de Pesquisa o texto ganha forma. O chat te ajuda a escrever e aprofundar, e um PDF arrastado pro painel abre pra ler (ou ouvir)." },
  { id: "citacoes", ir: { tab: "pesquisa" }, alvos: ['[data-tour="dock"]', '[data-tour="docs-panel"]', '[data-tour="pesquisa"]'],
    fala: "CITAÇÕES: selecione um trecho do PDF e cite — ela já vem em ABNT, com autor, ano e página. No 🔖 ficam as salvas: arraste pro texto e ela entra no lugar certo. Sinal vermelho = sem fonte válida; clique em “Creditar fonte”." },
  { id: "salvar", ir: { tab: "pesquisa" }, alvos: ['[data-tour="salvar-pesquisa"]', '[data-tour="pesquisa"]'],
    fala: "Pronto pra entregar? “Salvar” exporta em ABNT (PDF ou DOCX) e guarda nas suas pesquisas. É isso — bons estudos! ✦" },
];

const CHAVE = "zaeon.tour.sala.v1";
export const tourSalaVisto = (): boolean => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; } };
export const marcarTourSalaVisto = () => { try { localStorage.setItem(CHAVE, "1"); } catch { /* ignore */ } };
/** mostra o tour? Nunca no tutorial (a missão tem o tour dela), nunca no celular (a sidebar some), uma vez só */
export const deveMostrarTourSala = (o: { noTutorial: boolean; largura: number; visto: boolean; outroTour: boolean }) =>
  !o.noTutorial && !o.visto && !o.outroTour && o.largura >= 768;
