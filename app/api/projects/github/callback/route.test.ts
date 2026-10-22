import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), cookies: new Map<string, string>(), exchange: vi.fn(), login: vi.fn(), store: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: (k: string) => (m.cookies.has(k) ? { value: m.cookies.get(k) } : undefined) }) }));
vi.mock("@/lib/projects/github-user", () => ({ exchangeCode: m.exchange, fetchLogin: m.login, storeUserToken: m.store }));

import { GET } from "./route";

const cb = (q: string) => new Request(`https://app.zaeon.com/api/projects/github/callback?${q}`);

describe("GET /api/projects/github/callback — volta pra onde começou", () => {
  beforeEach(() => {
    m.cookies.clear();
    m.session.mockReset().mockResolvedValue({ user: { email: "a@b.c" } });
    m.exchange.mockReset().mockResolvedValue({ access_token: "gho_segredo" });
    m.login.mockReset().mockResolvedValue("ana");
    m.store.mockReset().mockResolvedValue(undefined);
    process.env.NEXTAUTH_URL = "https://app.zaeon.com";
  });

  it("começou no Octa → volta pro Octa com gh=connected e apaga o cookie de volta; token nunca na URL", async () => {
    m.cookies.set("gh_oauth_state", "s1"); m.cookies.set("gh_oauth_voltar", "/octa/github");
    const r = await GET(cb("code=c&state=s1"));
    expect(r.headers.get("location")).toBe("https://app.zaeon.com/octa/github?gh=connected");
    expect(r.headers.get("location")).not.toContain("gho_");
    expect(r.headers.get("set-cookie") ?? "").toContain("gh_oauth_voltar=;");
  });

  it("cookie de volta adulterado → sala Projetos (padrão)", async () => {
    m.cookies.set("gh_oauth_state", "s1"); m.cookies.set("gh_oauth_voltar", "https://evil.com");
    const r = await GET(cb("code=c&state=s1"));
    expect(r.headers.get("location")).toBe("https://app.zaeon.com/research-lab?tab=projetos&gh=connected");
  });

  it("state inválido → volta com gh=state, sem trocar o code", async () => {
    m.cookies.set("gh_oauth_state", "s1"); m.cookies.set("gh_oauth_voltar", "/octa/github");
    const r = await GET(cb("code=c&state=outro"));
    expect(r.headers.get("location")).toBe("https://app.zaeon.com/octa/github?gh=state");
    expect(m.exchange).not.toHaveBeenCalled();
  });
});
