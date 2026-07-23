/* ============================================================
   App bootstrap — router, state store, home view (hero +
   sponsor media grid), ticker, sponsor banner, ambience,
   visit beacon, live polling.
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
  const { esc, team, flagImg } = Tournament;
  let cdTimer = null;

  function mediaSlotHTML(slot, i) {
    if (slot && slot.src) {
      const media = slot.type === "video"
        ? `<video src="${esc(slot.src)}" controls playsinline preload="metadata"></video>`
        : `<img src="${esc(slot.src)}" alt="${esc(slot.caption || "Sponsor media")}" loading="lazy">`;
      return `
        <figure class="media-slot filled">
          ${media}
          ${slot.caption ? `<figcaption>${esc(slot.caption)}</figcaption>` : ""}
        </figure>`;
    }
    return `
      <div class="media-slot placeholder">
        <i class="fa-solid ${i % 2 ? "fa-clapperboard" : "fa-image"}"></i>
        <span>SPONSOR SHOWCASE</span>
        <small>Coming soon</small>
      </div>`;
  }

  function nextMatch(state) {
    if (!state.draw.completed) return null;
    Tournament.resolveBracket(state);
    return state.matches
      .filter((m) => m.status !== "played" && m.teamA && m.teamB)
      .sort((a, b) => (a.kickoff || "9999") < (b.kickoff || "9999") ? -1 : 1)[0] || null;
  }

  /* ---- premium stat cards (the "app" dashboard) ---- */

  function nextKickoffCard(state) {
    if (!state.draw.completed) {
      return `<a class="stat-card sc-blue" href="#draw">
        <div class="sc-icon"><i class="fa-solid fa-calendar-day"></i></div>
        <div class="sc-body"><div class="sc-label">NEXT KICK-OFF</div>
          <div class="sc-main">Awaiting the official draw</div></div></a>`;
    }
    const m = nextMatch(state);
    if (!m) {
      return `<a class="stat-card sc-blue" href="#bracket">
        <div class="sc-icon"><i class="fa-solid fa-flag-checkered"></i></div>
        <div class="sc-body"><div class="sc-label">NEXT KICK-OFF</div>
          <div class="sc-main">Tournament complete</div></div></a>`;
    }
    const a = team(state, m.teamA), b = team(state, m.teamB);
    const cd = m.kickoff
      ? `<div class="sc-extra" data-countdown="${esc(m.kickoff)}">—</div>`
      : `<div class="sc-extra sc-tbc">TBC</div>`;
    const side = (t) => `${flagImg(t, "sc-flag")} <span class="sc-ent"><span class="sc-ent-country">${esc(t.country)}</span><span class="sc-ent-team">${esc(t.teamName)}</span></span>`;
    return `<a class="stat-card sc-blue" href="#schedule">
      <div class="sc-icon"><i class="fa-solid fa-calendar-day"></i></div>
      <div class="sc-body">
        <div class="sc-label">NEXT KICK-OFF</div>
        <div class="sc-main">${side(a)} <span class="sc-v">v</span> ${side(b)}</div>
      </div>
      ${cd}</a>`;
  }

  function goldenBootCard(state) {
    const s = Tournament.topScorers(state)[0];
    const t = s ? team(state, s.teamId) : null;
    return `<a class="stat-card sc-gold" href="#awards">
      <div class="sc-icon"><i class="fa-solid fa-futbol"></i></div>
      <div class="sc-body">
        <div class="sc-label">GOLDEN BOOT</div>
        <div class="sc-main">${s ? esc(s.name) : "No goals yet"} ${s ? `<span class="sc-num">${s.goals}</span> <small>GLS</small>` : ""}</div>
        ${t ? `<div class="sc-sub">${esc(t.country)}</div>` : ""}
      </div></a>`;
  }

  function goldenGloveCard(state) {
    const g = Tournament.goldenGlove(state)[0];
    const t = g ? team(state, g.teamId) : null;
    return `<a class="stat-card sc-teal" href="#awards">
      <div class="sc-icon"><i class="fa-solid fa-mitten"></i></div>
      <div class="sc-body">
        <div class="sc-label">GOLDEN GLOVE</div>
        <div class="sc-main">${t ? esc(t.goalkeeper || t.country) : "To be decided"} ${g ? `<span class="sc-num">${g.ga}</span><small>/${g.played}</small>` : ""}</div>
        ${t ? `<div class="sc-sub">${esc(t.country)} · fewest conceded</div>` : ""}
      </div></a>`;
  }

  function statusCard(state) {
    if (!state.draw.completed) {
      return `<a class="stat-card sc-violet" href="#draw">
        <div class="sc-icon"><i class="fa-solid fa-shuffle"></i></div>
        <div class="sc-body"><div class="sc-label">TOURNAMENT STATUS</div>
          <div class="sc-main">Draw pending</div><div class="sc-sub">32 teams ready</div></div></a>`;
    }
    const champId = Tournament.champion(state);
    if (champId) {
      const c = team(state, champId);
      return `<a class="stat-card sc-violet crowned" href="#bracket">
        <div class="sc-icon"><i class="fa-solid fa-trophy"></i></div>
        <div class="sc-body"><div class="sc-label">CHAMPIONS</div>
          <div class="sc-main">${flagImg(c, "sc-flag")} <span class="sc-ent"><span class="sc-ent-country">${esc(c.country)}</span><span class="sc-ent-team">${esc(c.teamName)}</span></span></div></div></a>`;
    }
    const cr = Tournament.currentRound(state);
    const label = (Tournament.ROUNDS.find((r) => r.round === cr) || {}).label || "Knockouts";
    const alive = Tournament.aliveTeams(state).length;
    return `<a class="stat-card sc-violet" href="#bracket">
      <div class="sc-icon"><i class="fa-solid fa-fire"></i></div>
      <div class="sc-body"><div class="sc-label">CURRENT ROUND</div>
        <div class="sc-main">${esc(label)}</div><div class="sc-sub">${alive} teams remaining</div></div></a>`;
  }

  function startCountdown() {
    clearInterval(cdTimer);
    const els = document.querySelectorAll("[data-countdown]");
    if (!els.length) return;
    const tick = () => {
      els.forEach((el) => {
        const t = new Date(el.dataset.countdown).getTime() - Date.now();
        if (isNaN(t)) { el.textContent = "—"; return; }
        if (t <= 0) { el.textContent = "LIVE"; el.classList.add("cd-live"); return; }
        const d = Math.floor(t / 86400000);
        const h = Math.floor(t / 3600000) % 24;
        const m = Math.floor(t / 60000) % 60;
        const s = Math.floor(t / 1000) % 60;
        const p = (n) => String(n).padStart(2, "0");
        el.textContent = d > 0 ? `${d}d ${p(h)}h` : `${p(h)}:${p(m)}:${p(s)}`;
      });
    };
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  function render(state) {
    const el = document.getElementById("view-home");
    const drawDone = state.draw.completed;
    const media = state.media || [];
    const slots = Array.from({ length: 4 }, (_, i) => mediaSlotHTML(media[i], i));

    el.innerHTML = `
      <!-- Hero banner: THE ARENA -->
      <div class="app-hero panel">
        <div class="app-hero-bg" aria-hidden="true"><img class="trophy-spinner" src="assets/trophy.svg" alt=""></div>
        <div class="app-hero-body">
          <div class="app-hero-kicker"><span class="live-dot"></span> THE ARENA · ROAD TO GLORY</div>
          <h2 class="app-hero-title">TBFOOT WORLD CUP</h2>
          <p class="app-hero-tag">32 TEAMS · PURE KNOCKOUT · ONE CHAMPION</p>
          <a class="btn-gold app-hero-cta" href="#${drawDone ? "bracket" : "teams"}">
            ${drawDone ? '<i class="fa-solid fa-sitemap"></i> ENTER THE BRACKET' : '<i class="fa-solid fa-people-group"></i> MEET THE TEAMS'}
          </a>
        </div>
      </div>

      <!-- Tournament pulse: named stat cards -->
      <div class="app-section-head"><i class="fa-solid fa-bolt"></i> TOURNAMENT PULSE</div>
      <div class="stat-stack">
        ${nextKickoffCard(state)}
        ${goldenBootCard(state)}
        ${goldenGloveCard(state)}
        ${statusCard(state)}
      </div>

      <!-- Sponsors -->
      <div class="app-section-head"><i class="fa-solid fa-handshake"></i> OUR SPONSORS</div>
      <div class="media-grid">${slots.join("")}</div>`;

    startCountdown();

    if (window.gsap) {
      gsap.from(".app-hero-body > *", { opacity: 0, y: 22, duration: 0.6, stagger: 0.1, ease: "power3.out" });
      gsap.from(".stat-card", { opacity: 0, x: -18, duration: 0.45, stagger: 0.08, ease: "power2.out" });
      gsap.from(".media-slot", { opacity: 0, y: 16, duration: 0.4, stagger: 0.06, delay: 0.1, ease: "power2.out" });
    }
  }

  return { render };
})();

/* ---------- App shell ---------- */

const App = (() => {
  let state = null;
  let route = "home";

  const VIEWS = {
    home: () => HomeView.render(state),
    teams: () => TeamsView.render(state),
    bracket: () => BracketView.render(state),
    schedule: () => ScheduleView.render(state),
    awards: () => AwardsView.render(state),
    draw: () => DrawView.render(state),
    admin: () => AdminView.render(state),
  };

  // Show/hide admin-only nav links (e.g. Draw) based on login state.
  function refreshAdminNav() {
    const admin = API.isAdmin();
    document.querySelectorAll(".nav-link[data-admin-only]").forEach((a) => {
      a.hidden = !admin;
    });
  }

  function navigate() {
    const hash = (location.hash || "#home").slice(1);
    route = VIEWS[hash] ? hash : "home";
    refreshAdminNav();
    document.querySelectorAll(".view").forEach((v) => { v.hidden = true; });
    document.querySelectorAll(".nav-link").forEach((a) =>
      a.classList.toggle("active", a.dataset.route === route));
    const el = document.getElementById(`view-${route}`);
    el.hidden = false;
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

  /* ----- sponsor banner (global, on every tab) ----- */

  async function loadSponsors() {
    let sponsors = [];
    try {
      sponsors = await (await fetch("data/sponsors.json")).json();
    } catch (_) { /* placeholders below */ }
    if (!Array.isArray(sponsors) || !sponsors.length) {
      sponsors = Array.from({ length: 8 }, (_, i) => ({ name: `YOUR SPONSOR ${i + 1}` }));
    }
    const item = (s) => {
      const inner = s.image
        ? `<img src="${Tournament.esc(s.image)}" alt="${Tournament.esc(s.name)}">`
        : `<i class="fa-solid fa-handshake"></i>${Tournament.esc(s.name)}`;
      return s.link
        ? `<a class="sponsor-item" href="${Tournament.esc(s.link)}" target="_blank" rel="noopener noreferrer" title="${Tournament.esc(s.name)}">${inner}</a>`
        : `<span class="sponsor-item">${inner}</span>`;
    };
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
      if (!state || route === "admin" || route === "draw") return; // don't clobber edits/ceremony
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
    API.recordVisit();

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
    toast, confetti, setState, refreshAdminNav,
    get state() { return state; },
  };
})();
