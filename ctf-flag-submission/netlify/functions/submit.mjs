import {
  json,
  readBody,
  authTeam,
  getData,
  mutateData,
  getTimer,
  statusOf,
  getFlag,
  flagEquals,
  scoreOf,
} from "../../shared/lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const auth = await authTeam(req);
  if (!auth) return json({ error: "Not signed in" }, 401);

  const timer = await getTimer();
  const status = statusOf(timer);
  if (status !== "running") {
    return json({ error: "Submissions are closed" }, 403);
  }

  const body = await readBody(req);
  const flagIndex = Number(body.flagIndex);
  if (![1, 2, 3, 4].includes(flagIndex)) return json({ error: "Invalid flag" }, 400);

  const flagText = typeof body.flagText === "string" ? body.flagText : "";
  if (!flagText.trim()) return json({ error: "Enter the flag" }, 400);

  const expected = getFlag(flagIndex);
  if (!expected) return json({ error: "Flag not configured" }, 500);

  if (!flagEquals(expected, flagText)) {
    return json({ correct: false, message: "Incorrect flag — no penalty applied" });
  }

  const alreadyByMe = await (async () => {
    const data = await getData();
    return data.submissions.some(
      (s) =>
        s.teamId === auth.team.id &&
        s.flagIndex === flagIndex &&
        s.memberEmail === auth.memberEmail
    );
  })();

  if (alreadyByMe) {
    return json({ correct: true, already: true, message: "You already submitted this flag" });
  }

  const now = Date.now();
  const saved = await mutateData((data) => {
    const dupe = data.submissions.some(
      (s) =>
        s.teamId === auth.team.id &&
        s.flagIndex === flagIndex &&
        s.memberEmail === auth.memberEmail
    );
    if (dupe) return { ok: true, dupe: true };
    data.submissions.push({
      teamId: auth.team.id,
      flagIndex,
      memberEmail: auth.memberEmail,
      at: now,
    });
    return { ok: true };
  });
  if (!saved.ok) return json({ error: saved.error || "Submission failed" }, saved.status || 500);
  if (saved.dupe) {
    return json({ correct: true, already: true, message: "You already submitted this flag" });
  }

  const data = await getData();
  const subs = data.submissions.filter((s) => s.teamId === auth.team.id);
  const flagsSolved = new Set(subs.map((s) => s.flagIndex)).size;

  return json({
    correct: true,
    already: false,
    message: "Correct flag!",
    score: scoreOf(subs, auth.team.id),
    flagsSolved,
  });
};
