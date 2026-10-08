/**
 * lib/leitor/cliente.ts — o ÚNICO caminho de chore para a internet (Fatia 7, G5/G6).
 *
 * Fala SÓ com `LEITOR_PROXY_URL` (o container leitor-proxy: sem credencial, allowlist, sem JS,
 * DNS resolvido lá, IP privado/metadata bloqueado). NUNCA faz `fetch(url)` direto no processo web.
 * Sem LEITOR_PROXY_URL → "leitor_offline" (lei 5: fora do ar se declara, não improvisa).
 */
/** ok = a PÁGINA respondeu 2xx (o proxy respondeu de qualquer forma). */
export type Leitura = {
  ok: boolean; status: number; finalUrl: string; contentType: string; texto: string;
  truncado: boolean; bytes: number; lidoEm: string;
};
export type ErroLeitor = { ok: false; code: "leitor_offline" | "leitor_dominio_fora_da_lista" | "leitor_recusou" | "leitor_falhou"; erro: string; status?: number };

export const LEITOR_MAX_BYTES = 1_048_576;
export const LEITOR_TIMEOUT_MS = 15_000;

export function leitorUrl(env: Record<string, string | undefined> = process.env): string | null {
  const u = env.LEITOR_PROXY_URL?.trim();
  return u ? u.replace(/\/+$/, "") : null;
}

/** Lê UMA URL pelo proxy. Nunca lança. `fetchImpl`/`env` injetáveis (teste). */
export async function lerUrl(
  url: string,
  opts: { maxBytes?: number; timeoutMs?: number; fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; signal?: AbortSignal } = {},
): Promise<Leitura | ErroLeitor> {
  const base = leitorUrl(opts.env);
  if (!base) return { ok: false, code: "leitor_offline", erro: "Leitor fora do ar (LEITOR_PROXY_URL vazio)" };
  const maxBytes = Math.min(Math.max(1, opts.maxBytes ?? LEITOR_MAX_BYTES), LEITOR_MAX_BYTES);
  const timeoutMs = Math.min(Math.max(1_000, opts.timeoutMs ?? LEITOR_TIMEOUT_MS), LEITOR_TIMEOUT_MS);
  const f = opts.fetchImpl ?? fetch;
  try {
    const sinais = [AbortSignal.timeout(timeoutMs + 2_000), ...(opts.signal ? [opts.signal] : [])];
    const r = await f(`${base}/fetch`, {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, maxBytes, timeoutMs }),
      signal: sinais.length > 1 ? AbortSignal.any(sinais) : sinais[0],
    });
    let j: any = null;
    try { j = await r.json(); } catch { /* corpo não-JSON */ }
    if (r.status === 403 && j?.erro === "dominio_fora_da_lista") return { ok: false, code: "leitor_dominio_fora_da_lista", erro: "domínio fora da lista do Leitor", status: 403 };
    // Recusa DO PROXY = HTTP 4xx/5xx dele. Página de destino 404/500 = HTTP 200 do proxy com {ok:false, status} (link_rot precisa).
    if (!r.ok || !j) return { ok: false, code: r.status >= 400 && r.status < 500 ? "leitor_recusou" : "leitor_falhou", erro: String(j?.erro ?? `leitor HTTP ${r.status}`).slice(0, 120), status: r.status };
    return {
      ok: j.ok !== false, status: Number(j.status) || 200, finalUrl: String(j.finalUrl ?? url), contentType: String(j.contentType ?? ""),
      texto: String(j.texto ?? ""), truncado: Boolean(j.truncado), bytes: Number(j.bytes) || 0, lidoEm: String(j.lidoEm ?? new Date().toISOString()),
    };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    return { ok: false, code: /fetch failed|econnrefused|enotfound/i.test(msg) ? "leitor_offline" : "leitor_falhou", erro: msg.slice(0, 120) };
  }
}
