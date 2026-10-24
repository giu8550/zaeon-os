import { describe, it, expect } from "vitest";
import { bucketDescoberta, HORARIOS_PADRAO, horariosDoEnv, lembreteHoje, oQueMandar, temRotina, type Lembrete } from "./rotina";

const L = (o: Partial<Lembrete> = {}): Lembrete => ({ id: "l1", texto: "estudar cálculo", minutos: 19 * 60, dias: [1, 2, 3, 4, 5], data: null, ativo: true, ...o });
const base = { dia: 1, dataKey: "2026-10-26", quieto: false, lembretes: [] as Lembrete[], itensDeAgenda: 0, enviadas: new Set<string>(), ultimoProativoMin: null as number | null, descobertasHoje: 0 };
const as = (h: number, m = 0) => h * 60 + m;

describe("quando a Zaeon fala — a regra do produto", () => {
  it("horários do env (3 horários) ou o padrão 08:00/13:30/20:00", () => {
    expect(horariosDoEnv("07:30,12:00,21:15")).toEqual({ manha: 450, tarde: 720, noite: 1275 });
    expect(horariosDoEnv("8h")).toEqual(HORARIOS_PADRAO);
  });
  it("rotina = lembrete OU agenda", () => {
    expect(temRotina({ lembretesAtivos: 0, itensDeAgenda: 0 })).toBe(false);
    expect(temRotina({ lembretesAtivos: 1, itensDeAgenda: 0 })).toBe(true);
    expect(temRotina({ lembretesAtivos: 0, itensDeAgenda: 3 })).toBe(true);
  });
  it("lembrete vale hoje: dias da semana, todo dia, data única", () => {
    expect(lembreteHoje(L(), 1, "x")).toBe(true);
    expect(lembreteHoje(L(), 0, "x")).toBe(false);
    expect(lembreteHoje(L({ dias: [] }), 0, "x")).toBe(true);
    expect(lembreteHoje(L({ data: "2026-10-26" }), 3, "2026-10-26")).toBe(true);
    expect(lembreteHoje(L({ data: "2026-10-27" }), 3, "2026-10-26")).toBe(false);
  });
  it("NÃO INCOMODAR: nunca fala", () => {
    expect(oQueMandar({ ...base, minutoDoDia: as(23), quieto: true })).toBeNull();
  });
  it("lembrete sai na hora (até 20 min depois), uma vez por dia, e tem prioridade", () => {
    const l = L();
    expect(oQueMandar({ ...base, lembretes: [l], minutoDoDia: as(19, 5) })).toMatchObject({ tipo: "lembrete", chave: "zaeon:lembrete:l1:2026-10-26" });
    expect(oQueMandar({ ...base, lembretes: [l], minutoDoDia: as(18, 55) })?.tipo).not.toBe("lembrete");
    expect(oQueMandar({ ...base, lembretes: [l], minutoDoDia: as(19, 30) })).toBeNull();          // passou da janela (e 19:30 não é momento)
    expect(oQueMandar({ ...base, lembretes: [l], minutoDoDia: as(19, 5), enviadas: new Set(["zaeon:lembrete:l1:2026-10-26"]) })).toBeNull();
  });
  it("COM rotina: manhã, tarde e noite (3× ao dia), cada um uma vez, dentro da janela", () => {
    const r = { ...base, lembretes: [L({ minutos: as(6) })] };
    expect(oQueMandar({ ...r, minutoDoDia: as(8, 10) })).toMatchObject({ tipo: "momento", momento: "manha" });
    expect(oQueMandar({ ...r, minutoDoDia: as(13, 45) })).toMatchObject({ tipo: "momento", momento: "tarde" });
    expect(oQueMandar({ ...r, minutoDoDia: as(20, 1) })).toMatchObject({ tipo: "momento", momento: "noite" });
    expect(oQueMandar({ ...r, minutoDoDia: as(11) })).toBeNull();                                // fora de qualquer janela
    expect(oQueMandar({ ...r, minutoDoDia: as(8, 10), enviadas: new Set(["zaeon:manha:2026-10-26"]) })).toBeNull();
    expect(oQueMandar({ ...base, itensDeAgenda: 2, minutoDoDia: as(20, 1) })?.tipo).toBe("momento"); // agenda também é rotina
  });
  it("SEM rotina: a cada 45 min (acordada), uma por bloco, contando as tentativas do dia", () => {
    expect(oQueMandar({ ...base, minutoDoDia: as(10) })).toMatchObject({ tipo: "descoberta", tentativa: 1, chave: `zaeon:descoberta:2026-10-26:${bucketDescoberta(as(10))}` });
    expect(oQueMandar({ ...base, minutoDoDia: as(10), ultimoProativoMin: 30 })).toBeNull();     // falou há 30 min
    expect(oQueMandar({ ...base, minutoDoDia: as(10), ultimoProativoMin: 46, descobertasHoje: 3 })).toMatchObject({ tipo: "descoberta", tentativa: 4 });
    const k = `zaeon:descoberta:2026-10-26:${bucketDescoberta(as(10))}`;
    expect(oQueMandar({ ...base, minutoDoDia: as(10), enviadas: new Set([k]) })).toBeNull();
  });
});
