import { describe, it, expect, vi } from "vitest";
import { responderSemFontes } from "@/lib/scholar/semFontes";
import { OMEGA_SYSTEM } from "@/lib/scholar/prompt";

const web = (rs: any[]) => vi.fn(async () => (rs.length ? { ok: true as const, provider: "searxng" as const, results: rs } : { ok: false as const, code: "web_unavailable" as const, error: "x" }));
const gen = (answer: string) => vi.fn(async () => ({ answer })) as any;

describe("responderSemFontes — nunca beco", () => {
  it("com web: usa os resultados, avisa na 1ª linha e lista as fontes web no fim", async () => {
    const r = await responderSemFontes("o que é X?", { webSearch: web([{ title: "X", url: "https://x.org", snippet: "s" }]), genJson: gen("X é uma coisa [1].") });
    expect(r.origem).toBe("web");
    expect(r.answer.split("\n")[0]).toMatch(/não veio de fontes acadêmicas/i);
    expect(r.answer).toMatch(/X é uma coisa/); expect(r.answer).toMatch(/\[1\] X — https:\/\/x\.org/);
  });
  it("sem web: responde pelo modelo (origem 'modelo') e avisa", async () => {
    const r = await responderSemFontes("o que é X?", { webSearch: web([]), genJson: gen("X é isso.") });
    expect(r.origem).toBe("modelo"); expect(r.answer).toMatch(/conhecimento geral/); expect(r.answer).toMatch(/X é isso/);
  });
  it("o modelo já avisou na 1ª linha → não duplica o aviso", async () => {
    const r = await responderSemFontes("q", { webSearch: web([]), genJson: gen("Isso não veio de fontes acadêmicas indexadas.\nMas é assim.") });
    expect((r.answer.match(/acadêmicas indexadas/g) ?? []).length).toBe(1);
  });
  it("web e modelo fora do ar: mensagem útil, não um 'não encontrei' seco", async () => {
    const r = await responderSemFontes("q", { webSearch: vi.fn(async () => { throw new Error("rede"); }) as any, genJson: vi.fn(async () => { throw new Error("404"); }) as any });
    expect(r.answer).toMatch(/Tente de novo/); expect(r.answer).toMatch(/reformule/);
  });
  it("o prompt do Omega não manda mais parar em 'não encontrei'", () => {
    expect(OMEGA_SYSTEM).toMatch(/ZERO trabalhos: NÃO responda "não encontrei" e pare/);
    expect(OMEGA_SYSTEM).not.toMatch(/diga honestamente que não encontrou/);
  });
});
