/**
 * Frota de IAs — as ÁREAS DO MAPA (PURO) pros contadores do modo admin: bots × usuários reais em cada lugar. Uma posição
 * (mundo) vira uma área pelo chão em que está (x, z): a Zaeon central, cada sala (com o estacionamento dela), cada lugar
 * flutuante (com o estacionamento), a praça; quem está em trânsito (moto, mochila, nave) conta como "no céu".
 */
import { CIDADE, salaEm } from "../ceu";
import { PLATAFORMAS, IDS_PLATAFORMAS, type IdPlataforma } from "../plataformas";
import { PRACA } from "../praca";
import { ESTACIONAMENTOS, AMBIENTES_COM_VAGA } from "../estacionamentosEstudo";
import { tamanhoDoLote } from "../motos";

export const AREAS = [
  { id: "zaeon", nome: "Zaeon · central" },
  { id: "lounge", nome: "Zaeon · lounge" },
  { id: "biblioteca", nome: "Zaeon · biblioteca" },
  { id: "jardim", nome: "Zaeon · jardim" },
  { id: "garagem", nome: "Zaeon · garagem" },
  { id: "univ", nome: "UNILAB" },
  { id: "ufc", nome: "UFC" },
  { id: "unifor", nome: "Unifor" },
  { id: "uece", nome: "UECE" },
  { id: "solana", nome: "Solana House" },
  { id: "praca", nome: "Praça" },
  { id: "ceu", nome: "No céu / em trânsito" },
] as const;
export type AreaId = (typeof AREAS)[number]["id"];
export const contagemVazia = (): Record<AreaId, number> => Object.fromEntries(AREAS.map((a) => [a.id, 0])) as Record<AreaId, number>;

/** a área de uma posição do mundo (só o chão: x, z). `transito` = em moto/mochila/nave → "no céu" */
export function areaDe(p: { x: number; z: number }, transito = false): AreaId {
  if (transito) return "ceu";
  const l = { x: p.x - CIDADE.centro.x, z: p.z - CIDADE.centro.z };
  const sala = salaEm(l, 2, true); if (sala) return sala;   // (o mapa inteiro: não depende do nível de quem olha)
  for (const amb of AMBIENTES_COM_VAGA) {   // o estacionamento conta como o lugar dele
    const e = ESTACIONAMENTOS[amb]; if (Math.hypot(p.x - e.x, p.z - e.z) <= tamanhoDoLote(e).r + 3) return amb;
  }
  if (Math.hypot(l.x, l.z) <= CIDADE.bordaR + 4) return "zaeon";
  for (const id of IDS_PLATAFORMAS) { const P = PLATAFORMAS[id as IdPlataforma]; if (Math.hypot(p.x - P.centro.x, p.z - P.centro.z) <= P.r + 6) return id as AreaId; }
  if (Math.hypot(p.x - PRACA.x, p.z - PRACA.z) <= PRACA.r + 30) return "praca";
  return "ceu";
}
