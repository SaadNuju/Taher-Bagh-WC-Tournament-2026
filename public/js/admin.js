/* ============================================================
   Admin panel — password gated. Edits teams, match results,
   goal scorers, awards and announcements.
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
    ["matches", "Matches", "fa-futbol"],
    ["awards", "Awards", "fa-trophy"],
    ["news", "Updates", "fa-bullhorn"],
    ["danger", "Reset", "fa-triangle-exclamation"],
  ];

  function teamsTabHTML(state) {
    const rows = state.teams.map((t) => `
      <details class="admin-match" data-team="${t.id}">
        <summary>${flagImg(t, "slot-flag")} <strong>${esc(t.country)}</strong>
          <span style="color:var(--text-faint)">${esc(t.teamName)}</span>
          <span class="match-status-chip">${(t.players || []).length} players</span>
        </summary>
        <div class="match-body">
          <div class="form-field"><label>Registered team name</label>
            <input data-field="teamName" value="${esc(t.teamName)}"></div>
          <div class="form-field"><label>Captain</label>
            <input data-field="captain" value="${esc(t.captain)}"></div>
          <div class="form-field"><label>Players (one per line)</label>
            <textarea data-field="players" rows="6">${esc((t.players || []).join("\n"))}</textarea></div>
          <button class="btn-outline" data-action="save-team" data-team="${t.id}">
            <i class="fa-solid fa-floppy-disk"></i> Save team</button>
        </div>
      </details>`).join("");
    return `<div class="panel admin-section"><h3 class="howto" style="padding:0;margin-bottom:14px;font-family:var(--font-display);color:var(--gold);letter-spacing:2px">TEAM INFORMATION</h3>${rows}</div>`;
  }

  function scorerRowHTML(state, m, s, idx) {
    const options = [m.teamA, m.teamB].filter(Boolean).map((id) => {
      const t = team(state, id);
      return `<option value="${id}" ${s && s.teamId === id ? "selected" : ""}>${esc(t?.country || id)}</option>`;
    }).join("");
    return `
      <div class="scorer-edit-row" data-scorer="${idx}">
        <select data-sfield="teamId">${options}</select>
        <input data-sfield="name" placeholder="Player name" value="${esc(s?.name || "")}" style="flex:1;min-width:140px">
        <input data-sfield="count" type="number" min="1" max="20" value="${s?.count || 1}" style="width:64px">
        <button class="icon-btn" data-action="del-scorer" title="Remove scorer"><i class="fa-solid fa-xmark"></i></button>
      </div>`;
  }

  function matchEditorHTML(state, m, resolvedMap) {
    const a = team(state, m.teamA);
    const b = team(state, m.teamB);
    const resolved = resolvedMap?.[m.id];
    const nameA = a ? a.country : (resolved?.a?.label || "TBD");
    const nameB = b ? b.country : (resolved?.b?.label || "TBD");
    const ready = !!(a && b);
    const isKO = m.stage === "knockout";
    const showPens = isKO && m.scoreA != null && m.scoreA === m.scoreB;
    const title = m.stage === "group"
      ? `Group ${m.group} · MD${m.md}`
      : ({ r16: "Round of 16", qf: "Quarter Final", sf: "Semi Final", tp: "Third Place", final: "Final" })[m.round] + (m.slot > 1 || ["r16", "qf", "sf"].includes(m.round) ? ` ${m.slot}` : "");

    return `
      <details class="admin-match" data-match="${m.id}">
        <summary>
          <span style="color:var(--text-faint);font-size:.72rem;letter-spacing:1px;min-width:110px">${title}</span>
          ${a ? flagImg(a, "slot-flag") : ""} ${esc(nameA)}
          <strong style="color:var(--gold)">${m.status === "played" ? `${m.scoreA}-${m.scoreB}` : "vs"}</strong>
          ${esc(nameB)} ${b ? flagImg(b, "slot-flag") : ""}
          <span class="match-status-chip ${m.status}">${m.status}</span>
        </summary>
        <div class="match-body">
          ${!ready ? `<p class="draw-hint"><i class="fa-solid fa-circle-info"></i> Teams not decided yet — finish the earlier matches first.</p>` : `
          <div class="admin-row" style="border:none">
            <div class="score-inputs">
              <span>${esc(nameA)}</span>
              <input type="number" min="0" max="99" data-field="scoreA" value="${m.scoreA ?? ""}">
              <span>—</span>
              <input type="number" min="0" max="99" data-field="scoreB" value="${m.scoreB ?? ""}">
              <span>${esc(nameB)}</span>
            </div>
          </div>
          ${isKO ? `
          <div class="admin-row" style="border:none">
            <div class="score-inputs" id="pens-${m.id}" style="${showPens ? "" : "opacity:.55"}">
              <span style="font-size:.75rem;letter-spacing:1px;color:var(--text-faint)">PENALTIES (if drawn)</span>
              <input type="number" min="0" max="30" data-field="pensA" value="${m.pensA ?? ""}">
              <span>—</span>
              <input type="number" min="0" max="30" data-field="pensB" value="${m.pensB ?? ""}">
            </div>
          </div>` : ""}
          <div style="margin:10px 0 4px;font-size:.72rem;letter-spacing:2px;color:var(--text-faint);text-transform:uppercase">Goal scorers</div>
          <div data-scorers>
            ${(m.scorers || []).map((s, i) => scorerRowHTML(state, m, s, i)).join("")}
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

  function matchesTabHTML(state) {
    if (!state.draw.completed) {
      return `<div class="panel empty-note"><i class="fa-solid fa-shuffle"></i>
        Run the official draw first — fixtures are generated automatically from the draw.</div>`;
    }
    const resolvedMap = Tournament.resolveKnockout(state);
    const groupSections = GROUP_LETTERS.map((l) => `
      <h4 style="margin:18px 0 8px;color:var(--gold);letter-spacing:2px;font-size:.85rem">GROUP ${l}</h4>
      ${Tournament.groupMatches(state, l).map((m) => matchEditorHTML(state, m, resolvedMap)).join("")}`).join("");
    const koSections = Tournament.KO_ROUNDS.map(({ round, label }) => `
      <h4 style="margin:18px 0 8px;color:var(--gold);letter-spacing:2px;font-size:.85rem">${label.toUpperCase()}</h4>
      ${state.matches.filter((m) => m.round === round).map((m) => matchEditorHTML(state, m, resolvedMap)).join("")}`).join("");
    return `<div class="panel admin-section">
      <p class="section-sub" style="text-align:left;margin-bottom:10px">Enter final scores and goal scorers. Standings, brackets and the Golden Boot update automatically.</p>
      ${groupSections}
      <hr style="border:none;border-top:1px solid var(--panel-border-soft);margin:24px 0">
      ${koSections}
    </div>`;
  }

  function awardsTabHTML(state) {
    const teamOptions = (selected) => `<option value="">Auto (from bracket)</option>` +
      state.teams.map((t) => `<option value="${t.id}" ${selected === t.id ? "selected" : ""}>${esc(t.country)} — ${esc(t.teamName)}</option>`).join("");
    return `
      <div class="panel admin-section">
        <div class="form-field"><label>Champion (override)</label>
          <select data-award="champion">${teamOptions(state.awards.champion)}</select></div>
        <div class="form-field"><label>Runner-up (override)</label>
          <select data-award="runnerUp">${teamOptions(state.awards.runnerUp)}</select></div>
        <div class="form-field"><label>Third place (override)</label>
          <select data-award="thirdPlace">${teamOptions(state.awards.thirdPlace)}</select></div>
        <div class="form-field"><label>Player of the Tournament</label>
          <input data-award="playerOfTournament" value="${esc(state.awards.playerOfTournament || "")}" placeholder="Player name"></div>
        <div class="form-field"><label>Best Goalkeeper</label>
          <input data-award="bestGoalkeeper" value="${esc(state.awards.bestGoalkeeper || "")}" placeholder="Player name"></div>
        <button class="btn-gold" data-action="save-awards"><i class="fa-solid fa-floppy-disk"></i> SAVE AWARDS</button>
      </div>`;
  }

  function newsTabHTML(state) {
    const items = state.announcements.map((n, i) => `
      <div class="admin-row">
        <span style="flex:1">${esc(n.text)}</span>
        <span style="color:var(--text-faint);font-size:.72rem">${new Date(n.date).toLocaleDateString()}</span>
        <button class="icon-btn" data-action="del-news" data-index="${i}"><i class="fa-solid fa-xmark"></i></button>
      </div>`).join("");
    return `
      <div class="panel admin-section">
        <div class="form-field"><label>New update (shows in the LIVE ticker)</label>
          <textarea id="news-text" rows="2" placeholder="e.g. Kick-off Monday 5pm at Taher Bagh main ground!"></textarea></div>
        <button class="btn-gold" data-action="add-news" style="margin-bottom:18px"><i class="fa-solid fa-bullhorn"></i> POST UPDATE</button>
        ${items || '<p class="empty-note">No updates yet.</p>'}
      </div>`;
  }

  function dangerTabHTML() {
    return `
      <div class="panel admin-section">
        <p class="section-sub" style="text-align:left">These actions cannot be undone.</p>
        <div class="admin-row">
          <div style="flex:1"><strong>Reset the draw</strong><br>
            <span style="color:var(--text-faint);font-size:.8rem">Clears groups and ALL fixtures &amp; results. Team info is kept.</span></div>
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
      matches: matchesTabHTML,
      awards: awardsTabHTML,
      news: newsTabHTML,
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
      render(state);
    });

    el.querySelectorAll(".admin-tab").forEach((b) =>
      b.addEventListener("click", () => { tab = b.dataset.tab; render(state); }));

    // Assigned (not addEventListener) so re-renders never stack handlers.
    el.onclick = async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "save-team") {
        const box = btn.closest("[data-team]");
        const t = team(state, box.dataset.team);
        t.teamName = box.querySelector('[data-field="teamName"]').value.trim() || t.teamName;
        t.captain = box.querySelector('[data-field="captain"]').value.trim();
        t.players = box.querySelector('[data-field="players"]').value
          .split("\n").map((p) => p.trim()).filter(Boolean);
        await persist(state, `${t.country} saved`);
      }

      if (action === "add-scorer") {
        const box = btn.closest("[data-match]");
        const m = state.matches.find((x) => x.id === box.dataset.match);
        const wrap = box.querySelector("[data-scorers]");
        wrap.insertAdjacentHTML("beforeend",
          scorerRowHTML(state, m, null, wrap.children.length));
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
        if (m.stage === "knockout") {
          m.pensA = val("pensA"); m.pensB = val("pensB");
          if (sA === sB && (m.pensA == null || m.pensB == null || m.pensA === m.pensB)) {
            App.toast("Knockout draw — enter a penalty shootout result", true);
            return;
          }
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

      if (action === "save-awards") {
        el.querySelectorAll("[data-award]").forEach((input) => {
          state.awards[input.dataset.award] = input.value.trim() || null;
        });
        await persist(state, "Awards saved");
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
        if (!confirm("Reset the draw? This clears the groups and ALL fixtures and results.")) return;
        state.draw = { completed: false, groups: { A: [], B: [], C: [], D: [], E: [], F: [], G: [], H: [] }, drawOrder: [] };
        state.matches = [];
        state.awards = { champion: null, runnerUp: null, thirdPlace: null, playerOfTournament: null, bestGoalkeeper: null };
        await persist(state, "Draw reset — ready for a new ceremony");
      }
    };
  }

  return { render };
})();
