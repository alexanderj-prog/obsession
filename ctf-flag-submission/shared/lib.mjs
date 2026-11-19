import { getStore } from "@netlify/blobs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const DURATION_MS = 2 * 60 * 60 * 1000;
export const EMAIL_RE = /^[^@\s]+@(?:[a-z0-9-]+\.)+christuniversity\.in$/i;
export const TEAM_NAME_RE = /^[\w .-]{2,32}$/;

export function db() {
  return getStore({ name: "ctf", consistency: "strong" });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function readBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, "hex");
  if (test.length !== orig.length) return false;
  return timingSafeEqual(test, orig);
}

export function flagEquals(expected, got) {
  if (!expected || typeof got !== "string") return false;
  const a = createHash("sha256").update(got.trim()).digest();
  const b = createHash("sha256").update(String(expected).trim()).digest();
  return timingSafeEqual(a, b);
}

export function getFlag(n) {
  return process.env[`FLAG${n}`] || "";
}

export function checkAdminPassword(pw) {
  const expected = String(process.env.ADMIN_PASSWORD || "noxeye").trim();
  const a = createHash("sha256").update(String(pw ?? "")).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function getTimer() {
  const t = await db().get("timer", { type: "json" });
  return t || { startedAt: null, endsAt: null, running: false };
}

export async function saveTimer(t) {
  await db().setJSON("timer", t);
}

export function statusOf(t, now = Date.now()) {
  if (!t.startedAt) return "idle";
  if (!t.running) return "stopped";
  if (now >= t.endsAt) return "expired";
  return "running";
}

export function publicTimer(t, now = Date.now()) {
  return {
    status: statusOf(t, now),
    startedAt: t.startedAt,
    endsAt: t.endsAt,
    serverNow: now,
  };
}

export async function getEmptyData() {
  return { teams: {}, submissions: [] };
}

export async function getData() {
  const d = await db().get("data", { type: "json" });
  return d || getEmptyData();
}

export async function mutateData(fn) {
  const store = db();
  for (let i = 0; i < 8; i++) {
    const entry = await store.getWithMetadata("data", { type: "json" });
    const data = entry?.data || (await getEmptyData());
    const result = fn(data);
    if (result && result.ok === false) return result;
    const opts = entry?.etag ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
    const { modified } = await store.setJSON("data", data, opts);
    if (modified) return { ...result, data };
  }
  return { ok: false, error: "Storage is busy, please try again", status: 409 };
}

export async function reserveKey(key, value) {
  const { modified } = await db().set(key, value, { onlyIfNew: true });
  return modified;
}

export async function releaseKey(key) {
  try {
    await db().delete(key);
  } catch {}
}

export function bearer(req) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export async function authTeam(req) {
  const token = bearer(req);
  if (!token) return null;
  const sess = await db().get(`session:${token}`, { type: "json" });
  if (!sess || sess.exp < Date.now()) return null;
  const data = await getData();
  const team = data.teams[sess.teamId];
  if (!team) return null;
  return { team, memberEmail: sess.memberEmail, token };
}

export async function authAdmin(req) {
  const token = bearer(req);
  if (!token) return null;
  const a = await db().get(`admin:${token}`, { type: "json" });
  if (!a || a.exp < Date.now()) return null;
  return token;
}

export async function createSession(teamId, memberEmail, hours = 12) {
  const token = randomBytes(24).toString("hex");
  await db().setJSON(`session:${token}`, {
    teamId,
    memberEmail,
    exp: Date.now() + hours * 3600 * 1000,
  });
  return token;
}

export async function createAdminSession(hours = 8) {
  const token = randomBytes(24).toString("hex");
  await db().setJSON(`admin:${token}`, { exp: Date.now() + hours * 3600 * 1000 });
  return token;
}

export function scoreOf(submissions, teamId) {
  const flags = new Set();
  for (const s of submissions) {
    if (s.teamId === teamId) flags.add(s.flagIndex);
  }
  return flags.size * 25;
}

export function requireField(body, name, { min = 1, max = 1000 } = {}) {
  const v = body[name];
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t.length < min || t.length > max) return null;
  return t;
}
