/**
 * O MESMO material de vidro da navbar do site (Apple liquid glass: translúcido, blur +
 * saturação, borda fina e fio de luz no topo) — esbranquiçado no claro, esfumado no escuro.
 * Uma constante só pra cabeçalho, composer e sheets do app mobile não divergirem dela.
 */
export const VIDRO =
  "backdrop-blur-2xl backdrop-saturate-[1.6] bg-white/50 dark:bg-white/[0.06] " +
  "border-white/60 dark:border-white/[0.12] " +
  "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.28)]";

/** Alvo de toque mínimo (WCAG 2.5.5 / HIG): 44×44. */
export const ALVO = "min-h-[44px] min-w-[44px]";

/** Foco visível em todo controle (teclado/leitor de tela). */
export const FOCO = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500";
