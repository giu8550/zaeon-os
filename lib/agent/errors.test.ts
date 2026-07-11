import { describe, it, expect } from "vitest";
import { messageForError, classifyError } from "./errors";

describe("errors · messageForError", () => {
  it("mapeia code conhecido (ToolResult) → mensagem amigável", () => {
    expect(messageForError({ code: "tool_denied" })).toMatch(/plano/i);
    expect(messageForError({ code: "memory_unavailable" })).toMatch(/mem[óo]ria/i);
    expect(messageForError({ code: "needs_approval" })).toMatch(/aprova/i);
  });
  it("classifica string de erro crua (rede/timeout/rate)", () => {
    expect(messageForError("Gemini timeout (30000ms)")).toMatch(/demorou/i);
    expect(messageForError("HTTP 429 quota exceeded")).toMatch(/segundinho|espera/i);
    expect(messageForError("fetch failed ECONNREFUSED")).toMatch(/conex[ãa]o/i);
  });
  it("code desconhecido/null → fallback (nunca vazio)", () => {
    expect(messageForError({ code: "nao_existe" })).toMatch(/problema/i);
    expect(messageForError(null)).toMatch(/problema/i);
    expect(messageForError({ error: "algo estranho sem padrão" })).toMatch(/problema/i);
  });
  it("aceita um code cru como string", () => {
    expect(messageForError("skill_offline")).toMatch(/fora do ar/i);
  });
});

describe("errors · classifyError", () => {
  it("reconhece as famílias", () => {
    expect(classifyError("deadline exceeded")).toBe("tool_timeout");
    expect(classifyError("rate limit hit")).toBe("rate_limited");
    expect(classifyError("getaddrinfo ENOTFOUND")).toBe("network");
    expect(classifyError("invalid JSON")).toBe("invalid_output");
    expect(classifyError("")).toBe("unknown");
  });
});
