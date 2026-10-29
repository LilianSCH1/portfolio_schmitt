#!/usr/bin/env bash
# Exécuté sur le VPS (en root) par GitHub Actions, après le rsync des fichiers
# dans /home/portfolio/app.
set -euo pipefail

APP_DIR=/home/portfolio/app
APP_USER=portfolio
NGINX_CONF=/etc/nginx/sites-available/portfolio.conf

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Nginx : n'installer et recharger que si la config du dépôt a changé
if ! cmp -s "$APP_DIR/deploy/nginx/portfolio.conf" "$NGINX_CONF"; then
  cp "$NGINX_CONF" "$NGINX_CONF.bak"
  cp "$APP_DIR/deploy/nginx/portfolio.conf" "$NGINX_CONF"
  if nginx -t; then
    systemctl reload nginx
    echo "Nginx : configuration mise à jour"
  else
    mv "$NGINX_CONF.bak" "$NGINX_CONF"
    echo "Nginx : configuration invalide, ancienne version restaurée" >&2
    exit 1
  fi
fi

# Le serveur lit les fichiers à chaque requête ; on le relance pour prendre
# en compte un éventuel changement de server.js.
systemctl restart portfolio

for i in 1 2 3 4 5; do
  if curl -fsS -o /dev/null http://127.0.0.1:3007/; then
    echo "Portfolio en ligne"
    exit 0
  fi
  sleep 1
done
echo "Le portfolio ne répond pas sur 127.0.0.1:3007" >&2
exit 1
