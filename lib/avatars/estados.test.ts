import { describe, it, expect } from "vitest";
import { normalizarManifest, quadroDoSinal, quadrosDeFala, proximaPiscada, duracaoSilaba, type EstadoSprite } from "./estados";

const base = { agentId: "Aura", versao: 7, estados: { idle: "/avatars/aura/idle.webp", blink: "/avatars/aura/blink.webp" } };

describe("avatares · manifesto", () => {
  it("normaliza id/versão e cai a miniatura no quadro cheio quando falta", () => {
    const m = normalizarManifest(base)!;
    expect(m.agentId).toBe("aura");
    expect(m.versao).toBe("7");
    expect(m.motor).toBe("sprite");
    expect(m.pequeno.idle).toBe("/avatars/aura/idle.webp");
  });
  it("sem idle+blink não anima (null); descarta estado/URL inválidos", () => {
    expect(normalizarManifest({ agentId: "x", estados: { idle: "/a.webp" } })).toBeNull();
    const m = normalizarManifest({ ...base, estados: { ...base.estados, talk: "javascript:alert(1)", voar: "/v.webp" } })!;
    expect(m.estados.talk).toBeUndefined();
    expect((m.estados as Record<string, string>).voar).toBeUndefined();
    expect(normalizarManifest(null)).toBeNull();
  });
  it("live2d só com modelo de URL válida; expressões filtradas", () => {
    const m = normalizarManifest({ ...base, motor: "live2d", live2d: { model: "/l2d/aura.model3.json", expressoes: { feliz: "smile", lixo: "x" } } })!;
    expect(m.motor).toBe("live2d");
    expect(m.live2d).toEqual({ model: "/l2d/aura.model3.json", expressoes: { feliz: "smile" } });
    expect(normalizarManifest({ ...base, live2d: { model: "ftp://x" } })!.live2d).toBeUndefined();
  });
  it("cor só em #rrggbb", () => {
    expect(normalizarManifest({ ...base, cor: "#6d28d9" })!.cor).toBe("#6d28d9");
    expect(normalizarManifest({ ...base, cor: "red" })!.cor).toBeUndefined();
  });
});

describe("avatares · sinal → quadro", () => {
  const todos = () => true;
  const so = (...e: EstadoSprite[]) => (x: EstadoSprite) => e.includes(x);
  it("cada sinal tem o seu quadro; falta o quadro → idle", () => {
    expect(quadroDoSinal("pensando", false, todos)).toBe("think");
    expect(quadroDoSinal("feliz", false, todos)).toBe("happy");
    expect(quadroDoSinal("feliz", false, so("idle", "smile"))).toBe("smile");
    expect(quadroDoSinal("erro", false, so("idle"))).toBe("idle");
    expect(quadroDoSinal("falando", true, todos)).toBe("idle"); // a boca anima por cima
  });
  it("hover sorri só quando parado", () => {
    expect(quadroDoSinal("idle", true, todos)).toBe("smile");
    expect(quadroDoSinal("pensando", true, todos)).toBe("think");
    expect(quadroDoSinal("idle", false, todos)).toBe("idle");
  });
  it("ciclo da boca usa só os quadros que existem", () => {
    expect(quadrosDeFala(todos)).toEqual(["idle", "talk_half", "talk", "talk_half"]);
    expect(quadrosDeFala(so("idle", "talk"))).toEqual(["idle", "talk"]);
    expect(quadrosDeFala(so("idle", "talk_half"))).toEqual(["idle", "talk_half"]);
    expect(quadrosDeFala(so("idle"))).toEqual(["idle"]);
  });
  it("piscada e sílaba ficam nas faixas humanas", () => {
    expect(proximaPiscada(() => 0)).toEqual({ esperaMs: 2400, dupla: true });
    expect(proximaPiscada(() => 0.999).esperaMs).toBeLessThanOrEqual(6000);
    expect(proximaPiscada(() => 0.5).dupla).toBe(false);
    expect(duracaoSilaba(() => 0)).toBe(90);
    expect(duracaoSilaba(() => 1)).toBe(170);
  });
});
