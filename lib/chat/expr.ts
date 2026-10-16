/**
 * lib/chat/expr.ts — expressão de calculadora → função f(x). PURO, SEM eval/new Function.
 *
 * É o que o bloco ```grafico do chat usa para desenhar funções que o MODELO escreveu: por isso
 * é um parser fechado (descida recursiva), com vocabulário fixo — nada do texto vira código.
 *
 *   números (2, 2.5, 1e-3) · x · pi/π · e · + − * / ^ (direita) · unário − · parênteses
 *   funções: sin cos tan asin acos atan sinh cosh tanh sqrt cbrt abs ln log log10 log2 exp floor ceil sign
 *   multiplicação implícita: 2x, 3(x+1), (x+1)(x−1), 2sin(x), xsin(x)
 *   aceita LaTeX leve que o modelo às vezes manda: \cdot, \sin, \pi, \sqrt{…}, \frac{a}{b}, x^{2}
 */
export type Fn = (x: number) => number;

const FUNCOES: Record<string, (v: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sen: Math.sin, tg: Math.tan, arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, sign: Math.sign,
  ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2,
};
const CONSTANTES: Record<string, number> = { pi: Math.PI, "π": Math.PI, e: Math.E, tau: 2 * Math.PI };

/** LaTeX leve → sintaxe de calculadora (o modelo às vezes mistura). */
export function deLatex(src: string): string {
  let s = String(src ?? "");
  // de dentro pra fora: expoente/raiz/fração com chaves internas (\frac{x^{2}}{2})
  for (let i = 0; i < 6; i++) {
    s = s.replace(/\^\s*\{([^{}]*)\}/g, "^($1)")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "(($1)/($2))");
  }
  s = s
    .replace(/\\left|\\right/g, "")
    .replace(/\\(cdot|times)/g, "*")
    .replace(/\\(sin|cos|tan|ln|log|exp|pi|sinh|cosh|tanh|arcsin|arccos|arctan)\b/g, "$1")
    .replace(/[{]/g, "(").replace(/[}]/g, ")")
    .replace(/\*\*/g, "^")
    .replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3");
  // "y =" / "f(x) =" na frente
  s = s.replace(/^\s*(?:y|[a-z]\s*\(\s*x\s*\))\s*=\s*/i, "");
  return s.trim();
}

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string } | { t: "(" } | { t: ")" };

function tokenizar(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^(?:[a-z]+\d*|π)/i.exec(s.slice(i));
    if (id) {
      // quebra "xsin" / "2pix": consome o maior nome conhecido; senão letra a letra
      const nome = id[0].toLowerCase();
      const conhecido = Object.keys({ ...FUNCOES, ...CONSTANTES, x: 0 }).filter((k) => nome.startsWith(k)).sort((a, b) => b.length - a.length)[0];
      const pega = conhecido ?? nome[0];
      out.push({ t: "id", v: pega }); i += pega.length; continue;
    }
    if ("+-*/^".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    if (c === "(" || c === "[") { out.push({ t: "(" }); i++; continue; }
    if (c === ")" || c === "]") { out.push({ t: ")" }); i++; continue; }
    if (c === ",") { out.push({ t: "op", v: "," }); i++; continue; }
    throw new Error(`caractere inválido: ${c}`);
  }
  return out;
}

/** Compila a expressão. Lança Error com mensagem curta se for inválida. */
export function compilarExpr(src: string): Fn {
  const s = deLatex(src);
  if (!s) throw new Error("expressão vazia");
  if (s.length > 300) throw new Error("expressão longa demais");
  const toks = tokenizar(s);
  let p = 0;
  const olha = () => toks[p];
  const comeca = (tk: Tok | undefined) => !!tk && (tk.t === "num" || tk.t === "id" || tk.t === "(");

  // expr := termo (('+'|'-') termo)*
  function expr(): Fn {
    let a = termo();
    for (let tk = olha(); tk && tk.t === "op" && (tk.v === "+" || tk.v === "-"); tk = olha()) {
      p++; const b = termo(); const l = a;
      a = tk.v === "+" ? (x) => l(x) + b(x) : (x) => l(x) - b(x);
    }
    return a;
  }
  // termo := unario (('*'|'/'| implícito) unario)*
  function termo(): Fn {
    let a = unario();
    for (;;) {
      const tk = olha();
      if (tk && tk.t === "op" && (tk.v === "*" || tk.v === "/")) {
        p++; const b = unario(); const l = a;
        a = tk.v === "*" ? (x) => l(x) * b(x) : (x) => l(x) / b(x);
      } else if (comeca(tk)) {
        const b = potencia(); const l = a;    // implícita liga como potência: 2x^2 = 2·(x^2)
        a = (x) => l(x) * b(x);
      } else return a;
    }
  }
  function unario(): Fn {
    const tk = olha();
    if (tk && tk.t === "op" && (tk.v === "-" || tk.v === "+")) { p++; const a = unario(); return tk.v === "-" ? (x) => -a(x) : a; }
    return potencia();
  }
  // potencia := atomo ('^' unario)?   (associa à direita)
  function potencia(): Fn {
    const base = atomo();
    const tk = olha();
    if (tk && tk.t === "op" && tk.v === "^") { p++; const ex = unario(); return (x) => Math.pow(base(x), ex(x)); }
    return base;
  }
  function atomo(): Fn {
    const tk = toks[p++];
    if (!tk) throw new Error("expressão incompleta");
    if (tk.t === "num") { const v = tk.v; return () => v; }
    if (tk.t === "(") { const a = expr(); if (toks[p++]?.t !== ")") throw new Error("parêntese sem fechar"); return a; }
    if (tk.t === "id") {
      if (tk.v === "x") return (x) => x;
      if (tk.v in CONSTANTES) { const v = CONSTANTES[tk.v]; return () => v; }
      const f = FUNCOES[tk.v];
      if (f) {
        // sin(x) ou sin x / sin 2x (argumento = próxima potência)
        const arg = olha()?.t === "(" ? atomo() : potencia();
        return (x) => f(arg(x));
      }
      throw new Error(`nome desconhecido: ${tk.v}`);
    }
    throw new Error("expressão inválida");
  }

  const f = expr();
  if (p < toks.length) throw new Error("sobrou texto na expressão");
  return f;
}
