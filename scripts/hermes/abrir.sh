#!/usr/bin/env bash
# Abre a worktree de um cartão do quadro "zaeon" no IDE — Qoder (padrão, faixa de revisão) ou Zed.
# Uso: scripts/hermes/abrir.sh <id-do-cartão> [qoder|zed]
set -euo pipefail
ID="${1:?id do cartão (ex.: t_94480173)}"; IDE="${2:-qoder}"; BOARD="${HERMES_BOARD:-zaeon}"
WT="$(hermes kanban --board "$BOARD" show "$ID" --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["task"].get("workspace_path") or "")')"
[ -d "$WT" ] || { echo "✗ worktree do $ID ainda não existe (o worker cria no 1º claim): '$WT'"; exit 1; }
case "$IDE" in
  qoder) open -a Qoder "$WT" ;;
  zed)   zed "$WT" ;;
  *)     echo "✗ IDE desconhecido: $IDE (qoder|zed)"; exit 1 ;;
esac
echo "✓ $ID aberto no $IDE: $WT"
