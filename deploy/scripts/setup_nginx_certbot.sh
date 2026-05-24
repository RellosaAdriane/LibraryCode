#!/usr/bin/env bash
set -euo pipefail

DOMAIN="library.cvsu.dev"
ROOT="/var/www/librarycode/build"
BACKEND="http://127.0.0.1:8000"
EMAIL=""

usage() {
	cat <<EOF
Usage: $0 --domain example.com --root /path/to/build --backend http://127.0.0.1:8000 --email you@example.com

This script installs nginx + certbot (Ubuntu/Debian), writes a site config for the domain,
and requests a LetsEncrypt certificate using certbot.
EOF
	exit 1
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--domain) DOMAIN="$2"; shift 2;;
		--root) ROOT="$2"; shift 2;;
		--backend) BACKEND="$2"; shift 2;;
		--email) EMAIL="$2"; shift 2;;
		-h|--help) usage;;
		*) echo "Unknown arg: $1"; usage;;
	esac
done

if [[ -z "$EMAIL" ]]; then
	echo "ERROR: --email is required for Let's Encrypt registration"
	usage
fi

echo "Domain: $DOMAIN"
echo "Root: $ROOT"
echo "Backend: $BACKEND"

if ! command -v nginx >/dev/null 2>&1; then
	echo "Installing nginx..."
	sudo apt-get update
	sudo apt-get install -y nginx
fi

if ! command -v certbot >/dev/null 2>&1; then
	echo "Installing certbot... (using snap if available)"
	if command -v snap >/dev/null 2>&1; then
		sudo snap install core; sudo snap refresh core
		sudo snap install --classic certbot
		sudo ln -sf /snap/bin/certbot /usr/bin/certbot
	else
		sudo apt-get update
		sudo apt-get install -y certbot python3-certbot-nginx
	fi
fi

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
echo "Writing nginx conf to $NGINX_CONF"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    root $ROOT;
    index index.html index.htm;

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log /var/log/nginx/${DOMAIN}.error.log;

    location /api/ {
        proxy_pass $BACKEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /server/ {
        proxy_pass $BACKEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~ \.php$ {
        proxy_pass $BACKEND;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"

echo "Testing nginx configuration..."
sudo nginx -t

echo "Reloading nginx"
sudo systemctl reload nginx || sudo service nginx reload

echo "Requesting TLS certificate with certbot for $DOMAIN"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"

echo "Finished. Visit https://$DOMAIN to verify."

exit 0

