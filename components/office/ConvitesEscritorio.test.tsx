// @vitest-environment jsdom
/** Peças do convite do escritório (#396, item D) na tela: o "+" (ConvidarForm) e a lista do Privado. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ConvidarForm, ConvitesRecebidos, type ConviteVista } from "./ConvitesEscritorio";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cv = (id: string, nome: string): ConviteVista => ({ id, status: "pendente", dmCanalId: null, pessoa: { id: `p-${id}`, nome, avatar: null } });

describe("ConvidarForm (botão +)", () => {
  it("botão desligado com campo vazio; envia o texto sem espaços e limpa ao dar certo", async () => {
    const onEnviar = vi.fn(async () => ({ ok: true, msg: "Convite enviado." }));
    render(<ConvidarForm onEnviar={onEnviar} />);
    const botao = screen.getByRole("button", { name: "Convidar" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    const campo = screen.getByLabelText("E-mail ou nome de quem convidar") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "  martinez@z.com " } });
    fireEvent.click(botao);
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith("martinez@z.com"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Convite enviado."));
    expect(campo.value).toBe("");
  });

  it("Enter também envia; erro aparece como alerta e mantém o texto", async () => {
    const onEnviar = vi.fn(async () => ({ ok: false, msg: "Ninguém com esse e-mail na Zaeon." }));
    render(<ConvidarForm onEnviar={onEnviar} />);
    const campo = screen.getByLabelText("E-mail ou nome de quem convidar") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "x@z.com" } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Ninguém"));
    expect(campo.value).toBe("x@z.com");
  });
});

describe("ConvidarForm em linha (#423: abre na horizontal, ao lado do +)", () => {
  it("campo e botão na MESMA linha, sem o título/explicação da caixa, e já com o cursor no campo", () => {
    render(<ConvidarForm onEnviar={vi.fn()} variante="linha" />);
    const grupo = screen.getByRole("group", { name: "Convidar pessoa" });
    expect(grupo.className).toContain("flex");
    expect(grupo.className).not.toContain("flex-col");
    expect(screen.queryByText("Convidar pra conversar")).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText("E-mail ou nome de quem convidar"));
  });

  it("envia com Enter e mostra a resposta na própria linha", async () => {
    const onEnviar = vi.fn(async () => ({ ok: true, msg: "Convite enviado para Martinez." }));
    render(<ConvidarForm onEnviar={onEnviar} variante="linha" />);
    const campo = screen.getByLabelText("E-mail ou nome de quem convidar") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: " martinez@z.com " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith("martinez@z.com"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Martinez"));
    expect(campo.value).toBe("");
  });

  it("erro também aparece na linha (inclusive no celular) e mantém o texto", async () => {
    render(<ConvidarForm onEnviar={vi.fn(async () => ({ ok: false, msg: "Ninguém com esse e-mail na Zaeon." }))} variante="linha" />);
    const campo = screen.getByLabelText("E-mail ou nome de quem convidar") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "x@z.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Convidar" }));
    const alerta = await screen.findByRole("alert");
    expect(alerta.className).not.toContain("hidden");
    expect(campo.value).toBe("x@z.com");
  });

  it("Esc fecha", () => {
    const onFechar = vi.fn();
    render(<ConvidarForm onEnviar={vi.fn()} variante="linha" onFechar={onFechar} />);
    fireEvent.keyDown(screen.getByLabelText("E-mail ou nome de quem convidar"), { key: "Escape" });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });
});

describe("ConvitesRecebidos (aba Privado)", () => {
  it("sem convites não desenha nada", () => {
    const { container } = render(<ConvitesRecebidos recebidos={[]} enviados={[]} ocupado={null} onResponder={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("aceitar e recusar chamam com o id certo", () => {
    const onResponder = vi.fn();
    render(<ConvitesRecebidos recebidos={[cv("1", "Martinez"), cv("2", "Ana")]} enviados={[]} ocupado={null} onResponder={onResponder} />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o convite de Martinez" }));
    fireEvent.click(screen.getByRole("button", { name: "Recusar o convite de Ana" }));
    expect(onResponder.mock.calls).toEqual([["1", "aceitar"], ["2", "recusar"]]);
  });

  it("enquanto responde, os botões daquele convite ficam desligados", () => {
    render(<ConvitesRecebidos recebidos={[cv("1", "Martinez")]} enviados={[]} ocupado="1" onResponder={() => {}} />);
    expect((screen.getByRole("button", { name: "Aceitar o convite de Martinez" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("enviados aparecem como 'aguardando', sem botões", () => {
    render(<ConvitesRecebidos recebidos={[]} enviados={[cv("3", "Bia")]} ocupado={null} onResponder={() => {}} />);
    expect(screen.getByText("Bia")).toBeTruthy();
    expect(screen.getByText("aguardando")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
