Deployment notes — nginx + certbot

Prerequisites
- A VPS running Debian/Ubuntu with this repository checked out at `/var/www/librarycode`.
- DNS: create an A record for `library.cvsu.dev` pointing to your VPS public IP.

Quick steps (on the VPS)

1. Build/run the app backend (php) and frontend (static build). Example using the included compose:

```bash
cd /var/www/librarycode
# start backend (exposes port 8000)
docker-compose up -d backend
# build frontend into /var/www/librarycode/build
cd /var/www/librarycode
npm install
npm run build
```

2. Run the setup script to install nginx, write the site config, and obtain TLS certs:

```bash
sudo bash deploy/scripts/setup_nginx_certbot.sh --domain library.cvsu.dev --root /var/www/librarycode/build --backend http://127.0.0.1:8000 --email you@example.com
```

3. Verify
- Visit https://library.cvsu.dev
- Check `sudo nginx -t` and `sudo systemctl status nginx`

If your OS is not Debian/Ubuntu, adapt package installation and certbot method accordingly.
