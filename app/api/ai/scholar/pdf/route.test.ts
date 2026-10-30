/** GET /api/ai/scholar/pdf (#414): a página do artigo vira o PDF que ela anuncia; toda busca confere o IP de verdade. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { email: "a@b.c" } }) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));

type Site = { status?: number; tipo?: string; corpo?: string | Uint8Array; location?: string; erro?: string };
const sites: Record<string, Site> = {};
let pedidos: string[] = [];
vi.mock("@/lib/scholar/buscaSegura", async () => {
  const real = await vi.importActual<typeof import("@/lib/scholar/buscaSegura")>("@/lib/scholar/buscaSegura");
  return {
    ...real,
    // o nome "rebind.example" resolve pra IP interno: o lookupSeguro de verdade recusa com EINTERNO
    buscarSeguro: async (u: string) => {
      pedidos.push(u);
      if (new URL(u).hostname === "rebind.example") throw Object.assign(new Error("endereço interno"), { code: "EINTERNO" });
      const s = sites[u];
      if (!s) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
      if (s.erro) throw Object.assign(new Error(s.erro), { code: s.erro });
      return { status: s.status ?? 200, tipo: s.tipo ?? "", location: s.location ?? null, corpo: Readable.from([Buffer.from(s.corpo ?? "")]) };
    },
  };
});
import { GET } from "./route";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);   // "%PDF"
const get = (url: string) => GET(new Request(`http://zaeon/api/ai/scholar/pdf?url=${encodeURIComponent(url)}`));
const html = (s: string): Site => ({ tipo: "text/html; charset=utf-8", corpo: s });
const pdf = (): Site => ({ tipo: "application/pdf", corpo: PDF });
let avisos: unknown[][] = [];
beforeEach(() => { pedidos = []; avisos = []; vi.spyOn(console, "warn").mockImplementation((...a) => { avisos.push(a); }); });
afterEach(() => { vi.restoreAllMocks(); for (const k of Object.keys(sites)) delete sites[k]; });

describe("proxy de PDF · #414", () => {
  it("PDF direto continua igual", async () => {
    sites["https://x.org/a.pdf"] = pdf();
    const r = await get("https://x.org/a.pdf");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PDF);
  });
  it("página do artigo (HTML) → segue o citation_pdf_url e entrega o PDF (antes: 502)", async () => {
    sites["https://revista.org/art/1"] = html(`<head><meta name="citation_pdf_url" content="/art/1.pdf"></head>`);
    sites["https://revista.org/art/1.pdf"] = pdf();
    const r = await get("https://revista.org/art/1");
    expect(r.status).toBe(200);
    expect(pedidos).toEqual(["https://revista.org/art/1", "https://revista.org/art/1.pdf"]);
  });
  it("os links da página são resolvidos contra o endereço FINAL (depois do redirect)", async () => {
    sites["https://doi.org/10.1/x"] = { status: 302, location: "https://editora.org/artigos/x" };
    sites["https://editora.org/artigos/x"] = html(`<meta name="citation_pdf_url" content="x.pdf">`);
    sites["https://editora.org/artigos/x.pdf"] = pdf();
    expect((await get("https://doi.org/10.1/x")).status).toBe(200);
  });
  it("revisão: o 1º PDF anunciado não é PDF → tenta o seguinte", async () => {
    sites["https://r.org/p"] = html(`<meta name="citation_pdf_url" content="/login"><link rel="alternate" type="application/pdf" href="/arquivo.pdf">`);
    sites["https://r.org/login"] = html("<form>faça login</form>");
    sites["https://r.org/arquivo.pdf"] = pdf();
    expect((await get("https://r.org/p")).status).toBe(200);
    expect(pedidos).toEqual(["https://r.org/p", "https://r.org/login", "https://r.org/arquivo.pdf"]);
  });
  it("arXiv /abs/ vai direto pro /pdf/", async () => {
    sites["https://arxiv.org/pdf/2401.00001"] = pdf();
    expect((await get("https://arxiv.org/abs/2401.00001")).status).toBe(200);
    expect(pedidos).toEqual(["https://arxiv.org/pdf/2401.00001"]);
  });
  it("anti-SSRF: PDF anunciado em IP interno LITERAL nem é buscado; nome que RESOLVE pra interno (rebinding) é barrado", async () => {
    sites["https://revista.org/art/2"] = html(`<meta name="citation_pdf_url" content="http://127.0.0.1/segredo.pdf"><meta name="citation_pdf_url" content="https://rebind.example/s.pdf">`);
    const r = await get("https://revista.org/art/2");
    expect(r.status).toBe(502);
    expect(pedidos).toEqual(["https://revista.org/art/2", "https://rebind.example/s.pdf"]);   // o 127.0.0.1 nem é tentado
    expect((await get("https://rebind.example/doc.pdf")).status).toBe(403);                  // o endereço pedido direto
  });
  it("revisão: falha da fonte vai pro log (dá pra diferenciar timeout, recusa e 'não é PDF') e responde 502", async () => {
    sites["https://p.org/lento"] = { erro: "ETIMEDOUT" };
    expect((await get("https://p.org/lento")).status).toBe(502);
    sites["https://p.org/recusa"] = { status: 403, tipo: "text/html", corpo: "forbidden" };
    expect((await get("https://p.org/recusa")).status).toBe(502);
    sites["https://p.org/sem"] = html("<head><title>só a página</title></head>");
    expect((await get("https://p.org/sem")).status).toBe(502);
    const log = avisos.map((a) => a.join(" "));
    expect(log.some((l) => l.includes("p.org") && l.includes("ETIMEDOUT"))).toBe(true);
    expect(log.some((l) => l.includes("p.org") && l.includes("403"))).toBe(true);
  });
});
