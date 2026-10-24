#!/usr/bin/env bash
# Entrega um PR: espera o CI → (flaky conhecido? roda de novo 1×) → verde = merge (nunca auto-merge do GitHub)
# → espera o deploy até o /api/health mostrar um commit que CONTÉM o merge (git merge-base --is-ancestor).
# Uso: scripts/entregar-pr.sh <número-do-pr> [--sem-merge]
set -uo pipefail
PR="$1"; SEM_MERGE="${2:-}"
SAUDE="${SAUDE_URL:-https://zaeon.com.br/api/health}"
FLAKY='lib/octa/captura.test.ts'   # Chromium no runner às vezes estoura 15 s — não é do PR

checks() { gh pr checks "$PR" --json bucket --jq '[.[].bucket]|join(",")' 2>/dev/null; }
esperar_ci() { local s; sleep 20; until s=$(checks) && [ -n "$s" ] && ! grep -q pending <<<"$s"; do sleep 30; done; echo "$s"; }

for tentativa in 1 2; do
  s=$(esperar_ci)
  if ! grep -q fail <<<"$s"; then break; fi
  head=$(gh pr view "$PR" --json headRefOid --jq .headRefOid)
  run=$(gh run list --commit "$head" -L 1 --json databaseId --jq '.[0].databaseId')
  if [ "$tentativa" = 1 ] && gh run view "$run" --log-failed 2>&1 | grep -q "FAIL.*$FLAKY"; then
    outros=$(gh run view "$run" --log-failed 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E " FAIL " | grep -vc "$FLAKY")
    if [ "$outros" = 0 ]; then echo "↻ só o flaky ($FLAKY) — rodando de novo"; gh run rerun "$run" --failed; continue; fi
  fi
  echo "✗ CI vermelho no PR #$PR:"; gh run view "$run" --log-failed 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E " FAIL |AssertionError|error TS" | head -15; exit 1
done
grep -q fail <<<"$s" && { echo "✗ CI vermelho depois de rodar de novo"; exit 1; }
echo "✓ CI verde no PR #$PR"
[ "$SEM_MERGE" = "--sem-merge" ] && exit 0

gh pr merge "$PR" --merge >/dev/null 2>&1 || true
for i in 1 2 3 4 5; do sha=$(gh pr view "$PR" --json mergeCommit,state --jq 'select(.state=="MERGED")|.mergeCommit.oid'); [ -n "$sha" ] && break; sleep 3; done
[ -z "${sha:-}" ] && { echo "✗ merge não aconteceu"; exit 1; }
echo "✓ merge $sha — esperando o deploy"
for i in $(seq 1 60); do
  git fetch -q origin main 2>/dev/null
  c=$(curl -s "$SAUDE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("commit",""))' 2>/dev/null)
  if [ -n "$c" ] && git cat-file -e "$c" 2>/dev/null && git merge-base --is-ancestor "$sha" "$c"; then echo "✓ em prod: $c"; exit 0; fi
  sleep 30
done
echo "✗ deploy não chegou em 30 min (prod: ${c:-?})"; exit 1
