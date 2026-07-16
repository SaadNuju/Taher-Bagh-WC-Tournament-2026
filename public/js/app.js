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
  const { esc } = Tournament;

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

  function nextMatchesHTML(state) {
    if (!state.draw.completed) return "";
    Tournament.resolveBracket(state);
    const upcoming = state.matches
      .filter((m) => m.status !== "played" && m.teamA && m.teamB)
      .sort((a, b) => (a.kickoff || "9999") < (b.kickoff || "9999") ? -1 : 1)
      .slice(0, 4);
    if (!upcoming.length) return "";
    const { team, flagImg } = Tournament;
    const rows = upcoming.map((m) => {
      const a = team(state, m.teamA), b = team(state, m.teamB);
      return `
        <div class="fixture-row">
          <div class="fx-team">${flagImg(a)}<span>${esc(a.country)}</span></div>
          <div class="fx-score pending">VS</div>
          <div class="fx-team right"><span>${esc(b.country)}</span>${flagImg(b)}</div>
        </div>`;
    }).join("");
    return `
      <div class="panel match-center">
        <h2 class="section-title" style="font-size:1.05rem">UP NEXT</h2>
        <div style="margin-top:12px">${rows}</div>
        <p class="center" style="margin-top:14px"><a class="btn-outline" href="#schedule"><i class="fa-regular fa-clock"></i> Full schedule</a></p>
      </div>`;
  }

  function render(state) {
    const el = document.getElementById("view-home");
    const media = state.media || [];
    const slots = Array.from({ length: 4 }, (_, i) => mediaSlotHTML(media[i], i));

    el.innerHTML = `
      <div class="hero">
        <div class="hero-trophy-bg" aria-hidden="true">
          <div class="trophy-spinner"><i class="fa-solid fa-trophy"></i></div>
        </div>
        <div class="hero-content">
          <h2 class="hero-title">TAHER BAGH</h2>
          <p class="hero-sub">WORLD CUP TOURNAMENT 2026</p>
          <p class="hero-tag">32 TEAMS · PURE KNOCKOUT · ONE CHAMPION</p>
          <div class="hero-ctas">
            <a class="btn-gold" href="#${state.draw.completed ? "bracket" : "teams"}">
              ${state.draw.completed
                ? '<i class="fa-solid fa-sitemap"></i> VIEW THE BRACKET'
                : '<i class="fa-solid fa-people-group"></i> MEET THE TEAMS'}
            </a>
            <a class="btn-outline" href="#schedule"><i class="fa-regular fa-clock"></i> MATCH SCHEDULE</a>
          </div>
        </div>
      </div>

      <h2 class="section-title" style="margin-top:36px">Our Sponsors</h2>
      <p class="section-sub">Proudly supported by our partners</p>
      <div class="media-grid">${slots.join("")}</div>

      ${nextMatchesHTML(state)}`;

    if (window.gsap) {
      gsap.from(".hero-content > *", { opacity: 0, y: 24, duration: 0.7, stagger: 0.12, ease: "power3.out" });
      gsap.from(".media-slot", { opacity: 0, y: 18, duration: 0.5, stagger: 0.08, delay: 0.3, ease: "power2.out" });
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

  function navigate() {
    const hash = (location.hash || "#home").slice(1);
    route = VIEWS[hash] ? hash : "home";
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
    const item = (s) => s.image
      ? `<span class="sponsor-item"><img src="${Tournament.esc(s.image)}" alt="${Tournament.esc(s.name)}"></span>`
      : `<span class="sponsor-item"><i class="fa-solid fa-handshake"></i>${Tournament.esc(s.name)}</span>`;
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
    toast, confetti, setState,
    get state() { return state; },
  };
})();
