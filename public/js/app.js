/* ============================================================
   App bootstrap — router, state store, home view, ticker,
   sponsor banner, ambience (particles, sounds, confetti).
   ============================================================ */

/* ---------- Sound (WebAudio, no assets needed) ---------- */

const Sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem("tbwc26-muted") === "1";

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = "sine", gain = 0.12) {
    const a = ac();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, a.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
    o.connect(g).connect(a.destination);
    o.start(a.currentTime + start);
    o.stop(a.currentTime + start + dur + 0.05);
  }

  const effects = {
    start: () => { tone(392, 0, 0.3, "triangle"); tone(523, 0.12, 0.35, "triangle"); tone(659, 0.24, 0.5, "triangle"); },
    reveal: () => { tone(880, 0, 0.18, "sine", 0.1); tone(1318, 0.08, 0.3, "sine", 0.08); },
    whoosh: () => { tone(220, 0, 0.25, "sawtooth", 0.05); tone(440, 0.05, 0.2, "sawtooth", 0.04); },
    land: () => { tone(196, 0, 0.16, "square", 0.08); },
    fanfare: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.14, 0.5, "triangle", 0.1)); },
  };

  function play(name) {
    if (muted || !effects[name]) return;
    try { effects[name](); } catch (_) { /* audio blocked — ignore */ }
  }

  function toggle() {
    muted = !muted;
    localStorage.setItem("tbwc26-muted", muted ? "1" : "0");
    return muted;
  }

  return { play, toggle, get muted() { return muted; } };
})();

/* ---------- Home view ---------- */

const HomeView = (() => {
  const { team, esc, flagImg } = Tournament;

  function matchCenterHTML(state) {
    if (!state.draw.completed) return "";
    Tournament.resolveKnockout(state);
    const played = state.matches.filter((m) => m.status === "played").slice(-4).reverse();
    const upcoming = state.matches.filter((m) => m.status !== "played" && m.teamA && m.teamB).slice(0, 4);
    if (!played.length && !upcoming.length) return "";
    const rows = (list) => list.map((m) => GroupsView.fixtureRowHTML(state, m)).join("");
    return `
      <div class="panel match-center">
        <h2 class="section-title" style="font-size:1.1rem">Match Center</h2>
        <div class="groups-page-grid" style="margin-top:16px">
          <div>
            <div class="fixtures-title" style="padding-left:0">LATEST RESULTS</div>
            ${rows(played) || '<p class="empty-note" style="padding:16px">No results yet.</p>'}
          </div>
          <div>
            <div class="fixtures-title" style="padding-left:0">UP NEXT</div>
            ${rows(upcoming) || '<p class="empty-note" style="padding:16px">All matches played!</p>'}
          </div>
        </div>
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("view-home");
    const drawDone = state.draw.completed;

    el.innerHTML = `
      <div class="home-top">
        <div class="panel stat-side">
          <div class="stat-block">
            <div class="stat-number">32</div>
            <div class="stat-label">TEAMS</div>
          </div>
          <div class="stat-divider"><i class="fa-solid fa-earth-americas"></i></div>
          <div class="stat-block">
            <div class="stat-number">8</div>
            <div class="stat-label">GROUPS</div>
          </div>
        </div>

        <div class="panel draw-stage">
          <div class="stage-lights"></div>
          <div class="draw-ball-wrap" style="width:200px;height:200px">
            <div class="draw-ball" style="width:170px;height:170px">
              <div class="ball-lines"></div>
              <i class="fa-solid fa-futbol"></i>
            </div>
          </div>
          <div class="pedestal"></div>
          <a class="btn-gold" href="#draw" style="margin-top:22px">
            ${drawDone
              ? '<i class="fa-solid fa-table-list"></i> VIEW THE GROUPS'
              : '<i class="fa-solid fa-users-viewfinder"></i> START OFFICIAL DRAW <i class="fa-solid fa-chevron-right"></i>'}
          </a>
          <div class="draw-hint"><i class="fa-solid fa-circle-info"></i>
            ${drawDone ? "The draw is complete — follow the groups live." : "The draw will distribute the 32 teams into 8 groups of 4"}
          </div>
        </div>

        <div class="panel howto">
          <h3>HOW IT WORKS</h3>
          <div class="howto-steps">
            <div class="howto-step"><span class="step-num">1</span><i class="fa-solid fa-hand-pointer"></i> Teams will be drawn randomly</div>
            <div class="howto-step"><span class="step-num">2</span><i class="fa-solid fa-people-group"></i> Each team is placed in a group</div>
            <div class="howto-step"><span class="step-num">3</span><i class="fa-solid fa-users"></i> 4 teams in each group</div>
            <div class="howto-step"><span class="step-num">4</span><i class="fa-solid fa-trophy"></i> Top 2 teams qualify for the knockout stage</div>
          </div>
        </div>
      </div>

      ${matchCenterHTML(state)}

      <h2 class="section-title" style="margin-top:34px">The Groups</h2>
      <p class="section-sub">${drawDone ? "The official groups of the Taher Bagh World Cup 2026" : "Awaiting the official draw…"}</p>
      <div class="groups-grid">${DrawView.groupsGridHTML(state, state.draw.groups)}</div>`;
  }

  return { render };
})();

/* ---------- App shell ---------- */

const App = (() => {
  let state = null;
  let route = "home";

  const VIEWS = {
    home: () => HomeView.render(state),
    draw: () => DrawView.render(state),
    groups: () => GroupsView.render(state),
    knockout: () => KnockoutView.render(state),
    stats: () => StatsView.render(state),
    admin: () => AdminView.render(state),
  };

  function navigate() {
    const hash = (location.hash || "#home").slice(1);
    route = VIEWS[hash] ? hash : "home";
    document.querySelectorAll(".view").forEach((v) => { v.hidden = true; });
    document.querySelectorAll(".nav-link").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === route));
    const el = document.getElementById(`view-${route}`);
    el.hidden = false;
    // retrigger the entry animation
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    VIEWS[route]();
    window.scrollTo({ top: 0 });
  }

  function setState(next) {
    state = next;
    startTicker();
    VIEWS[route]();
  }

  /* ----- toast ----- */

  let toastTimer = null;
  function toast(msg, isError) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.toggle("error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  /* ----- LIVE ticker ----- */

  let tickerTimer = null;
  let tickerIdx = 0;
  function startTicker() {
    const el = document.getElementById("live-ticker");
    const items = (state?.announcements || []).map((a) => a.text);
    if (!items.length) return;
    clearInterval(tickerTimer);
    el.textContent = items[0];
    tickerIdx = 0;
    if (items.length > 1) {
      tickerTimer = setInterval(() => {
        tickerIdx = (tickerIdx + 1) % items.length;
        el.textContent = items[tickerIdx];
      }, 6000);
    }
  }

  /* ----- sponsor banner ----- */

  async function loadSponsors() {
    let sponsors = [];
    try {
      sponsors = await (await fetch("data/sponsors.json")).json();
    } catch (_) { /* keep empty — placeholders below */ }
    if (!Array.isArray(sponsors) || !sponsors.length) {
      sponsors = Array.from({ length: 8 }, (_, i) => ({ name: `YOUR SPONSOR ${i + 1}` }));
    }
    const item = (s) => s.image
      ? `<span class="sponsor-item"><img src="${Tournament.esc(s.image)}" alt="${Tournament.esc(s.name)}"></span>`
      : `<span class="sponsor-item"><i class="fa-solid fa-handshake"></i>${Tournament.esc(s.name)}</span>`;
    // Duplicate the strip so the marquee loops seamlessly.
    const half = sponsors.map(item).join("");
    document.getElementById("sponsor-track").innerHTML = half + half;
  }

  /* ----- ambience ----- */

  function spawnParticles() {
    const wrap = document.getElementById("particles");
    for (let i = 0; i < 16; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      p.style.left = Math.random() * 100 + "vw";
      p.style.animationDuration = 7 + Math.random() * 9 + "s";
      p.style.animationDelay = -Math.random() * 12 + "s";
      p.style.opacity = 0.15 + Math.random() * 0.4;
      wrap.appendChild(p);
    }
  }

  function confetti() {
    const colors = ["#d4af37", "#f5d76e", "#ffffff", "#e04352", "#3f7fe0", "#35c26e"];
    for (let i = 0; i < 120; i++) {
      const c = document.createElement("div");
      c.className = "confetti-piece";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.transform = `rotate(${Math.random() * 360}deg)`;
      c.style.animation = `particle-fall ${2.4 + Math.random() * 2.4}s linear ${Math.random() * 0.9}s forwards`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 6500);
    }
  }

  /* ----- polling for live updates ----- */

  function startPolling() {
    setInterval(async () => {
      if (!state || route === "admin") return; // don't clobber edits in progress
      const fresh = await API.pollState(state.updatedAt);
      if (fresh) {
        state = fresh;
        startTicker();
        VIEWS[route]();
      }
    }, 15000);
  }

  /* ----- boot ----- */

  async function init() {
    spawnParticles();
    loadSponsors();

    const soundBtn = document.getElementById("sound-toggle");
    const soundIcon = document.getElementById("sound-icon");
    const syncSoundIcon = () => {
      soundIcon.className = Sound.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
    };
    syncSoundIcon();
    soundBtn.addEventListener("click", () => { Sound.toggle(); syncSoundIcon(); });

    state = await API.loadState();
    startTicker();
    window.addEventListener("hashchange", navigate);
    navigate();
    startPolling();
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    toast, confetti, setState,
    get state() { return state; },
  };
})();
