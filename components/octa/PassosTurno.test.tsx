// @vitest-environment jsdom
/** A miniatura da captura que o Octa olhou aparece no passo — só se for JPEG pequeno (validado). */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PassosTurno } from "./PassosTurno";
import type { EventoTurno } from "@/lib/octa/passos";

afterEach(() => { cleanup(); });

const MINI = "/9j/" + "WFla".repeat(100);
const eventos = (miniatura: unknown): EventoTurno[] => [
  { seq: 1, tipo: "tool", dados: { tool: "octa_ver_pagina" } },
  { seq: 2, tipo: "resultado", dados: { tool: "octa_ver_pagina", ok: true } },
  { seq: 3, tipo: "captura", dados: { tool: "octa_ver_pagina", tela: "desktop", largura: 1280, altura: 800, miniatura } },
];

describe("PassosTurno · captura", () => {
  it("mostra a miniatura como <img> data:image/jpeg", () => {
    render(<PassosTurno eventos={eventos(MINI)} vivo={false} />);
    const img = screen.getByRole("img", { name: /Captura da página \(desktop\)/ }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`data:image/jpeg;base64,${MINI}`);
  });

  it("miniatura inválida não vira <img>", () => {
    render(<PassosTurno eventos={eventos("PHN2Zz4=")} vivo={false} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Olhando a página")).toBeTruthy();
  });
});
