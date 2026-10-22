import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";
import { GET as PREVIA } from "./[id]/previa/route";
import { carregarIndice, lerDesignMd, palavrasDaMarca } from "@/lib/octa/design/indice";
import { mencionaMarca } from "@/lib/octa/secoes/render";

const req = (u = "http://x/api/octa/design") => new Request(u);

describe("GET /api/octa/design", () => {
  beforeEach(() => { m.session.mockReset(); m.session.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } }); });

  it("sem sessão → 401", async () => {
    m.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("devolve [{id,nome,resumo,clima,escuro}] — um por estilo, sem o texto do DESIGN.md", async () => {
    const r = await GET();
    expect(r.status).toBe(200);
    const lista = await r.json();
    const indice = carregarIndice();
    expect(Array.isArray(lista)).toBe(true);
    expect(lista).toHaveLength(indice.length);
    for (const e of lista) expect(Object.keys(e).sort()).toEqual(["clima", "escuro", "id", "nome", "resumo"]);
    expect(lista[0]).toMatchObject({ id: indice[0].id, nome: indice[0].nome, clima: indice[0].clima, escuro: indice[0].tokens.escuro });
    // nem o markdown nem os tokens vão pro cliente
    const md = lerDesignMd(indice[0].id);
    const trecho = md.split("\n").find((l) => l.trim().length > 60)!;
    expect(JSON.stringify(lista)).not.toContain(trecho);
    expect(JSON.stringify(lista)).not.toContain('"tokens"');
    expect(JSON.stringify(lista)).not.toContain('"cores"');
  });
});

describe("GET /api/octa/design/[id]/previa", () => {
  beforeEach(() => { m.session.mockReset(); m.session.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } }); });

  it("sem sessão → 401; id fora do índice (ou com ../) → 404", async () => {
    m.session.mockResolvedValue(null);
    expect((await PREVIA(req(), { params: { id: "notion" } })).status).toBe(401);
    m.session.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
    expect((await PREVIA(req(), { params: { id: "nao-existe" } })).status).toBe(404);
    expect((await PREVIA(req(), { params: { id: "../../package.json" } })).status).toBe(404);
  });

  it("HTML autossuficiente (CSS inline, sem script) com as cores do estilo e SEM o nome da marca — em todos os estilos", async () => {
    for (const e of carregarIndice()) {
      const r = await PREVIA(req(), { params: { id: e.id } });
      expect(r.status, e.id).toBe(200);
      expect(r.headers.get("content-type")).toContain("text/html");
      const html = await r.text();
      expect(html).toContain("<style>");
      expect(html).not.toContain('href="styles.css"');
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain(e.tokens.cores.fundo);
      expect(mencionaMarca(html, palavrasDaMarca(e)), `${e.id} menciona ${palavrasDaMarca(e).join("/")}`).toBe(false);
    }
  });
});
