import { describe, it, expect } from "vitest";
import { aplicarPerfil, intercalar, montarVitrine, nativosVitrine, type AgenteVitrine } from "./nativos";

const mentor = (slug: string, order: number): AgenteVitrine => ({ slug, name: slug, course: "Curso", tipo: "mentor", order, signatureArtifacts: ["x"] });

describe("vitrine · nativos + mentores", () => {
  it("nativos vêm do roster (nome/linha) com área e entrega de vitrine", () => {
    const n = nativosVitrine();
    expect(n.map((x) => x.slug)).toContain("aura");
    expect(n.find((x) => x.slug === "aura")).toMatchObject({ name: "Aura", course: "Pesquisa", tipo: "nativo" });
    expect(n.some((x) => x.slug === "abnt_structurer")).toBe(false); // silencioso não entra
  });
  it("intercala nativo, mentor, nativo…", () => {
    expect(intercalar<number | string>([1, 2, 3], ["a"])).toEqual([1, "a", 2, 3]);
  });
  it("perfil do Modo CEO sobrepõe só o que foi preenchido", () => {
    const v = nativosVitrine().find((x) => x.slug === "nina")!;
    const r = aplicarPerfil(v, { agentKey: "nina", area: "Estudos+", entrega: [], bio: "", redes: { instagram: "nina" } });
    expect(r.course).toBe("Estudos+");
    expect(r.signatureArtifacts).toEqual(v.signatureArtifacts); // entrega vazia = padrão
    expect(r.tagline).toBe(v.tagline);
    expect(r.redes).toEqual({ instagram: "nina" });
  });
  it("montarVitrine: desativado sai, ordem do Modo CEO vale; sem perfis = todo mundo", () => {
    const ms = [mentor("medicina", 1), mentor("fisica", 2)];
    const perfis = [{ agentKey: "aura", ordem: 5 }, { agentKey: "nina", ordem: 1 }, { agentKey: "fisica", ordem: 0 }];
    const r = montarVitrine(nativosVitrine(), ms, perfis);
    expect(r.nativos.map((x) => x.slug)).toEqual(["nina", "aura"]);
    expect(r.mentores.map((x) => x.slug)).toEqual(["fisica"]); // medicina desativado (não veio)
    expect(montarVitrine(nativosVitrine(), ms, []).mentores).toHaveLength(2);
  });
});
