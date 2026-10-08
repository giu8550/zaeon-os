"use client";
/**
 * TelaCarregando — o loading do cyberespaço: o cérebro azul surgindo e a barra clássica (components/ui/CerebroCarregando),
 * sem texto. A barra segue o progresso REAL das etapas do engine (lib/cyber/carregamento); fica por cima até o mundo
 * inteiro estar pronto e sai com um fade.
 */
import CerebroCarregando from "@/components/ui/CerebroCarregando";
import type { Carregando } from "@/lib/cyber/carregamento";

export default function TelaCarregando({ carga, saindo = false }: { carga: Carregando | null; saindo?: boolean }) {
  return <CerebroCarregando progresso={carga?.progresso ?? 0} saindo={saindo} />;
}
