#!/usr/bin/env bash
# Adota uma worktree que já existe (de Claude Code, Codex, Qoder…) como cartão no quadro "zaeon" do Hermes.
# Não move nem copia nada: o cartão aponta pra pasta (worktree:<path>) e pra branch atuais.
# O cartão nasce BLOQUEADO — o dispatcher só mexe nele depois de `hermes kanban unblock <id>`.
# Uso: scripts/hermes/adotar-worktree.sh <pasta-da-worktree> [claude-code|codex-cli|manus] ["título"]
set -euo pipefail
WT="$(cd "${1:?pasta da worktree}" && pwd)"; QUEM="${2:-}"; TITULO="${3:-}"
BOARD="${HERMES_BOARD:-zaeon}"; PROJETO="${HERMES_PROJETO:-zaeon-os}"

git -C "$WT" rev-parse --is-inside-work-tree >/dev/null || { echo "✗ $WT não é worktree git"; exit 1; }
BRANCH="$(git -C "$WT" branch --show-current)"
[ -n "$BRANCH" ] || { echo "✗ $WT está em HEAD solto — crie uma branch antes"; exit 1; }

# Quem estava trabalhando nela, pelo prefixo da branch, se não disseram
if [ -z "$QUEM" ]; then
  case "$BRANCH" in claude/*) QUEM=claude-code ;; codex/*) QUEM=codex-cli ;; *) QUEM=claude-code ;; esac
fi
[ -n "$TITULO" ] || TITULO="$(git -C "$WT" log -1 --format=%s 2>/dev/null || echo "$BRANCH")"

git -C "$WT" fetch -q origin main 2>/dev/null || true
PR="$(gh pr list --head "$BRANCH" --state all --json number,state,url --jq '.[0] // empty | "\(.url) (\(.state))"' 2>/dev/null || true)"
CORPO="$(mktemp)"; trap 'rm -f "$CORPO"' EXIT
{
  echo "Worktree adotada do fluxo antigo — continue daqui, sem recriar a branch."
  echo
  echo "- pasta: \`$WT\`"
  echo "- branch: \`$BRANCH\`"
  echo "- PR: ${PR:-nenhum}"
  echo
  echo "## Commits que ainda não estão no main"
  git -C "$WT" log --oneline origin/main..HEAD 2>/dev/null | head -30 | sed 's/^/- /'
  echo
  echo "## Mudanças não commitadas"
  git -C "$WT" status --short | head -40 | sed 's/^/- /'
  echo
  echo "## O que falta"
  echo "(dono: escreva aqui antes de desbloquear)"
} > "$CORPO"

ID="$(hermes kanban --board "$BOARD" create "$TITULO" \
  --body-file "$CORPO" --assignee "$QUEM" --project "$PROJETO" \
  --workspace "worktree:$WT" --branch "$BRANCH" \
  --idempotency-key "worktree:$WT" --initial-status blocked --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
echo "✓ cartão $ID → $QUEM · $BRANCH"
echo "  ver:        hermes kanban --board $BOARD show $ID"
echo "  liberar:    hermes kanban --board $BOARD unblock $ID"
