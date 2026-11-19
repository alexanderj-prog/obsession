(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    token: localStorage.getItem("ctf_token") || "",
    team: null,
    memberEmail: "",
    timer: { status: "idle", endsAt: null, startedAt: null },
    clockOffset: 0,
    flags: [],
    score: 0,
    pendingMembers: null,
  };

  const FLAG_TITLES = ["Flag 1", "Flag 2", "Flag 3", "Flag 4"];

  // ---------- helpers ----------

  async function api(path, { method = "GET", body, token } = {}) {
    const headers = { "content-type": "application/json" };
    const t = token !== undefined ? token : state.token;
    if (t) headers["authorization"] = `Bearer ${t}`;
    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function showAlert(el, msg, kind) {
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = msg;
    el.className = `alert ${kind}`;
    el.hidden = false;
  }

  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  function now() {
    return Date.now() + state.clockOffset;
  }

  // ---------- timer ----------

  async function refreshState() {
    try {
      const t = await api("/api/state", { token: "" });
      state.clockOffset = t.serverNow - Date.now();
      state.timer = t;
      renderTimer();
    } catch {
      /* keep last known state */
    }
  }

  function effectiveStatus() {
    const t = state.timer;
    if (t.status === "running" && t.endsAt && now() >= t.endsAt) return "expired";
    return t.status;
  }

  function renderTimer() {
    const pill = $("status-pill");
    const clock = $("clock");
    const label = $("clock-label");
    const st = effectiveStatus();

    pill.className = "pill";
    clock.className = "clock";

    if (st === "idle") {
      pill.classList.add("waiting");
      pill.textContent = "Not started";
      clock.classList.add("idle");
      clock.textContent = "--:--:--";
      label.textContent = "Waiting for admin to start";
    } else if (st === "running") {
      pill.classList.add("live");
      pill.textContent = "Live";
      clock.textContent = fmtClock(state.timer.endsAt - now());
      const started = state.timer.startedAt
        ? new Date(state.timer.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "?";
      label.textContent = `Running since ${started} · 2 hour window`;
    } else if (st === "expired") {
      pill.classList.add("closed");
      pill.textContent = "Time up";
      clock.classList.add("expired");
      clock.textContent = "00:00:00";
      label.textContent = "Time is up — submissions closed";
    } else if (st === "stopped") {
      pill.classList.add("closed");
      pill.textContent = "Stopped";
      clock.classList.add("stopped");
      clock.textContent = "CLOSED";
      label.textContent = "Admin stopped the timer — submissions closed";
    }

    const canSubmit = st === "running";
    document.querySelectorAll(".flag-form input, .flag-form button").forEach((el) => {
      const card = el.closest(".flag-card");
      const solved = card && card.classList.contains("solved");
      el.disabled = !canSubmit || solved;
    });
    if (state.flags.length) renderFlags();
  }

  setInterval(() => {
    if (effectiveStatus() === "running") renderTimer();
  }, 500);

  setInterval(refreshState, 15000);

  // ---------- auth tabs ----------

  function selectTab(name) {
    const isLogin = name === "login";
    $("tab-login").setAttribute("aria-selected", String(isLogin));
    $("tab-register").setAttribute("aria-selected", String(!isLogin));
    $("panel-login").hidden = !isLogin;
    $("panel-register").hidden = isLogin;
    showAlert($("auth-alert"), "");
  }

  $("tab-login").addEventListener("click", () => selectTab("login"));
  $("tab-register").addEventListener("click", () => selectTab("register"));

  // ---------- register ----------

  $("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert($("auth-alert"), "");
    const f = e.target;
    try {
      const data = await api("/api/register", {
        method: "POST",
        token: "",
        body: {
          teamName: f.teamName.value,
          password: f.password.value,
          member1: f.member1.value,
          member2: f.member2.value || "",
        },
      });
      saveSession(data);
      await enterDash();
    } catch (err) {
      showAlert($("auth-alert"), err.message, "error");
    }
  });

  // ---------- login ----------

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert($("auth-alert"), "");
    const f = e.target;
    try {
      const data = await api("/api/login", {
        method: "POST",
        token: "",
        body: {
          teamName: f.teamName.value,
          password: f.password.value,
          memberEmail: state.pendingMembers ? f.memberEmail.value : "",
        },
      });
      if (data.needsMemberChoice) {
        state.pendingMembers = data.members;
        const field = $("login-member-field");
        const sel = $("login-member");
        sel.innerHTML = "";
        data.members.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m;
          sel.appendChild(opt);
        });
        field.hidden = false;
        showAlert($("auth-alert"), "Two members registered — pick your email to continue.", "success");
        return;
      }
      state.pendingMembers = null;
      $("login-member-field").hidden = true;
      saveSession(data);
      await enterDash();
    } catch (err) {
      showAlert($("auth-alert"), err.message, "error");
    }
  });

  function saveSession(data) {
    state.token = data.token;
    state.team = data.team;
    state.memberEmail = data.memberEmail;
    localStorage.setItem("ctf_token", data.token);
  }

  function clearSession() {
    state.token = "";
    state.team = null;
    state.memberEmail = "";
    state.flags = [];
    state.score = 0;
    localStorage.removeItem("ctf_token");
  }

  // ---------- dashboard ----------

  function renderFlags() {
    const grid = $("flags-grid");
    const st = effectiveStatus();
    const canSubmit = st === "running";

    if (grid.children.length !== 4) {
      grid.innerHTML = "";
      FLAG_TITLES.forEach((title, i) => {
        const n = i + 1;
        const card = document.createElement("article");
        card.className = "flag-card";
        card.dataset.flag = String(n);
        card.innerHTML = `
          <header>
            <h3>${title}</h3>
            <span class="flag-state">Pending</span>
          </header>
          <form class="flag-form">
            <label class="sr-only" for="flag-input-${n}">${title} value</label>
            <input id="flag-input-${n}" type="text" placeholder="FLAG${n}{...}" autocomplete="off"
              autocapitalize="off" spellcheck="false" />
            <button class="btn btn-primary btn-sm" type="submit">Submit</button>
          </form>
          <p class="flag-solved-by" hidden></p>
          <p class="flag-msg" aria-live="polite"></p>
        `;
        grid.appendChild(card);
        card.querySelector("form").addEventListener("submit", onFlagSubmit);
      });
    }

    state.flags.forEach((f) => {
      const card = grid.querySelector(`.flag-card[data-flag="${f.flagIndex}"]`);
      if (!card) return;
      const solved = f.solved;
      card.classList.toggle("solved", solved);
      card.querySelector(".flag-state").textContent = solved ? "Solved" : "Pending";
      const by = card.querySelector(".flag-solved-by");
      if (solved) {
        by.hidden = false;
        const when = f.submittedAt ? new Date(f.submittedAt).toLocaleTimeString() : "";
        by.textContent = `Solved by ${f.solvedBy}${when ? ` · ${when}` : ""}`;
      } else {
        by.hidden = true;
        by.textContent = "";
      }
      const input = card.querySelector("input");
      const btn = card.querySelector("button");
      const busy = card.dataset.busy === "1";
      const locked = solved || !canSubmit || busy;
      input.disabled = locked;
      btn.disabled = locked;
      if (solved) input.value = "";
    });
  }

  async function onFlagSubmit(e) {
    e.preventDefault();
    const card = e.target.closest(".flag-card");
    const n = Number(card.dataset.flag);
    const input = card.querySelector("input");
    const msg = card.querySelector(".flag-msg");
    const btn = card.querySelector("button");
    const text = input.value.trim();
    msg.textContent = "";
    msg.className = "flag-msg";
    if (!text) return;

    card.dataset.busy = "1";
    btn.disabled = true;
    try {
      const data = await api("/api/submit", {
        method: "POST",
        body: { flagIndex: n, flagText: text },
      });
      if (data.correct) {
        msg.textContent = data.message;
        msg.className = "flag-msg ok";
        input.value = "";
        showAlert($("dash-success"), `Flag ${n}: ${data.message}`, "success");
        showAlert($("dash-alert"), "");
        await refreshMe();
      } else {
        msg.textContent = data.message || "Incorrect flag";
        msg.className = "flag-msg err";
      }
    } catch (err) {
      msg.textContent = err.message;
      msg.className = "flag-msg err";
      if (err.status === 401) {
        clearSession();
        showAuth();
      } else if (err.status === 403) {
        await refreshState();
        renderTimer();
      }
    } finally {
      delete card.dataset.busy;
      const stillSolved = card.classList.contains("solved");
      btn.disabled = stillSolved || effectiveStatus() !== "running";
    }
  }

  async function refreshMe() {
    const data = await api("/api/me");
    state.team = data.team;
    state.memberEmail = data.memberEmail;
    state.flags = data.flags;
    state.score = data.score;
    state.timer = data.timer;
    state.clockOffset = data.timer.serverNow - Date.now();
    renderDashMeta();
    renderFlags();
    renderTimer();
  }

  function renderDashMeta() {
    $("team-name").textContent = state.team.name;
    $("team-sub").textContent = state.team.members.join(" · ");
    const chip = $("score-chip");
    chip.textContent = `${state.score} / 100`;
    chip.classList.toggle("zero", state.score === 0);
  }

  function showAuth() {
    $("auth-section").hidden = false;
    $("dash-section").hidden = true;
  }

  function showDash() {
    $("auth-section").hidden = true;
    $("dash-section").hidden = false;
  }

  async function enterDash() {
    try {
      await refreshMe();
      showDash();
    } catch (err) {
      if (err.status === 401) {
        clearSession();
        showAuth();
      } else {
        showAlert($("auth-alert"), err.message, "error");
        showAuth();
      }
    }
  }

  $("logout-btn").addEventListener("click", () => {
    clearSession();
    showAuth();
    selectTab("login");
  });

  // ---------- boot ----------

  (async function boot() {
    await refreshState();
    if (state.token) {
      await enterDash();
    } else {
      showAuth();
    }
    setInterval(() => {
      if (state.token && !$("dash-section").hidden) {
        refreshMe().catch(() => {});
      }
    }, 20000);
  })();
})();
