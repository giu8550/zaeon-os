import { describe, it, expect } from "vitest";
import { resolverAlvos, agenteDaVez, estaForaDaConversa, AGENTE_PADRAO, type MsgResumo } from "./alvo";

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

describe("alvo · #438 agente dispensada sai da conversa", () => {
  const saiu = (agentKey: string): MsgResumo => ({ autorTipo: "sistema", autorId: agentKey });
  // o caso do Martinez: falou com a Zenita, dispensou, e continuou conversando
  const dispensou = [h("humano", A), h("agente", "medicina"), h("humano", A), h("agente", "medicina"), saiu("medicina")];

  it("depois do 'saiu da conversa', sem @ ninguém responde", () => {
    expect(resolverAlvos({ ...base, historico: dispensou }).alvos).toEqual([]);
    expect(resolverAlvos({ ...base, humanos: 2, historico: dispensou }).alvos).toEqual([]);
  });

  it("nem a Aura dá o primeiro oi de novo (já houve conversa com agente)", () => {
    expect(resolverAlvos({ ...base, historico: [h("humano", A), h("agente", "aura"), saiu("aura")] }).alvos).toEqual([]);
  });

  it("chamando com @ ela volta", () => {
    expect(resolverAlvos({ ...base, mencoes: ["medicina"], historico: dispensou }).alvos).toEqual(["medicina"]);
  });

  it("voltou com @ e respondeu: sem @ ela continua sendo a da vez", () => {
    const voltou = [...dispensou, h("humano", A), h("agente", "medicina")];
    expect(resolverAlvos({ ...base, historico: voltou }).alvos).toEqual(["medicina"]);
  });

  it("'fulano entrou' (sistema com o id de uma PESSOA) não conta como saída de agente", () => {
    const entrou = [h("humano", A), h("agente", "aura"), { autorTipo: "sistema", autorId: B }];
    expect(resolverAlvos({ ...base, historico: entrou }).alvos).toEqual(["aura"]);
  });

  it("a tela usa a mesma regra pro 'Zenita responde'", () => {
    expect(agenteDaVez(dispensou, DISP)).toBeNull();
    expect(agenteDaVez([h("humano", A), h("agente", "aura")], DISP)).toBe("aura");
    expect(agenteDaVez([], DISP)).toBeNull();
  });
});

describe("alvo · #440 a agente voltou", () => {
  const saiu: MsgResumo = { autorTipo: "sistema", autorId: "medicina", texto: "Osler saiu da conversa" };
  const voltou: MsgResumo = { autorTipo: "sistema", autorId: "medicina", texto: "Osler voltou para a conversa" };

  it("está fora: saiu e não voltou; voltou ou falou depois → está dentro", () => {
    expect(estaForaDaConversa([h("agente", "medicina"), saiu], "medicina")).toBe(true);
    expect(estaForaDaConversa([h("agente", "medicina"), saiu, voltou], "medicina")).toBe(false);
    expect(estaForaDaConversa([saiu, h("agente", "medicina")], "medicina")).toBe(false);
    expect(estaForaDaConversa([h("agente", "aura")], "medicina")).toBe(false); // nunca entrou: não é "voltar"
    expect(estaForaDaConversa([saiu], "aura")).toBe(false);                   // a saída é de outra agente
  });

  it("a linha 'voltou' não é confundida com 'saiu', e faz dela a agente da vez", () => {
    const hist = [h("humano", A), h("agente", "medicina"), saiu, h("humano", A), voltou];
    expect(resolverAlvos({ ...base, historico: hist }).alvos).toEqual(["medicina"]);
    expect(agenteDaVez(hist, DISP)).toBe("medicina");
  });
});
