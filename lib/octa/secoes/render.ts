/**
 * lib/octa/secoes/render.ts — monta a página estática do aluno: `index.html` + `styles.css`.
 *
 * Sem JS, sem build, sem Tailwind em runtime. O HTML sai de `renderToStaticMarkup` (que escapa
 * todo texto e atributo); o CSS é o bloco de tokens do DESIGN.md escolhido + `secoes.css`.
 * Só roda no servidor (lê secoes.css de process.cwd(): o Dockerfile copia a raiz, como em design/indice.ts).
 */
import { createElement } from "react";
// react-dom/server: não importar este módulo de páginas/layouts RSC nem de "use server" actions (route handlers podem).
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTES_ABERTAS, tokensComoCss, type TokensDesign } from "../design/tokens";
import { REGISTRO } from "./registro";
import type { PropsSecao, Secao } from "./tipos";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let cssCache: string | null = null;
function secoesCss(): string {
  return (cssCache ??= readFileSync(join(process.cwd(), "lib", "octa", "secoes", "secoes.css"), "utf8"));
}

/** Aberta na lista mas do sistema: não existe no Google Fonts, então não gera <link>. */
const FONTES_DE_SISTEMA = new Set(["arial", "helvetica", "times new roman", "georgia", "verdana", "courier new"]);
/** Só têm o peso 400 no Google Fonts: pedir wght=700 devolve erro 400 e a folha inteira não carrega. */
const PESO_UNICO = new Set(["instrument serif", "dm serif display"]);

/** Primeira família da pilha ("Inter", system-ui… → Inter). */
const primeiraFamilia = (pilha: string) => pilha.split(",")[0].trim().replace(/^["']|["']$/g, "");

/** `<link>`s do Google Fonts para as famílias de título e corpo (vazio se ambas forem de sistema). */
function linksDeFontes(t: TokensDesign): string {
  const nomes = [...new Set([t.fontes.titulo, t.fontes.corpo].map(primeiraFamilia))].filter((f) => {
    const k = f.toLowerCase();
    return FONTES_ABERTAS.has(k) && !FONTES_DE_SISTEMA.has(k) && /^[\w\s]+$/.test(f);
  });
  if (!nomes.length) return "";
  const familias = nomes.map((f) => `family=${f.replace(/\s+/g, "+")}${PESO_UNICO.has(f.toLowerCase()) ? "" : ":wght@400;700"}`);
  return [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${esc(`https://fonts.googleapis.com/css2?${familias.join("&")}&display=swap`)}">`,
  ].join("\n");
}

/** O id da seção vira âncora; só letras minúsculas, dígitos, `_` e `-`. */
const idSeguro = (id: string) => (/^[a-z][a-z0-9_-]{0,40}$/i.test(id) ? id : "");

/** Texto visível + atributos de conteúdo do <body>: o que a regra anti-marca precisa varrer (o CSS tem "linear-gradient"). */
function textoVisivel(html: string): string {
  const corpo = html.slice(html.indexOf("<body"));
  const attrs = [...corpo.matchAll(/\s(?:alt|title|aria-label|placeholder|href|src)="([^"]*)"/g)].map((m) => m[1]);
  return corpo.replace(/<[^>]+>/g, " ") + " " + attrs.join(" ");
}

export type EntradaPagina = {
  titulo: string;
  descricao: string;
  secoes: Secao[];
  tokens: TokensDesign;
  /** Nome da marca de origem do estilo. Se aparecer na página, a montagem falha (regra anti-marca). */
  marcaProibida?: string;
};

export function renderPagina(p: EntradaPagina): { "index.html": string; "styles.css": string } {
  let contato = false;
  const blocos = p.secoes.map((s) => {
    const Comp = REGISTRO[s.type];
    if (!Comp) return "";
    const eContato = !contato && /^(cta|location)/.test(s.type);
    if (eContato) contato = true;
    const id = eContato ? "contato" : idSeguro(s.id);
    const html = renderToStaticMarkup(createElement(Comp, (s.props ?? {}) as PropsSecao));
    return id ? `<div class="z-bloco" id="${esc(id)}">${html}</div>` : html;
  });

  const html = [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${esc(p.titulo)}</title>`,
    `<meta name="description" content="${esc(p.descricao)}">`,
    linksDeFontes(p.tokens),
    '<link rel="stylesheet" href="styles.css">',
    "</head>",
    '<body class="z-pg">',
    `<main>${blocos.join("\n")}</main>`,
    "</body>",
    "</html>",
    "",
  ].filter((l) => l !== "").join("\n");

  const marca = p.marcaProibida?.trim();
  if (marca) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu");
    if (re.test(textoVisivel(html)) || re.test(`${p.titulo} ${p.descricao}`)) {
      throw new Error("A página menciona o nome da marca de origem do estilo; reescreva o texto sem ele.");
    }
  }

  return { "index.html": html, "styles.css": `${tokensComoCss(p.tokens)}\n${secoesCss()}` };
}
