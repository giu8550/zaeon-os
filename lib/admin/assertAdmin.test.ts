import { describe, it, expect, vi } from "vitest";

const sessionMock = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => sessionMock(...a) }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));

import { assertAdmin } from "./assertAdmin";

describe("assertAdmin", () => {
  it("sem sessão → 401", async () => {
    sessionMock.mockResolvedValue(null);
    expect(await assertAdmin()).toEqual({ ok: false, status: 401 });
  });
  it("logado não-admin → 403", async () => {
    sessionMock.mockResolvedValue({ user: { email: "aluno@x.com", role: "student" } });
    expect(await assertAdmin()).toEqual({ ok: false, status: 403 });
  });
  it("fundador (allowlist) e role super_admin → ok", async () => {
    sessionMock.mockResolvedValue({ user: { email: "donmartinezcaiudoceu@gmail.com" } });
    expect(await assertAdmin()).toEqual({ ok: true, email: "donmartinezcaiudoceu@gmail.com" });
    sessionMock.mockResolvedValue({ user: { email: "x@y.z", role: "super_admin" } });
    expect((await assertAdmin()).ok).toBe(true);
  });
  it("erro na sessão → 401 (nunca lança)", async () => {
    sessionMock.mockImplementation(async () => { throw new Error("boom"); });
    expect(await assertAdmin()).toEqual({ ok: false, status: 401 });
  });
});
