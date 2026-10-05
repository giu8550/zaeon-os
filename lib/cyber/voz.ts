/**
 * Cyberespaço — regras PURAS da VOZ (push-to-talk). O WebRTC fica em components/cyber/Voz.ts.
 */
/** "perfect negotiation": na colisão de ofertas, o lado EDUCADO cede. Determinístico e oposto nos dois lados. */
export const educado = (euId: string, outroId: string) => euId > outroId;

/** a tecla do push-to-talk (G), ignorando quando se está DIGITANDO (chat, recado) e a repetição do teclado */
export function ehTeclaFalar(e: { key: string; repeat?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }, digitando: boolean): boolean {
  if (digitando || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  return e.key === "g" || e.key === "G";
}
