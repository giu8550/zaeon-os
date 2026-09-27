import { describe, it, expect, beforeEach } from "vitest";
import {
  carregarThreads, salvarThreads, criarThread, fecharThread, renomearThread,
  tituloAPartirDe, chaveDaThread, carregarMensagens, salvarMensagens,
  threadAtiva, marcarAtiva, CHAVE_INDICE, CHAVE_LEGADA, MAX_ABAS, TITULO_PADRAO,
  type Armazem,
} from "./threads";

function armazemFalso(inicial: Record<string, string> = {}): Armazem & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (k: string) => (k in dados ? dados[k] : null),
    setItem: (k: string, v: string) => { dados[k] = v; },
    removeItem: (k: string) => { delete dados[k]; },
  };
}

/** Armazém que recusa tudo — aba anônima, cota estourada. */
const armazemQuebrado: Armazem = {
  getItem: () => { throw new Error("nope"); },
  setItem: () => { throw new Error("nope"); },
  removeItem: () => { throw new Error("nope"); },
};

describe("título da conversa", () => {
  it("sai da primeira frase, como toda IA faz", () => {
    expect(tituloAPartirDe("Me explica a cafeína. E depois a adenosina.")).toBe("Me explica a cafeína");
  });
  it("não corta no meio da palavra", () => {
    const original = "quero entender profundamente a estrutura molecular da cafeína hoje";
    const t = tituloAPartirDe(original);
    expect(t.endsWith("…")).toBe(true);
    // a propriedade real: o que sobrou é prefixo do original e termina onde havia espaço
    const base = t.slice(0, -1);
    expect(original.startsWith(base)).toBe(true);
    expect(original[base.length]).toBe(" ");
  });

  it("não deixa artigo pendurado no fim", () => {
    expect(tituloAPartirDe("quero entender profundamente a estrutura molecular")).not.toMatch(/\s(a|o|de|da)…$/);
  });
  it("texto vazio vira o padrão", () => {
    expect(tituloAPartirDe("   ")).toBe(TITULO_PADRAO);
  });
});

describe("migração da conversa antiga", () => {
  it("adota a thread legada como aba #1, com histórico e título", () => {
    const legado = [{ role: "user", text: "Me explica a cafeína" }, { role: "assistant", text: "..." }];
    const a = armazemFalso({ [CHAVE_LEGADA]: JSON.stringify(legado) });
    const threads = carregarThreads(a);
    expect(threads.length).toBe(1);
    expect(threads[0].titulo).toBe("Me explica a cafeína");
    // o histórico foi PRA aba — ninguém perde conversa por causa de refactor
    expect(carregarMensagens(a, threads[0].id)).toEqual(legado);
  });

  it("sem nada salvo, começa com uma aba vazia", () => {
    const a = armazemFalso();
    const threads = carregarThreads(a);
    expect(threads.length).toBe(1);
    expect(threads[0].titulo).toBe(TITULO_PADRAO);
  });

  it("não migra duas vezes", () => {
    const a = armazemFalso({ [CHAVE_LEGADA]: JSON.stringify([{ role: "user", text: "oi" }]) });
    const primeira = carregarThreads(a);
    const segunda = carregarThreads(a);
    expect(segunda.map((t) => t.id)).toEqual(primeira.map((t) => t.id));
  });
});

describe("abas", () => {
  let a: ReturnType<typeof armazemFalso>;
  beforeEach(() => { a = armazemFalso(); });

  it("a conversa nova entra na frente", () => {
    const base = carregarThreads(a);
    const { threads, nova } = criarThread(base);
    expect(threads[0].id).toBe(nova.id);
    expect(threads.length).toBe(2);
  });

  it("respeita o teto de abas", () => {
    let threads = carregarThreads(a);
    for (let i = 0; i < MAX_ABAS + 5; i++) threads = criarThread(threads).threads;
    expect(threads.length).toBe(MAX_ABAS);
  });

  it("fechar apaga o histórico daquela aba e só dela", () => {
    let threads = carregarThreads(a);
    const { threads: t2, nova } = criarThread(threads);
    salvarMensagens(a, nova.id, [{ role: "user", text: "some" }]);
    salvarMensagens(a, t2[1].id, [{ role: "user", text: "fica" }]);
    const { threads: t3 } = fecharThread(a, t2, nova.id);
    expect(a.dados[chaveDaThread(nova.id)]).toBeUndefined();
    expect(carregarMensagens(a, t3[0].id)).toEqual([{ role: "user", text: "fica" }]);
  });

  it("fechar a última cria outra — sala de conversa sem conversa é beco sem saída", () => {
    const threads = carregarThreads(a);
    const { threads: depois, proxima } = fecharThread(a, threads, threads[0].id);
    expect(depois.length).toBe(1);
    expect(proxima).toBe(depois[0].id);
    expect(depois[0].id).not.toBe(threads[0].id);
  });

  it("fechar a do meio foca a vizinha, não volta pro começo", () => {
    let threads = carregarThreads(a);
    threads = criarThread(threads, "A").threads;
    threads = criarThread(threads, "B").threads;
    const doMeio = threads[1].id;
    const { proxima } = fecharThread(a, threads, doMeio);
    expect(proxima).toBe(threads[2].id);
  });

  it("renomear ignora título vazio", () => {
    const threads = carregarThreads(a);
    expect(renomearThread(threads, threads[0].id, "   ")[0].titulo).toBe(TITULO_PADRAO);
    expect(renomearThread(threads, threads[0].id, " Cafeína ")[0].titulo).toBe("Cafeína");
  });

  it("a aba ativa sobrevive ao reload; aba morta cai na primeira", () => {
    const threads = carregarThreads(a);
    const { threads: t2, nova } = criarThread(threads);
    salvarThreads(a, t2);
    marcarAtiva(a, nova.id);
    expect(threadAtiva(a, t2)).toBe(nova.id);
    const { threads: t3 } = fecharThread(a, t2, nova.id);
    expect(threadAtiva(a, t3)).toBe(t3[0].id);
  });
});

describe("armazenamento indisponível (aba anônima)", () => {
  it("não derruba a sala: devolve uma aba em memória", () => {
    expect(() => carregarThreads(armazemQuebrado)).not.toThrow();
    expect(carregarThreads(armazemQuebrado).length).toBe(1);
  });
  it("salvar não lança", () => {
    expect(() => salvarMensagens(armazemQuebrado, "x", [1, 2])).not.toThrow();
  });
});
