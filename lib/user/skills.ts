/**
 * lib/user/skills.ts — `User.skills` (objeto { writing: {rank,current,next,metricName}, … })
 * → array `[{ id, … }]`, que é o que o workstation espera (casa com DEFAULT_SKILLS por `id`).
 * PURO. Entrada suja (null, array, tipos errados) nunca lança: devolve só o que é válido.
 */
export type SkillRow = { id: string; rank?: string; current?: number; next?: number; metricName?: string };

export function skillsParaLista(raw: unknown): SkillRow[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const out: SkillRow[] = [];
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const s = v as Record<string, unknown>;
    const row: SkillRow = { id };
    if (typeof s.rank === "string") row.rank = s.rank;
    if (typeof s.current === "number" && Number.isFinite(s.current)) row.current = s.current;
    if (typeof s.next === "number" && Number.isFinite(s.next)) row.next = s.next;
    if (typeof s.metricName === "string") row.metricName = s.metricName;
    out.push(row);
  }
  return out;
}
