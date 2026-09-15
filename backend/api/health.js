// GET /api/health: token-free probe. No upstream call, no key use. Drives the page's status pill and
// proves the kill switch state (control NC-PR-19): with the key removed, ok is false and the page shows
// the mapper as unavailable instead of failing silently.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let VERSION = "dev";
for (const p of [path.join(process.cwd(), "version.json"), path.join(HERE, "..", "version.json")]) {
  try { VERSION = JSON.parse(fs.readFileSync(p, "utf8")).version; break; } catch (e) { /* next */ }
}

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") { res.status(405).json({ error: "GET only" }); return; }
  const keySet = !!(process.env.API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY);
  res.status(200).json({
    ok: keySet,
    version: VERSION,
    provider: (process.env.PROVIDER || "gemini").toLowerCase(),
    model: keySet ? ((process.env.CHAT_MODEL || "").split(",")[0] || null) : null,
    mapper: keySet ? "ai" : "keyword",
    limits: { mapPer5Min: 20, mapPerDayInstance: 600, maxQuestionChars: 600 }
  });
}
