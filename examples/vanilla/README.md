# TinyReplay - Vanilla Example

A single static `index.html` (no framework, no build, no dependencies) that
demonstrates the whole product: a small **crypto markets / trading desk** that
loads the TinyReplay SDK from a running server, makes real network calls, records
your interactions, and you replay the session in the dashboard.

## What it exercises

- **Live network calls** to the public CoinGecko API (markets list + a 7-day
  price chart per asset) - captured by the SDK as metadata only (method, URL,
  status, timing; never bodies)
- A **POST** order to `httpbin.org` so the network panel shows more than GETs
- Native SVG **sparklines and a price chart** (no charting library)
- A masked **order ticket**: amount input and order-note textarea
- A `data-tr-unmask` **asset filter** that stays visible in the replay (the one
  input that is *not* masked)
- Fake-route navigation via `history.pushState` (Markets / Settings)
- `data-tr-mask` on the account email and the portfolio balance (text masked)
- `data-tr-ignore` on the linked-bank widget (account/routing never recorded)

## Run it

1. Start the TinyReplay server (Docker - from the repo root):

   ```bash
   docker compose up --build
   ```

   Dashboard: <http://localhost:3000> · SDK bundle: <http://localhost:3000/sdk/tinyreplay.umd.js>

2. Serve this example on a different port. Python is preinstalled on most
   systems, so no npm dependency is needed:

   ```bash
   python3 -m http.server 4173 -d examples/vanilla
   ```

   Open <http://localhost:4173>.

3. Generate a session: pick assets, place a demo order, type into the masked
   fields, switch to Settings, then **wait ~5s** for the batch flush (or refresh
   / close the tab to flush now).

4. Open <http://localhost:3000>, click your session, and watch the replay.

## SDK config used

```js
TinyReplay.init({
  endpoint: 'http://localhost:3000', // server base URL; SDK posts to /api/ingest
  projectId: 'markets-demo',         // arbitrary project identifier
  debug: true,                       // logs recorded events to the console
});
```

> The SDK config keys are `endpoint` and `projectId`. The SDK derives the ingest
> URL as `${endpoint}/api/ingest` itself - you do not pass it separately.

## Privacy check

After replaying, confirm:

- The amount and notes you typed appear only as `•••••` (never the real value).
- The `data-tr-mask` email and balance show as `•••••`.
- The `data-tr-ignore` linked-bank block (account + routing) is absent entirely.
- The **network** panel lists the CoinGecko GETs and the order POST as metadata
  only - no request or response bodies.
