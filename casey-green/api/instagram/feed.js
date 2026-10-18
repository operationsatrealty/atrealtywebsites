// Casey's latest Instagram posts as JSON, for the home page. See lib/instagram.mjs.
import { defaultDeps, feed } from "../../lib/instagram.mjs";

export function GET(request) {
  return feed(request, defaultDeps());
}
