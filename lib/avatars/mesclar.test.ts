import { describe, it, expect } from "vitest";

import { mesclarManifestos } from "./mesclar";
import type { AvatarManifest } from "@/lib/avatars/estados";

const m = (agentId: string, extra: Partial<AvatarManifest> = {}): AvatarManifest => ({
  agentId, versao: "1", motor: "sprite", estados: { idle: `/${agentId}/i`, blink: `/${agentId}/b` }, pequeno: {}, ...extra,
});

describe("GET /api/agents/avatars · mescla estático × admin", () => {
  it("o set do admin troca os quadros mas mantém a voz e o Live2D do estático", () => {
    const estatico = { aura: m("aura", { voz: { saudacoes: ["/aura/oi.wav"] } }), nina: m("nina") };
    const banco = { aura: m("aura", { versao: "2", estados: { idle: "/api/aura/i", blink: "/api/aura/b" } }) };
    const r = mesclarManifestos(estatico, banco);
    expect(r.aura.estados.idle).toBe("/api/aura/i");
    expect(r.aura.voz).toEqual({ saudacoes: ["/aura/oi.wav"] });
    expect(r.nina).toEqual(estatico.nina);
  });
  it("agente só do admin (sem estático) entra sem voz", () => {
    const r = mesclarManifestos({}, { lia: m("lia") });
    expect(r.lia.voz).toBeUndefined();
    expect("voz" in r.lia).toBe(false);
  });
});
