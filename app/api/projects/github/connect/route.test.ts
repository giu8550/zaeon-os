import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({ session: vi.fn(), configurado: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession: m.session }));
vi.mock("@/src/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/projects/github-user", () => ({ isUserOAuthConfigured: m.configurado, buildAuthorizeUrl: (s: string) => `https://github.com/login/oauth/authorize?state=${s}` }));

import { GET } from "./route";

describe("GET /api/projects/github/connect?voltar=", () => {
  beforeEach(() => {
    m.session.mockReset().mockResolvedValue({ user: { email: "a@b.c" } });
    m.configurado.mockReset().mockReturnValue(true);
    process.env.NEXTAUTH_URL = "https://app.zaeon.com";
  });

  it("voltar permitido vira cookie httpOnly para o callback; o redirect é pro GitHub", async () => {
    const r = await GET(new Request("https://app.zaeon.com/api/projects/github/connect?voltar=/octa/github"));
    expect(r.headers.get("location")).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?state=/);
    const c = r.headers.get("set-cookie") ?? "";
    expect(c).toMatch(/gh_oauth_voltar=%2Focta%2Fgithub|gh_oauth_voltar=\/octa\/github/);
    expect(c.toLowerCase()).toContain("httponly");
  });

  it("voltar fora da lista é ignorado (o cookie de volta é limpo, nunca recebe o valor)", async () => {
    const r = await GET(new Request("https://app.zaeon.com/api/projects/github/connect?voltar=https://evil.com"));
    const c = r.headers.get("set-cookie") ?? "";
    expect(c).not.toContain("evil");
    expect(c).not.toMatch(/gh_oauth_voltar=[^;]/);
  });

  it("sem sessão: volta pro voltar permitido com gh=auth (nunca pra fora)", async () => {
    m.session.mockResolvedValue(null);
    const ok = await GET(new Request("https://app.zaeon.com/api/projects/github/connect?voltar=/octa/github"));
    expect(ok.headers.get("location")).toBe("https://app.zaeon.com/octa/github?gh=auth");
    const ruim = await GET(new Request("https://app.zaeon.com/api/projects/github/connect?voltar=//evil.com"));
    expect(ruim.headers.get("location")).toBe("https://app.zaeon.com/research-lab?tab=projetos&gh=auth");
  });
});
