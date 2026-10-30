/**
 * lib/scholar/buscaSegura.ts — um GET pra internet PÚBLICA de verdade (#414, revisão). Server-only.
 *
 * O proxy de PDF filtrava só a STRING do endereço (lib/scholar/ssrf): um nome que resolve pra um IP interno (DNS
 * rebinding, ou o PDF "anunciado" por uma página que alguém controla) passava. Aqui o socket usa o `lookupSeguro` do
 * lib/estudos/linkVivo: o nome é resolvido no DNS, qualquer endereço interno derruba o pedido, e a conexão vai pro IP
 * que foi conferido — trocar o DNS no meio não passa. Não segue redirect (quem chama segue e confere cada salto).
 */
import http from "node:http";
import https from "node:https";
import type { Readable } from "node:stream";
import { hostAceitavel, lookupSeguro } from "@/lib/estudos/linkVivo";
import { isSafePublicHttpUrl } from "@/lib/scholar/ssrf";

export type RespostaSegura = { status: number; tipo: string; location: string | null; corpo: Readable };

/** Endereço que nem pode ser tentado (string ou host interno). */
export const enderecoBloqueado = (url: string): boolean => {
  if (!isSafePublicHttpUrl(url)) return true;
  try { return !hostAceitavel(new URL(url).hostname); } catch { return true; }
};

/** O nome resolveu pra um endereço interno (o lookupSeguro recusou). */
export const ehInterno = (e: unknown): boolean => (e as { code?: string })?.code === "EINTERNO";

/** GET sem seguir redirect. Rejeita com o erro de rede (EINTERNO = resolveu pra endereço interno). */
export function buscarSeguro(url: string, headers: Record<string, string>, timeoutMs = 20_000): Promise<RespostaSegura> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const req = mod.request(u, { method: "GET", lookup: lookupSeguro as never, headers }, (res) => {
      const ct = res.headers["content-type"];
      resolve({ status: res.statusCode ?? 0, tipo: String(Array.isArray(ct) ? ct[0] : ct ?? "").toLowerCase(), location: res.headers.location ?? null, corpo: res });
    });
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error(`sem resposta em ${timeoutMs / 1000} s`), { code: "ETIMEDOUT" })));
    req.on("error", reject);
    req.end();
  });
}

/** Lê o corpo como texto, até `max` bytes (a página do artigo; o PDF anunciado fica no <head>). */
export function lerTexto(corpo: Readable, max = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    let total = 0;
    corpo.on("data", (c: Buffer) => {
      total += c.length;
      partes.push(c);
      if (total >= max) { corpo.destroy(); resolve(Buffer.concat(partes).toString("utf8")); }
    });
    corpo.on("end", () => resolve(Buffer.concat(partes).toString("utf8")));
    corpo.on("error", reject);
  });
}
