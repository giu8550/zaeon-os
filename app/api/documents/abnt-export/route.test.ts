import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ fetch: vi.fn(), session: { user: { email: "a@b.c" } } as any }));
vi.mock("next-auth", () => ({ getServerSession: async () => m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/solana/hooks", () => ({ onWorkFinalized: vi.fn() }));
vi.mock("@/lib/ai/vertex-credentials", () => ({ vertexCredentials: () => ({}), vertexTextClientOpts: () => ({}) }));
vi.mock("@google-cloud/vertexai", () => ({ VertexAI: class { getGenerativeModel() { return { generateContent: async () => { throw new Error("sem vertex no teste"); } }; } } }));

import { POST } from "@/app/api/documents/abnt-export/route";

const conteudo = "# INTRODUÇÃO\n\nEconomizam água (SOUZA, 2020).\n\n# REFERÊNCIAS\n\nSOUZA, Carla. Água e plantas. Revista Botânica, 2020.";
const corpo = (x: any = {}) => ({
  title: "Fotossíntese", content: conteudo, workType: "Artigo", citations: [], author: "Fulano", institution: "", course: "", city: "", year: "",
  format: "docx", parsedSections: [
    { type: "introducao", title: "INTRODUÇÃO", content: "Economizam água (SOUZA, 2020).", subsections: [] },
    { type: "referencias", title: "REFERÊNCIAS", content: "SOUZA, Carla. Água e plantas. Revista Botânica, 2020.", subsections: [] },
  ], ...x,
});
const req = (b: any) => new Request("http://x/api/documents/abnt-export", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });

beforeEach(() => {
  m.fetch.mockReset();
  m.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  vi.stubGlobal("fetch", m.fetch);
});

describe("POST /api/documents/abnt-export — normas", () => {
  it("ABNT sem instituição/cidade = 400 explicando o que falta (a capa precisa)", async () => {
    const r = await POST(req(corpo()));
    expect(r.status).toBe(400);
    expect((await r.json()).faltando).toEqual(["institution", "city"]);
    expect(m.fetch).not.toHaveBeenCalled();
  });
  it("Vancouver sem instituição/cidade/ano exporta: chamada vira [1], referência em campos, sem a seção REFERÊNCIAS no corpo", async () => {
    const r = await POST(req(corpo({ style: "vancouver" })));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("_VANCOUVER.docx");
    const enviado = JSON.parse(m.fetch.mock.calls[0][1].body);
    expect(enviado.style).toBe("vancouver");
    expect(enviado.cover.year).toBe(String(new Date().getFullYear()));
    expect(enviado.sections.map((s: any) => s.title)).toEqual(["INTRODUÇÃO"]);
    expect(enviado.sections[0].content).toBe("Economizam água [1].");
    expect(enviado.references[0]).toMatchObject({ authors: ["SOUZA, Carla"], title: "Água e plantas", venue: "Revista Botânica", year: 2020 });
  });
  it("ABNT completa segue o caminho de sempre (style abnt, referências como vieram)", async () => {
    const r = await POST(req(corpo({ institution: "UFC", city: "Fortaleza", year: "2026" })));
    expect(r.status).toBe(200);
    const enviado = JSON.parse(m.fetch.mock.calls[0][1].body);
    expect(enviado.style).toBe("abnt");
    expect(enviado.sections.map((s: any) => s.title)).toEqual(["INTRODUÇÃO", "REFERÊNCIAS"]);
  });
});
