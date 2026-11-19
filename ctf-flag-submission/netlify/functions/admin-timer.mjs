import { json, readBody, authAdmin, getTimer, saveTimer, publicTimer, DURATION_MS } from "../../shared/lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = await authAdmin(req);
  if (!admin) return json({ error: "Unauthorized" }, 401);

  const body = await readBody(req);
  const action = body.action;
  const current = await getTimer();

  if (action === "start") {
    if (current.running && Date.now() < current.endsAt) {
      return json({ error: "Timer is already running" }, 409);
    }
    const now = Date.now();
    const next = { startedAt: now, endsAt: now + DURATION_MS, running: true };
    await saveTimer(next);
    return json(publicTimer(next));
  }

  if (action === "stop") {
    if (!current.running || Date.now() >= current.endsAt) {
      return json({ error: "Timer is not running" }, 409);
    }
    const next = { ...current, running: false };
    await saveTimer(next);
    return json(publicTimer(next));
  }

  if (action === "status") {
    return json(publicTimer(current));
  }

  return json({ error: "Unknown action" }, 400);
};
