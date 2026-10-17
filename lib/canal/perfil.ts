/**
 * lib/canal/perfil.ts — o perfil de uma pessoa visto de dentro do escritório (#425). PURO.
 *
 * Clicar na foto da barra abre um menu: "Ver perfil" e (só pro dono) "Remover do escritório".
 * O perfil é uma LISTA FECHADA de campos públicos (nome, foto, curso, nível, instituição, bio). Os CÉREBROS
 * (mapas de estudo) e qualquer outro dado do aluno ficam de fora — nem saem do servidor.
 */

/** Quem faz parte do canal: o dono, os membros e o outro lado de uma conversa privada. */
export function estaNoCanal(c: { ownerId: string; membros?: string[] | null; dmCom?: string | null }, userId: string): boolean {
  return c.ownerId === userId || (c.membros ?? []).includes(userId) || c.dmCom === userId;
}

/** Os ÚNICOS campos do usuário que a rota do perfil lê do banco (select do Prisma). */
export const CAMPOS_PERFIL = { id: true, name: true, image: true, course: true, academicLevel: true, institution: true, bio: true } as const;

export type PerfilPublico = {
  id: string;
  nome: string;
  avatar: string | null;
  curso: string | null;
  nivel: string | null;
  instituicao: string | null;
  bio: string | null;
};

const txt = (v: unknown, max: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** Monta o perfil a partir do usuário — só os campos da lista, mesmo que venha mais coisa. */
export function perfilPublico(u: { id: string; name?: string | null; image?: string | null; course?: string | null; academicLevel?: string | null; institution?: string | null; bio?: string | null }): PerfilPublico {
  return {
    id: u.id,
    nome: txt(u.name, 80) ?? "Alguém",
    avatar: txt(u.image, 2048),
    curso: txt(u.course, 120),
    nivel: txt(u.academicLevel, 60),
    instituicao: txt(u.institution, 120),
    bio: txt(u.bio, 280),
  };
}

/**
 * "Remover do escritório" aparece? Só pro DONO, só em quem é MEMBRO, nunca na própria foto nem na do dono, e
 * nunca numa conversa privada de dois (ali não há a quem remover — sair é apagar a conversa).
 */
export function podeRemover(e: { meuId: string | null; donoId: string; alvoId: string; conversaDeDois: boolean; membros: readonly string[] }): boolean {
  if (!e.meuId || e.meuId !== e.donoId) return false;
  if (e.conversaDeDois) return false;
  if (e.alvoId === e.meuId || e.alvoId === e.donoId) return false;
  return e.membros.includes(e.alvoId); // só quem o dono colocou (num escritório aberto, visitante não é membro)
}

export const textoConfirmarRemover = (nome: string) =>
  `Remover ${nome || "esta pessoa"} do escritório? Ela perde o acesso às mensagens na hora.`;
