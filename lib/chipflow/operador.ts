/**
 * lib/chipflow/operador.ts — a superfície de OPERADOR do whatsapp-adapter (whatsmeow) da ChipFlow, rodando na
 * própria Zaeon (docker-compose: wa-adapter). É por ela que um chip NASCE e se conecta: create → QR (PNG) →
 * status até "open". Mensagem NÃO passa por aqui — vai pelo bridge Redis (lib/chipflow/bridge.ts).
 * Contrato (whatsapp-adapter internal/operator/operator.go): Bearer OPERATOR_TOKEN, ids NUMÉRICOS em {id}.
 *   POST   /instance/create {token, instance_id, name, proxy?}   (idempotente por token; conecta em 2º plano)
 *   GET    /instance/{id}/qr        → 200 image/png · 202 ainda gerando · 409 já conectado
 *   GET    /instance/{id}/status    → {state: open|connecting|close|logged_out, jid}
 *   POST   /instance/{id}/logout · DELETE /instance/{id}
 *   POST   /instance/{id}/profile {name?, about?, picture_base64?}   (PR #73 do adapter)
 * Env: WA_OPERATOR_URL (ex.: http://wa-adapter:8090) + WA_OPERATOR_TOKEN.
 */
export type Env = Record<string, string | undefined>;
export type EstadoAdapter = "open" | "connecting" | "close" | "logged_out";
export type Resposta<T> = { ok: true; valor: T } | { ok: false; status: number; erro: string };

const PRAZO_MS = 15_000;

export function operadorConfigurado(env: Env = process.env): boolean {
  return !!(env.WA_OPERATOR_URL?.trim() && env.WA_OPERATOR_TOKEN?.trim());
}

async function chamar<T>(caminho: string, init: RequestInit, ler: (r: Response) => Promise<T>, env: Env, f: typeof fetch): Promise<Resposta<T>> {
  const base = env.WA_OPERATOR_URL?.trim().replace(/\/+$/, "");
  const token = env.WA_OPERATOR_TOKEN?.trim();
  if (!base || !token) return { ok: false, status: 503, erro: "adapter de WhatsApp não configurado (WA_OPERATOR_URL/WA_OPERATOR_TOKEN)" };
  try {
    const r = await f(`${base}${caminho}`, {
      ...init, cache: "no-store",
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!r.ok && r.status !== 202) {
      const corpo = await r.text().catch(() => "");
      let erro = corpo.slice(0, 200);
      try { erro = JSON.parse(corpo)?.error ?? erro; } catch { /* texto cru */ }
      return { ok: false, status: r.status, erro: erro || `HTTP ${r.status}` };
    }
    return { ok: true, valor: await ler(r) };
  } catch (e) {
    return { ok: false, status: 504, erro: `adapter fora do ar: ${String((e as Error)?.message ?? e).slice(0, 120)}` };
  }
}

/** Cria (ou reaproveita, pelo token) a sessão do chip no adapter. Já começa a discar = o QR vem logo. */
export function criarInstancia(o: { instanceId: number; token: string; nome: string }, env: Env = process.env, f: typeof fetch = fetch) {
  return chamar("/instance/create", { method: "POST", body: JSON.stringify({ token: o.token, instance_id: o.instanceId, name: o.nome }) }, async () => true, env, f);
}

/** O QR atual como data-URI PNG; `null` = ainda gerando (202) — o cliente tenta de novo em 1–3 s. 409 = já conectado. */
export function lerQr(instanceId: number, env: Env = process.env, f: typeof fetch = fetch) {
  return chamar<string | null>(`/instance/${instanceId}/qr`, { method: "GET" }, async (r) => {
    if (r.status === 202) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (tipo.includes("application/json")) {          // algumas versões devolvem {qrcode: "data:image/png;base64,…"}
      const j = await r.json().catch(() => ({}));
      return (j?.qrcode as string | undefined) ?? null;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length ? `data:image/png;base64,${buf.toString("base64")}` : null;
  }, env, f);
}

export function lerEstado(instanceId: number, env: Env = process.env, f: typeof fetch = fetch) {
  return chamar<{ state: EstadoAdapter; jid: string }>(`/instance/${instanceId}/status`, { method: "GET" }, async (r) => {
    const j = await r.json();
    return { state: String(j?.state ?? "close") as EstadoAdapter, jid: String(j?.jid ?? "") };
  }, env, f);
}

export function sair(instanceId: number, env: Env = process.env, f: typeof fetch = fetch) {
  return chamar(`/instance/${instanceId}/logout`, { method: "POST" }, async () => true, env, f);
}

export function apagarInstancia(instanceId: number, env: Env = process.env, f: typeof fetch = fetch) {
  return chamar(`/instance/${instanceId}`, { method: "DELETE" }, async () => true, env, f);
}

/** Perfil da própria conta do chip: só o que vier é aplicado. Foto = JPEG (base64 ou data-URI). */
export function editarPerfil(instanceId: number, p: { nome?: string; recado?: string; fotoJpegBase64?: string }, env: Env = process.env, f: typeof fetch = fetch) {
  const corpo: Record<string, string> = {};
  if (p.nome !== undefined) corpo.name = p.nome;
  if (p.recado !== undefined) corpo.about = p.recado;
  if (p.fotoJpegBase64 !== undefined) corpo.picture_base64 = p.fotoJpegBase64;
  return chamar<{ pictureId?: string }>(`/instance/${instanceId}/profile`, { method: "POST", body: JSON.stringify(corpo) }, async (r) => {
    const j = await r.json().catch(() => ({}));
    return { pictureId: j?.picture_id };
  }, env, f);
}

/** "5585999998888@s.whatsapp.net" / "5585…:12@s.whatsapp.net" → "5585999998888" */
export const numeroDoJid = (jid: string): string | null => {
  const m = /^(\d{8,15})(?::\d+)?@s\.whatsapp\.net$/.exec(jid.trim());
  return m ? m[1]! : null;
};
