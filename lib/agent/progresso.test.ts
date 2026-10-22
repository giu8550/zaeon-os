import { describe, it, expect } from "vitest";
import {
  PROGRESS_SENTINEL, TERMINAIS,
  serializarProgresso, separarProgresso, faseCorrente,
} from "./progresso";

const ev = (fase: string, rotulo: string) => serializarProgresso({ fase, rotulo });
const PLAN = ev("plan", "Planejando a resposta");
const DRAFT = ev("draft", "Redigindo");
const STRUCTURED = '@@STRUCTURED@@{"nucleo":"A resposta."}';

describe("serializar/separar · ida e volta", () => {
  it("um evento some do texto e vira fase", () => {
    const { limpo, eventos } = separarProgresso(PLAN);
    expect(limpo).toBe("");
    expect(eventos).toEqual([{ fase: "plan", rotulo: "Planejando a resposta" }]);
  });

  it("preserva a ordem das fases, inclusive repetidas (revisão)", () => {
    const { eventos } = separarProgresso(PLAN + DRAFT + ev("critique", "Revisando criticamente") + DRAFT);
    expect(eventos.map((e) => e.fase)).toEqual(["plan", "draft", "critique", "draft"]);
    expect(faseCorrente(eventos)?.fase).toBe("draft");
  });

  it("sem evento nenhum, o texto passa intacto e não há fase", () => {
    const { limpo, eventos } = separarProgresso("texto puro, sem protocolo");
    expect(limpo).toBe("texto puro, sem protocolo");
    expect(faseCorrente(eventos)).toBeNull();
  });
});

describe("o payload final nunca é tocado", () => {
  it("progresso antes, resposta depois: a resposta chega inteira", () => {
    const { limpo, eventos } = separarProgresso(PLAN + DRAFT + STRUCTURED);
    expect(limpo).toBe(STRUCTURED);
    expect(eventos).toHaveLength(2);
  });

  it("a sentinela DENTRO do payload é conteúdo, não protocolo", () => {
    // O aluno pode ter escrito "@@PROGRESS@@" na pergunta e a resposta citá-lo de volta.
    // Depois do terminal, nada mais é protocolo — senão a gente corrompia a resposta.
    const payload = `@@STRUCTURED@@{"nucleo":"Ele escreveu ${PROGRESS_SENTINEL} na pergunta.\\n"}`;
    const { limpo, eventos } = separarProgresso(PLAN + payload);
    expect(limpo).toBe(payload);
    expect(eventos).toHaveLength(1);
  });

  it("vale pros três terminais", () => {
    for (const t of TERMINAIS) {
      const { limpo } = separarProgresso(PLAN + t + '{"x":1}');
      expect(limpo).toBe(t + '{"x":1}');
    }
  });
});

describe("stream partido — o caso que faria meia-sentinela aparecer na tela", () => {
  it("evento cortado no meio do JSON fica segurado", () => {
    const meio = PROGRESS_SENTINEL + '{"fase":"plan","rot';
    const { limpo, eventos } = separarProgresso(meio);
    expect(limpo).toBe("");
    expect(eventos).toEqual([]);
  });

  it("sentinela cortada no meio dela mesma fica segurada", () => {
    const { limpo } = separarProgresso("olá @@PROG");
    expect(limpo).toBe("olá ");
  });

  it("e aparece inteiro assim que o resto chega", () => {
    const parcial = "olá " + PROGRESS_SENTINEL + '{"fase":"plan","rot';
    const completo = "olá " + PLAN;
    expect(separarProgresso(parcial).eventos).toEqual([]);
    const fim = separarProgresso(completo);
    expect(fim.limpo).toBe("olá ");
    expect(fim.eventos).toHaveLength(1);
  });

  it("é idempotente: rederivar do acumulado inteiro dá o mesmo resultado", () => {
    // É assim que os dois chats trabalham — refazem a conta a cada chunk.
    const total = PLAN + DRAFT + STRUCTURED;
    const a = separarProgresso(total);
    const b = separarProgresso(total);
    expect(b).toEqual(a);
  });
});

describe("robustez — protocolo quebrado não derruba a resposta", () => {
  it("JSON inválido no evento é ignorado, não lançado", () => {
    const { limpo, eventos } = separarProgresso(PROGRESS_SENTINEL + "{isso não é json}\n" + "texto");
    expect(eventos).toEqual([]);
    expect(limpo).toBe("texto");
  });

  it("evento sem rótulo não vira fase (não existe fase em branco na tela)", () => {
    const { eventos } = separarProgresso(PROGRESS_SENTINEL + '{"fase":"plan","rotulo":"  "}\n');
    expect(eventos).toEqual([]);
  });

  it("erro do servidor depois do progresso continua legível", () => {
    // O catch do route enfileira texto puro; o progresso já emitido não pode engoli-lo.
    const erro = "Não consegui responder agora.";
    const { limpo, eventos } = separarProgresso(PLAN + erro);
    expect(limpo).toBe(erro);
    expect(eventos).toHaveLength(1);
  });
});


describe("a fase é peneirada — o campo não aceita recado humano", () => {
  it("nome de fase conhecido passa", () => {
    const { eventos } = separarProgresso(serializarProgresso({ fase: "draft", rotulo: "Redigindo" }));
    expect(eventos[0].fase).toBe("draft");
  });

  it("recado do trajectory no lugar da fase vira fase vazia, mas o rótulo sobrevive", () => {
    // O `emit(d, st, "gather", "degradado: ...")` manda o recado no `detail`, que é de
    // onde a fase sai. Sem peneira, isso viraria `fase: "degradado: ..."` — dado sujo.
    const cru = serializarProgresso({ fase: "degradado: nenhuma evidência reunida", rotulo: "Reunindo evidências" });
    const { eventos } = separarProgresso(cru);
    expect(eventos[0].fase).toBe("");
    expect(eventos[0].rotulo).toBe("Reunindo evidências");
  });

  it("a preparação anterior ao laço também é uma fase legítima", () => {
    const { eventos } = separarProgresso(serializarProgresso({ fase: "memoria", rotulo: "Retomando a conversa" }));
    expect(eventos[0].fase).toBe("memoria");
  });
});

describe("evento de modelo (quem respondeu)", () => {
  it("não vira fase; modeloDoTurno lê o último", async () => {
    const { serializarModelo, modeloDoTurno, faseCorrente: fc, separarProgresso: sp, serializarProgresso: spr } = await import("./progresso");
    const fio = spr({ fase: "draft", rotulo: "Escrevendo" }) + "Olá" + serializarModelo("Qwen3 30B · local");
    const { limpo, eventos } = sp(fio);
    expect(limpo).toBe("Olá");
    expect(fc(eventos)?.rotulo).toBe("Escrevendo");
    expect(modeloDoTurno(eventos)).toBe("Qwen3 30B · local");
    expect(modeloDoTurno(sp(spr({ fase: "plan", rotulo: "x" })).eventos)).toBeNull();
  });
});
