// build.mjs: template + data -> backend/index.html, backend/vercel.json (CSP with per-script hashes),
// backend/version.json, backend/controls-index.json, backend/.well-known/security.txt, docs/CROSSWALK.md.
// The build is deterministic (no timestamps of its own) and fails on any schema error, unresolved
// cross-reference, expired exception, incomplete AI inventory entry, dash character, or city leak.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { docText } from "./backend/lib/rank.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const R = p => path.join(ROOT, p);
const read = p => fs.readFileSync(R(p), "utf8");
const json = p => JSON.parse(read(p));
const errors = [];
const fail = m => errors.push(m);

// ---------- inputs ----------
const site = json("backend/site.json");
const pkg = json("package.json");
const frameworks = json("data/frameworks.json");
const controls = json("data/controls.json").controls;
const ai = json("data/ai-systems.json").systems;
const risksFile = json("data/risks.json");
const scenario = json("data/scenario-breach.json");
const vendors = json("data/vendors.json").vendors;
const exceptions = json("data/exceptions.json").exceptions;
const glossary = json("data/glossary.json").terms;
const company = json("data/company.json");
const findings = fs.existsSync(R("data/findings.json")) ? json("data/findings.json").findings : [];
const results = fs.existsSync(R("eval/results.json")) ? json("eval/results.json") : {};
const template = read("src/index.template.html");
const appJs = read("src/app.js");
const rankJs = read("backend/lib/rank.mjs").replace(/^export\s+/gm, "");
const vercelTemplate = read("backend/vercel.template.json");

if (site.version !== pkg.version) fail(`version mismatch: site.json ${site.version} vs package.json ${pkg.version}`);

// ---------- policies ----------
function parseFrontMatter(src, file) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { fail(`${file}: missing front matter`); return { meta: {}, body: src }; }
  const meta = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([a-z_]+):\s*(.*)$/); if (!mm) continue;
    let v = mm[2].trim(); if (/^".*"$/.test(v)) v = v.slice(1, -1);
    meta[mm[1]] = /^\d+$/.test(v) ? Number(v) : v;
  }
  return { meta, body: m[2] };
}
const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
function inline(s) { return escHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
function mdToHtml(md) {
  const lines = md.split("\n"); const out = []; let list = null; let para = [];
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; } };
  const flushL = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushP(); flushL(); const lvl = h[1].length === 1 ? 2 : h[1].length === 2 ? 3 : 4; out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    const ol = line.match(/^\d+\.\s+(.*)$/), ul = line.match(/^[-*]\s+(.*)$/);
    if (ol || ul) { flushP(); const kind = ol ? "ol" : "ul"; if (list !== kind) { flushL(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline((ol || ul)[1])}</li>`); continue; }
    if (!line.trim()) { flushP(); flushL(); continue; }
    para.push(line.trim());
  }
  flushP(); flushL();
  return out.join("\n");
}
const policies = fs.readdirSync(R("policies")).filter(f => /^POL-\d\d\.md$/.test(f)).sort().map(f => {
  const { meta, body } = parseFrontMatter(read("policies/" + f), f);
  for (const k of ["id", "title", "version", "owner_role", "approved_by_role", "last_reviewed", "review_days", "reality", "plain"]) if (meta[k] === undefined || meta[k] === "") fail(`${f}: front matter missing ${k}`);
  if (meta.id !== f.replace(".md", "")) fail(`${f}: id ${meta.id} does not match file name`);
  const html = mdToHtml(body.replace(/^#\s+.*\n/, ""));
  return { ...meta, version: String(meta.version), html };
});
const POL = new Set(policies.map(p => p.id));

// ---------- validation ----------
const FW = frameworks.frameworks, DRV = frameworks.drivers;
const CID = new Set(controls.map(c => c.id)), RID = new Set(risksFile.risks.map(r => r.id)), VID = new Set(vendors.map(v => v.id));
const need = (obj, keys, where) => { for (const k of keys) if (obj[k] === undefined || obj[k] === null || obj[k] === "") fail(`${where}: missing ${k}`); };
const dashRe = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
const scan = (obj, where) => { const s = JSON.stringify(obj); if (dashRe.test(s)) fail(`${where}: contains an em or en dash`); };
const validRealities = new Set(["real", "simulated"]);

const seenC = new Set();
for (const c of controls) {
  const w = `control ${c.id}`;
  if (seenC.has(c.id)) fail(`${w}: duplicate id`); seenC.add(c.id);
  if (!/^NC-(GV|ID|PR|DE|RS|RC)-\d\d$/.test(c.id)) fail(`${w}: bad id format`);
  need(c, ["function", "title", "statement", "plain", "owner_role", "frequency", "test_procedure", "evidence_type", "freshness_days", "status", "mappings", "drivers", "reality"], w);
  if (!validRealities.has(c.reality)) fail(`${w}: reality must be real or simulated`);
  if (!["operating", "partial", "planned"].includes(c.status)) fail(`${w}: bad status`);
  if (!["automated", "attestation", "document"].includes(c.evidence_type)) fail(`${w}: bad evidence_type`);
  if (typeof c.ai !== "boolean") fail(`${w}: ai must be boolean`);
  if (!c.automation && !c.last_evidence) fail(`${w}: manual control needs last_evidence`);
  if (c.last_evidence && !/^\d{4}-\d\d-\d\d$/.test(c.last_evidence)) fail(`${w}: last_evidence must be YYYY-MM-DD`);
  for (const id of c.mappings.csf || []) if (!FW.csf.ids[id]) fail(`${w}: unknown CSF id ${id}`);
  for (const m of c.mappings.cis || []) { if (!FW.cis.ids[m.id]) fail(`${w}: unknown CIS id ${m.id}`); if (![1, 2, 3].includes(m.ig)) fail(`${w}: CIS ${m.id} needs ig 1, 2 or 3`); }
  for (const id of c.mappings.soc2 || []) if (!FW.soc2.ids[id]) fail(`${w}: unknown SOC 2 id ${id}`);
  for (const id of c.mappings.airmf || []) if (!FW.airmf.ids[id]) fail(`${w}: unknown AI RMF id ${id}`);
  for (const d of c.drivers || []) if (!DRV[d]) fail(`${w}: unknown driver ${d}`);
  for (const r of c.linked_risks || []) if (!RID.has(r)) fail(`${w}: unknown risk ${r}`);
  for (const p of c.linked_policies || []) if (!POL.has(p)) fail(`${w}: unknown policy ${p}`);
  if (c.status === "partial" && !exceptions.some(e => e.control_id === c.id)) fail(`${w}: partial status needs an exception record`);
  scan(c, w);
}
for (const r of risksFile.risks) {
  const w = `risk ${r.id}`;
  need(r, ["title", "plain", "category", "scenario", "owner_role", "inherent", "residual", "treatment", "treatment_note", "kri", "trend", "linked_controls", "reality"], w);
  for (const k of ["inherent", "residual"]) for (const f of ["likelihood", "impact"]) { const v = r[k][f]; if (!(Number.isInteger(v) && v >= 1 && v <= 5)) fail(`${w}: ${k}.${f} must be an integer 1 to 5`); }
  if (r.residual.likelihood * r.residual.impact > r.inherent.likelihood * r.inherent.impact) fail(`${w}: residual above inherent`);
  if (typeof r.decision_required !== "boolean") fail(`${w}: decision_required must be boolean`);
  for (const c of r.linked_controls) if (!CID.has(c)) fail(`${w}: unknown control ${c}`);
  scan(r, w);
}
need(risksFile.appetite, ["statement", "plain", "scale"], "appetite");
for (const a of ai) {
  const w = `AI system ${a.id}`;
  need(a, ["name", "reality", "status", "purpose", "plain", "users", "data_classes", "vendor", "model", "hosting", "runtime", "human_oversight", "logging", "kill_switch", "owner_role", "review_cadence_days", "last_reviewed", "airmf", "traiga", "eu_ai_act", "linked_controls", "linked_risks"], w);
  if (!Array.isArray(a.runtime) || a.runtime.length < 3) fail(`${w}: runtime table needs at least 3 rows`);
  for (const row of a.runtime || []) need(row, ["action", "guard", "approver"], `${w} runtime row`);
  for (const k of ["govern", "map", "measure", "manage"]) if (!a.airmf || !a.airmf[k]) fail(`${w}: airmf.${k} missing`);
  if (!a.traiga || !["aligned", "gap"].includes(a.traiga.status)) fail(`${w}: traiga.status must be aligned or gap`);
  for (const c of a.linked_controls) if (!CID.has(c)) fail(`${w}: unknown control ${c}`);
  for (const r of a.linked_risks) if (!RID.has(r)) fail(`${w}: unknown risk ${r}`);
  scan(a, w);
}
for (const v of vendors) {
  const w = `vendor ${v.id}`;
  need(v, ["name", "reality", "service", "plain", "tier", "data_access", "soc2_report", "review_cadence_days", "last_reviewed"], w);
  for (const c of v.linked_controls || []) if (!CID.has(c)) fail(`${w}: unknown control ${c}`);
  for (const r of v.linked_risks || []) if (!RID.has(r)) fail(`${w}: unknown risk ${r}`);
  if (v.trust_center_url && !/^https:\/\//.test(v.trust_center_url)) fail(`${w}: trust_center_url must be https`);
  scan(v, w);
}
const today = new Date().toISOString().slice(0, 10);
for (const e of exceptions) {
  const w = `exception ${e.id}`;
  need(e, ["control_id", "title", "plain", "reason", "risk_accepted_by_role", "opened", "expires", "compensating", "reality"], w);
  if (!CID.has(e.control_id)) fail(`${w}: unknown control ${e.control_id}`);
  if (e.expires < today) fail(`${w}: expired on ${e.expires}; renew it or close it (an expired exception fails the build by design)`);
  scan(e, w);
}
for (const k of scenario.controls) if (!CID.has(k.id)) fail(`scenario: unknown control ${k.id}`);
scan(scenario, "scenario"); scan(glossary, "glossary"); scan(company, "company"); scan(policies, "policies"); scan(findings, "findings");
if (dashRe.test(template) || dashRe.test(appJs)) fail("template or app.js contains an em or en dash");
for (const p of policies) { const a = Date.parse(p.last_reviewed); if (isNaN(a)) fail(`${p.id}: bad last_reviewed`); }

// ---------- evidence ----------
const evDir = R("evidence");
let latest = null, previous = null, history = [];
if (fs.existsSync(path.join(evDir, "latest.json"))) {
  latest = JSON.parse(fs.readFileSync(path.join(evDir, "latest.json"), "utf8"));
  const dated = fs.readdirSync(evDir).filter(f => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
  history = dated.map(f => { const b = JSON.parse(fs.readFileSync(path.join(evDir, f), "utf8")); const s = { date: f.slice(0, 10), pass: 0, warn: 0, fail: 0, total: b.checks.length }; for (const k of b.checks) s[k.result] = (s[k.result] || 0) + 1; return s; });
  const prevFile = dated.filter(f => f.slice(0, 10) < latest.generated_at.slice(0, 10)).pop();
  if (prevFile) { const b = JSON.parse(fs.readFileSync(path.join(evDir, prevFile), "utf8")); previous = { generated_at: b.generated_at, results: Object.fromEntries(b.checks.map(k => [k.id, k.result])) }; }
  const autoIds = new Set(controls.map(c => c.automation).filter(Boolean));
  for (const a of autoIds) if (!latest.checks.some(k => k.id === a || k.id.startsWith(a + "."))) console.warn(`note: no evidence check for ${a} in the latest bundle (scope ${latest.scope || "full"})`);
}

// ---------- payload ----------
const { hq_city, ...companyPublic } = company;
const payload = {
  site: { name: site.name, tagline: site.tagline, version: site.version, live_url: site.live_url, repo_url: site.repo_url, sister_sites: site.sister_sites, credentials: site.credentials, limits: site.limits },
  company: companyPublic, frameworks, controls, ai, risks: { appetite: { ...risksFile.appetite, line: 9 }, risks: risksFile.risks }, scenario, vendors, exceptions, policies, glossary,
  evidence: { latest, previous, history }, findings, results
};
const payloadJson = JSON.stringify(payload);
if (hq_city && new RegExp(hq_city, "i").test(payloadJson)) fail(`city name "${hq_city}" leaked into the page payload`);
if (new RegExp(site.attribution.replace(/\s+/g, "\\s+"), "i").test(payloadJson)) fail("attribution name must not appear in the data payload");

if (errors.length) { console.error("BUILD FAILED\n" + errors.map(e => " - " + e).join("\n")); process.exit(1); }

// ---------- page ----------
const ogDesc = site.tagline;
let html = template
  .replace(/__SITE_NAME__/g, escHtml(site.name))
  .replace(/__OG_DESC__/g, escHtml(ogDesc))
  .replace(/__LIVE_URL__/g, site.live_url.replace(/\/$/, ""))
  .replace(/__REPO_URL__/g, site.repo_url)
  .replace(/__VERSION__/g, escHtml(site.version))
  .replace(/__ATTRIBUTION_LINE__/g, escHtml(site.attribution_line))
  .replace(/__ATTRIBUTION__/g, escHtml(site.attribution))
  .replace("__DATA_JSON__", () => payloadJson.replace(/</g, "\\u003c").split(String.fromCharCode(0x2028)).join("\\u2028").split(String.fromCharCode(0x2029)).join("\\u2029"))
  .replace("__APP_JS__", () => rankJs + "\n" + appJs);

// attribution exactly once in visible text (the payload is excluded above)
const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
const attrCount = (visible.match(new RegExp(site.attribution.replace(/\s+/g, "\\s+"), "g")) || []).length;
if (attrCount !== 1) { console.error(`BUILD FAILED: attribution appears ${attrCount} times in visible text (must be exactly 1)`); process.exit(1); }
if (hq_city && new RegExp(hq_city, "i").test(html)) { console.error("BUILD FAILED: city name in built page"); process.exit(1); }

// ---------- CSP hashes ----------
const sha = s => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const scriptHashes = [];
for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)) scriptHashes.push(sha(m[1]));
const styleHashes = [];
for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styleHashes.push(sha(m[1]));
const csp = [
  "default-src 'self'",
  `script-src 'self' ${scriptHashes.join(" ")}`,
  `style-src ${styleHashes.join(" ")}`,
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");
const vercel = JSON.parse(vercelTemplate);
for (const h of vercel.headers[0].headers) if (h.value === "__CSP__") h.value = csp;

// ---------- outputs ----------
fs.mkdirSync(R("backend/.well-known"), { recursive: true });
fs.writeFileSync(R("backend/index.html"), html);
fs.writeFileSync(R("backend/vercel.json"), JSON.stringify(vercel, null, 2) + "\n");
fs.writeFileSync(R("backend/version.json"), JSON.stringify({ version: site.version }) + "\n");
fs.writeFileSync(R("backend/controls-index.json"), JSON.stringify({ version: site.version, controls: controls.map(c => ({ id: c.id, title: c.title, statement: c.statement, text: docText(c, frameworks) })) }) + "\n");
fs.writeFileSync(R("backend/.well-known/security.txt"), [`Contact: ${site.security_txt.contact}`, `Expires: ${site.security_txt.expires}`, `Preferred-Languages: ${site.security_txt.preferred_languages}`, `Canonical: ${site.live_url.replace(/\/$/, "")}/.well-known/security.txt`, `Policy: ${site.repo_url}#responsible-disclosure`, ""].join("\n"));
fs.writeFileSync(R("backend/llms.txt"), [`# ${site.name}`, "", `> ${site.tagline}`, "", "Nimbus is a fictional company; all company data is illustrative. The AI assistants, the evidence job, the vendors with trust centers, and the build gates are real and can be inspected.", "", `- Live: ${site.live_url}`, `- Source and tests: ${site.repo_url}`, `- Version: ${site.version}`, "", "## Views", "- #trust: public trust center", "- #overview, #controls, #ai, #evidence, #risks, #vendors, #board, #tested, #glossary: the control room", "", "## API", "- POST /api/map {q}: maps one questionnaire question to up to three controls (rate limited, no storage)", "- GET /api/health: status probe", ""].join("\n"));
fs.writeFileSync(R("backend/robots.txt"), "User-agent: *\nAllow: /\nDisallow: /api/\n");

// crosswalk markdown for repository readers
const cw = ["# Control crosswalk", "", "Generated by build.mjs from data/controls.json. Do not edit by hand.", "", "| ID | Control | Real | AI | NIST CSF 2.0 | CIS v8.1 (IG) | SOC 2 | NIST AI RMF | Drivers |", "|---|---|---|---|---|---|---|---|---|"];
for (const c of controls) cw.push(`| ${c.id} | ${c.title} | ${c.reality === "real" ? "yes" : "sim"} | ${c.ai ? "yes" : ""} | ${(c.mappings.csf || []).join(", ")} | ${(c.mappings.cis || []).map(m => `${m.id} (${m.ig})`).join(", ")} | ${(c.mappings.soc2 || []).join(", ")} | ${(c.mappings.airmf || []).join(", ")} | ${(c.drivers || []).join(", ")} |`);
fs.writeFileSync(R("docs/CROSSWALK.md"), cw.join("\n") + "\n");

console.log(`built backend/index.html (${(html.length / 1024).toFixed(0)} KB), vercel.json (${scriptHashes.length} script hashes, ${styleHashes.length} style hash), controls-index.json, security.txt, llms.txt, docs/CROSSWALK.md`);
console.log(`controls ${controls.length} (real ${controls.filter(c => c.reality === "real").length}, ai ${controls.filter(c => c.ai).length}), ai systems ${ai.length}, risks ${risksFile.risks.length}, vendors ${vendors.length}, exceptions ${exceptions.length}, policies ${policies.length}, glossary ${glossary.length}, evidence ${latest ? latest.checks.length + " checks from " + latest.generated_at : "none"}`);
