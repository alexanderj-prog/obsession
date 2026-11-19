import { json, authTeam, getData, getTimer, publicTimer, scoreOf } from "../../shared/lib.mjs";

export default async (req) => {
  const auth = await authTeam(req);
  if (!auth) return json({ error: "Not signed in" }, 401);

  const data = await getData();
  const timer = await getTimer();
  const subs = data.submissions.filter((s) => s.teamId === auth.team.id);

  const flags = [1, 2, 3, 4].map((n) => {
    const mine = subs.filter((s) => s.flagIndex === n && s.memberEmail === auth.memberEmail);
    const any = subs.filter((s) => s.flagIndex === n);
    return {
      flagIndex: n,
      solved: any.length > 0,
      solvedBy: any.length > 0 ? any.sort((a, b) => a.at - b.at)[0].memberEmail : null,
      submittedByMe: mine.length > 0,
      submittedAt: any.length > 0 ? any.sort((a, b) => a.at - b.at)[0].at : null,
    };
  });

  const lastAt = subs.length > 0 ? Math.max(...subs.map((s) => s.at)) : null;

  return json({
    team: { id: auth.team.id, name: auth.team.name, members: auth.team.members },
    memberEmail: auth.memberEmail,
    flags,
    score: scoreOf(subs, auth.team.id),
    maxScore: 100,
    lastAt,
    timer: publicTimer(timer),
  });
};
