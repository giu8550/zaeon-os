import { describe, it, expect } from "vitest";
import { PASSOS_SALA, EVT_PERGUNTA_CHAT, EVT_PERCURSO_ABERTO, deveMostrarTourSala, eventoAvanca, passosDaSala, tarefaDoPercurso } from "./tourSala";
import { EVT_ABRIR_DOC } from "@/lib/chat/documentos";

describe("o tour do laboratório (fora do tutorial)", () => {
  it("o caminho de ouro: estudo no chat → Sala de Estudos → diagrama → percurso → mapa", () => {
    expect(PASSOS_SALA.map((p) => p.id)).toEqual(["iniciar-estudo", "sala-estudos", "criar-diagrama", "gerar-percurso", "mapa-pronto"]);
    for (const p of PASSOS_SALA) {
      expect(p.alvos.length).toBeGreaterThan(0);
      expect(p.dica.length).toBeLessThan(60);
      // cada passo OU anda pela ação OU tem o botão — nunca os dois, nunca nenhum
      expect(!!p.avancaEm?.length !== !!p.cta).toBe(true);
    }
  });
  it("os passos de ação andam pela AÇÃO real (pedir estudo, abrir diagrama, abrir o percurso)", () => {
    const [estudo, , diagrama, percurso] = PASSOS_SALA;
    expect(eventoAvanca(estudo!, EVT_PERGUNTA_CHAT, { prompt: "Quero estudar sobre: fotossíntese" })).toBe(true);
    expect(eventoAvanca(diagrama!, EVT_ABRIR_DOC, { studioKind: "diagram" })).toBe(true);
    expect(eventoAvanca(diagrama!, EVT_ABRIR_DOC, { studioKind: "quiz" })).toBe(false);   // #613: aula conta (é visual); um quiz não
    expect(eventoAvanca(diagrama!, EVT_PERGUNTA_CHAT, null)).toBe(false);
    expect(eventoAvanca(percurso!, EVT_PERCURSO_ABERTO, undefined)).toBe(true);
  });
  it("começa pedindo um tema no chat e mostra a Sala de Estudos como os blueprints", () => {
    expect(PASSOS_SALA[0]!.alvos[0]).toBe('[data-tour="composer-estudos"]');   // #618: o campo, não o botão
    expect(PASSOS_SALA[1]!.fala).toMatch(/blueprint/);
    expect(PASSOS_SALA[1]!.fala).not.toMatch(/👇/);   // #626: a Sala fica na barra da esquerda, não embaixo
    expect(PASSOS_SALA[0]!.fala).not.toMatch(/Quero estudar sobre…/);   // #626: o botão nem existe em conversa começada
    expect(PASSOS_SALA[1]!.ir).toEqual({ tab: "sala-de-estudos", aba: "feed" });
    expect(PASSOS_SALA.at(-1)!.cta).toMatch(/Boa jornada/);
  });
  it("sem o mapa do percurso ligado, o tour termina no diagrama", () => {
    expect(passosDaSala(true)).toHaveLength(5);
    expect(passosDaSala(false).map((p) => p.id)).toEqual(["iniciar-estudo", "sala-estudos", "criar-diagrama"]);
  });
  it("só fora do tutorial, uma vez, sem outro tour rodando e nunca no celular", () => {
    const base = { noTutorial: false, largura: 1280, visto: false, outroTour: false };
    expect(deveMostrarTourSala(base)).toBe(true);
    expect(deveMostrarTourSala({ ...base, noTutorial: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, visto: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, outroTour: true })).toBe(false);
    expect(deveMostrarTourSala({ ...base, largura: 390 })).toBe(false);
  });
});

describe("tourSala · #613 alvos que existem na tela", () => {
  it("nenhum passo aponta pras marcações que saíram da tela (sala-estudos, diagrama)", () => {
    const todos = PASSOS_SALA.flatMap((p) => p.alvos).join(" ");
    expect(todos).not.toMatch(/data-tour="(sala-estudos|diagrama)"/);
  });
});

describe("#613 · os passos de ação não travam", () => {
  const diagrama = PASSOS_SALA.find((p) => p.id === "criar-diagrama")!;
  it("o passo do diagrama anda com qualquer documento visual (diagrama ou aula), não com qualquer coisa", () => {
    expect(eventoAvanca(diagrama, EVT_ABRIR_DOC, { studioKind: "diagram" })).toBe(true);
    expect(eventoAvanca(diagrama, EVT_ABRIR_DOC, { studioKind: "aula" })).toBe(true);
    expect(eventoAvanca(diagrama, EVT_ABRIR_DOC, { studioKind: "quiz" })).toBe(false);
    expect(eventoAvanca(diagrama, EVT_ABRIR_DOC, null)).toBe(false);
    expect(diagrama.jaFiz).toBe(true);
  });
  it("todo passo de ação tem a tarefa escrita (\"Sua vez\")", () => {
    for (const p of PASSOS_SALA.filter((x) => x.avancaEm?.length)) expect(p.suaVez, p.id).toBeTruthy();
  });
  it("o percurso diz gerando… e depois pronto", () => {
    expect(tarefaDoPercurso("gerando", "x")).toMatch(/Gerando/);
    expect(tarefaDoPercurso("ativa", "x")).toMatch(/Pronto/);
    expect(tarefaDoPercurso("oculta", "x")).toBe("x");   // #626: "sugerida" agora diz o nome do botão
    expect(tarefaDoPercurso(null, "x")).toBe("x");
  });
});

describe("#618 · um caminho só no passo 1", () => {
  it("o passo 1 destaca o campo do chat (não o botão \"Quero estudar sobre…\") e os passos de escrever são noChat", () => {
    const p1 = PASSOS_SALA.find((p) => p.id === "iniciar-estudo")!;
    expect(p1.alvos).toEqual(['[data-tour="composer-estudos"]']);
    expect(PASSOS_SALA.filter((p) => p.noChat).map((p) => p.id)).toEqual(["iniciar-estudo", "criar-diagrama"]);
  });
});

describe("#626 · o passo do diagrama acompanha o pedido", async () => {
  const { proximoPedido } = await import("./tourSala");
  it("enviado → desenhando; fim sem desenho → semDesenho; falhou → semDesenho; pedir de novo → enviado", () => {
    expect(proximoPedido(null, { tipo: "pergunta" })).toBe("enviado");
    expect(proximoPedido("enviado", { tipo: "desenho", fase: "comecou", kind: "diagram" })).toBe("desenhando");
    expect(proximoPedido("enviado", { tipo: "fim" })).toBe("semDesenho");
    expect(proximoPedido("desenhando", { tipo: "fim" })).toBe("desenhando");    // o desenho segue depois da resposta
    expect(proximoPedido("desenhando", { tipo: "desenho", fase: "falhou", kind: "diagram" })).toBe("semDesenho");
    expect(proximoPedido("semDesenho", { tipo: "pergunta" })).toBe("enviado");
    expect(proximoPedido("semDesenho", { tipo: "desenho", fase: "comecou", kind: "aula" })).toBe("desenhando");
  });
  it("desenho que não é visual (podcast) não muda nada", () => {
    expect(proximoPedido("enviado", { tipo: "desenho", fase: "comecou", kind: "podcast" })).toBe("enviado");
  });
});

describe("#626 · o percurso com os nomes do botão", async () => {
  const { tarefaDoPercurso, avisarEstadoPercurso, estadoPercursoAtual } = await import("./tourSala");
  it("cada estado com o que está escrito no botão (sem o ✦, que não existe na tela)", () => {
    expect(tarefaDoPercurso("sugerida", "x")).toMatch(/“Gerar mapa”/);
    expect(tarefaDoPercurso("vazia", "x")).toMatch(/“Traçar percurso”/);
    expect(tarefaDoPercurso("gerando", "x")).toMatch(/Gerando o mapa/);
    expect(tarefaDoPercurso("ativa", "x")).toMatch(/“Ver mapa”/);
    for (const p of PASSOS_SALA) expect(`${p.dica} ${p.fala} ${p.suaVez ?? ""}`).not.toMatch(/✦/);
  });
  it("o último estado fica guardado (o tour que começa depois do chat não perde o \"Ver mapa\")", () => {
    avisarEstadoPercurso("ativa");
    expect(estadoPercursoAtual()).toBe("ativa");
  });
});
