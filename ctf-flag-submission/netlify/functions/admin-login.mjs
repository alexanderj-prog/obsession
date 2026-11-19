import { json, readBody, checkAdminPassword, createAdminSession } from "../../shared/lib.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await readBody(req);
  if (!checkAdminPassword(body.password)) {
    return json({ error: "Incorrect password" }, 401);
  }
  const token = await createAdminSession();
  return json({ token });
};
