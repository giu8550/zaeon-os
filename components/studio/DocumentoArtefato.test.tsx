// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/components/studio/DiagramView", () => ({ default: () => <div data-diagrama /> }));
vi.mock("@/components/aula-interativa/AulaView", () => ({ default: () => <div /> }));
import DocumentoArtefato from "./DocumentoArtefato";

afterEach(() => cleanup());

describe("DocumentoArtefato — a faixa do topo pro tutorial (#638)", () => {
  it("tem a faixa invisível, sem pegar clique, por cima do documento", () => {
    const { container } = render(<DocumentoArtefato doc={{ studioKind: "diagram", artifactId: "a1", titulo: "T" }} />);
    const faixa = container.querySelector('[data-tour="doc-topo"]')!;
    expect(faixa).not.toBeNull();
    expect(faixa.className).toContain("pointer-events-none");
    expect(faixa.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("[data-diagrama]")).not.toBeNull();
  });
});
