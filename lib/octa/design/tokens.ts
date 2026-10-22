/**
 * lib/octa/design/tokens.ts — extrai tokens de design de um DESIGN.md (coleção VoltAgent/awesome-design-md, MIT).
 *
 * Dois formatos reais na coleção:
 *   - com frontmatter YAML (`colors:`, `typography:`, `rounded:`, `spacing:`) → leitura direta;
 *   - em prosa (sem frontmatter) → heurística por linha (`**Nome** (`#hex`): papel`).
 * Tudo que faltar cai em TOKENS_PADRAO, então a página gerada continua válida com qualquer DESIGN.md.
 *
 * Módulo puro e sem imports (o script de sync o carrega via tsx).
 */

export type TokensDesign = {
  cores: { fundo: string; superficie: string; texto: string; textoSuave: string; primaria: string; acento: string; borda: string };
  fontes: { titulo: string; corpo: string };
  raio: string;
  espaco: string;
  escuro: boolean;
};

// Sem "-apple-system" de propósito: a regra anti-marca varre a página por nomes de marca (ex.: "apple").
const PILHA_SISTEMA = 'system-ui, "Segoe UI", Roboto, sans-serif';

export const TOKENS_PADRAO: TokensDesign = {
  cores: {
    fundo: "#ffffff",
    superficie: "#f6f7f9",
    texto: "#111827",
    textoSuave: "#6b7280",
    primaria: "#2563eb",
    acento: "#7c3aed",
    borda: "#e5e7eb",
  },
  fontes: { titulo: PILHA_SISTEMA, corpo: PILHA_SISTEMA },
  raio: "8px",
  espaco: "16px",
  escuro: false,
};

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{3})$/i;

/** `#abc` → `#aabbcc`; qualquer coisa que não seja hex devolve null. */
function normalizarHex(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().replace(/^["']|["']$/g, "");
  if (!HEX.test(s)) return null;
  if (s.length === 4) return "#" + [...s.slice(1)].map((c) => c + c).join("").toLowerCase();
  return s.toLowerCase();
}

/** Luminância relativa (0 = preto, 1 = branco). */
function luminancia(hex: string): number {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Diferença entre o maior e o menor canal (0 = cinza). */
function saturacao(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...c) - Math.min(...c);
}

/** Razão de contraste WCAG entre duas cores. */
function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

type CoresParciais = Partial<TokensDesign["cores"]>;
type Parcial = Partial<Omit<TokensDesign, "cores">> & { cores?: CoresParciais };

type Secoes = Record<string, Record<string, string | Record<string, string>>>;

/** Lê o frontmatter YAML (subset: 2 níveis, e 3 para typography). Sem dependência de yaml. */
function lerFrontmatter(md: string): Secoes {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Secoes = {};
  let sec = "";
  let sub = "";
  for (const linha of m[1].split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith("#")) continue;
    const ind = linha.length - linha.trimStart().length;
    const kv = linha.trim().match(/^([\w.-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    const val = v.replace(/^["']|["']$/g, "");
    if (ind === 0) {
      sec = k;
      sub = "";
      out[sec] = out[sec] ?? {};
    } else if (ind === 2 && sec) {
      if (val === "") {
        sub = k;
        out[sec][k] = {};
      } else {
        sub = "";
        out[sec][k] = val;
      }
    } else if (ind >= 4 && sec && sub) {
      (out[sec][sub] as Record<string, string>)[k] = val;
    }
  }
  return out;
}

function str(v: string | Record<string, string> | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Primeira chave existente (e válida) da lista. */
function primeiraCor(cores: Record<string, string | Record<string, string>>, chaves: string[]): string | null {
  for (const k of chaves) {
    const h = normalizarHex(str(cores[k]));
    if (h) return h;
  }
  return null;
}

/**
 * Pilha de fontes segura para CSS a partir do `fontFamily` do DESIGN.md.
 * Anti-marca: família cujo nome contém a marca (ex.: "Linear Display") é descartada — o nome
 * da marca nunca pode chegar na página do aluno.
 */
function pilhaDeFonte(bruto: string | undefined, marca?: string): string | null {
  if (!bruto) return null;
  const familias = bruto
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""))
    .filter((f) => f && /^[\w\s.-]+$/.test(f));
  const m = marca?.trim().toLowerCase();
  const genericas = new Set(["system-ui", "sans-serif", "serif", "monospace", "ui-sans-serif", "ui-serif", "ui-monospace"]);
  const boa = familias.find((f) => !genericas.has(f.toLowerCase()) && !(m && f.toLowerCase().includes(m)));
  if (!boa) return null;
  return `"${boa}", ${PILHA_SISTEMA}`;
}

function aPartirDoFrontmatter(sec: Secoes, marca?: string): Parcial {
  const c = sec.colors ?? {};
  const cores: Partial<TokensDesign["cores"]> = {};
  const set = <K extends keyof TokensDesign["cores"]>(k: K, v: string | null) => {
    if (v) cores[k] = v;
  };
  set("fundo", primeiraCor(c, ["canvas", "background", "bg", "canvas-light", "canvas-dark"]));
  set("superficie", primeiraCor(c, ["surface-card", "surface-soft", "surface", "surface-1", "canvas-soft", "surface-elevated", "surface-dark"]));
  set("texto", primeiraCor(c, ["ink", "text", "foreground", "ink-deep", "on-dark"]));
  set("textoSuave", primeiraCor(c, ["body", "muted", "mute", "ink-muted", "ink-mute", "slate", "stone", "ink-soft", "on-dark-mute"]));
  set("primaria", primeiraCor(c, ["primary", "brand"]));
  set("acento", primeiraCor(c, ["accent-blue", "accent-purple", "accent-pink", "accent-orange", "accent-yellow", "accent", "link", "primary-active", "primary-deep"]));
  set("borda", primeiraCor(c, ["hairline", "border", "hairline-soft", "hairline-strong", "hairline-dark"]));

  const t = sec.typography ?? {};
  const fam = (chaves: string[]): string | null => {
    for (const k of chaves) {
      const e = t[k];
      if (e && typeof e === "object") {
        const p = pilhaDeFonte(e.fontFamily, marca);
        if (p) return p;
      }
    }
    return null;
  };
  const titulo = fam(["display-xl", "display-xxl", "display-lg", "display-md", "headline", "heading", "h1"]);
  const corpo = fam(["body", "body-md", "body-lg", "body-sm", "caption"]);

  const r = sec.rounded ?? {};
  const raio = [r.md, r.sm, r.lg].map(str).find((v) => v && /^\d+(\.\d+)?(px|rem)$/.test(v));
  const s = sec.spacing ?? {};
  const espaco = [s.md, s.base, s.sm].map(str).find((v) => v && /^\d+(\.\d+)?(px|rem)$/.test(v));

  return {
    cores,
    ...(titulo || corpo ? { fontes: { titulo: titulo ?? TOKENS_PADRAO.fontes.titulo, corpo: corpo ?? TOKENS_PADRAO.fontes.corpo } } : {}),
    ...(raio ? { raio } : {}),
    ...(espaco ? { espaco } : {}),
  };
}

/** Formato em prosa: acha o primeiro hex em linhas cujo texto bate com o papel. */
function aPartirDaProsa(md: string, marca?: string): Parcial {
  const linhas = md.split(/\r?\n/).filter((l) => /#[0-9a-f]{6}\b/i.test(l));
  const achar = (re: RegExp, evitar?: RegExp): string | null => {
    for (const l of linhas) {
      if (!re.test(l) || (evitar && evitar.test(l))) continue;
      const h = l.match(/#[0-9a-f]{6}\b/i);
      if (h) return h[0].toLowerCase();
    }
    return null;
  };
  const cores: CoresParciais = {};
  const set = <K extends keyof TokensDesign["cores"]>(k: K, v: string | null) => {
    if (v) cores[k] = v;
  };
  // Primária = a cor mais saturada das linhas de marca/CTA; sem elas, a mais frequente e saturada do documento.
  const doPapel = linhas.filter((l) => /primary|brand|\bcta\b|accent/i.test(l) && !/hover|disabled|border/i.test(l)).flatMap((l) => l.match(/#[0-9a-f]{6}\b/gi) ?? []);
  const todas = linhas.flatMap((l) => l.match(/#[0-9a-f]{6}\b/gi) ?? []).map((h) => h.toLowerCase());
  const freq = new Map<string, number>();
  for (const h of todas) freq.set(h, (freq.get(h) ?? 0) + 1);
  const maisSaturada = (hs: string[]) => hs.map((h) => h.toLowerCase()).filter((h) => saturacao(h) >= 40).sort((a, b) => saturacao(b) - saturacao(a) || (freq.get(b) ?? 0) - (freq.get(a) ?? 0))[0] ?? null;
  const porFrequencia = [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
  set("primaria", maisSaturada(doPapel) ?? maisSaturada(porFrequencia));
  set("fundo", achar(/background|canvas|page|deepest|dominant/i, /text|button|border/i));
  set("superficie", achar(/surface|card|container|alternate/i, /text|button|border|hover/i));
  set("texto", achar(/(primary|body|heading|main) text|\bink\b|heading/i));
  const suave = achar(/secondary text|muted|tertiary|subtle|silver|gray text/i);
  // Texto suave precisa ter contraste mínimo com o fundo; senão some e vale o default.
  if (suave && cores.fundo && contraste(suave, cores.fundo) < 2.5) set("textoSuave", null);
  else set("textoSuave", suave);
  set("borda", achar(/border|divider|hairline|separator/i, /primary|cta|button|brand|accent/i));

  const fonte = md.match(/^###?\s*Font Famil(?:y|ies)[\s\S]{0,400}?`([^`]+)`/im);
  const pilha = fonte ? pilhaDeFonte(fonte[1], marca) : null;
  const raio = md.match(/border-?radius:?\s*(\d+px)/i)?.[1];
  return { cores, ...(pilha ? { fontes: { titulo: pilha, corpo: pilha } } : {}), ...(raio ? { raio } : {}) };
}

/**
 * Extrai os tokens do DESIGN.md. `marca` (opcional) serve à regra anti-marca: famílias de fonte
 * que carregam o nome da marca são ignoradas.
 */
export function extrairTokens(md: string, marca?: string): TokensDesign {
  const sec = lerFrontmatter(md);
  const parcial = Object.keys(sec).length ? aPartirDoFrontmatter(sec, marca) : aPartirDaProsa(md, marca);
  const cores = { ...TOKENS_PADRAO.cores, ...parcial.cores };
  // Sem acento próprio, o acento acompanha a primária (o roxo do padrão destoaria do estilo).
  if (!parcial.cores?.acento && parcial.cores?.primaria) cores.acento = parcial.cores.primaria;
  // Fundo escuro com texto herdado do padrão (escuro sobre escuro) é ilegível: se o texto não veio, inverte.
  const escuro = luminancia(cores.fundo) < 0.4;
  if (!parcial.cores?.texto && escuro) cores.texto = "#f5f5f5";
  if (!parcial.cores?.textoSuave && escuro) cores.textoSuave = "#a1a1aa";
  if (!parcial.cores?.superficie && escuro) cores.superficie = "#18181b";
  if (!parcial.cores?.borda && escuro) cores.borda = "#27272a";
  return {
    cores,
    fontes: parcial.fontes ?? TOKENS_PADRAO.fontes,
    raio: parcial.raio ?? TOKENS_PADRAO.raio,
    espaco: parcial.espaco ?? TOKENS_PADRAO.espaco,
    escuro,
  };
}

/** Bloco `:root{…}` com as variáveis `--z-*` que o template da página consome. */
export function tokensComoCss(t: TokensDesign): string {
  const v: Array<[string, string]> = [
    ["fundo", t.cores.fundo],
    ["superficie", t.cores.superficie],
    ["texto", t.cores.texto],
    ["texto-suave", t.cores.textoSuave],
    ["primaria", t.cores.primaria],
    ["acento", t.cores.acento],
    ["borda", t.cores.borda],
    ["fonte-titulo", t.fontes.titulo],
    ["fonte-corpo", t.fontes.corpo],
    ["raio", t.raio],
    ["espaco", t.espaco],
  ];
  return `:root{${v.map(([k, val]) => `--z-${k}:${val}`).join(";")}}`;
}
