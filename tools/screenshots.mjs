// tools/screenshots.mjs: render every view in headless Chromium UNDER THE DEPLOY HEADERS (the CSP from
// backend/vercel.json is enforced) with the API mocked, write dist/*.png, and fail on any console error
// or CSP violation. Optional: needs the playwright dev dependency and a Chromium (npx playwright install chromium).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = p => path.join(ROOT, p);
let chromium;
try { ({ chromium } = await import("playwright")); } catch (e) { console.log("playwright not installed; skipping screenshots"); process.exit(0); }

const vercel = JSON.parse(fs.readFileSync(R("backend/vercel.json"), "utf8"));
const headers = Object.fromEntries(vercel.headers[0].headers.map(h => [h.key, h.value]));
const html = fs.readFileSync(R("backend/index.html"), "utf8");
const types = { ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (url.pathname === "/api/health") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: true, version: "shots", provider: "gemini", model: "gemini-2.5-flash", mapper: "ai", limits: {} })); return; }
  if (url.pathname === "/api/map") { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ version: "shots", method: "ai", model: "gemini-2.5-flash", truncated: false, shortlist: ["NC-PR-05", "NC-PR-04", "NC-PR-01"], proposals: [{ id: "NC-PR-05", title: "Non-human identity inventory and credential rotation", rationale: "The question asks about rotation of service credentials, which this control defines.", confidence: "high" }, { id: "NC-PR-04", title: "Secrets held server-side, never in client code or the repository", rationale: "Storage of API keys is covered by the server-side secrets control.", confidence: "medium" }], note: "AI-proposed, analyst confirms." })); return; }
  if (url.pathname === "/_vercel/insights/script.js") { res.setHeader("Content-Type", "application/javascript"); res.end("/* analytics stub */"); return; }
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  const f = R("backend" + p);
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f)); return; }
  res.statusCode = 404; res.end("not found");
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(R("dist"), { recursive: true });
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const problems = [];
const shots = [["trust", "#trust"], ["overview", "#overview"], ["controls", "#controls"], ["control-drawer", "#controls/NC-PR-18"], ["ai", "#ai"], ["evidence", "#evidence"], ["risks", "#risks"], ["vendors", "#vendors"], ["board", "#board"], ["tested", "#tested"], ["glossary", "#glossary"]];
for (const [mode, reader, width] of [["dark", "plain", 1280], ["light", "tech", 1280], ["dark", "plain", 400]]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 400 ? 860 : 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(({ mode, reader }) => { try { localStorage.setItem("ntc-mode", mode); localStorage.setItem("ntc-reader", reader); } catch (e) { } }, { mode, reader });
  const page = await ctx.newPage();
  page.on("console", m => { if (m.type() === "error") problems.push(`${mode}/${reader}/${width}: console ${m.text()}`); });
  page.on("pageerror", e => problems.push(`${mode}/${reader}/${width}: pageerror ${e.message}`));
  for (const [name, hash] of shots) {
    if (width === 400 && !["trust", "controls", "ai", "risks"].includes(name)) continue;
    await page.goto(base + "/" + hash, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    if (name === "controls") { await page.fill("#map-q", "How do you rotate API keys and service account credentials?"); await page.click("#map-go"); await page.waitForTimeout(400); }
    await page.screenshot({ path: R(`dist/${name}-${mode}-${reader}-${width}.png`), fullPage: name !== "controls" || width === 400 });
  }
  const bars = await page.evaluate(() => Array.from(document.querySelectorAll(".bar i")).slice(0, 5).map(i => getComputedStyle(i).width));
  console.log(`${mode}/${reader}/${width}: bar widths under CSP`, bars.join(", "));
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.error("problems:\n" + problems.map(p => " - " + p).join("\n")); process.exit(1); }
console.log(`screenshots written to dist/ with no console errors or CSP violations`);
