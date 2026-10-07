/**
 * lib/avatars/vida.ts — o ORÇAMENTO DE VIDA dos avatares (módulo PURO, sem DOM).
 *
 * Regra do handoff: no máximo 1–2 avatares animando ao mesmo tempo na viewport; os outros ficam
 * no quadro estático e "ganham vida" no hover/seleção. Cada avatar visível PEDE uma vaga com uma
 * prioridade; as `max` maiores (empate → quem pediu antes) ficam vivas. Prioridade 0 = não pede.
 */

export const PRIORIDADE = {
  nenhuma: 0,
  /** visível, parado: respira + pisca */
  ambiente: 1,
  /** hover/selecionado */
  interacao: 2,
  /** o agente está pensando/falando/reagindo — nunca fica sem vida enquanto houver vaga */
  ativo: 3,
  /** o rosto DA CONVERSA reagindo (boas-vindas / resposta mais recente): ganha de qualquer outro */
  protagonista: 4,
} as const;

export type Orcamento = {
  pedir(id: string, prioridade: number, aoMudar: (vivo: boolean) => void): void;
  soltar(id: string): void;
  vivos(): string[];
  setMax(n: number): void;
};

export function criarOrcamento(maxInicial = 2): Orcamento {
  let max = maxInicial;
  let seq = 0;
  const pedidos = new Map<string, { prioridade: number; ordem: number; aoMudar: (vivo: boolean) => void; vivo: boolean }>();

  const recalcular = () => {
    const ranking = [...pedidos.entries()]
      .filter(([, p]) => p.prioridade > 0)
      .sort(([, a], [, b]) => b.prioridade - a.prioridade || a.ordem - b.ordem)
      .slice(0, max)
      .map(([id]) => id);
    const vencedores = new Set(ranking);
    for (const [id, p] of pedidos) {
      const vivo = vencedores.has(id);
      if (vivo !== p.vivo) { p.vivo = vivo; p.aoMudar(vivo); }
    }
  };

  return {
    pedir(id, prioridade, aoMudar) {
      const atual = pedidos.get(id);
      // subir de prioridade não "fura a fila" por ordem de chegada, mas mantém a antiguidade
      pedidos.set(id, { prioridade, ordem: atual?.ordem ?? seq++, aoMudar, vivo: atual?.vivo ?? false });
      recalcular();
    },
    soltar(id) {
      const p = pedidos.get(id);
      if (!p) return;
      pedidos.delete(id);
      if (p.vivo) p.aoMudar(false);
      recalcular();
    },
    vivos: () => [...pedidos.entries()].filter(([, p]) => p.vivo).map(([id]) => id),
    setMax(n) { max = Math.max(0, n); recalcular(); },
  };
}
