/**
 * lib/tcc/latexTexto.ts — fórmula e reação química em TEXTO LEGÍVEL pro .docx/.pdf do motor ABNT.
 *
 * O editor mostra as fórmulas em KaTeX, mas o motor (abnt-service, python-docx) escreve texto: sem isto o
 * Word recebia "$\frac{a}{b}$" e "$\ce{H2O}$" crus. Aqui cada trecho de matemática do conteúdo
 * ($…$, $$…$$, \(…\), \[…\]) vira Unicode: H₂O, CO₂, 2H₂ + O₂ → 2H₂O, x², α, ×, ≤, √(x), (a)/(b)…
 * Fora das fórmulas nada muda. Puro.
 */
import { segmentarBlocos, segmentarInline } from "@/lib/chat/matematica";

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ", k: "ₖ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", x: "ₓ" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", x: "ˣ", y: "ʸ", a: "ᵃ", b: "ᵇ", c: "ᶜ", d: "ᵈ", e: "ᵉ", k: "ᵏ", m: "ᵐ", t: "ᵗ", T: "ᵀ" };

const SIMBOLOS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "·", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈",
  equiv: "≡", sim: "∼", propto: "∝", infty: "∞", partial: "∂", nabla: "∇", sum: "∑", prod: "∏", int: "∫", oint: "∮",
  rightarrow: "→", to: "→", leftarrow: "←", Rightarrow: "⇒", Leftarrow: "⇐", leftrightarrow: "↔", Leftrightarrow: "⇔",
  rightleftharpoons: "⇌", uparrow: "↑", downarrow: "↓", degree: "°", circ: "°", in: "∈", notin: "∉", subset: "⊂",
  subseteq: "⊆", cup: "∪", cap: "∩", forall: "∀", exists: "∃", ldots: "…", cdots: "⋯", dots: "…", angle: "∠", perp: "⊥",
  therefore: "∴", quad: " ", qquad: "  ", ",": " ", ";": " ", "!": "", " ": " ", "%": "%", "{": "{", "}": "}", "_": "_", "$": "$",
};

/** Lê `{…}` balanceado a partir de `i` (que aponta pro `{`); devolve o miolo e o índice depois do `}`. */
function grupo(s: string, i: number): [string, number] {
  if (s[i] === "\\") { const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)); const n = m ? m[0].length : 1; return [s.slice(i, i + n), i + n]; } // ^\circ
  if (s[i] !== "{") return [s[i] ?? "", i + 1];
  let nivel = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") nivel++;
    else if (s[j] === "}" && --nivel === 0) return [s.slice(i + 1, j), j + 1];
  }
  return [s.slice(i + 1), s.length];
}

const mapear = (t: string, tabela: Record<string, string>, marca: string) =>
  [...t].every((c) => tabela[c] !== undefined) ? [...t].map((c) => tabela[c]).join("") : `${marca}(${t})`;
const precisaParen = (t: string) => t.length > 1 && !/^[\w.,]+$/.test(t);

/** Uma fórmula LaTeX (sem os delimitadores) em texto Unicode. */
export function latexParaTexto(latex: string): string {
  const s = latex.trim();
  let out = "";
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const cmd = m ? m[1] : "";
      i += 1 + cmd.length;
      if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
        const [a, j] = grupo(s, i); const [b, k] = grupo(s, j); i = k;
        const A = latexParaTexto(a), B = latexParaTexto(b);
        out += `${precisaParen(A) ? `(${A})` : A}/${precisaParen(B) ? `(${B})` : B}`;
      } else if (cmd === "sqrt") {
        const [a, j] = grupo(s, i); i = j; out += `√(${latexParaTexto(a)})`;
      } else if (cmd === "ce" || cmd === "pu") {
        const [a, j] = grupo(s, i); i = j; out += quimicaParaTexto(a);
      } else if (["text", "textrm", "mathrm", "mathbf", "textbf", "mathit", "textit", "operatorname", "mathsf", "boldsymbol", "mbox"].includes(cmd)) {
        const [a, j] = grupo(s, i); i = j; out += cmd.startsWith("text") || cmd === "mbox" ? a : latexParaTexto(a);
      } else if (["left", "right", "big", "Big", "bigl", "bigr", "displaystyle", "limits"].includes(cmd)) {
        // tamanho de delimitador: some (o delimitador em si vem logo depois)
      } else if (SIMBOLOS[cmd] !== undefined) {
        out += SIMBOLOS[cmd];
        // como no LaTeX, o espaço depois de um comando-LETRA some ("\Delta G" = ΔG); operador mantém ("a \times b")
        if (/^[A-Za-z]+$/.test(cmd) && /^[A-Za-zΑ-ω]$/.test(SIMBOLOS[cmd])) while (s[i] === " ") i++;
      } else if (["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min", "det"].includes(cmd)) {
        out += cmd;
      } else {
        out += cmd; // comando desconhecido: o nome é melhor que nada (e nunca a barra solta)
      }
    } else if (c === "^" || c === "_") {
      const [a, j] = grupo(s, i + 1); i = j;
      const t = latexParaTexto(a);
      out += c === "^" ? (t === "°" || t === "∘" ? "°" : mapear(t, SUP, "^")) : mapear(t, SUB, "_");
    } else if (c === "{" || c === "}") {
      i++;
    } else if (c === "~") {
      out += " "; i++;
    } else {
      out += c; i++;
    }
  }
  return out.replace(/[ \t]{2,}/g, " ");
}

/** Notação do mhchem (\ce{…}) em texto: números depois de elemento viram subscrito, cargas sobrescrito, setas. */
export function quimicaParaTexto(ce: string): string {
  let t = ce.trim()
    .replace(/<=>|<->/g, " ⇌ ").replace(/->/g, " → ").replace(/<-/g, " ← ")
    .replace(/\^\{?([0-9]*[+-])\}?/g, (_, q: string) => mapear(q, SUP, "^"))
    .replace(/\^\{([^}]*)\}/g, (_, q: string) => mapear(q, SUP, "^"));
  // subscrito: dígitos colados num símbolo de elemento, ) ou ] — o coeficiente do começo ("2H2") fica normal
  t = t.replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, n: string) => a + mapear(n, SUB, "_"));
  return t.replace(/\s{2,}/g, " ").trim();
}

/** O conteúdo inteiro (markdown do trabalho) com toda fórmula/reação em texto legível. */
export function conteudoSemLatex(conteudo: string): string {
  return segmentarBlocos(conteudo).map((b) => {
    if (b.tipo === "formula") return latexParaTexto(b.conteudo);
    if (b.tipo === "grafico") return "";
    if (b.tipo === "codigo") return "```" + b.lang + "\n" + b.conteudo + "\n```";
    return b.conteudo.split("\n").map((linha) =>
      segmentarInline(linha).map((p) => (p.tipo === "formula" ? latexParaTexto(p.conteudo) : p.conteudo)).join(""),
    ).join("\n");
  }).join("");
}
