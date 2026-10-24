/** um canvas 2D que funciona na página E num Web Worker (lá não há `document`: usa OffscreenCanvas) — as texturas
 *  desenhadas à mão do 3D (holograma, brilhos, recolorir) passam por aqui pra cena poder rodar fora da thread principal */
export type Canvas2D = HTMLCanvasElement | OffscreenCanvas;
export function novoCanvas(w: number, h: number): Canvas2D {
  if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
export const ctx2d = (c: Canvas2D, o?: CanvasRenderingContext2DSettings) => c.getContext("2d", o) as CanvasRenderingContext2D;
