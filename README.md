# Taher Bagh World Cup Tournament 2026 ⚽🏆

A cinematic, gold-and-black single-page web app for running a 32-team,
World Cup style football tournament — official animated draw, live group
standings, knockout bracket, Golden Boot race, and a password-protected
admin panel.

Built with **HTML5 + CSS3 + vanilla JavaScript + GSAP**, hosted on
**Cloudflare Pages** with **Pages Functions + Workers KV** so admin edits
appear live for every spectator.

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

## Deploying to Cloudflare (project: `taher-bagh-tournament`)

One-time setup, all in the Cloudflare dashboard:

1. **Create the Pages project** — Cloudflare dashboard → *Workers & Pages*
   → *Create* → *Pages* → *Connect to Git* → select this GitHub repo.
   Name the project **`taher-bagh-tournament`**. Framework preset: *None*,
   build command: *(leave empty)*, output directory: `/`.
2. **Create the KV namespace** — *Workers & Pages* → *KV* → *Create
   namespace* → name it `TOURNAMENT_KV`.
3. **Bind the namespace** — in the Pages project → *Settings* →
   *Bindings* → *Add* → *KV namespace* → variable name **`TOURNAMENT_KV`**,
   select the namespace you created. (Or update the `id` in `wrangler.toml`.)
4. **Set the admin password** — Pages project → *Settings* →
   *Variables and Secrets* → add a **secret** named **`ADMIN_PASSWORD`**
   with your chosen password.
5. **Redeploy** (Deployments → Retry) so the bindings take effect.

Every push to the repo's production branch now auto-deploys the site at
`https://taher-bagh-tournament.pages.dev`.

## Local development

```bash
cp .dev.vars.example .dev.vars     # set your local admin password
npx wrangler pages dev .           # serves the site + API with a local KV
```

Opening `index.html` directly (or any static server) also works — the app
detects the missing API and switches to demo mode.

## Sponsors

Sponsor slots scroll in the banner under the header.

1. Drop logo images into `assets/sponsors/` (PNG/SVG, ~120×60 works well).
2. Edit `data/sponsors.json`:

```json
[
  { "name": "Sponsor Name", "image": "assets/sponsors/logo.png" },
  { "name": "Text-only sponsor", "image": null }
]
```

## Project structure

```
├── index.html            App shell (views are rendered by JS)
├── css/                  variables / style / animations / responsive
├── js/
│   ├── api.js            Cloudflare API client + demo-mode fallback
│   ├── app.js            Router, home view, ticker, sounds, polling
│   ├── draw.js           Draw ceremony engine (GSAP)
│   ├── groups.js         Tournament logic + groups view
│   ├── knockout.js       Bracket resolution + rendering
│   ├── stats.js          Podium, awards, Golden Boot
│   └── admin.js          Admin panel
├── functions/api/        Pages Functions: state.js, login.js, _auth.js
├── data/                 countries, default state, sponsors
└── assets/flags/         32 country flag SVGs (from lipis/flag-icons, MIT)
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
