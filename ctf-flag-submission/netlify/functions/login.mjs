import { json, readBody, getData, verifyPassword, createSession } from "../../shared/lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readBody(req);

  const teamName = typeof body.teamName === "string" ? body.teamName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const memberHint = typeof body.memberEmail === "string" ? body.memberEmail.trim().toLowerCase() : "";
  if (!teamName || !password) return json({ error: "Team name and password are required" }, 400);

  const data = await getData();
  const lower = teamName.toLowerCase();
  let team = null;
  for (const t of Object.values(data.teams)) {
    if (t.name.toLowerCase() === lower) {
      team = t;
      break;
    }
  }
  if (!team || !verifyPassword(password, team.passwordHash)) {
    return json({ error: "Incorrect team name or password" }, 401);
  }

  let memberEmail = team.members[0];
  if (team.members.length > 1) {
    if (!memberHint) {
      return json({ needsMemberChoice: true, members: team.members }, 200);
    }
    const match = team.members.find((m) => m === memberHint);
    if (!match) return json({ error: "That email is not on this team" }, 403);
    memberEmail = match;
  }

  const token = await createSession(team.id, memberEmail);
  return json({
    token,
    team: { id: team.id, name: team.name, members: team.members },
    memberEmail,
  });
};
