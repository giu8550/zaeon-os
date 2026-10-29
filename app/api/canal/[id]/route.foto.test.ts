/** #645: GET /api/canal/[id] — a foto inteira vai uma vez só (não em cada mensagem) e `?desde=` traz só o que chegou. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), B = "b".repeat(24), CANAL = "d".repeat(24);
const FOTO = "data:image/webp;base64," + "x".repeat(20_000);
const state: { pedidos: any[]; pessoasPedidas: string[][] } = { pedidos: [], pessoasPedidas: [] };
const msgs = [
  { id: "m1", canalId: CANAL, autorTipo: "humano", autorId: A, texto: "oi", mencoes: [], createdAt: new Date("2026-10-28T10:00:00Z") },
  { id: "m2", canalId: CANAL, autorTipo: "humano", autorId: A, texto: "tudo bem?", mencoes: [], createdAt: new Date("2026-10-28T10:01:00Z") },
  { id: "m3", canalId: CANAL, autorTipo: "sistema", autorId: B, texto: "Bia entrou no escritório", mencoes: [], createdAt: new Date("2026-10-28T10:02:00Z") },
];

vi.mock("@/lib/canal/server", () => {
  return {
    isObjectId: (v: unknown) => typeof v === "string" && /^[a-f0-9]{24}$/i.test(v),
    sessaoUsuario: async () => ({ id: A, name: "Ana", image: FOTO, email: "a@x", role: null }),
    exigirFlag: () => null,
    agentesDoCanal: async () => [],
    agentesPublicos: (l: any[]) => l,
    // como o paraWire de verdade: a foto da pessoa vai na mensagem (o route é que tira a data:)
    paraWire: (m: any, gente: Map<string, any>) => ({ ...m, createdAt: new Date(m.createdAt).toISOString(), autorNome: gente.get(m.autorId)?.nome ?? "Alguém", autorAvatar: gente.get(m.autorId)?.avatar ?? null }),
    pessoas: async (ids: string[]) => { state.pessoasPedidas.push(ids); return new Map([...new Set(ids)].map((id) => [id, { id, nome: id, avatar: FOTO }])); },
    prisma: {
      canal: { findUnique: async () => ({ id: CANAL, ownerId: A, titulo: "t", acesso: "turma", membros: [B], agentes: [], cartolinaId: null, dmCom: null }) },
      canalMensagem: {
        findMany: async (a: any) => {
          state.pedidos.push(a);
          const gt = a.where.createdAt?.gt;
          return msgs.filter((m) => !gt || m.createdAt > gt).sort((x, y) => +y.createdAt - +x.createdAt);
        },
      },
    },
  };
});

import { GET } from "./route";
const ctx = { params: { id: CANAL } };
beforeEach(() => { state.pedidos = []; state.pessoasPedidas = []; });

describe("GET /api/canal/[id] · #645", () => {
  it("a foto inteira (data:) não vai em cada mensagem — vai uma vez, em `pessoas`", async () => {
    const r = await GET(new Request("http://x"), ctx);
    const j = await r.json();
    expect(j.mensagens.map((m: any) => m.autorAvatar)).toEqual([null, null, null]);
    expect(j.pessoas.find((p: any) => p.id === A).avatar).toBe(FOTO);
    // a foto aparece 1 vez por pessoa no JSON (eu + as pessoas), não 1 por mensagem
    expect(JSON.stringify(j).split(FOTO).length - 1).toBe(3);   // eu, A e B (a Bia também tem foto)
  });
  it("?desde= traz só o que chegou depois, e as pessoas só de quem escreveu isso", async () => {
    const j = await (await GET(new Request(`http://x?desde=${encodeURIComponent("2026-10-28T10:01:00.000Z")}`), ctx)).json();
    expect(j.parcial).toBe(true);
    expect(j.mensagens.map((m: any) => m.id)).toEqual(["m3"]);
    expect(state.pessoasPedidas.at(-1)).toEqual([B]);
  });
  it("?desde= inválido = conversa inteira (como antes)", async () => {
    const j = await (await GET(new Request("http://x?desde=lixo"), ctx)).json();
    expect(j.parcial).toBeUndefined();
    expect(j.mensagens).toHaveLength(3);
  });
});
