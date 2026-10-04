/**
 * Cores dos seres de luz do cyberespaço — PURO. Todo mundo é um ser de LUZ (aura clara); o que muda é a cor da
 * ARMADURA. A SUA é sempre azul (você se reconhece); as dos outros vêm de uma paleta SEM azul, atribuída pela ordem
 * canônica dos membros (igual pra todos, e cores diferentes entre si até 6 pessoas). Mais tarde isto vira
 * cosmético escolhido no perfil: é só devolver a cor escolhida em `corDaArmadura`.
 */
export const ARMADURA_EU = "#2f7bff";
export const COR_LUZ = "#bfeaff";   // aura/viseira/neurônios: a "luz" é comum a todos

/** Paleta dos outros: sem azul/ciano pra nunca confundir com você. */
export const ARMADURAS_OUTROS = ["#ff5fa8", "#ffb43b", "#3fe08a", "#b36bff", "#ff6a4d", "#e6e24a"] as const;

/** `ordem` = ids dos membros na ordem canônica (members[]). */
export function corDaArmadura(ordem: string[], id: string, euId: string): string {
  if (id === euId) return ARMADURA_EU;
  const outros = ordem.filter((x) => x !== euId);
  const i = outros.indexOf(id);
  return ARMADURAS_OUTROS[(i < 0 ? outros.length : i) % ARMADURAS_OUTROS.length]!;
}
