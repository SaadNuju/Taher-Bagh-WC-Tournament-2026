/* ============================================================
   Knockout bracket rendering.
   ============================================================ */

const KnockoutView = (() => {
  const { team, esc, flagImg } = Tournament;

  function koTeamHTML(state, m, side, resolved) {
    const teamId = side === "a" ? m.teamA : m.teamB;
    const t = team(state, teamId);
    const score = side === "a" ? m.scoreA : m.scoreB;
    const pens = side === "a" ? m.pensA : m.pensB;
    const winner = Tournament.matchWinner(m);

    if (!t) {
      const label = resolved?.[side]?.label || "To be decided";
      return `<div class="ko-team tbd"><i class="fa-regular fa-circle-question"></i><span class="ko-name">${esc(label)}</span></div>`;
    }
    const cls = winner ? (winner === teamId ? "winner" : "loser") : "";
    const scoreTxt = m.status === "played"
      ? `${score}${pens != null && m.scoreA === m.scoreB ? ` (${pens})` : ""}`
      : "";
    return `
      <div class="ko-team ${cls}">
        ${flagImg(t)}
        <span class="ko-name">${esc(t.country)}</span>
        <span class="ko-score">${scoreTxt}</span>
      </div>`;
  }

  function koMatchHTML(state, m, resolvedMap, extraClass) {
    const resolved = resolvedMap[m.id];
    const labels = { r16: "Round of 16", qf: "Quarter Final", sf: "Semi Final", tp: "Third Place", final: "FINAL" };
    const label = labels[m.round] + (["r16", "qf", "sf"].includes(m.round) ? ` · Match ${m.slot}` : "");
    return `
      <div class="panel ko-match ${extraClass || ""}">
        <div class="ko-label"><span>${label}</span>${m.status === "played" ? "<span><i class='fa-solid fa-check' style='color:var(--green)'></i></span>" : ""}</div>
        ${koTeamHTML(state, m, "a", resolved)}
        ${koTeamHTML(state, m, "b", resolved)}
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("view-knockout");

    if (!state.draw.completed) {
      el.innerHTML = `
        <h2 class="section-title">Knockout Stage</h2>
        <p class="section-sub">The road to the final.</p>
        <div class="panel empty-note"><i class="fa-solid fa-sitemap"></i>
          The bracket will be built after the draw and the group stage.</div>`;
      return;
    }

    const resolvedMap = Tournament.resolveKnockout(state);
    const ko = (id) => state.matches.find((m) => m.id === id);

    const col = (ids, title) => `
      <div>
        <div class="bracket-round-title">${title}</div>
        <div class="bracket-col">
          ${ids.map((id) => koMatchHTML(state, ko(id), resolvedMap)).join("")}
        </div>
      </div>`;

    el.innerHTML = `
      <h2 class="section-title">Knockout Stage</h2>
      <p class="section-sub">Round of 16 · Quarter Finals · Semi Finals · Third Place · Final</p>
      <div class="bracket-scroll">
        <div class="bracket">
          ${col(["r16-1", "r16-2", "r16-3", "r16-4", "r16-5", "r16-6", "r16-7", "r16-8"], "Round of 16")}
          ${col(["qf-1", "qf-2", "qf-3", "qf-4"], "Quarter Finals")}
          ${col(["sf-1", "sf-2"], "Semi Finals")}
          <div class="ko-final-col">
            <div class="bracket-round-title"><i class="fa-solid fa-trophy" style="color:var(--gold)"></i> Final</div>
            ${koMatchHTML(state, ko("final"), resolvedMap, "final-match")}
            <div class="bracket-round-title">Third Place</div>
            ${koMatchHTML(state, ko("tp"), resolvedMap)}
          </div>
        </div>
      </div>`;
  }

  return { render, koMatchHTML };
})();
