/**
 * BLUEPRINT PRÁTICO — o ESTADO de cada peça da figura do tema (PURO). O desenho em si é a máquina do anatomy
 * (lib/blueprint/maquina); aqui fica só a regra de quando a peça acende: verde = provada, vermelha = travada por um
 * crítico aberto da fase atual, apagada = ainda não construída.
 */
import type { DocBlueprint, Peca } from "./tipos";

export type EstadoPeca = "ok" | "trava" | "futuro";

export function estadoPeca(doc: DocBlueprint, p: Peca): EstadoPeca {
  const dela = doc.criticos.filter((c) => c.pecaId === p.id);
  if (dela.some((c) => c.status === "aberto" && c.fase === doc.fase)) return "trava";
  if (p.fase < doc.fase || (doc.aguardandoMentor && p.fase <= doc.fase) || dela.some((c) => c.status === "provado")) return "ok";
  return "futuro";
}
