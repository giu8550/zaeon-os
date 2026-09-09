/**
 * lib/skilltree/credential.ts — GANCHO para a PR Solana (credenciais on-chain).
 *
 * Quando um nó vira `mastered`, `masteryUpdate` chama `issueCredential(userId, {type:"skill", …})`.
 * Hoje é um no-op documentado: a cunhagem real entra na PR_SOLANA_CREDENCIAIS (ponto de chamada
 * já pronto). NUNCA lança e NUNCA bloqueia o progresso — é fire-and-forget em quem chama.
 */
export type SkillCredential = {
  type: "skill";
  topicSlug: string;
  nodeId: string;
  title?: string;
};

export type IssueResult = { ok: true; ref: string } | { ok: false; reason: string };

export async function issueCredential(userId: string, cred: SkillCredential): Promise<IssueResult> {
  if (!userId || !cred?.topicSlug || !cred?.nodeId) return { ok: false, reason: "invalid" };
  // TODO(PR_SOLANA_CREDENCIAIS): cunhar a credencial (mint) e devolver a assinatura/tx como `ref`.
  if (process.env.NODE_ENV !== "test") {
    console.info(`[skilltree] credential hook (not wired): user=${userId} ${cred.topicSlug}/${cred.nodeId}`);
  }
  return { ok: false, reason: "not_wired" };
}
