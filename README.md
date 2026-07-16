# Taher Bagh World Cup Tournament 2026 ⚽🏆

A cinematic, gold-and-black single-page web app for running a 32-team,
World Cup style football tournament — official animated draw, live group
standings, knockout bracket, Golden Boot race, and a password-protected
admin panel.

Built with **HTML5 + CSS3 + vanilla JavaScript + GSAP**, hosted on a
**Cloudflare Worker** (static assets + API) with a **Durable Object** for
storage, so admin edits appear live for every spectator — with zero
dashboard configuration.

## Features

- **Official Draw** — animated ceremony: ball on a pedestal, card reveal,
  team flies into its group, confetti finale. Fully random (crypto-strength
  shuffle), admin-gated, with auto-play and skip modes.
- **Groups & Points** — all 48 group fixtures are generated automatically
  from the draw. Standings (P/W/D/L/GF/GA/GD/Pts) are computed from the
  scores — never typed by hand. Tiebreakers: points → goal difference →
  goals for → head-to-head.
- **Knockout** — Round of 16 seeds itself from the final group tables
  (1A v 2B, 1C v 2D, …), then QF → SF → Third Place → Final fill in
  automatically as winners are decided. Penalty shootouts supported.
- **Stats** — champion podium, Player of the Tournament, Best Goalkeeper,
  and a live Golden Boot top-scorer table built from the entered scorers.
- **Admin panel** — password protected. Edit team names, captains and
  player lists; enter scores and goal scorers; set awards; post updates to
  the LIVE ticker; reset the draw.
- **Live updates** — spectators' phones poll the API every 15 seconds; an
  admin edit shows up everywhere within moments.
- **Offline/demo fallback** — opened without a backend, the site runs in
  demo mode from `data/default-state.json` + localStorage (demo admin
  password: `admin`).

## Deployment (Worker: `taher-bagh-tournament`)

The repo is connected to a Cloudflare Worker via git integration —
**every push to `main` deploys automatically**. There is nothing to
configure in the dashboard:

- The static site is uploaded from `public/`.
- The API (`src/worker.js`) and the Durable Object that stores the
  tournament state are declared in `wrangler.toml` and created on deploy.
- Only a **SHA-256 hash** of the organiser password is stored
  (`[vars] ADMIN_PASSWORD_HASH` in `wrangler.toml`) — the password itself
  never appears in the repo. To change it, run
  `printf '%s' 'new-password' | sha256sum`, paste the hash into that line,
  and push.

The site is served at `https://taher-bagh-tournament.<your-account>.workers.dev`
(see the Worker's overview page for the exact URL, or add a custom domain
under *Worker → Domains*).

> Note: if a `TOURNAMENT_KV` namespace was created during earlier setup,
> it is unused and can be deleted — storage is handled by the Durable
> Object.

## Local development

```bash
npm install
npm run dev        # wrangler dev — serves the site + API with a local DO
```

The local admin password comes from `.dev.vars` (overrides `wrangler.toml`).
Opening `index.html` directly (or any static server) also works — the app
detects the missing API and switches to demo mode (password `admin`).

## Sponsors

Sponsor slots scroll in the banner under the header.

1. Drop logo images into `public/assets/sponsors/` (PNG/SVG, ~120×60 works well).
2. Edit `public/data/sponsors.json`:

```json
[
  { "name": "Sponsor Name", "image": "assets/sponsors/logo.png" },
  { "name": "Text-only sponsor", "image": null }
]
```

## Project structure

```
├── public/               The static site (served as-is)
│   ├── index.html        App shell (views are rendered by JS)
│   ├── css/              variables / style / animations / responsive
│   ├── js/
│   │   ├── api.js        API client + demo-mode fallback
│   │   ├── app.js        Router, home view, ticker, sounds, polling
│   │   ├── draw.js       Draw ceremony engine (GSAP)
│   │   ├── groups.js     Tournament logic + groups view
│   │   ├── knockout.js   Bracket resolution + rendering
│   │   ├── stats.js      Podium, awards, Golden Boot
│   │   └── admin.js      Admin panel
│   ├── data/             countries, default state, sponsors
│   └── assets/flags/     32 country flag SVGs (from lipis/flag-icons, MIT)
├── src/                  Worker: worker.js (API + Durable Object), auth.js
└── wrangler.toml         Worker config: assets, DO binding, admin password
```

## Admin quick guide (tournament day)

1. Open `/#admin`, log in with your `ADMIN_PASSWORD`.
2. **Before Monday:** *Teams* tab — replace the placeholder team names with
   the real registered teams, captains and squads.
3. **Draw ceremony:** go to *Draw*, unlock with the password, and run it on
   the big screen — fixtures generate themselves.
4. **During matches:** *Matches* tab — enter the score and scorers, hit
   *Save result*. Standings, bracket and Golden Boot update everywhere.
5. **After the final:** *Awards* tab — Player of the Tournament and Best
   Goalkeeper (champion/runner-up/third fill in automatically from the
   bracket).
