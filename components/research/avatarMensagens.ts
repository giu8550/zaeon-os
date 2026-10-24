/** o protocolo entre o painel (thread principal) e a cena da avatar (Web Worker — components/research/avatar.worker) */
import type { PersonaId } from "@/lib/research/zaeonEventos";

export type ParaCena =
  | { tipo: "iniciar"; canvas: OffscreenCanvas; largura: number; altura: number; dpr: number; persona: PersonaId }
  | { tipo: "tamanho"; largura: number; altura: number }
  | { tipo: "visivel"; visivel: boolean }
  | { tipo: "persona"; persona: PersonaId }
  | { tipo: "sinais"; lendo: boolean; escrevendo: boolean }
  | { tipo: "reagir" }
  | { tipo: "gesto" }
  /** (dev) quanto a cena gasta por quadro */
  | { tipo: "diag" }
  | { tipo: "fim" };

export type DaCena =
  | { tipo: "estado"; estado: "carregando" | "pronto" | "erro" }
  | { tipo: "diag"; quadros: number; msPorQuadro: number; fps: number };
