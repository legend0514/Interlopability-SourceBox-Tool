# SourceBox public server directory

Render settings: Node runtime, root directory `public-directory`, build command `npm run check`, start command `npm start`, Free instance, health check `/health`. No database or secret environment variables required. Render supplies PORT and RENDER; the service binds to 0.0.0.0 on Render.

The launcher Public Directory URL is the HTTPS onrender.com URL. Hosts must forward their TCP game port (default 27843). Registration verifies the TLS fingerprint and private server challenge before listing. Entries expire after 90 seconds. The Free instance sleeps when idle; clients allow time for it to wake.

The directory supports public IPv4 hosts, up to 100 listings, with four listings per public address. No relay or CGNAT bypass is included.
