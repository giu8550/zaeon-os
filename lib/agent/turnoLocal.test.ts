import { describe, it, expect, vi, beforeEach } from "vitest";
import { turnoLocal, mensagensLocais, PERSONA_LOCAL, MAX_LOCAIS_EM_VOO, _turnosLocais } from "./turnoLocal";

const ENV = { GATEWAY_URL: "http://litellm:4000/", GATEWAY_KEY_LOCAL: "sk-local" };
const ctx = { agentKey: "aura", surface: "estudos" as const };
const base = { prompt: "o que é mitose?", history: [] as Array<{ role: string; text: string }>, grupo: "zaeon-local-qwen30", ctx };

/** Corpo SSE no formato OpenAI (o que o LiteLLM devolve com stream:true). */
function sse(pedacos: string[], usage = { prompt_tokens: 50, completion_tokens: 7, total_tokens: 57 }, quebrarNoFim = false): Response {
  const enc = new TextEncoder();
  const linhas = [
    ...pedacos.map((p) => `data: ${JSON.stringify({ choices: [{ delta: { content: p } }] })}\n\n`),
    `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
    "data: [DONE]\n\n",
  ];
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      // um evento partido entre dois chunks tem que ser remontado
      const tudo = linhas.join("");
      c.enqueue(enc.encode(tudo.slice(0, 37)));
      if (quebrarNoFim) { c.enqueue(enc.encode(linhas[0].slice(37))); setTimeout(() => c.error(new Error("socket hang up")), 5); return; }
      c.enqueue(enc.encode(tudo.slice(37)));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

beforeEach(() => _turnosLocais.zerar());

describe("mensagensLocais — ordem pro cache de prefixo do Ollama", () => {
  it("system estável (persona + mentor) → histórico → base + pergunta no fim", () => {
    const m = mensagensLocais({ ...base, systemContext: "Você é o Osler.", base: "[Base] trecho p.2", history: [{ role: "user", text: "oi" }, { role: "model", text: "olá" }] });
    expect(m[0]).toEqual({ role: "system", content: `${PERSONA_LOCAL}\n\nVocê é o Osler.` });
    expect(m.slice(1, 3)).toEqual([{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }]);
    expect(m[3].content).toBe("Trechos da base da turma (use-os e cite o documento e a página entre colchetes):\n[Base] trecho p.2\n\nPergunta: o que é mitose?");
  });
  it("sem base: a pergunta vai pura e nenhuma instrução de citar base (o modelo inventava página)", () => {
    const m = mensagensLocais(base);
    expect(m.at(-1)).toEqual({ role: "user", content: "o que é mitose?" });
    expect(m[0].content).not.toMatch(/base da turma/i);
  });
  it("histórico curto (8 últimas) e mensagens cortadas", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "model" : "user", text: "x".repeat(5000) }));
    const m = mensagensLocais({ ...base, history });
    expect(m).toHaveLength(1 + 8 + 1);
    expect(m[1].content).toHaveLength(1200);
  });
});

describe("turnoLocal — streaming do gateway", () => {
  it("emite cada pedaço na hora, devolve o texto e grava o ledger (alvo contabo, phase chat-local)", async () => {
    const f = vi.fn(async () => sse(["Mitose ", "é a ", "divisão."]));
    const linhas: any[] = [];
    const emitidos: string[] = [];
    const r = await turnoLocal(base, (p) => emitidos.push(p), { fetchImpl: f as any, env: ENV, registrar: async (l: any) => { linhas.push(l); return true; } });
    expect(emitidos).toEqual(["Mitose ", "é a ", "divisão."]);
    expect(r).toMatchObject({ texto: "Mitose é a divisão.", interrompido: false });
    expect(r.usage.completionTokens).toBe(7);
    const [url, init] = f.mock.calls[0] as any;
    expect(url).toBe("http://litellm:4000/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-local");
    expect(JSON.parse(init.body)).toMatchObject({ model: "zaeon-local-qwen30", stream: true });
    await new Promise((x) => setTimeout(x, 0));
    expect(linhas[0]).toMatchObject({ alvo: "contabo", ok: true, phase: "chat-local", model: "zaeon-local-qwen30" });
  });
  it("gateway fora antes do 1º pedaço → LANÇA (o runChatTurn responde pelo Google)", async () => {
    const f = vi.fn(async () => new Response("{}", { status: 502 }));
    await expect(turnoLocal(base, () => {}, { fetchImpl: f as any, env: ENV, registrar: async () => true })).rejects.toThrow(/HTTP 502/);
  });
  it("resposta vazia → lança", async () => {
    const f = vi.fn(async () => sse([]));
    await expect(turnoLocal(base, () => {}, { fetchImpl: f as any, env: ENV, registrar: async () => true })).rejects.toThrow(/vazia/);
  });
  it("caiu NO MEIO → fica o que veio, marcado como interrompido", async () => {
    const f = vi.fn(async () => sse(["Mitose é"], undefined, true));
    const r = await turnoLocal(base, () => {}, { fetchImpl: f as any, env: ENV, registrar: async () => true });
    expect(r.texto).toBe("Mitose é"); expect(r.interrompido).toBe(true);
  });
  it("sem gateway/key → lança sem chamar ninguém", async () => {
    const f = vi.fn();
    await expect(turnoLocal(base, () => {}, { fetchImpl: f as any, env: {}, registrar: async () => true })).rejects.toThrow(/sem gateway/);
    expect(f).not.toHaveBeenCalled();
  });
  it(`teto de ${MAX_LOCAIS_EM_VOO} turnos locais em voo: o próximo vai pro Google`, async () => {
    let soltar!: () => void;
    const preso = new Promise<void>((r) => { soltar = r; });
    const f = vi.fn(async () => { await preso; return sse(["ok"]); });
    const deps = { fetchImpl: f as any, env: ENV, registrar: async () => true };
    const emCurso = Array.from({ length: MAX_LOCAIS_EM_VOO }, () => turnoLocal(base, () => {}, deps));
    await expect(turnoLocal(base, () => {}, deps)).rejects.toThrow(/ocupado/);
    soltar();
    await Promise.all(emCurso);
    expect(_turnosLocais.emVoo).toBe(0);
  });
});
