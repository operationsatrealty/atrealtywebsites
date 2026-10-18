// Instagram sends Casey back here after she logs in. See lib/instagram.mjs.
import { callback, defaultDeps } from "../../lib/instagram.mjs";

export function GET(request) {
  return callback(request, defaultDeps());
}
