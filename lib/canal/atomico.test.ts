/**
 * #443 · gravações do canal que não apagam a de outra pessoa ao mesmo tempo.
 * O banco de mentira devolve uma CÓPIA na leitura e espera um instante — assim duas operações leem a mesma lista
 * antes de qualquer uma gravar, que é exatamente a situação que fazia alguém ficar de fora.
 */
import { describe, it, expect } from "vitest";
import { entrarComoMembro, sairComoMembro, atualizarAgentes, entrarNaConversaAtomico, trocarComTentativas, type DbAtomico } from "./atomico";
import { updateManyCanais } from "./fakeCanalDb";

const CANAL = "c1";
function banco(canal: Record<string, unknown>) {
  const linhas = [{ id: CANAL, ownerId: "dono", membros: [] as string[], agentes: [] as string[], dmCom: null, ...canal }];
  const pausa = () => new Promise((r) => setTimeout(r, 0));
  const db: DbAtomico = {
    canal: {
      findUnique: async () => { const c = JSON.parse(JSON.stringify(linhas[0])); await pausa(); return c; },
      updateMany: async (a) => { await pausa(); return updateManyCanais(linhas as never, a as never); },
    },
  };
  return { db, canal: linhas[0]! };
}

describe("entrar como membro", () => {
  it("duas pessoas entrando no mesmo instante: as DUAS ficam (antes uma apagava a outra)", async () => {
    const b = banco({ membros: ["ana"] });
    const r = await Promise.all([entrarComoMembro(b.db, CANAL, "bia"), entrarComoMembro(b.db, CANAL, "caio")]);
    expect(r).toEqual(["entrou", "entrou"]);
    expect([...b.canal.membros].sort()).toEqual(["ana", "bia", "caio"]);
  });
  it("clique duplo em 'Entrar': entra UMA vez, e o segundo sabe que já estava (não anuncia 'entrou' de novo)", async () => {
    const b = banco({});
    const r = await Promise.all([entrarComoMembro(b.db, CANAL, "bia"), entrarComoMembro(b.db, CANAL, "bia")]);
    expect([...r].sort()).toEqual(["entrou", "ja-estava"]);
    expect(b.canal.membros).toEqual(["bia"]);
  });
});

describe("barra de agentes", () => {
  it("duas mensagens ao mesmo tempo (uma chama a Nina, outra dispensa a Zenita): as duas mudanças ficam", async () => {
    const b = banco({ agentes: ["aura", "zenita"] });
    await Promise.all([atualizarAgentes(b.db, CANAL, ["nina"], []), atualizarAgentes(b.db, CANAL, ["zenita"], ["zenita"])]);
    expect([...b.canal.agentes].sort()).toEqual(["aura", "nina"]);
  });
  it("sem mudança: não grava nada", async () => {
    const b = banco({ agentes: ["aura"] });
    expect(await atualizarAgentes(b.db, CANAL, ["aura"], [])).toEqual(["aura"]);
  });
});

describe("entrar na conversa pelo convite", () => {
  it("duas pessoas aceitam o convite pra mesma conversa de dois ao mesmo tempo: vira grupo com TODO mundo", async () => {
    const b = banco({ ownerId: "giulia", dmCom: "martinez", membros: [] });
    const r = await Promise.all([entrarNaConversaAtomico(b.db, CANAL, "ana"), entrarNaConversaAtomico(b.db, CANAL, "bia")]);
    expect(r.map((x) => x?.resultado)).toEqual(["entrou", "entrou"]);
    expect(b.canal.dmCom).toBeNull();
    expect([...b.canal.membros].sort()).toEqual(["ana", "bia", "martinez"]);
  });
  it("quem já fazia parte: 'ja-estava' (não anuncia de novo)", async () => {
    const b = banco({ ownerId: "giulia", membros: ["ana"] });
    expect((await entrarNaConversaAtomico(b.db, CANAL, "ana"))?.resultado).toBe("ja-estava");
    expect(b.canal.membros).toEqual(["ana"]);
  });
  it("conversa sumiu: null", async () => {
    const db: DbAtomico = { canal: { findUnique: async () => null, updateMany: async () => ({ count: 0 }) } };
    expect(await entrarNaConversaAtomico(db, CANAL, "ana")).toBeNull();
  });
});

describe("tentar de novo", () => {
  it("se a lista mudou no meio, lê de novo; desiste depois das tentativas", async () => {
    let lidas = 0;
    const r = await trocarComTentativas(async () => ({ n: ++lidas }), () => ({ n: 0 }), async () => 0, 3);
    expect(r).toBeNull();
    expect(lidas).toBe(3);
  });
});

describe("#466 · sair como membro", () => {
  it("o dono tira o Martinez no mesmo instante em que a Ana entra: a Ana fica", async () => {
    const b = banco({ membros: ["martinez"] });
    await Promise.all([sairComoMembro(b.db, CANAL, "martinez"), entrarComoMembro(b.db, CANAL, "ana")]);
    expect(b.canal.membros).toEqual(["ana"]);
  });
  it("tirar quem não está: 'nao-estava', nada muda", async () => {
    const b = banco({ membros: ["ana"] });
    expect(await sairComoMembro(b.db, CANAL, "martinez")).toBe("nao-estava");
    expect(b.canal.membros).toEqual(["ana"]);
  });
});
