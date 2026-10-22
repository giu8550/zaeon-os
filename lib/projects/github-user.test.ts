import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// banco falso de um usuário só; o octokit falso guarda o token com que foi criado
const usuario: Record<string, any> = {};
const updates: any[] = [];
vi.mock("@/src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async () => ({ ...usuario }),
      update: async ({ data }: any) => { updates.push(data); Object.assign(usuario, data); return usuario; },
    },
  },
}));
vi.mock("octokit", () => ({ Octokit: class { auth: string; constructor(o: any) { this.auth = o.auth; } } }));

import { getUserOctokit } from "./github-user";
import { encryptToken, decryptToken } from "./crypto";

const AGORA = new Date("2026-10-21T15:00:00Z");

beforeEach(() => {
  vi.stubEnv("TOKEN_ENC_KEY", "chave-de-teste");
  vi.stubEnv("GITHUB_APP_CLIENT_ID", "cid");
  vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "csecret");
  vi.useFakeTimers({ now: AGORA, toFake: ["Date"] });
  for (const k of Object.keys(usuario)) delete usuario[k];
  updates.length = 0;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

function conectado(expiraEm: Date | null) {
  Object.assign(usuario, {
    githubUserToken: encryptToken("ghu_velho"),
    githubRefreshToken: encryptToken("ghr_refresh"),
    githubTokenExpiresAt: expiraEm,
  });
}

describe("getUserOctokit", () => {
  it("token válido: usa o token salvo, sem refresh", async () => {
    conectado(new Date(AGORA.getTime() + 3600_000));
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const o = await getUserOctokit("a@b.c");
    expect(o.auth).toBe("ghu_velho");
    expect(f).not.toHaveBeenCalled();
  });

  it("token sem validade (não expira): usa o salvo", async () => {
    conectado(null);
    vi.stubGlobal("fetch", vi.fn());
    expect((await getUserOctokit("a@b.c")).auth).toBe("ghu_velho");
  });

  it("token vencido (ou a <5 min): renova com o refresh e regrava cifrado", async () => {
    for (const exp of [new Date(AGORA.getTime() - 1000), new Date(AGORA.getTime() + 4 * 60_000)]) {
      conectado(exp);
      updates.length = 0;
      const f = vi.fn(async (_url: string, _init: any) => ({ json: async () => ({ access_token: "ghu_novo", refresh_token: "ghr_novo", expires_in: 28800 }) }));
      vi.stubGlobal("fetch", f);
      const o = await getUserOctokit("a@b.c");
      expect(o.auth).toBe("ghu_novo");

      const [url, init] = f.mock.calls[0];
      expect(url).toBe("https://github.com/login/oauth/access_token");
      expect(JSON.parse(init.body)).toEqual({ client_id: "cid", client_secret: "csecret", grant_type: "refresh_token", refresh_token: "ghr_refresh" });

      expect(updates).toHaveLength(1);
      const gravado = updates[0];
      expect(JSON.stringify(gravado)).not.toContain("ghu_novo");
      expect(JSON.stringify(gravado)).not.toContain("ghr_novo");
      expect(decryptToken(gravado.githubUserToken)).toBe("ghu_novo");
      expect(decryptToken(gravado.githubRefreshToken)).toBe("ghr_novo");
      expect(gravado.githubTokenExpiresAt).toEqual(new Date(AGORA.getTime() + 28800_000));
    }
  });

  it("refresh falhando (resposta de erro, rede ou sem refresh token): null", async () => {
    conectado(new Date(AGORA.getTime() - 1000));
    vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ error: "bad_refresh_token" }) })));
    expect(await getUserOctokit("a@b.c")).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("rede"); }));
    expect(await getUserOctokit("a@b.c")).toBeNull();

    usuario.githubRefreshToken = null;
    expect(await getUserOctokit("a@b.c")).toBeNull();
    expect(updates).toEqual([]);
  });

  it("sem token: null", async () => {
    expect(await getUserOctokit("a@b.c")).toBeNull();
  });
});
