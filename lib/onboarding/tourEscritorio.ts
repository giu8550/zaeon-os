/**
 * O TOUR DO ESCRITÓRIO (out/2026): o Escritório não tinha tutorial. Na 1ª vez que a pessoa abre a aba Escritório do
 * laboratório, a Aura mostra o canal da turma, os agentes (chamar com @) e o convite — com a mesma estética do tour da
 * sala (components/onboard/BalaoTour). Só explicação: cada passo anda no botão; Pular/Esc encerra. Dois roteiros: o
 * do Escritório-canal (coworking, NEXT_PUBLIC_ESCRITORIO_COWORK) e o do 3D antigo. Uma vez por navegador.
 */
export type PassoEscritorio = { id: string; dica: string; fala: string; alvos: string[]; cta: string };

export const PASSOS_ESCRITORIO: PassoEscritorio[] = [
  { id: "canal", alvos: ['[data-tour="escritorio-canal"]'], cta: "Próximo",
    dica: "🏢 O Escritório da turma",
    fala: "Este é o Escritório: um canal onde a tua turma e os agentes da Zaeon trabalham juntos, em tempo real. Tudo que alguém manda aqui, todo mundo vê." },
  { id: "agentes", alvos: ['[data-tour="escritorio-agentes"]'], cta: "Próximo",
    dica: "🤖 Chame um agente com @",
    fala: "Aqui ficam os agentes. Toca num deles (ou escreve @ e o nome) pra convocar — ele responde aqui no canal, com o nome e o rosto dele." },
  { id: "escrever", alvos: ['[data-tour="escritorio-composer"]'], cta: "Próximo",
    dica: "💬 Escreva pra turma",
    fala: "É aqui que você escreve. Sem @, a mensagem vai pra turma; com @agente, o agente entra na conversa." },
  { id: "convidar", alvos: ['[data-tour="escritorio-pessoas"]'], cta: "Bora trabalhar! 🚀",
    dica: "🤝 Chame a turma",
    fala: "Em cima ficam as pessoas do canal e os convites. Chama a turma pra estudar junto — o Escritório fica melhor cheio. 💜" },
];

/** o Escritório 3D antigo (sem o canal): a sala com os agentes e os departamentos */
export const PASSOS_ESCRITORIO_3D: PassoEscritorio[] = [
  { id: "sala", alvos: ['[data-tour="escritorio-3d"]'], cta: "Próximo",
    dica: "🏢 O Escritório dos agentes",
    fala: "Este é o Escritório: os agentes da Zaeon como um lugar. Cada mesa é um agente — ela acende quando ele está trabalhando numa resposta pra você." },
  { id: "departamentos", alvos: ['[data-tour="escritorio-departamentos"]'], cta: "Bora trabalhar! 🚀",
    dica: "🗂️ Os agentes por departamento",
    fala: "Aqui eles estão organizados por departamento. Toca num agente pra ver o que ele entrega e falar com ele — eu te levo pro chat já com ele escolhido. 💜" },
];

export const passosDoEscritorio = (cowork: boolean): PassoEscritorio[] => (cowork ? PASSOS_ESCRITORIO : PASSOS_ESCRITORIO_3D);

const CHAVE = "zaeon.tour.escritorio.v1";
export const tourEscritorioVisto = (): boolean => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return true; } };
export const marcarTourEscritorioVisto = () => { try { localStorage.setItem(CHAVE, "1"); } catch { /* ignore */ } };
/** mostra? Só com a aba Escritório na tela, uma vez, fora do tutorial, sem outro tour rodando e nunca no celular */
export const deveMostrarTourEscritorio = (o: { naAba: boolean; noTutorial: boolean; largura: number; visto: boolean; outroTour: boolean }) =>
  o.naAba && !o.noTutorial && !o.visto && !o.outroTour && o.largura >= 768;
