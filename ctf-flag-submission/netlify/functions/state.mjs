import { json, getTimer, publicTimer } from "../../shared/lib.mjs";

export default async () => {
  const t = await getTimer();
  return json(publicTimer(t));
};
