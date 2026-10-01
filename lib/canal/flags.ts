/**
 * lib/canal/flags.ts — as três flags do escritório coworking. TODAS off por padrão: o merge
 * não muda nada até ligar. São NEXT_PUBLIC_* porque o gate principal é no cliente (qual
 * componente a aba renderiza / se a landing busca avatar); no servidor valem igual.
 *   NEXT_PUBLIC_ESCRITORIO_COWORK=1 → aba "escritorio" vira o canal (sem 3D) + rotas /api/canal
 *   NEXT_PUBLIC_AGENTS_ADMIN=1      → aba "Agents" no admin + rotas /api/admin/agents
 *   NEXT_PUBLIC_AGENT_AVATARS=1     → landing/loja leem avatar do AgentProfile
 */
const on = (v: string | undefined) => v === "1" || v === "true";

export const escritorioCowork = (): boolean => on(process.env.NEXT_PUBLIC_ESCRITORIO_COWORK) || on(process.env.ESCRITORIO_COWORK);
export const agentsAdmin = (): boolean => on(process.env.NEXT_PUBLIC_AGENTS_ADMIN) || on(process.env.AGENTS_ADMIN);
export const agentAvatars = (): boolean => on(process.env.NEXT_PUBLIC_AGENT_AVATARS);
