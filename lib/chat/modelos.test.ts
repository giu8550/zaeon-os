import { describe, it, expect } from "vitest";
import { MODELOS_CHAT, MODELO_PADRAO, modeloDoId, nomeDoModeloServido } from "./modelos";

describe("catálogo de modelos do chat", () => {
  it("só os 3 Google no seletor (o Qwen local foi pros artefatos); padrão = Gemini 3.5 Flash", () => {
    expect(MODELOS_CHAT.map((m) => m.id)).toEqual(["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-2.5-pro"]);
    expect(MODELO_PADRAO).toBe("gemini-3.5-flash");
    for (const m of MODELOS_CHAT) expect(m.provedor === "google" ? !!m.vertex : !!m.grupo).toBe(true);
  });
  it("só aceita id do catálogo (nome solto do cliente = null)", () => {
    expect(modeloDoId("zaeon-qwen30")).toBeNull();
    expect(modeloDoId("gemini-2.5-pro")?.vertex).toBe("gemini-2.5-pro");
    expect(modeloDoId("gpt-4o")).toBeNull();
    expect(modeloDoId("zaeon-local-coder")).toBeNull();
    expect(modeloDoId(42)).toBeNull();
  });
  it("nome de quem respondeu, a partir do que o servidor usou", () => {
    expect(nomeDoModeloServido("gemini-3.5-flash", "vertex")).toBe("Gemini 3.5 Flash");
    expect(nomeDoModeloServido("gemini-2.5-pro", "vertex")).toBe("Gemini 2.5 Pro");
    expect(nomeDoModeloServido("zaeon-local-qwen30", "contabo")).toBe("qwen30 · local");
    expect(nomeDoModeloServido("openai/gpt-oss-120b", "huggingface")).toBe("gpt-oss-120b · reserva");
    expect(nomeDoModeloServido("zaeon-local-mini", "contabo")).toBe("mini · local");
    expect(nomeDoModeloServido("", null)).toBe("?");
  });
});
