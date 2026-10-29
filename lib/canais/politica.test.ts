import { describe, it, expect } from "vitest";
import {
  podeEnviar, restamHoje, diaBrt, respeitaQuietHours, precisaAprovacao,
  canaisExternosLigados, pausaAposErro, TETO_DIA_PADRAO, type EstadoEnvio,
} from "./politica";

// 14h BRT (17:00Z) = fora da janela de silêncio · 02h BRT (05:00Z) = dentro
const DIA = new Date("2026-10-29T17:00:00Z");
const NOITE = new Date("2026-10-29T05:00:00Z");
const HOJE = diaBrt(DIA);

const canal = (over: Partial<EstadoEnvio> = {}): EstadoEnvio => ({
  rede: "linkedin", estado: "conectado", limiteDia: 2, enviadosHoje: 0, diaContagem: HOJE, ...over,
});

describe("canais · politica · podeEnviar", () => {
  it("canal conectado, dentro do teto → libera e diz quanto resta", () => {
    const v = podeEnviar(canal(), "publicar", DIA);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.restamHoje).toBe(2);
  });

  it("capacidade que a rede não tem é erro de CONTRATO (vem antes de tudo)", () => {
    // canal pausado E sem a capacidade: o motivo devolvido é o de contrato, o mais acionável
    const v = podeEnviar(canal({ estado: "pausado" }), "dm", DIA);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.classe).toBe("capacidade");
  });

  it("kill-switch do canal", () => {
    const v = podeEnviar(canal({ estado: "pausado" }), "publicar", DIA);
    if (!v.ok) expect(v.classe).toBe("pausado");
  });

  it("precisa reautorizar → auth", () => {
    const v = podeEnviar(canal({ estado: "precisa_autorizar" }), "publicar", DIA);
    if (!v.ok) expect(v.classe).toBe("auth");
  });

  it("qualquer estado que não publica → auth com o estado no detalhe", () => {
    const v = podeEnviar(canal({ estado: "erro" }), "publicar", DIA);
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.classe).toBe("auth"); expect(v.detalhe).toContain("erro"); }
  });

  it("pausa por erro recente bloqueia; pausa vencida não", () => {
    const futuro = new Date(DIA.getTime() + 60_000);
    const passado = new Date(DIA.getTime() - 60_000);
    expect(podeEnviar(canal({ pausadoAte: futuro }), "publicar", DIA).ok).toBe(false);
    expect(podeEnviar(canal({ pausadoAte: passado }), "publicar", DIA).ok).toBe(true);
    expect(podeEnviar(canal({ pausadoAte: "data-invalida" }), "publicar", DIA).ok).toBe(true);
  });

  it("teto do dia", () => {
    const v = podeEnviar(canal({ enviadosHoje: 2 }), "publicar", DIA);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.classe).toBe("teto_dia");
  });

  it("contagem de ONTEM não conta pra hoje", () => {
    const c = canal({ enviadosHoje: 99, diaContagem: "2026-10-28" });
    expect(restamHoje(c, DIA)).toBe(2);
    expect(podeEnviar(c, "publicar", DIA).ok).toBe(true);
  });

  it("sem diaContagem, a contagem é ignorada (nunca trava por dado faltando)", () => {
    expect(restamHoje(canal({ enviadosHoje: 5, diaContagem: null }), DIA)).toBe(2);
  });

  it("quiet hours vale pra DM/resposta, NÃO pra publicar", () => {
    expect(respeitaQuietHours("dm")).toBe(true);
    expect(respeitaQuietHours("responder")).toBe(true);
    expect(respeitaQuietHours("publicar")).toBe(false);
    // de madrugada: publicar no feed passa; responder alguém não
    expect(podeEnviar(canal(), "publicar", NOITE).ok).toBe(true);
    const r = podeEnviar(canal({ rede: "x" }), "responder", NOITE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.classe).toBe("quiet_hours");
  });

  it("de dia, responder passa", () => {
    expect(podeEnviar(canal({ rede: "x" }), "responder", DIA).ok).toBe(true);
  });
});

describe("canais · politica · aprovação e flags", () => {
  it("aprovação humana é o DEFAULT", () => {
    expect(precisaAprovacao({}, {})).toBe(true);
    expect(precisaAprovacao({ autoPublicar: false }, {})).toBe(true);
    expect(precisaAprovacao({ autoPublicar: true }, {})).toBe(false);
  });

  it("CANAIS_AUTO_PUBLICAR=0 vence o opt-in do canal (trava global)", () => {
    expect(precisaAprovacao({ autoPublicar: true }, { CANAIS_AUTO_PUBLICAR: "0" })).toBe(true);
    for (const v of ["off", "false", "nao", "não"]) {
      expect(precisaAprovacao({ autoPublicar: true }, { CANAIS_AUTO_PUBLICAR: v }), v).toBe(true);
    }
  });

  it("CANAIS_EXTERNOS: ligado por default, 0 desliga", () => {
    expect(canaisExternosLigados({})).toBe(true);
    expect(canaisExternosLigados({ CANAIS_EXTERNOS: "1" })).toBe(true);
    for (const v of ["0", "off", "false", "nao", "não"]) expect(canaisExternosLigados({ CANAIS_EXTERNOS: v }), v).toBe(false);
  });

  it("pausa pós-erro: auth/escopo não passam com o tempo (0); rate_limit é a mais longa", () => {
    expect(pausaAposErro("auth")).toBe(0);
    expect(pausaAposErro("escopo")).toBe(0);
    expect(pausaAposErro("rate_limit")).toBeGreaterThan(pausaAposErro("rede"));
    expect(pausaAposErro("desconhecido")).toBeGreaterThan(0);
  });

  it("tetos padrão são conservadores e existem pra toda rede", () => {
    expect(TETO_DIA_PADRAO.linkedin).toBeLessThanOrEqual(TETO_DIA_PADRAO.x);
    expect(TETO_DIA_PADRAO.whatsapp).toBe(20);   // igual ao default de AgentChannel.limiteDia
    for (const t of Object.values(TETO_DIA_PADRAO)) expect(t).toBeGreaterThan(0);
  });
});
