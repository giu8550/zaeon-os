/**
 * Que tipo de projeto o aluno tem — decide qual prévia a IDE mostra e se dá pra publicar.
 *
 * Regra explícita (na ordem):
 * - **react**: `package.json` (na raiz) com `react` em `dependencies`, OU `src/App.jsx` / `src/App.tsx`;
 * - senão **python**: há algum `.py` e nenhum `index.html` (em qualquer pasta);
 * - senão **estatico**.
 *
 * Projeto misto (`index.html` estático + `src/App.jsx`) é react: o React vence porque o `index.html` de um app
 * Vite também existe, e publicar esse projeto como site estático daria uma página quebrada.
 */
export type TipoProjeto = "estatico" | "react" | "python";

function temReactNoPackageJson(conteudo: unknown): boolean {
  if (typeof conteudo !== "string") return false;
  try {
    const pkg = JSON.parse(conteudo);
    const deps = pkg && typeof pkg === "object" ? pkg.dependencies : null;
    return !!deps && typeof deps === "object" && Object.prototype.hasOwnProperty.call(deps, "react");
  } catch {
    return false; // package.json quebrado não decide nada
  }
}

export function tipoProjeto(arquivos: Record<string, string> | null | undefined): TipoProjeto {
  const a = arquivos ?? {};
  const caminhos = Object.keys(a);
  if (temReactNoPackageJson(a["package.json"]) || "src/App.jsx" in a || "src/App.tsx" in a) return "react";
  const nome = (p: string) => p.split("/").pop()!.toLowerCase();
  const temPy = caminhos.some((p) => nome(p).endsWith(".py"));
  const temIndex = caminhos.some((p) => nome(p) === "index.html");
  if (temPy && !temIndex) return "python";
  return "estatico";
}
