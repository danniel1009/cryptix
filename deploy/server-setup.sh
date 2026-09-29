#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 22.04/24.04 DewaVPS host (run as root ON THE SERVER):
#   bash server-setup.sh cryptix.example.com
# Installs Node 22, nginx, certbot; creates the app user + /opt/cryptix; installs the systemd unit.
set -euo pipefail
DOMAIN="${1:?usage: server-setup.sh <domain>}"
APP_USER=cryptix
APP_PATH=/opt/cryptix

apt-get update -y
apt-get install -y curl git nginx certbot python3-certbot-nginx rsync ufw
if ! command -v node >/dev/null || [[ "$(node -v | cut -c2-3)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_PATH" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_PATH"
chown -R "$APP_USER:$APP_USER" "$APP_PATH"

# Environment file (edit the values!)
if [[ ! -f "$APP_PATH/.env.production" ]]; then
  cat > "$APP_PATH/.env.production" <<ENV
NODE_ENV=production
PORT=3000
NEXT_PUBLIC_BRAND_NAME=Cryptix
NEXT_PUBLIC_SITE_URL=https://$DOMAIN
NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_CONTACT_EMAIL=
NEXT_PUBLIC_DEFAULT_LOCALE=en
EXCHANGE_SPREAD=0.05
MARKET_PROVIDERS=exchange,indodax,coingecko,tronscan
CONTACT_EMAIL=
LEAD_WEBHOOK_URL=
LEAD_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
TRUSTED_PROXY_HOPS=1
IP_HASH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
ENV
  chown "$APP_USER:$APP_USER" "$APP_PATH/.env.production"; chmod 600 "$APP_PATH/.env.production"
  echo ">> edit $APP_PATH/.env.production (WhatsApp number, contact email, lead channel)"
fi

# systemd unit
sed "s#__APP_PATH__#$APP_PATH#g; s#__APP_USER__#$APP_USER#g" "$(dirname "$0")/cryptix-web.service" > /etc/systemd/system/cryptix-web.service
systemctl daemon-reload
systemctl enable cryptix-web

# nginx (HTTP first; certbot upgrades it to HTTPS)
sed "s#__DOMAIN__#$DOMAIN#g" "$(dirname "$0")/nginx.cryptix.conf" > /etc/nginx/sites-available/cryptix.conf
ln -sf /etc/nginx/sites-available/cryptix.conf /etc/nginx/sites-enabled/cryptix.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo
echo "Next steps:"
echo "  1. point DNS A record of $DOMAIN to this server, then: certbot --nginx -d $DOMAIN --redirect"
echo "  2. from your laptop: DEPLOY_HOST=<ip> npm run deploy   (first deploy builds and starts the service)"
