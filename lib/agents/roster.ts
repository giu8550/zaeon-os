/**
 * lib/agents/roster.ts — o ROSTER unificado dos agentes (módulo PURO, sem Prisma/rede).
 *
 * Junta as duas fontes de "cérebro" que já existem — as personas de `lib/ai/personas.ts`
 * e os mentores de `lib/agent/mentors.ts` — numa lista única com a MESMA forma, e sobrepõe
 * o `AgentProfile` (identidade editável: nome/avatar/bio/ativo/ordem) quando ele existe.
 *
 * Quem consome: o canal coworking (lista de @mention + avatar nas bolhas), o admin
 * (gateway de agentes) e a landing (avatar nos cards). Nenhum deles inventa agente:
 * se não está aqui nem num `AgentProfile`, não existe.
 */
import { PERSONAS } from "@/lib/ai/personas";
import { MENTOR_SEED } from "@/lib/agent/mentors";

export type AgentTipo = "persona" | "mentor";

export type AgentBase = {
  agentKey: string;        // persona.id ("aura") OU mentor.slug ("medicina")
  tipo: AgentTipo;
  nome: string;            // nome do roster (default; o AgentProfile pode trocar)
  emoji: string;
  bio: string;             // oneLiner da persona / 1ª frase do personaText do mentor
  curso?: string;          // só mentor
  avatarPadrao: string | null; // foto que já existe em public/agents (personas da casa)
  conversacional: boolean; // agentes "silenciosos" (só formatam saída) não entram no canal
  ordem: number;
};

/** Forma mínima do `AgentProfile` (linha do banco OU objeto de teste). */
export type AgentProfileLike = {
  agentKey: string;
  tipo?: string | null;
  nome?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  ativo?: boolean | null;
  ordem?: number | null;
};

export type AgentView = AgentBase & {
  avatarUrl: string | null; // profile.avatarUrl ?? avatarPadrao
  ativo: boolean;
  /** true quando o agente nasceu no admin (só existe como AgentProfile, sem roster). */
  custom: boolean;
};

/** Fotos que JÁ existem em public/agents/*.png — fallback antes de qualquer upload. */
const AVATAR_PADRAO: Record<string, string> = {
  aura: "/agents/aura.png",
  nina: "/agents/nina.png",
  caio: "/agents/caio.png",
  teo: "/agents/teo.png",
  zaeon: "/agents/bento.png", // "bento" virou "zaeon" (anfitriã) — a foto ficou com o nome antigo
};

const primeiraFrase = (t: string): string => (t || "").trim().split(/(?<=\.)\s/)[0]?.slice(0, 160) ?? "";

/** Roster base (personas + mentores do seed), na ordem: personas primeiro, mentores pelo `order`. */
export function rosterBase(): AgentBase[] {
  const personas: AgentBase[] = Object.values(PERSONAS).map((p, i) => ({
    agentKey: p.id,
    tipo: "persona",
    nome: p.name,
    emoji: "⟁",
    bio: p.oneLiner,
    avatarPadrao: AVATAR_PADRAO[p.id] ?? null,
    conversacional: !p.noPreamble,
    ordem: i,
  }));
  const mentores: AgentBase[] = MENTOR_SEED.map((m) => ({
    agentKey: m.slug,
    tipo: "mentor",
    nome: m.name,
    emoji: m.emoji || "⟁",
    bio: primeiraFrase(m.personaText),
    curso: m.course,
    avatarPadrao: null,
    conversacional: true,
    ordem: 100 + m.order,
  }));
  return [...personas, ...mentores];
}

/** Mentores vindos do BANCO (editáveis) sobrepõem o seed; aceita linhas do MentorTemplate. */
export type MentorRowLike = { slug: string; name: string; course: string; emoji?: string | null; personaText?: string | null; order?: number | null };
export function rosterComMentores(rows: MentorRowLike[]): AgentBase[] {
  const base = rosterBase();
  const porKey = new Map(base.map((a) => [a.agentKey, a]));
  for (const r of rows) {
    const prev = porKey.get(r.slug);
    porKey.set(r.slug, {
      agentKey: r.slug,
      tipo: "mentor",
      nome: r.name,
      emoji: r.emoji || "⟁",
      bio: primeiraFrase(r.personaText ?? "") || prev?.bio || "",
      curso: r.course,
      avatarPadrao: null,
      conversacional: true,
      ordem: 100 + (r.order ?? prev?.ordem ?? 0),
    });
  }
  return [...porKey.values()];
}

/**
 * Sobrepõe os `AgentProfile` ao roster. Profile de agente que NÃO está no roster vira
 * agente `custom` (criado no admin). Ordena por `ordem` e depois por nome.
 */
export function mergeProfiles(base: AgentBase[], profiles: AgentProfileLike[]): AgentView[] {
  const porKey = new Map(profiles.map((p) => [p.agentKey, p]));
  const vistos = new Set<string>();
  const out: AgentView[] = base.map((a) => {
    vistos.add(a.agentKey);
    const p = porKey.get(a.agentKey);
    return {
      ...a,
      nome: p?.nome?.trim() || a.nome,
      bio: p?.bio?.trim() || a.bio,
      ordem: typeof p?.ordem === "number" ? p.ordem : a.ordem,
      avatarUrl: p?.avatarUrl?.trim() || a.avatarPadrao,
      ativo: p?.ativo ?? true,
      custom: false,
    };
  });
  for (const p of profiles) {
    if (vistos.has(p.agentKey)) continue;
    out.push({
      agentKey: p.agentKey,
      tipo: p.tipo === "mentor" ? "mentor" : "persona",
      nome: p.nome?.trim() || p.agentKey,
      emoji: "⟁",
      bio: p.bio?.trim() || "",
      avatarPadrao: null,
      conversacional: true,
      ordem: typeof p.ordem === "number" ? p.ordem : 1000,
      avatarUrl: p.avatarUrl?.trim() || null,
      ativo: p.ativo ?? true,
      custom: true,
    });
  }
  return out.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Inicial pro avatar sem foto ("Aura" → "A"; vazio → "⟁"). */
export function inicial(nome: string | null | undefined): string {
  const s = (nome || "").trim();
  return s ? s[0]!.toUpperCase() : "⟁";
}

const SLUG_RE = /^[a-z0-9]+([_-][a-z0-9]+)*$/;
/** agentKey válido = slug minúsculo (persona.id ou mentor.slug). */
export const isAgentKey = (v: unknown): v is string => typeof v === "string" && SLUG_RE.test(v) && v.length <= 48;

/** Chave pública de um agente pra URL/visor: só o que o roster expõe (nunca o prompt). */
export function publicView(a: AgentView) {
  return { agentKey: a.agentKey, tipo: a.tipo, nome: a.nome, emoji: a.emoji, bio: a.bio, curso: a.curso ?? null, avatarUrl: a.avatarUrl, ativo: a.ativo };
}
