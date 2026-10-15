// @vitest-environment jsdom
/**
 * Multiplayer do cyberespaço (handoff "avatares assimétricos + congelam"), com um Pusher FALSO:
 *  - Bug 1: membro online aparece JÁ (seed pela lista de membros) + handshake client-hello;
 *  - Bug 2: heartbeat por setInterval reenvia a pose (independente do requestAnimationFrame);
 *  - Bug 3: só reenvia quando a pose muda (cota de 10 client events/s).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const SALA = "0123456789abcdef01234567", EU = "aaaaaaaaaaaaaaaaaaaaaaaa", AMIGO = "bbbbbbbbbbbbbbbbbbbbbbbb";

type Handler = (d?: any) => void;
const fake = vi.hoisted(() => ({ canal: null as any, conexao: null as any }));
vi.mock("pusher-js", () => {
  class FakePusher {
    connection = { handlers: {} as Record<string, Handler[]>, bind(ev: string, f: Handler) { (this.handlers[ev] ??= []).push(f); } };
    constructor() { fake.conexao = this.connection; }
    subscribe() {
      const handlers: Record<string, Handler[]> = {};
      const membros = [{ id: EU, info: { name: "Eu" } }, { id: AMIGO, info: { name: "Amigo", color: "#ff5fa8" } }];
      fake.canal = {
        subscribed: true, handlers, enviados: [] as { ev: string; d: any }[],
        members: { each: (f: (m: any) => void) => membros.forEach(f) },
        bind(ev: string, f: Handler) { (handlers[ev] ??= []).push(f); },
        trigger(ev: string, d: any) { this.enviados.push({ ev, d }); return true; },
        // como no pusher-js: o membro sai da lista ANTES do evento member_removed
        emit(ev: string, d?: any) { if (ev === "pusher:member_removed") { const i = membros.findIndex((m) => m.id === d?.id); if (i >= 0) membros.splice(i, 1); } (handlers[ev] ?? []).forEach((f) => f(d)); },
      };
      return fake.canal;
    }
    disconnect() {}
  }
  return { default: FakePusher };
});

const resp = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as any);
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  process.env.NEXT_PUBLIC_PUSHER_KEY = "k"; process.env.NEXT_PUBLIC_PUSHER_CLUSTER = "sa1";
  (globalThis as any).fetch = vi.fn(() => resp({ sala: { id: SALA, title: "S", ownerId: EU, isOwner: true, members: [EU, AMIGO], token: "t", conteudo: { notes: [], artifacts: [] } }, membros: [], eu: { id: EU, name: "Eu", color: "#2f7bff" } }));
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(performance, "now").mockImplementation(() => Date.now());   // throttle anda junto com os timers falsos
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

import { useSala3D } from "./useSala3D";

async function montar() {
  const poseInicial = (id: string) => (id === AMIGO ? { x: 5, z: 6, facing: 1, sit: true } : null);
  const h = renderHook(() => useSala3D(SALA, { poseInicial }));
  await waitFor(() => expect(fake.canal).not.toBeNull());
  await act(async () => { fake.canal.emit("pusher:subscription_succeeded"); });
  return h;
}

describe("useSala3D · multiplayer", () => {
  it("Bug 1: o amigo online aparece JÁ (seed na base dele), sem esperar ele andar; e eu mando client-hello", async () => {
    const h = await montar();
    const amigo = h.result.current.remotos.current.get(AMIGO);
    expect(amigo).toMatchObject({ x: 5, z: 6, sit: true, name: "Amigo" });
    expect(h.result.current.remotos.current.has(EU)).toBe(false);
    expect(fake.canal.enviados.some((e: any) => e.ev === "client-hello")).toBe(true);
    expect(h.result.current.realtime).toBe("pusher");
  });

  it("Bug 1: quem chega depois (member_added) também aparece; quem sai some (a base é do engine)", async () => {
    const h = await montar();
    h.result.current.remotos.current.clear();
    await act(async () => { fake.canal.emit("pusher:member_added", { id: AMIGO, info: { name: "Amigo" } }); });
    expect(h.result.current.remotos.current.has(AMIGO)).toBe(true);
    await act(async () => { fake.canal.emit("pusher:member_removed", { id: AMIGO }); });
    expect(h.result.current.remotos.current.has(AMIGO)).toBe(false);
  });

  it("Bug 1: ao receber client-hello eu reenvio minha pose na hora (com jitter curto)", async () => {
    const h = await montar();
    act(() => { h.result.current.enviarPos({ x: 1, z: 2, facing: 0, moving: false, sit: false }); });
    const antes = fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length;
    await act(async () => { fake.canal.emit("client-hello", { id: AMIGO }); await vi.advanceTimersByTimeAsync(400); });
    expect(fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length).toBe(antes + 1);
  });

  it("Bug 2: heartbeat reenvia a última pose a cada 2 s mesmo sem frames (aba em segundo plano)", async () => {
    const h = await montar();
    act(() => { h.result.current.enviarPos({ x: 1, z: 2, facing: 0, moving: false, sit: false }); });
    const n0 = fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length;
    await act(async () => { await vi.advanceTimersByTimeAsync(6100); });
    expect(fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length).toBeGreaterThanOrEqual(n0 + 3);
  });

  it("Bug 3: parado não reenvia a cada frame; andou → reenvia", async () => {
    const h = await montar();
    const pose = { x: 1, z: 2, facing: 0, moving: false, sit: false };
    act(() => { h.result.current.enviarPos(pose); });
    const n0 = fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length;
    await act(async () => { for (let i = 0; i < 30; i++) { h.result.current.enviarPos(pose); await vi.advanceTimersByTimeAsync(16); } });
    expect(fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length).toBe(n0);
    await act(async () => { await vi.advanceTimersByTimeAsync(200); h.result.current.enviarPos({ ...pose, x: 3, moving: true }); });
    expect(fake.canal.enviados.filter((e: any) => e.ev === "client-pos").length).toBe(n0 + 1);
  });

  it("client events desligado no formato REAL do Pusher (code null + mensagem) → cai pro POST /pos", async () => {
    const h = await montar();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => { fake.conexao.handlers.error.forEach((f: Handler) => f({ type: "PusherError", data: { code: null, message: "To send client events, you must enable this feature in the Settings page of your dashboard." } })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); h.result.current.enviarPos({ x: 7, z: 7, facing: 0, moving: true, sit: false }); });
    expect((globalThis as any).fetch).toHaveBeenCalledWith(`/api/lounge3d/${SALA}/pos`, expect.objectContaining({ method: "POST" }));
  });

  it("Relicário: o evento válido da sala vira `eventoRelicario` (saneado); lixo é ignorado", async () => {
    const h = await montar();
    expect(h.result.current.eventoRelicario).toBeNull();
    await act(async () => { fake.canal.emit("relicario", {}); });
    expect(h.result.current.eventoRelicario).toBeNull();
    const ev = { id: "ev1", userId: AMIGO, nome: "Amigo", cor: "#ff5fa8", titulo: "Minha pesquisa", tipo: "pesquisa", aceito: true, agora: 1000, extra: "fora" };
    await act(async () => { fake.canal.emit("relicario", ev); });
    expect(h.result.current.eventoRelicario).toEqual({ id: "ev1", userId: AMIGO, nome: "Amigo", cor: "#ff5fa8", titulo: "Minha pesquisa", tipo: "pesquisa", aceito: true, agora: 1000 });
    await act(async () => { fake.canal.emit("relicario", { id: "ev2", tipo: "livro" }); });   // sem userId/agora: não entra, o anterior fica
    expect(h.result.current.eventoRelicario?.id).toBe("ev1");
  });

  it("4301 (client events desligado) → cai pro POST /pos", async () => {
    const h = await montar();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    act(() => { fake.conexao.handlers.error.forEach((f: Handler) => f({ data: { code: 4301 } })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); h.result.current.enviarPos({ x: 9, z: 9, facing: 0, moving: true, sit: false }); });
    expect((globalThis as any).fetch).toHaveBeenCalledWith(`/api/lounge3d/${SALA}/pos`, expect.objectContaining({ method: "POST" }));
  });
});
