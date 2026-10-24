import { describe, it, expect, vi } from "vitest";
import { comandoDeLembrete, descreverLembrete, extrairLembretes, normalizarLembretes, pareceRotina } from "./lembretes";

describe("a Zaeon aprende a rotina pela resposta", () => {
  it("só chama o modelo quando a mensagem fala de hora/dia", () => {
    expect(pareceRotina("estudo seg a sex às 19h")).toBe(true);
    expect(pareceRotina("amanhã 8:30 revisar cálculo")).toBe(true);
    expect(pareceRotina("o que é mitose?")).toBe(false);
  });
  it("comandos", () => {
    expect(comandoDeLembrete("meus lembretes")).toBe("listar");
    expect(comandoDeLembrete("Apagar lembretes")).toBe("apagar");
    expect(comandoDeLembrete("quais meus lembretes?")).toBe("listar");
    expect(comandoDeLembrete("lembretes são bons")).toBeNull();
  });
  it("valida o que o modelo devolve: hora HH:MM, dias 0–6, data só se for hoje ou depois", () => {
    const r = normalizarLembretes({ lembretes: [
      { texto: "estudar cálculo", hora: "19:00", dias: [1, 2, 3, 4, 5, 9] },
      { texto: "revisar", hora: "8:30", data: "2026-10-27", dias: [3] },
      { texto: "sem hora", hora: "de manhã" },
      { texto: "passado", hora: "10:00", data: "2026-10-01" },
      { texto: "", hora: "25:00" },
    ] }, "2026-10-26");
    expect(r).toEqual([
      { texto: "estudar cálculo", minutos: 1140, dias: [1, 2, 3, 4, 5], data: null },
      { texto: "revisar", minutos: 510, dias: [], data: "2026-10-27" },
      { texto: "passado", minutos: 600, dias: [], data: null },
    ]);
  });
  it("descreve do jeito que a pessoa entende", () => {
    expect(descreverLembrete({ texto: "estudar", minutos: 1140, dias: [1, 2, 3, 4, 5], data: null })).toBe("seg–sex 19:00 — estudar");
    expect(descreverLembrete({ texto: "ler", minutos: 450, dias: [], data: null })).toBe("todo dia 07:30 — ler");
    expect(descreverLembrete({ texto: "prova", minutos: 480, dias: [], data: "2026-10-27" })).toBe("27/10 08:00 — prova");
  });
  it("extração: filtro antes; modelo falhou = nada (não quebra a conversa)", async () => {
    const ex = vi.fn(async () => ({ lembretes: [{ texto: "estudar", hora: "19:00", dias: [1] }] }));
    expect(await extrairLembretes("oi tudo bem?", { dataKey: "2026-10-26", diaSemana: "segunda" }, ex)).toEqual([]);
    expect(ex).not.toHaveBeenCalled();
    expect(await extrairLembretes("seg 19h estudar", { dataKey: "2026-10-26", diaSemana: "segunda" }, ex)).toHaveLength(1);
    expect(await extrairLembretes("seg 19h", { dataKey: "2026-10-26", diaSemana: "segunda" }, async () => { throw new Error("x"); })).toEqual([]);
  });
});
