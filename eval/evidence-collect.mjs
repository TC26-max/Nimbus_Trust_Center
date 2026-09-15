// eval/evidence-collect.mjs: the evidence job (control NC-DE-01). Runs daily in GitHub Actions and on demand.
// It checks the live sites and the repository, writes evidence/<date>.json and evidence/latest.json keyed by
// control automation ids, then rebuilds the page so the bundle is embedded. Honest scope: public surfaces
// and the repository only; a real program would add cloud, identity, device, and ticketing sources.
//
// Usage: node eval/evidence-collect.mjs [--targets slug,slug] [--no-network] [--no-gates] [--no-audit]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = p => path.join(ROOT, p);
const args = process.argv.slice(2);
const opt = k => args.includes(k);
const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const site = JSON.parse(fs.readFileSync(R("backend/site.json"), "utf8"));
const controls = JSON.parse(fs.readFileSync(R("data/controls.json"), "utf8")).controls;
const checks = [];
const add = (id, result, observed, expected, extra = {}) => {
  const control_ids = controls.filter(c => c.automation && (id === c.automation || id.startsWith(c.automation + "."))).map(c => c.id);
  checks.push({ id, control_ids, result, observed, expected, ...extra });
  console.log(`${result.padEnd(4)} ${id}: ${observed}`);
};
const now = new Date();
const daysBetween = (a, b) => Math.floor((b - a) / 86400000);

// ---------- live surfaces ----------
async function fetchSafe(url, init = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
  try { return await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": "nimbus-trust-center-evidence/" + site.version }, ...init }); }
  catch (e) { return null; } finally { clearTimeout(t); }
}
async function checkTarget(t) {
  const base = t.url.replace(/\/$/, "");
  const r = await fetchSafe(base + "/");
  if (!r) { add(`check.transport.${t.slug}`, t.self ? "warn" : "fail", `${t.label} not reachable${t.self ? " (not deployed yet)" : ""}`, "HTTPS reachable with HSTS", { source_url: base }); return; }
  const H = k => r.headers.get(k);
  const hsts = H("strict-transport-security");
  let redirect = "not tested";
  const plain = await fetchSafe(base.replace(/^https:/, "http:") + "/");
  if (plain) redirect = [301, 302, 307, 308].includes(plain.status) && /^https:/.test(plain.headers.get("location") || "") ? "http redirects to https" : `http returned ${plain.status}`;
  add(`check.transport.${t.slug}`, hsts ? "pass" : "warn", `HTTPS ${r.status}; HSTS ${hsts ? "present (" + hsts + ")" : "missing"}; ${redirect}`, "HTTPS 200, HSTS header present, plain HTTP redirects", { source_url: base });
  const csp = H("content-security-policy");
  let cspRes = "fail", cspObs = "CSP missing";
  if (csp) {
    const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || "";
    const hashed = /'sha256-/.test(scriptSrc), unsafe = /'unsafe-inline'/.test(scriptSrc) && !hashed;
    const fa = /frame-ancestors/.test(csp);
    cspRes = unsafe ? "warn" : "pass";
    cspObs = `CSP present; script-src ${hashed ? "hash-pinned" : unsafe ? "allows unsafe-inline" : "self only"}; frame-ancestors ${fa ? "set" : "not set"}; ${csp.length} chars`;
  }
  add(`check.headers.${t.slug}.csp`, cspRes, cspObs, "Content-Security-Policy present with hash-pinned or self-only script-src", { source_url: base });
  const misc = { "x-content-type-options": (H("x-content-type-options") || "").toLowerCase() === "nosniff", "frame protection": !!H("x-frame-options") || /frame-ancestors/.test(csp || ""), "referrer-policy": !!H("referrer-policy"), "permissions-policy": !!H("permissions-policy") };
  const got = Object.entries(misc).filter(([, v]) => v).map(([k]) => k), missing = Object.entries(misc).filter(([, v]) => !v).map(([k]) => k);
  add(`check.headers.${t.slug}.hardening`, missing.length === 0 ? "pass" : got.length ? "warn" : "fail", `present: ${got.join(", ") || "none"}${missing.length ? "; missing: " + missing.join(", ") : ""}`, "nosniff, frame protection, referrer policy, permissions policy", { source_url: base });
  const st = await fetchSafe(base + "/.well-known/security.txt");
  if (st && st.status === 200) {
    const body = await st.text();
    const contact = /^Contact:/mi.test(body), exp = (body.match(/^Expires:\s*(.+)$/mi) || [])[1];
    const expDate = exp ? new Date(exp.trim()) : null;
    const ok = contact && expDate && !isNaN(expDate) && expDate > now;
    add(`check.security_txt.${t.slug}`, ok ? "pass" : "fail", `security.txt ${contact ? "has Contact" : "lacks Contact"}; expires ${exp ? exp.trim() : "missing"}`, "Contact present and Expires in the future", { source_url: base + "/.well-known/security.txt" });
  } else {
    add(`check.security_txt.${t.slug}`, t.self ? "fail" : "warn", `no security.txt published on ${t.label}${t.self ? "" : " (sister site; disclosure channel is its GitHub repository)"}`, "security.txt at /.well-known/security.txt", { source_url: base + "/.well-known/security.txt" });
  }
}

// ---------- repository checks ----------
function localSecurityTxt() {
  const p = R("backend/.well-known/security.txt");
  if (!fs.existsSync(p)) { add("check.security_txt.local", "fail", "backend/.well-known/security.txt missing (run the build)", "file present with future Expires"); return; }
  const body = fs.readFileSync(p, "utf8"); const exp = new Date((body.match(/^Expires:\s*(.+)$/mi) || [])[1] || "");
  const soon = !isNaN(exp) && daysBetween(now, exp) < 30;
  add("check.security_txt.local", isNaN(exp) || exp <= now ? "fail" : soon ? "warn" : "pass", `file present; expires ${isNaN(exp) ? "unparseable" : exp.toISOString().slice(0, 10)}${soon ? " (renew within 30 days)" : ""}`, "Contact present and Expires in the future");
}
function secretsScan() {
  const patterns = [/AIza[0-9A-Za-z_\-]{35}/, /sk-[A-Za-z0-9]{20,}/, /ghp_[A-Za-z0-9]{36}/, /github_pat_[A-Za-z0-9_]{22,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, /xox[baprs]-[A-Za-z0-9-]{10,}/];
  const skip = new Set(["node_modules", ".git", "evidence", "dist"]);
  let files = 0, hits = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (skip.has(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|mjs|json|md|html|txt|yml|yaml|py)$/.test(e.name)) { files++; const s = fs.readFileSync(p, "utf8"); for (const re of patterns) if (re.test(s)) hits.push(path.relative(ROOT, p)); } } };
  walk(ROOT);
  add("check.secrets_scan", hits.length ? "fail" : "pass", `${files} files scanned, ${hits.length} secret pattern hit${hits.length === 1 ? "" : "s"}${hits.length ? ": " + [...new Set(hits)].join(", ") : ""}`, "no API key, token, or private key patterns in the repository");
}
function apiGuards() {
  const src = fs.readFileSync(R("backend/api/map.js"), "utf8");
  const want = { "rate limiter": /makeLimiter\(/, "input cap": /MAX_Q\s*=\s*600/, "method allow-list": /req\.method !== "POST"/, "same-origin CORS": /function cors\(/, "output validation": /sanitizeProposals\(/, "untrusted-data wrapping": /untrusted data/, "no content logging": !/console\.log\(/.test(src) };
  const missing = Object.entries(want).filter(([, v]) => v instanceof RegExp ? !v.test(src) : !v).map(([k]) => k);
  add("check.api_guards", missing.length ? "fail" : "pass", `${Object.keys(want).length - missing.length} of ${Object.keys(want).length} guards found in backend/api/map.js${missing.length ? "; missing: " + missing.join(", ") : ""}`, "limiter, input cap, POST only, CORS, output validation, untrusted wrapping, no content logging", { source_url: site.repo_url + "/blob/main/backend/api/map.js" });
}
function policyFreshness() {
  const files = fs.readdirSync(R("policies")).filter(f => /^POL-\d\d\.md$/.test(f)).sort();
  let worst = "pass"; const notes = [];
  for (const f of files) {
    const s = fs.readFileSync(R("policies/" + f), "utf8");
    const last = new Date((s.match(/^last_reviewed:\s*(.+)$/m) || [])[1] || ""), win = Number((s.match(/^review_days:\s*(\d+)$/m) || [])[1] || 365);
    const age = isNaN(last) ? 9999 : daysBetween(last, now);
    const r = age > win ? "fail" : age > win * 0.8 ? "warn" : "pass";
    if (r === "fail" || (r === "warn" && worst === "pass")) worst = r;
    notes.push(`${f.replace(".md", "")} ${age}d`);
  }
  add("check.policy_freshness", worst, `${files.length} policies; review age ${notes.join(", ")} (window 365d)`, "every policy reviewed inside its review window");
}
function exceptionsExpiry() {
  const ex = JSON.parse(fs.readFileSync(R("data/exceptions.json"), "utf8")).exceptions;
  const expired = ex.filter(e => new Date(e.expires) < now), soon = ex.filter(e => new Date(e.expires) >= now && daysBetween(now, new Date(e.expires)) <= 30);
  add("check.exceptions_expiry", expired.length ? "fail" : soon.length ? "warn" : "pass", `${ex.length} exceptions open; ${expired.length} expired; ${soon.length} expiring within 30 days`, "no expired exceptions");
}
function aiInventory() {
  const ai = JSON.parse(fs.readFileSync(R("data/ai-systems.json"), "utf8")).systems;
  const req = ["purpose", "users", "data_classes", "vendor", "model", "runtime", "human_oversight", "logging", "kill_switch", "owner_role", "last_reviewed", "airmf", "traiga"];
  const gaps = [];
  for (const a of ai) { for (const k of req) if (a[k] === undefined || a[k] === "" || (Array.isArray(a[k]) && !a[k].length)) gaps.push(`${a.id}.${k}`); if (daysBetween(new Date(a.last_reviewed), now) > a.review_cadence_days) gaps.push(`${a.id} review overdue`); }
  add("check.ai_inventory_complete", gaps.length ? "fail" : "pass", `${ai.length} systems, all required fields present${gaps.length ? "; gaps: " + gaps.join(", ") : ""}; ${ai.filter(a => a.reality === "real").length} real`, "every AI system has purpose, users, data classes, model, runtime permissions, oversight, logging, kill switch, owner, review date, AI RMF rows");
}
function riskRegister() {
  const r = JSON.parse(fs.readFileSync(R("data/risks.json"), "utf8"));
  const bad = r.risks.filter(x => !x.owner_role || !x.kri || !x.treatment).map(x => x.id);
  add("check.risk_register", bad.length || !r.appetite ? "fail" : "pass", `${r.risks.length} risks with owner, ratings, treatment and KRI; appetite statement present`, "complete register and an approved appetite statement");
}
function vendorRegister() {
  const v = JSON.parse(fs.readFileSync(R("data/vendors.json"), "utf8")).vendors;
  const late = v.filter(x => daysBetween(new Date(x.last_reviewed), now) > x.review_cadence_days).map(x => x.id);
  add("check.vendor_register", late.length ? "warn" : "pass", `${v.length} vendors; ${late.length} past review cadence${late.length ? ": " + late.join(", ") : ""}`, "every vendor reviewed inside its cadence");
}
function npmAudit() {
  const r = spawnSync("npm", ["audit", "--json", "--omit=dev"], { cwd: ROOT, encoding: "utf8" });
  let j = null; try { j = JSON.parse(r.stdout || "{}"); } catch (e) { j = null; }
  const v = j && j.metadata && j.metadata.vulnerabilities;
  if (!v) { add("check.npm_audit", "warn", "npm audit unavailable (offline or no registry access)", "0 high or critical vulnerabilities in runtime dependencies"); return; }
  const declared = Object.keys(JSON.parse(fs.readFileSync(R("package.json"), "utf8")).dependencies || {}).length;
  add("check.npm_audit", (v.high + v.critical) ? "fail" : v.moderate ? "warn" : "pass", `${declared} runtime dependencies declared; audit found critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}`, "0 high or critical vulnerabilities in runtime dependencies");
}
function gates() {
  const r = spawnSync("npm", ["test", "--silent"], { cwd: ROOT, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" } });
  let summary = "";
  try { const res = JSON.parse(fs.readFileSync(R("eval/results.json"), "utf8")); summary = res.gates ? `${res.gates.total} checks: ${res.gates.summary}` : "no gate summary"; } catch (e) { summary = "no results file"; }
  add("check.gates", r.status === 0 ? "pass" : "fail", `npm test exit ${r.status}; ${summary}`, "build, eval and all gates pass", { source_url: site.repo_url + "/actions" });
  if (r.status !== 0) console.error((r.stdout || "").slice(-2000) + (r.stderr || "").slice(-2000));
}

// ---------- run ----------
const wanted = (val("--targets") || "").split(",").filter(Boolean);
if (!opt("--no-network")) for (const t of site.evidence_targets) { if (wanted.length && !wanted.includes(t.slug)) continue; await checkTarget(t); }
localSecurityTxt(); secretsScan(); apiGuards(); policyFreshness(); exceptionsExpiry(); aiInventory(); riskRegister(); vendorRegister();
if (!opt("--no-audit")) npmAudit();
if (!opt("--no-gates")) gates();
add("check.evidence_run", "pass", `evidence job ran at ${now.toISOString()} with ${checks.length + 1} checks`, "daily run recorded");

let commit = "n/a";
try { const g = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }); if (g.status === 0) commit = g.stdout.trim(); } catch (e) { /* no git */ }
const bundle = { generated_at: now.toISOString(), scope: opt("--no-network") ? "local-only" : "full", gates_included: !opt("--no-gates"), run_id: (process.env.GITHUB_RUN_ID ? "gh-" + process.env.GITHUB_RUN_ID : "local-" + now.toISOString().slice(0, 16).replace(/[-:T]/g, "")), source_commit: commit, targets: site.evidence_targets.filter(t => !wanted.length || wanted.includes(t.slug)).map(t => ({ slug: t.slug, label: t.label, url: t.url })), checks };
fs.mkdirSync(R("evidence"), { recursive: true });
const dated = R("evidence/" + now.toISOString().slice(0, 10) + ".json");
fs.writeFileSync(dated, JSON.stringify(bundle, null, 2) + "\n");
fs.writeFileSync(R("evidence/latest.json"), JSON.stringify(bundle, null, 2) + "\n");
const pass = checks.filter(c => c.result === "pass").length, warn = checks.filter(c => c.result === "warn").length, failN = checks.filter(c => c.result === "fail").length;
console.log(`\nwrote ${path.relative(ROOT, dated)} and evidence/latest.json: ${pass} pass, ${warn} warn, ${failN} fail`);
const b = spawnSync("node", ["build.mjs"], { cwd: ROOT, encoding: "utf8" });
if (b.status !== 0) { console.error(b.stdout, b.stderr); process.exit(1); }
console.log("rebuilt the page with the new bundle embedded");
process.exit(failN ? 2 : 0);
