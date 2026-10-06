// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/research-lab", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path, useRouter: () => ({ replace: nav.replace }) }));
const mm = (matches: boolean) => Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches, addEventListener() {}, removeEventListener() {} }) });
import { BannerVersaoMobile } from "@/components/mobile/BannerVersaoMobile";

// ?tab=lounge = tela SEM equivalente no /m → só oferece (o redirect padrão vale pras entradas das duas salas)
beforeEach(() => { process.env.NEXT_PUBLIC_MOBILE_UI = "1"; nav.path = "/research-lab"; nav.replace.mockClear(); window.history.pushState({}, "", "/research-lab?tab=lounge"); document.cookie = "zaeon%3Aui=; max-age=0; path=/"; mm(true); });
afterEach(() => { cleanup(); delete process.env.NEXT_PUBLIC_MOBILE_UI; });

describe("BannerVersaoMobile", () => {
  it("oferece no celular numa sala completa; 'Continuar aqui' grava full e some", async () => {
    render(<BannerVersaoMobile />);
    expect(await screen.findByRole("region", { name: "Versão para celular" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar aqui" }));
    expect(document.cookie).toContain("zaeon%3Aui=full");
    expect(screen.queryByRole("region")).toBeNull();
  });
  it("não oferece no desktop, fora das salas, com flag off, ou depois de escolher full", () => {
    mm(false); render(<BannerVersaoMobile />); expect(screen.queryByRole("region")).toBeNull(); cleanup();
    mm(true); nav.path = "/"; render(<BannerVersaoMobile />); expect(screen.queryByRole("region")).toBeNull(); cleanup();
    nav.path = "/research-lab"; delete process.env.NEXT_PUBLIC_MOBILE_UI; render(<BannerVersaoMobile />); expect(screen.queryByRole("region")).toBeNull(); cleanup();
    process.env.NEXT_PUBLIC_MOBILE_UI = "1"; document.cookie = "zaeon%3Aui=full; path=/"; render(<BannerVersaoMobile />); expect(screen.queryByRole("region")).toBeNull();
  });
  it("link aponta pra sala equivalente e grava a preferência mobile", async () => {
    render(<BannerVersaoMobile />);
    const a = await screen.findByRole("link", { name: "Abrir versão mobile" });
    expect(a.getAttribute("href")).toBe("/m/estudos");
    fireEvent.click(a);
    expect(document.cookie).toContain("zaeon%3Aui=mobile");
  });
  it("no celular, a entrada padrão da sala vai direto pro /m (e a pesquisa pro /m/pesquisa)", () => {
    window.history.pushState({}, "", "/research-lab"); render(<BannerVersaoMobile />);
    expect(nav.replace).toHaveBeenCalledWith("/m/estudos"); cleanup(); nav.replace.mockClear();
    window.history.pushState({}, "", "/research-lab?tab=pesquisa"); render(<BannerVersaoMobile />);
    expect(nav.replace).toHaveBeenCalledWith("/m/pesquisa");
  });
  it("não redireciona com 'versão completa' escolhida, no desktop ou com deep-link", () => {
    window.history.pushState({}, "", "/research-lab"); document.cookie = "zaeon%3Aui=full; path=/"; render(<BannerVersaoMobile />); cleanup();
    document.cookie = "zaeon%3Aui=; max-age=0; path=/"; mm(false); render(<BannerVersaoMobile />); cleanup(); mm(true);
    window.history.pushState({}, "", "/research-lab?tab=sala-de-estudos&space=abc"); render(<BannerVersaoMobile />);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
