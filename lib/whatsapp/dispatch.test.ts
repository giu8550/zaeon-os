import { describe, it, expect } from "vitest";
import { agendaForWeekday, agendaFacts, reviewCandidates, deadlineFacts, dueKinds, WEEKDAY_LABEL } from "./dispatch";

const schedule = [
  { id: 1, name: "Cálculo I", teacher: "Ana", room: "B12", days: [1, 3], hour: 8, endHour: 10 },
  { id: 2, name: "Fotossíntese (revisão)", detail: "prova", days: [3], hour: 14, endHour: 15 },
  { id: 3, name: "Física", days: [2], hour: 10, endHour: 12 },
  { id: 4, name: "Sem hora", days: [3] },
];

describe("whatsapp · dispatch (composição dos disparos)", () => {
  it("agendaForWeekday: filtra pelo dia (1=Seg…7=Dom) e ordena por hora", () => {
    const items = agendaForWeekday(schedule, 3);
    expect(items.map((i) => i.name)).toEqual(["Cálculo I", "Fotossíntese (revisão)", "Sem hora"]);
    expect(agendaForWeekday(schedule, 7)).toEqual([]);
    expect(agendaForWeekday(null, 3)).toEqual([]);
    expect(agendaForWeekday("lixo", 3)).toEqual([]);
  });
  it("agendaFacts: frase única com horários e detalhes; vazio quando não há nada", () => {
    expect(agendaFacts(agendaForWeekday(schedule, 3), 3)).toBe(
      "Agenda de hoje (quarta): Cálculo I 8h–10h (Prof. Ana, B12); Fotossíntese (revisão) 14h–15h (prova); Sem hora.",
    );
    expect(agendaFacts([], 7)).toBe("");
    expect(WEEKDAY_LABEL[7]).toBe("domingo");
  });
  it("reviewCandidates: só itens completados exatamente em D+1/3/7/14/30 (revisão espaçada)", () => {
    const now = new Date("2026-09-09T13:00:00Z");
    const d = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const rows = [
      { title: "Fotossíntese", completedAt: d(3) },
      { title: "Mitose", completedAt: d(2) },
      { title: "Newton", completedAt: d(7) },
      { title: "Ontem", completedAt: d(1) },
      { title: "Velho", completedAt: d(31) },
    ];
    expect(reviewCandidates(rows, now).map((r) => `${r.title}:${r.daysAgo}`)).toEqual(["Ontem:1", "Fotossíntese:3", "Newton:7"]);
    expect(reviewCandidates(rows, now, [3])).toHaveLength(1);
  });
  it("deadlineFacts: só prazos nas próximas 48h (e não vencidos)", () => {
    const now = new Date("2026-09-09T13:00:00Z");
    const docs = [
      { id: "a", title: "Relatório de Física", dueAt: new Date("2026-09-10T20:00:00Z") },
      { id: "b", title: "Longe", dueAt: new Date("2026-09-20T20:00:00Z") },
      { id: "c", title: "Vencido", dueAt: new Date("2026-09-08T20:00:00Z") },
    ];
    const f = deadlineFacts(docs, now);
    expect(f.map((x) => x.id)).toEqual(["a"]);
    expect(f[0].text).toMatch(/Relatório de Física/);
    expect(f[0].text).toMatch(/amanhã/);
  });
  it("dueKinds: agenda a partir das 7h, review a partir das 16h, uma vez por dia (dedupe)", () => {
    const tz = "America/Sao_Paulo";
    const at = (h: number) => new Date(`2026-09-09T${String(h + 3).padStart(2, "0")}:05:00Z`); // SP = UTC-3
    expect(dueKinds(at(6), tz, new Set())).toEqual([]);
    expect(dueKinds(at(8), tz, new Set())).toEqual([{ kind: "agenda", dedupeKey: "agenda:2026-09-09" }]);
    expect(dueKinds(at(8), tz, new Set(["agenda:2026-09-09"]))).toEqual([]);
    expect(dueKinds(at(17), tz, new Set(["agenda:2026-09-09"]))).toEqual([{ kind: "review", dedupeKey: "review:2026-09-09" }]);
    expect(dueKinds(at(17), tz, new Set()).map((k) => k.kind)).toEqual(["agenda", "review"]);
  });
});
