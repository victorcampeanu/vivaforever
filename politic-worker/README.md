# politic.vivaforever.ro

Private manual political article generator for the Hermes `political_analyst` profile.

Architecture:

- Cloudflare Worker serves `https://politic.vivaforever.ro`.
- Worker enforces a simple password (`APP_PASSWORD`) for the page/API.
- Worker stores jobs/history in Cloudflare KV.
- The Hermes VM runs a lightweight cron poller, not a persistent web server.
- Poller claims one queued job, runs the existing `political_analyst` workflow with `POLITICAL_ANALYST_MANUAL_TOPIC`, then posts the finished article and image back to the Worker.

This keeps the Hermes machine outbound-only. No open port and no always-on web app on the server.

## Cloudflare setup

Install/use Wrangler, then from `politic-worker/`:

```bash
npm create cloudflare@latest -- --help >/dev/null 2>&1 || true
npx wrangler kv namespace create POLITIC_KV
```

Copy the returned KV namespace id into `wrangler.toml`.

Set secrets:

```bash
npx wrangler secret put APP_PASSWORD
npx wrangler secret put HERMES_SHARED_SECRET
```

Deploy:

```bash
npx wrangler deploy
```

DNS/route target:

```text
politic.vivaforever.ro/* -> vivaforever-politic Worker
```

## Hermes VM setup

Set these in `~/.hermes/.env` or the environment available to cron/gateway:

```bash
POLITIC_WORKER_URL=https://politic.vivaforever.ro
POLITIC_WORKER_AGENT_SECRET=<same value as HERMES_SHARED_SECRET>
```

The poller is:

```bash
/home/vic/.hermes/scripts/political_analyst_poll_politic_worker.sh
```

Schedule it every minute with Hermes cron as a script-only job once the Worker is deployed.
