/* ============================================================
   Tournament logic (pure functions) + Groups view rendering.
   Loaded before the other feature modules, which reuse the
   helpers defined here.
   ============================================================ */

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const Tournament = (() => {

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

  /* ---------- Fixtures ---------- */

  // Standard 4-team round robin: 3 matchdays, 2 matches each.
  const GROUP_PAIRINGS = [
    [[0, 1], [2, 3]], // MD1
    [[0, 2], [3, 1]], // MD2
    [[3, 0], [1, 2]], // MD3
  ];

  function generateGroupMatches(draw) {
    const matches = [];
    for (const letter of GROUP_LETTERS) {
      const ids = draw.groups[letter];
      GROUP_PAIRINGS.forEach((day, mdIdx) => {
        day.forEach(([a, b], i) => {
          matches.push({
            id: `g-${letter}-${mdIdx * 2 + i + 1}`,
            stage: "group",
            group: letter,
            md: mdIdx + 1,
            teamA: ids[a],
            teamB: ids[b],
            scoreA: null,
            scoreB: null,
            scorers: [],
            status: "scheduled",
          });
        });
      });
    }
    return matches;
  }

  const KO_ROUNDS = [
    { round: "r16", label: "Round of 16", count: 8 },
    { round: "qf", label: "Quarter Finals", count: 4 },
    { round: "sf", label: "Semi Finals", count: 2 },
    { round: "tp", label: "Third Place", count: 1 },
    { round: "final", label: "Final", count: 1 },
  ];

  function generateKnockoutSkeleton() {
    const matches = [];
    for (const { round, count } of KO_ROUNDS) {
      for (let i = 1; i <= count; i++) {
        matches.push({
          id: count === 1 ? round : `${round}-${i}`,
          stage: "knockout",
          round,
          slot: i,
          teamA: null,
          teamB: null,
          scoreA: null,
          scoreB: null,
          pensA: null,
          pensB: null,
          scorers: [],
          status: "scheduled",
        });
      }
    }
    return matches;
  }

  /* ---------- Standings ---------- */

  function groupMatches(state, letter) {
    return state.matches.filter((m) => m.stage === "group" && m.group === letter);
  }

  function computeStandings(state, letter) {
    const ids = state.draw.groups[letter] || [];
    const rows = ids.map((id) => ({
      teamId: id, played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, pts: 0,
    }));
    const byId = Object.fromEntries(rows.map((r) => [r.teamId, r]));

    const played = groupMatches(state, letter).filter((m) => m.status === "played");
    for (const m of played) {
      const a = byId[m.teamA], b = byId[m.teamB];
      if (!a || !b) continue;
      a.played++; b.played++;
      a.gf += m.scoreA; a.ga += m.scoreB;
      b.gf += m.scoreB; b.ga += m.scoreA;
      if (m.scoreA > m.scoreB) { a.won++; b.lost++; a.pts += 3; }
      else if (m.scoreA < m.scoreB) { b.won++; a.lost++; b.pts += 3; }
      else { a.drawn++; b.drawn++; a.pts++; b.pts++; }
    }
    for (const r of rows) r.gd = r.gf - r.ga;

    // Head-to-head points between two teams (used as a tiebreaker).
    function h2h(idA, idB) {
      let pts = 0;
      for (const m of played) {
        if (m.teamA === idA && m.teamB === idB) {
          pts += m.scoreA > m.scoreB ? 3 : m.scoreA === m.scoreB ? 1 : 0;
        } else if (m.teamB === idA && m.teamA === idB) {
          pts += m.scoreB > m.scoreA ? 3 : m.scoreA === m.scoreB ? 1 : 0;
        }
      }
      return pts;
    }

    rows.sort((x, y) =>
      y.pts - x.pts || y.gd - x.gd || y.gf - x.gf ||
      h2h(y.teamId, x.teamId) - h2h(x.teamId, y.teamId) ||
      (team(state, x.teamId)?.country || "").localeCompare(team(state, y.teamId)?.country || "")
    );
    return rows;
  }

  function groupComplete(state, letter) {
    const ms = groupMatches(state, letter);
    return ms.length === 6 && ms.every((m) => m.status === "played");
  }

  function allGroupsComplete(state) {
    return state.draw.completed && GROUP_LETTERS.every((l) => groupComplete(state, l));
  }

  /* ---------- Knockout resolution ---------- */

  // FIFA bracket: winners/runners-up cross over between paired groups.
  const R16_SEEDS = [
    ["A", 1, "B", 2], ["C", 1, "D", 2], ["E", 1, "F", 2], ["G", 1, "H", 2],
    ["B", 1, "A", 2], ["D", 1, "C", 2], ["F", 1, "E", 2], ["H", 1, "G", 2],
  ];

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
   * Returns knockout matches with teamA/teamB filled in from group
   * results and earlier-round winners, plus a placeholder label for
   * slots that are not yet decided. Non-destructive.
   */
  function resolveKnockout(state) {
    const get = (id) => state.matches.find((m) => m.id === id);
    const resolved = {};

    const standingsCache = {};
    function seed(letter, pos) {
      if (!groupComplete(state, letter)) return { teamId: null, label: `${pos === 1 ? "Winner" : "Runner-up"} Group ${letter}` };
      standingsCache[letter] = standingsCache[letter] || computeStandings(state, letter);
      return { teamId: standingsCache[letter][pos - 1].teamId, label: null };
    }

    function fromMatch(id, want) {
      const src = get(id);
      const teamId = want === "winner" ? matchWinner(src) : matchLoser(src);
      const name = { r16: "R16", qf: "QF", sf: "SF" }[src?.round] || (src?.id || "").toUpperCase();
      return {
        teamId,
        label: teamId ? null : `${want === "winner" ? "Winner" : "Loser"} ${name} ${src?.slot || ""}`.trim(),
      };
    }

    R16_SEEDS.forEach(([gA, pA, gB, pB], i) => {
      resolved[`r16-${i + 1}`] = { a: seed(gA, pA), b: seed(gB, pB) };
    });
    for (let i = 1; i <= 4; i++) {
      resolved[`qf-${i}`] = {
        a: fromMatch(`r16-${i * 2 - 1}`, "winner"),
        b: fromMatch(`r16-${i * 2}`, "winner"),
      };
    }
    for (let i = 1; i <= 2; i++) {
      resolved[`sf-${i}`] = {
        a: fromMatch(`qf-${i * 2 - 1}`, "winner"),
        b: fromMatch(`qf-${i * 2}`, "winner"),
      };
    }
    resolved["tp"] = { a: fromMatch("sf-1", "loser"), b: fromMatch("sf-2", "loser") };
    resolved["final"] = { a: fromMatch("sf-1", "winner"), b: fromMatch("sf-2", "winner") };

    // Sync resolved teams onto the stored match objects (in memory) so
    // winner computation and admin score entry always see current teams.
    for (const [id, r] of Object.entries(resolved)) {
      const m = get(id);
      if (m) { m.teamA = r.a.teamId; m.teamB = r.b.teamId; }
    }
    return resolved;
  }

  /* ---------- Scorers ---------- */

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

  return {
    team, esc, flagImg,
    generateGroupMatches, generateKnockoutSkeleton,
    groupMatches, computeStandings, groupComplete, allGroupsComplete,
    matchWinner, matchLoser, resolveKnockout, topScorers,
    KO_ROUNDS,
  };
})();

/* ============================================================
   Groups view rendering
   ============================================================ */

const GroupsView = (() => {
  const { team, esc, flagImg } = Tournament;

  function fixtureRowHTML(state, m, resolvedLabels) {
    const a = team(state, m.teamA);
    const b = team(state, m.teamB);
    const labelA = a ? esc(a.country) : esc(resolvedLabels?.a?.label || "TBD");
    const labelB = b ? esc(b.country) : esc(resolvedLabels?.b?.label || "TBD");
    const played = m.status === "played";
    let score = played ? `${m.scoreA} - ${m.scoreB}` : "VS";
    let pens = "";
    if (played && m.pensA != null && m.pensB != null && m.scoreA === m.scoreB) {
      pens = `<div class="fx-pens"><i class="fa-solid fa-bullseye"></i> Penalties ${m.pensA} - ${m.pensB}</div>`;
    }
    return `
      <div class="fixture-row">
        <div class="fx-team">${a ? flagImg(a) : ""}<span>${labelA}</span></div>
        <div class="fx-score ${played ? "" : "pending"}">${score}</div>
        <div class="fx-team right"><span>${labelB}</span>${b ? flagImg(b) : ""}</div>
        ${pens}
      </div>`;
  }

  function standingsTableHTML(state, letter) {
    const rows = Tournament.computeStandings(state, letter);
    const anyPlayed = rows.some((r) => r.played > 0);
    const complete = Tournament.groupComplete(state, letter);
    const body = rows.map((r, i) => {
      const t = team(state, r.teamId);
      const qualified = complete && i < 2;
      return `
        <tr class="${qualified ? "qualified" : ""}">
          <td>${i + 1}</td>
          <td class="col-team">${flagImg(t)}${esc(t?.country || "?")}</td>
          <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
          <td>${r.gf}</td><td>${r.ga}</td><td>${r.gd > 0 ? "+" + r.gd : r.gd}</td>
          <td class="col-pts">${r.pts}</td>
        </tr>`;
    }).join("");
    return `
      <table class="standings-table" aria-label="Group ${letter} standings">
        <thead>
          <tr><th>#</th><th class="col-team">Team</th><th>P</th><th>W</th><th>D</th>
          <th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      ${anyPlayed && !complete ? "" : ""}`;
  }

  function render(state) {
    const el = document.getElementById("view-groups");
    if (!state.draw.completed) {
      el.innerHTML = `
        <h2 class="section-title">Groups &amp; Points</h2>
        <p class="section-sub">Group standings will appear here once the official draw is complete.</p>
        <div class="panel empty-note"><i class="fa-solid fa-shuffle"></i>
          The official draw has not taken place yet.<br>
          <a class="btn-outline mt-20" href="#draw" style="margin-top:18px"><i class="fa-solid fa-arrow-right"></i> Go to the Draw</a>
        </div>`;
      return;
    }

    const panels = GROUP_LETTERS.map((letter) => {
      const fixtures = Tournament.groupMatches(state, letter)
        .sort((a, b) => a.md - b.md || a.id.localeCompare(b.id))
        .map((m) => fixtureRowHTML(state, m))
        .join("");
      return `
        <div class="panel group-panel">
          <div class="group-head" style="--accent: var(--group-${letter.toLowerCase()})">GROUP ${letter}</div>
          ${standingsTableHTML(state, letter)}
          <div class="fixtures-title">Fixtures</div>
          ${fixtures}
        </div>`;
    }).join("");

    el.innerHTML = `
      <h2 class="section-title">Groups &amp; Points</h2>
      <p class="section-sub">Top two teams in each group qualify for the Round of 16 · Tiebreakers: points, goal difference, goals for, head-to-head</p>
      <div class="groups-page-grid">${panels}</div>`;
  }

  return { render, fixtureRowHTML, standingsTableHTML };
})();
