/** Nome de usuário (como a pessoa aparece no cyberespaço) — regras PURAS, testáveis. */
export const NOME_MIN = 3;
export const NOME_MAX = 30;
// letras (com acento), números, espaço, ponto, hífen, sublinhado
const PERMITIDOS = /^[\p{L}\p{N} ._-]+$/u;

export type ResultadoNome = { ok: true; nome: string } | { ok: false; erro: string };

export function validarNome(bruto: unknown): ResultadoNome {
  if (typeof bruto !== "string") return { ok: false, erro: "Escolha um nome." };
  const nome = bruto.normalize("NFC").replace(/\s+/g, " ").trim();
  if (nome.length < NOME_MIN) return { ok: false, erro: `Use pelo menos ${NOME_MIN} caracteres.` };
  if (nome.length > NOME_MAX) return { ok: false, erro: `Use no máximo ${NOME_MAX} caracteres.` };
  if (!PERMITIDOS.test(nome)) return { ok: false, erro: "Use só letras, números, espaço, ponto, hífen ou sublinhado." };
  return { ok: true, nome };
}
