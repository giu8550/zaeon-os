/**
 * #427: "Ver perfil" no escritório → a página do laboratório abre a aba Perfil com o perfil daquela pessoa
 * (modo visitante). O escritório só dispara o evento; quem mostra é o app/research-lab/page.tsx.
 */
export const EVT_VER_PERFIL = "zaeon:ver-perfil";

export function abrirPerfil(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  window.dispatchEvent(new CustomEvent(EVT_VER_PERFIL, { detail: { userId } }));
}

/** Lê o id do evento (qualquer outra coisa = nada). */
export function idDoEvento(e: unknown): string | null {
  const id = (e as { detail?: { userId?: unknown } } | null)?.detail?.userId;
  return typeof id === "string" && /^[a-f0-9]{24}$/i.test(id) ? id : null;
}
