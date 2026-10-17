// @vitest-environment jsdom
/** #427 · o cartão da AURA no perfil de OUTRA pessoa: só leitura e sem nada dos cérebros. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AuraCard, { type AuraVisitante } from "./AuraCard";

vi.mock("@/components/solana/CredencialCard", () => ({ default: ({ titulo }: { titulo: string }) => <div>{titulo}</div> }));
vi.mock("@/components/solana/SolanaMark", () => ({ default: () => null }));

const fetchSpy = vi.fn();
beforeEach(() => { fetchSpy.mockReset(); vi.stubGlobal("fetch", fetchSpy); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const visitante: AuraVisitante = {
  aura: {
    aura: 175, level: 2, titulo: "Aprendiz", prox: 25, min: 150, proxMin: 200,
    validatedSkills: 1, academicLevel: "Mestrado",
    academicas: [{ id: "t1", nivel: "mestrado", area: "Engenharia", instituicao: "USP", metodo: "documento", status: "verificado", verifiedAt: "2026-10-01T00:00:00Z" }],
    parede: [{ id: "k1", type: "academic", title: "Mestrado em Engenharia", assetId: null, network: "devnet", issuedAt: "2026-10-02T00:00:00Z" }],
    recent: [{ id: "e2", source: "credential_verified", amount: 100, reason: "Título verificado: Mestrado", at: "2026-10-15T00:00:00Z" }],
  },
  validacoesPendentes: 3,
};

describe("AuraCard · perfil de outra pessoa", () => {
  it("mostra AURA, nível, títulos, atestados e o extrato que veio pronto", () => {
    render(<AuraCard visitante={visitante} />);
    expect(screen.getByText("175")).toBeTruthy();
    // o título acadêmico ("Mestrado em Engenharia — USP") e o atestado ("Mestrado em Engenharia")
    expect(screen.getByText("Mestrado em Engenharia — USP")).toBeTruthy();
    expect(screen.getByText("Mestrado em Engenharia")).toBeTruthy();
    expect(screen.getByText("Título verificado: Mestrado")).toBeTruthy();
    expect(screen.getByText("habilidades validadas")).toBeTruthy();
  });

  it("não busca nada sozinho (não chama a AURA do próprio usuário, nem as filas)", () => {
    render(<AuraCard visitante={visitante} />);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cérebros privados: sem a seção e sem o contador 'cérebros completos'", () => {
    const { container } = render(<AuraCard visitante={visitante} />);
    expect(container.textContent).not.toMatch(/Cérebros ·|cérebros completos/i);
  });

  it("só leitura: sem o formulário de registrar título e sem as filas de verificação", () => {
    const { container } = render(<AuraCard visitante={visitante} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByPlaceholderText(/instituição/)).toBeNull();
    expect(container.textContent).not.toMatch(/registrar|Fila de verificação|aprovar|rejeitar/i);
  });

  it("validações de estudo: só o número", () => {
    render(<AuraCard visitante={visitante} />);
    expect(screen.getByTestId("validacoes-visitante").textContent).toBe("Validações de estudo · 3");
  });

  it("AURA desligada pra essa pessoa: o cartão não aparece", () => {
    const { container } = render(<AuraCard visitante={{ aura: null, validacoesPendentes: null }} />);
    expect(container.innerHTML).toBe("");
  });
});
