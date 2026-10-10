/**
 * Frota de IAs — o PLANO DO DIA da frota inteira (PURO, determinístico): a agenda de cada grupo (lib/cyber/frota/agenda)
 * + o LUGAR de cada bloco de estudo/festa, sem duas IAs no mesmo assento ao mesmo tempo. Os amigos sentam PERTO quando
 * estão no mesmo ambiente na mesma hora (é aí que conversam). No sofá, às vezes uma deita (ocupa o sofá todo).
 * Cada bloco num lugar com ESTACIONAMENTO ganha uma VAGA (a fila da frente enche primeiro; no máximo 33 por lugar) —
 * lotou, chega sem moto parada (lib/cyber/estacionamentosEstudo).
 * Custo: uma vez por dia por cliente (~ms) — o mesmo resultado em todo cliente (mesma frota, mesmo dia, mesmas flags).
 */
import { acasoDe, hash } from "./aleatorio";
import { AMBIENTES_ESTUDO, AREAS_PADRAO, agendaDoGrupo, type AreasFrota, type Bloco, type FlagsFrota } from "./agenda";
import type { AgenteIA } from "./frota";
import { spotsDe, type Spot } from "./lugares";
import { VAGAS_POR_ESTACIONAMENTO, temVaga, vagaEstudo, type VagaEstudo } from "../estacionamentosEstudo";
import { agendaDaCidadela, hierarquiaDaCidadela } from "./hierarquia";

export type BlocoPlano = Bloco & { spot?: Spot; deitado?: boolean; /** a VAGA no estacionamento do lugar (chegou de moto e a moto fica lá) — lib/cyber/estacionamentosEstudo */ vaga?: VagaEstudo };
export type PlanoDia = { dia: number; agentes: Map<string, { agente: AgenteIA; blocos: BlocoPlano[] }> };

/** chance de, num sofá livre inteiro, a IA DEITAR pra estudar */
export const CHANCE_DEITAR = 0.14;

export function planejarDia(frota: readonly AgenteIA[], dia: number, flags: FlagsFrota, full = false, ar: AreasFrota = AREAS_PADRAO): PlanoDia {
  const agentes: PlanoDia["agentes"] = new Map(), grupos = new Map<number, AgenteIA[]>(), hier = hierarquiaDaCidadela(frota);
  for (const a of frota) (grupos.get(a.grupo) ?? grupos.set(a.grupo, []).get(a.grupo)!).push(a);
  for (const membros of grupos.values()) {
    const ag = agendaDoGrupo(membros, dia, flags, full, ar);
    // (quem tem credencial na CIDADELA: a agenda dela — o lugar fixo, e só 30%/70% com rotina fora)
    for (const a of membros) { const m = hier.get(a.id), bl = ag.get(a.id) ?? []; agentes.set(a.id, { agente: a, blocos: (m ? agendaDaCidadela(m, bl, dia) : bl).map((b) => ({ ...b })) }); }
  }
  // evento de GRUPO (corrida, festa) com uma pessoa só não existe: os amigos dela que só ficam logados no laboratório
  // (lib/cyber/frota/hierarquia) saíram do evento — ela também sai (fica offline nesse pedaço)
  { const n = new Map<string, number>(); for (const { blocos } of agentes.values()) for (const b of blocos) if (b.evento) n.set(b.evento, (n.get(b.evento) ?? 0) + 1);
    for (const v of agentes.values()) v.blocos = v.blocos.filter((b) => !b.evento || (n.get(b.evento) ?? 0) >= 2); }
  // os blocos que precisam de LUGAR, na ordem do relógio (o "mais cedo pega primeiro" — o mesmo em todo cliente)
  const fila: { a: AgenteIA; b: BlocoPlano }[] = [];
  for (const { agente, blocos } of agentes.values()) for (const b of blocos) if (b.atividade === "estudo-plataforma" || b.atividade === "estudo-lounge" || b.atividade === "festa") fila.push({ a: agente, b });
  fila.sort((x, y) => x.b.ini - y.b.ini || (x.a.id < y.a.id ? -1 : 1));
  /** até quando cada spot está ocupado (a fila anda em ordem de início: livre = acabou antes de começar) */
  const ocupadoAte = new Map<string, number>();
  // o lounge: os assentos + no máximo `loungeChao` lugares no chão (o painel admin); as vagas: no máximo `vagas` por lugar
  let nChao = 0; const loungeLimitado = spotsDe("lounge").filter((s) => s.tipo !== "piso" || nChao++ < ar.loungeChao);
  const nVagas = Math.max(0, Math.min(VAGAS_POR_ESTACIONAMENTO, Math.floor(ar.vagas)));
  const livre = (s: Spot, ini: number) => (ocupadoAte.get(s.id) ?? -1) <= ini;
  /** onde cada agente está sentado agora (pra os amigos sentarem perto) */
  const ondeEsta = new Map<string, { spot: Spot; fim: number; ambiente: string }>();
  for (const { a, b } of fila) {
    // a CIDADELA: o lugar é FIXO e só dela (a cabine, ou a roda do grupo de estudos) — ninguém mais senta ali
    if (b.ambiente === "cidadela") { const m = hier.get(a.id); if (m) { b.spot = m.lugar; ondeEsta.set(a.id, { spot: m.lugar, fim: b.fim, ambiente: "cidadela" }); } continue; }
    const amb: string = b.atividade === "festa" ? "pista" : b.ambiente!, todos = amb === "lounge" ? loungeLimitado : spotsDe(amb as "pista");
    if (!todos.length) continue;
    // um amigo já no mesmo ambiente, na mesma hora? os spots perto dele vêm primeiro
    let ancora: Spot | null = null;
    for (const [id, e] of ondeEsta) if (e.ambiente === amb && e.fim > b.ini && agentes.get(id)?.agente.grupo === a.grupo) { ancora = e.spot; break; }
    const giro = hash(a.id, b.ini) % todos.length, r = acasoDe("lugar", a.id, b.ini);
    let escolhido: Spot | null = null;
    if (ancora) {
      let md = 7;
      for (const s of todos) { const d = Math.hypot(s.x - ancora.x, s.z - ancora.z); if (d < md && livre(s, b.ini)) { md = d; escolhido = s; } }
    }
    if (!escolhido) for (let k = 0; k < todos.length; k++) { const s = todos[(giro + k) % todos.length]!; if (livre(s, b.ini)) { escolhido = s; break; } }
    if (!escolhido && b.atividade !== "festa") {   // lotou: vai estudar noutro ambiente de estudo (o primeiro com lugar)
      for (const outro of AMBIENTES_ESTUDO) {
        if (outro === amb || !(ar.pesos[outro] > 0)) continue;   // (um lugar com peso 0 no painel não recebe ninguém)
        const l = spotsDe(outro), g2 = hash(a.id, b.ini, outro) % l.length;
        for (let k = 0; k < l.length && !escolhido; k++) { const s = l[(g2 + k) % l.length]!; if (livre(s, b.ini)) escolhido = s; }
        if (escolhido) { b.ambiente = outro; b.atividade = "estudo-plataforma"; break; }
      }
    }
    if (!escolhido) continue;   // lotou TUDO: o bloco fica sem lugar
    b.spot = escolhido; ocupadoAte.set(escolhido.id, b.fim);
    // deitar no sofá: só com o sofá todo livre
    if (escolhido.tipo === "sofa" && b.atividade !== "festa" && escolhido.par && r() < CHANCE_DEITAR) {
      const par = todos.find((s) => s.id === escolhido!.par);
      if (par && livre(par, b.ini)) { ocupadoAte.set(par.id, b.fim); b.deitado = true; }
    }
    ondeEsta.set(a.id, { spot: escolhido, fim: b.fim, ambiente: amb });
    // a VAGA da moto no estacionamento do lugar (ocupada até pouco depois do fim: a saída é no começo do próximo bloco)
    const lugar = b.atividade === "festa" ? "lounge" : b.ambiente;
    if (temVaga(lugar)) for (let k = 0; k < nVagas; k++) {
      const id = `vaga:${lugar}:${k}`;
      if ((ocupadoAte.get(id) ?? -1) <= b.ini) { b.vaga = vagaEstudo(lugar, k); ocupadoAte.set(id, b.fim + 3); break; }
    }
  }
  return { dia, agentes };
}
