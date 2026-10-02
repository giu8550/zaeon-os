import { describe, it, expect, beforeEach } from "vitest";
import { grantAura, reverseAura, recomputeAura, somaEventos, grantNodeValidated, grantBrainCompleted, type LedgerDb } from "./ledger";

const U = "a".repeat(24); // ObjectId válido (hex)
let seq = 0;
function fakeDb(opts: { falharCreate?: boolean } = {}) {
  const eventos: any[] = [];
  const users: Record<string, { aura: number; level: number }> = {};
  const key = (e: any) => `${e.userId}|${e.source}|${e.refId}`;
  const db: LedgerDb = {
    auraEvent: {
      findUnique: async ({ where: { userId_source_refId: k } }) => eventos.find((e) => key(e) === key(k)) ?? null,
      create: async ({ data }) => {
        if (opts.falharCreate) throw new Error("db down");
        if (eventos.some((e) => key(e) === key(data))) { const err: any = new Error("unique"); err.code = "P2002"; throw err; }
        const row = { id: `e${++seq}`, createdAt: new Date(), ...data }; eventos.push(row); return row;
      },
      count: async ({ where }) => eventos.filter((e) => e.userId === where.userId && e.source === where.source && (!where.createdAt || e.createdAt >= where.createdAt.gte)).length,
      findMany: async ({ where }) => eventos.filter((e) => e.userId === where.userId),
    },
    user: { update: async ({ where, data }) => { users[where.id] = { aura: data.aura as number, level: data.level }; return {}; } },
  };
  return { db, eventos, users };
}

describe("ledger · grantAura", () => {
  let f: ReturnType<typeof fakeDb>;
  beforeEach(() => { f = fakeDb(); });

  it("concede 1×, grava evento e atualiza cache aura/level", async () => {
    const r = await grantAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1", reason: "Validação: Solo" });
    expect(r).toMatchObject({ ok: true, novo: true, amount: 50, aura: 50, level: 1 });
    expect(f.eventos).toHaveLength(1);
    expect(f.users[U]).toEqual({ aura: 50, level: 1 });
  });
  it("2ª chamada mesma (source,refId) = no-op idempotente", async () => {
    await grantAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1" });
    const r = await grantAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1" });
    expect(r).toMatchObject({ ok: true, novo: false, aura: 50 });
    expect(f.eventos).toHaveLength(1);
  });
  it("corrida (P2002 no create) também é no-op", async () => {
    const orig = f.db.auraEvent.findUnique;
    let n = 0;
    f.db.auraEvent.findUnique = async (a) => (n++ === 0 ? null : orig(a)); // 1ª checagem não vê; o create bate no unique
    f.eventos.push({ id: "x", userId: U, source: "brain_completed", refId: "m1", amount: 200, reason: null, createdAt: new Date() });
    const r = await grantAura(f.db, { userId: U, source: "brain_completed", refId: "m1" });
    expect(r).toMatchObject({ ok: true, novo: false, amount: 200 });
    expect(f.eventos).toHaveLength(1);
  });
  it("amount padrão por fonte; amount explícito pra credencial; inválidos rejeitados", async () => {
    expect((await grantAura(f.db, { userId: U, source: "node_learned", refId: "a" })) as any).toMatchObject({ amount: 5 });
    expect((await grantAura(f.db, { userId: U, source: "credential_verified", refId: "c1", amount: 350 })) as any).toMatchObject({ amount: 350, aura: 355 });
    expect(await grantAura(f.db, { userId: U, source: "credential_verified", refId: "c2" })).toEqual({ ok: false, motivo: "invalido" }); // sem amount
    expect(await grantAura(f.db, { userId: "nope", source: "node_learned", refId: "a" })).toEqual({ ok: false, motivo: "invalido" });
    expect(await grantAura(f.db, { userId: U, source: "reversal", refId: "a", amount: 5 })).toEqual({ ok: false, motivo: "invalido" });
    expect(await grantAura(f.db, { userId: U, source: "node_learned", refId: "b", amount: -3 })).toEqual({ ok: false, motivo: "invalido" });
  });
  it("soft-cap diário em node_learned; node_validated não tem cap", async () => {
    for (let i = 0; i < 20; i++) expect((await grantAura(f.db, { userId: U, source: "node_learned", refId: `n${i}` })).ok).toBe(true);
    expect(await grantAura(f.db, { userId: U, source: "node_learned", refId: "n99" })).toEqual({ ok: false, motivo: "cap_diario" });
    expect((await grantAura(f.db, { userId: U, source: "node_validated", refId: "m:n99" })).ok).toBe(true);
  });
  it("nível é derivado do saldo", async () => {
    await grantAura(f.db, { userId: U, source: "brain_completed", refId: "m1" }); // 200
    const r = await grantAura(f.db, { userId: U, source: "brain_completed", refId: "m2" }); // 400
    expect(r).toMatchObject({ aura: 400, level: 3 });
    expect(f.users[U]!.level).toBe(3);
  });
  it("erro de banco nunca lança", async () => {
    const g = fakeDb({ falharCreate: true });
    expect(await grantAura(g.db, { userId: U, source: "node_learned", refId: "a" })).toMatchObject({ ok: false, motivo: "erro" });
  });
});

describe("ledger · reverseAura / recompute", () => {
  it("reversão = evento negativo 1×; saldo volta; original fica", async () => {
    const f = fakeDb();
    await grantAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1" });
    const r = await reverseAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1", reason: "prof desfez" });
    expect(r).toMatchObject({ ok: true, novo: true, amount: -50, aura: 0 });
    expect(f.eventos).toHaveLength(2);
    expect(f.eventos[1]).toMatchObject({ source: "reversal", refId: "node_validated:m1:n1", amount: -50 });
    expect((await reverseAura(f.db, { userId: U, source: "node_validated", refId: "m1:n1" })) as any).toMatchObject({ novo: false });
    expect(f.eventos).toHaveLength(2);
    expect(await reverseAura(f.db, { userId: U, source: "node_validated", refId: "nunca" })).toEqual({ ok: false, motivo: "invalido" });
  });
  it("recomputeAura: soma do ledger == cache; nunca negativo", async () => {
    const f = fakeDb();
    f.eventos.push(
      { id: "1", userId: U, source: "legacy_xp", refId: U, amount: 100, reason: null, createdAt: new Date() },
      { id: "2", userId: U, source: "node_learned", refId: "a", amount: 5, reason: null, createdAt: new Date() },
      { id: "3", userId: U, source: "reversal", refId: "node_learned:a", amount: -5, reason: null, createdAt: new Date() },
    );
    f.users[U] = { aura: 999, level: 9 }; // drift
    expect(await recomputeAura(f.db, U)).toEqual({ aura: 100, level: 1 });
    expect(f.users[U]).toEqual({ aura: 100, level: 1 });
    expect(somaEventos([{ amount: -10 }])).toBe(0);
  });
  it("ganchos do mapa usam as chaves certas", async () => {
    const f = fakeDb();
    await grantNodeValidated(f.db, U, "mapa1", "no7", "Validação");
    await grantBrainCompleted(f.db, U, "mapa1");
    expect(f.eventos.map((e) => [e.source, e.refId, e.amount])).toEqual([["node_validated", "mapa1:no7", 50], ["brain_completed", "mapa1", 200]]);
  });
});
