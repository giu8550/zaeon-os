/**
 * Cyberespaço (o Lounge Cósmico) como entrada da Zaeon — regras PURAS, testáveis.
 * Sem flag: vai direto pra produção. O nome visível é "cyberespaço"; a rota segue /lounge-cosmico.
 */
export const LOUNGE_ROTA = "/lounge-cosmico";
export const LAB_ROTA = "/research-lab";
/** Contrato cyberespaço → laboratório (postMessage vindo do cosmic-map.html). */
export const MSG_ENTRAR_ESTUDO = "zaeon:enter-study";
/** O cyberespaço avisa que a sessão começou (clicou numa opção do monitor ou segurou ESPAÇO). */
export const MSG_SESSAO_INICIADA = "zaeon:menu";

/** Rota imersiva: sem navbar/rodapé globais (a cena ocupa a tela toda). */
export const ehRotaImersiva = (path: string | null | undefined) =>
  !!path && (path === LOUNGE_ROTA || path.startsWith(LOUNGE_ROTA + "/"));

const temTipo = (data: unknown, tipo: string) =>
  !!data && typeof data === "object" && (data as { type?: unknown }).type === tipo;

export const ehMsgEntrarEstudo = (data: unknown): boolean => temTipo(data, MSG_ENTRAR_ESTUDO);
export const ehMsgSessaoIniciada = (data: unknown): boolean => temTipo(data, MSG_SESSAO_INICIADA);

/** Só aceita mensagem vinda do iframe do próprio cyberespaço (mesma origem). */
export const msgConfiavel = (e: { origin: string; data: unknown }, origem: string): boolean =>
  e.origin === origem && (ehMsgEntrarEstudo(e.data) || ehMsgSessaoIniciada(e.data));

export type CopyEntrada = { cta: string; badges: string[] };
/** Copy do CTA primário e dos badges, por estado de login. */
export function copyEntrada(logado: boolean): CopyEntrada {
  if (logado) return { cta: "✦ Entrar no cyberespaço", badges: [] };
  return { cta: "Criar conta · entrar no cyberespaço", badges: ["Entre no universo", "Sem cartão", "Todas as IAs num lugar só"] };
}
