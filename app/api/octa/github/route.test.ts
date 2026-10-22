import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), conn: vi.fn(), configurado: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/projects/github-user", () => ({ getUserConnection: m.conn, isUserOAuthConfigured: m.configurado }));

import { GET } from "./route";

describe("GET /api/octa/github — estado da conexão do aluno (sem o portão da sala Projetos)", () => {
  beforeEach(() => {
    m.session.mockReset().mockResolvedValue({ user: { email: "a@b.c" } });
    m.conn.mockReset().mockResolvedValue({ connected: true, login: "ana" });
    m.configurado.mockReset().mockReturnValue(true);
  });

  it("sem sessão → 401", async () => {
    m.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("devolve só conectado/login/configurado (nada de token) e consulta pelo email da SESSÃO", async () => {
    const r = await GET();
    expect(await r.json()).toEqual({ conectado: true, login: "ana", configurado: true });
    expect(m.conn).toHaveBeenCalledWith("a@b.c");
  });
});
