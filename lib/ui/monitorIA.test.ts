import { describe, expect, it } from "vitest";
import { criarContador, ehChamadaDeIA, instalarMonitorIA, respostaEmStream } from "./monitorIA";
import { urlDoLabNoTablet, ehMsgIA, MSG_IA, type EstadoIALab } from "./loungeHub";

const O = "http://localhost:3000";
describe("o monitor de IA do tablet (a concorrência)", () => {
  it("conta só POST pra /api/ da mesma origem, fora das rotas que não são de IA", () => {
    expect(ehChamadaDeIA("/api/ai/chat", "POST", O)).toBe(true);
    expect(ehChamadaDeIA(`${O}/api/study/agent`, "post", O)).toBe(true);
    expect(ehChamadaDeIA("/api/ai/chat", "GET", O)).toBe(false);
    expect(ehChamadaDeIA("/api/auth/session", "POST", O)).toBe(false);
    expect(ehChamadaDeIA("/api/cyber/frota", "POST", O)).toBe(false);
    expect(ehChamadaDeIA("https://outro.com/api/ai/chat", "POST", O)).toBe(false);
    expect(ehChamadaDeIA("/pagina", "POST", O)).toBe(false);
  });
  it("o contador: a leva começa com a 1ª chamada e termina quando a última acaba (com a duração da leva)", () => {
    let t = 1000; const c = criarContador(() => t);
    const a = c.comecar(); t = 1500; const b = c.comecar();
    expect(c.estado()).toMatchObject({ ativos: 2, desde: 1000, terminou: null });
    t = 3000; c.terminar(a); expect(c.estado().ativos).toBe(1);
    t = 9000; c.terminar(b); expect(c.estado()).toEqual({ ativos: 0, desde: null, terminou: { em: 9000, durMs: 8000 } });
    expect(c.terminar(b)).toBe(false);
  });
  it("numa resposta em STREAM, só termina quando o corpo acaba de chegar", async () => {
    const enc = new TextEncoder(); let soltar!: () => void;
    const corpo = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(enc.encode("a IA ")); soltar = () => { c.enqueue(enc.encode("escrevendo")); c.close(); }; } });
    const avisos: EstadoIALab[] = [];
    const w = { location: { origin: O }, fetch: async () => new Response(corpo, { headers: { "content-type": "text/plain" } }) } as unknown as Window & typeof globalThis;
    const desinstalar = instalarMonitorIA((e) => avisos.push(e), w);
    const r = await w.fetch("/api/ai/chat", { method: "POST" });
    expect(avisos.at(-1)!.ativos).toBe(1);   // os cabeçalhos chegaram, a IA ainda escreve
    const ler = r.text(); soltar(); expect(await ler).toBe("a IA escrevendo");
    expect(avisos.at(-1)!.ativos).toBe(0); expect(avisos.at(-1)!.terminou).not.toBeNull();
    desinstalar();
  });
  it("resposta com tamanho fechado termina na hora; GET não conta", async () => {
    const avisos: EstadoIALab[] = [];
    const w = { location: { origin: O }, fetch: async () => new Response("{}", { headers: { "content-length": "2" } }) } as unknown as Window & typeof globalThis;
    instalarMonitorIA((e) => avisos.push(e), w);
    await w.fetch("/api/ai/summarize-lite", { method: "POST" }); expect(avisos.map((a) => a.ativos)).toEqual([1, 0]);
    await w.fetch("/api/ai/chat"); expect(avisos).toHaveLength(2);
    expect(respostaEmStream({ headers: new Headers({ "content-length": "5" }), body: {} })).toBe(false);
  });
  it("o tablet: a 1ª vez abre na Sala de Estudos, no chat; depois, onde a pessoa deixou; a mensagem de IA é validada", () => {
    expect(urlDoLabNoTablet(false)).toContain("tab=sala-de-estudos"); expect(urlDoLabNoTablet(false)).toContain("estudo=chat"); expect(urlDoLabNoTablet(false)).toContain("tablet=1");
    expect(urlDoLabNoTablet(true)).not.toContain("tab="); expect(urlDoLabNoTablet(true)).toContain("tablet=1");
    expect(ehMsgIA({ type: MSG_IA, estado: { ativos: 1, desde: 1, terminou: null } }, O, O)).toBe(true);
    expect(ehMsgIA({ type: MSG_IA, estado: { ativos: 1 } }, "https://x.com", O)).toBe(false);
    expect(ehMsgIA({ type: "outra" }, O, O)).toBe(false);
  });
});

describe("#440 · o escritório não acende 'IA trabalhando' no metaverso", () => {
  it("os pedidos do escritório que não são IA não contam (digitando, sino, convites, agenda, criar)", () => {
    const C = "a".repeat(24);
    for (const p of [`/api/canal/${C}/digitando`, "/api/canal/sino", "/api/canal/convites", `/api/canal/convites/${C}`, `/api/canal/${C}/agenda`, `/api/canal/${C}/entrar`, "/api/canal", "/api/canal/pusher-auth"]) {
      expect(ehChamadaDeIA(p, "POST", O)).toBe(false);
    }
  });
  it("a mensagem do escritório continua contando (ela pode esperar o agente responder)", () => {
    expect(ehChamadaDeIA(`/api/canal/${"a".repeat(24)}/mensagem`, "POST", O)).toBe(true);
  });
  it("resposta JSON sem tamanho (compressão do servidor) NÃO é IA escrevendo; text/plain e x-ndjson são", () => {
    expect(respostaEmStream({ headers: new Headers({ "content-type": "application/json; charset=utf-8" }), body: {} })).toBe(false);
    expect(respostaEmStream({ headers: new Headers({ "content-type": "text/plain; charset=utf-8" }), body: {} })).toBe(true);
    expect(respostaEmStream({ headers: new Headers({ "content-type": "application/x-ndjson; charset=utf-8" }), body: {} })).toBe(true);
  });
  it("o caso do Martinez: um POST com JSON sem tamanho que NINGUÉM lê termina na hora (antes: 15 min)", async () => {
    const avisos: EstadoIALab[] = [];
    const corpo = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"ok":true}')); c.close(); } });
    const w = { location: { origin: O }, fetch: async () => new Response(corpo, { headers: { "content-type": "application/json" } }) } as unknown as Window & typeof globalThis;
    const desinstalar = instalarMonitorIA((e) => avisos.push(e), w);
    void w.fetch("/api/qualquer/coisa", { method: "POST" });   // ninguém lê a resposta
    await new Promise((r) => setTimeout(r, 0));
    expect(avisos.at(-1)!.ativos).toBe(0);
    desinstalar();
  });
});
