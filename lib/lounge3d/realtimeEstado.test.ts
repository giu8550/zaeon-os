import { describe, expect, it } from "vitest";
import { avisoRealtime, classificarErroPusher, ehFalhaDeConexao } from "./realtimeEstado";

describe("classificarErroPusher", () => {
  it("4301 = client events desligado (data.code direto ou aninhado)", () => {
    expect(classificarErroPusher({ data: { code: 4301 } })).toBe("client-events");
    expect(classificarErroPusher({ error: { data: { code: 4301 } } })).toBe("client-events");
  });
  it("o formato REAL do Pusher (code null + mensagem) também é client-events", () => {
    expect(classificarErroPusher({ type: "PusherError", data: { code: null, message: "To send client events, you must enable this feature in the Settings page of your dashboard." } })).toBe("client-events");
  });
  it("status do auth: 503 servidor sem Pusher · 401 sessão · 403 cheia · outros 4xx/5xx auth", () => {
    expect(classificarErroPusher({ status: 503 })).toBe("sem-credenciais-servidor");
    expect(classificarErroPusher({ error: { status: 401 } })).toBe("sessao");
    expect(classificarErroPusher({ status: 403 })).toBe("cheia");
    expect(classificarErroPusher({ status: 500 })).toBe("auth");
    expect(classificarErroPusher({ type: "AuthError" })).toBe("auth");
  });
  it("lixo → desconhecido, sem explodir", () => {
    expect(classificarErroPusher(null)).toBe("desconhecido");
    expect(classificarErroPusher("x")).toBe("desconhecido");
  });
});

describe("avisoRealtime", () => {
  it("conectando e conectado NÃO mostram aviso (nunca 'indisponível' só porque ainda conecta)", () => {
    expect(avisoRealtime("conectando", null)).toBeNull();
    expect(avisoRealtime("pusher", null)).toBeNull();
  });
  it("só mostra quando de fato falhou, dizendo o porquê", () => {
    expect(avisoRealtime("sem-chave", null)).toMatch(/chave do Pusher/);
    expect(avisoRealtime("erro", "sem-credenciais-servidor")).toMatch(/credenciais/);
    expect(avisoRealtime("erro", "sessao")).toMatch(/conta/);
    expect(avisoRealtime("erro", "desconhecido")).toMatch(/indisponível/);
  });
  it("falha de conexão = failed/unavailable", () => {
    expect(ehFalhaDeConexao("failed")).toBe(true);
    expect(ehFalhaDeConexao("unavailable")).toBe(true);
    expect(ehFalhaDeConexao("connecting")).toBe(false);
    expect(ehFalhaDeConexao(undefined)).toBe(false);
  });
});
