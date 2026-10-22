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

import PreviaReact from "./PreviaReact";

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
  it("monta o Sandpack vite-react com os arquivos do projeto, cada um com / na frente", () => {
    render(<PreviaReact arquivos={VITE} onErros={() => {}} />);
    expect(sp.props.template).toBe("vite-react");
    expect(Object.keys(sp.props.files).sort()).toEqual(["/index.html", "/package.json", "/src/App.jsx", "/src/index.css", "/src/main.jsx", "/vite.config.js"]);
    expect(sp.props.files["/src/App.jsx"]).toBe(VITE["src/App.jsx"]);
    // o botão "abrir no CodeSandbox" mandaria os arquivos do aluno pra fora: desligado
    expect(sp.previewProps.showOpenInCodeSandbox).toBe(false);
  });

  it("sem vite.config: template react, com a entrada do projeto", () => {
    const { "vite.config.js": _fora, ...semVite } = VITE;
    render(<PreviaReact arquivos={semVite} onErros={() => {}} />);
    expect(sp.props.template).toBe("react");
    expect(sp.props.customSetup).toEqual({ entry: "/src/main.jsx" });
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

  it("não chama onErros de novo se os erros não mudaram", () => {
    const onErros = vi.fn();
    sp.logs = [{ id: "1", method: "error", data: ["x"] }];
    const { rerender } = render(<PreviaReact arquivos={VITE} onErros={onErros} />);
    act(() => rerender(<PreviaReact arquivos={{ ...VITE }} onErros={onErros} />));
    expect(onErros).toHaveBeenCalledTimes(1);
  });
});
