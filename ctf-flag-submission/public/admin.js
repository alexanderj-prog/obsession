(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    token: sessionStorage.getItem("ctf_admin") || "",
    timer: { status: "idle", endsAt: null, startedAt: null },
    clockOffset: 0,
    poll: null,
  };

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

  function fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function effectiveStatus() {
    const t = state.timer;
    if (t.status === "running" && t.endsAt && now() >= t.endsAt) return "expired";
    return t.status;
  }

  // ---------- gate ----------

  $("gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert($("gate-alert"), "");
    try {
      const data = await api("/api/admin/login", {
        method: "POST",
        token: "",
        body: { password: $("gate-pass").value },
      });
      state.token = data.token;
      sessionStorage.setItem("ctf_admin", data.token);
      $("gate-pass").value = "";
      unlock();
    } catch (err) {
      showAlert($("gate-alert"), err.message, "error");
    }
  });

  $("logout-btn").addEventListener("click", () => {
    state.token = "";
    sessionStorage.removeItem("ctf_admin");
    stopPolling();
    $("panel").hidden = true;
    $("gate").hidden = false;
  });

  function unlock() {
    $("gate").hidden = true;
    $("panel").hidden = false;
    refreshAll();
    startPolling();
  }

  // ---------- timer controls ----------

  $("start-btn").addEventListener("click", async () => {
    showAlert($("panel-alert"), "");
    showAlert($("panel-success"), "");
    try {
      const t = await api("/api/admin/timer", { method: "POST", body: { action: "start" } });
      applyTimer(t);
      showAlert($("panel-success"), "Timer started — 2 hours on the clock.", "success");
    } catch (err) {
      if (err.status === 401) return lock();
      showAlert($("panel-alert"), err.message, "error");
    }
  });

  $("stop-btn").addEventListener("click", async () => {
    if (!confirm("Stop the timer now? Players will no longer be able to submit.")) return;
    showAlert($("panel-alert"), "");
    showAlert($("panel-success"), "");
    try {
      const t = await api("/api/admin/timer", { method: "POST", body: { action: "stop" } });
      applyTimer(t);
      showAlert($("panel-success"), "Timer stopped — submissions closed.", "success");
    } catch (err) {
      if (err.status === 401) return lock();
      showAlert($("panel-alert"), err.message, "error");
    }
  });

  function lock() {
    state.token = "";
    sessionStorage.removeItem("ctf_admin");
    stopPolling();
    $("panel").hidden = true;
    $("gate").hidden = false;
    showAlert($("gate-alert"), "Session expired — unlock again.", "error");
  }

  function applyTimer(t) {
    state.clockOffset = t.serverNow - Date.now();
    state.timer = t;
    renderTimer();
  }

  function renderTimer() {
    const st = effectiveStatus();
    const pill = $("status-pill");
    const clock = $("admin-clock");
    pill.className = "pill";
    clock.className = "admin-clock";

    $("meta-status").textContent = st.toUpperCase();
    $("meta-started").textContent = fmtTime(state.timer.startedAt);
    $("meta-ends").textContent = fmtTime(state.timer.endsAt);

    if (st === "idle") {
      pill.classList.add("waiting");
      pill.textContent = "Not started";
      clock.classList.add("idle");
      clock.textContent = "--:--:--";
      $("start-btn").disabled = false;
      $("stop-btn").disabled = true;
    } else if (st === "running") {
      pill.classList.add("live");
      pill.textContent = "Live";
      clock.classList.add("running");
      clock.textContent = fmtClock(state.timer.endsAt - now());
      $("start-btn").disabled = true;
      $("stop-btn").disabled = false;
    } else if (st === "expired") {
      pill.classList.add("closed");
      pill.textContent = "Time up";
      clock.classList.add("closed");
      clock.textContent = "00:00:00";
      $("start-btn").disabled = false;
      $("stop-btn").disabled = true;
    } else if (st === "stopped") {
      pill.classList.add("closed");
      pill.textContent = "Stopped";
      clock.classList.add("closed");
      clock.textContent = "CLOSED";
      $("start-btn").disabled = false;
      $("stop-btn").disabled = true;
    }
  }

  // ---------- leaderboard ----------

  function renderBoard(data) {
    const body = $("board-body");
    $("meta-teams").textContent = data.totalTeams;
    $("meta-subs").textContent = data.totalSubmissions;
    $("meta-refreshed").textContent = new Date(data.generatedAt).toLocaleTimeString();

    if (!data.rows.length) {
      body.innerHTML = `<tr><td colspan="5" style="color: var(--muted); text-align: center">No teams registered yet</td></tr>`;
      return;
    }

    body.innerHTML = "";
    data.rows.forEach((r) => {
      const tr = document.createElement("tr");
      if (r.rank <= 3 && r.score > 0) tr.className = "top";

      const rank = document.createElement("td");
      rank.className = "rank";
      rank.textContent = r.rank;

      const team = document.createElement("td");
      team.className = "team-cell";
      const strong = document.createElement("strong");
      strong.textContent = r.name;
      const small = document.createElement("small");
      small.textContent = r.members.join(", ");
      team.append(strong, small);

      const flags = document.createElement("td");
      const dots = document.createElement("div");
      dots.className = "flag-dots";
      r.flags.forEach((f, i) => {
        const d = document.createElement("span");
        d.className = "flag-dot" + (f.solved ? " on" : "");
        d.title = f.solved ? `Flag ${i + 1}: ${f.by}` : `Flag ${i + 1}: unsolved`;
        dots.appendChild(d);
      });
      flags.appendChild(dots);

      const score = document.createElement("td");
      score.className = "score-cell";
      score.textContent = r.score;

      const last = document.createElement("td");
      last.className = "time-cell";
      last.textContent = r.lastAt ? fmtTime(r.lastAt) : "—";

      tr.append(rank, team, flags, score, last);
      body.appendChild(tr);
    });
  }

  async function refreshAll() {
    try {
      const [board] = await Promise.all([api("/api/admin/leaderboard")]);
      applyTimer(board.timer);
      renderBoard(board);
    } catch (err) {
      if (err.status === 401) return lock();
      showAlert($("panel-alert"), err.message, "error");
    }
  }

  function startPolling() {
    stopPolling();
    state.poll = setInterval(refreshAll, 3000);
  }

  function stopPolling() {
    if (state.poll) clearInterval(state.poll);
    state.poll = null;
  }

  setInterval(() => {
    if (!$("panel").hidden && effectiveStatus() === "running") renderTimer();
  }, 500);

  // ---------- boot ----------

  (async function boot() {
    if (state.token) {
      try {
        await api("/api/admin/leaderboard");
        unlock();
        return;
      } catch {
        sessionStorage.removeItem("ctf_admin");
        state.token = "";
      }
    }
    $("gate").hidden = false;
  })();
})();
