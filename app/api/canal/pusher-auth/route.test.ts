/**
 * #468 /api/canal/pusher-auth: as mensagens vão por canal PRIVADO e só quem pode ler o escritório assina; a presença
 * ("online") leva só o nome — a foto inteira passava do limite do Pusher e a pessoa sumia da lista.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
const state: { canal: any; user: any; chamadas: any[] } = { canal: null, user: null, chamadas: [] };

vi.mock("@/lib/canal/server", () => ({
  sessaoUsuario: async () => state.user,
  exigirFlag: () => null,
  prisma: { canal: { findUnique: async ({ where }: any) => (where.id === state.canal?.id ? state.canal : null) } },
}));
vi.mock("@/lib/collab/realtime", () => ({
  getPusher: () => ({
    authorizeChannel: (socketId: string, channel: string, data?: unknown) => {
      state.chamadas.push({ socketId, channel, data });
      return { auth: `k:${channel}` };
    },
  }),
}));

import { POST } from "./route";

const FOTO = `data:image/png;base64,${"x".repeat(50_000)}`;
const auth = (channel: string) =>
  POST(new Request("http://x", { method: "POST", body: new URLSearchParams({ socket_id: "123.456", channel_name: channel }).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } }));
const privado = { id: CANAL, ownerId: A, titulo: "t", acesso: "privado", membros: [B], agentes: [], dmCom: null };

beforeEach(() => {
  state.canal = privado;
  state.user = { id: B, name: "Martinez", image: FOTO };
  state.chamadas = [];
});

describe("pusher-auth · #468 canal privado das mensagens", () => {
  it("membro do escritório assina o canal privado", async () => {
    const r = await auth(`private-canal-${CANAL}`);
    expect(r.status).toBe(200);
    expect(state.chamadas).toEqual([{ socketId: "123.456", channel: `private-canal-${CANAL}`, data: undefined }]);
  });
  it("quem não é do escritório privado NÃO assina (antes o canal era público e qualquer um ouvia)", async () => {
    state.user = { id: C, name: "Outra", image: null };
    expect((await auth(`private-canal-${CANAL}`)).status).toBe(403);
    expect(state.chamadas).toEqual([]);
  });
  it("sem login → 401; canal que não é de escritório → 400", async () => {
    expect((await auth(`private-canal-${"e".repeat(24)}`)).status).toBe(403);
    expect((await auth("private-outra-coisa")).status).toBe(400);
    expect((await auth(`canal-${CANAL}`)).status).toBe(400);
    state.user = null;
    expect((await auth(`private-canal-${CANAL}`)).status).toBe(401);
  });
});

describe("pusher-auth · #468 online sem a foto", () => {
  it("a presença leva só o nome — quem tem foto própria cabe no limite e aparece online", async () => {
    expect((await auth(`presence-canal-${CANAL}`)).status).toBe(200);
    const { data } = state.chamadas[0];
    expect(data).toEqual({ user_id: B, user_info: { nome: "Martinez" } });
    expect(JSON.stringify(data).length).toBeLessThan(500);
  });
});
