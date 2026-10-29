import { describe, it, expect } from "vitest";
import {
  REDES, CAPACIDADES_DA_REDE, podeNaRede, ESCOPO_DA_REDE, ehRedeDaOrg, REDES_SOCIAIS,
  estadoPublica, erroTransitorio, LIMITE_TEXTO, assinaturaDe, comAssinatura, adapterCoerente,
  ehRede, ehEstadoCanal, type ChannelAdapter,
} from "./tipos";

describe("canais · contrato das redes", () => {
  it("toda rede declara capacidades, escopo e limite de texto", () => {
    for (const r of REDES) {
      expect(CAPACIDADES_DA_REDE[r].length, r).toBeGreaterThan(0);
      expect(["org", "agente"]).toContain(ESCOPO_DA_REDE[r]);
      expect(LIMITE_TEXTO[r], r).toBeGreaterThan(0);
    }
  });

  it("a assimetria real: LinkedIn sem DM, WhatsApp sem feed", () => {
    expect(podeNaRede("linkedin", "publicar")).toBe(true);
    expect(podeNaRede("linkedin", "dm")).toBe(false);      // API praticamente fechada
    expect(podeNaRede("whatsapp", "dm")).toBe(true);
    expect(podeNaRede("whatsapp", "publicar")).toBe(false); // não é feed
    expect(podeNaRede("x", "publicar")).toBe(true);
    expect(podeNaRede("instagram", "dm")).toBe(true);
  });

  it("Opção A: social é da ORG, WhatsApp é por agente", () => {
    expect(ehRedeDaOrg("instagram")).toBe(true);
    expect(ehRedeDaOrg("x")).toBe(true);
    expect(ehRedeDaOrg("linkedin")).toBe(true);
    expect(ehRedeDaOrg("whatsapp")).toBe(false);
    expect([...REDES_SOCIAIS].sort()).toEqual(["instagram", "linkedin", "x"]);
  });

  it("só `conectado` publica", () => {
    expect(estadoPublica("conectado")).toBe(true);
    for (const e of ["nao_conectado", "conectando", "precisa_autorizar", "restrito", "pausado", "erro"] as const) {
      expect(estadoPublica(e), e).toBe(false);
    }
  });

  it("erro transitório × o que exige humano", () => {
    for (const c of ["rate_limit", "teto_dia", "quiet_hours", "pausado", "rede", "timeout"] as const) expect(erroTransitorio(c), c).toBe(true);
    for (const c of ["auth", "escopo", "capacidade", "pii_bloqueada", "conteudo_recusado"] as const) expect(erroTransitorio(c), c).toBe(false);
  });

  it("guardas de tipo rejeitam lixo", () => {
    expect(ehRede("instagram")).toBe(true);
    expect(ehRede("tiktok")).toBe(false);
    expect(ehEstadoCanal("conectado")).toBe(true);
    expect(ehEstadoCanal("vinculado")).toBe(false);  // nome do AgentChannel, não deste contrato
  });
});

describe("canais · assinatura (Opção A: atribuição obrigatória)", () => {
  it("assina com área quando há", () => {
    expect(assinaturaDe({ nome: "Kekulé", area: "mentor de Farmácia" })).toBe("— Kekulé, mentor de Farmácia · Zaeon");
    expect(assinaturaDe({ nome: "Aura", area: null })).toBe("— Aura · Zaeon");
  });

  it("corta o TEXTO pra caber, nunca a assinatura", () => {
    const longo = "a".repeat(500);
    const s = assinaturaDe({ nome: "Noether", area: "mentora de Matemática" });
    const out = comAssinatura(longo, s, "x");
    expect(out.length).toBeLessThanOrEqual(LIMITE_TEXTO.x);
    expect(out.endsWith(s)).toBe(true);      // a atribuição sobrevive
    expect(out).toMatch(/…\n\n—/);           // o corte é visível
  });

  it("texto curto passa inteiro", () => {
    const out = comAssinatura("Oi.", "— Aura · Zaeon", "linkedin");
    expect(out).toBe("Oi.\n\n— Aura · Zaeon");
  });

  it("rede apertada demais: a atribuição vence o texto", () => {
    const s = "—" + "n".repeat(400);
    const out = comAssinatura("texto", s, "x");
    expect(out.length).toBeLessThanOrEqual(LIMITE_TEXTO.x);
  });
});

describe("canais · adapterCoerente", () => {
  const base = { testar: async () => ({ ok: true }) };

  it("aceita adapter que cumpre exatamente as capacidades da rede", () => {
    const linkedin: ChannelAdapter = { rede: "linkedin", capacidades: ["publicar", "responder"], publicar: async () => ({ ok: true, idExterno: "1" }), responder: async () => ({ ok: true, idExterno: "2" }), ...base };
    expect(adapterCoerente(linkedin)).toBe(true);
  });

  it("recusa adapter que promete capacidade que a rede não tem", () => {
    const ruim: ChannelAdapter = { rede: "linkedin", capacidades: ["publicar", "responder", "dm"] as any, publicar: async () => ({ ok: true, idExterno: "1" }), responder: async () => ({ ok: true, idExterno: "2" }), dm: async () => ({ ok: true, idExterno: "3" }), ...base };
    expect(adapterCoerente(ruim)).toBe(false);
  });

  it("recusa adapter que declara capacidade e não implementa o método", () => {
    const furado: ChannelAdapter = { rede: "linkedin", capacidades: ["publicar", "responder"], publicar: async () => ({ ok: true, idExterno: "1" }), ...base };
    expect(adapterCoerente(furado)).toBe(false);
  });
});
