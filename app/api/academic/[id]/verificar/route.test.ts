/** Verificar credencial: IDOR (self 403, não-verificador 403, sem vínculo 403), paga 1×, rejeição reverte, declarado não paga. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const A = "a".repeat(24), P = "b".repeat(24), C = "c".repeat(24), ADM = "d".repeat(24);
const st: any = { me: null, creds: {} as Record<string, any>, vinculos: new Set<string>(), eventos: [] as any[], users: {} as Record<string, any>, issued: [] as any[] };
const key = (e: any) => `${e.userId}|${e.source}|${e.refId}`;

vi.mock("@/lib/aura/academico-server", () => {
  const OID = /^[a-f0-9]{24}$/i;
  const prisma = {
    academicCredential: {
      findUnique: async ({ where }: any) => st.creds[where.id] ?? null,
      findMany: async ({ where }: any) => Object.values(st.creds).filter((c: any) => c.userId === where.userId && (!where.status || c.status === where.status) && (!where.id?.not || c.id !== where.id.not)),
      count: async ({ where }: any) => Object.values(st.creds).filter((c: any) => c.userId === where.userId && c.status === where.status).length,
      update: async ({ where, data }: any) => { st.creds[where.id] = { ...st.creds[where.id], ...data }; return st.creds[where.id]; },
    },
    auraEvent: {
      findUnique: async ({ where: { userId_source_refId: k } }: any) => st.eventos.find((e: any) => key(e) === key(k)) ?? null,
      create: async ({ data }: any) => { const r = { id: `e${st.eventos.length + 1}`, createdAt: new Date(), ...data }; st.eventos.push(r); return r; },
      count: async () => 0,
      findMany: async ({ where }: any) => st.eventos.filter((e: any) => e.userId === where.userId),
    },
    user: { update: async ({ where, data }: any) => { st.users[where.id] = { ...(st.users[where.id] ?? {}), ...data }; return {}; } },
  };
  const elegibilidadeReal = async () => (await import("@/lib/aura/academico")).elegibilidade;
  return {
    OID, prisma,
    exigirFlag: () => null,
    eu: async () => st.me,
    elegivel: async (me: any, alvo: string) => (await elegibilidadeReal())(
      { id: me.id, role: me.role, verificadorHabilitado: me.verificadorHabilitado, temCredencialVerificada: false, isSuperAdmin: me.isSuperAdmin },
      alvo, st.vinculos.has(`${me.id}:${alvo}`),
    ),
  };
});
vi.mock("@/lib/solana/credentials", () => ({ issueCredential: async (userId: string, input: any) => { st.issued.push({ userId, ...input }); return { id: "cred1" }; } }));

import { POST } from "./route";
const req = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b) });
const cred = (id: string, x: any = {}) => ({ id, userId: A, nivel: "mestrado", area: "Agronomia", instituicao: "UFX", docRef: "data:application/pdf;base64,QUJD", docHash: "h", metodo: "doc_review", status: "pendente", verifiedAt: null, createdAt: new Date(), ...x });
const prof = { id: P, email: "p@x", role: "teacher", institution: null, verificadorHabilitado: true, isSuperAdmin: false };

describe("POST /api/academic/[id]/verificar", () => {
  beforeEach(() => { st.me = prof; st.creds = { [C]: cred(C) }; st.vinculos = new Set([`${P}:${A}`]); st.eventos = []; st.users = {}; st.issued = []; });

  it("anônimo 401; id inválido/inexistente 404", async () => {
    st.me = null;
    expect((await POST(req({ status: "verificado" }), { params: { id: C } })).status).toBe(401);
    st.me = prof;
    expect((await POST(req({ status: "verificado" }), { params: { id: "x" } })).status).toBe(404);
    expect((await POST(req({ status: "verificado" }), { params: { id: "e".repeat(24) } })).status).toBe(404);
  });
  it("IDOR: o próprio dono 403 (conflito); aluno 403; professor sem vínculo 403; não habilitado 403", async () => {
    st.me = { ...prof, id: A };
    const r1 = await POST(req({ status: "verificado" }), { params: { id: C } });
    expect(r1.status).toBe(403); expect((await r1.json()).motivo).toBe("conflito");
    st.me = { ...prof, role: "student" };
    expect((await POST(req({ status: "verificado" }), { params: { id: C } })).status).toBe(403);
    st.me = prof; st.vinculos = new Set();
    expect((await POST(req({ status: "verificado" }), { params: { id: C } })).status).toBe(403);
    st.vinculos = new Set([`${P}:${A}`]); st.me = { ...prof, verificadorHabilitado: false };
    expect((await POST(req({ status: "verificado" }), { params: { id: C } })).status).toBe(403);
    expect(st.eventos).toHaveLength(0);
  });
  it("verificado: paga a base do nível 1×, cunha Credential academic, deriva academicLevel; 2ª vez não paga", async () => {
    const r = await POST(req({ status: "verificado" }), { params: { id: C } });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toMatchObject({ ok: true, status: "verificado", metodo: "doc_review", aura: { concedida: 350, saldo: 350 } });
    expect(st.eventos).toHaveLength(1);
    expect(st.eventos[0]).toMatchObject({ userId: A, source: "credential_verified", refId: C, amount: 350 });
    expect(st.creds[C]).toMatchObject({ status: "verificado", verifiedById: P, auraEventId: "e1" });
    expect(st.users[A]).toMatchObject({ aura: 350, academicLevel: "Mestrado" });
    await new Promise((r) => setTimeout(r, 0));
    expect(st.issued[0]).toMatchObject({ userId: A, type: "academic", refId: C });
    const r2 = await POST(req({ status: "verificado" }), { params: { id: C } });
    expect(await r2.json()).toMatchObject({ jaVerificada: true });
    expect(st.eventos).toHaveLength(1);
  });
  it("declarado (sem documento) não paga: 403 e continua pendente", async () => {
    st.creds[C] = cred(C, { docRef: null, docHash: null, metodo: "declarado" });
    const r = await POST(req({ status: "verificado" }), { params: { id: C } });
    expect(r.status).toBe(403);
    expect(st.creds[C].status).toBe("pendente");
    expect(st.eventos).toHaveLength(0);
  });
  it("professor não sobe pra registry (403); instituição vinculada sobe (selo ouro, base cheia)", async () => {
    expect((await POST(req({ status: "verificado", metodo: "registry" }), { params: { id: C } })).status).toBe(403);
    const INST = "f".repeat(24);
    st.me = { id: INST, email: "ufx@x", role: "instituicao", institution: "UFX", verificadorHabilitado: false, isSuperAdmin: false };
    st.vinculos = new Set([`${INST}:${A}`]);
    const r = await POST(req({ status: "verificado", metodo: "registry" }), { params: { id: C } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ metodo: "registry", aura: { concedida: 350 } });
  });
  it("rejeitar depois de verificado reverte (evento negativo) e rebaixa academicLevel", async () => {
    await POST(req({ status: "verificado" }), { params: { id: C } });
    const r = await POST(req({ status: "rejeitado" }), { params: { id: C } });
    expect(await r.json()).toMatchObject({ ok: true, status: "rejeitado", revertida: true });
    expect(st.eventos.map((e: any) => e.amount)).toEqual([350, -350]);
    expect(st.users[A]).toMatchObject({ aura: 0, academicLevel: "Graduação" });
  });
  it("admin modera: pode rejeitar, não verifica", async () => {
    st.me = { id: ADM, email: "adm@x", role: "student", institution: null, verificadorHabilitado: false, isSuperAdmin: true };
    expect((await POST(req({ status: "verificado" }), { params: { id: C } })).status).toBe(403);
    expect((await POST(req({ status: "rejeitado" }), { params: { id: C } })).status).toBe(200);
    expect(st.creds[C].status).toBe("rejeitado");
  });
  it("status inválido 400", async () => {
    expect((await POST(req({ status: "pendente" }), { params: { id: C } })).status).toBe(400);
  });
});
