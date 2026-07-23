/* ============================================================
   Admin panel — password gated. Teams & squads, match results
   (scorers via player dropdowns), schedule times, homepage
   media slots, ticker updates, visitor analytics, draw reset.
   ============================================================ */

const AdminView = (() => {
  const { team, esc, flagImg } = Tournament;

  let tab = "teams";

  /* ---------- login ---------- */

  function loginHTML() {
    return `
      <div class="panel admin-login">
        <div class="lock-icon"><i class="fa-solid fa-shield-halved"></i></div>
        <h2 class="section-title" style="font-size:1.1rem">Admin Panel</h2>
        <p class="section-sub" style="margin-bottom:20px">Organiser access only.</p>
        <form id="admin-login-form">
          <div class="form-field">
            <label for="admin-password">Password</label>
            <input type="password" id="admin-password" autocomplete="current-password" required>
          </div>
          <button class="btn-gold" type="submit" style="width:100%;justify-content:center">
            <i class="fa-solid fa-unlock"></i> LOG IN</button>
        </form>
        ${API.mode === "demo" ? `<p class="draw-hint" style="justify-content:center;margin-top:14px"><i class="fa-solid fa-circle-info"></i>Demo mode — password is “admin”</p>` : ""}
      </div>`;
  }

  /* ---------- tabs ---------- */

  const TABS = [
    ["teams", "Teams", "fa-people-group"],
    ["results", "Results", "fa-futbol"],
    ["schedule", "Schedule", "fa-clock"],
    ["media", "Media", "fa-photo-film"],
    ["news", "Updates", "fa-bullhorn"],
    ["analytics", "Analytics", "fa-chart-simple"],
    ["danger", "Reset", "fa-triangle-exclamation"],
  ];

  /* ----- Teams ----- */

  function teamsTabHTML(state) {
    const rows = state.teams.map((t) => {
      const playerInputs = Array.from({ length: 10 }, (_, i) => `
        <div class="player-input-row">
          <span class="squad-num">${i + 1}</span>
          <input data-player="${i}" value="${esc(t.players[i] || "")}" placeholder="Player ${i + 1}">
        </div>`).join("");
      const gkOptions = ['<option value="">— select goalkeeper —</option>']
        .concat(t.players.map((p) => `<option value="${esc(p)}" ${t.goalkeeper === p ? "selected" : ""}>${esc(p)}</option>`))
        .join("");
      return `
        <details class="admin-match" data-team="${t.id}">
          <summary>${flagImg(t, "slot-flag")} <strong>${esc(t.country)}</strong>
            <span style="color:var(--text-faint)">${esc(t.teamName)}</span>
            <span class="match-status-chip">${t.goalkeeper ? "GK set" : "no GK"}</span>
          </summary>
          <div class="match-body">
            <div class="form-field"><label>Registered team name</label>
              <input data-field="teamName" value="${esc(t.teamName)}"></div>
            <div class="form-field"><label>Captain</label>
              <input data-field="captain" value="${esc(t.captain)}"></div>
            <div class="form-field"><label>Squad — 10 players</label>
              <div class="player-inputs">${playerInputs}</div></div>
            <div class="form-field"><label>Goalkeeper (used for the Golden Glove ranking)</label>
              <select data-field="goalkeeper">${gkOptions}</select></div>
            <button class="btn-outline" data-action="save-team">
              <i class="fa-solid fa-floppy-disk"></i> Save team</button>
          </div>
        </details>`;
    }).join("");
    return `<div class="panel admin-section">
      <p class="section-sub" style="text-align:left;margin-bottom:12px">Fill each squad once the participant list is confirmed — team pages, the draw, scorer dropdowns and the Golden Glove all update from here.</p>
      ${rows}</div>`;
  }

  /* ----- Results ----- */

  function scorerRowHTML(state, m, s) {
    const teamOpts = [m.teamA, m.teamB].filter(Boolean).map((id) => {
      const t = team(state, id);
      return `<option value="${id}" ${s && s.teamId === id ? "selected" : ""}>${esc(t?.country || id)}</option>`;
    }).join("");
    const roster = (teamId) => (team(state, teamId)?.players || []).filter(Boolean);
    const selTeam = s?.teamId || m.teamA;
    const playerOpts = roster(selTeam)
      .map((p) => `<option value="${esc(p)}" ${s && s.name === p ? "selected" : ""}>${esc(p)}</option>`)
      .join("");
    return `
      <div class="scorer-edit-row">
        <select data-sfield="teamId">${teamOpts}</select>
        <select data-sfield="name" style="flex:1;min-width:140px">${playerOpts || '<option value="">(no squad yet)</option>'}</select>
        <input data-sfield="count" type="number" min="1" max="20" value="${s?.count || 1}" style="width:64px">
        <button class="icon-btn" data-action="del-scorer" title="Remove scorer"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
  }

  function matchEditorHTML(state, m, labels) {
    const a = team(state, m.teamA);
    const b = team(state, m.teamB);
    const nameA = a ? a.country : (labels[m.id]?.a || "TBD");
    const nameB = b ? b.country : (labels[m.id]?.b || "TBD");
    const ready = !!(a && b);
    const title = `${Tournament.ROUNDS.find((r) => r.round === m.round).label} · M${m.slot}`;

    return `
      <details class="admin-match" data-match="${m.id}">
        <summary>
          <span style="color:var(--text-faint);font-size:.72rem;letter-spacing:1px;min-width:130px">${title}</span>
          ${a ? flagImg(a, "slot-flag") : ""} ${esc(nameA)}
          <strong style="color:var(--gold)">${m.status === "played" ? `${m.scoreA}-${m.scoreB}` : "vs"}</strong>
          ${esc(nameB)} ${b ? flagImg(b, "slot-flag") : ""}
          <span class="match-status-chip ${m.status}">${m.status}</span>
        </summary>
        <div class="match-body">
          ${!ready ? `<p class="draw-hint"><i class="fa-solid fa-circle-info"></i> Teams not decided yet — complete the earlier round (or the draw) first.</p>` : `
          <div class="admin-row" style="border:none">
            <div class="score-inputs">
              <span>${esc(nameA)}</span>
              <input type="number" min="0" max="99" data-field="scoreA" value="${m.scoreA ?? ""}">
              <span>—</span>
              <input type="number" min="0" max="99" data-field="scoreB" value="${m.scoreB ?? ""}">
              <span>${esc(nameB)}</span>
            </div>
          </div>
          <div class="admin-row" style="border:none">
            <div class="score-inputs">
              <span style="font-size:.75rem;letter-spacing:1px;color:var(--text-faint)">PENALTIES (if drawn)</span>
              <input type="number" min="0" max="30" data-field="pensA" value="${m.pensA ?? ""}">
              <span>—</span>
              <input type="number" min="0" max="30" data-field="pensB" value="${m.pensB ?? ""}">
            </div>
          </div>
          <div style="margin:10px 0 4px;font-size:.72rem;letter-spacing:2px;color:var(--text-faint);text-transform:uppercase">Goal scorers</div>
          <div data-scorers>
            ${(m.scorers || []).map((s) => scorerRowHTML(state, m, s)).join("")}
          </div>
          <button class="btn-outline" data-action="add-scorer" style="margin-top:6px"><i class="fa-solid fa-plus"></i> Add scorer</button>
          <div class="admin-row" style="border:none;margin-top:10px">
            <button class="btn-gold" data-action="save-match" style="padding:11px 26px;font-size:.85rem">
              <i class="fa-solid fa-floppy-disk"></i> SAVE RESULT</button>
            ${m.status === "played" ? `<button class="btn-outline btn-danger" data-action="clear-match">
              <i class="fa-solid fa-eraser"></i> Clear result</button>` : ""}
          </div>`}
        </div>
      </details>`;
  }

  function resultsTabHTML(state) {
    if (!state.draw.completed) {
      return `<div class="panel empty-note"><i class="fa-solid fa-shuffle"></i>
        Run the official draw first — results open up once the bracket is set.</div>`;
    }
    const labels = Tournament.resolveBracket(state);
    const sections = Tournament.ROUNDS.map(({ round, label }) => `
      <h4 style="margin:18px 0 8px;color:var(--gold);letter-spacing:2px;font-size:.85rem">${label.toUpperCase()}</h4>
      ${Tournament.roundMatches(state, round).map((m) => matchEditorHTML(state, m, labels)).join("")}`).join("");
    return `<div class="panel admin-section">
      <p class="section-sub" style="text-align:left;margin-bottom:10px">Enter final scores and pick the scorers from each squad. The bracket, schedule and awards update everywhere automatically. Knockout draws need a penalty shootout result.</p>
      ${sections}</div>`;
  }

  /* ----- Schedule ----- */

  function scheduleTabHTML(state) {
    const labels = Tournament.resolveBracket(state);
    // Split into separate date + time inputs — far more reliably supported
    // across mobile browsers (notably iOS Safari) than a combined
    // datetime-local picker, which can silently fail to commit its value.
    const toLocalDate = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    const toLocalTime = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const inputStyle = "padding:9px;border-radius:9px;border:1px solid var(--panel-border-soft);background:rgba(5,7,15,.6);color:var(--text)";
    const sections = Tournament.ROUNDS.map(({ round, label }) => {
      const rows = Tournament.roundMatches(state, round).map((m) => {
        const a = team(state, m.teamA);
        const b = team(state, m.teamB);
        const vs = a && b ? `${a.country} v ${b.country}` : (labels[m.id] ? `${labels[m.id].a} v ${labels[m.id].b}` : "TBD");
        return `
          <div class="admin-row" data-sched="${m.id}">
            <span style="min-width:46px;color:var(--text-faint);font-size:.75rem">M${m.slot}</span>
            <span style="flex:1;font-size:.85rem">${esc(vs)}</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <input type="date" data-kick-date value="${toLocalDate(m.kickoff)}" style="${inputStyle}">
              <input type="time" data-kick-time value="${toLocalTime(m.kickoff)}" style="${inputStyle}">
            </div>
          </div>`;
      }).join("");
      return `<h4 style="margin:18px 0 8px;color:var(--gold);letter-spacing:2px;font-size:.85rem">${label.toUpperCase()}</h4>${rows}`;
    }).join("");
    return `<div class="panel admin-section">
      <p class="section-sub" style="text-align:left;margin-bottom:10px">Set kickoff times — the Schedule tab shows them to visitors and highlights the current round automatically.</p>
      ${sections}
      <p style="margin-top:16px"><button class="btn-gold" data-action="save-schedule"><i class="fa-solid fa-floppy-disk"></i> SAVE ALL TIMES</button></p>
    </div>`;
  }

  /* ----- Media ----- */

  function mediaTabHTML(state) {
    const media = state.media || [];
    const slots = Array.from({ length: 4 }, (_, i) => {
      const s = media[i] || {};
      return `
        <div class="admin-row" data-media="${i}" style="align-items:flex-start;flex-direction:column">
          <strong style="color:var(--gold);font-size:.8rem;letter-spacing:1.5px">HOMEPAGE SLOT ${i + 1}</strong>
          <div style="display:flex;gap:8px;flex-wrap:wrap;width:100%">
            <select data-mfield="type" style="padding:9px;border-radius:9px;border:1px solid var(--panel-border-soft);background:rgba(5,7,15,.6);color:var(--text)">
              <option value="image" ${s.type !== "video" ? "selected" : ""}>Image</option>
              <option value="video" ${s.type === "video" ? "selected" : ""}>Video</option>
            </select>
            <input data-mfield="src" placeholder="Image/video URL (or assets/sponsors/file.jpg once uploaded)" value="${esc(s.src || "")}" style="flex:2;min-width:200px;padding:9px;border-radius:9px;border:1px solid var(--panel-border-soft);background:rgba(5,7,15,.6);color:var(--text)">
            <input data-mfield="caption" placeholder="Caption (optional)" value="${esc(s.caption || "")}" style="flex:1;min-width:140px;padding:9px;border-radius:9px;border:1px solid var(--panel-border-soft);background:rgba(5,7,15,.6);color:var(--text)">
            <input data-mfield="link" placeholder="Link when clicked (optional)" value="${esc(s.link || "")}" style="flex:2;min-width:200px;padding:9px;border-radius:9px;border:1px solid var(--panel-border-soft);background:rgba(5,7,15,.6);color:var(--text)">
          </div>
        </div>`;
    }).join("");
    return `<div class="panel admin-section">
      <p class="section-sub" style="text-align:left;margin-bottom:10px">These fill the sponsor showcase slots on the homepage. Leave a URL empty to show the styled placeholder. Send picture/video files to your developer to add under <code>assets/sponsors/</code>, then reference them here.</p>
      ${slots}
      <p style="margin-top:16px"><button class="btn-gold" data-action="save-media"><i class="fa-solid fa-floppy-disk"></i> SAVE MEDIA</button></p>
    </div>`;
  }

  /* ----- Updates ----- */

  function newsTabHTML(state) {
    const items = state.announcements.map((n, i) => `
      <div class="admin-row">
        <span style="flex:1">${esc(n.text)}</span>
        <span style="color:var(--text-faint);font-size:.72rem">${new Date(n.date).toLocaleDateString()}</span>
        <button class="icon-btn" data-action="del-news" data-index="${i}"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join("");
    return `
      <div class="panel admin-section">
        <div class="form-field"><label>New update (shows in the LIVE ticker on every tab)</label>
          <textarea id="news-text" rows="2" placeholder="e.g. Kick-off Monday 5pm at the TBFOOT main ground!"></textarea></div>
        <button class="btn-gold" data-action="add-news" style="margin-bottom:18px"><i class="fa-solid fa-bullhorn"></i> POST UPDATE</button>
        ${items || '<p class="empty-note">No updates yet.</p>'}
      </div>`;
  }

  /* ----- Analytics ----- */

  function analyticsTabHTML() {
    return `<div class="panel admin-section" id="analytics-box">
      <p class="section-sub" style="text-align:left">Visits are counted once per visitor session. Loading…</p>
    </div>`;
  }

  async function fillAnalytics() {
    const box = document.getElementById("analytics-box");
    if (!box) return;
    if (API.mode !== "live") {
      box.innerHTML = `<p class="empty-note"><i class="fa-solid fa-chart-simple"></i>Analytics are collected on the live site only (demo mode has no backend).</p>`;
      return;
    }
    try {
      const visits = await API.getVisits();
      const days = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        days.push({ day: d, n: visits[d] || 0 });
      }
      const total = Object.values(visits).reduce((s, n) => s + n, 0);
      const last7 = days.slice(7).reduce((s, d) => s + d.n, 0);
      const today = days[13].n;
      const max = Math.max(1, ...days.map((d) => d.n));
      const bars = days.map((d) => `
        <div class="viz-bar-wrap" title="${d.day}: ${d.n} visits">
          <div class="viz-bar" style="height:${Math.round((d.n / max) * 100)}%"></div>
          <span class="viz-day">${d.day.slice(8)}</span>
        </div>`).join("");
      box.innerHTML = `
        <div class="stat-side" style="flex-direction:row;justify-content:space-around;padding:10px 0 22px">
          <div class="stat-block"><div class="stat-number">${today}</div><div class="stat-label">TODAY</div></div>
          <div class="stat-block"><div class="stat-number">${last7}</div><div class="stat-label">LAST 7 DAYS</div></div>
          <div class="stat-block"><div class="stat-number">${total}</div><div class="stat-label">ALL TIME</div></div>
        </div>
        <div class="viz-chart">${bars}</div>
        <p class="draw-hint" style="margin-top:14px"><i class="fa-solid fa-circle-info"></i> Fuller analytics (requests, countries, errors) live in Cloudflare → your Worker → Metrics.</p>`;
    } catch (e) {
      box.innerHTML = `<p class="empty-note">Could not load analytics: ${esc(e.message)}</p>`;
    }
  }

  /* ----- Reset ----- */

  function dangerTabHTML() {
    return `
      <div class="panel admin-section">
        <p class="section-sub" style="text-align:left">These actions cannot be undone.</p>
        <div class="admin-row">
          <div style="flex:1"><strong>Reset the draw</strong><br>
            <span style="color:var(--text-faint);font-size:.8rem">Clears the bracket and ALL results. Teams, squads and kickoff times are kept.</span></div>
          <button class="btn-outline btn-danger" data-action="reset-draw"><i class="fa-solid fa-rotate-left"></i> Reset draw</button>
        </div>
      </div>`;
  }

  /* ---------- render ---------- */

  function render(state) {
    const el = document.getElementById("view-admin");
    if (!API.isAdmin()) {
      el.innerHTML = loginHTML();
      document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          await API.login(document.getElementById("admin-password").value);
          App.refreshAdminNav();
          App.toast("Welcome back, organiser!");
          render(state);
        } catch (err) {
          App.toast(err.message || "Login failed", true);
        }
      });
      return;
    }

    const tabButtons = TABS.map(([id, label, icon]) =>
      `<button class="admin-tab ${tab === id ? "active" : ""}" data-tab="${id}"><i class="fa-solid ${icon}"></i> ${label}</button>`).join("");

    const body = {
      teams: teamsTabHTML,
      results: resultsTabHTML,
      schedule: scheduleTabHTML,
      media: mediaTabHTML,
      news: newsTabHTML,
      analytics: analyticsTabHTML,
      danger: dangerTabHTML,
    }[tab](state);

    el.innerHTML = `
      <h2 class="section-title">Admin Panel</h2>
      <div class="admin-bar">
        <span class="mode-chip ${API.mode}">
          <i class="fa-solid ${API.mode === "live" ? "fa-tower-broadcast" : "fa-laptop"}"></i>
          ${API.mode === "live" ? "Live — changes publish to everyone" : "Demo — changes stay on this device"}</span>
        <button class="btn-outline" id="btn-logout"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
      </div>
      <div class="admin-tabs">${tabButtons}</div>
      ${body}`;

    bindEvents(state, el);
    if (tab === "analytics") fillAnalytics();
  }

  /* ---------- events ---------- */

  async function persist(state, message) {
    try {
      await API.saveState(state);
      App.toast(message);
      App.setState(state);
    } catch (e) {
      App.toast("Save failed: " + e.message, true);
    }
  }

  function bindEvents(state, el) {
    document.getElementById("btn-logout").addEventListener("click", () => {
      API.logout();
      App.refreshAdminNav();
      // If the hidden Draw tab is the current view, bounce to home.
      if ((location.hash || "#home").slice(1) === "draw") { location.hash = "#home"; }
      render(state);
    });

    el.querySelectorAll(".admin-tab").forEach((b) =>
      b.addEventListener("click", () => { tab = b.dataset.tab; render(state); }));

    // When the scorer's team changes, swap the player dropdown to that roster.
    el.onchange = (e) => {
      const sel = e.target.closest('[data-sfield="teamId"]');
      if (!sel) return;
      const row = sel.closest(".scorer-edit-row");
      const roster = (Tournament.team(state, sel.value)?.players || []).filter(Boolean);
      row.querySelector('[data-sfield="name"]').innerHTML =
        roster.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("") ||
        '<option value="">(no squad yet)</option>';
    };

    // Single delegated click handler (assignment, not addEventListener,
    // so re-renders never stack duplicate handlers).
    el.onclick = async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "save-team") {
        const box = btn.closest("[data-team]");
        const t = team(state, box.dataset.team);
        t.teamName = box.querySelector('[data-field="teamName"]').value.trim() || t.teamName;
        t.captain = box.querySelector('[data-field="captain"]').value.trim();
        t.players = [...box.querySelectorAll("[data-player]")]
          .map((inp) => inp.value.trim())
          .map((p, i) => p || `Player ${String(i + 1).padStart(2, "0")}`);
        const gk = box.querySelector('[data-field="goalkeeper"]').value;
        t.goalkeeper = t.players.includes(gk) ? gk : "";
        await persist(state, `${t.country} saved`);
      }

      if (action === "add-scorer") {
        const box = btn.closest("[data-match]");
        const m = state.matches.find((x) => x.id === box.dataset.match);
        box.querySelector("[data-scorers]").insertAdjacentHTML("beforeend", scorerRowHTML(state, m, null));
      }

      if (action === "del-scorer") {
        btn.closest(".scorer-edit-row").remove();
      }

      if (action === "save-match") {
        const box = btn.closest("[data-match]");
        const m = state.matches.find((x) => x.id === box.dataset.match);
        const val = (f) => {
          const input = box.querySelector(`[data-field="${f}"]`);
          if (!input || input.value === "") return null;
          const n = Number(input.value);
          return Number.isFinite(n) && n >= 0 ? n : null;
        };
        const sA = val("scoreA"), sB = val("scoreB");
        if (sA == null || sB == null) {
          App.toast("Enter both scores first", true);
          return;
        }
        m.scoreA = sA; m.scoreB = sB;
        m.pensA = val("pensA"); m.pensB = val("pensB");
        if (sA === sB && (m.pensA == null || m.pensB == null || m.pensA === m.pensB)) {
          App.toast("Knockout matches need a winner — enter the penalty shootout result", true);
          return;
        }
        m.scorers = [...box.querySelectorAll(".scorer-edit-row")].map((row) => ({
          teamId: row.querySelector('[data-sfield="teamId"]').value,
          name: row.querySelector('[data-sfield="name"]').value.trim(),
          count: Math.max(1, Number(row.querySelector('[data-sfield="count"]').value) || 1),
        })).filter((s) => s.name);
        m.status = "played";
        await persist(state, "Result saved");
      }

      if (action === "clear-match") {
        const box = btn.closest("[data-match]");
        const m = state.matches.find((x) => x.id === box.dataset.match);
        m.scoreA = m.scoreB = m.pensA = m.pensB = null;
        m.scorers = [];
        m.status = "scheduled";
        await persist(state, "Result cleared");
      }

      if (action === "save-schedule") {
        el.querySelectorAll("[data-sched]").forEach((row) => {
          const m = state.matches.find((x) => x.id === row.dataset.sched);
          const dateVal = row.querySelector("[data-kick-date]").value;
          const timeVal = row.querySelector("[data-kick-time]").value;
          if (dateVal && timeVal) {
            const d = new Date(`${dateVal}T${timeVal}`);
            if (!isNaN(d.getTime())) m.kickoff = d.toISOString();
          } else if (!dateVal && !timeVal) {
            m.kickoff = null; // both cleared — explicit intentional clear
          }
          // Only one of the two filled in: leave the saved kickoff as-is
          // rather than blanking it from a partial/uncommitted edit.
        });
        await persist(state, "Schedule saved");
      }

      if (action === "save-media") {
        state.media = [...el.querySelectorAll("[data-media]")].map((row) => {
          const src = row.querySelector('[data-mfield="src"]').value.trim();
          if (!src) return null;
          return {
            type: row.querySelector('[data-mfield="type"]').value,
            src,
            caption: row.querySelector('[data-mfield="caption"]').value.trim(),
            link: row.querySelector('[data-mfield="link"]').value.trim(),
          };
        });
        await persist(state, "Homepage media saved");
      }

      if (action === "add-news") {
        const text = document.getElementById("news-text").value.trim();
        if (!text) return;
        state.announcements.unshift({ text, date: new Date().toISOString() });
        await persist(state, "Update posted");
      }

      if (action === "del-news") {
        state.announcements.splice(Number(btn.dataset.index), 1);
        await persist(state, "Update removed");
      }

      if (action === "reset-draw") {
        if (!confirm("Reset the draw? This clears the bracket and ALL results (teams and kickoff times are kept).")) return;
        state.draw = { completed: false, bracketOrder: [], drawOrder: [] };
        for (const m of state.matches) {
          m.teamA = m.teamB = null;
          m.scoreA = m.scoreB = m.pensA = m.pensB = null;
          m.scorers = [];
          m.status = "scheduled";
        }
        await persist(state, "Draw reset — ready for a new ceremony");
      }
    };
  }

  return { render };
})();
