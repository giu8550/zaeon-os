#!/usr/bin/env bash
# Baixa vozes Piper pt-BR usando curl (nativo no macOS e Linux — NÃO precisa de Python).
#
# Uso:
#   bash scripts/download_voice.sh                    # pt_BR-faber-medium (default)
#   bash scripts/download_voice.sh pt_BR-edresson-low # outra voz
#
# Coloca os arquivos (.onnx + .onnx.json) em voice-engine/voices/, onde o engine.py procura.
# Vozes do repositório oficial rhasspy/piper-voices (HuggingFace).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/voices"
mkdir -p "$DIR"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"
VOICE="${1:-pt_BR-faber-medium}"

case "$VOICE" in
  pt_BR-faber-medium) SUBPATH="pt/pt_BR/faber/medium" ;;
  pt_BR-edresson-low) SUBPATH="pt/pt_BR/edresson/low" ;;
  *) echo "voz desconhecida: $VOICE (conhecidas: pt_BR-faber-medium, pt_BR-edresson-low)"; exit 1 ;;
esac

for ext in onnx onnx.json; do
  out="$DIR/$VOICE.$ext"
  if [ -s "$out" ]; then echo "= já existe: $out"; continue; fi
  echo "↓ $VOICE.$ext"
  curl -fL --retry 3 -o "$out" "$BASE/$SUBPATH/$VOICE.$ext"
done

echo "✓ pronto. Vozes em: $DIR"
