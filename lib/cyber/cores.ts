/**
 * Cores dos seres de luz do cyberespaço — PURO. Todo mundo é um ser de LUZ (aura clara); o que muda é a cor da
 * ARMADURA. Cada pessoa tem UMA cor REAL (lib/lounge3d/tipos `corDoUsuario`, determinística pelo id): ela se vê com
 * essa cor e todo mundo a vê com a mesma (antes: "a minha é sempre azul" e a dos outros pela ordem da sala — cada
 * observador via uma cor diferente pra mesma pessoa). Quando a skin virar cosmético escolhido no Perfil, a escolha
 * entra em `corDaArmadura`.
 */
import { corDoUsuario } from "@/lib/lounge3d/tipos";

/** a cor de quem ainda não tem id (visitante, prévia sem login) */
export const ARMADURA_EU = "#2f7bff";
export const COR_LUZ = "#bfeaff";   // aura/viseira/neurônios: a "luz" é comum a todos

/** a cor REAL da armadura de alguém — a mesma pra ele e pra todos os observadores */
export const corDaArmadura = (id: string | null | undefined): string => (id ? corDoUsuario(id) : ARMADURA_EU);
/** a cor com que EU me vejo (no cyberespaço e na vitrine do Perfil) = a minha cor real */
export const minhaArmadura = (id?: string | null): string => corDaArmadura(id);
