// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import axe from "axe-core";
import { MobileComposer } from "@/components/mobile/MobileComposer";
import { MobileActionsSheet, ACOES_MOBILE } from "@/components/mobile/MobileActionsSheet";
import { MobileHistory } from "@/components/mobile/MobileHistory";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const semViolacoes = async (el: Element) => {
  const r = await axe.run(el, { rules: { "color-contrast": { enabled: false } } }); // jsdom não calcula cor real
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(",")}`)).toEqual([]);
};

describe("MobileComposer", () => {
  it("rotulado, Enter envia, Shift+Enter não, vazio não envia, + abre ações", async () => {
    const onEnviar = vi.fn(); const onMais = vi.fn();
    const { container, rerender } = render(<MobileComposer valor="" onMudar={() => {}} onEnviar={onEnviar} onMais={onMais} placeholder="p" />);
    const campo = screen.getByLabelText("Mensagem");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onEnviar).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Enviar" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<MobileComposer valor="oi" onMudar={() => {}} onEnviar={onEnviar} onMais={onMais} placeholder="p" />);
    fireEvent.keyDown(campo, { key: "Enter", shiftKey: true });
    expect(onEnviar).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(onEnviar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Mais ações" }));
    expect(onMais).toHaveBeenCalled();
    await semViolacoes(container);
  });
  it("desabilitado (Aura respondendo) não envia; 16px no campo (o iOS não dá zoom)", () => {
    const onEnviar = vi.fn();
    render(<MobileComposer valor="oi" onMudar={() => {}} onEnviar={onEnviar} desabilitado placeholder="p" />);
    fireEvent.keyDown(screen.getByLabelText("Mensagem"), { key: "Enter" });
    expect(onEnviar).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Mensagem").className).toContain("text-[16px]");
  });
});

describe("MobileActionsSheet", () => {
  it("diálogo modal rotulado, foco no 1º item, Esc fecha, escolher fecha e dispara", async () => {
    const onFechar = vi.fn(); const onEscolher = vi.fn();
    const { container } = render(<MobileActionsSheet aberto topico="fotossíntese" onFechar={onFechar} onEscolher={onEscolher} />);
    const dlg = screen.getByRole("dialog", { name: "Gerar a partir da conversa" });
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement?.textContent).toContain(ACOES_MOBILE[0].rotulo);
    fireEvent.click(screen.getByRole("button", { name: /Flashcards/ }));
    expect(onEscolher).toHaveBeenCalledWith("flashcards");
    expect(onFechar).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(2);
    await semViolacoes(container);
  });
  it("sem tópico: ações desabilitadas com a explicação; fechado não renderiza", () => {
    const { rerender } = render(<MobileActionsSheet aberto topico="" onFechar={() => {}} onEscolher={() => {}} />);
    expect(screen.getByText(/Pergunte algo primeiro/)).toBeTruthy();
    expect(screen.getAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled).length).toBe(ACOES_MOBILE.length);
    rerender(<MobileActionsSheet aberto={false} topico="" onFechar={() => {}} onEscolher={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("MobileHistory", () => {
  const props = { onFechar: vi.fn(), onAbrirConversa: vi.fn(), onNovaConversa: vi.fn(), onAbrirPesquisa: vi.fn() };
  it("estudos: lista local, nova conversa, abrir; Esc fecha; Tab fica preso no drawer", async () => {
    const { container } = render(<MobileHistory aberto surface="estudos" conversas={[{ id: "c1", titulo: "Luz", at: 1 }]} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Luz" }));
    expect(props.onAbrirConversa).toHaveBeenCalledWith("c1");
    const botoes = screen.getByRole("dialog").querySelectorAll("button");
    (botoes[botoes.length - 1] as HTMLElement).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(botoes[0]);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(botoes[botoes.length - 1]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(props.onFechar).toHaveBeenCalled();
    await semViolacoes(container);
  });
  it("pesquisa: busca as sessões do servidor e marca as em andamento", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ sessions: [{ id: "s1", query: "CRISPR", status: "running" }] })) as any);
    render(<MobileHistory aberto surface="pesquisa" conversas={[]} {...props} />);
    const b = await screen.findByRole("button", { name: /CRISPR/ });
    expect(b.textContent).toContain("em andamento");
    fireEvent.click(b);
    expect(props.onAbrirPesquisa).toHaveBeenCalledWith("s1");
  });
});
