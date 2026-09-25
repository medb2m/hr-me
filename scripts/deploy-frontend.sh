#!/usr/bin/env bash
# Rebuild Angular (prod) puis recharge nginx. À lancer après chaque déploiement front.
set -euo pipefail

ROOT="/var/www/hr-me"
cd "$ROOT"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
npx ng build --configuration=production

if [[ "${EUID:-0}" -eq 0 ]]; then
  systemctl reload nginx
else
  sudo systemctl reload nginx
fi

echo "OK — build prod terminé, nginx rechargé."
