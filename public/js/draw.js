/* ============================================================
   Official Draw — admin-gated ceremony that fills the 32
   bracket slots (Round of 32, Matches 1–16) one team at a time.
   ============================================================ */

const DrawView = (() => {
  const { team, esc, flagImg } = Tournament;

  let running = false;
  let auto = false;
  let queue = [];   // shuffled team ids awaiting placement
  let placed = [];  // team ids in bracket-slot order (index = slot)

  function shuffle(arr) {
    const a = arr.slice();
    const rand = new Uint32Array(a.length);
    crypto.getRandomValues(rand);
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand[i] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- rendering ---------- */

  function slotHTML(state, slotIndex, teamId) {
    const t = team(state, teamId);
    if (!t) {
      return `<div class="draw-slot group-slot" data-slot="${slotIndex}">
        <span class="slot-placeholder"><i class="fa-solid fa-shield-halved"></i> Slot ${slotIndex + 1}</span></div>`;
    }
    return `<div class="draw-slot group-slot landed" data-slot="${slotIndex}">
      ${flagImg(t, "slot-flag")}
      <span class="slot-country">${esc(t.country)}</span>
      <span class="slot-team">${esc(t.teamName)}</span></div>`;
  }

  function bracketSlotsHTML(state, order) {
    const cards = [];
    for (let match = 0; match < 16; match++) {
      cards.push(`
        <div class="panel draw-match-card">
          <div class="group-head" style="--accent: var(--group-${"abcdefgh"[match % 8]})">R32 · MATCH ${match + 1}</div>
          ${slotHTML(state, match * 2, order[match * 2])}
          <div class="draw-vs">VS</div>
          ${slotHTML(state, match * 2 + 1, order[match * 2 + 1])}
        </div>`);
    }
    return cards.join("");
  }

  function poolHTML(state, ids) {
    return ids.map((id) => {
      const t = team(state, id);
      return `<span class="flag-orbit" style="position:static" data-pool="${id}" title="${esc(t.country)}">${flagImg(t)}</span>`;
    }).join("");
  }

  function render(state) {
    const el = document.getElementById("view-draw");

    if (state.draw.completed) {
      const redoBtn = API.isAdmin()
        ? `<button class="btn-outline btn-danger" id="btn-redo-draw"><i class="fa-solid fa-rotate-left"></i> REDO FULL DRAW</button>`
        : "";
      el.innerHTML = `
        <h2 class="section-title">Official Draw</h2>
        <p class="section-sub">The draw is complete — the road to the final is set. Good luck to all 32 teams!</p>
        <div class="draw-matches-grid">${bracketSlotsHTML(state, state.draw.bracketOrder)}</div>
        <p class="center mt-20" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a class="btn-gold" href="#bracket"><i class="fa-solid fa-sitemap"></i> VIEW THE BRACKET</a>
          ${redoBtn}
        </p>
        ${redoBtn ? `<p class="draw-hint" style="justify-content:center"><i class="fa-solid fa-circle-info"></i> Redoing the draw clears the current bracket and all results.</p>` : ""}`;
      document.getElementById("btn-redo-draw")?.addEventListener("click", () => redoDraw(state));
      return;
    }

    const pool = running ? queue : state.teams.map((t) => t.id);

    el.innerHTML = `
      <h2 class="section-title">Official Draw</h2>
      <p class="section-sub">32 teams · 16 first-round matches · pure knockout. Each drawn team takes the next open bracket slot.</p>

      <div class="panel draw-stage">
        <div class="stage-lights"></div>
        <div id="draw-pool" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:760px;margin-bottom:20px;">
          ${poolHTML(state, pool)}
        </div>

        <div class="draw-ball-wrap" id="draw-ball-wrap">
          <div class="draw-ball" id="draw-ball" role="button" tabindex="0" aria-label="Draw next team">
            <div class="ball-lines"></div>
            <i class="fa-solid fa-futbol"></i>
          </div>
        </div>
        <div class="pedestal"></div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:24px;">
          ${running ? `
            <button class="btn-gold" id="btn-draw-next"><i class="fa-solid fa-futbol"></i> DRAW NEXT TEAM</button>
            <button class="btn-outline" id="btn-draw-auto">${auto ? '<i class="fa-solid fa-pause"></i> PAUSE AUTO' : '<i class="fa-solid fa-play"></i> AUTO PLAY'}</button>
            <button class="btn-outline" id="btn-draw-skip"><i class="fa-solid fa-forward-fast"></i> SKIP TO END</button>
          ` : `
            <button class="btn-gold" id="btn-draw-start"><i class="fa-solid fa-user-shield"></i> START OFFICIAL DRAW <i class="fa-solid fa-chevron-right"></i></button>
          `}
        </div>
        <div class="draw-hint"><i class="fa-solid fa-circle-info"></i>
          ${running ? `${placed.length} of 32 teams drawn` : "The draw is run by the tournament organiser and is final once completed."}
        </div>
        <div id="draw-login" style="display:none;max-width:320px;width:100%;margin-top:16px;">
          <div class="form-field">
            <label for="draw-password">Organiser password</label>
            <input type="password" id="draw-password" autocomplete="current-password" placeholder="Enter password to unlock the draw">
          </div>
          <p class="center"><button class="btn-outline" id="btn-draw-login"><i class="fa-solid fa-unlock"></i> Unlock draw</button></p>
        </div>
      </div>

      <h2 class="section-title" style="margin-top:34px">Round of 32</h2>
      <p class="section-sub">${running ? "The bracket is filling…" : "Awaiting the official draw…"}</p>
      <div class="draw-matches-grid" id="draw-slots">${bracketSlotsHTML(state, placed)}</div>`;

    bindEvents(state);
  }

  /* ---------- ceremony ---------- */

  function bindEvents(state) {
    const $ = (id) => document.getElementById(id);

    $("btn-draw-start")?.addEventListener("click", () => beginDraw(state));
    $("btn-draw-next")?.addEventListener("click", () => drawNext(state));
    $("draw-ball")?.addEventListener("click", () => running && drawNext(state));
    $("btn-draw-skip")?.addEventListener("click", () => skipToEnd(state));
    $("btn-draw-auto")?.addEventListener("click", () => {
      auto = !auto;
      $("btn-draw-auto").innerHTML = auto
        ? '<i class="fa-solid fa-pause"></i> PAUSE AUTO'
        : '<i class="fa-solid fa-play"></i> AUTO PLAY';
      if (auto) drawNext(state);
    });
    $("btn-draw-login")?.addEventListener("click", async () => {
      try {
        await API.login($("draw-password").value);
        App.toast("Draw unlocked — good luck!");
        beginDraw(state);
      } catch (e) {
        App.toast(e.message || "Incorrect password", true);
      }
    });
  }

  function redoDraw(state) {
    if (!API.isAdmin()) return;
    if (!confirm("Redo the full draw? This clears the current bracket and ALL results, then starts a brand-new draw ceremony.")) return;
    state.draw = { completed: false, bracketOrder: [], drawOrder: [] };
    for (const m of state.matches) {
      m.teamA = m.teamB = null;
      m.scoreA = m.scoreB = m.pensA = m.pensB = null;
      m.scorers = [];
      m.status = "scheduled";
    }
    beginDraw(state);
  }

  function beginDraw(state) {
    if (!API.isAdmin()) {
      const box = document.getElementById("draw-login");
      if (box) { box.style.display = "block"; box.querySelector("input")?.focus(); }
      return;
    }
    running = true;
    auto = false;
    placed = [];
    queue = shuffle(state.teams.map((t) => t.id));
    Sound.play("start");
    render(state);
  }

  let animating = false;

  async function drawNext(state) {
    if (!running || animating || queue.length === 0) return;
    animating = true;

    const teamId = queue.shift();
    const slotIndex = placed.length;
    placed.push(teamId);
    const t = team(state, teamId);
    const matchNo = Math.floor(slotIndex / 2) + 1;

    const wrap = document.getElementById("draw-ball-wrap");
    const ball = document.getElementById("draw-ball");
    const g = window.gsap;

    if (g && ball) {
      await g.to(ball, { rotate: 360, scale: 1.12, duration: 0.55, ease: "power2.inOut" }).then();
      g.set(ball, { rotate: 0, scale: 1 });
    }
    Sound.play("reveal");

    const card = document.createElement("div");
    card.className = "team-card reveal";
    card.innerHTML = `
      ${flagImg(t, "card-flag")}
      <div class="card-country">${esc(t.country)}</div>
      <div class="card-team">${esc(t.teamName)}</div>
      <div class="card-group-tag">MATCH ${matchNo}</div>`;
    ball.style.visibility = "hidden";
    wrap.appendChild(card);

    document.querySelector(`[data-pool="${teamId}"]`)?.remove();

    await wait(g ? 1150 : 450);

    const slot = document.querySelector(`.draw-slot[data-slot="${slotIndex}"]`);
    if (g && slot) {
      const from = card.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const clone = card.cloneNode(true);
      clone.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;margin:0;z-index:120;`;
      document.body.appendChild(clone);
      card.remove();
      Sound.play("whoosh");
      await g.to(clone, {
        left: to.left + 10,
        top: to.top + to.height / 2 - from.height * 0.08,
        scale: 0.14,
        opacity: 0.9,
        transformOrigin: "top left",
        duration: 0.7,
        ease: "power2.in",
      }).then();
      clone.remove();
    } else {
      card.remove();
    }

    if (slot) {
      slot.classList.add("landed");
      slot.innerHTML = `${flagImg(t, "slot-flag")}
        <span class="slot-country">${esc(t.country)}</span>
        <span class="slot-team">${esc(t.teamName)}</span>`;
    }
    Sound.play("land");
    ball.style.visibility = "visible";

    const hint = document.querySelector(".draw-hint");
    if (hint) hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${placed.length} of 32 teams drawn`;

    animating = false;

    if (queue.length === 0) {
      await completeDraw(state);
    } else if (auto) {
      await wait(650);
      drawNext(state);
    }
  }

  async function skipToEnd(state) {
    if (!running) return;
    auto = false;
    while (queue.length > 0) {
      const teamId = queue.shift();
      placed.push(teamId);
      document.querySelector(`[data-pool="${teamId}"]`)?.remove();
    }
    await completeDraw(state);
  }

  async function completeDraw(state) {
    running = false;
    state.draw.completed = true;
    state.draw.bracketOrder = placed.slice();
    state.draw.drawOrder = placed.slice();
    state.announcements.unshift({
      text: "The official draw is complete! The Round of 32 bracket is live — check your matchup.",
      date: new Date().toISOString(),
    });

    try {
      await API.saveState(state);
      App.toast("Official draw complete — the bracket is live!");
    } catch (e) {
      App.toast("Draw done, but saving failed: " + e.message, true);
    }

    Sound.play("fanfare");
    App.confetti();
    App.setState(state);
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  return { render };
})();
