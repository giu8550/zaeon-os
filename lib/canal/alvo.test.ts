import { describe, it, expect } from "vitest";
import { resolverAlvos, AGENTE_PADRAO, type MsgResumo } from "./alvo";

const A = "a".repeat(24), B = "b".repeat(24);
const DISP = ["aura", "zaeon", "medicina"];
const h = (autorTipo: "humano" | "agente", autorId: string): MsgResumo => ({ autorTipo, autorId });
const base = { mencoes: [] as string[], historico: [] as MsgResumo[], remetenteId: A, disponiveis: DISP, humanos: 1 };

describe("alvo · @menção manda", () => {
  it("com @, só os marcados respondem (mesmo havendo agente ativo)", () => {
    const r = resolverAlvos({ ...base, mencoes: ["medicina"], historico: [h("humano", A), h("agente", "aura")] });
    expect(r).toEqual({ alvos: ["medicina"], implicito: false });
  });
});

describe("alvo · sem @ · canal de uma pessoa", () => {
  it("continua o último agente que falou, sem limite de tempo", () => {
    const r = resolverAlvos({ ...base, historico: [h("humano", A), h("agente", "aura"), h("humano", A), h("agente", "medicina")] });
    expect(r).toEqual({ alvos: ["medicina"], implicito: true });
  });
  it("primeira mensagem do canal: o agente padrão (Aura) dá o oi", () => {
    expect(AGENTE_PADRAO).toBe("aura");
    expect(resolverAlvos(base)).toEqual({ alvos: ["aura"], implicito: true });
  });
  it("só mensagens humanas até agora: ainda é a Aura quem responde", () => {
    expect(resolverAlvos({ ...base, historico: [h("humano", A), h("humano", A)] }).alvos).toEqual(["aura"]);
  });
  it("padrão null → ninguém responde", () => {
    expect(resolverAlvos({ ...base, padrao: null }).alvos).toEqual([]);
  });
  it("padrão fora dos disponíveis → ninguém responde", () => {
    expect(resolverAlvos({ ...base, disponiveis: ["zaeon"] }).alvos).toEqual([]);
  });
  it("ignora agente que não é mais convocável (cai no padrão)", () => {
    const r = resolverAlvos({ ...base, historico: [h("agente", "sumiu")] });
    expect(r.alvos).toEqual(["aura"]);
  });
  it("vale só o ÚLTIMO agente, não todos", () => {
    const r = resolverAlvos({ ...base, historico: [h("agente", "aura"), h("agente", "zaeon")] });
    expect(r.alvos).toEqual(["zaeon"]);
  });
});

describe("alvo · sem @ · canal com várias pessoas", () => {
  const multi = { ...base, humanos: 2 };
  it("primeiro contato exige @ (ninguém responde)", () => {
    expect(resolverAlvos(multi).alvos).toEqual([]);
  });
  it("atende quem estava conversando com o agente", () => {
    const r = resolverAlvos({ ...multi, remetenteId: A, historico: [h("humano", A), h("agente", "aura")] });
    expect(r.alvos).toEqual(["aura"]);
  });
  it("outra pessoa falando no canal NÃO aciona o agente", () => {
    const r = resolverAlvos({ ...multi, remetenteId: B, historico: [h("humano", A), h("agente", "aura")] });
    expect(r.alvos).toEqual([]);
  });
  it("quem conversava continua, mesmo com outro humano falando no meio", () => {
    const r = resolverAlvos({ ...multi, remetenteId: A, historico: [h("humano", A), h("agente", "aura"), h("humano", B)] });
    expect(r.alvos).toEqual(["aura"]);
  });
  it("com @, qualquer um convoca", () => {
    const r = resolverAlvos({ ...multi, remetenteId: B, mencoes: ["aura"], historico: [h("humano", A), h("agente", "aura")] });
    expect(r.alvos).toEqual(["aura"]);
  });
});
