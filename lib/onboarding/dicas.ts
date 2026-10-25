/**
 * #618 · DICAS RÁPIDAS: no lugar de mais um tour com vários passos (cansativo), um balão por vez, só na 1ª vez que a
 * pessoa entra num lugar, com "Entendi". Sem "Passo X de Y", sem travar a tela. O cartão é o mesmo dos tours
 * (components/onboard/BalaoTour, modo `dica`); o "Rever tutorial" das Configurações traz elas de volta.
 */
export type Dica = { alvo: string; texto: string };

export const DICAS_PERFIL: Dica[] = [
  { alvo: '[data-tour="perfil-habilidades"]',
    texto: "Aqui ficam as tuas habilidades e o que você ainda está trabalhando. Elas vão se preenchendo conforme você usa a Zaeon — e aparecem pra quem abre o teu perfil." },
  { alvo: '[data-tour="perfil-editar"]',
    texto: "Em “Editar” você troca a foto e o curso. A skin fica no botão embaixo do teu personagem. 💜" },
];

/** os lugares com dicas (o "Rever tutorial" esquece todos) */
export const LUGARES_COM_DICAS = ["perfil"] as const;
const chave = (lugar: string) => `zaeon.dica.${lugar}.v1`;
export const dicasVistas = (lugar: string): boolean => { try { return localStorage.getItem(chave(lugar)) === "1"; } catch { return true; } };
export const marcarDicasVistas = (lugar: string) => { try { localStorage.setItem(chave(lugar), "1"); } catch { /* ignore */ } };
export const esquecerDicas = () => { for (const l of LUGARES_COM_DICAS) { try { localStorage.removeItem(chave(l)); } catch { /* ignore */ } } };
/** mostra? Uma vez, no computador (o cartão é dos tours, que não existem no celular), sem um tour na tela */
export const deveMostrarDicas = (o: { visto: boolean; largura: number; outroTour: boolean }) => !o.visto && !o.outroTour && o.largura >= 768;
