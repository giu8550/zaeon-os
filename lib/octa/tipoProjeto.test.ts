import { describe, it, expect } from "vitest";
import { tipoProjeto } from "./tipoProjeto";

const PKG_REACT = JSON.stringify({ dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { vite: "^5.4.0" } });

describe("tipoProjeto", () => {
  it.each([
    ["vazio", {}, "estatico"],
    ["landing estática", { "index.html": "<h1>oi</h1>", "styles.css": "h1{}" }, "estatico"],
    ["package.json com react em dependencies", { "package.json": PKG_REACT, "src/main.jsx": "" }, "react"],
    ["só src/App.jsx", { "src/App.jsx": "export default () => null" }, "react"],
    ["só src/App.tsx", { "src/App.tsx": "export default () => null" }, "react"],
    // Foco 4: projeto misto — index.html estático + src/App.jsx → react
    ["misto: index.html + src/App.jsx", { "index.html": "<h1>oi</h1>", "styles.css": "", "src/App.jsx": "x" }, "react"],
    ["package.json sem react", { "package.json": JSON.stringify({ dependencies: { lodash: "4" } }), "index.html": "" }, "estatico"],
    ["react só em devDependencies não conta", { "package.json": JSON.stringify({ devDependencies: { react: "18" } }), "index.html": "" }, "estatico"],
    ["package.json quebrado", { "package.json": "{ nada", "index.html": "" }, "estatico"],
    ["App.jsx fora de src/ não conta", { "App.jsx": "x", "index.html": "" }, "estatico"],
    ["python puro", { "main.py": "print(1)" }, "python"],
    ["python em pasta", { "src/jogo.py": "print(1)", "README.md": "" }, "python"],
    [".py junto com index.html → estático", { "main.py": "print(1)", "index.html": "<h1>oi</h1>" }, "estatico"],
    [".py junto com index.html em pasta → estático", { "main.py": "", "site/index.html": "" }, "estatico"],
    ["react vence python", { "main.py": "", "src/App.jsx": "" }, "react"],
  ] as const)("%s → %s", (_n, arquivos, esperado) => {
    expect(tipoProjeto(arquivos as Record<string, string>)).toBe(esperado);
  });

  it("null/undefined → estatico", () => {
    expect(tipoProjeto(null)).toBe("estatico");
    expect(tipoProjeto(undefined)).toBe("estatico");
  });
});
