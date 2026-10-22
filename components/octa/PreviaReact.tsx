"use client";
/**
 * Prévia de app React do Octa: o Sandpack (Apache-2.0) roda o projeto num iframe de OUTRA origem (o bundler
 * hospedado do CodeSandbox), no navegador do aluno. Nada é guardado lá: os arquivos só vão pro iframe enquanto a
 * aba está aberta. Sem botão "abrir no CodeSandbox" (isso criaria um sandbox com os arquivos do aluno lá fora).
 *
 * Carregado só no cliente (OctaIDE usa `dynamic(..., { ssr: false })`). Erros de compilação e `console.error`
 * voltam pela `onErros` (sem repetir, só os últimos MAX_ERROS), pra IDE mostrar e mandar pro agente.
 */
import { useEffect, useMemo, useRef } from "react";
import { SandpackProvider, SandpackPreview, useSandpack, useSandpackConsole } from "@codesandbox/sandpack-react";

export const MAX_ERROS = 20;
const MAX_CHARS_ERRO = 2000; // um erro sozinho não vira um livro (o pedido de correção trunca de novo)

type Props = { arquivos: Record<string, string>; onErros: (erros: string[]) => void };

const ehDesign = (p: string) => p.split("/").pop()!.toLowerCase() === "design.md";
const ENTRADAS = ["src/main.jsx", "src/main.tsx", "src/index.jsx", "src/index.tsx", "src/index.js", "index.jsx", "index.js"];

/** Os arquivos do projeto no formato do Sandpack (`/caminho`). DESIGN.md fica de fora (carrega a marca de origem). */
export function arquivosSandpack(arquivos: Record<string, string>): Record<string, string> {
  const r: Record<string, string> = {};
  for (const [p, c] of Object.entries(arquivos)) if (!ehDesign(p)) r[`/${p.replace(/^\/+/, "")}`] = String(c ?? "");
  return r;
}

/** `vite-react` quando o projeto tem vite.config na raiz; senão `react`, apontando a entrada do projeto. */
export function setupSandpack(arquivos: Record<string, string>): { template: "vite-react" | "react"; customSetup?: { entry: string } } {
  if (Object.keys(arquivos).some((p) => /^vite\.config\.(js|mjs|cjs|ts|mts)$/.test(p))) return { template: "vite-react" };
  const entrada = ENTRADAS.find((p) => p in arquivos);
  return entrada ? { template: "react", customSetup: { entry: `/${entrada}` } } : { template: "react" };
}

const textoDoLog = (data: unknown[] | undefined) =>
  (data ?? []).map((d) => (typeof d === "string" ? d : (() => { try { return JSON.stringify(d); } catch { return String(d); } })())).join(" ");

/** Junta erro de compilação + console.error, sem repetir e só os últimos MAX_ERROS. */
export function juntarErros(erro: { message: string; path?: string; line?: number } | null | undefined, logs: { method: string; data?: unknown[] }[]): string[] {
  const todos: string[] = [];
  if (erro?.message) todos.push(`${erro.path ? `${erro.path}${erro.line ? `:${erro.line}` : ""} ` : ""}${erro.message}`);
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

export default function PreviaReact({ arquivos, onErros }: Props) {
  const files = useMemo(() => arquivosSandpack(arquivos), [arquivos]);
  const setup = useMemo(() => setupSandpack(arquivos), [arquivos]);
  return (
    <SandpackProvider key={setup.template} template={setup.template} customSetup={setup.customSetup} files={files} theme="dark"
      options={{ recompileMode: "delayed", recompileDelay: 500 }} style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SandpackPreview showOpenInCodeSandbox={false} showNavigator={false} style={{ flex: 1, height: "100%" }} />
      <ColetorDeErros onErros={onErros} />
    </SandpackProvider>
  );
}
