#!/usr/bin/env bash
# Buddy-service VPS audit: Redis, PM2, Nginx, env, health, cache.
# Usage on VPS:
#   cd /path/to/Buddy-service/Backend && bash scripts/vps-production-audit.sh
# Optional: bash scripts/vps-production-audit.sh https://api.yourdomain.com

set -u

API_BASE="${1:-http://127.0.0.1:5000}"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${BACKEND_DIR}/.env"

section() {
  echo ""
  echo "============================================================"
  echo " $1"
  echo "============================================================"
}

section "1) SYSTEM"
echo "Hostname: $(hostname)"
echo "Date: $(date -Is 2>/dev/null || date)"
if [ -f /var/run/reboot-required ]; then
  echo "NOTE: System restart required (run: sudo reboot when convenient)"
fi
echo "Node: $(node -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "npm:  $(npm -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "pm2:  $(pm2 -v 2>/dev/null || echo 'NOT INSTALLED')"
echo "nginx: $(nginx -v 2>&1 || echo 'NOT INSTALLED')"

section "2) REDIS"
if command -v redis-cli >/dev/null 2>&1; then
  echo -n "redis-cli PING: "
  redis-cli ping 2>/dev/null || echo "FAILED"
  echo "redis-server: $(systemctl is-active redis-server 2>/dev/null || systemctl is-active redis 2>/dev/null || echo 'unknown')"
  if redis-cli CONFIG GET bind 2>/dev/null | tail -1 | grep -q 127.0.0.1; then
    echo "bind: OK (localhost)"
  else
    echo "bind: CHECK /etc/redis/redis.conf (should be 127.0.0.1)"
  fi
else
  echo "redis-cli not found"
fi

section "3) FIREWALL (ufw)"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw status verbose 2>/dev/null || ufw status 2>/dev/null || true
  echo "Tip: ufw inactive is OK if cloud firewall handles ports; ensure 6379 is NOT public."
else
  echo "ufw not installed"
fi

section "4) BACKEND .env (Redis / BullMQ / performance flags)"
if [ -f "$ENV_FILE" ]; then
  grep -E '^(NODE_ENV|PORT|REDIS_ENABLED|REDIS_URL|BULLMQ_ENABLED|CACHE_ENABLED|MONGO_MAX_POOL_SIZE|MEMORY_CACHE_MAX_ENTRIES|FRONTEND_URL|SOCKET_CORS_ORIGIN)=' "$ENV_FILE" 2>/dev/null || true
  if grep -q '^REDIS_ENABLED=true' "$ENV_FILE" 2>/dev/null; then
    echo "REDIS_ENABLED: enabled in .env"
  else
    echo "ACTION: Set REDIS_ENABLED=true in $ENV_FILE (Redis is running but app may not use it)"
  fi
else
  echo "MISSING: $ENV_FILE"
fi

section "5) PM2 PROCESSES"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list
  echo ""
  pm2 jlist 2>/dev/null | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try {
        const apps=JSON.parse(d);
        for (const a of apps) {
          console.log('---', a.name, '---');
          console.log('  status:', a.pm2_env?.status);
          console.log('  script:', a.pm2_env?.pm_exec_path);
          console.log('  cwd:', a.pm2_env?.pm_cwd);
          console.log('  restarts:', a.pm2_env?.restart_time);
        }
      } catch(e) { console.log('(parse skip)'); }
    });
  " 2>/dev/null || true
else
  echo "pm2 not installed. Install: npm i -g pm2"
fi

section "6) NGINX"
if command -v nginx >/dev/null 2>&1; then
  sudo nginx -t 2>&1 || nginx -t 2>&1 || true
  echo ""
  echo "Enabled sites:"
  ls -la /etc/nginx/sites-enabled/ 2>/dev/null || true
  echo ""
  echo "Proxy / socket hints in enabled configs:"
  grep -RInE 'proxy_pass|socket\.io|upgrade|/api' /etc/nginx/sites-enabled/ 2>/dev/null | head -40 || true
else
  echo "nginx not installed"
fi

section "7) DEPLOY SCRIPT"
for f in \
  "$BACKEND_DIR/../deploy.sh" \
  "$BACKEND_DIR/deploy.sh" \
  "/root/deploy.sh" \
  "/var/www/deploy.sh" \
  "/home/*/deploy.sh"
do
  [ -f "$f" ] && echo "FOUND: $f" && head -30 "$f" && echo "..."
done
if ! find "$(dirname "$BACKEND_DIR")" -maxdepth 3 -name 'deploy.sh' 2>/dev/null | grep -q .; then
  echo "No deploy.sh found near repo. Use Backend/ecosystem.config.cjs + manual steps below."
fi

section "8) API HEALTH & CACHE"
echo "GET $API_BASE/health"
curl -sS -m 10 "$API_BASE/health" 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.stringify(JSON.parse(d),null,2))}catch{console.log(d||'FAILED')}})" || echo "Health check FAILED (is API running on $API_BASE?)"

echo ""
echo "Cache probe (2x same URL, expect 2nd X-Cache: HIT if optimization enabled):"
URL="$API_BASE/api/v1/food/hero-banners/public"
for i in 1 2; do
  echo -n "  request $i: "
  curl -sS -m 15 -D - -o /dev/null "$URL" 2>/dev/null | grep -i 'x-cache' || echo "(no X-Cache header)"
done

section "9) RECOMMENDED NEXT STEPS"
cat <<'EOF'
[ ] .env: REDIS_ENABLED=true, REDIS_URL=redis://127.0.0.1:6379, BULLMQ_ENABLED=true, NODE_ENV=production
[ ] pm2 start ecosystem.config.cjs (or restart buddy-api)
[ ] pm2 start workers: order + tracking (see ecosystem.config.cjs)
[ ] pm2 save && pm2 startup
[ ] curl /health → redis: "ok"
[ ] npm run test:food-optimization (from Backend folder)
[ ] nginx: proxy_pass to :5000, WebSocket upgrade for Socket.IO
[ ] Optional: sudo reboot (system restart required banner)
EOF

echo ""
echo "Audit complete."
