import { describe, it, expect, vi, afterEach } from "vitest";
import { executarTurno, montarHistorico, montarObjetivo, blocoCanal, type MsgRow, type TurnoPrisma } from "./agent-turn";
import { montarAliases } from "./mention";
import { EV_DIGITANDO, EV_MENSAGEM } from "./realtime";

const A = "a".repeat(24), B = "b".repeat(24), C = "c".repeat(24), CANAL = "d".repeat(24);
let seq = 0;
const msg = (p: Partial<MsgRow>): MsgRow => ({
  id: `m${++seq}`, canalId: CANAL, autorTipo: "humano", autorId: A, texto: "", mencoes: [], createdAt: new Date(2026, 8, 1, 0, seq), ...p,
});

function fakePrisma(canal: any, msgs: MsgRow[]) {
  const criadas: any[] = [];
  const upsert = vi.fn().mockResolvedValue({});
  const prisma: TurnoPrisma = {
    canal: { findUnique: async ({ where }) => (where.id === canal?.id ? canal : null) },
    canalMensagem: {
      findMany: async ({ take }) => [...msgs].sort((x, y) => +y.createdAt - +x.createdAt).slice(0, take),
      create: async ({ data }) => { const r = msg({ ...data, autorTipo: data.autorTipo, id: `novo${criadas.length + 1}` }); criadas.push(r); return r; },
    },
    agentProfile: { findMany: async () => [{ agentKey: "aura", tipo: "persona", nome: "Aura Prime", avatarUrl: "https://x/aura.png", bio: null, ativo: true, ordem: 0 }] },
    mentorTemplate: { findMany: async () => [] },
    user: { findMany: async ({ where }) => where.id.in.map((id: string) => ({ id, name: id === A ? "Ana" : id === B ? "Bia" : null })) },
    agentUsage: { upsert },
  };
  return { prisma, criadas, upsert };
}
const canal = { id: CANAL, ownerId: A, titulo: "TCC da turma", acesso: "turma", membros: [B], agentes: ["aura", "medicina"] };

describe("agent-turn · helpers puros", () => {
  it("montarHistorico: eu = assistant; humanos e outros agentes = user rotulados", () => {
    const msgs = [
      msg({ autorId: A, texto: "oi" }),
      msg({ autorTipo: "agente", autorId: "aura", texto: "olá" }),
      msg({ autorTipo: "agente", autorId: "medicina", texto: "bom dia" }),
      msg({ autorId: "z".repeat(24), texto: "sem nome" }),
    ];
    const h = montarHistorico(msgs, "aura", new Map([[A, "Ana"], ["medicina", "Osler"]]));
    expect(h).toEqual([
      { role: "user", text: "Ana: oi" },
      { role: "assistant", text: "olá" },
      { role: "user", text: "[agente Osler]: bom dia" },
      { role: "user", text: "Alguém: sem nome" },
    ]);
  });
  it("montarObjetivo: mensagem convocadora sem @, senão última que me menciona, senão última humana", () => {
    const al = montarAliases([{ agentKey: "aura", nome: "Aura" }, { agentKey: "medicina", nome: "Osler" }]);
    const m1 = msg({ texto: "@aura resume o capítulo 2", mencoes: ["aura"] });
    const m2 = msg({ texto: "@Osler e você?", mencoes: ["medicina"] });
    const m3 = msg({ texto: "valeu gente" });
    expect(montarObjetivo([m1, m2, m3], "aura", m1.id, al)).toBe("resume o capítulo 2");
    expect(montarObjetivo([m1, m2, m3], "aura", null, al)).toBe("resume o capítulo 2");
    expect(montarObjetivo([m1, m2, m3], "medicina", null, al)).toBe("e você?");
    expect(montarObjetivo([m3], "aura", null, al)).toBe("valeu gente");
    expect(montarObjetivo([], "aura", null, al)).toBe("");
    expect(montarObjetivo([msg({ texto: "@aura", mencoes: ["aura"] })], "aura", null, al)).toBe("@aura");
  });
  it("blocoCanal cita colegas por @chave e pessoas", () => {
    const ag: any = { agentKey: "aura", nome: "Aura" };
    const b = blocoCanal(canal as any, ag, [ag, { agentKey: "medicina", nome: "Osler" } as any], ["Ana"]);
    expect(b).toContain('"TCC da turma"');
    expect(b).toContain("@medicina (Osler)");
    expect(b).not.toContain("@aura (Aura)");
    expect(b).toContain("Ana");
  });
});

describe("agent-turn · executarTurno", () => {
  it("fluxo feliz: gera com identidade, grava CanalMensagem do agente, publica e registra uso", async () => {
    const msgs = [msg({ autorId: A, texto: "@aura me ajuda com a introdução", mencoes: ["aura"] })];
    const { prisma, criadas, upsert } = fakePrisma(canal, msgs);
    const eventos: any[] = [];
    const gerar = vi.fn().mockResolvedValue("  Claro, Ana! Vamos pela introdução.  ");
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: B, mensagemId: msgs[0]!.id }, { prisma, gerar, publicar: async (c, ev, p) => { eventos.push([c, ev, p]); } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mensagem).toMatchObject({ autorTipo: "agente", autorId: "aura", texto: "Claro, Ana! Vamos pela introdução.", autorNome: "Aura Prime", autorAvatar: "https://x/aura.png", mencoes: [] });
    expect(criadas).toHaveLength(1);
    const args = gerar.mock.calls[0]![0];
    expect(args.objective).toBe("me ajuda com a introdução");
    expect(args.agente.nome).toBe("Aura Prime");
    expect(args.history[0]).toEqual({ role: "user", text: "Ana: @aura me ajuda com a introdução" });
    expect(eventos.map((e) => e[1])).toEqual([EV_DIGITANDO, EV_MENSAGEM, EV_DIGITANDO]);
    expect(eventos[0]![2]).toEqual({ agentKey: "aura", estado: "digitando" });
    expect(eventos[2]![2]).toEqual({ agentKey: "aura", estado: "ocioso" });
    await new Promise((r) => setTimeout(r, 0));
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]![0].where).toEqual({ agentKey_userId: { agentKey: "aura", userId: B } });
  });
  it("author gate: C (fora da turma) não convoca; canal inexistente idem", async () => {
    const { prisma, criadas } = fakePrisma(canal, [msg({ texto: "@aura oi", mencoes: ["aura"] })]);
    const gerar = vi.fn();
    expect(await executarTurno({ canalId: CANAL, agentKey: "aura", userId: C }, { prisma, gerar, publicar: async () => {} })).toEqual({ ok: false, motivo: "gate" });
    expect(await executarTurno({ canalId: "e".repeat(24), agentKey: "aura", userId: A }, { prisma, gerar, publicar: async () => {} })).toEqual({ ok: false, motivo: "canal" });
    expect(gerar).not.toHaveBeenCalled();
    expect(criadas).toHaveLength(0);
  });
  it("agente desconhecido/silencioso → motivo agente; sem mensagem humana → vazio", async () => {
    const { prisma } = fakePrisma(canal, []);
    const base = { prisma, gerar: vi.fn(), publicar: async () => {} };
    expect(await executarTurno({ canalId: CANAL, agentKey: "fulano", userId: A }, base)).toEqual({ ok: false, motivo: "agente" });
    expect(await executarTurno({ canalId: CANAL, agentKey: "abnt_structurer", userId: A }, base)).toEqual({ ok: false, motivo: "agente" });
    expect(await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, base)).toEqual({ ok: false, motivo: "vazio" });
  });
  it("erro na geração: nada gravado, estado volta a ocioso, não lança", async () => {
    const { prisma, criadas } = fakePrisma(canal, [msg({ texto: "@medicina oi", mencoes: ["medicina"] })]);
    const eventos: [string, any][] = [];
    const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar: async () => { throw new Error("gemini 404"); }, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
    expect(r).toEqual({ ok: false, motivo: "erro", erro: "gemini 404" });
    expect(criadas).toHaveLength(0); // nada persistido…
    expect(eventos.map((e) => e[0])).toEqual([EV_DIGITANDO, EV_MENSAGEM, EV_DIGITANDO]);
    expect(eventos[1]![1]).toMatchObject({ efemera: true, autorTipo: "agente", autorId: "medicina", autorNome: "Osler" }); // …mas o agente avisa (efêmero)
    expect(String(eventos[1]![1].texto)).not.toContain("gemini 404");
  });
  it("C6 · teto da virtual key: mensagem efêmera do catálogo ('limite diário'), nada persistido", async () => {
    const { prisma, criadas } = fakePrisma(canal, [msg({ autorId: A, texto: "@medicina e aí?", mencoes: ["medicina"] })]);
    const eventos: any[] = [];
    const teto = Object.assign(new Error("llm:teto: Budget has been exceeded! Current cost: 0.011, Max budget: 0.01"), { classe: "teto", provedor: "litellm" });
    const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar: async () => { throw teto; }, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
    expect(r.ok).toBe(false);
    expect(criadas).toHaveLength(0);
    const efemera = eventos.find(([ev, p]) => ev === EV_MENSAGEM && p?.efemera)![1];
    expect(efemera.texto).toMatch(/limite diário de uso acabou/);
    expect(efemera.autorId).toBe("medicina");
  });

  describe("PR-A3 · teto por agente (ler ≠ agir)", () => {
    const comTeto = () => {
      const f = fakePrisma(canal, [msg({ autorId: A, texto: "@medicina e aí?", mencoes: ["medicina"] })]);
      (f.prisma as any).agentProfile.findUnique = async () => ({ tetoTokensDia: 100 });
      (f.prisma as any).tokenLedger = { aggregate: async () => ({ _sum: { totalTokens: 100 } }) };
      return f;
    };
    const prevFlag = process.env.AGENT_TETO_ENFORCE;
    afterEach(() => { if (prevFlag === undefined) delete process.env.AGENT_TETO_ENFORCE; else process.env.AGENT_TETO_ENFORCE = prevFlag; });

    it("flag off + autônomo + fora → responde normal (só avisa no admin)", async () => {
      delete process.env.AGENT_TETO_ENFORCE;
      const { prisma, criadas } = comTeto(); const gerar = vi.fn(async () => "resposta");
      const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A, origem: "autonomo" }, { prisma, gerar, publicar: async () => {} });
      expect(r.ok).toBe(true); expect(gerar).toHaveBeenCalledTimes(1); expect(criadas).toHaveLength(1);
    });
    it("flag on + autônomo + fora → motivo teto, gerar NÃO chamado, efêmera do catálogo", async () => {
      process.env.AGENT_TETO_ENFORCE = "1";
      const { prisma, criadas } = comTeto(); const gerar = vi.fn(async () => "resposta"); const eventos: any[] = [];
      const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A, origem: "autonomo" }, { prisma, gerar, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(r).toEqual({ ok: false, motivo: "teto" }); expect(gerar).not.toHaveBeenCalled(); expect(criadas).toHaveLength(0);
      expect(eventos.find(([ev, p]) => ev === EV_MENSAGEM && p?.efemera)![1].texto).toMatch(/limite diário/);
    });
    it("flag on + HUMANO + fora → responde normal (turno pedido por humano nunca é barrado)", async () => {
      process.env.AGENT_TETO_ENFORCE = "1";
      const { prisma, criadas } = comTeto(); const gerar = vi.fn(async () => "resposta");
      const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar, publicar: async () => {} });
      expect(r.ok).toBe(true); expect(gerar).toHaveBeenCalledTimes(1); expect(criadas).toHaveLength(1);
    });
  });

  it("mentor do seed responde com seu nome (Osler) mesmo sem profile", async () => {
    const { prisma } = fakePrisma(canal, [msg({ texto: "@Osler explica", mencoes: ["medicina"] })]);
    const gerar = vi.fn().mockResolvedValue("ok");
    const r = await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar, publicar: async () => {} });
    expect(r.ok && r.mensagem.autorNome).toBe("Osler");
    expect(r.ok && r.mensagem.autorAvatar).toBeNull();
  });
});
