import { describe, expect, it } from "vitest";
import { agentesDasSalas } from "./agentesSalas";
import { mergeProfiles, rosterComMentores } from "@/lib/agents/roster";

describe("os agentes do escritório = os das outras salas", () => {
  it("todas as personas que conversam entram (e os mentores não entram sozinhos — só contratados)", () => {
    const roster = mergeProfiles(rosterComMentores([]), []);
    const ks = agentesDasSalas(roster);
    for (const k of ["aura", "nina", "caio", "teo", "zenita", "scholar", "examiner", "zaeon"]) expect(ks).toContain(k);
    expect(ks).not.toContain("abnt_structurer");   // (silencioso: só formata saída)
    expect(ks.every((k) => roster.find((a) => a.agentKey === k)?.tipo === "persona")).toBe(true);
  });
});
