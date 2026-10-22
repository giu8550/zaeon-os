"use client";
/**
 * Prévia de app React do Octa: o Sandpack (Apache-2.0) roda o projeto num iframe de OUTRA origem (o bundler
 * hospedado do CodeSandbox), no navegador do aluno. Nada é guardado lá: os arquivos só vão pro iframe enquanto a
 * aba está aberta. Sem botão "abrir no CodeSandbox" (isso criaria um sandbox com os arquivos do aluno lá fora).
 *
 * SÓ o template `react` (bundler no navegador). Nunca `vite-react`/templates "node": esses rodam no Nodebox, cuja
 * licença (Sustainable Use License) não permite uso comercial. O sandpack-client só carrega o Nodebox por import
 * dinâmico quando o template é "node", então com `react` ele nem é baixado. O projeto do aluno continua com cara de
 * Vite (index.html + src/main.jsx); arquivosSandpack converte pro formato do bundler.
 *
 * Carregado só no cliente (OctaIDE usa `dynamic(..., { ssr: false })`). Erros de compilação e `console.error`
 * voltam pela `onErros` (sem repetir, só os últimos MAX_ERROS), pra IDE mostrar e mandar pro agente.
 */
import { useEffect, useMemo, useRef } from "react";
import { SandpackProvider, SandpackPreview, useSandpack, useSandpackConsole } from "@codesandbox/sandpack-react";

export const MAX_ERROS = 20;
const MAX_CHARS_ERRO = 2000; // um erro sozinho não vira um livro (o pedido de correção trunca de novo)

type Props = { arquivos: Record<string, string>; onErros: (erros: string[]) => void };

const nomeDe = (p: string) => p.split("/").pop()!.toLowerCase();
const ehDesign = (p: string) => nomeDe(p) === "design.md";
const ehViteConfig = (p: string) => /^vite\.config\.(js|mjs|cjs|ts|mts)$/.test(p);
const ENTRADAS = ["src/main.jsx", "src/main.tsx", "src/index.jsx", "src/index.tsx", "src/main.js", "src/index.js", "index.jsx", "index.js"];
const VERSAO_REACT = "^18.3.1";
const HTML_PADRAO = '<!DOCTYPE html>\n<html lang="pt-BR">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>\n  <body><div id="root"></div></body>\n</html>';

/**
 * O index.html de um projeto Vite vira o /public/index.html do bundler: sai o `<script type="module" src=…>`
 * (o bundler injeta a entrada sozinho; o script do Vite daria 404 lá) e, se faltar, entra o `<div id="root">`.
 */
export function htmlParaBundler(html: string): string {
  let h = String(html ?? "").replace(/<script\b[^>]*\btype\s*=\s*["']?module["']?[^>]*>[\s\S]*?<\/script>/gi, "");
  if (!/\bid\s*=\s*["']?root\b/i.test(h)) h = /<\/body>/i.test(h) ? h.replace(/<\/body>/i, '<div id="root"></div></body>') : `${h}<div id="root"></div>`;
  return h;
}

function lerDependencias(pkg: string | undefined): Record<string, string> {
  try {
    const d = JSON.parse(String(pkg ?? ""))?.dependencies;
    if (!d || typeof d !== "object") return {};
    return Object.fromEntries(Object.entries(d).filter(([k, v]) => typeof k === "string" && typeof v === "string")) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Os arquivos do projeto no formato do Sandpack, SEMPRE no template `react` (bundler no navegador).
 * O template `vite-react` nunca é usado: ele roda no Nodebox, cuja licença não permite uso comercial.
 * - cada arquivo vira `/caminho`; DESIGN.md (marca de origem) e vite.config.* ficam de fora;
 * - o index.html da raiz vira /public/index.html (htmlParaBundler), a não ser que o projeto já tenha um;
 * - o package.json é refeito: `main` = a entrada do projeto (src/main.jsx…), as `dependencies` do aluno
 *   (sem scripts, sem devDependencies do Vite) + react/react-dom/react-scripts que o bundler espera.
 */
export function arquivosSandpack(arquivos: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [p0, c] of Object.entries(arquivos)) {
    const p = p0.replace(/^\/+/, "");
    if (ehDesign(p) || ehViteConfig(p) || p === "package.json" || p === "index.html") continue;
    r[`/${p}`] = String(c ?? "");
  }
  if (!r["/public/index.html"]) r["/public/index.html"] = typeof arquivos["index.html"] === "string" ? htmlParaBundler(arquivos["index.html"]) : HTML_PADRAO;
  const entrada = ENTRADAS.find((p) => p in arquivos);
  const deps = { react: VERSAO_REACT, "react-dom": VERSAO_REACT, ...lerDependencias(arquivos["package.json"]), "react-scripts": "^5.0.0" };
  r["/package.json"] = JSON.stringify({ main: entrada ? `/${entrada}` : "/index.js", dependencies: deps }, null, 2);
  return r;
}

/** A entrada do projeto, pro `customSetup.entry` (o template `react` sozinho procuraria /index.js). */
export function entradaSandpack(arquivos: Record<string, string>): string | undefined {
  const e = ENTRADAS.find((p) => p in arquivos);
  return e ? `/${e}` : undefined;
}

const textoDoLog = (data: unknown[] | undefined) =>
  (data ?? []).map((d) => (typeof d === "string" ? d : (() => { try { return JSON.stringify(d); } catch { return String(d); } })())).join(" ");

/** Junta erro de compilação + console.error, sem repetir e só os últimos MAX_ERROS. */
export function juntarErros(erro: { message: string; path?: string; line?: number } | null | undefined, logs: { method: string; data?: unknown[] }[]): string[] {
  const todos: string[] = [];
  if (erro?.message) {
    // o bundler às vezes já começa a mensagem pelo caminho ("/src/App.jsx: boom"): aí não repete
    const onde = erro.path && !erro.message.startsWith(erro.path) ? `${erro.path}${erro.line ? `:${erro.line}` : ""} ` : "";
    todos.push(`${onde}${erro.message}`);
  }
  for (const l of logs) if (l.method === "error") todos.push(textoDoLog(l.data));
  const unicos = [...new Set(todos.map((t) => t.slice(0, MAX_CHARS_ERRO)).filter(Boolean))];
  return unicos.slice(-MAX_ERROS);
}

// Fica dentro do provider: lê o estado do Sandpack e avisa a IDE quando a lista de erros muda
function ColetorDeErros({ onErros }: { onErros: Props["onErros"] }) {
  const { sandpack } = useSandpack();
  const { logs } = useSandpackConsole({ resetOnPreviewRestart: true });
  const erros = useMemo(() => juntarErros(sandpack.error, logs as any), [sandpack.error, logs]);
  const chave = JSON.stringify(erros);
  const avisar = useRef(onErros);
  avisar.current = onErros;
  const ultima = useRef<string | null>(null);
  useEffect(() => {
    if (ultima.current === chave) return;
    ultima.current = chave;
    avisar.current(erros);
  }, [chave, erros]);
  return null;
}

const OPCOES = { recompileMode: "delayed", recompileDelay: 500 } as const;
const ESTILO = { height: "100%", display: "flex", flexDirection: "column" } as const;

export default function PreviaReact({ arquivos, onErros }: Props) {
  const files = useMemo(() => arquivosSandpack(arquivos), [arquivos]);
  const entrada = entradaSandpack(arquivos);
  // objetos estáveis: um customSetup/options novo a cada render faz o Sandpack recompilar e apagar o erro que acabou de mostrar
  const customSetup = useMemo(() => (entrada ? { entry: entrada } : undefined), [entrada]);
  return (
    <SandpackProvider template="react" customSetup={customSetup} files={files} theme="dark"
      options={OPCOES} style={ESTILO}>
      <SandpackPreview showOpenInCodeSandbox={false} showNavigator={false} style={{ flex: 1, height: "100%" }} />
      <ColetorDeErros onErros={onErros} />
    </SandpackProvider>
  );
}
