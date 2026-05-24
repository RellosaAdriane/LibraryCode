# LibraryScript

LibraryScript is a React and PHP-based library portal for managing books, users, and student activity.

## Development

Run the frontend:

```bash
npm start
```

Run the PHP backend from the `server/` directory:

```bash
php -S localhost:8000 -t server
```

To enable Google login/signup, set `REACT_APP_GOOGLE_CLIENT_ID` in the frontend environment and `GOOGLE_CLIENT_ID` on the PHP server to the same OAuth client ID.

Install dependencies with:

```bash
npm install
```

## Production deploy on nginx

The app is designed to run from a single origin in production. Build the React frontend, then let nginx serve the static build and pass PHP requests to PHP-FPM.

1. Build the frontend:

```bash
npm install
npm run build
```

2. Copy or sync the React build output to your web root, for example `/var/www/librarycode/build`.

3. Place the PHP backend files somewhere nginx can reach, for example `/var/www/librarycode/server`.

4. Use an nginx server block similar to the one below for `library.cvsu.dev`:

```nginx
server {
	listen 80;
	server_name library.cvsu.dev;

	root /var/www/librarycode/build;
	index index.html;

	location / {
		try_files $uri $uri/ /index.html;
	}

	location ~ ^/(login|register|reset-password|change-password|borrow|books|users|sessions|student-activity|book-qr|book-cover|google-auth|sso-login|admin-2fa-store|announcement_settings_store|announcement-settings|penalty_settings_store|penalty-settings|signup_settings_store|signup-settings|sso_settings_store|sso-settings|security-logs|health|cors)\.php$ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.2-fpm.sock;
		fastcgi_param SCRIPT_FILENAME /var/www/librarycode/server$fastcgi_script_name;
	}

	location ^~ /api/ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.2-fpm.sock;
		fastcgi_param SCRIPT_FILENAME /var/www/librarycode/server$fastcgi_script_name;
	}

	location ~* \.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|json)$ {
		try_files $uri =404;
		expires 30d;
		access_log off;
	}
}
```

5. Enable HTTPS with Certbot after the site responds on HTTP:

```bash
sudo certbot --nginx -d library.cvsu.dev
```

6. Make sure the DNS `A` or `AAAA` record for `library.cvsu.dev` points to this Ubuntu server.

Notes:

- The frontend already calls the backend on the same origin in production, so you do not need a separate API domain.
- The PHP backend currently allows cross-origin requests, but same-origin hosting is the cleanest setup.
- If your PHP-FPM socket uses a different version, update `fastcgi_pass` accordingly, for example `/run/php/php8.1-fpm.sock`.
