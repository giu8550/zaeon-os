// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import BolinhaCerebro from "./BolinhaCerebro";

afterEach(() => cleanup());

describe("BolinhaCerebro — a dica do número (#638)", () => {
  it("ativa: a dica diz quanto do percurso já foi aprendido", () => {
    const { getByRole } = render(<BolinhaCerebro estado="ativa" completude={0.384} onClick={() => {}} />);
    const b = getByRole("button");
    expect(b.getAttribute("title")).toBe("Ver mapa · 38% aprendido");
    expect(b.getAttribute("aria-label")).toBe("Ver mapa · 38% aprendido");
    expect(b.textContent).toContain("38");
  });
  it("os outros estados seguem com o nome de sempre", () => {
    const { getByRole } = render(<BolinhaCerebro estado="vazia" onClick={() => {}} />);
    expect(getByRole("button").getAttribute("title")).toBe("Traçar percurso");
  });
});
