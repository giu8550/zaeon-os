// @vitest-environment jsdom
/** #423 · o sino do escritório na tela: bolinha, abrir, Aceitar/Recusar e o status de cada convite. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import SinoConvites from "./SinoConvites";
import { montarSino } from "@/lib/canal/sino";

vi.mock("next/dynamic", () => ({ default: () => () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const p = (id: string, nome: string) => ({ id, nome, avatar: null });
const itens = montarSino({
  recebidos: [{ id: "r1", status: "pendente", pessoa: p("m", "Martinez") }],
  enviados: [{ id: "e1", status: "pendente", pessoa: p("a", "Ana") }],
  historico: [
    { id: "h1", status: "aceito", pessoa: p("b", "Bia"), direcao: "enviado" },
    { id: "h2", status: "recusado", pessoa: p("c", "Caio"), direcao: "enviado" },
  ],
});
const base = { itens, contador: 0, aberto: false, onAlternar: () => {}, ocupado: null, onResponder: () => {} };

describe("SinoConvites · botão", () => {
  it("sem novidade: sem bolinha", () => {
    render(<SinoConvites {...base} />);
    expect(screen.getByRole("button", { name: "Notificações" })).toBeTruthy();
  });
  it("com novidade: bolinha com o número", () => {
    render(<SinoConvites {...base} contador={2} />);
    const b = screen.getByRole("button", { name: "Notificações (2 novas)" });
    expect(b.textContent).toContain("2");
  });
  it("mais de 99 vira 99+", () => {
    render(<SinoConvites {...base} contador={150} />);
    expect(screen.getByRole("button").textContent).toContain("99+");
  });
  it("clicar abre/fecha (chama onAlternar)", () => {
    const onAlternar = vi.fn();
    render(<SinoConvites {...base} onAlternar={onAlternar} />);
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }));
    expect(onAlternar).toHaveBeenCalledTimes(1);
  });
  it("fechado: a caixa não aparece", () => {
    render(<SinoConvites {...base} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SinoConvites · caixa aberta", () => {
  it("mostra cada convite com a frase e o status", () => {
    render(<SinoConvites {...base} aberto />);
    const caixa = screen.getByRole("dialog", { name: "Notificações" });
    expect(within(caixa).getByText("Martinez quer conversar com você")).toBeTruthy();
    expect(within(caixa).getByText("Convite para Ana: pendente")).toBeTruthy();
    expect(within(caixa).getByText("Bia aceitou seu convite")).toBeTruthy();
    expect(within(caixa).getByText("Caio recusou seu convite")).toBeTruthy();
    expect(within(caixa).getByText("aceito")).toBeTruthy();
    expect(within(caixa).getByText("recusado")).toBeTruthy();
    expect(within(caixa).getByText("pendente")).toBeTruthy(); // o enviado pra Ana
  });

  it("Aceitar e Recusar chamam com o id certo (só no recebido pendente)", () => {
    const onResponder = vi.fn();
    render(<SinoConvites {...base} aberto onResponder={onResponder} />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o convite de Martinez" }));
    fireEvent.click(screen.getByRole("button", { name: "Recusar o convite de Martinez" }));
    expect(onResponder.mock.calls).toEqual([["r1", "aceitar"], ["r1", "recusar"]]);
    expect(screen.queryByRole("button", { name: /Aceitar o convite de Bia/ })).toBeNull();
  });

  it("enquanto responde, os botões daquele convite ficam desligados", () => {
    render(<SinoConvites {...base} aberto ocupado="r1" />);
    expect((screen.getByRole("button", { name: "Aceitar o convite de Martinez" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sem convites: mensagem de vazio", () => {
    render(<SinoConvites {...base} itens={[]} aberto />);
    expect(screen.getByText("Nenhum convite por aqui ainda.")).toBeTruthy();
  });
});

describe("SinoConvites · #425 data/hora e Limpar", () => {
  const agora = new Date(2026, 9, 16, 22, 30).getTime();
  const comData = montarSino({
    recebidos: [{ id: "r1", status: "pendente", pessoa: p("m", "Martinez"), criadoEm: new Date(agora - 5 * 60_000) }],
    enviados: [],
    historico: [{ id: "h1", status: "aceito", pessoa: p("b", "Bia"), direcao: "enviado", respondidoEm: new Date(2026, 9, 15, 10) }],
  });

  it("cada aviso mostra quando aconteceu", () => {
    render(<SinoConvites {...base} itens={comData} aberto agora={agora} />);
    const linhas = screen.getAllByRole("listitem");
    expect(within(linhas[0]!).getByText("há 5 min").tagName).toBe("TIME");
    expect(within(linhas[1]!).getByText("ontem")).toBeTruthy();
  });

  it("Limpar aparece quando há respondidos e chama onLimpar", () => {
    const onLimpar = vi.fn();
    render(<SinoConvites {...base} itens={comData} aberto agora={agora} onLimpar={onLimpar} />);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(onLimpar).toHaveBeenCalledTimes(1);
  });

  it("só pendentes: sem Limpar (pendente não se limpa)", () => {
    const so = montarSino({ recebidos: [{ id: "r1", status: "pendente", pessoa: p("m", "M") }], enviados: [], historico: [] });
    render(<SinoConvites {...base} itens={so} aberto onLimpar={() => {}} />);
    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });

  it("enquanto limpa, o botão fica desligado", () => {
    render(<SinoConvites {...base} itens={comData} aberto onLimpar={() => {}} limpando />);
    expect((screen.getByRole("button", { name: "Limpar" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
