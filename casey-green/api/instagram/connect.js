// Status page and connect/disconnect form for Casey's Instagram feed.
// Logic and setup notes: lib/instagram.mjs.
import { connectAction, connectPage, defaultDeps } from "../../lib/instagram.mjs";

export function GET(request) {
  return connectPage(request, defaultDeps());
}

export function POST(request) {
  return connectAction(request, defaultDeps());
}
