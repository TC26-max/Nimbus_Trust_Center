// test/gate-static.mjs: repository-level assertions that do not need a browser or a server.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { ROOT, R, DASH, makeChecker } from "./lib.mjs";

const { check, done } = makeChecker("static");
const read = p => fs.readFileSync(R(p), "utf8");
const site = JSON.parse(read("backend/site.json"));
const pkg = JSON.parse(read("package.json"));

// 1. no em or en dashes in anything a visitor or reader sees
const dashFiles = [];
const walk = (d, ok) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", "dist", "evidence"].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p, ok); else if (ok(e.name)) { if (DASH.test(fs.readFileSync(p, "utf8"))) dashFiles.push(path.relative(ROOT, p)); } } };
walk(ROOT, n => /\.(md|json|html|js|mjs|txt|yml|yaml)$/.test(n));
check(dashFiles.length === 0, "no em or en dashes anywhere in the repository" + (dashFiles.length ? ": " + dashFiles.join(", ") : ""));

// 2. attribution exactly once in visible page text; never in data, policies, docs
const html = read("backend/index.html");
const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
const attr = new RegExp(site.attribution.replace(/\s+/g, "\\s+"), "g");
check((visible.match(attr) || []).length === 1, "attribution appears exactly once in visible copy");
let attrElsewhere = [];
walk(ROOT, n => /\.(md|json|mjs|js|yml)$/.test(n) && n !== "site.json");
for (const dir of ["data", "policies", "docs", "src", "eval", "test", ".github"]) { if (!fs.existsSync(R(dir))) continue; const w = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else if (attr.test(fs.readFileSync(p, "utf8"))) attrElsewhere.push(path.relative(ROOT, p)); attr.lastIndex = 0; } }; w(R(dir)); }
check(attrElsewhere.length === 0, "attribution name absent from data, policies, docs, src, eval, tests" + (attrElsewhere.length ? ": " + attrElsewhere.join(", ") : ""));

// 3. forbidden strings (private list, gitignored) including git history
const fb = R("test/private/forbidden.txt");
if (fs.existsSync(fb)) {
  const terms = fs.readFileSync(fb, "utf8").split("\n").map(s => s.trim()).filter(t => t && !t.startsWith("#") && t.length >= 3);
  let hits = [];
  const w = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (["node_modules", ".git", "private"].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) w(p); else { const s = fs.readFileSync(p, "latin1"); for (const t of terms) if (s.toLowerCase().includes(t.toLowerCase())) hits.push(path.relative(ROOT, p) + ":" + t); } } };
  w(ROOT);
  if (fs.existsSync(R(".git"))) for (const t of terms) { const g = spawnSync("git", ["log", "--all", "-i", "-S", t, "--oneline"], { cwd: ROOT, encoding: "utf8" }); if (g.status === 0 && g.stdout.trim()) hits.push("git history:" + t); }
  check(hits.length === 0, "no forbidden strings in files or git history" + (hits.length ? ": " + hits.join(", ") : ""));
} else check(true, "forbidden-strings list not present (test/private/forbidden.txt is optional and gitignored)");

// 4. city never leaves the data file
const company = JSON.parse(read("data/company.json"));
const city = company.hq_city;
let cityHits = [];
if (city) { const re = new RegExp(city, "i"); for (const dir of ["backend", "src", "docs", "policies", "eval", "README.md", "GO-LIVE.md"]) { const p = R(dir); if (!fs.existsSync(p)) continue; const w = q => { const st = fs.statSync(q); if (st.isDirectory()) { for (const e of fs.readdirSync(q)) if (e !== "node_modules") w(path.join(q, e)); } else if (/\.(md|json|html|js|mjs|txt)$/.test(q) && re.test(fs.readFileSync(q, "utf8"))) cityHits.push(path.relative(ROOT, q)); }; w(p); } }
check(cityHits.length === 0, "city name confined to data/company.json" + (cityHits.length ? ": " + cityHits.join(", ") : ""));

// 5. deterministic build: rebuild and compare
const before = { html: crypto.createHash("sha256").update(html).digest("hex"), vercel: crypto.createHash("sha256").update(read("backend/vercel.json")).digest("hex") };
const b = spawnSync("node", ["build.mjs"], { cwd: ROOT, encoding: "utf8" });
check(b.status === 0, "build succeeds (schema, cross-references, exceptions, AI inventory, dashes)");
const after = { html: crypto.createHash("sha256").update(read("backend/index.html")).digest("hex"), vercel: crypto.createHash("sha256").update(read("backend/vercel.json")).digest("hex") };
check(before.html === after.html && before.vercel === after.vercel, "rebuild is byte-identical (generated files were not hand-edited)");

// 6. CSP hashes match the inline scripts and the stylesheet
const vercel = JSON.parse(read("backend/vercel.json"));
const csp = vercel.headers[0].headers.find(h => h.key === "Content-Security-Policy").value;
const sha = s => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)].map(m => sha(m[1]));
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => sha(m[1]));
check(scripts.length >= 2 && scripts.every(h => csp.includes(h)), `CSP pins every inline script hash (${scripts.length})`);
check(styles.length === 1 && csp.includes(styles[0]) && !/style-src[^;]*unsafe-inline/.test(csp), "CSP pins the stylesheet hash and does not allow unsafe-inline styles");
check(/frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp), "CSP forbids framing, plugins, and base changes");
const hdr = k => vercel.headers[0].headers.find(h => h.key === k);
check(!!hdr("Strict-Transport-Security") && !!hdr("X-Content-Type-Options") && !!hdr("Referrer-Policy") && !!hdr("Permissions-Policy") && !!hdr("X-Frame-Options"), "HSTS, nosniff, referrer, permissions, and frame headers configured");
check(!/style="/.test(read("src/app.js")) && !/style="/.test(read("src/index.template.html")), "no inline style attributes in generated markup (hash-only style-src)");

// 7. version stamps agree
const version = JSON.parse(read("backend/version.json")).version;
const changelog = fs.existsSync(R("CHANGELOG.md")) ? read("CHANGELOG.md") : "";
check(site.version === pkg.version && version === pkg.version && html.includes("v" + pkg.version), `version ${pkg.version} consistent across package.json, site.json, version.json, page`);
check(changelog.includes("## " + pkg.version) || changelog.includes("## v" + pkg.version), "CHANGELOG has an entry for the current version");

// 8. page hygiene
check(/property="og:image"/.test(html) && /property="og:title"/.test(html) && fs.existsSync(R("backend/og-image.png")), "Open Graph tags present and og-image.png exists");
check(!/__(SITE_NAME|OG_DESC|LIVE_URL|REPO_URL|VERSION|ATTRIBUTION(_LINE)?|DATA_JSON|APP_JS)__/.test(html) && !/\b(TODO|TBD|lorem ipsum)\b/i.test(visible), "no unreplaced placeholders or TODO text in the page");
check(fs.existsSync(R("backend/favicon.svg")) && fs.existsSync(R("backend/llms.txt")) && fs.existsSync(R("backend/robots.txt")), "favicon, llms.txt, robots.txt present");
const st = read("backend/.well-known/security.txt");
const exp = new Date((st.match(/^Expires:\s*(.+)$/m) || [])[1] || "");
check(/^Contact:/m.test(st) && !isNaN(exp) && exp > new Date(), "security.txt has Contact and a future Expires");
check(site.evidence_targets.every(t => /^https:\/\//.test(t.url)) && /^https:\/\//.test(site.live_url) && /^https:\/\//.test(site.repo_url), "all site and target URLs are https");

// 9. data discipline
const controls = JSON.parse(read("data/controls.json")).controls;
const findings = JSON.parse(read("data/findings.json")).findings;
check(controls.every(c => typeof c.plain === "string" && c.plain.length > 20 && c.reality), "every control has plain wording and a reality label");
check(findings.filter(f => f.status === "fixed").every(f => f.gate && f.gate.length > 3), "every fixed finding names its gate");
const ev = fs.existsSync(R("evidence/latest.json")) ? JSON.parse(read("evidence/latest.json")) : null;
if (ev) {
  const networkOnly = new Set(["check.transport", "check.headers"]);
  const autos = [...new Set(controls.map(c => c.automation).filter(Boolean))].filter(a => !(ev.scope === "local-only" && networkOnly.has(a)) && !(ev.gates_included === false && a === "check.gates"));
  const missing = autos.filter(a => !ev.checks.some(k => k.id === a || k.id.startsWith(a + ".")));
  check(missing.length === 0, `every automated control has a check in the latest bundle (scope ${ev.scope || "full"})` + (missing.length ? " (missing: " + missing.join(", ") + ")" : ""));
  check(ev.checks.every(k => ["pass", "warn", "fail"].includes(k.result) && k.id && k.observed && k.expected), "every evidence check has id, result, observed, expected");
} else { check(true, "no evidence bundle yet (run npm run evidence)"); check(true, "evidence schema (skipped, no bundle)"); }
const gold = JSON.parse(read("eval/mapper-gold.json")).items;
check(gold.length >= 50 && gold.every(g => g.expected.every(id => controls.some(c => c.id === id))), "gold set has 50+ items and every expected id exists");
check(fs.existsSync(R(".github/workflows/evidence.yml")) && /skip ci/.test(read(".github/workflows/evidence.yml")), "evidence workflow commits with [skip ci]");

done();
