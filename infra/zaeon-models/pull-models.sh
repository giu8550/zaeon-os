#!/bin/bash
# Pull sequencial dos LLMs + vigia do adapter (runbook §3/§6). Log em pull.log.
cd /opt/zaeon-models
vigia() { while :; do echo "[vigia $(date +%T)] load=$(cut -d" " -f1-3 /proc/loadavg) $(docker stats --no-stream --format "{{.Name}}={{.CPUPerc}}/{{.MemUsage}}" zenith_adapter zenith_adapter_db | tr "\n" " ")"; sleep 30; done; }
vigia & VP=$!
for m in qwen3:4b-instruct-2507-q4_K_M llama-guard3:8b gpt-oss:20b qwen3-coder:30b; do
  # freio: load alto (>14 de 18) espera normalizar antes do próximo
  while awk "{exit !(\$1>14)}" /proc/loadavg; do echo "[freio $(date +%T)] load alto, esperando"; sleep 20; done
  echo "== PULL $m $(date +%T)"
  docker exec zaeon_ollama ollama pull "$m" 2>&1 | tr "\r" "\n" | grep -v "pulling [0-9a-f]*:.*%" | tail -3
  echo "== FIM $m rc=${PIPESTATUS[0]} $(date +%T)"
done
kill $VP; docker exec zaeon_ollama ollama list; echo "== TUDO PRONTO $(date +%T)"
