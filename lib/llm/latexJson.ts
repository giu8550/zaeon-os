/**
 * lib/llm/latexJson.ts — LaTeX que o modelo escreve DENTRO de JSON sem escapar a barra.
 *
 * O modelo devolve `{"body":"a seta $\rightarrow$ e $\frac{a}{b}$"}` com UMA barra. Pro JSON.parse isso é:
 *   \r → retorno de carro ("ightarrow"), \f → form feed ("rac"), \t → tab ("imes"), \b → backspace ("eta"),
 *   \n → quebra de linha ("abla")  — os "caracteres errados" no lugar das fórmulas e das reações químicas;
 *   \c, \D, \s, \a, \l, \m, \p… → escape INVÁLIDO (o JSON inteiro falha e o trabalho some).
 * Antes do parse, `repararLatexNoJson` dobra a barra quando ela é de LaTeX:
 *   - escape inválido (qualquer letra fora de "\/bfnrtu, e \u sem 4 hexas) → sempre;
 *   - \b \f \n \r \t seguidos de um comando LaTeX conhecido (\beta, \frac, \nabla, \rightarrow, \times…) → dobra;
 *     o resto fica como está (`\n` de verdade, "linha\nSegunda", continua quebra de linha).
 * Barras já escapadas (`\\`) não são tocadas. Puro, sem dependência.
 */

/** Comandos LaTeX que começam com b/f/n/r/t (as letras que também são escapes válidos do JSON). A palavra
 *  tem que TERMINAR ali (próximo caractere não é letra): "\numa" (quebra + "uma") não vira "\nu". */
const COMANDOS_AMBIGUOS: Record<string, string[]> = {
  b: ["beta", "bar", "begin", "binom", "bf", "big", "Big", "bigg", "bigl", "bigr", "boldsymbol", "bullet", "bot", "bmod", "bigcup", "bigcap", "backslash", "boxed", "bra"],
  f: ["frac", "forall", "flat", "frak", "fbox"],
  n: ["nabla", "neq", "neg", "nleq", "ngeq", "nexists", "nmid", "nparallel", "nsubseteq", "notin", "newline", "nonumber", "nolimits"],
  r: ["rightarrow", "Rightarrow", "rightleftharpoons", "rho", "right", "rangle", "rceil", "rfloor", "rm", "rbrace", "ref"],
  t: ["times", "text", "textbf", "textit", "textrm", "textsf", "texttt", "textsubscript", "textsuperscript", "theta", "tau", "tan", "tanh", "tilde", "top", "triangle", "tfrac", "therefore", "to", "tag", "tiny", "textdegree"],
};

const VALIDOS = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);
const ehLetra = (c: string | undefined) => !!c && /[A-Za-z]/.test(c);

/** A palavra de letras que começa em `i` (inclusive). */
function palavraEm(s: string, i: number): string {
  let j = i;
  while (j < s.length && ehLetra(s[j])) j++;
  return s.slice(i, j);
}

export function repararLatexNoJson(raw: string): string {
  if (!raw.includes("\\")) return raw;
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== "\\") { out += c; continue; }
    const prox = raw[i + 1];
    if (prox === undefined) { out += c; continue; }
    if (prox === "\\") { out += "\\\\"; i++; continue; } // já escapada: copia o par e pula
    if (!VALIDOS.has(prox)) { out += "\\\\"; continue; } // \cdot, \Delta, \sqrt, \ce… → barra literal
    if (prox === "u") {
      // \u + 4 hexas = escape unicode de verdade; \underline, \uparrow, \upsilon = LaTeX
      if (/^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) { out += c; continue; }
      out += "\\\\"; continue;
    }
    const cmds = COMANDOS_AMBIGUOS[prox];
    if (cmds) {
      const palavra = palavraEm(raw, i + 1);
      if (cmds.includes(palavra)) { out += "\\\\"; continue; }
    }
    out += c; // \n, \t, \", \/ … de verdade
  }
  return out;
}

/** JSON.parse tolerante a LaTeX: repara e parseia; se o reparo ainda falhar, tenta o texto cru (nunca piora). */
export function parseJsonComLatex<T = unknown>(raw: string): T {
  const reparado = repararLatexNoJson(raw);
  try { return JSON.parse(reparado) as T; }
  catch (e) {
    if (reparado === raw) throw e;
    return JSON.parse(raw) as T;
  }
}
