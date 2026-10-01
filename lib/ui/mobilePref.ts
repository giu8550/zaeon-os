/**
 * Regras da versão mobile (/m) — PURAS, testáveis. A preferência mora no cookie
 * `zaeon:ui` = "mobile" | "full"; nunca prendemos ninguém: dá pra alternar dos dois lados.
 */
export const COOKIE_UI = "zaeon:ui";
export type PrefUI = "mobile" | "full";
export const mobileUiOn = () => process.env.NEXT_PUBLIC_MOBILE_UI === "1";

/** Salas completas onde faz sentido OFERECER (nunca forçar) a versão mobile. */
const SALAS = ["/research-lab", "/workstation"];
export const ehSalaCompleta = (path: string | null | undefined) => !!path && SALAS.some((s) => path === s || path.startsWith(s + "/"));
export const ehRotaMobile = (path: string | null | undefined) => !!path && (path === "/m" || path.startsWith("/m/"));

export function lerPref(cookie: string): PrefUI | null {
  for (const parte of cookie.split(";")) {
    const [k, v] = parte.trim().split("=");
    if (decodeURIComponent(k ?? "") === COOKIE_UI) return v === "mobile" || v === "full" ? v : null;
  }
  return null;
}

/** Linha de Set-Cookie do lado cliente: 1 ano, raiz, sem dado sensível. */
export const cookiePref = (p: PrefUI) => `${encodeURIComponent(COOKIE_UI)}=${p}; path=/; max-age=31536000; samesite=lax`;

/** Mostrar o banner "Abrir versão mobile"? Só no celular, em sala completa, se a pessoa não escolheu "full". */
export function deveOferecerMobile(o: { flag: boolean; path: string | null | undefined; ehMobile: boolean; pref: PrefUI | null }): boolean {
  return o.flag && o.ehMobile && ehSalaCompleta(o.path) && o.pref !== "full";
}

/** Destino mobile equivalente à sala aberta. */
export function destinoMobile(path: string | null | undefined, search = ""): string {
  if (!path) return "/m";
  if (path.startsWith("/research-lab") && /tab=pesquisa\b/.test(search)) return "/m/pesquisa";
  if (path.startsWith("/research-lab")) return "/m/estudos";
  return "/m";
}
