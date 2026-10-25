/**
 * #613 · REVER os tutoriais do laboratório sem console: o botão nas Configurações esquece que a pessoa já viu os
 * tours da Sala de Estudos e do Escritório. O da sala recomeça na hora (se o laboratório está aberto); o do
 * Escritório, na próxima vez que a aba dele abrir. O "Modo tutorial" (cyberespaço) não muda.
 */
import { esquecerTourSala } from "@/lib/onboarding/tourSala";
import { esquecerTourEscritorio } from "@/lib/onboarding/tourEscritorio";
import { novaGeracaoDosTours } from "@/lib/onboarding/geracaoTour";
import { esquecerDicas } from "@/lib/onboarding/dicas";

export const EVT_REVER_TOURS = "zaeon:tour:rever";

export function reverToursDoLab(): void {
  // um tour aberto noutra aba, ao terminar, não desfaz este pedido (lib/onboarding/geracaoTour)
  novaGeracaoDosTours();
  esquecerTourSala();
  esquecerTourEscritorio();
  esquecerDicas();   // #618: as dicas rápidas (Perfil) também
  try { window.dispatchEvent(new Event(EVT_REVER_TOURS)); } catch { /* sem janela */ }
}
