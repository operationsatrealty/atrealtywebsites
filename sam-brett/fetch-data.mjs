/**
 * Fetch VaultRE data and update the committed snapshot.
 *
 * No dependencies beyond vaultre.mjs — no sharp, no image processing.
 * Designed to run in CI (GitHub Actions) so the fallback snapshot in the
 * repo always holds the last known good data.
 *
 * Exit codes:
 *   0 — snapshot updated with fresh data
 *   1 — VaultRE not configured (missing env vars)
 *   2 — VaultRE returned no data (API error or token issue)
 */

import { agentListings, vaultreConfigured } from "./vaultre.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_EMAILS = ["sam.steel@raywhite.com", "brett.norris@raywhite.com"];
const snapshotPath = path.join(HERE, "data", "listings.json");

if (!vaultreConfigured()) {
  console.error("[fetch-data] VaultRE not configured — need VAULTRE_API_KEY + VAULTRE_BEARER_TOKEN_MANUREWA");
  process.exit(1);
}

console.log(`[fetch-data] Fetching ${AGENT_EMAILS.join(", ")}…`);
const results = await Promise.all(AGENT_EMAILS.map(email => agentListings(email)));

const merged = { current: [], sold: [], soldTotal: 0, offices: [] };
const officeSet = new Set();
const seenCurrent = new Set();
const seenSold = new Set();

for (const result of results) {
  if (result) {
    for (const l of result.current) {
      if (!seenCurrent.has(l.id)) { seenCurrent.add(l.id); merged.current.push(l); }
    }
    for (const l of result.sold) {
      if (!seenSold.has(l.id)) { seenSold.add(l.id); merged.sold.push(l); }
    }
    merged.soldTotal = Math.max(merged.soldTotal, result.soldTotal);
    result.offices.forEach(o => officeSet.add(o.office));
  }
}
merged.offices = Array.from(officeSet).map(office => ({ office }));

if (!merged.current.length && !merged.sold.length) {
  console.error("[fetch-data] VaultRE returned no data — snapshot NOT updated");
  process.exit(2);
}

await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
await fs.writeFile(snapshotPath, JSON.stringify(merged, null, 2) + "\n");
console.log(`[fetch-data] Snapshot updated: ${merged.current.length} current, ${merged.sold.length} sold`);
