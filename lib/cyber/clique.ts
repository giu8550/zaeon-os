/** Regras do clique/hover no cyberespaço (HANDOFF §2.3). PURO. */
export type AlvoClique = "monitor" | "aproximar" | "colega" | "landmark" | "aproximar-landmark" | "chao";

/**
 * Prioridade: monitor (em hover e perto, e só o MEU — a base é privada) → colega perto → ponto de interesse → chão.
 * Clicar no monitor de longe (ou no de outra pessoa) não entra: no meu, leva até a base; no alheio, vira chão.
 */
export function decidirClique(o: { noMonitor: boolean; baseMinha: boolean; pertoDaBase: boolean; noColega: boolean; colegaPerto: boolean; noLandmark?: boolean; landmarkPerto?: boolean }): AlvoClique {
  if (o.noMonitor && o.baseMinha) return o.pertoDaBase ? "monitor" : "aproximar";
  if (o.noColega && o.colegaPerto) return "colega";
  // ponto de interesse (ex.: Zaeon): perto (< interactR) abre o painel; de longe só leva até a borda
  if (o.noLandmark) return o.landmarkPerto ? "landmark" : "aproximar-landmark";
  return "chao";
}

/** Rótulo flutuante sobre o monitor em hover. */
export function rotuloMonitor(o: { baseMinha: boolean; pertoDaBase: boolean; dono: string }): string {
  if (!o.baseMinha) return `Base de ${o.dono} · privada`;
  return o.pertoDaBase ? "⏎ Entrar na Sala de Estudos" : "Chegue perto para entrar";
}
