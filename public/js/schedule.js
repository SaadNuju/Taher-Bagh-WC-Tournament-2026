/* ============================================================
   Schedule view — one sub-section per round. The current round
   is highlighted automatically; finished rounds collapse to
   results; future rounds stay locked. Visitors cannot switch
   rounds manually.
   ============================================================ */

const ScheduleView = (() => {
  const { esc, team, flagImg } = Tournament;

  function kickoffHTML(m) {
    if (!m.kickoff) return `<span class="sch-time tbd"><i class="fa-regular fa-clock"></i> Time TBC</span>`;
    const d = new Date(m.kickoff);
    const day = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `<span class="sch-time"><i class="fa-regular fa-clock"></i> ${day} · ${time}</span>`;
  }

  function matchRowHTML(state, labels, m) {
    const a = team(state, m.teamA);
    const b = team(state, m.teamB);
    const nameA = a ? a.country : (state.draw.completed ? labels[m.id]?.a || "TBD" : "TBD");
    const nameB = b ? b.country : (state.draw.completed ? labels[m.id]?.b || "TBD" : "TBD");
    const played = m.status === "played";
    const pens = played && m.pensA != null && m.scoreA === m.scoreB
      ? `<div class="fx-pens"><i class="fa-solid fa-bullseye"></i> Penalties ${m.pensA} - ${m.pensB}</div>` : "";
    return `
      <div class="sch-row ${played ? "played" : ""}">
        <span class="sch-mnum">M${m.slot}</span>
        <div class="fx-team">${a ? flagImg(a) : ""}<span>${esc(nameA)}</span></div>
        <div class="fx-score ${played ? "" : "pending"}">${played ? `${m.scoreA} - ${m.scoreB}` : "VS"}</div>
        <div class="fx-team right"><span>${esc(nameB)}</span>${b ? flagImg(b) : ""}</div>
        ${kickoffHTML(m)}
        ${pens}
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("view-schedule");
    const labels = Tournament.resolveBracket(state);
    const current = Tournament.currentRound(state);
    const champId = Tournament.champion(state);

    // tp shares the stage with the final
    const stageOf = (round) => (round === "tp" ? "final" : round);
    const currentIdx = Tournament.PROGRESSION.indexOf(current);

    const sections = Tournament.ROUNDS.map(({ round, label }) => {
      const idx = Tournament.PROGRESSION.indexOf(stageOf(round));
      const stateCls = idx < currentIdx ? "done" : idx === currentIdx ? "live" : "locked";
      const rows = Tournament.roundMatches(state, round)
        .map((m) => matchRowHTML(state, labels, m)).join("");
      const badge = stateCls === "live"
        ? '<span class="sch-badge live-badge"><span class="live-dot"></span> CURRENT ROUND</span>'
        : stateCls === "done"
          ? '<span class="sch-badge done-badge"><i class="fa-solid fa-check"></i> COMPLETE</span>'
          : `<span class="sch-badge lock-badge"><i class="fa-solid fa-lock"></i> UNLOCKS LATER</span>`;
      return `
        <section class="panel sch-round ${stateCls}">
          <div class="sch-head">
            <h3>${label.toUpperCase()}</h3>
            ${badge}
          </div>
          <div class="sch-body">${rows}</div>
        </section>`;
    }).join("");

    el.innerHTML = `
      <h2 class="section-title">Match Schedule</h2>
      <p class="section-sub">${champId
        ? "The tournament is complete — thank you for a great World Cup!"
        : "The current round is highlighted — the next round unlocks when every result is in."}</p>
      <div class="sch-wrap">${sections}</div>`;

    // Bring the live round into view and animate it in.
    const live = el.querySelector(".sch-round.live");
    if (window.gsap && live) {
      gsap.from(live, { scale: 0.98, opacity: 0.6, duration: 0.5, ease: "power2.out" });
    }
  }

  return { render };
})();
