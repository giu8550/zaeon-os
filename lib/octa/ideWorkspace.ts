/**
 * lib/octa/ideWorkspace.ts — o projeto aberto na IDE do Octa (PURO, roda no navegador): arquivos, árvore,
 * linguagem por extensão, aplicar o que o agente mudou (com desfazer) e salvar no navegador.
 */
export type Workspace = Record<string, string>;
export type EstadoIDE = { arquivos: Workspace; abertos: string[]; ativo: string | null };

export const PROJETO_INICIAL: EstadoIDE = {
  arquivos: {
    "README.md": "# Meu projeto\n\nPeça ao Octa, na janela ao lado: revisar, explicar, corrigir, criar arquivos, gerar testes ou uma arte.\n",
    "main.py": "def soma(a, b):\n    return a - b  # bug proposital: peça pro Octa revisar\n\nprint(soma(2, 3))\n",
    "index.html": "<!doctype html>\n<html>\n  <body>\n    <h1>Olá, Octa</h1>\n  </body>\n</html>\n",
  },
  abertos: ["main.py"],
  ativo: "main.py",
};

const EXT_LANG: Record<string, { monaco: string; runner: "python" | "javascript" | "typescript" | "html" | null }> = {
  py: { monaco: "python", runner: "python" },
  js: { monaco: "javascript", runner: "javascript" }, mjs: { monaco: "javascript", runner: "javascript" },
  ts: { monaco: "typescript", runner: "typescript" }, tsx: { monaco: "typescript", runner: null }, jsx: { monaco: "javascript", runner: null },
  html: { monaco: "html", runner: "html" }, css: { monaco: "css", runner: null }, json: { monaco: "json", runner: null },
  md: { monaco: "markdown", runner: null }, svg: { monaco: "xml", runner: null }, sql: { monaco: "sql", runner: null },
  sh: { monaco: "shell", runner: null }, yml: { monaco: "yaml", runner: null }, yaml: { monaco: "yaml", runner: null },
};
export function linguagem(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? { monaco: "plaintext", runner: null };
}

/** Caminho válido de arquivo do projeto (relativo, sem `..`, sem barra no fim). */
export function caminhoValido(p: string): string | null {
  const s = p.trim().replace(/\\/g, "/").replace(/^\.?\/+/, "");
  if (!s || s.endsWith("/") || s.split("/").some((seg) => !seg || seg === "." || seg === "..")) return null;
  return s;
}

export type NoArvore = { nome: string; caminho: string; pasta: boolean; filhos: NoArvore[] };
/** Árvore de pastas → arquivos, pastas primeiro, ordem alfabética. */
export function arvore(arquivos: Workspace): NoArvore[] {
  const raiz: NoArvore = { nome: "", caminho: "", pasta: true, filhos: [] };
  for (const p of Object.keys(arquivos).sort()) {
    const partes = p.split("/");
    let no = raiz;
    partes.forEach((nome, i) => {
      const caminho = partes.slice(0, i + 1).join("/");
      const pasta = i < partes.length - 1;
      let f = no.filhos.find((x) => x.nome === nome && x.pasta === pasta);
      if (!f) { f = { nome, caminho, pasta, filhos: [] }; no.filhos.push(f); }
      no = f;
    });
  }
  const ordenar = (n: NoArvore) => { n.filhos.sort((a, b) => (a.pasta === b.pasta ? a.nome.localeCompare(b.nome) : a.pasta ? -1 : 1)); n.filhos.forEach(ordenar); };
  ordenar(raiz);
  return raiz.filhos;
}

/** Aplica o resultado de um turno do agente; devolve o estado novo e o anterior (pra desfazer). */
export function aplicarEdicoes(e: EstadoIDE, edicoes: Record<string, string>, apagados: string[] = []): EstadoIDE {
  const arquivos = { ...e.arquivos, ...edicoes };
  for (const p of apagados) delete arquivos[p];
  const novos = Object.keys(edicoes).filter((p) => !(p in e.arquivos));
  const abertos = [...e.abertos.filter((p) => p in arquivos), ...novos.filter((p) => !e.abertos.includes(p))];
  const ativo = e.ativo && e.ativo in arquivos ? e.ativo : abertos[0] ?? null;
  return { arquivos, abertos, ativo: novos[0] && !e.ativo ? novos[0] : ativo };
}

export function fecharAba(e: EstadoIDE, p: string): EstadoIDE {
  const abertos = e.abertos.filter((x) => x !== p);
  const i = e.abertos.indexOf(p);
  return { ...e, abertos, ativo: e.ativo === p ? abertos[Math.min(i, abertos.length - 1)] ?? null : e.ativo };
}

export function abrir(e: EstadoIDE, p: string): EstadoIDE {
  return { ...e, abertos: e.abertos.includes(p) ? e.abertos : [...e.abertos, p], ativo: p };
}

const CHAVE = "zaeon.octa.ide.v1";
export function carregar(): EstadoIDE {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || "null");
    if (v && typeof v.arquivos === "object" && Array.isArray(v.abertos)) return v;
  } catch { /* storage bloqueado/corrompido → projeto inicial */ }
  return PROJETO_INICIAL;
}
export function salvar(e: EstadoIDE): boolean {
  try { localStorage.setItem(CHAVE, JSON.stringify(e)); return true; } catch { return false; }
}

// ───────────────────────────── #421: SVG é imagem, não texto ─────────────────────────────

/** Arquivo SVG? (a arte do Octa é gravada como arte/<tema>.svg) — esses abrem como IMAGEM na IDE. */
export const ehSvg = (path: string | null | undefined): boolean => !!path && /\.svg$/i.test(path.trim());

/**
 * SVG → data URL pra uma <img>. Numa <img> o navegador NÃO executa <script> do SVG nem busca nada de fora —
 * por isso a prévia usa <img> e nunca injeta o SVG na página (o aluno também edita esse arquivo).
 * null = o texto nem parece um SVG (vazio, ou sem a tag <svg>).
 */
export function svgParaDataUrl(conteudo: string | null | undefined): string | null {
  const s = String(conteudo ?? "").trim();
  if (!/<svg[\s>]/i.test(s)) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
}

/**
 * Esquece a escolha "ver como Código" desses caminhos (#421, revisão): arquivo apagado ou regravado pelo agente
 * volta a abrir como IMAGEM — senão uma arte nova com o mesmo nome herdava a escolha antiga e abria como código.
 */
export function esquecerVerCodigo(pref: Record<string, boolean>, caminhos: readonly string[]): Record<string, boolean> {
  if (!caminhos.some((p) => p in pref)) return pref; // nada a esquecer → mesmo objeto (o React não re-renderiza à toa)
  const novo = { ...pref };
  for (const p of caminhos) delete novo[p];
  return novo;
}

// ───────────────────────────── Tarefa 7: projeto do servidor ─────────────────────────────

/**
 * Os arquivos que vieram do servidor (GET do projeto, fim de um turno) viram o estado da IDE. Com `antes`, mantém as
 * abas que ainda existem; sem aba nenhuma, abre o index.html (ou o 1º arquivo em ordem alfabética).
 */
export function estadoDoProjeto(arquivos: Workspace, antes?: Pick<EstadoIDE, "abertos" | "ativo">): EstadoIDE {
  const abertos = (antes?.abertos ?? []).filter((p) => p in arquivos);
  const ativo = antes?.ativo && antes.ativo in arquivos ? antes.ativo : abertos[0] ?? null;
  if (abertos.length) return { arquivos, abertos, ativo };
  const primeiro = "index.html" in arquivos ? "index.html" : Object.keys(arquivos).sort()[0];
  return primeiro ? { arquivos, abertos: [primeiro], ativo: primeiro } : { arquivos, abertos: [], ativo: null };
}

/**
 * HTML da prévia da página do projeto (vai num `<iframe sandbox="" srcDoc>`): o index.html com cada
 * `<link rel="stylesheet" href="X.css">` LOCAL trocado pelo conteúdo do arquivo num <style> (srcDoc não tem como
 * buscar o styles.css). Link externo (Google Fonts) fica. `</` dentro do CSS é escapado. Sem index.html → null.
 */
export function montarPrevia(arquivos: Workspace): string | null {
  const html = arquivos["index.html"];
  if (typeof html !== "string") return null;
  return html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/\brel=["']?stylesheet["']?/i.test(tag)) return tag;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || /^[a-z]+:|^\/\//i.test(href)) return tag;
    const caminho = caminhoValido(href.split(/[?#]/)[0]);
    const css = caminho ? arquivos[caminho] : undefined;
    return typeof css === "string" ? `<style>${css.replace(/<\//g, "<\\/")}</style>` : tag;
  });
}

/** Cache no navegador do projeto aberto (a fonte da verdade é o servidor; isto só mostra rápido ao reabrir). */
const chaveProjeto = (id: string) => `zaeon.octa.proj.${id}`;
export function carregarCacheProjeto(id: string): EstadoIDE | null {
  try {
    const v = JSON.parse(localStorage.getItem(chaveProjeto(id)) || "null");
    if (v && typeof v.arquivos === "object" && Array.isArray(v.abertos)) return v;
  } catch { /* */ }
  return null;
}
export function salvarCacheProjeto(id: string, e: EstadoIDE): void {
  try { localStorage.setItem(chaveProjeto(id), JSON.stringify(e)); } catch { /* storage cheio/bloqueado: o servidor tem tudo */ }
}

/** O estilo da biblioteca que o DESIGN.md do projeto diz usar (marcador `<!-- zaeon-estilo: id -->` na 1ª linha). */
export function estiloDoDesignMd(arquivos: Workspace): string | null {
  return arquivos["DESIGN.md"]?.match(/^<!-- zaeon-estilo: ([^\s]+) -->/)?.[1] ?? null;
}
