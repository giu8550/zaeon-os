import { describe, it, expect } from "vitest";
import { lerPref, cookiePref, deveOferecerMobile, deveRedirecionarMobile, destinoMobile, ehSalaCompleta, ehRotaMobile } from "@/lib/ui/mobilePref";

describe("mobilePref", () => {
  it("cookie: lê, ignora valor estranho e outros cookies", () => {
    expect(lerPref("a=1; zaeon%3Aui=mobile; b=2")).toBe("mobile");
    expect(lerPref("zaeon:ui=full")).toBe("full");
    expect(lerPref("zaeon:ui=admin")).toBeNull();
    expect(lerPref("")).toBeNull();
    expect(cookiePref("full")).toMatch(/^zaeon%3Aui=full; path=\/; max-age=31536000; samesite=lax$/);
  });
  it("oferece só: flag ligada + celular + sala completa + sem preferência 'full'", () => {
    const base = { flag: true, path: "/research-lab", ehMobile: true, pref: null };
    expect(deveOferecerMobile(base)).toBe(true);
    expect(deveOferecerMobile({ ...base, flag: false })).toBe(false);
    expect(deveOferecerMobile({ ...base, ehMobile: false })).toBe(false);
    expect(deveOferecerMobile({ ...base, pref: "full" })).toBe(false);
    expect(deveOferecerMobile({ ...base, path: "/" })).toBe(false);
    expect(deveOferecerMobile({ ...base, path: "/workstation/student" })).toBe(true);
  });
  it("salas e rota mobile não casam por prefixo solto", () => {
    expect(ehSalaCompleta("/research-labs")).toBe(false);
    expect(ehRotaMobile("/m")).toBe(true);
    expect(ehRotaMobile("/m/estudos")).toBe(true);
    expect(ehRotaMobile("/mentor")).toBe(false);
  });
  it("destino equivalente", () => {
    expect(destinoMobile("/research-lab", "?tab=pesquisa")).toBe("/m/pesquisa");
    expect(destinoMobile("/research-lab", "?tab=sala-de-estudos")).toBe("/m/estudos");
    expect(destinoMobile("/workstation/student")).toBe("/m");
    expect(destinoMobile(null)).toBe("/m");
  });
});

describe("deveRedirecionarMobile", () => {
  const base = { flag: true, path: "/research-lab", search: "", ehMobile: true, pref: null as "mobile" | "full" | null };
  it("celular na entrada padrão das salas → /m", () => {
    expect(deveRedirecionarMobile(base)).toBe(true);
    expect(deveRedirecionarMobile({ ...base, search: "?tab=pesquisa" })).toBe(true);
    expect(deveRedirecionarMobile({ ...base, search: "?tab=sala-de-estudos&sub=chat" })).toBe(true);
    expect(deveRedirecionarMobile({ ...base, pref: "mobile" })).toBe(true);
  });
  it("respeita flag, desktop, 'full', outras abas, deep-links e outras rotas", () => {
    expect(deveRedirecionarMobile({ ...base, flag: false })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, ehMobile: false })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, pref: "full" })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, search: "?tab=profile" })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, search: "?tab=sala-de-estudos&space=1" })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, search: "?sala=tok" })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, path: "/m/estudos" })).toBe(false);
    expect(deveRedirecionarMobile({ ...base, path: "/" })).toBe(false);
  });
});
