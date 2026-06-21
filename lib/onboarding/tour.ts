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
  { id: "hello", say: "Bom dia! ☀️ Eu sou a Zaeon. Que honra te receber por aqui — já vejo um baita potencial em você. Em uns 2 minutinhos eu te mostro como a gente vai desbloquear uma fase nova nos seus estudos. Bora?", cta: "Bora!" },
  { id: "estudos", say: "Tudo começa nos seus Estudos. Clica em **Estudos** aqui na lateral. 👇", target: '[data-tour="estudos"]', clickTarget: true, tab: "sala-de-estudos" },
  { id: "pesquisar", say: "Esse é o meu coração 💜. Digita aqui um assunto que você quer dominar e aperta Enter — eu pesquiso e escrevo um estudo inteiro pra você.", target: '[data-academic-input="true"]', cta: "Vou pesquisar" },
  { id: "voz", say: "Enquanto eu escrevo, posso te fazer companhia por voz — sim, eu converso de verdade! 😄 Me conta: o que te trouxe até aqui hoje?", cta: "Continuar" },
  { id: "resultado", say: "Quando o estudo ficar pronto, dá uma olhada nas **Referências**, nos **Insights** e na **Base**. Salva pelo menos 1 referência e uns 2 trabalhos — vão te servir já já.", cta: "Salvei" },
  { id: "gerar", say: "Tá vendo o botão **Gerar pesquisa**? Ele transforma seu estudo num esboço de verdade (introdução, metodologia...). Clica nele e depois em **Iniciar pesquisa**.", cta: "Feito" },
  { id: "pesquisa", say: "Agora a **Sala de Pesquisa** — é onde você escreve o trabalho. No painel da direita ficam seus **Documentos, Citações e Lixeira**.", target: '[data-tour="pesquisa"]', clickTarget: true, tab: "pesquisa" },
  { id: "ferramentas", say: "Dá **play** num documento pra ler; arraste um sobre o outro que eu **comparo** os dois; ou jogue no painel pra ler na ordem certa. As **pastas** organizam tudo, e a **lixeira** guarda o que você apagar.", cta: "Entendi" },
  { id: "tipo", say: "Lá em cima você troca entre **TCC, Artigo e Relatório** — cada um é uma sessão própria. Te ensino mais quando você for salvar ou publicar. 😉", cta: "Show" },
  { id: "lounge", say: "Última missão: vai no **Lounge** e cria uma pesquisa **em conjunto** pra compartilhar com um amigo. Aprender junto é muito mais leve. ✦ Quando precisar, é só me chamar aqui no cantinho. Boa jornada!", target: '[data-tour="lounge"]', clickTarget: true, tab: "lounge", cta: "Concluir" },
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
