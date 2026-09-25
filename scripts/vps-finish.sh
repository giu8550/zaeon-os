#!/usr/bin/env bash
# vps-finish.sh — recuperação + finalização da Zaeon na VPS (idempotente).
# Colar/rodar de uma vez quando reconectar em /root/zaeon-os.
cd /root/zaeon-os || exit 1
COMPOSE="docker compose -f docker-compose.beta.yml"

echo "== 1) swap (cria só se não existir) =="
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 8G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
free -h

echo "== 2) alivia RAM: desliga voz/abnt (opcionais no beta) =="
docker stop zaeon_voice zaeon_abnt 2>/dev/null || true

echo "== 3) garante web+redis+caddy de pé (sem puxar os glutões) =="
$COMPOSE up -d --no-deps redis caddy web

echo "== 4) espera o web respirar =="
sleep 20
$COMPOSE ps

echo "== 5) migração no Atlas (cria coleções novas; dados antigos intactos) =="
$COMPOSE exec -T web npx prisma db push

echo "== 6) health por dentro do container =="
$COMPOSE exec -T web node -e "fetch('http://localhost:3000/api/health').then(r=>r.text()).then(t=>console.log('HEALTH:',t)).catch(e=>console.log('ERRO:',e.message))"

echo "== fim. se HEALTH veio ok, só falta repontar o DNS de beta.zaeon.space -> 75.119.140.97 =="
