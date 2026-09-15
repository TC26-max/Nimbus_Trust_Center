// test/gate-ui.mjs: the built page in a DOM (jsdom). Every view renders from the embedded data, routing and
// the drawer work, reader mode toggles, the in-page mapper fallback returns real ids, the scenario is deterministic.
import fs from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { R, DASH, makeChecker } from "./lib.mjs";

const { check, done } = makeChecker("ui");
const html = fs.readFileSync(R("backend/index.html"), "utf8");
const site = JSON.parse(fs.readFileSync(R("backend/site.json"), "utf8"));
const controls = JSON.parse(fs.readFileSync(R("data/controls.json"), "utf8")).controls;
const risks = JSON.parse(fs.readFileSync(R("data/risks.json"), "utf8")).risks;
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => errors.push(String(e.message || e)));
vc.on("error", (...a) => errors.push(a.join(" ")));
const store = {};
const dom = new JSDOM(html, {
  runScripts: "dangerously", url: "https://example.test/#trust", virtualConsole: vc, pretendToBeVisual: true,
  beforeParse(w) { w.fetch = () => Promise.reject(new Error("no network in the ui gate")); w.matchMedia = () => ({ matches: false, addEventListener() {} }); w.scrollTo = () => {}; w.print = () => { w.__printed = true; }; }
});
const w = dom.window, d = w.document;
const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
const go = async h => { w.location.hash = h; await tick(); };
await tick(200);

check(errors.length === 0, "page boots without script errors" + (errors.length ? ": " + errors[0] : ""));
check(d.querySelector(".view.active").id === "view-trust" && /protects customer data/.test(d.querySelector("#view-trust h1").textContent), "trust center is the default view");
check(!/Dallas/.test(d.body.textContent) && !/Dallas/i.test(html), "no city name anywhere in the page");
check(!DASH.test(d.body.textContent), "no em or en dashes in rendered text");
check(d.body.textContent.split(site.attribution).length === 2, "attribution appears once in rendered text");
check(d.querySelectorAll(".pill.sim").length > 5 && d.querySelectorAll(".pill.real").length > 5, "real and simulated labels are rendered on the trust center");

for (const [v, re] of [["overview", /Program overview/], ["controls", /Controls and crosswalk/], ["ai", /AI systems and agents/], ["evidence", /Evidence/], ["risks", /Risk register/], ["vendors", /Third-party risk/], ["board", /Board brief/], ["tested", /tested/], ["glossary", /Glossary/]]) {
  await go("#" + v);
  const el = d.querySelector(".view.active");
  check(el && el.id === "view-" + v && re.test(el.querySelector("h1").textContent) && el.innerHTML.length > 500, `view #${v} renders`);
}
check(errors.length === 0, "no script errors after rendering every view" + (errors.length ? ": " + errors[0] : ""));

// controls view: every control listed, filters work, crosswalk mode
await go("#controls");
const rows = () => d.querySelectorAll("#controls-list tr.row").length;
check(rows() === controls.length, `controls table lists all ${controls.length} controls`);
d.querySelector("#f-ai").checked = true; d.querySelector("#f-ai").dispatchEvent(new w.Event("change"));
check(rows() === controls.filter(c => c.ai).length, "AI-only filter narrows the table");
d.querySelector("#f-ai").checked = false; d.querySelector("#f-ai").dispatchEvent(new w.Event("change"));
d.querySelector("#f-q").value = "encrypt"; d.querySelector("#f-q").dispatchEvent(new w.Event("input"));
check(rows() > 0 && rows() < controls.length, "search narrows the table");
d.querySelector("#f-q").value = ""; d.querySelector("#f-q").dispatchEvent(new w.Event("input"));
d.querySelector('[data-cmode="framework"]').click();
check(d.querySelectorAll("#controls-list table tbody tr").length > 50 && /reference IDs are satisfied/.test(d.querySelector("#controls-list").textContent), "framework-first crosswalk renders reference rows");
d.querySelector('[data-cmode="controls"]').click();

// drawer and deep links
await go("#controls/NC-PR-07");
check(d.querySelector("#drawer").classList.contains("open") && /Content Security Policy/.test(d.querySelector("#drawer h2").textContent), "deep link opens the control drawer");
check(d.querySelectorAll("#drawer .chip.fw-csf").length > 0 && /Evidence/.test(d.querySelector("#drawer").textContent), "control drawer shows crosswalk chips and an evidence block");
d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape" }));
check(!d.querySelector("#drawer").classList.contains("open"), "Escape closes the drawer");
await go("#risks/R-02");
check(d.querySelector("#drawer").classList.contains("open") && /R-02/.test(d.querySelector("#drawer").textContent), "risk deep link opens the risk drawer");
await go("#vendors/V-01");
check(d.querySelector("#drawer").classList.contains("open") && /Google/.test(d.querySelector("#drawer h2").textContent), "vendor deep link opens the vendor drawer");
await go("#ai/AI-05");
check(d.querySelector("#drawer").classList.contains("open") && /control mapper/i.test(d.querySelector("#drawer h2").textContent) && d.querySelectorAll("#drawer table.rt tr").length > 3, "AI system deep link opens the runtime permissions table");
await go("#tested/POL-02");
check(d.querySelector("#drawer").classList.contains("open") && /AI Use Policy/.test(d.querySelector("#drawer h2").textContent) && d.querySelectorAll("#drawer .policy-body li").length > 5, "policy deep link renders the policy body");
await go("#tested");

// reader mode and theme
d.querySelector('.seg [data-reader="tech"]').click();
check(d.documentElement.getAttribute("data-reader") === "tech" && w.localStorage.getItem("ntc-reader") === "tech", "Technical reader mode is set and remembered");
d.querySelector('.seg [data-reader="plain"]').click();
check(d.documentElement.getAttribute("data-reader") === "plain", "Plain reader mode restores");
d.querySelector("#mode").click();
check(d.documentElement.getAttribute("data-mode") === "light" && w.localStorage.getItem("ntc-mode") === "light", "theme toggle switches to light and remembers");
d.querySelector("#mode").click();

// in-page mapper fallback (no backend reachable)
await go("#controls");
d.querySelector("#map-q").value = "Do you rotate API keys and service account credentials?";
d.querySelector("#map-go").click();
await tick(150);
const props = [...d.querySelectorAll("#map-out .prop")];
check(props.length > 0 && props.length <= 3 && /keyword/i.test(d.querySelector("#map-out").textContent), "in-page mapper fallback returns keyword proposals when no backend answers");
check(props.every(p => controls.some(c => p.textContent.includes(c.id))), "fallback proposals are real control ids");
check(props.some(p => /NC-PR-05|NC-PR-04/.test(p.textContent)), "credential question maps to the secrets or non-human identity control");
d.querySelector("#map-q").value = "";
d.querySelector("#map-go").click(); await tick(50);
check(/Type a question first/.test(d.querySelector("#map-status").textContent), "empty question is refused in the page");

// risks: heat map, table, scenario determinism
await go("#risks");
check(d.querySelectorAll("#heat .cell").length === 25 && d.querySelectorAll("#view-risks tr.row").length === risks.length, "heat map has 25 cells and the table lists every risk");
const api = w.__NTC__;
const cfg = { f: { min: .05, mode: .2, max: .6 }, m: { min: 40000, mode: 180000, max: 900000 }, fFactor: 1, mFactor: 1, tailFactor: 1 };
const s1 = api.simulate(cfg, 10000, 42), s2 = api.simulate(cfg, 10000, 42), s3 = api.simulate({ ...cfg, fFactor: .5 }, 10000, 42);
check(s1.mean === s2.mean && s1.p90 === s2.p90, "scenario simulation is deterministic for a seed");
check(s3.mean < s1.mean, "halving frequency lowers expected annual loss");
check(/Expected annual loss/.test(d.querySelector("#sim-out").textContent) && d.querySelector("#sim-out svg.chart"), "scenario results and loss exceedance chart render");
d.querySelector("#legal").checked = false; d.querySelector("#legal").dispatchEvent(new w.Event("change"));
check(/Expected annual loss/.test(d.querySelector("#sim-out").textContent), "toggling the safe-harbor lever re-runs the simulation");

// board brief
await go("#board");
check(d.querySelectorAll("#view-board .paper").length === 2 && /Decisions we need/.test(d.querySelector("#view-board").textContent), "board brief renders two pages");
check(api.aboveAppetite.every(r => d.querySelector("#view-board").textContent.includes(r.title)), "board brief names every risk above appetite");
d.querySelector("#print").click();
check(w.__printed === true, "print button calls window.print");

// evidence and overview numbers agree with the embedded bundle
await go("#evidence");
const ev = api.data.evidence.latest;
if (ev) check(d.querySelectorAll("#view-evidence table.tbl tbody tr").length >= ev.checks.length, "evidence table lists every check in the bundle"); else check(true, "evidence table (skipped, no bundle)");
await go("#overview");
check(new RegExp(api.health.pct + "%").test(d.querySelector("#view-overview").textContent), "overview control health matches the computed value");
check(errors.length === 0, "no script errors after interactions" + (errors.length ? ": " + errors[0] : ""));

// glossary search
await go("#glossary");
d.querySelector("#g-q").value = "prompt injection"; d.querySelector("#g-q").dispatchEvent(new w.Event("input"));
check(d.querySelectorAll("#g-list .card").length >= 1 && d.querySelectorAll("#g-list .card").length < 10, "glossary search filters terms");

done();
