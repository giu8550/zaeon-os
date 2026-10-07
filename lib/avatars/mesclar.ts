/** lib/avatars/mesclar.ts — junta os manifestos estáticos (Etapa A) com os do admin (Etapa B). PURO. */
import type { AvatarManifest } from "./estados";

/**
 * Banco (admin) sobrepõe os QUADROS do estático, mas o que o estúdio de imagem não mexe — a voz
 * (saudações) e o modelo Live2D — continua vindo do estático. Senão salvar um avatar no admin
 * calaria o agente.
 */
export function mesclarManifestos(estatico: Record<string, AvatarManifest>, banco: Record<string, AvatarManifest>): Record<string, AvatarManifest> {
  const out: Record<string, AvatarManifest> = { ...estatico };
  for (const [k, m] of Object.entries(banco)) {
    const base = estatico[k];
    out[k] = { ...m, voz: m.voz ?? base?.voz, live2d: m.live2d ?? base?.live2d, motor: m.live2d ?? base?.live2d ? (base?.motor ?? m.motor) : m.motor };
    if (!out[k].voz) delete out[k].voz;
    if (!out[k].live2d) delete out[k].live2d;
  }
  return out;
}
