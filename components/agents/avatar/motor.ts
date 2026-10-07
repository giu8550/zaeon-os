/**
 * Qual motor anima o avatar vivo. NEXT_PUBLIC_AVATAR_ENGINE:
 *   (vazio) / "live2d" — Live2D (pixi-live2d-display + Cubism Core) pra agente cujo manifesto tem
 *                        `live2d.model` PRÓPRIO; sem modelo, no celular ou se falhar → sprite.
 *                        Licença Cubism: o dono confirmou que está coberta (out/2026).
 *   "sprite"           — força o motor de sprites pra todo mundo (quadros WebP + timers, MIT puro).
 */
import type { MotorAvatar } from "@/lib/avatars/estados";

export const motorAvatar = (): MotorAvatar => (process.env.NEXT_PUBLIC_AVATAR_ENGINE === "sprite" ? "sprite" : "live2d");
