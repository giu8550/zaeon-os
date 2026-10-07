/**
 * lib/agents/nativos.ts — os agentes NATIVOS da casa (as personas de lib/ai/personas.ts) no formato
 * de vitrine (crachá da landing). PURO. Diferente dos mentores (plugáveis, catálogo no banco), os
 * nativos já vêm na plataforma — cada um mora na sua sala.
 */
import { PERSONAS } from "@/lib/ai/personas";

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
};

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
