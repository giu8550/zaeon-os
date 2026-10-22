/**
 * O link RESPONDE? (servidor) — a checagem dos selos do blueprint (app/api/estudos/board/[id]/selos) e das provas do
 * blueprint prático (lib/blueprint/provas-server). Sem seguir redirecionamento (um 3xx conta como vivo), 6 s; 401/403 =
 * existe, mas é privado (conta como vivo).
 *
 * Anti-SSRF de verdade (a URL vem da pessoa e a resposta diz se "respondeu" — sem isso vira um scanner da rede
 * interna): além do filtro da string (lib/scholar/ssrf), o NOME é resolvido no DNS e QUALQUER endereço interno derruba
 * o pedido (loopback, privada, link-local, CGNAT 100.64/10 — a Tailscale —, ULA…); host sem ponto (nome de serviço do
 * Docker) também. A checagem mora no `lookup` do próprio http.request: o socket conecta no IP que foi conferido, então
 * trocar o DNS no meio (rebinding) não passa.
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";

const TIMEOUT_MS = 6000;

/** o IP é da internet pública? (v4 e v6, inclusive o v4 mapeado em v6) */
export function ipPublico(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;     // CGNAT (Tailscale)
    if (a === 169 && b === 254) return false;               // link-local / metadados de nuvem
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (v === 6) {
    const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
    const mapeado = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapeado) return ipPublico(mapeado[1]!);
    if (s === "::" || s === "::1") return false;
    if (/^f[cd]/.test(s) || /^fe[89ab]/.test(s) || s.startsWith("ff")) return false;   // ULA, link-local, multicast
    return true;
  }
  return false;
}

/** o host aceita conexão de fora? (sem ponto = nome interno; IP literal tem que ser público) */
export function hostAceitavel(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "");
  if (isIP(h)) return ipPublico(h);
  return h.includes(".") && !h.endsWith(".internal") && !h.endsWith(".local") && !h.endsWith(".localhost");
}

type CbLookup = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
/** o lookup do http.request que só devolve endereços PÚBLICOS (senão, erro) */
export function lookupSeguro(host: string, opts: { all?: boolean } | number | undefined, cb: CbLookup): void {
  dnsLookup(host, { all: true }, (err, addrs) => {
    if (err) return cb(err, "");
    if (!addrs.length || addrs.some((a) => !ipPublico(a.address))) return cb(Object.assign(new Error("endereço interno"), { code: "EINTERNO" }), "");
    if (typeof opts === "object" && opts?.all) return cb(null, addrs);
    cb(null, addrs[0]!.address, addrs[0]!.family);
  });
}

function status(url: URL, method: "HEAD" | "GET"): Promise<number | null> {
  return new Promise((resolve) => {
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(url, {
      method, lookup: lookupSeguro as never, timeout: TIMEOUT_MS,
      headers: { "User-Agent": "ZaeonLinkCheck/1.0", ...(method === "GET" ? { Range: "bytes=0-1023" } : {}) },
    }, (res) => { resolve(res.statusCode ?? null); res.destroy(); });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
}

export async function vivo(url: string): Promise<boolean> {
  if (!isSafePublicHttpUrl(url)) return false;
  let u: URL; try { u = new URL(url); } catch { return false; }
  if (!hostAceitavel(u.hostname)) return false;
  for (const method of ["HEAD", "GET"] as const) {
    const s = await status(u, method);
    if (s !== null && (s < 400 || s === 401 || s === 403)) return true;   // (401/403: existe, mas é PRIVADO — o repositório fechado conta)
    if (method === "GET") return false;
  }
  return false;
}

/** baixa um PDF de uma URL pública com as mesmas travas (DNS conferido no lookup, rede interna fora), seguindo no
 *  máximo 3 redirecionamentos (cada salto conferido de novo) e parando em `maxBytes` — o PDF de um link vindo de uma
 *  resposta da IA não pode virar SSRF nem estourar a memória. null = não é PDF, grande demais ou não respondeu. */
export async function baixarPdfSeguro(url: string, maxBytes: number, saltos = 3): Promise<Uint8Array | null> {
  if (!isSafePublicHttpUrl(url)) return null;
  let u: URL; try { u = new URL(url); } catch { return null; }
  if (!hostAceitavel(u.hostname)) return null;
  const r = await new Promise<{ status: number; location?: string; bytes?: Uint8Array } | null>((resolve) => {
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "GET", lookup: lookupSeguro as never, timeout: 20_000, headers: { "User-Agent": "ZaeonPdf/1.0", Accept: "application/pdf" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) { resolve({ status, location: res.headers.location }); res.destroy(); return; }
      if (status >= 400 || Number(res.headers["content-length"] ?? 0) > maxBytes) { resolve({ status: 0 }); res.destroy(); return; }
      const partes: Buffer[] = []; let total = 0;
      res.on("data", (c: Buffer) => { total += c.length; if (total > maxBytes) { res.destroy(); resolve({ status: 0 }); return; } partes.push(c); });
      res.on("end", () => resolve({ status, bytes: new Uint8Array(Buffer.concat(partes)) }));
      res.on("error", () => resolve(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
    req.end();
  });
  if (!r) return null;
  if (r.location) { if (saltos <= 0) return null; try { return baixarPdfSeguro(new URL(r.location, u).toString(), maxBytes, saltos - 1); } catch { return null; } }
  const b = r.bytes;
  return b && b.length > 4 && Buffer.from(b.subarray(0, 4)).toString("latin1") === "%PDF" ? b : null;
}
