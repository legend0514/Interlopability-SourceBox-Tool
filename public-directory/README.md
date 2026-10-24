# SourceBox directory and relay

Render: Node runtime, root `public-directory`, build `npm run check`, start `npm start`, Free instance, health `/health`. Vendored ws 8.22.0 (MIT) is included; no install scripts or credentials are needed. Render supplies PORT, RENDER and RENDER_EXTERNAL_URL. Other hosts must set PUBLIC_URL to their public HTTPS origin and put an HTTPS reverse proxy with WebSocket upgrades in front of the service.

Public hosting defaults to relay in the updated launcher. Both host and players connect outbound over WSS. The relay only pairs connections to registered SourceBox hosts; it cannot dial arbitrary destinations. Game traffic retains the existing pinned TLS connection end to end. The directory includes public join tokens, just like the direct public browser. Private sessions are not published.

Routes: GET /health and /v1/servers; POST/DELETE /v1/servers for direct hosting; WebSocket /v1/relay/host, /join and /attach. Direct hosts still need TCP forwarding and pass a certificate/challenge reachability check. Relay hosts do not need forwarding. Relay lists live in memory; host disconnect removes its listing and tunnels. Hosts reconnect with backoff after a service restart. Players reconnect through the game bridge. Restarting the host requires a new join code.

Limits: 100 relay hosts, four per address, bounded channels and pending handshakes, 64 KiB frames, 256 KiB queued forwarding, 2 MiB/s and 512 frames/s per direction per tunnel. Idle connections are checked every 20 seconds. Free Render bandwidth/compute limits apply and service restarts interrupt sessions. This is a tester relay, not a guaranteed unlimited production service. Keep one instance: rendezvous state is in memory.
