// @vitest-environment jsdom
/** Tarefa 4 · a prévia React (Sandpack) monta com os arquivos do projeto e devolve os erros pra IDE. O Sandpack é dublê: não roda em jsdom. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// estado que o dublê do Sandpack expõe aos hooks (o teste muda e re-renderiza)
const sp = vi.hoisted(() => ({
  props: null as any,
  previewProps: null as any,
  error: null as null | { message: string; path?: string; line?: number },
  logs: [] as { id: string; method: string; data: unknown[] }[],
}));

vi.mock("@codesandbox/sandpack-react", () => ({
  SandpackProvider: (p: any) => { sp.props = p; return <div data-testid="sandpack">{p.children}</div>; },
  SandpackPreview: (p: any) => { sp.previewProps = p; return <iframe title="prévia react" />; },
  useSandpack: () => ({ sandpack: { status: sp.error ? "idle" : "running", error: sp.error } }),
  useSandpackConsole: () => ({ logs: sp.logs, reset: () => {} }),
}));

import PreviaReact, { arquivosSandpack, htmlParaBundler } from "./PreviaReact";

afterEach(() => { cleanup(); sp.props = null; sp.previewProps = null; sp.error = null; sp.logs = []; });

const VITE = {
  "index.html": '<div id="root"></div><script type="module" src="/src/main.jsx"></script>',
  "package.json": JSON.stringify({ dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" }, devDependencies: { vite: "^5.4.0" } }),
  "vite.config.js": "export default {}",
  "src/main.jsx": "import App from './App.jsx'",
  "src/App.jsx": "export default function App(){ return <h1>oi</h1> }",
  "src/index.css": "h1{color:red}",
};

describe("PreviaReact", () => {
  it("sempre no template react (nunca vite-react/Nodebox): arquivos com / na frente, entrada = src/main.jsx", () => {
    render(<PreviaReact arquivos={VITE} onErros={() => {}} />);
    expect(sp.props.template).toBe("react");
    expect(sp.props.customSetup).toEqual({ entry: "/src/main.jsx" });
    // vite.config sai; index.html e package.json viram o formato do bundler
    expect(Object.keys(sp.props.files).sort()).toEqual(["/package.json", "/public/index.html", "/src/App.jsx", "/src/index.css", "/src/main.jsx"]);
    expect(sp.props.files["/src/App.jsx"]).toBe(VITE["src/App.jsx"]);
    // o botão "abrir no CodeSandbox" mandaria os arquivos do aluno pra fora: desligado
    expect(sp.previewProps.showOpenInCodeSandbox).toBe(false);
  });

  it("index.html do Vite vira /public/index.html sem o <script type=module> e com o #root", () => {
    render(<PreviaReact arquivos={VITE} onErros={() => {}} />);
    const html = sp.props.files["/public/index.html"];
    expect(html).toContain('<div id="root"></div>');
    expect(html).not.toMatch(/<script/i);
    // sem #root no HTML do aluno: entra um antes do </body>
    expect(htmlParaBundler("<html><body><h1>x</h1></body></html>")).toBe('<html><body><h1>x</h1><div id="root"></div></body></html>');
    // sem index.html: um HTML padrão com #root
    const { "index.html": _fora, ...semHtml } = VITE;
    expect(arquivosSandpack(semHtml)["/public/index.html"]).toContain('<div id="root"></div>');
  });

  it("package.json refeito: main = entrada, dependencies do aluno + react-scripts, sem scripts/devDependencies do Vite", () => {
    const pkg = JSON.parse(arquivosSandpack({ ...VITE, "package.json": JSON.stringify({ type: "module", scripts: { dev: "vite" }, dependencies: { react: "^18.2.0", "react-dom": "^18.2.0", "lucide-react": "^0.400.0" }, devDependencies: { vite: "^5" } }) })["/package.json"]);
    expect(pkg).toEqual({ main: "/src/main.jsx", dependencies: { react: "^18.2.0", "react-dom": "^18.2.0", "lucide-react": "^0.400.0", "react-scripts": "^5.0.0" } });
    // só src/App.jsx (sem package.json nem main.jsx): react/react-dom padrão
    const so = JSON.parse(arquivosSandpack({ "src/App.jsx": "x" })["/package.json"]);
    expect(so.dependencies).toMatchObject({ react: "^18.3.1", "react-dom": "^18.3.1" });
  });

  it("DESIGN.md não vai pro iframe do bundler", () => {
    render(<PreviaReact arquivos={{ ...VITE, "DESIGN.md": "marca" }} onErros={() => {}} />);
    expect(sp.props.files["/DESIGN.md"]).toBeUndefined();
  });

  it("repassa erro de compilação e console.error (sem repetir, só os últimos 20)", () => {
    const onErros = vi.fn();
    sp.error = { message: "Unexpected token (3:4)", path: "/src/App.jsx", line: 3 };
    sp.logs = [
      { id: "1", method: "log", data: ["oi"] },
      { id: "2", method: "error", data: ["Falhou:", { a: "b" }] },
      { id: "3", method: "error", data: ["Falhou:", { a: "b" }] }, // repetido
      { id: "4", method: "warn", data: ["cuidado"] },
    ];
    const { rerender } = render(<PreviaReact arquivos={VITE} onErros={onErros} />);
    expect(onErros).toHaveBeenLastCalledWith(["/src/App.jsx:3 Unexpected token (3:4)", 'Falhou: {"a":"b"}']);

    // corrigiu o código: lista vazia volta pra IDE
    sp.error = null; sp.logs = [];
    act(() => rerender(<PreviaReact arquivos={{ ...VITE }} onErros={onErros} />));
    expect(onErros).toHaveBeenLastCalledWith([]);

    // enxurrada de erros: fica só o fim
    sp.logs = Array.from({ length: 30 }, (_, i) => ({ id: String(i), method: "error", data: [`erro ${i}`] }));
    act(() => rerender(<PreviaReact arquivos={{ ...VITE }} onErros={onErros} />));
    const ultimos = onErros.mock.calls.at(-1)![0];
    expect(ultimos).toHaveLength(20);
    expect(ultimos[0]).toBe("erro 10");
    expect(ultimos[19]).toBe("erro 29");
  });

  it("re-render com os mesmos arquivos não troca customSetup/options (senão o Sandpack recompila e apaga o erro)", () => {
    const { rerender } = render(<PreviaReact arquivos={VITE} onErros={() => {}} />);
    const antes = sp.props;
    rerender(<PreviaReact arquivos={{ ...VITE }} onErros={() => {}} />);
    expect(sp.props.customSetup).toBe(antes.customSetup);
    expect(sp.props.options).toBe(antes.options);
  });

  it("erro cujo texto já começa pelo caminho não repete o caminho", () => {
    const onErros = vi.fn();
    sp.error = { message: "/src/App.jsx: boom (1:37)", path: "/src/App.jsx", line: 1 };
    render(<PreviaReact arquivos={VITE} onErros={onErros} />);
    expect(onErros).toHaveBeenLastCalledWith(["/src/App.jsx: boom (1:37)"]);
  });

  it("não chama onErros de novo se os erros não mudaram", () => {
    const onErros = vi.fn();
    sp.logs = [{ id: "1", method: "error", data: ["x"] }];
    const { rerender } = render(<PreviaReact arquivos={VITE} onErros={onErros} />);
    act(() => rerender(<PreviaReact arquivos={{ ...VITE }} onErros={onErros} />));
    expect(onErros).toHaveBeenCalledTimes(1);
  });
});
