/* ============================================================
   Teams view — public gallery of all 32 squads.
   ============================================================ */

const TeamsView = (() => {
  const { esc, flagImg } = Tournament;

  function cardHTML(t, idx) {
    const players = (t.players || []).map((p, i) => `
      <li class="squad-player ${p === t.goalkeeper ? "is-gk" : ""}">
        <span class="squad-num">${i + 1}</span>
        <span>${esc(p)}</span>
        ${p === t.goalkeeper ? '<span class="gk-chip" title="Goalkeeper"><i class="fa-solid fa-hand"></i> GK</span>' : ""}
      </li>`).join("");
    return `
      <details class="panel team-tile" style="--tile-i:${idx}">
        <summary>
          <div class="tile-flag">${flagImg(t)}</div>
          <div class="tile-names">
            <div class="tile-country">${esc(t.country)}</div>
            <div class="tile-team">${esc(t.teamName)}</div>
          </div>
          <div class="tile-captain">
            <span class="tile-cap-label"><i class="fa-solid fa-star"></i> CAPTAIN</span>
            <span>${esc(t.captain || "TBC")}</span>
          </div>
          <i class="fa-solid fa-chevron-down tile-chev"></i>
        </summary>
        <ul class="squad-list">${players || '<li class="squad-player">Squad to be confirmed</li>'}</ul>
      </details>`;
  }

  function render(state) {
    const el = document.getElementById("view-teams");
    el.innerHTML = `
      <h2 class="section-title">Teams &amp; Players</h2>
      <p class="section-sub">The 32 squads of the TBFOOT World Cup — tap a team to see its players.</p>
      <div class="teams-grid">
        ${state.teams.map((t, i) => cardHTML(t, i)).join("")}
      </div>`;

    if (window.gsap) {
      gsap.from(".team-tile", { opacity: 0, y: 16, duration: 0.4, stagger: 0.02, ease: "power2.out" });
    }
  }

  return { render };
})();
