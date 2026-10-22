import { describe, it, expect, vi, afterEach } from "vitest";
import { encryptToken, decryptToken, TokenKeyAusente } from "./crypto";

afterEach(() => vi.unstubAllEnvs());

describe("crypto de tokens", () => {
  it("cifra e decifra com TOKEN_ENC_KEY", () => {
    vi.stubEnv("TOKEN_ENC_KEY", "chave-de-teste");
    const c = encryptToken("ghu_abc");
    expect(c).not.toContain("ghu_abc");
    expect(decryptToken(c)).toBe("ghu_abc");
  });

  it("em produção sem TOKEN_ENC_KEY lança TokenKeyAusente (sem fallback)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOKEN_ENC_KEY", "");
    vi.stubEnv("NEXTAUTH_SECRET", "segredo-do-next");
    expect(() => encryptToken("ghu_abc")).toThrow(TokenKeyAusente);
    expect(() => decryptToken("AAAA")).toThrow(TokenKeyAusente);
  });

  it("fora de produção ainda cai no NEXTAUTH_SECRET", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TOKEN_ENC_KEY", "");
    expect(decryptToken(encryptToken("ghu_abc"))).toBe("ghu_abc");
  });
});
