"use client";

/**
 * Tour guiado da Zaeon (onboarding). Roteiro DECLARATIVO: a Zaeon "puxa assunto" no
 * chat widget (autonomia), enquanto o overlay destaca o elemento da vez. Golden path:
 * Estudos → pesquisar → resultado → gerar pesquisa → Sala de Pesquisa → Lounge.
 *
 * Estado em memória + localStorage; ao concluir/pular, marca no servidor
 * (/api/onboard/tour → User.tourDone, visível no dashboard) — uma vez por usuário.
 */
export type TourStep = {
  id: string;
  say: string;               // fala da Zaeon (vai pro chat widget)
  target?: string;           // seletor do elemento a destacar (coachmark)
  cta?: string;              // rótulo do botão de avançar
  clickTarget?: boolean;     // avança ao clicar no próprio elemento destacado
  tab?: string;              // garante a aba certa (dispara zaeon:set-tab)
};

export const TOUR_STEPS: TourStep[] = [
  // — Abertura: a Zaeon puxa assunto e se apresenta
  { id: "hello", say: "Bom dia! ☀️ Eu sou a Zaeon. Que honra te receber — já vejo um baita potencial em você. Em uns 2 minutinhos eu te mostro tudo e a gente desbloqueia uma fase nova nos seus estudos. Bora? (E pode falar comigo por voz a qualquer hora — é só me chamar aqui no cantinho.)", cta: "Bora!" },

  // — Sala de Estudos: caderno + biblioteca + pesquisa (estudo)
  { id: "estudos", say: "Tudo começa nos seus **Estudos**. Clica em Estudos aqui na lateral. 👇", target: '[data-tour="estudos"]', clickTarget: true, tab: "sala-de-estudos" },
  { id: "caderno", say: "Esta é a **Sala de Estudos** — um caderno vivo. Você escreve em blocos (título, subtítulo, texto), arrasta itens da sua **biblioteca** pra dentro e pode ouvir tudo em voz.", cta: "Legal" },
  { id: "pesquisar", say: "E o atalho mágico 💜: digita aqui um assunto que você quer dominar e aperta **Enter** — eu pesquiso e escrevo um estudo inteiro pra você.", target: '[data-academic-input="true"]', cta: "Vou pesquisar" },
  { id: "voz", say: "Enquanto eu escrevo, te faço companhia por **voz** — sim, eu converso de verdade! 😄 Me conta: o que te trouxe até aqui hoje?", cta: "Continuar" },
  { id: "resultado", say: "Quando o estudo ficar pronto, olha as abas **Referências**, **Insights** e **Base**. Salva pelo menos **1 referência** e uns **2 trabalhos** — vão te servir já já.", cta: "Salvei" },
  { id: "gerar", say: "Tá vendo o botão **Gerar pesquisa** logo abaixo da barra? Ele transforma seu estudo num esboço de verdade (introdução, metodologia, lacuna...). Clica nele e depois em **Iniciar pesquisa**.", cta: "Feito" },

  // — Sala de Pesquisa: cada ferramenta, bem aos poucos
  { id: "pesquisa", say: "Agora a **Sala de Pesquisa** — é onde você escreve o trabalho de verdade. Clica aqui. 👇", target: '[data-tour="pesquisa"]', clickTarget: true, tab: "pesquisa" },
  { id: "play", say: "No painel da direita ficam **os seus documentos**. Dá um **play** num deles pra ouvir/ler com calma.", cta: "Entendi" },
  { id: "comparar", say: "Quer cruzar ideias? **Arraste um documento sobre o outro** que eu **comparo** os dois e te entrego um resumo da relação.", cta: "Boa" },
  { id: "painel", say: "Pra estudar em sequência, **jogue documentos no painel** e leia na ordem. E organize tudo em **pastas** pra não se perder.", cta: "Show" },
  { id: "citacoes", say: "Salvou um trecho? Ele vira **citação em ABNT** — clica pra inserir no texto no ponto do cursor. O que você apagar vai pra **lixeira** (dá pra restaurar).", cta: "Perfeito" },
  { id: "tipo", say: "Lá em cima você troca entre **TCC, Artigo e Relatório** — cada um é uma sessão própria de escrita. Te ensino o resto (salvar/publicar em ABNT) quando você chegar lá. 😉", cta: "Entendi" },

  // — Lounge: missão final, em grupo
  { id: "lounge", say: "Última missão ✦: vai no **Lounge** e cria um estudo ou pesquisa **em conjunto** pra compartilhar com um amigo — aprender junto é muito mais leve. Quando precisar, é só me chamar. Boa jornada! 🚀", target: '[data-tour="lounge"]', clickTarget: true, tab: "lounge", cta: "Concluir" },
];

type TourState = { active: boolean; index: number };
let state: TourState = { active: false, index: 0 };
const subs = new Set<(s: TourState) => void>();
const emit = () => subs.forEach((f) => f(state));

export function getTour(): TourState { return state; }
export function subscribeTour(cb: (s: TourState) => void) { subs.add(cb); cb(state); return () => { subs.delete(cb); }; }

function persist() { try { localStorage.setItem("zaeon.tour", JSON.stringify(state)); } catch { /* */ } }

function sayCurrent() {
  const s = TOUR_STEPS[state.index];
  if (!s) return;
  if (s.tab) { try { window.dispatchEvent(new CustomEvent("zaeon:set-tab", { detail: s.tab })); } catch { /* */ } }
  try { window.dispatchEvent(new CustomEvent("zaeon:onboard:say", { detail: s.say })); } catch { /* */ }
}

export function startTour() {
  if (typeof window === "undefined") return;
  state = { active: true, index: 0 };
  persist(); emit();
  setTimeout(sayCurrent, 400); // deixa o chat widget montar
}

export function nextTour() {
  if (state.index + 1 >= TOUR_STEPS.length) { finishTour(); return; }
  state = { active: true, index: state.index + 1 };
  persist(); emit(); sayCurrent();
}

export function skipTour() { finishTour(); }

export function finishTour() {
  state = { active: false, index: 0 };
  persist(); emit();
  try { localStorage.setItem("zaeon.tourDone", "1"); } catch { /* */ }
  try { fetch("/api/onboard/tour", { method: "POST" }); } catch { /* */ }
}
