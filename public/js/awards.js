/* ============================================================
   Awards view — Golden Boot, Golden Glove, and the "Favourites
   to win" power ranking with playful commentary.
   ============================================================ */

const AwardsView = (() => {
  const { esc, team, flagImg } = Tournament;

  const BLURBS = [
    "{team} have been ruthless in front of goal — defenders see them in their nightmares.",
    "Quietly, methodically, {team} keep winning. That's how champions are made.",
    "{team}'s dressing room believes — and belief has won more finals than talent.",
    "The stats say {team} are peaking at exactly the right moment.",
    "Nobody wants to draw {team} right now. Nobody.",
    "{team} concede little and score plenty — the classic formula for lifting trophies.",
    "Something special is brewing in the {team} camp. You can feel it from the touchline.",
    "{team} have that tournament glow — the swagger of a side that expects to win.",
  ];

  const DARK_HORSE_BLURBS = [
    "Every World Cup has its fairytale — and whisper it, but {team} might be writing one.",
    "Keep an eye on {team}. The bookies haven't, and that's exactly why it's dangerous.",
    "{team} have nothing to lose and everything to prove — the most dangerous kind of team.",
    "If chaos strikes this tournament, it'll wear a {team} shirt.",
  ];

  function scorerRows(state) {
    return Tournament.topScorers(state).slice(0, 10).map((s, i) => {
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
  }

  function gloveRows(state) {
    return Tournament.goldenGlove(state).slice(0, 10).map((r, i) => {
      const t = team(state, r.teamId);
      const gk = t?.goalkeeper || "GK to be confirmed";
      return `
        <div class="scorer-row">
          <span class="rank">${i + 1}</span>
          ${t ? flagImg(t) : ""}
          <span>${esc(gk)}</span>
          <span class="scorer-team">${t ? esc(t.country) : ""}</span>
          <span class="goals" title="Goals conceded per match">${r.ga} <i class="fa-solid fa-hand" style="font-size:.7rem"></i> / ${r.played}</span>
        </div>`;
    }).join("");
  }

  function fill(tpl, t) {
    return esc(tpl).replace("{team}", `<strong>${esc(t.country)}</strong>`);
  }

  function favouritesHTML(state) {
    const ranking = Tournament.powerRanking(state);
    const played = ranking.some((r) => r.played > 0);
    if (!state.draw.completed) {
      return `<div class="empty-note"><i class="fa-solid fa-wand-magic-sparkles"></i>
        Predictions unlock once the draw is made and the first whistles blow.</div>`;
    }

    const top = ranking.slice(0, 3);
    const rest = ranking.slice(3);
    const darkHorse = Tournament.dailyPick(rest.length ? rest : ranking, "dh");

    const favCards = top.map((r, i) => {
      const t = team(state, r.teamId);
      const blurb = Tournament.dailyPick(BLURBS, r.teamId + i) || BLURBS[0];
      return `
        <div class="panel fav-card">
          <div class="fav-rank">#${i + 1}</div>
          <div class="fav-team">${flagImg(t)} <span>${esc(t?.country || "?")}</span></div>
          <div class="fav-stats">${r.wins} wins · ${r.gf}-${r.ga} goals${played ? "" : " · pre-tournament pick"}</div>
          <p class="fav-blurb">${fill(Tournament.dailyPick(BLURBS, r.teamId) || BLURBS[i], t)}</p>
        </div>`;
    }).join("");

    const dh = darkHorse ? (() => {
      const t = team(state, darkHorse.teamId);
      return `
        <div class="panel fav-card dark-horse">
          <div class="fav-rank"><i class="fa-solid fa-horse"></i> DARK HORSE OF THE DAY</div>
          <div class="fav-team">${flagImg(t)} <span>${esc(t?.country || "?")}</span></div>
          <p class="fav-blurb">${fill(Tournament.dailyPick(DARK_HORSE_BLURBS, darkHorse.teamId) || DARK_HORSE_BLURBS[0], t)}</p>
        </div>`;
    })() : "";

    return `<div class="fav-grid">${favCards}${dh}</div>`;
  }

  function render(state) {
    const el = document.getElementById("view-awards");
    Tournament.resolveBracket(state);
    const champId = Tournament.champion(state);
    const champ = team(state, champId);

    el.innerHTML = `
      <h2 class="section-title">Awards &amp; Form Guide</h2>
      <p class="section-sub">The Golden Boot race, the safest hands, and who the numbers fancy to lift the cup.</p>

      ${champ ? `
      <div class="panel podium-card gold-card center" style="margin-bottom:26px">
        <div class="podium-icon"><i class="fa-solid fa-trophy"></i></div>
        <div class="podium-title">CHAMPIONS</div>
        <div class="podium-team">${esc(champ.country)}</div>
        ${flagImg(champ)}
      </div>` : ""}

      <div class="groups-page-grid">
        <div class="panel scorers-panel">
          <div class="group-head" style="--accent: var(--gold)"><i class="fa-solid fa-shoe-prints"></i> GOLDEN BOOT · TOP SCORERS</div>
          ${scorerRows(state) || '<div class="empty-note"><i class="fa-solid fa-futbol"></i>No goals recorded yet — the race starts with the first match.</div>'}
        </div>
        <div class="panel scorers-panel">
          <div class="group-head" style="--accent: var(--group-e)"><i class="fa-solid fa-mitten"></i> GOLDEN GLOVE · BEST DEFENCE</div>
          ${gloveRows(state) || '<div class="empty-note"><i class="fa-solid fa-hand"></i>Keepers enter the rankings once matches are played.</div>'}
        </div>
      </div>

      <h2 class="section-title" style="margin-top:34px">Favourites to Win</h2>
      <p class="section-sub">Powered by the tournament stats — refreshed daily, argued about hourly.</p>
      ${favouritesHTML(state)}

      ${state.awards.playerOfTournament || state.awards.bestGoalkeeper ? `
      <div class="awards-grid mt-20">
        ${state.awards.playerOfTournament ? `
        <div class="panel award-card">
          <div class="award-icon"><i class="fa-solid fa-star"></i></div>
          <div><div class="award-title">Player of the Tournament</div>
          <div class="award-value">${esc(state.awards.playerOfTournament)}</div></div>
        </div>` : ""}
        ${state.awards.bestGoalkeeper ? `
        <div class="panel award-card">
          <div class="award-icon"><i class="fa-solid fa-hand"></i></div>
          <div><div class="award-title">Best Goalkeeper (official)</div>
          <div class="award-value">${esc(state.awards.bestGoalkeeper)}</div></div>
        </div>` : ""}
      </div>` : ""}
    `;

    if (window.gsap) {
      gsap.from("#view-awards .panel", { opacity: 0, y: 14, duration: 0.4, stagger: 0.05, ease: "power2.out" });
    }
  }

  return { render };
})();
