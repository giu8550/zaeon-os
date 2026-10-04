import { describe, expect, it } from "vitest";
import { LAB_ENTRADA, copyEntrada, ehMsgEntrarEstudo, ehRotaImersiva } from "./loungeHub";

describe("loungeHub", () => {
  it("rota imersiva só no cyberespaço", () => {
    expect(ehRotaImersiva("/lounge-cosmico")).toBe(true);
    expect(ehRotaImersiva("/lounge-cosmico/x")).toBe(true);
    expect(ehRotaImersiva("/lounge-cosmicos")).toBe(false);
    expect(ehRotaImersiva("/")).toBe(false);
    expect(ehRotaImersiva(null)).toBe(false);
  });
  it("contrato zaeon:enter-study: tipo certo e mesma origem", () => {
    expect(ehMsgEntrarEstudo({ type: "zaeon:enter-study" }, "https://a.com", "https://a.com")).toBe(true);
    expect(ehMsgEntrarEstudo({ type: "zaeon:enter-study" }, "https://evil.com", "https://a.com")).toBe(false);
    expect(ehMsgEntrarEstudo({ type: "x" }, "https://a.com", "https://a.com")).toBe(false);
    expect(ehMsgEntrarEstudo("zaeon:enter-study", "https://a.com", "https://a.com")).toBe(false);
  });
  it("entrar no laboratório cai direto na aba de pesquisa", () => { expect(LAB_ENTRADA).toBe("/research-lab?tab=pesquisa"); });
  it("copy por estado de login", () => {
    expect(copyEntrada(true).cta).toMatch(/cyberespaço/);
    expect(copyEntrada(false).badges.length).toBeGreaterThan(0);
  });
});
