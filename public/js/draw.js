/* ============================================================
   Official Draw — ceremony engine + GSAP animation.
   The draw is admin-gated so only the organiser can run it.
   ============================================================ */

const DrawView = (() => {
  const { team, esc, flagImg } = Tournament;

  let running = false;
  let auto = false;
  let queue = [];      // shuffled team ids not yet placed
  let placements = []; // { teamId, group, slotIndex } in draw order
  let pickIndex = 0;

  /* ---------- helpers ---------- */

  function shuffle(arr) {
    // Fisher-Yates with a cryptographically strong source.
    const a = arr.slice();
    const rand = new Uint32Array(a.length);
    crypto.getRandomValues(rand);
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand[i] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function targetFor(index) {
    // Fill round by round: A1..H1, A2..H2, ...
    return { group: GROUP_LETTERS[index % 8], slotIndex: Math.floor(index / 8) };
  }

  /* ---------- rendering ---------- */

  function groupCardHTML(state, letter, slots) {
    const rows = [0, 1, 2, 3].map((i) => {
      const teamId = slots[i];
      const t = team(state, teamId);
      if (!t) {
        return `<div class="group-slot" data-group="${letter}" data-slot="${i}">
          <span class="slot-placeholder"><i class="fa-solid fa-shield-halved"></i> —</span></div>`;
      }
      return `<div class="group-slot landed" data-group="${letter}" data-slot="${i}">
        ${flagImg(t, "slot-flag")}
        <span class="slot-country">${esc(t.country)}</span>
        <span class="slot-team">${esc(t.teamName)}</span></div>`;
    }).join("");
    return `
      <div class="panel group-card" id="draw-group-${letter}">
        <div class="group-head" style="--accent: var(--group-${letter.toLowerCase()})">GROUP ${letter}</div>
        ${rows}
      </div>`;
  }

  function groupsGridHTML(state, groups) {
    return GROUP_LETTERS.map((l) => groupCardHTML(state, l, groups[l] || [])).join("");
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
      el.innerHTML = `
        <h2 class="section-title">Official Draw</h2>
        <p class="section-sub">The official draw is complete — the groups are locked in. Good luck to all 32 teams!</p>
        <div class="groups-grid">${groupsGridHTML(state, state.draw.groups)}</div>
        <p class="center mt-20"><a class="btn-gold" href="#groups"><i class="fa-solid fa-table-list"></i> VIEW GROUP STANDINGS</a></p>`;
      return;
    }

    const inProgress = running;
    const pool = inProgress ? queue : state.teams.map((t) => t.id);
    const liveGroups = inProgress ? currentGroups() : state.draw.groups;

    el.innerHTML = `
      <h2 class="section-title">Official Draw</h2>
      <p class="section-sub">The draw will distribute the 32 teams into 8 groups of 4.</p>

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
          ${inProgress ? `
            <button class="btn-gold" id="btn-draw-next"><i class="fa-solid fa-futbol"></i> DRAW NEXT TEAM</button>
            <button class="btn-outline" id="btn-draw-auto">${auto ? '<i class="fa-solid fa-pause"></i> PAUSE AUTO' : '<i class="fa-solid fa-play"></i> AUTO PLAY'}</button>
            <button class="btn-outline" id="btn-draw-skip"><i class="fa-solid fa-forward-fast"></i> SKIP TO END</button>
          ` : `
            <button class="btn-gold" id="btn-draw-start"><i class="fa-solid fa-user-shield"></i> START OFFICIAL DRAW <i class="fa-solid fa-chevron-right"></i></button>
          `}
        </div>
        <div class="draw-hint"><i class="fa-solid fa-circle-info"></i>
          ${inProgress ? `${32 - queue.length} of 32 teams drawn` : "The draw is run by the tournament organiser and is final once completed."}
        </div>
        <div id="draw-login" style="display:none;max-width:320px;width:100%;margin-top:16px;">
          <div class="form-field">
            <label for="draw-password">Organiser password</label>
            <input type="password" id="draw-password" autocomplete="current-password" placeholder="Enter password to unlock the draw">
          </div>
          <p class="center"><button class="btn-outline" id="btn-draw-login"><i class="fa-solid fa-unlock"></i> Unlock draw</button></p>
        </div>
      </div>

      <h2 class="section-title mt-20" style="margin-top:34px">The Groups</h2>
      <p class="section-sub">Awaiting the official draw…</p>
      <div class="groups-grid" id="draw-groups">${groupsGridHTML(state, liveGroups)}</div>`;

    bindEvents(state);
  }

  function currentGroups() {
    const groups = { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [] };
    for (const p of placements) groups[p.group][p.slotIndex] = p.teamId;
    return groups;
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
      const pwd = $("draw-password").value;
      try {
        await API.login(pwd);
        App.toast("Draw unlocked — good luck!");
        beginDraw(state);
      } catch (e) {
        App.toast(e.message || "Incorrect password", true);
      }
    });
  }

  function beginDraw(state) {
    if (!API.isAdmin()) {
      const box = document.getElementById("draw-login");
      if (box) { box.style.display = "block"; box.querySelector("input")?.focus(); }
      return;
    }
    running = true;
    auto = false;
    pickIndex = 0;
    placements = [];
    queue = shuffle(state.teams.map((t) => t.id));
    Sound.play("start");
    render(state);
  }

  let animating = false;

  async function drawNext(state) {
    if (!running || animating || queue.length === 0) return;
    animating = true;

    const teamId = queue.shift();
    const target = targetFor(pickIndex++);
    placements.push({ teamId, group: target.group, slotIndex: target.slotIndex });
    const t = team(state, teamId);

    const wrap = document.getElementById("draw-ball-wrap");
    const ball = document.getElementById("draw-ball");
    const g = window.gsap;

    // 1. Ball shake / spin
    if (g && ball) {
      await g.to(ball, { rotate: 360, scale: 1.12, duration: 0.55, ease: "power2.inOut" }).then();
      g.set(ball, { rotate: 0, scale: 1 });
    }
    Sound.play("reveal");

    // 2. Reveal card in place of the ball
    const card = document.createElement("div");
    card.className = "team-card reveal";
    card.innerHTML = `
      ${flagImg(t, "card-flag")}
      <div class="card-country">${esc(t.country)}</div>
      <div class="card-team">${esc(t.teamName)}</div>
      <div class="card-group-tag">GROUP ${target.group}</div>`;
    ball.style.visibility = "hidden";
    wrap.appendChild(card);

    // Remove from the visible pool
    document.querySelector(`[data-pool="${teamId}"]`)?.remove();

    await wait(g ? 1150 : 500);

    // 3. Fly the card into its group slot
    const slot = document.querySelector(`.group-slot[data-group="${target.group}"][data-slot="${target.slotIndex}"]`);
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

    // 4. Land the team in the slot
    if (slot) {
      slot.classList.add("landed");
      slot.innerHTML = `${flagImg(t, "slot-flag")}
        <span class="slot-country">${esc(t.country)}</span>
        <span class="slot-team">${esc(t.teamName)}</span>`;
      slot.style.animation = "none";
      void slot.offsetWidth; // restart the landing highlight
      slot.style.animation = "";
    }
    Sound.play("land");
    ball.style.visibility = "visible";

    const hint = document.querySelector(".draw-hint");
    if (hint) hint.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${32 - queue.length} of 32 teams drawn`;

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
      const target = targetFor(pickIndex++);
      placements.push({ teamId, group: target.group, slotIndex: target.slotIndex });
      document.querySelector(`[data-pool="${teamId}"]`)?.remove();
    }
    await completeDraw(state);
  }

  async function completeDraw(state) {
    running = false;
    state.draw.completed = true;
    state.draw.groups = currentGroups();
    state.draw.drawOrder = placements.map((p) => p.teamId);
    state.matches = [
      ...Tournament.generateGroupMatches(state.draw),
      ...Tournament.generateKnockoutSkeleton(),
    ];
    state.announcements.unshift({
      text: "The official draw is complete! Check out the groups and fixtures.",
      date: new Date().toISOString(),
    });

    try {
      await API.saveState(state);
      App.toast("Official draw complete — groups and fixtures are live!");
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

  return { render, groupCardHTML, groupsGridHTML };
})();
