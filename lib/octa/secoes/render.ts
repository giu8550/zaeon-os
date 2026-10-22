/**
 * lib/octa/secoes/render.ts — monta a página estática do aluno: `index.html` + `styles.css`.
 *
 * Sem JS, sem build, sem Tailwind em runtime. O HTML sai de `renderToStaticMarkup` (que escapa
 * todo texto e atributo); o CSS é o bloco de tokens do DESIGN.md escolhido + `secoes.css`.
 * Só roda no servidor (lê secoes.css de process.cwd(): o Dockerfile copia a raiz, como em design/indice.ts).
 */
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTES_ABERTAS, tokensComoCss, type TokensDesign } from "../design/tokens";
import { REGISTRO } from "./registro";
import type { PropsSecao, Secao } from "./tipos";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type RenderToStaticMarkup = (el: ReturnType<typeof createElement>) => string;
let renderCache: Promise<RenderToStaticMarkup> | null = null;
/**
 * `react-dom/server` carregado sob demanda e ESCONDIDO do webpack (mesmo truque do bullmq em lib/queue):
 * o Next 14 recusa no build qualquer import estático dele no grafo do app (rota, instrumentation…).
 * Aqui é o Node quem resolve, em runtime, do node_modules (a imagem não usa `output: standalone`).
 */
function carregarRender(): Promise<RenderToStaticMarkup> {
  return (renderCache ??= (async () => {
    const spec = "react-dom/" + "server";
    const mod = await import(/* webpackIgnore: true */ spec);
    return (mod.renderToStaticMarkup ?? mod.default?.renderToStaticMarkup) as RenderToStaticMarkup;
  })());
}

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
  const i = html.indexOf("<body");
  // <style>/<script> inline (o agente pode escrever HTML à mão) não é texto: "linear-gradient" não é a marca.
  const corpo = (i >= 0 ? html.slice(i) : html).replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/\sstyle="[^"]*"/gi, " ");
  const attrs = [...corpo.matchAll(/\s(?:alt|title|aria-label|placeholder|href|src)="([^"]*)"/g)].map((m) => m[1]);
  return corpo.replace(/<[^>]+>/g, " ") + " " + attrs.join(" ");
}

/** <title> e <meta name="description">: também aparecem pro visitante (aba, busca, cartão de link). */
function textoDoHead(html: string): string {
  const titulo = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "";
  return `${titulo} ${desc}`;
}

/** A marca como PALAVRA INTEIRA (Unicode, sem diferenciar maiúsculas): "Linear" casa, "linear-gradient" no CSS não entra na varredura. */
const casaMarca = (texto: string, marca: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${marca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(texto);

/** As formas do nome que valem a varredura: 1 letra ("X" de xAI) casaria com `x.com` e qualquer "x" solto. */
const varriveis = (marcas: string | readonly string[]) =>
  (typeof marcas === "string" ? [marcas] : [...marcas]).map((m) => String(m ?? "").trim()).filter((m) => m.length >= 2);

/**
 * A 1ª forma do nome da marca (marca ou alias) que aparece no que o visitante da página lê (corpo, atributos de
 * conteúdo, título, descrição) — ou null. Devolve só a palavra, nada do conteúdo.
 */
export function marcaMencionada(html: string, marcas: string | readonly string[]): string | null {
  const lista = varriveis(marcas);
  if (!lista.length) return null;
  const corpo = textoVisivel(html);
  const head = textoDoHead(html);
  return lista.find((m) => casaMarca(corpo, m) || casaMarca(head, m)) ?? null;
}

/*
 * ── Anti-marca no FONTE publicado (publicarProjeto) ──
 * O repositório é público: além do que o visitante lê, quem abre o código também lê. Por isso, no publicar,
 * varremos o fonte INTEIRO de cada arquivo de texto, exceto o que é código CSS (onde "linear-gradient",
 * "linear" de easing etc. colidem com nomes de marca):
 *   - HTML/SVG/XML: comentários <!-- -->, texto fora das tags, valores de TODOS os atributos (alt, title,
 *     aria-label, content do <meta>, href, class…) exceto `style`; <style> como CSS; <script> como JS
 *     (ld+json como texto).
 *   - CSS: só comentários /* *\/ e o valor de `content:` (texto que aparece na página). Seletores, propriedades
 *     e valores não entram.
 *   - JS: comentários e strings literais (não identificadores); uma string que é só "linear" (easing) não conta.
 *   - JSON/TXT/MD/webmanifest: o arquivo todo.
 * Em tudo que entra, nomes de função de gradiente do CSS (linear-/radial-/conic-gradient, repeating-…) saem antes.
 * renderPagina (octa_pagina_montar) não muda: a página gerada não tem comentários e segue com marcaMencionada.
 */
const SEM_GRADIENTE = (s: string) => s.replace(/(?:repeating-)?(?:linear|radial|conic)-gradient/gi, " ");
const RE_JS_PECAS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;

function textoDoCss(css: string): string[] {
  return [
    ...[...css.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1]),
    ...[...css.matchAll(/\bcontent\s*:\s*([^;}]*)/gi)].map((m) => m[1]),
  ];
}

function textoDoJs(js: string): string[] {
  return [...js.matchAll(RE_JS_PECAS)].map((m) => {
    const p = m[0];
    if (p.startsWith("//")) return p.slice(2);
    if (p.startsWith("/*")) return p.slice(2, -2);
    const s = p.slice(1, -1);
    return s.trim().toLowerCase() === "linear" ? "" : s; // easing "linear"
  });
}

function textoDoHtml(html: string): string[] {
  const pecas: string[] = [];
  let resto = html.replace(/<!--([\s\S]*?)-->/g, (_, c: string) => { pecas.push(c); return " "; });
  resto = resto.replace(/<(style|script)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi, (_, tag: string, attrs: string, corpo: string) => {
    if (tag.toLowerCase() === "style") pecas.push(...textoDoCss(corpo));
    else if (/type\s*=\s*["']?[^"'>]*json/i.test(attrs)) pecas.push(corpo);
    else pecas.push(...textoDoJs(corpo));
    return `<${tag}${attrs}>`; // os atributos da própria tag ainda são varridos abaixo
  });
  resto = resto.replace(/<[^>]*>/g, (tag) => {
    for (const m of tag.matchAll(/([^\s=<>"'\/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      if (m[1].toLowerCase() !== "style") pecas.push(m[2] ?? m[3] ?? m[4] ?? "");
    }
    return " ";
  });
  pecas.push(resto);
  return pecas;
}

/**
 * A 1ª forma do nome da marca (marca ou alias) no FONTE de um arquivo publicado, pela regra acima — ou null.
 * Arquivo que não é de texto (imagem, fonte) devolve null. Só a palavra sai daqui.
 */
export function marcaNoFonte(caminho: string, conteudo: string, marcas: string | readonly string[]): string | null {
  const lista = varriveis(marcas);
  const ext = caminho.toLowerCase().split(".").pop() ?? "";
  if (!lista.length) return null;
  let pecas: string[];
  if (["html", "htm", "svg", "xml"].includes(ext)) pecas = textoDoHtml(conteudo);
  else if (ext === "css") pecas = textoDoCss(conteudo);
  else if (ext === "js" || ext === "mjs") pecas = textoDoJs(conteudo);
  else if (["json", "txt", "md", "webmanifest"].includes(ext)) pecas = [conteudo];
  else return null;
  const texto = SEM_GRADIENTE(pecas.join("\n"));
  return lista.find((m) => casaMarca(texto, m)) ?? null;
}

/** O nome da marca (ou um alias) aparece no que o visitante da página lê? */
export function mencionaMarca(html: string, marcas: string | readonly string[]): boolean {
  return marcaMencionada(html, marcas) !== null;
}

/** Erro da regra anti-marca. `palavra` = o nome da marca que apareceu (o agente repassa pro modelo reescrever). */
export class ErroMarca extends Error {
  constructor(readonly palavra: string) {
    super(`A página menciona o nome da marca de origem do estilo ("${palavra}"); reescreva o texto sem ele.`);
    this.name = "ErroMarca";
  }
}

export type EntradaPagina = {
  titulo: string;
  descricao: string;
  secoes: Secao[];
  tokens: TokensDesign;
  /** Nome da marca de origem do estilo (ou marca + aliases). Se aparecer na página, a montagem falha (regra anti-marca). */
  marcaProibida?: string | readonly string[];
};

export type PaginaMontada = { "index.html": string; "styles.css": string };

export async function renderPagina(p: EntradaPagina): Promise<PaginaMontada> {
  const renderToStaticMarkup = await carregarRender();
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

  if (p.marcaProibida) {
    const achada = marcaMencionada(html, p.marcaProibida) ?? varriveis(p.marcaProibida).find((m) => casaMarca(`${p.titulo} ${p.descricao}`, m));
    if (achada) throw new ErroMarca(achada);
  }

  return { "index.html": html, "styles.css": `${tokensComoCss(p.tokens)}\n${secoesCss()}` };
}
