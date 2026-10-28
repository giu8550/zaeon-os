// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, waitFor } from "@testing-library/react";
import DiagramView from "./DiagramView";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("DiagramView (#640)", () => {
  it("deu erro: mostra 'Tentar de novo' e, clicando, busca de novo e abre", async () => {
    const buscar = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<p>oi</p>" });
    vi.stubGlobal("fetch", buscar);
    const { findByText, container } = render(<DiagramView artifactId="a1" titulo="T" cheio />);
    fireEvent.click(await findByText("Tentar de novo"));
    await waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
    expect(buscar).toHaveBeenCalledTimes(2);
  });
  it("na aba inteira, o botão de abrir fica embaixo (o título do diagrama mora em cima); na resposta, em cima", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "<p>oi</p>" }));
    const cheio = render(<DiagramView artifactId="a1" cheio />);
    await waitFor(() => expect(cheio.container.querySelector("iframe")).not.toBeNull());
    expect(cheio.getByLabelText("Abrir o diagrama numa aba").parentElement!.className).toContain("bottom-2");
    cleanup();
    const bolha = render(<DiagramView artifactId="a1" />);
    await waitFor(() => expect(bolha.container.querySelector("iframe")).not.toBeNull());
    expect(bolha.getByLabelText("Abrir o diagrama numa aba").parentElement!.className).toContain("top-2");
  });
});
