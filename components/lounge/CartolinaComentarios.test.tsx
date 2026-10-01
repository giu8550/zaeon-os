// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { CartolinaComentarios, Avatar } from "@/components/lounge/CartolinaComentarios";

afterEach(cleanup);
const c = (id: string, texto: string, parentId: string | null = null, nome = "Ana") =>
  ({ id, cardId: "k1", userId: "u", nome, imagem: null, texto, parentId, createdAt: "2026-10-01T12:00:00Z" });

describe("CartolinaComentarios", () => {
  it("é um diálogo rotulado, com respostas aninhadas sob a raiz", () => {
    render(<CartolinaComentarios cardTitulo="Clorofila" comentarios={[c("1", "cai na prova?"), c("2", "cai sim", "1", "Bia")]} podeComentar onEnviar={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Comentários: Clorofila" })).toBeTruthy();
    expect(screen.getByText("cai na prova?")).toBeTruthy();
    expect(screen.getByText("cai sim")).toBeTruthy();
  });
  it("vazio mostra estado vazio", () => {
    render(<CartolinaComentarios cardTitulo="X" comentarios={[]} podeComentar onEnviar={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByText("Nenhum comentário ainda.")).toBeTruthy();
  });
  it("enviar com Enter manda o texto e limpa; Shift+Enter não envia", async () => {
    const onEnviar = vi.fn().mockResolvedValue(true);
    render(<CartolinaComentarios cardTitulo="X" comentarios={[]} podeComentar onEnviar={onEnviar} onFechar={vi.fn()} />);
    const campo = screen.getByLabelText("Escreva um comentário") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "minha dúvida" } });
    fireEvent.keyDown(campo, { key: "Enter", shiftKey: true });
    expect(onEnviar).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: "Enter" });
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith("minha dúvida", null));
    await waitFor(() => expect(campo.value).toBe(""));
  });
  it("falha no envio mantém o texto (não perde o que a pessoa escreveu)", async () => {
    const onEnviar = vi.fn().mockResolvedValue(false);
    render(<CartolinaComentarios cardTitulo="X" comentarios={[]} podeComentar onEnviar={onEnviar} onFechar={vi.fn()} />);
    const campo = screen.getByLabelText("Escreva um comentário") as HTMLTextAreaElement;
    fireEvent.change(campo, { target: { value: "não perca" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalled());
    expect(campo.value).toBe("não perca");
  });
  it("responder pendura na raiz e pode ser cancelado", async () => {
    const onEnviar = vi.fn().mockResolvedValue(true);
    render(<CartolinaComentarios cardTitulo="X" comentarios={[c("1", "raiz")]} podeComentar onEnviar={onEnviar} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "responder" }));
    expect(screen.getByText(/respondendo a/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar resposta" }));
    expect(screen.queryByText(/respondendo a/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "responder" }));
    fireEvent.change(screen.getByLabelText("Escreva um comentário"), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(onEnviar).toHaveBeenCalledWith("ok", "1"));
  });
  it("leitor vê a thread mas não tem campo nem 'responder'", () => {
    render(<CartolinaComentarios cardTitulo="X" comentarios={[c("1", "raiz")]} podeComentar={false} onEnviar={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.queryByLabelText("Escreva um comentário")).toBeNull();
    expect(screen.queryByRole("button", { name: "responder" })).toBeNull();
    expect(screen.getByText(/como leitor/)).toBeTruthy();
  });
  it("Esc e o × fecham", () => {
    const onFechar = vi.fn();
    render(<CartolinaComentarios cardTitulo="X" comentarios={[]} podeComentar onEnviar={vi.fn()} onFechar={onFechar} />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Fechar comentários" }));
    expect(onFechar).toHaveBeenCalledTimes(2);
  });
  it("Avatar: iniciais sem imagem, <img> com imagem", () => {
    const { container, rerender } = render(<Avatar nome="Ana Beatriz Costa" imagem={null} />);
    expect(container.textContent).toBe("AB");
    rerender(<Avatar nome="Ana" imagem="https://x/y.png" />);
    expect(container.querySelector("img")).toBeTruthy();
  });
});
