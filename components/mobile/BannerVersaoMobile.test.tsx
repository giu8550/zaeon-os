// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const nav = vi.hoisted(() => ({ path: "/research-lab" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
const mm = (matches: boolean) => Object.defineProperty(window, "matchMedia", { configurable: true, value: () => ({ matches, addEventListener() {}, removeEventListener() {} }) });
import { BannerVersaoMobile } from "@/components/mobile/BannerVersaoMobile";

beforeEach(() => { process.env.NEXT_PUBLIC_MOBILE_UI = "1"; nav.path = "/research-lab"; document.cookie = "zaeon%3Aui=; max-age=0; path=/"; mm(true); });
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
});
