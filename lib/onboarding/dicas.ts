/**
 * #618 · DICAS RÁPIDAS: no lugar de mais um tour com vários passos (cansativo), um balão por vez, só na 1ª vez que a
 * pessoa entra num lugar, com "Entendi". Sem "Passo X de Y", sem travar a tela. O cartão é o mesmo dos tours
 * (components/onboard/BalaoTour, modo `dica`); o "Rever tutorial" das Configurações traz elas de volta.
 */
export type Dica = { alvo: string; texto: string };

/** o Perfil: a foto troca clicando NELA; "Editar" muda nome e curso; a skin tem botão (menos pra quem é fundador) */
export function dicasDoPerfil(o: { fundador: boolean }): Dica[] {
  return [
    { alvo: '[data-tour="perfil-habilidades"]',
      texto: "Aqui ficam as tuas habilidades e o que você está trabalhando. Essa parte aparece pra quem abre o teu perfil." },
    // #629: UMA coisa por dica, apontando pro lugar dela (a de antes apontava a foto e falava de três coisas)
    { alvo: '[data-tour="perfil-foto"]', texto: "Clica na tua foto pra trocar." },
    { alvo: '[data-tour="perfil-editar"]', texto: "Aqui você muda o nome e o curso." },
    ...(o.fundador ? [] : [{ alvo: '[data-tour="perfil-skin"]', texto: "E aqui você troca o visual do teu personagem. 💜" }]),
  ];
}
export const DICAS_PERFIL = dicasDoPerfil({ fundador: false });

/** a Sala de Estudos = os BLUEPRINTS (components/blueprint/SalaBlueprint): só aparecem com um blueprint na tela */
// #629: cada dica aponta UMA coisa da tela (as de antes falavam de fases e críticos sem mostrar onde ficam);
// a que não estiver na tela (um blueprint sem crítico) é pulada
export const DICAS_SALA: Dica[] = [
  { alvo: '[data-tour="blueprint-lista"]', texto: "Cada conversa que vira estudo ganha um blueprint aqui. Clica num pra abrir." },
  { alvo: '[data-tour="blueprint-fases"]', texto: "Essas barrinhas são as 4 fases: Fundamento, Prova de conceito, Produto e Final. A que está acesa é onde você está." },
  { alvo: '[data-tour="blueprint-prancha"]', texto: "Esse é o teu estudo montado como uma máquina: cada peça é um pedaço do assunto. Passa o mouse pra desmontar, clica pra fixar." },
  { alvo: '[data-tour="blueprint-critico"]', texto: "Os críticos travam a fase. Manda a prova (o link do que você fez) e a Zaeon avalia. 🚀" },
  { alvo: '[data-tour="blueprint-legenda"]', texto: "E aqui as cores dos fios: percurso, prática e crítico." },
];

/** os lugares com dicas (o "Rever tutorial" esquece todos) */
export const LUGARES_COM_DICAS = ["perfil", "sala-estudos"] as const;
const chave = (lugar: string) => `zaeon.dica.${lugar}.v1`;
export const dicasVistas = (lugar: string): boolean => { try { return localStorage.getItem(chave(lugar)) === "1"; } catch { return true; } };
export const marcarDicasVistas = (lugar: string) => { try { localStorage.setItem(chave(lugar), "1"); } catch { /* ignore */ } };
export const esquecerDicas = () => { for (const l of LUGARES_COM_DICAS) { try { localStorage.removeItem(chave(l)); } catch { /* ignore */ } } };
/** uma dica está na tela agora (o tour da sala e o do Escritório esperam ela fechar — os dois não disputam a tela) */
let dicaNaTela = false;
export const dicaAtiva = () => dicaNaTela;
export const marcarDicaAtiva = (v: boolean) => { dicaNaTela = v; };
/** mostra? Uma vez, no computador (o cartão é dos tours, que não existem no celular), sem um tour na tela */
export const deveMostrarDicas = (o: { visto: boolean; largura: number; outroTour: boolean }) => !o.visto && !o.outroTour && o.largura >= 768;
