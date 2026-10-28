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
  it("#423 · montarHistorico: o aviso 'fulano entrou' vai como aviso do canal, não como fala da pessoa", () => {
    const h = montarHistorico([msg({ autorTipo: "sistema", autorId: A, texto: "Ana entrou no escritório" })], "aura", new Map([[A, "Ana"]]));
    expect(h).toEqual([{ role: "user", text: "[aviso do canal]: Ana entrou no escritório" }]);
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
  it("#635: apertaram '■ Parar' enquanto ele escrevia → a resposta NÃO entra no canal (e o balão some)", async () => {
    const msgs = [msg({ autorId: A, texto: "@aura explica tudo de cálculo", mencoes: ["aura"] })];
    const { prisma, criadas } = fakePrisma(canal, msgs);
    const eventos: any[] = [];
    const gerar = vi.fn().mockImplementation(async () => {
      msgs.push(msg({ autorTipo: "sistema", autorId: "parar", texto: "Ana interrompeu a resposta" }));
      return "Uma resposta bem longa…";
    });
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: msgs[0]!.id }, { prisma, gerar, publicar: async (c, ev, p) => { eventos.push([c, ev, p]); } });
    expect(r).toEqual({ ok: false, motivo: "parou" });
    expect(criadas).toHaveLength(0);
    expect(eventos.map((e) => e[1])).toEqual([EV_DIGITANDO, EV_DIGITANDO]);
    expect(eventos[1]![2]).toEqual({ agentKey: "aura", estado: "ocioso" });
  });
  it("#635: a agente foi dispensada enquanto escrevia → a resposta atrasada NÃO entra; um 'Parar' antigo não atrapalha", async () => {
    const antigo = msg({ autorTipo: "sistema", autorId: "parar", texto: "Ana interrompeu a resposta" });
    const msgs = [antigo, msg({ autorId: A, texto: "@aura e a introdução?", mencoes: ["aura"] })];
    const { prisma, criadas } = fakePrisma(canal, msgs);
    const gerar = vi.fn().mockImplementation(async () => {
      msgs.push(msg({ autorTipo: "sistema", autorId: "aura", texto: "Aura Prime saiu da conversa" }));
      return "Sobre a introdução…";
    });
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: msgs[1]!.id }, { prisma, gerar, publicar: async () => {} });
    expect(r).toEqual({ ok: false, motivo: "saiu" });
    expect(criadas).toHaveLength(0);
    // sem a saída: o "Parar" de ANTES da mensagem não cancela
    msgs.pop();
    const ok = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: msgs[1]!.id }, { prisma, gerar: vi.fn().mockResolvedValue("Sobre a introdução…"), publicar: async () => {} });
    expect(ok.ok).toBe(true);
  });
  it("vários usuários no mesmo canal: o agente enxerga cada pessoa pelo nome e responde a quem o chamou", async () => {
    const m1 = msg({ autorId: A, texto: "@aura resume o capítulo 2", mencoes: ["aura"] });
    const r1 = msg({ autorTipo: "agente", autorId: "aura", texto: "O capítulo 2 trata de…", mencoes: [] });
    const m2 = msg({ autorId: B, texto: "@aura e a parte da metodologia?", mencoes: ["aura"] });
    const { prisma, upsert } = fakePrisma(canal, [m1, r1, m2]);
    const gerar = vi.fn().mockResolvedValue("A metodologia usa entrevistas.");
    const eventos: any[] = [];
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: B, mensagemId: m2.id }, { prisma, gerar, publicar: async (c, ev, p) => { eventos.push([c, ev, p]); } });
    expect(r.ok).toBe(true);

    const args = gerar.mock.calls[0]![0];
    // quem chamou é a Bia: o objetivo é a mensagem DELA, sem o @
    expect(args.userId).toBe(B);
    expect(args.objective).toBe("e a parte da metodologia?");
    // o histórico distingue as duas pessoas e a própria Aura (assistant)
    expect(args.history).toEqual([
      { role: "user", text: "Ana: @aura resume o capítulo 2" },
      { role: "assistant", text: "O capítulo 2 trata de…" },
      { role: "user", text: "Bia: @aura e a parte da metodologia?" },
    ]);
    // o contexto do canal lista as duas pessoas
    const bloco: string = (args.agente as any).__blocoCanal;
    expect(bloco).toContain("Ana");
    expect(bloco).toContain("Bia");
    // a resposta vai pro canal (todos veem) e o uso é de quem chamou
    expect(eventos.some(([, ev]) => ev === EV_MENSAGEM)).toBe(true);
    await new Promise((res) => setTimeout(res, 0));
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

  describe("#396 (B) · um agente passa a bola pra outro", () => {
    const pede = () => msg({ autorId: A, texto: "@aura me ajuda com o caso clínico", mencoes: ["aura"] });

    it("a resposta marca um colega → encadeia ele, como 'autonomo', cadeia+1, com quem chamou", async () => {
      const m = pede();
      const { prisma, criadas } = fakePrisma(canal, [m]);
      const encadear = vi.fn();
      const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id },
        { prisma, gerar: async () => "A parte clínica é com o **@Osler**.", publicar: async () => {}, encadear });
      expect(r.ok && r.encadeado).toBe("medicina");
      expect(encadear).toHaveBeenCalledTimes(1);
      expect(encadear.mock.calls[0]![0]).toEqual({
        canalId: CANAL, agentKey: "medicina", userId: A, mensagemId: criadas[0]!.id, origem: "autonomo",
        cadeia: 1, chamadoPor: "aura", jaNaCadeia: ["aura"],
      });
    });

    it("#468: quem SAIU da conversa não volta porque outra agente o marcou (sem a linha 'voltou')", async () => {
      const m = pede();
      const saiu = msg({ autorTipo: "sistema", autorId: "medicina", texto: "Osler saiu da conversa" });
      const { prisma } = fakePrisma(canal, [saiu, m]);
      const encadear = vi.fn();
      const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id },
        { prisma, gerar: async () => "O @Osler está saindo, então seguimos nós duas.", publicar: async () => {}, encadear });
      expect(encadear).not.toHaveBeenCalled();
      expect(r.ok && r.encadeado).toBeFalsy();
    });

    it("#468: depois que uma PESSOA chamou de volta ('voltou'), a cadeia pode chamá-lo de novo", async () => {
      const saiu = msg({ autorTipo: "sistema", autorId: "medicina", texto: "Osler saiu da conversa" });
      const voltou = msg({ autorTipo: "sistema", autorId: "medicina", texto: "Osler voltou para a conversa" });
      const m = pede();
      const { prisma } = fakePrisma(canal, [saiu, voltou, m]);
      const encadear = vi.fn();
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id },
        { prisma, gerar: async () => "A parte clínica é com o **@Osler**.", publicar: async () => {}, encadear });
      expect(encadear).toHaveBeenCalledTimes(1);
    });

    it("sem @ na resposta → não encadeia", async () => {
      const m = pede();
      const { prisma } = fakePrisma(canal, [m]);
      const encadear = vi.fn();
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id }, { prisma, gerar: async () => "Resolvido.", publicar: async () => {}, encadear });
      expect(encadear).not.toHaveBeenCalled();
    });

    it("no limite (cadeia 2) não encadeia mais", async () => {
      const m = pede();
      const { prisma } = fakePrisma(canal, [m]);
      const encadear = vi.fn();
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id, cadeia: 2, jaNaCadeia: ["nina", "teo"] },
        { prisma, gerar: async () => "chama o @Osler", publicar: async () => {}, encadear });
      expect(encadear).not.toHaveBeenCalled();
    });

    it("não chama de volta quem já falou na cadeia (sem ping-pong)", async () => {
      const m = pede();
      const { prisma } = fakePrisma(canal, [m]);
      const encadear = vi.fn();
      await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A, mensagemId: m.id, cadeia: 1, chamadoPor: "aura", jaNaCadeia: ["aura"] },
        { prisma, gerar: async () => "volta pra @aura", publicar: async () => {}, encadear });
      expect(encadear).not.toHaveBeenCalled();
    });

    it("se encadear falhar, a resposta que já saiu continua valendo", async () => {
      const m = pede();
      const { prisma, criadas } = fakePrisma(canal, [m]);
      const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id },
        { prisma, gerar: async () => "é com o @Osler", publicar: async () => {}, encadear: async () => { throw new Error("fila fora"); } });
      expect(r.ok).toBe(true);
      expect(criadas).toHaveLength(1);
    });

    it("sem a dependência de encadear (ex.: chamada direta) nada muda", async () => {
      const m = pede();
      const { prisma } = fakePrisma(canal, [m]);
      const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A, mensagemId: m.id }, { prisma, gerar: async () => "é com o @Osler", publicar: async () => {} });
      expect(r.ok && r.encadeado).toBeNull();
    });

    it("o prompt pede pra ficar no nicho; quem foi chamado sabe por quem e fecha com próximos passos", async () => {
      const m = pede();
      const { prisma } = fakePrisma(canal, [m]);
      const gerar = vi.fn().mockResolvedValue("ok");
      await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A, mensagemId: m.id, cadeia: 1, chamadoPor: "aura", jaNaCadeia: ["aura"] },
        { prisma, gerar, publicar: async () => {} });
      const bloco: string = (gerar.mock.calls[0]![0].agente as any).__blocoCanal;
      expect(bloco).toContain("Fique no SEU nicho");
      expect(bloco).toContain("chamado(a) por @aura");
      expect(bloco).toContain("próximos passos");
    });

    it("no limite, o prompt diz pra NÃO chamar outros agentes", () => {
      const ag: any = { agentKey: "teo", nome: "Téo" };
      const b = blocoCanal(canal as any, ag, [ag], [], { podePassar: false });
      expect(b).toContain("Não chame outros agentes agora");
      expect(b).not.toContain("Fique no SEU nicho");
    });
  });

  describe("#396 · estados do agente no evento de digitando", () => {
    const estados = (eventos: [string, any][]) => eventos.filter(([ev]) => ev === EV_DIGITANDO).map(([, p]) => p.estado);

    it("publica cada fase do harness só quando muda (pesquisando, investigando, redigindo) e fecha em ocioso", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@aura pesquisa isso", mencoes: ["aura"] })]);
      const eventos: [string, any][] = [];
      const gerar = vi.fn(async ({ onFase }: any) => {
        for (const f of ["route", "plan", "gather", "gather", "reason", "critique", "draft", "finalize"]) onFase?.(f);
        return "pronto";
      });
      const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(r.ok).toBe(true);
      // gather repetido e reason→critique (mesmo estado "investigando") não geram evento duplicado
      expect(estados(eventos)).toEqual(["digitando", "entendendo", "planejando", "pesquisando", "investigando", "redigindo", "ocioso"]);
      expect(eventos.filter(([ev]) => ev === EV_DIGITANDO).every(([, p]) => p.agentKey === "aura")).toBe(true);
    });

    it("#468 · enquanto o agente demora, repete o estado atual (a tela apaga quem ficou sem aviso); para no fim", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@aura pesquisa isso", mencoes: ["aura"] })]);
      const eventos: [string, any][] = [];
      const gerar = vi.fn(async ({ onFase }: any) => {
        onFase?.("gather");
        await new Promise((r) => setTimeout(r, 60));
        return "pronto";
      });
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar, pulsoMs: 20, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      const lista = estados(eventos);
      expect(lista[0]).toBe("digitando");
      expect(lista.at(-1)).toBe("ocioso");
      expect(lista.filter((e) => e === "pesquisando").length).toBeGreaterThanOrEqual(2);
      const depois = eventos.length;
      await new Promise((r) => setTimeout(r, 60));
      expect(eventos.length).toBe(depois);   // o pulso parou junto com o turno
    });

    it("sem nenhuma fase (gerar simples) o fluxo continua digitando → ocioso", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@aura oi", mencoes: ["aura"] })]);
      const eventos: [string, any][] = [];
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar: async () => "oi", publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(estados(eventos)).toEqual(["digitando", "ocioso"]);
    });

    it("fase desconhecida não vira estado novo (fica em digitando)", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@aura oi", mencoes: ["aura"] })]);
      const eventos: [string, any][] = [];
      const gerar = vi.fn(async ({ onFase }: any) => { onFase?.("degradado: nenhuma evidência reunida"); return "ok"; });
      await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(estados(eventos)).toEqual(["digitando", "ocioso"]);
    });

    it("teto da virtual key termina em 'descanso' (e não em ocioso)", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@medicina e aí?", mencoes: ["medicina"] })]);
      const eventos: [string, any][] = [];
      const teto = Object.assign(new Error("llm:teto: Budget has been exceeded"), { classe: "teto", provedor: "litellm" });
      await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar: async () => { throw teto; }, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(estados(eventos)).toEqual(["digitando", "descanso"]);
    });

    it("erro comum termina em ocioso", async () => {
      const { prisma } = fakePrisma(canal, [msg({ autorId: A, texto: "@medicina oi", mencoes: ["medicina"] })]);
      const eventos: [string, any][] = [];
      await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar: async () => { throw new Error("gemini 404"); }, publicar: async (_c, ev, p) => { eventos.push([ev, p]); } });
      expect(estados(eventos)).toEqual(["digitando", "ocioso"]);
    });
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

describe("#468 · a IA fica sabendo quem saiu", () => {
  it("o bloco do canal lista quem saiu e tira dos 'outros agentes'", () => {
    const ag = { agentKey: "aura", nome: "Aura" } as any;
    const b = blocoCanal({ titulo: "teste 2" } as any, ag, [ag, { agentKey: "teo", nome: "Téo" } as any], ["Giulia"], { fora: [{ agentKey: "teo", nome: "Téo" }] });
    expect(b).toMatch(/Saíram da conversa \(NÃO marque com @; só voltam se a pessoa chamar\): Téo\./);
    expect(b).not.toMatch(/@teo \(Téo\)/);
  });
});

describe("agent-turn · #562 memória profunda com privacidade", () => {
  const fake = () => {
    const chamadas = { lembrar: [] as any[], guardar: [] as any[] };
    return {
      chamadas,
      memoria: {
        lembrar: async (a: any) => { chamadas.lembrar.push(a); return "Memórias relevantes:\n- gosta de exemplos"; },
        guardar: async (a: any) => { chamadas.guardar.push(a); },
      },
    };
  };
  const sozinha = { id: CANAL, ownerId: A, titulo: "Meu escritório", acesso: "privado", membros: [], agentes: ["aura"] };

  it("conversa só da pessoa: relembra e guarda com ELA (tudo dela, sem filtro de ala) e a lembrança chega no turno", async () => {
    const { prisma } = fakePrisma(sozinha, [msg({ autorId: A, texto: "@aura me explica mitose", mencoes: ["aura"] })]);
    const { memoria, chamadas } = fake();
    const gerar = vi.fn(async (_a: any) => "Mitose é a divisão celular…");
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar, publicar: async () => {}, memoria });
    expect(r.ok).toBe(true);
    expect(chamadas.lembrar).toEqual([{ dono: A, ala: null, dica: expect.stringContaining("mitose") }]);
    expect(gerar.mock.calls[0]![0]).toMatchObject({ memoria: expect.stringContaining("gosta de exemplos"), memoriaDe: A });
    await new Promise((ok) => setTimeout(ok, 0));
    expect(chamadas.guardar).toEqual([expect.objectContaining({ dono: A, scopeId: CANAL, resposta: "Mitose é a divisão celular…" })]);
  });

  it("com mentor, na conversa só da pessoa: a ala do mentor (a mesma do chat)", async () => {
    const { prisma } = fakePrisma({ ...sozinha, agentes: ["medicina"] }, [msg({ autorId: A, texto: "@medicina oi", mencoes: ["medicina"] })]);
    const { memoria, chamadas } = fake();
    await executarTurno({ canalId: CANAL, agentKey: "medicina", userId: A }, { prisma, gerar: async () => "Oi!", publicar: async () => {}, memoria });
    expect(chamadas.lembrar[0]).toMatchObject({ dono: A, ala: `medicina/${A}` });
  });

  it.each([
    ["grupo com membro", { ...sozinha, acesso: "turma", membros: [B] }],
    ["conversa de dois", { ...sozinha, dmCom: B }],
    ["escritório aberto", { ...sozinha, acesso: "aberto" }],
  ] as const)("%s: só a memória do ESCRITÓRIO — nenhuma memória pessoal lida nem gravada", async (_n, c) => {
    const { prisma } = fakePrisma(c, [msg({ autorId: A, texto: "@aura resume o capítulo", mencoes: ["aura"] })]);
    const { memoria, chamadas } = fake();
    const gerar = vi.fn(async (_a: any) => "Resumo…");
    await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar, publicar: async () => {}, memoria });
    await new Promise((ok) => setTimeout(ok, 0));
    expect(chamadas.lembrar).toEqual([{ dono: CANAL, ala: "escritorio", dica: expect.any(String) }]);
    expect(chamadas.guardar.map((g) => g.dono)).toEqual([CANAL]);
    expect(gerar.mock.calls[0]![0]).toMatchObject({ memoriaDe: CANAL });
    expect(JSON.stringify([chamadas.lembrar, chamadas.guardar])).not.toContain(A);
  });

  it("memória fora do ar não derruba o turno", async () => {
    const { prisma } = fakePrisma(sozinha, [msg({ autorId: A, texto: "@aura oi", mencoes: ["aura"] })]);
    const memoria = { lembrar: async () => { throw new Error("atlas fora"); }, guardar: async () => { throw new Error("atlas fora"); } };
    const r = await executarTurno({ canalId: CANAL, agentKey: "aura", userId: A }, { prisma, gerar: async () => "Oi!", publicar: async () => {}, memoria });
    expect(r.ok).toBe(true);
  });
});

describe("#635 · o que o agente do canal ouve", () => {
  it("não promete o que não faz (kanban, e-mail…) e escreve fórmula em $…$, fora de crases", async () => {
    const { HONESTIDADE, FORMULAS } = await import("./agent-turn");
    const b = blocoCanal({ id: CANAL, ownerId: A, titulo: "T", acesso: "turma", membros: [], agentes: ["aura"] } as any, { agentKey: "teo", nome: "Téo" } as any, [], ["Ana"]);
    expect(b).toContain(HONESTIDADE);
    expect(b).toContain(FORMULAS);
    expect(HONESTIDADE).toMatch(/kanban/);
    expect(HONESTIDADE).toMatch(/Nunca diga/);
    expect(FORMULAS).toMatch(/Nunca coloque fórmula dentro de crases/);
  });
});
