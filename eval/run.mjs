// eval/run.mjs: gold-set accuracy for the control mapper.
// Default: the keyword path, offline, with the shipped ranker (in-sample, see finding T-12). Floor: top-3 >= 0.6.
// --live [--url https://...] [--n 20]: the model path against the deployed endpoint, paced under the fair-use limit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIndex, rank } from "../backend/lib/rank.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = p => path.join(ROOT, p);
const gold = JSON.parse(fs.readFileSync(R("eval/mapper-gold.json"), "utf8")).items;
const controls = JSON.parse(fs.readFileSync(R("data/controls.json"), "utf8")).controls;
const frameworks = JSON.parse(fs.readFileSync(R("data/frameworks.json"), "utf8"));
const site = JSON.parse(fs.readFileSync(R("backend/site.json"), "utf8"));
const args = process.argv.slice(2);
const val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const resultsPath = R("eval/results.json");
const results = fs.existsSync(resultsPath) ? JSON.parse(fs.readFileSync(resultsPath, "utf8")) : {};
results.mapper = results.mapper || {};

function scoreRuns(runs) {
  let top1 = 0, top3 = 0;
  for (const { item, ids } of runs) { if (ids[0] && item.expected.includes(ids[0])) top1++; if (ids.slice(0, 3).some(id => item.expected.includes(id))) top3++; }
  return { n: runs.length, top1: Math.round(1000 * top1 / runs.length) / 1000, top3: Math.round(1000 * top3 / runs.length) / 1000 };
}

if (!args.includes("--live")) {
  const index = buildIndex(controls, frameworks);
  const runs = gold.map(item => ({ item, ids: rank(index, item.q, 3).map(r => r.id) }));
  const s = scoreRuns(runs);
  for (const r of runs) if (!r.ids.slice(0, 3).some(id => r.item.expected.includes(id))) console.log(`miss: "${r.item.q}" expected ${r.item.expected.join("/")} got ${r.ids.join(", ") || "nothing"}`);
  results.mapper.keyword = { ...s, method: "BM25 with synonym map, in-sample", measured_at_version: site.version };
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n");
  console.log(`keyword path: n=${s.n} top-1 ${(s.top1 * 100).toFixed(0)}% top-3 ${(s.top3 * 100).toFixed(0)}%`);
  if (s.top3 < 0.6) { console.error("eval floor not met (top-3 < 0.6)"); process.exit(1); }
} else {
  const url = (val("--url") || site.live_url).replace(/\/$/, "") + "/api/map";
  const n = Math.min(gold.length, Number(val("--n") || 20));
  const runs = [];
  for (const item of gold.slice(0, n)) {
    let r = null;
    for (let attempt = 0; attempt < 3 && !r; attempt++) {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: item.q }) });
      if (res.status === 429) { console.log("rate limited; waiting 60s"); await new Promise(x => setTimeout(x, 60000)); continue; }
      r = await res.json();
    }
    const ids = r && r.proposals ? r.proposals.map(p => p.id) : [];
    runs.push({ item, ids, method: r && r.method });
    console.log(`${(r && r.method) || "?"} | ${item.q} -> ${ids.join(", ")}`);
    await new Promise(x => setTimeout(x, 1500));
  }
  const s = scoreRuns(runs);
  const aiRuns = runs.filter(r => r.method === "ai").length;
  results.mapper.ai = { ...s, method: `model path against ${url}, ${aiRuns} of ${runs.length} answered by the model`, measured_at_version: site.version };
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2) + "\n");
  console.log(`model path: n=${s.n} top-1 ${(s.top1 * 100).toFixed(0)}% top-3 ${(s.top3 * 100).toFixed(0)}% (${aiRuns} model answers)`);
}
