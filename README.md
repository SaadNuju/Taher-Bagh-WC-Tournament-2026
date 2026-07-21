# TBFOOT World Cup Tournament 2026 ⚽🏆

A cinematic, gold-and-black single-page web app for running a 32-team,
straight-knockout football tournament — official animated draw, animated
bracket, auto-progressing schedule, awards & form guide, and a
password-protected admin panel.

Built with **HTML5 + CSS3 + vanilla JavaScript + GSAP**, hosted on a
**Cloudflare Worker** (static assets + API) with a **Durable Object** for
storage, so admin edits appear live for every spectator — with zero
dashboard configuration.

## The tabs

1. **Home** — hero header with a spinning trophy, XL sponsor banner (shown
   on every tab) and four sponsor media slots (image/video, set in admin).
2. **Teams** — the 32 squads: country, registered team name, captain and
   10 players each (placeholders until confirmed).
3. **Bracket** — animated world-cup-style knockout tree (R32 → R16 → QF →
   SF → Third Place → Final), populated by the draw; winners advance
   automatically, penalty shootouts supported.
4. **Schedule** — kickoff times per round; the current round is highlighted
   automatically and the next unlocks only when every result is in —
   visitors can't flip between rounds.
5. **Awards** — Golden Boot race, Golden Glove (fewest conceded, credited
   to each team's designated goalkeeper), and a stats-driven "Favourites to
   win" section with fun daily commentary and a dark-horse pick.
6. **Draw** — admin-unlocked ceremony: ball → card reveal → team flies into
   its bracket slot. Crypto-strength random, auto-play and skip modes.
7. **Admin** — teams & squads, results with per-squad scorer dropdowns,
   kickoff times, homepage media, ticker updates, built-in visitor
   analytics, draw reset.

Also: live updates via polling (spectator phones refresh within ~15s) and
an offline/demo fallback (demo admin password: `admin`).

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
