import { json, authAdmin, getData, getTimer, publicTimer } from "../../shared/lib.mjs";

export default async (req) => {
  const admin = await authAdmin(req);
  if (!admin) return json({ error: "Unauthorized" }, 401);

  const data = await getData();
  const timer = await getTimer();

  const rows = Object.values(data.teams).map((t) => {
    const subs = data.submissions.filter((s) => s.teamId === t.id);
    const flags = [1, 2, 3, 4].map((n) => {
      const f = subs.filter((s) => s.flagIndex === n).sort((a, b) => a.at - b.at);
      return f.length > 0
        ? { solved: true, by: f[0].memberEmail, at: f[0].at, count: f.length }
        : { solved: false, by: null, at: null, count: 0 };
    });
    const solvedCount = flags.filter((f) => f.solved).length;
    const lastAt = subs.length > 0 ? Math.max(...subs.map((s) => s.at)) : null;
    return {
      id: t.id,
      name: t.name,
      members: t.members,
      flags,
      solvedCount,
      score: solvedCount * 25,
      lastAt,
      createdAt: t.createdAt,
      totalSubmissions: subs.length,
    };
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ae = a.lastAt ?? Number.MAX_SAFE_INTEGER;
    const be = b.lastAt ?? Number.MAX_SAFE_INTEGER;
    if (ae !== be) return ae - be;
    return a.createdAt - b.createdAt;
  });
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  return json({
    timer: publicTimer(timer),
    generatedAt: Date.now(),
    totalTeams: rows.length,
    totalSubmissions: data.submissions.length,
    rows,
  });
};
