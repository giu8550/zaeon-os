// @vitest-environment jsdom
/** #427 · a página de perfil de OUTRA pessoa (o "Ver perfil" do escritório): os dados dela, só leitura. */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
// eslint-disable-next-line @next/next/no-img-element
vi.mock("next/image", () => ({ default: (p: { src: string; alt: string }) => <img src={p.src} alt={p.alt} /> }));
vi.mock("@/components/profile/ModalSkin", () => ({ default: () => <div data-testid="modal-skin" /> }));
vi.mock("@/app/workstation/profiles/NetworkMural", () => ({ default: ({ visitedUserId }: { visitedUserId?: string }) => <div data-testid="mural">{visitedUserId ?? "meu"}</div> }));
vi.mock("@/components/profile/AuraCard", () => ({ default: ({ visitante }: { visitante?: unknown }) => <div data-testid="aura">{visitante ? "aura-visitante" : "aura-minha"}</div> }));

import EditableProfile from "./EditableProfile";

const MARTINEZ = "b".repeat(24);
const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(async (url: string) => {
    if (url === `/api/perfil/${MARTINEZ}`) {
      return new Response(JSON.stringify({
        pessoa: { id: MARTINEZ, name: "Martinez", course: "Engenharia", image: null, eduVerified: true, plan: "free", academicLevel: "Mestrado", inviter: { name: "Padrinho", image: null, course: null }, fundador: false, corpo: null, corArmadura: "#fff" },
        aura: { aura: 10, level: 1, titulo: "x", prox: 1, min: 0, proxMin: 11, validatedSkills: 0, academicLevel: null, academicas: [], parede: [], recent: [] },
        validacoesPendentes: 0,
      }), { status: 200 });
    }
    if (url.startsWith("/api/perfil/")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ name: "Giulia", course: "Computação", image: null, kycStatus: "ok", eduVerified: false, plan: "free", academicLevel: "Graduação", inviter: null }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("EditableProfile · perfil de outra pessoa", () => {
  it("busca o perfil DELA (não o seu) e mostra nome, curso e nível", async () => {
    render(<EditableProfile visitante={MARTINEZ} />);
    expect(await screen.findByText("Martinez")).toBeTruthy();
    expect(screen.getByText("Engenharia")).toBeTruthy();
    expect(screen.getByText("Mestrado")).toBeTruthy();
    expect(fetchSpy.mock.calls.map((c) => c[0])).toEqual([`/api/perfil/${MARTINEZ}`]);
  });

  it("só leitura: sem Editar, sem trocar foto, sem Mudar skin", async () => {
    const { container } = render(<EditableProfile visitante={MARTINEZ} />);
    await screen.findByText("Martinez");
    expect(screen.queryByText("Editar")).toBeNull();
    expect(screen.queryByText("Mudar skin")).toBeNull();
    expect(screen.queryByTestId("modal-skin")).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it("o cartão da AURA em modo visitante e o mural DELA", async () => {
    render(<EditableProfile visitante={MARTINEZ} />);
    expect((await screen.findByTestId("aura")).textContent).toBe("aura-visitante");
    expect(screen.getByTestId("mural").textContent).toBe(MARTINEZ);
    expect(screen.getByText("Convidado(a) por")).toBeTruthy();
  });

  it("'Voltar ao escritório' chama onVoltar", async () => {
    const onVoltar = vi.fn();
    render(<EditableProfile visitante={MARTINEZ} onVoltar={onVoltar} />);
    fireEvent.click(await screen.findByRole("button", { name: /Voltar ao escritório/ }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
  });

  it("perfil que não pode ver (não divide escritório): aviso, sem dados", async () => {
    render(<EditableProfile visitante={"c".repeat(24)} onVoltar={() => {}} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Só dá pra ver o perfil de quem divide um escritório com você");
  });

  it("sem visitante continua o SEU perfil, editável", async () => {
    render(<EditableProfile />);
    expect(await screen.findByText("Editar")).toBeTruthy();
    expect(fetchSpy.mock.calls[0]![0]).toBe("/api/profile");
    expect(screen.getByTestId("mural").textContent).toBe("meu");
  });
});

describe("EditableProfile · #438 erro da foto aparece do lado dela", () => {
  it("arquivo que não é imagem: o aviso aparece perto da foto (não lá no fim da página)", async () => {
    const { container } = render(<EditableProfile />);
    await screen.findByText("Editar");
    const input = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["oi"], "nota.txt", { type: "text/plain" })] } });
    expect((await screen.findByTestId("erro-foto")).textContent).toContain("Escolha uma imagem");
    expect(fetchSpy.mock.calls.some((c) => c[0] === "/api/user/avatar")).toBe(false);
  });
});
