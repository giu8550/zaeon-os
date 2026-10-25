import { describe, it, expect } from "vitest";
import { PASSOS_SALA, EVT_PERGUNTA_CHAT, EVT_PERCURSO_ABERTO, deveMostrarTourSala, eventoAvanca, passosDaSala } from "./tourSala";
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
    expect(eventoAvanca(diagrama!, EVT_ABRIR_DOC, { studioKind: "aula" })).toBe(false);   // uma aula não é o diagrama
    expect(eventoAvanca(diagrama!, EVT_PERGUNTA_CHAT, null)).toBe(false);
    expect(eventoAvanca(percurso!, EVT_PERCURSO_ABERTO, undefined)).toBe(true);
  });
  it("começa no “Quero estudar sobre…” e mostra a Sala de Estudos como o caderno vivo", () => {
    expect(PASSOS_SALA[0]!.alvos[0]).toBe('[data-tour="study-start"]');
    expect(PASSOS_SALA[1]!.fala).toMatch(/caderno vivo/);
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
