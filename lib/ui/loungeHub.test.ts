import { describe, expect, it } from "vitest";
import { copyEntrada, ehMsgEntrarEstudo, ehMsgSessaoIniciada, ehRotaImersiva, msgConfiavel } from "./loungeHub";

describe("loungeHub", () => {
  it("rota imersiva só no cyberespaço", () => {
    expect(ehRotaImersiva("/lounge-cosmico")).toBe(true);
    expect(ehRotaImersiva("/lounge-cosmico/x")).toBe(true);
    expect(ehRotaImersiva("/lounge-cosmicos")).toBe(false);
    expect(ehRotaImersiva("/")).toBe(false);
    expect(ehRotaImersiva(null)).toBe(false);
  });
  it("mensagens: tipo certo", () => {
    expect(ehMsgEntrarEstudo({ type: "zaeon:enter-study" })).toBe(true);
    expect(ehMsgEntrarEstudo({ type: "zaeon:menu" })).toBe(false);
    expect(ehMsgSessaoIniciada({ type: "zaeon:menu", go: "viajar" })).toBe(true);
    expect(ehMsgSessaoIniciada("zaeon:menu")).toBe(false);
  });
  it("mensagem só da mesma origem", () => {
    const data = { type: "zaeon:menu" };
    expect(msgConfiavel({ origin: "https://a.com", data }, "https://a.com")).toBe(true);
    expect(msgConfiavel({ origin: "https://evil.com", data }, "https://a.com")).toBe(false);
  });
  it("copy por estado de login", () => {
    expect(copyEntrada(true).cta).toMatch(/cyberespaço/);
    expect(copyEntrada(false).badges.length).toBeGreaterThan(0);
  });
});
