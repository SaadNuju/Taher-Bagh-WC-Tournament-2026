/* ============================================================
   Tournament statistics view — podium, awards, Golden Boot.
   ============================================================ */

const StatsView = (() => {
  const { team, esc, flagImg } = Tournament;

  function autoPodium(state) {
    // Champion / runner-up / third place fall out of the bracket
    // automatically; explicit admin awards override them.
    const final = state.matches.find((m) => m.id === "final");
    const tp = state.matches.find((m) => m.id === "tp");
    return {
      champion: state.awards.champion || Tournament.matchWinner(final),
      runnerUp: state.awards.runnerUp || Tournament.matchLoser(final),
      thirdPlace: state.awards.thirdPlace || Tournament.matchWinner(tp),
    };
  }

  function podiumCardHTML(state, teamId, title, icon, cls) {
    const t = team(state, teamId);
    return `
      <div class="panel podium-card ${cls}">
        <div class="podium-icon"><i class="${icon}"></i></div>
        <div class="podium-title">${title}</div>
        <div class="podium-team">${t ? esc(t.country) : "—"}</div>
        ${t ? flagImg(t) : ""}
        ${t ? `<div class="card-team" style="margin-top:6px;color:var(--gold);font-size:.72rem;letter-spacing:2px">${esc(t.teamName)}</div>` : ""}
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("view-stats");
    if (state.draw && state.draw.completed) Tournament.resolveKnockout(state);
    const podium = autoPodium(state);
    const scorers = Tournament.topScorers(state).slice(0, 10);

    const scorerRows = scorers.map((s, i) => {
      const t = team(state, s.teamId);
      return `
        <div class="scorer-row">
          <span class="rank">${i + 1}</span>
          ${t ? flagImg(t) : ""}
          <span>${esc(s.name)}</span>
          <span class="scorer-team">${t ? esc(t.country) : ""}</span>
          <span class="goals">${s.goals} <i class="fa-solid fa-futbol" style="font-size:.7rem"></i></span>
        </div>`;
    }).join("");

    el.innerHTML = `
      <h2 class="section-title">Tournament Statistics</h2>
      <p class="section-sub">Honours, awards and the Golden Boot race.</p>

      <div class="podium-grid">
        ${podiumCardHTML(state, podium.champion, "Champion", "fa-solid fa-trophy", "gold-card")}
        ${podiumCardHTML(state, podium.runnerUp, "Runner-up", "fa-solid fa-medal", "silver-card")}
        ${podiumCardHTML(state, podium.thirdPlace, "Third Place", "fa-solid fa-award", "bronze-card")}
      </div>

      <div class="awards-grid">
        <div class="panel award-card">
          <div class="award-icon"><i class="fa-solid fa-star"></i></div>
          <div>
            <div class="award-title">Player of the Tournament</div>
            <div class="award-value">${esc(state.awards.playerOfTournament || "To be announced")}</div>
          </div>
        </div>
        <div class="panel award-card">
          <div class="award-icon"><i class="fa-solid fa-hand"></i></div>
          <div>
            <div class="award-title">Best Goalkeeper</div>
            <div class="award-value">${esc(state.awards.bestGoalkeeper || "To be announced")}</div>
          </div>
        </div>
      </div>

      <div class="panel scorers-panel">
        <div class="group-head" style="--accent: var(--gold)">GOLDEN BOOT · TOP SCORERS</div>
        ${scorerRows || `<div class="empty-note"><i class="fa-solid fa-futbol"></i>No goals recorded yet.</div>`}
      </div>`;
  }

  return { render };
})();
