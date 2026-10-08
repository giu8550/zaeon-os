/**
 * lib/mentores/rota.ts — PR-A2: "Loja de Plugins/Assistentes" → **Mentores**, atrás de NEXT_PUBLIC_MENTORES_TAB
 * (build-arg: Dockerfile + compose + deploy.yml). Flag off = tudo como hoje (diff visual zero).
 * Um helper só, pra navbar/footer/MentorPill/admin não repetirem o `if`.
 */
const on = (v: unknown) => ["on", "1", "true"].includes(String(v ?? "").toLowerCase());

/** A aba "Mentores" está ligada? (NEXT_PUBLIC_* é inlinado no build; no servidor vale igual.) */
export const mentoresTab = (env: Record<string, string | undefined> = process.env): boolean => on(env.NEXT_PUBLIC_MENTORES_TAB);

export const ROTA_LOJA_ANTIGA = "/plugin-store";
export const ROTA_MENTORES = "/mentores";

/** href da loja para um link que quer voltar pra `from` depois. */
export function lojaHref(from?: string | null, flag: boolean = mentoresTab()): string {
  const base = flag ? ROTA_MENTORES : ROTA_LOJA_ANTIGA;
  return from ? `${base}?from=${from}` : base;
}
export const lojaLabel = (flag: boolean = mentoresTab()): string => (flag ? "Mentores" : "Assistentes");
export const adminLabelPlugins = (flag: boolean = mentoresTab()): string => (flag ? "Mentores · catálogo" : "Plugins");

/** PURO: pra onde /plugin-store manda quando a flag está on (preserva a query, ex.: ?from=). null = não redireciona. */
export function destinoDaLoja(flag: boolean, search: string): string | null {
  if (!flag) return null;
  const q = (search ?? "").replace(/^\?/, "");
  return q ? `${ROTA_MENTORES}?${q}` : ROTA_MENTORES;
}

/** PURO: ordem das categorias da loja — com a flag, "Mentores" vem primeiro e é o default. */
export function categoriasLoja(flag: boolean = mentoresTab()): { categorias: string[]; padrao: string } {
  return flag
    ? { categorias: ["Mentores", "Todos", "Essencial", "Agentes"], padrao: "Mentores" }
    : { categorias: ["Todos", "Essencial", "Agentes", "Mentores"], padrao: "Todos" };
}
