import assert from "node:assert/strict";

process.env.FLAG1 = "FLAG1{R0bert_P4ttins0n_J4mes_B0nd}";
process.env.FLAG2 = "FLAG2{R0bert_P4ttins0n_B4tM4n}";
process.env.FLAG3 = "FLAG3{R0bert_P4ttins0n_Antin0us}";
process.env.FLAG4 = "FLAG4{R0bert_P4ttins0n_P3n3tr4ti0n_T3st3r}";
process.env.ADMIN_PASSWORD = "noxeye";

const reg = (await import("../netlify/functions/register.mjs")).default;
const login = (await import("../netlify/functions/login.mjs")).default;
const me = (await import("../netlify/functions/me.mjs")).default;
const submit = (await import("../netlify/functions/submit.mjs")).default;
const state = (await import("../netlify/functions/state.mjs")).default;
const adminLogin = (await import("../netlify/functions/admin-login.mjs")).default;
const adminTimer = (await import("../netlify/functions/admin-timer.mjs")).default;
const adminBoard = (await import("../netlify/functions/admin-leaderboard.mjs")).default;

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log("  ✓ " + msg);
}

const req = (body, { method = "POST", token, path = "/x" } = {}) =>
  new Request(`http://test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const call = async (fn, r) => {
  const res = await fn(r);
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
};

console.log("\n— state —");
{
  const { status, data } = await call(state, req(undefined, { method: "GET" }));
  ok(status === 200 && data.status === "idle", "initial state is idle");
}

console.log("\n— registration —");
{
  const { status, data } = await call(reg, req({
    teamName: "Flag Hunters",
    password: "secret1",
    member1: "Alex.J@msaic.christuniversity.in",
    member2: "sam.k@cse.christuniversity.in",
  }));
  ok(status === 200 && data.token, "2-member team registers, returns token");
  globalThis.t1 = data;

  const dup = await call(reg, req({
    teamName: "flag hunters",
    password: "secret1",
    member1: "other@msaic.christuniversity.in",
  }));
  ok(dup.status === 409, "duplicate team name (case-insensitive) rejected");

  const badEmail = await call(reg, req({
    teamName: "Evil Team",
    password: "secret1",
    member1: "hacker@gmail.com",
  }));
  ok(badEmail.status === 400, "non-christuniversity.in email rejected");

  const noCourse = await call(reg, req({
    teamName: "No Course",
    password: "secret1",
    member1: "x@christuniversity.in",
  }));
  ok(noCourse.status === 400, "email without coursename rejected");

  const sameEmail = await call(reg, req({
    teamName: "Twin Team",
    password: "secret1",
    member1: "solo@msaic.christuniversity.in",
    member2: "solo@msaic.christuniversity.in",
  }));
  ok(sameEmail.status === 400, "same email twice in one team rejected");

  const stolen = await call(reg, req({
    teamName: "Copy Team",
    password: "secret1",
    member1: "alex.j@msaic.christuniversity.in",
  }));
  ok(stolen.status === 409, "email already on another team rejected");

  const solo = await call(reg, req({
    teamName: "Solo Runner",
    password: "secret2",
    member1: " lone@mtech.christuniversity.in ",
  }));
  ok(solo.status === 200, "solo team registers");
  globalThis.t2 = solo.data;

  const shortPass = await call(reg, req({
    teamName: "Weak Team",
    password: "abc",
    member1: "w@msaic.christuniversity.in",
  }));
  ok(shortPass.status === 400, "short password rejected");
}

console.log("\n— login —");
{
  const bad = await call(login, req({ teamName: "Flag Hunters", password: "wrong" }));
  ok(bad.status === 401, "wrong password rejected");

  const need = await call(login, req({ teamName: "Flag Hunters", password: "secret1" }));
  ok(need.status === 200 && need.data.needsMemberChoice && need.data.members?.length === 2,
    "2-member team without memberEmail → needsMemberChoice");

  const as1 = await call(login, req({
    teamName: "Flag Hunters",
    password: "secret1",
    memberEmail: "alex.j@msaic.christuniversity.in",
  }));
  ok(as1.status === 200 && as1.data.token, "member 1 signs in");
  globalThis.t1m1 = as1.data;

  const as2 = await call(login, req({
    teamName: "flag hunters",
    password: "secret1",
    memberEmail: "SAM.K@cse.christuniversity.in",
  }));
  ok(as2.status === 200 && as2.data.memberEmail === "sam.k@cse.christuniversity.in",
    "member 2 signs in, email normalized to lowercase");
  globalThis.t1m2 = as2.data;

  const wrongMember = await call(login, req({
    teamName: "Flag Hunters",
    password: "secret1",
    memberEmail: "nobody@msaic.christuniversity.in",
  }));
  ok(wrongMember.status === 403, "memberEmail not on team rejected");

  const solo = await call(login, req({ teamName: "Solo Runner", password: "secret2" }));
  ok(solo.status === 200 && solo.data.token && !solo.data.needsMemberChoice,
    "solo team signs in without member choice");
  globalThis.t2s = solo.data;

  const badToken = await call(me, req(undefined, { method: "GET", token: "bogus" }));
  ok(badToken.status === 401, "bogus token rejected by /me");
}

console.log("\n— timer gating —");
{
  const s = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t1m1.token }));
  ok(s.status === 403, "submit before admin start → 403");

  const noAdmin = await call(adminTimer, req({ action: "start" }, { token: "nope" }));
  ok(noAdmin.status === 401, "timer start without admin token → 401");

  const badPw = await call(adminLogin, req({ password: "wrong" }));
  ok(badPw.status === 401, "wrong admin password rejected");

  const good = await call(adminLogin, req({ password: "noxeye" }));
  ok(good.status === 200 && good.data.token, "admin password 'noxeye' accepted");
  globalThis.admin = good.data.token;

  const noBoard = await call(adminBoard, req(undefined, { method: "GET", token: "nope" }));
  ok(noBoard.status === 401, "leaderboard without admin token → 401");

  const start = await call(adminTimer, req({ action: "start" }, { token: admin }));
  ok(start.status === 200 && start.data.status === "running" &&
     start.data.endsAt - start.data.startedAt === 2 * 60 * 60 * 1000,
    "admin start → running with exact 2h window");
}

console.log("\n— submissions —");
{
  const wrong = await call(submit, req({ flagIndex: 1, flagText: "FLAG1{nope}" },
    { token: t1m1.token }));
  ok(wrong.status === 200 && wrong.data.correct === false, "wrong flag → 200, correct:false, no penalty");

  const empty = await call(submit, req({ flagIndex: 1, flagText: "   " }, { token: t1m1.token }));
  ok(empty.status === 400, "empty flag text → 400");

  const badIdx = await call(submit, req({ flagIndex: 9, flagText: "x" }, { token: t1m1.token }));
  ok(badIdx.status === 400, "flagIndex 9 → 400");

  const f1 = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t1m1.token }));
  ok(f1.status === 200 && f1.data.correct === true && f1.data.score === 25,
    "member 1 submits flag 1 → correct, score 25");

  const again = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t1m1.token }));
  ok(again.status === 200 && again.data.already === true, "same member resubmits flag 1 → already");

  const m2same = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t1m2.token }));
  ok(m2same.status === 200 && m2same.data.correct === true && m2same.data.score === 25,
    "teammate submits SAME flag 1 → accepted, team score stays 25 (no double count)");

  const f2 = await call(submit, req({ flagIndex: 2, flagText: process.env.FLAG2 },
    { token: t1m1.token }));
  ok(f2.data.score === 50, "flag 2 → score 50");

  const f3 = await call(submit, req({ flagIndex: 3, flagText: process.env.FLAG3 },
    { token: t1m2.token }));
  ok(f3.data.score === 75, "flag 3 by member 2 → score 75");

  const f4 = await call(submit, req({ flagIndex: 4, flagText: " " + process.env.FLAG4 + " " },
    { token: t1m1.token }));
  ok(f4.data.score === 100 && f4.data.flagsSolved === 4,
    "flag 4 with surrounding whitespace → score 100");

  const soloF = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t2s.token }));
  ok(soloF.status === 200 && soloF.data.score === 25, "solo team can submit");

  const m = await call(me, req(undefined, { method: "GET", token: t1m1.token }));
  ok(m.status === 200 && m.data.score === 100 && m.data.flags.every((f) => f.solved),
    "/me shows score 100, all 4 solved");
  ok(m.data.flags[0].submittedByMe === true && m.data.flags[2].submittedByMe === false,
    "/me distinguishes my submits vs teammate's");
  ok(m.data.timer.status === "running", "/me includes running timer");
}

console.log("\n— leaderboard —");
{
  const { status, data } = await call(adminBoard, req(undefined, { method: "GET", token: admin }));
  ok(status === 200 && data.rows.length === 2, "admin sees both teams");
  ok(data.rows[0].name === "Flag Hunters" && data.rows[0].score === 100 &&
     data.rows[0].rank === 1, "100-pt team ranked #1");
  ok(data.rows[1].name === "Solo Runner" && data.rows[1].score === 25 &&
     data.rows[1].rank === 2, "25-pt team ranked #2");
  ok(data.rows[0].flags.every((f) => f.solved) && data.rows[0].lastAt !== null,
    "row has per-flag detail and lastAt (tie-break end time)");
  const raw = JSON.stringify(data);
  ok(!raw.includes("R0bert") && !raw.includes("passwordHash") &&
     !raw.includes("secret1"), "leaderboard leaks no flags or password hashes");

  const meRaw = JSON.stringify((await call(me, req(undefined, { method: "GET", token: t1m1.token }))).data);
  ok(!meRaw.includes("R0bert") && !meRaw.includes("passwordHash"), "/me leaks no flags or hashes");
}

console.log("\n— stop —");
{
  const twice = await call(adminTimer, req({ action: "start" }, { token: admin }));
  ok(twice.status === 409, "second start while running → 409");

  const stop = await call(adminTimer, req({ action: "stop" }, { token: admin }));
  ok(stop.status === 200 && stop.data.status === "stopped", "admin stop → stopped");

  const after = await call(submit, req({ flagIndex: 2, flagText: process.env.FLAG2 },
    { token: t2s.token }));
  ok(after.status === 403, "submit after stop → 403");

  const stopAgain = await call(adminTimer, req({ action: "stop" }, { token: admin }));
  ok(stopAgain.status === 409, "double stop → 409");

  const restart = await call(adminTimer, req({ action: "start" }, { token: admin }));
  ok(restart.status === 200 && restart.data.status === "running",
    "admin can restart after stop (fresh 2h window)");

  const unknown = await call(adminTimer, req({ action: "explode" }, { token: admin }));
  ok(unknown.status === 400, "unknown timer action → 400");

  const getTimer = (await import("../netlify/functions/state.mjs"));
  const st = await call(getTimer.default, req(undefined, { method: "GET" }));
  ok(st.data.status === "running", "public state reflects running after restart");
}

console.log("\n— expired timer —");
{
  const { saveTimer } = await import("../shared/lib.mjs");
  await saveTimer({ startedAt: Date.now() - 3 * 60 * 60 * 1000,
                    endsAt: Date.now() - 60 * 60 * 1000, running: true });
  const st = await call(state, req(undefined, { method: "GET" }));
  ok(st.data.status === "expired", "past endsAt + running → expired");
  const sub = await call(submit, req({ flagIndex: 1, flagText: process.env.FLAG1 },
    { token: t1m1.token }));
  ok(sub.status === 403, "submit while expired → 403");
  const restart = await call(adminTimer, req({ action: "start" }, { token: admin }));
  ok(restart.status === 200, "admin can start a new window after expiry");
}

console.log("\n— method guards —");
{
  ok((await call(reg, req(undefined, { method: "GET" }))).status === 405, "register GET → 405");
  ok((await call(login, req(undefined, { method: "GET" }))).status === 405, "login GET → 405");
  ok((await call(submit, req(undefined, { method: "GET", token: t1m1.token }))).status === 405,
    "submit GET → 405");
  ok((await call(adminLogin, req(undefined, { method: "GET" }))).status === 405,
    "admin-login GET → 405");
}

console.log(`\nALL ${passed} ASSERTIONS PASSED\n`);
