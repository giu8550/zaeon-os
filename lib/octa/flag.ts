/** lib/octa/flag.ts — o Octa Code inteiro fica atrás de NEXT_PUBLIC_OCTA_CODE="1" (valor de BUILD). */
export const OCTA_CODE_LIGADO = process.env.NEXT_PUBLIC_OCTA_CODE === "1";
