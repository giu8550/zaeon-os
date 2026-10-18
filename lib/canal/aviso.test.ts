/**
 * #438 · o aviso de mensagem nova em tempo real sempre cabe no Pusher (10 KB). O caso real: a foto do Martinez
 * guardada inteira (data:image… de 13 KB) fazia a mensagem dele não chegar ao vivo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { avisoDaMensagem, bytesDoJson, comFotoDaLista, ehFotoInteira, LIMITE_AVISO_BYTES } from "./aviso";
import type { MensagemWire } from "./wire";

const FOTO_13KB = "data:image/jpeg;base64," + "A".repeat(13 * 1024);
const msg = (over: Partial<MensagemWire> = {}): MensagemWire => ({
  id: "m1", canalId: "c1", autorTipo: "humano", autorId: "martinez", texto: "eu quero essa gata pra mim ><", mencoes: [],
  createdAt: "2026-10-18T15:37:00.000Z", autorNome: "Martinez", autorAvatar: FOTO_13KB, ...over,
});

describe("aviso em tempo real · tamanho", () => {
  it("o caso do Martinez: com a foto inteira o aviso passava do limite do Pusher", () => {
    expect(bytesDoJson(msg())).toBeGreaterThan(10 * 1024);
  });

  it("sem a foto inteira, a mensagem dele cabe e vai COMPLETA (texto, nome)", () => {
    const a = avisoDaMensagem(msg());
    expect(bytesDoJson(a)).toBeLessThanOrEqual(LIMITE_AVISO_BYTES);
    expect(a).toMatchObject({ id: "m1", texto: "eu quero essa gata pra mim ><", autorNome: "Martinez", autorAvatar: null });
    expect(a.cortada).toBeUndefined();
  });

  it("foto por link (Google, agente) continua indo no aviso", () => {
    const link = "https://lh3.googleusercontent.com/a/ACg8ocJ-giulia=s96-c";
    expect(avisoDaMensagem(msg({ autorAvatar: link })).autorAvatar).toBe(link);
    expect(avisoDaMensagem(msg({ autorTipo: "agente", autorId: "zenita", autorAvatar: "/avatars/zenita.png" })).autorAvatar).toBe("/avatars/zenita.png");
  });

  it("texto enorme (ex.: resposta longa de agente): vai um aviso LEVE, sem o texto, e a tela busca a conversa", () => {
    const longa = msg({ autorTipo: "agente", autorId: "aura", autorAvatar: "/a.png", texto: "ção ".repeat(4000) });
    const a = avisoDaMensagem(longa);
    expect(a.cortada).toBe(true);
    expect(a.texto).toBe("");
    expect(a).toMatchObject({ id: "m1", canalId: "c1", autorTipo: "agente", autorId: "aura" });
    expect(bytesDoJson(a)).toBeLessThanOrEqual(LIMITE_AVISO_BYTES);
  });

  it("conta bytes como o Pusher (acento = 2, emoji = 4)", () => {
    expect(bytesDoJson("a")).toBe(3);   // "a" com aspas
    expect(bytesDoJson("ç")).toBe(4);   // 2 + aspas
    expect(bytesDoJson("🙂")).toBe(6);  // 4 + aspas
  });

  it("reconhece foto inteira", () => {
    expect(ehFotoInteira(FOTO_13KB)).toBe(true);
    expect(ehFotoInteira("https://x/y.png")).toBe(false);
    expect(ehFotoInteira(null)).toBe(false);
  });
});

describe("aviso em tempo real · a foto volta na tela", () => {
  const pessoas = [{ id: "martinez", avatar: FOTO_13KB }, { id: "giulia", avatar: null }];
  it("mensagem chegou sem foto → usa a foto da lista de pessoas", () => {
    expect(comFotoDaLista({ autorTipo: "humano", autorId: "martinez", autorAvatar: null }, pessoas).autorAvatar).toBe(FOTO_13KB);
  });
  it("quem não tem foto continua sem; quem já veio com foto fica como está; agente não mexe", () => {
    expect(comFotoDaLista({ autorTipo: "humano", autorId: "giulia", autorAvatar: null }, pessoas).autorAvatar).toBeNull();
    expect(comFotoDaLista({ autorTipo: "humano", autorId: "martinez", autorAvatar: "https://link" }, pessoas).autorAvatar).toBe("https://link");
    expect(comFotoDaLista({ autorTipo: "agente", autorId: "martinez", autorAvatar: null }, pessoas).autorAvatar).toBeNull();
  });
  it("o 'fulano entrou' (sistema) também ganha a foto", () => {
    expect(comFotoDaLista({ autorTipo: "sistema", autorId: "martinez", autorAvatar: null }, pessoas).autorAvatar).toBe(FOTO_13KB);
  });
});

// o publish de verdade passa pelo aviso: nunca manda a foto inteira pro Pusher
const enviados: unknown[] = [];
vi.mock("@/lib/collab/realtime", () => ({ triggerSafe: async (_c: string, _e: string, p: unknown) => { enviados.push(p); } }));

describe("publicarPusher · mensagem nova", () => {
  beforeEach(() => { enviados.length = 0; });
  it("a mensagem do Martinez sai sem a foto inteira e dentro do limite", async () => {
    const { publicarPusher, EV_MENSAGEM } = await import("./realtime");
    await publicarPusher("c1", EV_MENSAGEM, msg());
    expect(enviados).toHaveLength(1);
    expect((enviados[0] as MensagemWire).autorAvatar).toBeNull();
    expect(bytesDoJson(enviados[0])).toBeLessThanOrEqual(LIMITE_AVISO_BYTES);
  });
  it("outros eventos (digitando, agenda) passam como estão", async () => {
    const { publicarPusher, EV_HUMANO_DIGITANDO } = await import("./realtime");
    await publicarPusher("c1", EV_HUMANO_DIGITANDO, { userId: "martinez", nome: "Martinez" });
    expect(enviados[0]).toEqual({ userId: "martinez", nome: "Martinez" });
  });
});
