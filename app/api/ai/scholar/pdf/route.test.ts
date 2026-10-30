/** GET /api/ai/scholar/pdf (#414): a página do artigo vira o PDF que ela anuncia; o guard anti-SSRF vale pro link achado. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: async () => ({ user: { email: "a@b.c" } }) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
import { GET } from "./route";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);   // "%PDF"
const sites: Record<string, () => Response> = {};
let pedidos: string[] = [];
beforeEach(() => {
  pedidos = [];
  vi.stubGlobal("fetch", vi.fn(async (u: string) => { pedidos.push(u); return (sites[u] ?? (() => new Response("nao", { status: 404 })))(); }));
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of Object.keys(sites)) delete sites[k]; });

const get = (url: string) => GET(new Request(`http://zaeon/api/ai/scholar/pdf?url=${encodeURIComponent(url)}`));
const html = (s: string) => () => new Response(s, { headers: { "content-type": "text/html; charset=utf-8" } });
const pdf = () => () => new Response(PDF, { headers: { "content-type": "application/pdf" } });

describe("proxy de PDF · #414", () => {
  it("PDF direto continua igual", async () => {
    sites["https://x.org/a.pdf"] = pdf();
    const r = await get("https://x.org/a.pdf");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
  });
  it("página do artigo (HTML) → segue o citation_pdf_url e entrega o PDF (antes: 502)", async () => {
    sites["https://revista.org/art/1"] = html(`<head><meta name="citation_pdf_url" content="/art/1.pdf"></head>`);
    sites["https://revista.org/art/1.pdf"] = pdf();
    const r = await get("https://revista.org/art/1");
    expect(r.status).toBe(200);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PDF);
    expect(pedidos).toEqual(["https://revista.org/art/1", "https://revista.org/art/1.pdf"]);
  });
  it("arXiv /abs/ vai direto pro /pdf/", async () => {
    sites["https://arxiv.org/pdf/2401.00001"] = pdf();
    expect((await get("https://arxiv.org/abs/2401.00001")).status).toBe(200);
    expect(pedidos).toEqual(["https://arxiv.org/pdf/2401.00001"]);
  });
  it("a página anuncia um PDF em host PRIVADO → não busca (guard anti-SSRF) e responde 502", async () => {
    sites["https://revista.org/art/2"] = html(`<meta name="citation_pdf_url" content="http://127.0.0.1/segredo.pdf">`);
    const r = await get("https://revista.org/art/2");
    expect(r.status).toBe(502);
    expect(pedidos).toEqual(["https://revista.org/art/2"]);
  });
  it("página sem PDF anunciado, site fora do ar ou que recusa → 502", async () => {
    sites["https://p.org/sem"] = html("<head><title>só a página</title></head>");
    expect((await get("https://p.org/sem")).status).toBe(502);
    sites["https://p.org/recusa"] = () => new Response("forbidden", { status: 403 });
    expect((await get("https://p.org/recusa")).status).toBe(502);
    expect((await get("https://p.org/caiu")).status).toBe(502);
  });
});
