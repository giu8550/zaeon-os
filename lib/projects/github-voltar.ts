/**
 * Para onde o OAuth do GitHub volta. Padrão: a sala Projetos (como sempre foi). O Octa começa o OAuth com
 * `?voltar=/octa/github` (a janelinha que avisa a IDE e se fecha). Só caminhos INTERNOS desta lista valem —
 * comparação exata, então nada de `//host`, `https://`, `..`, query ou hash (open-redirect safe).
 */
export const VOLTAS_PERMITIDAS: readonly string[] = ["/octa/github"];
export const COOKIE_VOLTAR = "gh_oauth_voltar";

export function voltarPermitido(v: unknown): string | null {
  return typeof v === "string" && VOLTAS_PERMITIDAS.includes(v) ? v : null;
}

/** URL absoluta de volta na base do app, com `gh=<motivo>`. Volta inválida → sala Projetos. */
export function urlDeVolta(base: string, voltar: unknown, motivo: string): URL {
  const v = voltarPermitido(voltar);
  const u = new URL(v ?? "/research-lab?tab=projetos", base);
  u.searchParams.set("gh", motivo);
  return u;
}
