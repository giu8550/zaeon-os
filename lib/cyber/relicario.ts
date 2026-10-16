/**
 * O RELICÁRIO DO SABER (PURO, sem three) — out/2026, pedido do dono: na Sala do Saber (a biblioteca), uma CABINE de
 * metal negro com CRISTAIS dentro, levitando um LIVRO DOURADO (components/cyber/Relicario). É onde se ENTREGA o que tem
 * valor: F (ou clique) abre o inventário com ▶ nos itens que CABEM (estudos e pesquisas — artigos são pesquisas); o
 * item voa da pessoa pro Relicário, o HOLOGRAMA da Zaeon lê o trabalho (todo mundo na sala vê — EV_RELICARIO) e o
 * veredito sai quando a leitura acaba: pesquisa = completa e em ABNT (lib/cyber/entregaAbnt); estudo = VENDÁVEL no
 * blueprint (lib/estudos/blueprint). Aceita = RECOMPENSA (a 1ª: as motos).
 */
import type { P2 } from "./colisao";
import { CIDADE, RELICARIO_SALA, daSala, mundo, rotDaSala } from "./ceu";

/** os tempos da cena (s): o item VOANDO até o Relicário, a LEITURA da Zaeon e o VEREDITO (o brilho/sinal) */
export const RITMO_RELICARIO = { voo: 1.6, leitura: 7.5, veredito: 4.5 } as const;
export const DURACAO_RELICARIO = RITMO_RELICARIO.voo + RITMO_RELICARIO.leitura + RITMO_RELICARIO.veredito;
/** até onde vale o F (m, do centro) — a cabine tem ~3,4 m de raio */
export const ALCANCE_RELICARIO = 7.5;

/** o Relicário no local da ILHA (o centro) e pra onde a frente dele aponta (rumo ao centro da ilha / à porta da sala) */
export function relicarioLocal(): P2 & { rumo: number } {
  const s = CIDADE.salas.biblioteca, p = daSala(s, RELICARIO_SALA.x, RELICARIO_SALA.z);
  return { ...p, rumo: rotDaSala(s) };
}
export const relicarioMundo = (): P2 => mundo(relicarioLocal());

/** o que CABE no Relicário: os livros de ESTUDO e as PESQUISAS (artigos/TCCs inclusos) — as armas não */
export type TipoEncaixe = "pesquisa" | "livro";
export const encaixaNoRelicario = (tipo: string): tipo is TipoEncaixe => tipo === "pesquisa" || tipo === "livro";
/** o que vai pro servidor: o tipo e o id (a pesquisa = ResearchWork; o estudo = "boardId:cardId") */
export type ItemEncaixe = { tipo: TipoEncaixe; id: string; titulo: string };
const OID = /^[a-f0-9]{24}$/i;
export const idDeEncaixeValido = (it: { tipo: string; id: string }) =>
  it.tipo === "pesquisa" ? OID.test(it.id) : it.tipo === "livro" ? /^[a-f0-9]{24}:[\w-]{1,64}$/i.test(it.id) : false;

/** a ENTREGA como evento da sala (todos veem a mesma cena): quem, o quê, o veredito e o instante (relógio do servidor) */
export type EventoRelicario = { id: string; userId: string; nome: string; cor: string; titulo: string; tipo: TipoEncaixe; aceito: boolean; agora: number };
export function sanitizarEventoRelicario(raw: unknown): EventoRelicario | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>, str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
  const id = str(r.id, 64), userId = str(r.userId, 64), tipo = r.tipo === "livro" ? "livro" : r.tipo === "pesquisa" ? "pesquisa" : null;
  const agora = Number(r.agora);
  if (!id || !userId || !tipo || !Number.isFinite(agora)) return null;
  const cor = /^#[0-9a-f]{6}$/i.test(String(r.cor)) ? String(r.cor) : "#7fe8ff";
  return { id, userId, nome: str(r.nome, 60) || "Alguém", cor, titulo: str(r.titulo, 120) || "Sem título", tipo, aceito: r.aceito === true, agora };
}

/** a fase da cena `s` segundos depois do começo */
export type FaseRelicario = "voando" | "lendo" | "veredito" | "fim";
export function faseDoRelicario(s: number): FaseRelicario {
  const R = RITMO_RELICARIO;
  if (s < R.voo) return "voando";
  if (s < R.voo + R.leitura) return "lendo";
  if (s < DURACAO_RELICARIO) return "veredito";
  return "fim";
}
/** um evento ainda vale a cena? (quem entra depois não vê uma entrega que já acabou) */
export const eventoVivo = (ev: { agora: number }, agoraMs: number) => agoraMs - ev.agora < DURACAO_RELICARIO * 1000;

/** o veredito de um ESTUDO (o livro do board): tem valor quando o blueprint diz VENDÁVEL */
export function avaliarEstudo(it: { vendavel: boolean; nivel: number; fontes: number; componentes: number }): { aceito: boolean; faltando: string[] } {
  if (it.vendavel) return { aceito: true, faltando: [] };
  const faltando: string[] = [];
  if (it.nivel < 50) faltando.push(`aprofundar o estudo (nível ${it.nivel} de 50)`);
  if (it.fontes < 1) faltando.push("fontes confirmadas na literatura");
  if (it.componentes < 1) faltando.push("o produto final no blueprint");
  if (!faltando.length) faltando.push("os selos do blueprint (links checados e código ou supervisão)");
  return { aceito: false, faltando };
}
