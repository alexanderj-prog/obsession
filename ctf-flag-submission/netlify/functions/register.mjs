import {
  json,
  readBody,
  requireField,
  TEAM_NAME_RE,
  EMAIL_RE,
  getData,
  mutateData,
  reserveKey,
  releaseKey,
  createSession,
  hashPassword,
} from "../../shared/lib.mjs";

function validEmail(v) {
  return typeof v === "string" && v.length <= 100 && EMAIL_RE.test(v.trim());
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readBody(req);

  const teamName = requireField(body, "teamName", { min: 2, max: 32 });
  const password = requireField(body, "password", { min: 6, max: 100 });
  if (!teamName || !TEAM_NAME_RE.test(teamName)) {
    return json({ error: "Team name must be 2-32 characters (letters, numbers, spaces, . _ -)" }, 400);
  }
  if (!password) return json({ error: "Password must be at least 6 characters" }, 400);

  const m1 = typeof body.member1 === "string" ? body.member1.trim().toLowerCase() : "";
  const m2 = typeof body.member2 === "string" ? body.member2.trim().toLowerCase() : "";
  if (!validEmail(m1)) return json({ error: "Member 1 email must be like name@course.christuniversity.in" }, 400);
  if (m2 && !validEmail(m2)) return json({ error: "Member 2 email must be like name@course.christuniversity.in" }, 400);
  if (m2 && m2 === m1) return json({ error: "Both members must have different emails" }, 400);

  const maxTeams = Number(process.env.MAX_TEAMS) || 40;
  const existing = await getData();
  if (Object.keys(existing.teams).length >= maxTeams) {
    return json({ error: "Registration is full" }, 403);
  }

  const nameKey = `teamname:${teamName.toLowerCase()}`;
  const nameOk = await reserveKey(nameKey, "1");
  if (!nameOk) return json({ error: "That team name is already taken" }, 409);

  const emailKeys = [`email:${m1}`];
  if (m2) emailKeys.push(`email:${m2}`);
  for (const k of emailKeys) {
    const ok = await reserveKey(k, "1");
    if (!ok) {
      for (const kk of emailKeys) await releaseKey(kk);
      await releaseKey(nameKey);
      return json({ error: "A member is already registered on another team" }, 409);
    }
  }

  const id = crypto.randomUUID();
  const members = m2 ? [m1, m2] : [m1];
  const team = {
    id,
    name: teamName,
    passwordHash: hashPassword(password),
    members,
    createdAt: Date.now(),
  };

  const saved = await mutateData((data) => {
    data.teams[id] = team;
    return { ok: true };
  });
  if (!saved.ok) {
    for (const k of emailKeys) await releaseKey(k);
    await releaseKey(nameKey);
    return json({ error: saved.error || "Registration failed" }, saved.status || 500);
  }

  const token = await createSession(id, members[0]);
  return json({
    token,
    team: { id, name: team.name, members: team.members },
    memberEmail: members[0],
  });
};
