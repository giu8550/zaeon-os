import { describe, it, expect, vi } from "vitest";
import { requestScore } from "@/lib/quality/scoreClient";
import type { ScoreRequest } from "@/lib/quality/types";

const BODY: ScoreRequest = {
  title: "t",
  work_type: "TCC",
  academic_level: "grad",
  sections: [],
};

describe("requestScore", () => {
  it("retorna data em caso de sucesso", async () => {
    const data = { overall: { band: "bom" }, title: {}, sections: [], meta: {} };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    });
    const r = await requestScore(BODY, { engineUrl: "http://e", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.overall.band).toBe("bom");
    expect(fetchImpl).toHaveBeenCalledWith("http://e/score", expect.objectContaining({ method: "POST" }));
  });

  it("marca offline quando o fetch rejeita", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await requestScore(BODY, { engineUrl: "http://e", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.offline).toBe(true);
  });

  it("propaga erro não-offline quando upstream responde !ok", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "boom",
    });
    const r = await requestScore(BODY, { engineUrl: "http://e", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.offline).toBe(false);
      expect(r.error).toContain("boom");
    }
  });
});
