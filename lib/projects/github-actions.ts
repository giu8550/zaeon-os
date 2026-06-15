/**
 * GitHub Action Catalog — the agent's allowed operations and their risk tier.
 *
 * Single source of truth shared by:
 *   - the API route (app/api/projects/github/route.ts) for server-side enforcement,
 *   - the UI (ProjectsContent) to render the action bar and approval prompts.
 *
 * Principle of least privilege: every action declares the minimum OAuth scope it
 * needs and whether it requires explicit human approval. Irreversible / high-blast
 * actions (merge, push to default branch, delete) ALWAYS require approval and can
 * never be auto-executed by an autonomous loop.
 *
 * NOTE: this catalog is a CONTRACT. The actual Octokit calls are not implemented
 * in this repo yet (no GitHub OAuth app / octokit dependency configured). The
 * route validates + echoes the planned call so the UI flow is testable end-to-end.
 */

export type GitHubScope =
  | "repo:read"
  | "repo:write"
  | "pull_request:write"
  | "issues:write"
  | "contents:write";

export type RiskTier = "safe" | "review" | "irreversible";

export interface GitHubAction {
  id: string;
  label: string;
  /** Minimum OAuth scope required (least privilege). */
  scope: GitHubScope;
  risk: RiskTier;
  /** Whether a human must approve before execution. Always true for irreversible. */
  requiresApproval: boolean;
  /** May an autonomous loop trigger this without a checkpoint? */
  autonomyAllowed: boolean;
  description: string;
}

export const GITHUB_ACTIONS: GitHubAction[] = [
  // ── Read (safe) ───────────────────────────────────────────────────────────
  { id: "list_repos", label: "Listar repositórios", scope: "repo:read", risk: "safe", requiresApproval: false, autonomyAllowed: true, description: "Lê os repositórios acessíveis ao usuário." },
  { id: "read_tree", label: "Ler árvore de arquivos", scope: "repo:read", risk: "safe", requiresApproval: false, autonomyAllowed: true, description: "Lê a estrutura de diretórios e arquivos de um branch." },
  { id: "read_file", label: "Ler arquivo", scope: "repo:read", risk: "safe", requiresApproval: false, autonomyAllowed: true, description: "Lê o conteúdo de um arquivo (contexto do repositório)." },
  { id: "read_diff", label: "Revisar diff", scope: "repo:read", risk: "safe", requiresApproval: false, autonomyAllowed: true, description: "Lê o diff de um PR ou entre branches para revisão." },
  { id: "list_issues", label: "Listar issues", scope: "repo:read", risk: "safe", requiresApproval: false, autonomyAllowed: true, description: "Lê issues abertas/fechadas." },

  // ── Write — reversible (review by default) ─────────────────────────────────
  { id: "create_repo", label: "Criar repositório", scope: "repo:write", risk: "review", requiresApproval: false, autonomyAllowed: false, description: "Cria um novo repositório (org com Administration:write, ou conta via OAuth). O GitHub App por installation NÃO cria repo em conta pessoal." },
  { id: "create_branch", label: "Criar branch", scope: "repo:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Cria um branch de trabalho a partir de um ref. Reversível." },
  { id: "commit", label: "Commit em branch de trabalho", scope: "contents:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Commita mudanças em um branch NÃO-padrão (feature branch). Reversível via revert." },
  { id: "delete_file", label: "Excluir arquivo", scope: "contents:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Remove um arquivo via commit em branch de trabalho. Reversível pelo histórico git." },
  { id: "rename_file", label: "Renomear/mover arquivo", scope: "contents:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Renomeia/move um arquivo (delete + add) em um único commit no branch de trabalho. Reversível." },
  { id: "open_pr", label: "Abrir Pull Request", scope: "pull_request:write", risk: "review", requiresApproval: true, autonomyAllowed: false, description: "Abre um PR do branch de trabalho para o branch base. Exige aprovação humana." },
  { id: "comment_pr", label: "Comentar em PR", scope: "pull_request:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Adiciona comentário de revisão em um PR." },
  { id: "create_issue", label: "Criar issue", scope: "issues:write", risk: "review", requiresApproval: false, autonomyAllowed: true, description: "Abre uma issue (ex.: TODO de refator, bug encontrado)." },
  { id: "edit_issue", label: "Editar/fechar issue", scope: "issues:write", risk: "review", requiresApproval: true, autonomyAllowed: false, description: "Edita ou fecha uma issue existente. Exige aprovação." },

  // ── Irreversible — ALWAYS human-approved, NEVER autonomous ─────────────────
  { id: "merge_pr", label: "Fazer merge de PR", scope: "pull_request:write", risk: "irreversible", requiresApproval: true, autonomyAllowed: false, description: "Integra um PR ao branch base. Irreversível — aprovação humana obrigatória." },
  { id: "push_default", label: "Push direto no branch padrão", scope: "contents:write", risk: "irreversible", requiresApproval: true, autonomyAllowed: false, description: "Commit direto em main/master. Irreversível — aprovação humana obrigatória." },
  { id: "delete_branch", label: "Deletar branch", scope: "repo:write", risk: "irreversible", requiresApproval: true, autonomyAllowed: false, description: "Remove um branch. Irreversível — aprovação humana obrigatória." },
  { id: "force_push", label: "Force push", scope: "contents:write", risk: "irreversible", requiresApproval: true, autonomyAllowed: false, description: "Reescreve histórico. Irreversível — aprovação humana obrigatória." },
];

export const GITHUB_ACTION_MAP: Record<string, GitHubAction> = Object.fromEntries(
  GITHUB_ACTIONS.map((a) => [a.id, a]),
);

/** All distinct scopes required by safe + reversible actions (the default grant). */
export const DEFAULT_OAUTH_SCOPES: GitHubScope[] = [
  "repo:read",
  "repo:write",
  "contents:write",
  "pull_request:write",
  "issues:write",
];

export function isAutonomyAllowed(actionId: string): boolean {
  return GITHUB_ACTION_MAP[actionId]?.autonomyAllowed ?? false;
}

export function requiresApproval(actionId: string): boolean {
  // Unknown action → fail closed (require approval).
  return GITHUB_ACTION_MAP[actionId]?.requiresApproval ?? true;
}
