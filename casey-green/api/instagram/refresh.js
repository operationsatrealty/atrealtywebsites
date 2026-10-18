// Weekly cron (vercel.json): renews the Instagram token. See lib/instagram.mjs.
import { defaultDeps, refresh } from "../../lib/instagram.mjs";

export function GET(request) {
  return refresh(request, defaultDeps());
}
