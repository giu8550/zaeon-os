/**
 * lib/agents/nativos.ts — os agentes NATIVOS da casa (as personas de lib/ai/personas.ts) no formato
 * de vitrine (crachá da landing). PURO. Diferente dos mentores (plugáveis, catálogo no banco), os
 * nativos já vêm na plataforma — cada um mora na sua sala.
 */
import { PERSONAS } from "@/lib/ai/personas";
import type { Redes } from "./vitrine";

export type AgenteVitrine = {
  slug: string;
  name: string;
  course: string;
  tagline?: string | null;
  signatureArtifacts?: string[];
  emoji?: string;
  guardrail?: string | null;
  avatarUrl?: string | null;
  /** nativo = já vem na plataforma; mentor = plugável (Assistentes) */
  tipo: "nativo" | "mentor";
  order?: number;
  redes?: Redes | null;
};

/** O que GET /api/agents/public devolve por agente (publicView do roster). */
export type PerfilPublico = {
  agentKey: string; nome?: string; bio?: string; emoji?: string; avatarUrl?: string | null; ativo?: boolean;
  area?: string | null; entrega?: string[]; redes?: Redes | null; ordem?: number;
};

/** Aplica o que o Modo CEO editou (crachá) em cima do padrão do agente. Vazio = mantém o padrão. */
export function aplicarPerfil(v: AgenteVitrine, p?: PerfilPublico): AgenteVitrine {
  if (!p) return v;
  return {
    ...v,
    name: p.nome || v.name,
    course: p.area || v.course,
    tagline: p.bio || v.tagline,
    signatureArtifacts: p.entrega && p.entrega.length ? p.entrega : v.signatureArtifacts,
    emoji: p.emoji && p.emoji !== "⟁" ? p.emoji : v.emoji,
    avatarUrl: p.avatarUrl ?? v.avatarUrl,
    redes: p.redes ?? v.redes,
  };
}

/**
 * A vitrine inteira (landing e Assistentes): perfis aplicados, DESATIVADOS no Modo CEO fora
 * (o /api/agents/public só lista os ativos — se a lista veio, quem não está nela sai) e cada grupo
 * na ordem do Modo CEO. Sem perfis (rota fora/flag desligada) → todo mundo, na ordem padrão.
 */
export function montarVitrine(nativos: AgenteVitrine[], mentores: AgenteVitrine[], perfis: PerfilPublico[]): { nativos: AgenteVitrine[]; mentores: AgenteVitrine[] } {
  const porKey = new Map(perfis.map((p) => [p.agentKey, p]));
  const filtra = (l: AgenteVitrine[]) => (perfis.length ? l.filter((v) => porKey.has(v.slug)) : l);
  const ordena = (l: AgenteVitrine[]) => [...l].sort((a, b) => (porKey.get(a.slug)?.ordem ?? a.order ?? 0) - (porKey.get(b.slug)?.ordem ?? b.order ?? 0));
  const aplica = (l: AgenteVitrine[]) => ordena(filtra(l)).map((v) => aplicarPerfil(v, porKey.get(v.slug)));
  return { nativos: aplica(nativos), mentores: aplica(mentores) };
}

/** Ordem e rótulos de vitrine dos nativos (o nome/tagline vêm do roster). */
const VITRINE: { id: string; area: string; entrega: string[] }[] = [
  { id: "zaeon", area: "Anfitriã", entrega: ["te recebe", "chama o agente certo"] },
  { id: "aura", area: "Pesquisa", entrega: ["leitura de PDF", "pautas", "citações"] },
  { id: "nina", area: "Sala de Estudos", entrega: ["caderno", "resumos", "plano de estudo"] },
  { id: "caio", area: "Escrita acadêmica", entrega: ["TCC", "artigo", "ABNT"] },
  { id: "teo", area: "Código", entrega: ["Zaeon Code", "rodar e corrigir", "GitHub"] },
  { id: "zenita", area: "Agenda", entrega: ["aulas", "provas", "lembretes"] },
  { id: "core_active", area: "Sala de Aula", entrega: ["agenda da turma", "compromissos"] },
  { id: "scholar", area: "Citações", entrega: ["referências ABNT", "trechos verbatim"] },
  { id: "examiner", area: "Quiz", entrega: ["perguntas do PDF", "correção"] },
];

export function nativosVitrine(): AgenteVitrine[] {
  return VITRINE.filter((v) => PERSONAS[v.id]).map((v, i) => ({
    slug: v.id,
    name: PERSONAS[v.id].name,
    course: v.area,
    tagline: PERSONAS[v.id].oneLiner,
    signatureArtifacts: v.entrega,
    tipo: "nativo",
    order: i + 1,
  }));
}

/** Mistura duas listas alternando (nativo, mentor, nativo, …) — o resto da maior vai no fim. */
export function intercalar<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
