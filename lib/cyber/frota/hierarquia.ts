/**
 * Frota de IAs — a HIERARQUIA DA CIDADELA (PURO, determinística). Do lote inicial da frota saem (o pedido do dono,
 * out/2026): 9 PROFESSORES e 9 DOUTORES (18 doutores), 34 MESTRANDOS e 75 GRADUANDOS, cada um com a sua CREDENCIAL
 * FICTÍCIA (lib/cyber/credenciais) e um lugar fixo na cidadela (a cabine da fileira dele; o graduando, uma roda no chão
 * com o seu GRUPO DE ESTUDOS — os amigos dele — em volta de uma supertree ou atrás das cabines).
 *  - Quem SÓ fica logado no laboratório (70% dos doutores, 30% dos mestrandos e dos graduandos) aparece na cabine em
 *    status "estudando" o dia inteiro em que está online e nunca sai — tem gente que nunca entra no cyberespaço;
 *  - quem tem ROTINA estuda no seu lugar da cidadela na maior parte dos blocos (às vezes em outra área), e nos
 *    intervalos passeia — mais a pé pelo pátio e pelo centro da cidadela do que o resto da frota.
 * O resto da frota continua como sempre (transita igualmente entre as áreas).
 */
import { acasoDe, hash } from "./aleatorio";
import { LOTE_INICIAL, type AgenteIA } from "./frota";
import type { Bloco } from "./agenda";
import type { Spot } from "./lugares";
import { MODELOS_CREDENCIAL, credencialFicticia, podeFicarNaCidadela, type CredencialAcademica, type GrupoDeEstudos, type NivelCidadela } from "../credenciais";
import { assentoDaCabine, rodasDeEstudo } from "../cidadela";
import { cabinesDaCidadela } from "../ceu";

export type MembroCidadela = {
  agente: AgenteIA; credencial: CredencialAcademica;
  /** tem rotina fora do lugar (sai, passeia, vai pras outras áreas)? (não = só logado no laboratório) */
  rotina: boolean;
  /** o lugar fixo dela na cidadela */
  lugar: Spot;
};

/** os temas dos grupos de estudos (o nome do grupo é de uma cientista/um cientista) */
const NOMES_GRUPO = ["Hipátia", "Noether", "Turing", "Curie", "Lovelace", "Darwin", "Franklin", "Gauss", "Euler", "Mendel", "Tesla", "Carver", "Chagas", "Zilda Arns", "Cruz", "Lattes", "Pasteur", "Ramanujan", "Mayana", "Nise"] as const;

const cache = new WeakMap<readonly AgenteIA[], Map<string, MembroCidadela>>();
/** quem é quem na cidadela (id do agente → membro). Só o LOTE INICIAL entra (a hierarquia não muda quando o painel
 *  cria mais agentes) */
export function hierarquiaDaCidadela(frota: readonly AgenteIA[]): Map<string, MembroCidadela> {
  const salvo = cache.get(frota); if (salvo) return salvo;
  const out = new Map<string, MembroCidadela>(), base = frota.filter((a) => a.id.startsWith(`ia-${LOTE_INICIAL.semente}-`));
  const M = MODELOS_CREDENCIAL, rodas = rodasDeEstudo(), cabines = cabinesDaCidadela();
  // os GRADUANDOS: grupos de amigos INTEIROS (o grupo de estudos deles), sorteados, até completar as vagas
  const grupos = new Map<number, AgenteIA[]>(); for (const a of base) (grupos.get(a.grupo) ?? grupos.set(a.grupo, []).get(a.grupo)!).push(a);
  const ordemGrupos = [...grupos.entries()].filter(([, ms]) => ms.length >= 2).sort((x, y) => hash("cidadela-ge", x[0]) - hash("cidadela-ge", y[0]));
  const ordemRodas = [...rodas].sort((x, y) => hash("cidadela-roda", x.id) - hash("cidadela-roda", y.id));
  const graduandos: { a: AgenteIA; grupo: GrupoDeEstudos; lugar: Spot }[] = [];
  let iRoda = 0;
  for (const [g, ms] of ordemGrupos) {
    const falta = M.graduando.vagas - graduandos.length, roda = ordemRodas[iRoda++];
    if (falta <= 0 || !roda) break;
    const membros = ms.slice(0, Math.min(ms.length, falta, roda.lugares.length)); if (membros.length < 2) break;
    const ge: GrupoDeEstudos = { id: `GE-${String(g).padStart(3, "0")}`, nome: `GE ${NOMES_GRUPO[hash("ge-nome", g) % NOMES_GRUPO.length]}`, tema: membros[0]!.curso, membros: membros.length };
    membros.forEach((a, k) => graduandos.push({ a, grupo: ge, lugar: roda.lugares[k]! }));
  }
  const ehGraduando = new Set(graduandos.map((x) => x.a.id)), resto = base.filter((a) => !ehGraduando.has(a.id));
  // os DOUTORES: os de mais foco (professores primeiro); os MESTRANDOS: sorteados entre os que sobraram
  const porFoco = [...resto].sort((x, y) => y.ritmo.foco - x.ritmo.foco || hash("cidadela-dr", x.id) - hash("cidadela-dr", y.id));
  const professores = porFoco.slice(0, M.professor.vagas), doutores = porFoco.slice(M.professor.vagas, M.professor.vagas + M.doutor.vagas);
  const jaTem = new Set([...professores, ...doutores].map((a) => a.id));
  const mestrandos = resto.filter((a) => !jaTem.has(a.id)).sort((x, y) => hash("cidadela-mes", x.id) - hash("cidadela-mes", y.id)).slice(0, M.mestrando.vagas);
  // quem tem ROTINA: cota exata por degrau (os doutores contam juntos: 30% de 18), sorteada
  const comRotina = (lista: AgenteIA[], frac: number) => new Set([...lista].sort((x, y) => hash("cidadela-rotina", x.id) - hash("cidadela-rotina", y.id)).slice(0, Math.round(lista.length * frac)).map((a) => a.id));
  const rotDr = comRotina([...professores, ...doutores], M.professor.rotina), rotMes = comRotina(mestrandos, M.mestrando.rotina), rotGra = comRotina(graduandos.map((x) => x.a), M.graduando.rotina);
  const comCabine = (lista: AgenteIA[], nivel: Exclude<NivelCidadela, "graduando">, rot: Set<string>) => {
    const minhas = cabines.filter((c) => c.nivel === nivel);
    lista.forEach((a, k) => { const c = minhas[k]; if (!c) return;
      out.set(a.id, { agente: a, rotina: rot.has(a.id), lugar: assentoDaCabine(c), credencial: credencialFicticia({ dono: a.id, nivel, genero: a.genero, area: a.curso, seq: k, sorteio: hash("credencial", a.id) }) }); });
  };
  comCabine(professores, "professor", rotDr); comCabine(doutores, "doutor", rotDr); comCabine(mestrandos, "mestrando", rotMes);
  graduandos.forEach(({ a, grupo, lugar }, k) => {
    const credencial = credencialFicticia({ dono: a.id, nivel: "graduando", genero: a.genero, area: a.curso, seq: k, sorteio: hash("credencial", a.id), grupo });
    if (podeFicarNaCidadela(credencial)) out.set(a.id, { agente: a, rotina: rotGra.has(a.id), lugar, credencial });   // (sem grupo de estudos comprovado, não fica)
  });
  cache.set(frota, out);
  return out;
}

/** a fração dos blocos de estudo de quem tem rotina que acontece no lugar dela na cidadela (o resto: noutra área) */
export const ESTUDO_NA_CIDADELA = 0.75;
/** a chance de um intervalo de moto (que não seja corrida) virar passeio a pé pelo pátio/centro da cidadela */
export const PASSEIO_NA_CIDADELA = 0.4;

/** a agenda do dia de um membro da cidadela, a partir da agenda normal dele: quem só fica logado no laboratório vira UM
 *  bloco de estudo no lugar dele do começo ao fim do dia online (sem festa, sem corrida, sem passeio); quem tem rotina
 *  estuda na cidadela na maior parte dos blocos e troca parte das motos por passeios a pé na Zaeon */
export function agendaDaCidadela(m: MembroCidadela, blocos: readonly Bloco[], dia: number): Bloco[] {
  if (!blocos.length) return [];
  if (!m.rotina) {
    const ini = Math.min(...blocos.map((b) => b.ini)), fim = Math.max(...blocos.map((b) => b.fim));
    return [{ ini, fim, atividade: "estudo-plataforma", ambiente: "cidadela" }];
  }
  const r = acasoDe("cidadela-agenda", m.agente.id, dia);
  return blocos.map((b) => {
    if (b.atividade === "estudo-plataforma" || b.atividade === "estudo-lounge") return r() < ESTUDO_NA_CIDADELA ? { ini: b.ini, fim: b.fim, atividade: "estudo-plataforma", ambiente: "cidadela" } : { ...b };
    if (b.atividade === "moto" && !b.evento && r() < PASSEIO_NA_CIDADELA) return { ini: b.ini, fim: b.fim, atividade: "andar", turma: `${m.agente.grupo}|${dia}` };
    return { ...b };
  });
}
