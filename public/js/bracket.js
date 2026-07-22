/* ============================================================
   Tournament logic (pure functions) + the animated Bracket view.
   Straight 32-team knockout: R32 → R16 → QF → SF → 3rd → Final.
   Loaded before the other feature modules, which reuse these
   helpers via the global `Tournament`.
   ============================================================ */

const Tournament = (() => {

  const ROUNDS = [
    { round: "r32", label: "Round of 32", count: 16 },
    { round: "r16", label: "Round of 16", count: 8 },
    { round: "qf", label: "Quarter Finals", count: 4 },
    { round: "sf", label: "Semi Finals", count: 2 },
    { round: "tp", label: "Third Place", count: 1 },
    { round: "final", label: "Final", count: 1 },
  ];

  // Rounds in elimination order (3rd place sits alongside the final).
  const PROGRESSION = ["r32", "r16", "qf", "sf", "final"];

  function team(state, id) {
    return state.teams.find((t) => t.id === id) || null;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function flagImg(t, cls) {
    if (!t) return "";
    return `<img class="${cls || ""}" src="${esc(t.flag)}" alt="${esc(t.country)} flag">`;
  }

  function match(state, id) {
    return state.matches.find((m) => m.id === id);
  }

  function roundMatches(state, round) {
    return state.matches.filter((m) => m.round === round)
      .sort((a, b) => a.slot - b.slot);
  }

  function matchWinner(m) {
    if (!m || m.status !== "played" || m.teamA == null || m.teamB == null) return null;
    if (m.scoreA > m.scoreB) return m.teamA;
    if (m.scoreB > m.scoreA) return m.teamB;
    if (m.pensA != null && m.pensB != null && m.pensA !== m.pensB) {
      return m.pensA > m.pensB ? m.teamA : m.teamB;
    }
    return null;
  }

  function matchLoser(m) {
    const w = matchWinner(m);
    if (!w) return null;
    return w === m.teamA ? m.teamB : m.teamA;
  }

  /**
   * Fills teamA/teamB across the whole bracket from the draw order and
   * played results (in memory), and returns a map of placeholder labels
   * for undecided slots.
   */
  function resolveBracket(state) {
    const labels = {};
    const order = state.draw.bracketOrder || [];

    for (let i = 1; i <= 16; i++) {
      const m = match(state, `r32-${i}`);
      if (!m) continue;
      m.teamA = state.draw.completed ? order[i * 2 - 2] ?? null : null;
      m.teamB = state.draw.completed ? order[i * 2 - 1] ?? null : null;
      labels[m.id] = { a: "Draw pending", b: "Draw pending" };
    }

    const feed = (srcRound, srcCount, destRound, want) => {
      for (let i = 1; i <= srcCount / 2; i++) {
        const dest = match(state, srcCount === 2 ? destRound : `${destRound}-${i}`);
        if (!dest) continue;
        const srcA = match(state, `${srcRound}-${i * 2 - 1}`);
        const srcB = match(state, `${srcRound}-${i * 2}`);
        const pick = want === "winner" ? matchWinner : matchLoser;
        dest.teamA = pick(srcA);
        dest.teamB = pick(srcB);
        const name = ROUNDS.find((r) => r.round === srcRound).label;
        labels[dest.id] = {
          a: `${want === "winner" ? "Winner" : "Loser"} ${name} · Match ${srcA?.slot}`,
          b: `${want === "winner" ? "Winner" : "Loser"} ${name} · Match ${srcB?.slot}`,
        };
      }
    };

    feed("r32", 16, "r16", "winner");
    feed("r16", 8, "qf", "winner");
    feed("qf", 4, "sf", "winner");
    feed("sf", 2, "final", "winner");
    feed("sf", 2, "tp", "loser");
    return labels;
  }

  function roundComplete(state, round) {
    const ms = roundMatches(state, round);
    return ms.length > 0 && ms.every((m) => m.status === "played");
  }

  /** First unfinished round in elimination order ("r32" before the draw). */
  function currentRound(state) {
    if (!state.draw.completed) return "r32";
    for (const r of PROGRESSION) {
      if (!roundComplete(state, r)) return r;
    }
    return "final";
  }

  function champion(state) {
    resolveBracket(state);
    return matchWinner(match(state, "final"));
  }

  /* ---------- Statistics ---------- */

  function topScorers(state) {
    const tally = {};
    for (const m of state.matches) {
      for (const s of m.scorers || []) {
        const key = `${s.teamId}|${(s.name || "").trim().toLowerCase()}`;
        if (!tally[key]) tally[key] = { name: (s.name || "").trim(), teamId: s.teamId, goals: 0 };
        tally[key].goals += Number(s.count) || 0;
      }
    }
    return Object.values(tally)
      .filter((s) => s.goals > 0 && s.name)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
  }

  /** Per-team record: played, wins, goals for/against, conceded per match. */
  function teamRecords(state) {
    resolveBracket(state);
    const rec = {};
    const get = (id) => rec[id] || (rec[id] = { teamId: id, played: 0, wins: 0, gf: 0, ga: 0 });
    for (const m of state.matches) {
      if (m.status !== "played" || !m.teamA || !m.teamB) continue;
      const a = get(m.teamA), b = get(m.teamB);
      a.played++; b.played++;
      a.gf += m.scoreA; a.ga += m.scoreB;
      b.gf += m.scoreB; b.ga += m.scoreA;
      const w = matchWinner(m);
      if (w) get(w).wins++;
    }
    return Object.values(rec);
  }

  /** Golden Glove table: fewest conceded per match, then most wins. */
  function goldenGlove(state) {
    return teamRecords(state)
      .filter((r) => r.played > 0)
      .map((r) => ({ ...r, concededPerMatch: r.ga / r.played }))
      .sort((x, y) => x.concededPerMatch - y.concededPerMatch || y.wins - x.wins || y.gf - x.gf);
  }

  /** Teams still alive in the bracket. */
  function aliveTeams(state) {
    if (!state.draw.completed) return state.teams.map((t) => t.id);
    resolveBracket(state);
    const eliminated = new Set();
    for (const m of state.matches) {
      if (m.round === "tp") continue;
      const l = matchLoser(m);
      if (l) eliminated.add(l);
    }
    return state.draw.bracketOrder.filter((id) => !eliminated.has(id));
  }

  /** Power ranking of surviving teams (wins, GD, goals scored). */
  function powerRanking(state) {
    const records = Object.fromEntries(teamRecords(state).map((r) => [r.teamId, r]));
    return aliveTeams(state)
      .map((id) => {
        const r = records[id] || { played: 0, wins: 0, gf: 0, ga: 0 };
        return { teamId: id, ...r, score: r.wins * 3 + (r.gf - r.ga) + r.gf * 0.1 };
      })
      .sort((a, b) => b.score - a.score);
  }

  /** Deterministic per-day random pick (stable until midnight). */
  function dailyPick(list, salt) {
    if (!list.length) return null;
    const day = new Date().toISOString().slice(0, 10) + (salt || "");
    let h = 0;
    for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return list[h % list.length];
  }

  return {
    ROUNDS, PROGRESSION,
    team, esc, flagImg, match, roundMatches,
    matchWinner, matchLoser, resolveBracket, roundComplete, currentRound, champion,
    topScorers, teamRecords, goldenGlove, aliveTeams, powerRanking, dailyPick,
  };
})();

/* ============================================================
   Bracket view — world-cup style tree: two halves converging
   on the final in the centre.
   ============================================================ */

const BracketView = (() => {
  const { team, esc, flagImg } = Tournament;

  function sideHTML(state, labels, m, side) {
    const teamId = side === "a" ? m.teamA : m.teamB;
    const t = team(state, teamId);
    const winner = Tournament.matchWinner(m);
    if (!t) {
      const label = state.draw.completed ? (labels[m.id]?.[side] || "TBD") : "Awaiting draw";
      return `<div class="bk-team tbd"><span class="bk-name">${esc(label)}</span></div>`;
    }
    const score = side === "a" ? m.scoreA : m.scoreB;
    const pens = side === "a" ? m.pensA : m.pensB;
    const cls = winner ? (winner === teamId ? "winner" : "loser") : "";
    const scoreTxt = m.status === "played"
      ? `${score}${pens != null && m.scoreA === m.scoreB ? ` <small>(${pens})</small>` : ""}`
      : "";
    return `
      <div class="bk-team ${cls}">
        ${flagImg(t)}
        <span class="bk-name">
          <span class="bk-country">${esc(t.country)}</span>
          <span class="bk-teamname">${esc(t.teamName)}</span>
        </span>
        <span class="bk-score">${scoreTxt}</span>
      </div>`;
  }

  function matchHTML(state, labels, m, extra) {
    return `
      <div class="bk-match ${extra || ""}" data-bk="${m.id}">
        <div class="bk-tag">M${m.slot}</div>
        ${sideHTML(state, labels, m, "a")}
        ${sideHTML(state, labels, m, "b")}
      </div>`;
  }

  function colHTML(state, labels, matches, cls) {
    return `<div class="bk-col ${cls}">${matches.map((m) => matchHTML(state, labels, m)).join("")}</div>`;
  }

  function render(state) {
    const el = document.getElementById("view-bracket");
    const labels = Tournament.resolveBracket(state);
    const r = (round, from, to) => Tournament.roundMatches(state, round).slice(from, to);
    const champId = Tournament.champion(state);
    const champ = team(state, champId);
    const final = Tournament.match(state, "final");
    const third = Tournament.match(state, "tp");

    el.innerHTML = `
      <h2 class="section-title">Fixtures Bracket</h2>
      <p class="section-sub">32 teams · knockout · one match, one chance</p>

      <!-- Centre stage: Final, Champion and the spinning trophy -->
      <div class="bk-hero">
        <img class="bk-trophy" src="assets/trophy.svg" alt="" aria-hidden="true">
        <div class="bk-hero-inner">
          <div class="bk-final-label"><i class="fa-solid fa-star"></i> FINAL <i class="fa-solid fa-star"></i></div>
          ${matchHTML(state, labels, final, "bk-final")}
          <div class="bk-champion ${champ ? "crowned" : ""}">
            <div class="bk-champ-label">CHAMPION</div>
            <div class="bk-champ-team">${champ ? `${flagImg(champ)} ${esc(champ.country)}` : '<i class="fa-solid fa-star"></i>'}</div>
          </div>
          <div class="bk-third">
            <div class="bk-third-label">THIRD PLACE</div>
            ${matchHTML(state, labels, third, "bk-third-match")}
          </div>
        </div>
      </div>

      <p class="section-sub" style="margin-top:26px">The road to the final</p>
      <div class="bracket-scroll">
        <div class="bk-tree">
          ${colHTML(state, labels, r("r32", 0, 8), "bk-left")}
          ${colHTML(state, labels, r("r16", 0, 4), "bk-left")}
          ${colHTML(state, labels, r("qf", 0, 2), "bk-left")}
          ${colHTML(state, labels, r("sf", 0, 1), "bk-left")}
          <div class="bk-col bk-spacer"><div class="bk-spacer-line"></div></div>
          ${colHTML(state, labels, r("sf", 1, 2), "bk-right")}
          ${colHTML(state, labels, r("qf", 2, 4), "bk-right")}
          ${colHTML(state, labels, r("r16", 4, 8), "bk-right")}
          ${colHTML(state, labels, r("r32", 8, 16), "bk-right")}
        </div>
      </div>
      ${state.draw.completed ? "" : `
        <p class="center mt-20"><a class="btn-gold" href="#draw"><i class="fa-solid fa-shuffle"></i> RUN THE OFFICIAL DRAW</a></p>`}
    `;

    // Entrance animation: hero lifts in, columns cascade from the outside.
    if (window.gsap) {
      gsap.from(".bk-hero-inner > *", { opacity: 0, y: 16, duration: 0.5, stagger: 0.08, ease: "power2.out" });
      gsap.from(".bk-match", {
        opacity: 0, scale: 0.9, y: 12,
        duration: 0.45, ease: "power2.out",
        stagger: { each: 0.02, from: "edges" },
      });
    }
  }

  return { render };
})();
