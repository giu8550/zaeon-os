/** #438 · /api/user/avatar: a página de Perfil (POST) e a Workstation (PATCH) salvam a foto. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: { email: string | null; salvos: any[] } = { email: null, salvos: [] };
vi.mock("next-auth", () => ({ getServerSession: async () => (state.email ? { user: { email: state.email } } : null) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@prisma/client", () => ({
  PrismaClient: class { user = { update: async (a: any) => { state.salvos.push(a); return {}; } }; },
}));

import { POST, PATCH } from "./route";

const FOTO = "data:image/jpeg;base64," + "A".repeat(1000);
const pedido = (image: unknown) => new Request("http://x/api/user/avatar", { method: "POST", body: JSON.stringify({ image }), headers: { "content-type": "application/json" } });

beforeEach(() => { state.email = "devgiu@z.com"; state.salvos = []; });

describe("trocar a foto de perfil", () => {
  it("POST (a página de Perfil) salva — antes dava 405 e a foto nunca entrava", async () => {
    const r = await POST(pedido(FOTO));
    expect(r.status).toBe(200);
    expect(state.salvos).toEqual([{ where: { email: "devgiu@z.com" }, data: { image: FOTO } }]);
  });
  it("PATCH (a Workstation antiga) continua salvando", async () => {
    expect((await PATCH(pedido(FOTO))).status).toBe(200);
    expect(state.salvos).toHaveLength(1);
  });
  it("não é imagem → 400 com o motivo, sem salvar", async () => {
    const r = await POST(pedido("data:text/html;base64,PGgxPg=="));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("Formato");
    expect(state.salvos).toHaveLength(0);
  });
  it("grande demais → 413, sem salvar", async () => {
    expect((await POST(pedido("data:image/png;base64," + "A".repeat(400_001)))).status).toBe(413);
    expect(state.salvos).toHaveLength(0);
  });
  it("sem login → 401", async () => {
    state.email = null;
    expect((await POST(pedido(FOTO))).status).toBe(401);
  });
});
