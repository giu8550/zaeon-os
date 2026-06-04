// Núcleo do proxy de score (server-side), isolado da rota para ser testável.
// A rota `app/api/quality/route.ts` cuida só de auth e repassa para cá.

import type { ScoreRequest, ScoreResponse } from "@/lib/quality/types";

export type ScoreResult =
  | { ok: true; data: ScoreResponse }
  | { ok: false; offline: boolean; error: string };

export interface RequestScoreOpts {
  engineUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Chama o quality-engine; degrada graciosamente (offline → a UI esconde o termômetro). */
export async function requestScore(
  body: ScoreRequest,
  opts: RequestScoreOpts
): Promise<ScoreResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const upstream = await doFetch(`${opts.engineUrl}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return { ok: false, offline: false, error: `Quality engine error: ${text}` };
    }
    const data = (await upstream.json()) as ScoreResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, offline: true, error: "Quality engine offline" };
  }
}
