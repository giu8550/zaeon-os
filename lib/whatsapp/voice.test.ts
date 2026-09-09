import { describe, it, expect } from "vitest";
import { inMentorVoice, plainVoice } from "./voice";

describe("whatsapp · voice (voz do mentor)", () => {
  it("usa o JSON do modelo quando vem texto", async () => {
    const genJson = async () => ({ text: "  Bom dia! Hoje: Cálculo às 8h. *Bora?*  " }) as any;
    const t = await inMentorVoice({ kind: "agenda", facts: "Agenda: Cálculo 8h.", mentorName: "Noether", genJson });
    expect(t).toBe("Bom dia! Hoje: Cálculo às 8h. *Bora?*");
  });
  it("modelo falha ou devolve vazio → fallback determinístico com os fatos", async () => {
    const boom = async () => { throw new Error("rede"); };
    const t = await inMentorVoice({ kind: "deadline", facts: 'Prazo chegando: "Relatório" vence amanhã.', mentorName: "Osler", genJson: boom as any });
    expect(t).toBe('Osler aqui. Prazo chegando: "Relatório" vence amanhã. Quer que eu te ajude a organizar?');
    const empty = async () => ({}) as any;
    expect(await inMentorVoice({ kind: "welcome", facts: "", genJson: empty })).toBe(plainVoice("welcome", ""));
  });
  it("review: fallback remove a instrução interna e convida ao recall", () => {
    const t = plainVoice("review", "Revisão espaçada de hoje: Fotossíntese (há 3 dias). Proponha UMA pergunta rápida de recall sobre o primeiro item.");
    expect(t).toBe("Revisão espaçada de hoje: Fotossíntese (há 3 dias). Topa um recall rápido? Me conta o que você lembra.");
  });
});
