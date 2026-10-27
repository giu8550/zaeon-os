/** #629 · /api/onboard/vistos — o "já vi" dos tutoriais na conta. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sessao = vi.hoisted(() => ({ atual: { user: { email: "a@b.c" } } as any }));
const banco = vi.hoisted(() => ({ toursVistos: null as unknown, update: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: vi.fn(async () => sessao.atual) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/src/lib/prisma", () => ({
  prisma: { user: {
    findUnique: vi.fn(async () => ({ toursVistos: banco.toursVistos })),
    update: vi.fn(async (a: any) => { banco.update(a); banco.toursVistos = a.data.toursVistos; return {}; }),
  } },
}));
import { GET, POST, DELETE } from "./route";

const post = (corpo: unknown) => POST(new Request("http://x/api/onboard/vistos", { method: "POST", body: JSON.stringify(corpo) }));

beforeEach(() => { sessao.atual = { user: { email: "a@b.c" } }; banco.toursVistos = null; banco.update.mockClear(); });

describe("#629 · /api/onboard/vistos", () => {
  it("sem login: 401 nos três", async () => {
    sessao.atual = null;
    expect((await GET()).status).toBe(401);
    expect((await post({ itens: ["sala"] })).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
  });
  it("GET devolve só itens conhecidos (o banco pode ter lixo)", async () => {
    banco.toursVistos = ["sala", "xyz", "sala"];
    expect(await (await GET()).json()).toEqual({ vistos: ["sala"] });
  });
  it("POST junta aos já vistos e recusa item desconhecido", async () => {
    banco.toursVistos = ["sala"];
    expect(await (await post({ itens: ["escritorio", "hack"] })).json()).toEqual({ vistos: ["sala", "escritorio"] });
    expect(banco.update).toHaveBeenCalledWith({ where: { email: "a@b.c" }, data: { toursVistos: ["sala", "escritorio"] } });
    expect((await post({ itens: ["hack"] })).status).toBe(400);
  });
  it("DELETE esquece todos (\"Rever tutorial\")", async () => {
    banco.toursVistos = ["sala", "dica:perfil"];
    expect(await (await DELETE()).json()).toEqual({ vistos: [] });
    expect(banco.toursVistos).toEqual([]);
  });
});
