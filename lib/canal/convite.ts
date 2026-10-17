/**
 * lib/canal/convite.ts — convites e abas do escritório (#396, item D). PURO.
 *
 * Fluxo combinado:
 *   1. Botão "+" → convite por e-mail (ou nome, se só uma pessoa tiver aquele nome; a Zaeon não tem
 *      "nome de usuário"). O convite cai na aba PRIVADO da pessoa convidada, com Aceitar / Recusar.
 *   2. Aceito → nasce a conversa privada 1 a 1 (um canal com `dmCom`): só quem convidou e quem aceitou.
 *   3. Só depois de aceito o dono pode colocar a pessoa nos canais de TURMA / ABERTO dele (são "contatos").
 * As três abas (privado / turma / aberto) dividem o mesmo espaço, mas cada uma lista só os canais dela.
 */
export type Aba = "privado" | "turma" | "aberto";
export const ABAS: readonly Aba[] = ["privado", "turma", "aberto"];

export type StatusConvite = "pendente" | "aceito" | "recusado";
export type Convite = { id: string; deId: string; paraId: string; status: StatusConvite };
/** O que as regras precisam de um convite — `status` como texto, do jeito que vem do banco. */
type ConviteLike = { deId: string; paraId: string; status: string };

// ───────────────────────────── quem convidar ─────────────────────────────

export type AlvoConvite = { email: string } | { nome: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** O que a pessoa digitou no "+": e-mail (normalizado) ou nome. null = vazio/curto demais. */
export function interpretarAlvo(texto: unknown): AlvoConvite | null {
  const t = String(texto ?? "").trim().replace(/^@/, "");
  if (!t) return null;
  if (EMAIL_RE.test(t)) return { email: t.toLowerCase() };
  if (t.length < 2 || t.length > 80) return null;
  return { nome: t };
}

// ───────────────────────────── respostas ─────────────────────────────

export type Acao = "aceitar" | "recusar";

/** Só a pessoa CONVIDADA responde, e só enquanto o convite está pendente. */
export function podeResponder(c: Pick<ConviteLike, "paraId" | "status">, userId: string | null | undefined): boolean {
  return !!userId && c.paraId === userId && c.status === "pendente";
}

/** aceitar → aceito, recusar → recusado; qualquer outra coisa → null. */
export function statusDepois(acao: unknown): StatusConvite | null {
  return acao === "aceitar" ? "aceito" : acao === "recusar" ? "recusado" : null;
}

/** Os dois já são contatos (convite aceito em qualquer direção)? */
export function saoContatos(convites: ConviteLike[], a: string, b: string): boolean {
  return convites.some((c) => c.status === "aceito" && ((c.deId === a && c.paraId === b) || (c.deId === b && c.paraId === a)));
}

/** Já existe um convite que impede um novo (pendente ou aceito, em qualquer direção)? */
export function conviteEmAberto<T extends ConviteLike>(convites: T[], a: string, b: string): T | null {
  return convites.find((c) => c.status !== "recusado" && ((c.deId === a && c.paraId === b) || (c.deId === b && c.paraId === a))) ?? null;
}

// ───────────────────────── convite para uma conversa (#425) ─────────────────────────

/**
 * Convite PARA UMA CONVERSA (tem `canalId`): o dono chama alguém pra conversa aberta na tela e, no aceite, a
 * pessoa ENTRA nela — não cria outra. Sem `canalId` é o convite de CONTATO de antes (aceitar cria a conversa
 * de dois). Só os de contato contam como "contatos".
 */
export const ehConviteDeConversa = (c: { canalId?: string | null }): boolean => !!c.canalId;

/** Só o dono da conversa convida pra ela. */
export const podeConvidarParaConversa = (canal: { ownerId: string }, userId: string | null | undefined): boolean =>
  !!userId && canal.ownerId === userId;

/**
 * Como o canal fica quando alguém entra pelo convite: vira membro. Se era a conversa de DOIS (dmCom), ela vira
 * um GRUPO PRIVADO — o outro lado passa a ser membro também e a trava "só os dois" sai (continua "privado").
 */
export function entrarNaConversa(c: { membros?: string[] | null; dmCom?: string | null }, novoId: string): { membros: string[]; dmCom: null } {
  return { membros: [...new Set([...(c.membros ?? []), ...(c.dmCom ? [c.dmCom] : []), novoId])], dmCom: null };
}

/** Título da conversa privada (cada lado vê o nome do outro na tela; este é o guardado). */
export function tituloConversa(nomeA: string | null | undefined, nomeB: string | null | undefined): string {
  return `${(nomeA || "Alguém").trim()} e ${(nomeB || "Alguém").trim()}`.slice(0, 80);
}

// ───────────────────────────── abas ─────────────────────────────

type CanalAba = { acesso: string; dmCom?: string | null };

/** Em qual aba um canal aparece: conversa privada (dmCom) e canal "privado" → privado; senão o acesso. */
export function abaDoCanal(c: CanalAba): Aba {
  if (c.dmCom) return "privado";
  return c.acesso === "aberto" ? "aberto" : c.acesso === "privado" ? "privado" : "turma";
}

/** Só os canais da aba — os filtros dividem o espaço, mas não se misturam. */
export function filtrarPorAba<T extends CanalAba>(canais: T[], aba: Aba): T[] {
  return canais.filter((c) => abaDoCanal(c) === aba);
}

/** Quantas pessoas reais o canal tem (dono + membros + o outro lado da conversa privada). */
export function humanosNoCanal(c: { ownerId: string; membros: string[]; dmCom?: string | null }): number {
  const ids = new Set<string>([c.ownerId, ...c.membros]);
  if (c.dmCom) ids.add(c.dmCom);
  return ids.size;
}
