/* Nimbus Trust Center page script. Everything renders from the JSON embedded at build time (#data).
   No framework, no network calls except the health probe and the control mapper endpoint. */
(function () {
  "use strict";
  const D = JSON.parse(document.getElementById("data").textContent);
  const FW = D.frameworks.frameworks, DRV = D.frameworks.drivers;
  const NOW = window.__NOW__ ? new Date(window.__NOW__) : new Date();
  const DAY = 86400000;
  const byId = (arr, key = "id") => { const m = new Map(); for (const x of arr) m.set(x[key], x); return m; };
  const C = byId(D.controls), R = byId(D.risks.risks), V = byId(D.vendors), X = byId(D.exceptions), A = byId(D.ai), POL = byId(D.policies);

  // ---------- helpers ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmtDate = iso => { if (!iso) return "n/a"; const d = new Date(iso); return isNaN(d) ? String(iso) : d.toISOString().slice(0, 10); };
  const days = iso => Math.floor((NOW - new Date(iso)) / DAY);
  const ago = iso => { const n = days(iso); return n <= 0 ? "today" : n === 1 ? "1 day ago" : n + " days ago"; };
  const money = n => "$" + Math.round(n).toLocaleString("en-US");
  const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
  const pill = (cls, text, title) => `<span class="pill ${cls}"${title ? ` title="${esc(title)}"` : ""}>${esc(text)}</span>`;
  const reality = r => r === "real" ? pill("real", "Real", "Exists and can be inspected") : pill("sim", "Simulated", "Invented for the story");
  const chips = c => {
    const m = c.mappings || {}; const out = [];
    for (const id of m.csf || []) out.push(`<span class="chip fw-csf" title="${esc(FW.csf.ids[id] || "")}">CSF ${esc(id)}</span>`);
    for (const x of m.cis || []) out.push(`<span class="chip fw-cis" title="${esc(FW.cis.ids[x.id] || "")}">CIS ${esc(x.id)} IG${x.ig}</span>`);
    for (const id of m.soc2 || []) out.push(`<span class="chip fw-soc2" title="${esc(FW.soc2.ids[id] || "")}">SOC 2 ${esc(id)}</span>`);
    for (const id of m.airmf || []) out.push(`<span class="chip fw-airmf" title="${esc(FW.airmf.ids[id] || "")}">AI RMF ${esc(id)}</span>`);
    return out.join("");
  };
  const link = (hash, text, cls) => `<a href="#${esc(hash)}"${cls ? ` class="${cls}"` : ""}>${esc(text)}</a>`;
  const ctrlLink = id => { const c = C.get(id); return c ? link("controls/" + id, id + " " + c.title) : esc(id); };
  const riskLink = id => { const r = R.get(id); return r ? link("risks/" + id, id + " " + r.title) : esc(id); };
  const setPct = (el, v) => el.style.setProperty("--pct", String(Math.max(0, Math.min(100, v))));
  const applyBars = root => { $$("[data-pct]", root).forEach(el => setPct(el, Number(el.getAttribute("data-pct")))); };
  const statusDot = s => ({ operating: "ok", partial: "warn", planned: "info" }[s] || "");

  // ---------- derived state ----------
  const EV = D.evidence.latest || null;
  const evAge = EV ? days(EV.generated_at) : null;
  function evState(c) {
    if (c.automation && EV) {
      const checks = EV.checks.filter(k => k.id === c.automation || k.id.startsWith(c.automation + "."));
      if (!checks.length) {
        if (EV.scope === "local-only" && (c.automation === "check.transport" || c.automation === "check.headers")) return { state: "pending", label: "Awaiting the first live run", cls: "warn", checks: [] };
        return { state: "none", label: "No evidence yet", cls: "bad", checks: [] };
      }
      const fail = checks.filter(k => k.result === "fail").length, warn = checks.filter(k => k.result === "warn").length;
      if (fail) return { state: "failing", label: fail + " check" + (fail > 1 ? "s" : "") + " failing", cls: "bad", checks, ageDays: evAge };
      if (evAge > c.freshness_days) return { state: "stale", label: "Evidence stale (" + evAge + "d, limit " + c.freshness_days + "d)", cls: "warn", checks, ageDays: evAge };
      return { state: "fresh", label: (warn ? warn + " warning, " : "") + "evidence " + (evAge === 0 ? "today" : evAge + "d old"), cls: warn ? "warn" : "ok", checks, ageDays: evAge };
    }
    if (c.last_evidence) {
      const a = days(c.last_evidence);
      if (a > c.freshness_days) return { state: "overdue", label: "Overdue: last " + fmtDate(c.last_evidence) + " (" + a + "d, limit " + c.freshness_days + "d)", cls: "warn", checks: [], ageDays: a };
      return { state: "current", label: "Attested " + fmtDate(c.last_evidence) + " (" + a + "d, limit " + c.freshness_days + "d)", cls: "ok", checks: [], ageDays: a };
    }
    return { state: "none", label: "No evidence recorded", cls: "bad", checks: [] };
  }
  const ES = new Map(D.controls.map(c => [c.id, evState(c)]));
  const health = (() => {
    const s = { fresh: 0, current: 0, stale: 0, overdue: 0, failing: 0, none: 0, pending: 0, total: D.controls.length };
    for (const v of ES.values()) s[v.state] = (s[v.state] || 0) + 1;
    s.good = s.fresh + s.current; s.pct = pct(s.good, s.total);
    s.automated = D.controls.filter(c => c.automation).length;
    return s;
  })();
  function coverage(key) {
    const ids = new Set();
    for (const c of D.controls) for (const m of (c.mappings[key] || [])) ids.add(key === "cis" ? m.id : m);
    const total = Object.keys(FW[key].ids).length;
    const out = { referenced: ids.size, total, pct: pct(ids.size, total), ids };
    if (key === "csf") { out.byFn = {}; for (const fn of Object.keys(FW.csf.functions)) { const all = Object.keys(FW.csf.ids).filter(i => i.startsWith(fn + ".")); const got = all.filter(i => ids.has(i)); out.byFn[fn] = { got: got.length, all: all.length }; } }
    if (key === "cis") { const ig1 = new Set(); for (const c of D.controls) for (const m of c.mappings.cis || []) if (m.ig === 1) ig1.add(m.id); out.ig1 = ig1.size; }
    return out;
  }
  const COV = { csf: coverage("csf"), cis: coverage("cis"), soc2: coverage("soc2"), airmf: coverage("airmf") };
  const score = r => r.likelihood * r.impact;
  const APP = D.risks.appetite.line || 9;
  const risksSorted = D.risks.risks.slice().sort((a, b) => score(b.residual) - score(a.residual) || a.id.localeCompare(b.id));
  const aboveAppetite = risksSorted.filter(r => score(r.residual) > APP);
  const openExceptions = D.exceptions.filter(e => new Date(e.expires) >= NOW);
  const drift = (() => {
    if (!EV || !D.evidence.previous) return null;
    const prev = D.evidence.previous.results || {}; const changed = [];
    for (const k of EV.checks) if (prev[k.id] && prev[k.id] !== k.result) changed.push({ id: k.id, from: prev[k.id], to: k.result });
    const added = EV.checks.filter(k => !prev[k.id]).map(k => k.id);
    return { since: D.evidence.previous.generated_at, changed, added };
  })();
  const evSummary = EV ? { pass: EV.checks.filter(k => k.result === "pass").length, warn: EV.checks.filter(k => k.result === "warn").length, fail: EV.checks.filter(k => k.result === "fail").length, total: EV.checks.length } : null;
  function driverStatus(key) {
    const cs = D.controls.filter(c => (c.drivers || []).includes(key));
    const good = cs.filter(c => ["fresh", "current"].includes(ES.get(c.id).state)).length;
    return { controls: cs.length, good, pct: pct(good, cs.length), current: good === cs.length };
  }

  // ---------- reader mode, theme, status ----------
  function setReader(mode) {
    document.documentElement.setAttribute("data-reader", mode);
    $$(".seg [data-reader]").forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute("data-reader") === mode)));
    try { localStorage.setItem("ntc-reader", mode); } catch (e) { /* ignore */ }
  }
  $$(".seg [data-reader]").forEach(b => b.addEventListener("click", () => setReader(b.getAttribute("data-reader"))));
  setReader(document.documentElement.getAttribute("data-reader") || "plain");
  const modeBtn = $("#mode");
  const paintMode = () => { modeBtn.textContent = document.documentElement.getAttribute("data-mode") === "light" ? "☾" : "☀"; };
  modeBtn.addEventListener("click", () => { const m = document.documentElement.getAttribute("data-mode") === "light" ? "dark" : "light"; document.documentElement.setAttribute("data-mode", m); try { localStorage.setItem("ntc-mode", m); } catch (e) { /* ignore */ } paintMode(); });
  paintMode();
  let HEALTH = null;
  const statusEl = $("#status");
  function paintStatus(state, text, short) { statusEl.className = "status " + state; $(".long", statusEl).textContent = text; $(".short", statusEl).textContent = short || (state === "on" ? "AI on" : "keyword"); }
  function probe() {
    if (!/^https?:/.test(location.protocol)) { paintStatus("off", "AI mapper: keyword only (no backend)"); HEALTH = { ok: false, offline: true }; return; }
    fetch("/api/health", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => {
      HEALTH = j || { ok: false, offline: true };
      if (!j) paintStatus("off", "AI mapper: keyword only (no backend)");
      else if (j.ok) paintStatus("on", "AI mapper on: " + (j.model || j.provider));
      else paintStatus("off", "AI mapper switched off: keyword fallback");
    }).catch(() => { HEALTH = { ok: false, offline: true }; paintStatus("off", "AI mapper: keyword only (no backend)"); });
  }
  probe();

  // ---------- drawer ----------
  const drawer = $("#drawer"), scrim = $("#scrim"), dbody = $("#drawer-body");
  let lastFocus = null;
  function openDrawer(html) {
    lastFocus = document.activeElement; dbody.innerHTML = html; drawer.classList.add("open"); scrim.classList.add("show");
    drawer.setAttribute("aria-hidden", "false"); applyBars(dbody); $("#drawer-close").focus();
  }
  function closeDrawer(keepHash) {
    drawer.classList.remove("open"); scrim.classList.remove("show"); drawer.setAttribute("aria-hidden", "true");
    if (!keepHash && location.hash.includes("/")) history.replaceState(null, "", location.hash.split("/")[0]);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $("#drawer-close").addEventListener("click", () => closeDrawer(false));
  scrim.addEventListener("click", () => closeDrawer(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer(false); });

  // ---------- detail renderers ----------
  function evidenceBlock(c) {
    const s = ES.get(c.id);
    let html = `<div class="ev"><div><span class="dot ${s.cls}"></span><strong>${esc(s.label)}</strong></div>`;
    if (s.checks.length) {
      html += `<div class="small muted mt">From the evidence bundle generated ${esc(fmtDate(EV.generated_at))} (${esc(ago(EV.generated_at))}):</div><ul class="list small">`;
      for (const k of s.checks) html += `<li><span class="dot ${k.result === "pass" ? "ok" : k.result === "warn" ? "warn" : "bad"}"></span><span class="id">${esc(k.id)}</span> ${esc(k.observed)}${k.source_url ? ` <a href="${esc(k.source_url)}" target="_blank" rel="noopener">source</a>` : ""}<span class="tech"> (expected: ${esc(k.expected)})</span></li>`;
      html += `</ul>`;
    } else if (c.last_evidence) {
      html += `<div class="small muted mt">${c.reality === "simulated" ? "Simulated attestation record for a simulated company. " : ""}Evidence type: ${esc(c.evidence_type)}. Frequency: ${esc(c.frequency)}.</div>`;
    }
    return html + `</div>`;
  }
  function controlDetail(id) {
    const c = C.get(id); if (!c) return `<p>Unknown control ${esc(id)}.</p>`;
    const ex = D.exceptions.filter(e => e.control_id === id);
    const aiSys = D.ai.filter(a => (a.linked_controls || []).includes(id));
    const drivers = (c.drivers || []).map(k => DRV[k] ? `<span class="chip" title="${esc(DRV[k].plain)}">${esc(DRV[k].name)}</span>` : "").join("");
    return `
      <div class="tag">Control ${esc(c.id)} <span class="muted">/ ${esc(FW.csf.functions[c.function] || c.function)}</span></div>
      <h2>${esc(c.title)}</h2>
      <div class="linkrow">${reality(c.reality)} ${c.ai ? pill("ai", "AI control") : ""} ${pill(statusDot(c.status) || "", c.status)}</div>
      <div class="explain plain-only">${esc(c.plain)}</div>
      <p class="tech"><strong>Control statement.</strong> ${esc(c.statement)}</p>
      <p class="plain-only small muted">${esc(c.statement)}</p>
      <h3>Evidence</h3>
      ${evidenceBlock(c)}
      <dl class="kv">
        <dt>Owner (role)</dt><dd>${esc(c.owner_role)}</dd>
        <dt>Frequency</dt><dd>${esc(c.frequency)} <span class="muted">(evidence must be under ${c.freshness_days} days old)</span></dd>
        <dt class="tech">Evidence type</dt><dd class="tech">${esc(c.evidence_type)}${c.automation ? ` <span class="chip">${esc(c.automation)}</span>` : ""}</dd>
        <dt class="tech">Test procedure</dt><dd class="tech">${esc(c.test_procedure)}</dd>
        <dt>Why it matters</dt><dd>${drivers || "<span class='muted'>internal</span>"}</dd>
      </dl>
      <div class="tech"><h3>Framework crosswalk</h3><div>${chips(c)}</div>
      <ul class="list small mt">${[...(c.mappings.csf || []).map(i => `<li><span class="chip fw-csf">CSF ${esc(i)}</span> ${esc(FW.csf.ids[i])}</li>`), ...(c.mappings.cis || []).map(m => `<li><span class="chip fw-cis">CIS ${esc(m.id)} IG${m.ig}</span> ${esc(FW.cis.ids[m.id])}</li>`), ...(c.mappings.soc2 || []).map(i => `<li><span class="chip fw-soc2">SOC 2 ${esc(i)}</span> ${esc(FW.soc2.ids[i])}</li>`), ...(c.mappings.airmf || []).map(i => `<li><span class="chip fw-airmf">AI RMF ${esc(i)}</span> ${esc(FW.airmf.ids[i])}</li>`)].join("")}</ul></div>
      ${c.linked_risks && c.linked_risks.length ? `<h3>Risks this control reduces</h3><ul class="list small">${c.linked_risks.map(r => `<li>${riskLink(r)}</li>`).join("")}</ul>` : ""}
      ${c.linked_policies && c.linked_policies.length ? `<h3>Policies</h3><div class="linkrow">${c.linked_policies.map(p => POL.get(p) ? link("tested/" + p, p + " " + POL.get(p).title, "chip") : "").join("")}</div>` : ""}
      ${aiSys.length ? `<h3>AI systems it applies to</h3><ul class="list small">${aiSys.map(a => `<li>${link("ai/" + a.id, a.id + " " + a.name)}</li>`).join("")}</ul>` : ""}
      ${ex.length ? `<h3>Open exceptions</h3>${ex.map(e => `<div class="ev"><strong>${esc(e.id)} ${esc(e.title)}</strong><div class="small">${esc(e.plain)}</div><div class="small muted">Accepted by ${esc(e.risk_accepted_by_role)}, expires ${esc(e.expires)}. Compensating: ${esc(e.compensating)}</div></div>`).join("")}` : ""}
      ${c.notes ? `<p class="small muted mt"><strong>Note.</strong> ${esc(c.notes)}</p>` : ""}
      <details class="tech"><summary class="small">Raw record</summary><pre class="raw">${esc(JSON.stringify(c, null, 2))}</pre></details>`;
  }
  function riskDetail(id) {
    const r = R.get(id); if (!r) return `<p>Unknown risk.</p>`;
    const inh = score(r.inherent), res = score(r.residual);
    return `
      <div class="tag">Risk ${esc(r.id)} <span class="muted">/ ${esc(r.category)}</span></div>
      <h2>${esc(r.title)}</h2>
      <div class="linkrow">${reality(r.reality)} ${res > APP ? pill("bad", "Above appetite") : pill("ok", "Within appetite")} ${r.decision_required ? pill("warn", "Decision required") : ""} ${pill("", "Trend: " + r.trend)}</div>
      <div class="explain plain-only">${esc(r.plain)}</div>
      <p><strong>Scenario.</strong> ${esc(r.scenario)}</p>
      <div class="results">
        <div class="kpi tight"><div class="n num">${inh}</div><div class="l">Inherent (L${r.inherent.likelihood} x I${r.inherent.impact})</div></div>
        <div class="kpi tight"><div class="n num">${res}</div><div class="l">Residual (L${r.residual.likelihood} x I${r.residual.impact})</div></div>
        <div class="kpi tight"><div class="n num">${APP}</div><div class="l">Appetite line</div></div>
        <div class="kpi tight"><div class="n">${esc(r.treatment)}</div><div class="l">Treatment</div></div>
      </div>
      <dl class="kv"><dt>Owner (role)</dt><dd>${esc(r.owner_role)}</dd><dt>Treatment note</dt><dd>${esc(r.treatment_note)}</dd><dt>Key risk indicator</dt><dd>${esc(r.kri)}</dd></dl>
      <h3>Controls that reduce it</h3><ul class="list small">${(r.linked_controls || []).map(c => `<li><span class="dot ${ES.get(c) ? ES.get(c).cls : ""}"></span>${ctrlLink(c)}</li>`).join("")}</ul>
      ${r.id === D.scenario.linked_risks?.[0] ? `<p class="small">${link("risks/scenario", "Quantified in the loss scenario below")}</p>` : ""}
      <details class="tech"><summary class="small">Raw record</summary><pre class="raw">${esc(JSON.stringify(r, null, 2))}</pre></details>`;
  }
  function vendorDetail(id) {
    const v = V.get(id); if (!v) return `<p>Unknown vendor.</p>`;
    const k = v.contract || {};
    return `
      <div class="tag">Vendor ${esc(v.id)} <span class="muted">/ tier ${v.tier}${v.critical ? ", critical" : ""}</span></div>
      <h2>${esc(v.name)}</h2>
      <div class="linkrow">${reality(v.reality)} ${v.subprocessor ? pill("info", "Subprocessor") : ""} ${pill(v.soc2_report && v.soc2_report.startsWith("on file") ? "ok" : "warn", "SOC 2: " + v.soc2_report)} ${v.iso27001 ? pill("ok", "ISO 27001") : ""}</div>
      <div class="explain plain-only">${esc(v.plain)}</div>
      <p><strong>Service.</strong> ${esc(v.service)}</p>
      <dl class="kv">
        <dt>Data access</dt><dd>${(v.data_access || []).map(esc).join("; ")}</dd>
        <dt>Trust center</dt><dd>${v.trust_center_url ? `<a href="${esc(v.trust_center_url)}" target="_blank" rel="noopener">${esc(v.trust_center_url)}</a>` : "n/a"}</dd>
        <dt>Last reviewed</dt><dd>${esc(fmtDate(v.last_reviewed))} (${esc(ago(v.last_reviewed))}, cadence ${v.review_cadence_days}d)</dd>
        <dt>Concentration</dt><dd>${esc(v.concentration || "none noted")}</dd>
      </dl>
      <h3>Contract checklist</h3>
      <table class="tbl"><tbody>
        <tr><td>Breach notification window</td><td>${k.breach_notice_hours ? k.breach_notice_hours + " hours" : `<span class="warn">${esc(k.note || "not stated")}</span>`}</td></tr>
        <tr><td>Subprocessor change notice</td><td class="${k.subprocessor_notice ? "yes" : "no"}">${k.subprocessor_notice ? "yes" : "no"}</td></tr>
        <tr><td>Right to audit</td><td class="${k.right_to_audit ? "yes" : "no"}">${k.right_to_audit ? "yes" : "no"}</td></tr>
        <tr><td>Data location</td><td>${esc(k.data_location || "not stated")}</td></tr>
      </tbody></table>
      ${(v.linked_controls || []).length ? `<h3>Controls</h3><ul class="list small">${v.linked_controls.map(ctrlLink).map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
      ${(v.linked_risks || []).length ? `<h3>Risks</h3><ul class="list small">${v.linked_risks.map(riskLink).map(x => `<li>${x}</li>`).join("")}</ul>` : ""}
      <details class="tech"><summary class="small">Raw record</summary><pre class="raw">${esc(JSON.stringify(v, null, 2))}</pre></details>`;
  }
  function aiDetail(id) {
    const a = A.get(id); if (!a) return `<p>Unknown system.</p>`;
    return `<div class="tag">AI system ${esc(a.id)}</div><h2>${esc(a.name)}</h2>${aiCard(a, true)}`;
  }
  function policyDetail(id) {
    const p = POL.get(id); if (!p) return `<p>Unknown policy.</p>`;
    return `<div class="tag">Policy ${esc(p.id)} <span class="muted">v${esc(p.version)}</span></div><h2>${esc(p.title)}</h2>
      <div class="linkrow">${reality(p.reality)} ${pill(days(p.last_reviewed) <= p.review_days ? "ok" : "warn", "Reviewed " + fmtDate(p.last_reviewed))}</div>
      <div class="explain plain-only">${esc(p.plain)}</div>
      <dl class="kv"><dt>Owner</dt><dd>${esc(p.owner_role)}</dd><dt>Approved by</dt><dd>${esc(p.approved_by_role)}</dd><dt>Review cycle</dt><dd>${p.review_days} days</dd></dl>
      <div class="policy-body">${p.html}</div>`;
  }

  // ---------- AI card ----------
  function aiCard(a, full) {
    const rt = (a.runtime || []).map(r => `<tr><td>${esc(r.action)}</td><td class="${r.allowed ? "yes" : "no"}">${r.allowed ? "Allowed" : "Not allowed"}</td><td>${esc(r.guard)}</td><td class="tech">${esc(r.approver)}</td><td class="tech">${r.logged ? "yes" : "no"}</td></tr>`).join("");
    const cant = (a.runtime || []).filter(r => !r.allowed).map(r => `<li>${esc(r.action)}</li>`).join("");
    return `
      <div class="linkrow">${reality(a.reality)} ${pill("", a.status)} ${a.traiga ? pill(a.traiga.status === "aligned" ? "ok" : "warn", "TRAIGA: " + a.traiga.status) : ""} ${a.eu_ai_act ? pill("info", "EU AI Act: " + a.eu_ai_act.class.split(" (")[0]) : ""}</div>
      <div class="explain plain-only">${esc(a.plain)}</div>
      <p class="tech"><strong>Purpose.</strong> ${esc(a.purpose)}</p>
      <dl class="kv">
        <dt>Users</dt><dd>${esc(a.users)}</dd>
        <dt>Model</dt><dd>${esc(a.vendor)} ${esc(a.model)} <span class="muted">on ${esc(a.hosting)}</span></dd>
        <dt>Data it touches</dt><dd>${(a.data_classes || []).map(d => `<span class="chip">${esc(d)}</span>`).join("")}</dd>
        <dt class="tech">Human oversight</dt><dd class="tech">${esc(a.human_oversight)}</dd>
        <dt class="tech">Logging</dt><dd class="tech">${esc(a.logging)}</dd>
        <dt class="tech">Kill switch</dt><dd class="tech">${esc(a.kill_switch)}</dd>
        <dt>Owner (role)</dt><dd>${esc(a.owner_role)}, reviewed ${esc(fmtDate(a.last_reviewed))}, every ${a.review_cadence_days} days</dd>
      </dl>
      <details class="faq plain-only"><summary>How it is watched, what it keeps, and how it is switched off</summary><dl class="kv"><dt>Human oversight</dt><dd>${esc(a.human_oversight)}</dd><dt>Logging</dt><dd>${esc(a.logging)}</dd><dt>Kill switch</dt><dd>${esc(a.kill_switch)}</dd></dl></details>
      <h3>What it may and may not do</h3>
      <div class="plain-only">${cant ? `<p class="small mb0">It cannot:</p><ul class="list small">${cant}</ul>` : ""}</div>
      <div class="tblwrap tech"><table class="tbl rt"><thead><tr><th>Action</th><th>Allowed</th><th>Guard</th><th>Approver</th><th>Logged</th></tr></thead><tbody>${rt}</tbody></table></div>
      ${full ? `
      <div class="tech"><h3>NIST AI RMF</h3><dl class="kv"><dt>Govern</dt><dd>${esc(a.airmf.govern)}</dd><dt>Map</dt><dd>${esc(a.airmf.map)}</dd><dt>Measure</dt><dd>${esc(a.airmf.measure)}</dd><dt>Manage</dt><dd>${esc(a.airmf.manage)}</dd></dl>
      <h3>Legal drivers</h3><dl class="kv"><dt>Texas HB 149 (TRAIGA)</dt><dd>${esc(a.traiga.defense)}</dd><dt>EU AI Act</dt><dd>${esc(a.eu_ai_act.class)}. ${esc(a.eu_ai_act.note)}</dd></dl></div>
      <div class="plain-only"><h3>Rules it is checked against</h3><p class="small">${esc(a.airmf.govern)} ${esc(a.airmf.measure)}</p></div>
      <h3>Controls</h3><ul class="list small">${(a.linked_controls || []).map(c => `<li><span class="dot ${ES.get(c) ? ES.get(c).cls : ""}"></span>${ctrlLink(c)}</li>`).join("")}</ul>
      <h3>Risks</h3><ul class="list small">${(a.linked_risks || []).map(r => `<li>${riskLink(r)}</li>`).join("")}</ul>
      ${(a.evidence_links || []).length ? `<h3>Evidence</h3><ul class="list small">${a.evidence_links.map(e => `<li><a href="${esc(e.url)}"${/^https?:/.test(e.url) ? ` target="_blank" rel="noopener"` : ""}>${esc(e.label)}</a></li>`).join("")}</ul>` : ""}
      <details class="tech"><summary class="small">Raw record</summary><pre class="raw">${esc(JSON.stringify(a, null, 2))}</pre></details>` : `<p class="small">${link("ai/" + a.id, "Full record: oversight, AI RMF rows, legal drivers, evidence")}</p>`}`;
  }

  // ---------- views ----------
  const views = {};
  views.trust = () => {
    const badges = [
      { t: "NIST CSF 2.0", d: "Adopted as the company framework (the size tier under Texas SB 2610 requires NIST CSF or ISO 27001).", r: "simulated", s: driverStatus("sb2610") },
      { t: "SOC 2 Type II", d: "Report held for the current period; available to customers under NDA.", r: "simulated", s: driverStatus("soc2_report") },
      { t: "PCI DSS SAQ A", d: "Card data is handled by the payment processor and never touches Nimbus systems.", r: "simulated", s: driverStatus("pci_saq_a") },
      { t: "NIST AI RMF", d: "Every AI system is inventoried and mapped to Govern, Map, Measure, Manage; the affirmative-defense file under Texas HB 149.", r: "real", s: driverStatus("traiga") }
    ];
    const hl = D.controls.filter(c => c.reality === "real" && ["NC-PR-06", "NC-PR-07", "NC-PR-14", "NC-PR-19", "NC-DE-01", "NC-ID-07"].includes(c.id));
    const subs = D.vendors.filter(v => v.subprocessor);
    const realCount = D.controls.filter(c => c.reality === "real").length;
    return `
      <div class="hero">
        <div class="tag">Trust Center</div>
        <h1 id="h-trust">How Nimbus protects customer data and governs its AI</h1>
        <p class="lead">Nimbus is a fictional software company invented to show what a complete security and AI governance program looks like. The AI assistants it runs are real. This page shows the safeguards, the evidence behind them, and what the AI may and may not do. Evidence is collected by a scheduled job, not gathered once a year for an audit.</p>
        <div class="cta"><a class="btn primary" href="#evidence">See the live evidence</a><a class="btn" href="#ai">How the AI is governed</a><a class="btn" href="#controls">Browse all ${D.controls.length} controls</a></div>
      </div>
      <div class="notice"><strong>What is real here.</strong> Nimbus is a fictional company, so its size, staff, and policies are simulated and labelled <span class="pill sim">Simulated</span>. The AI assistants, their safeguards, the vendors, the daily evidence job, and the build gates exist and can be inspected; those carry <span class="pill real">Real</span>. ${realCount} of ${D.controls.length} controls are real. ${link("tested", "Full real-versus-simulated table")}.</div>
      <div class="section"><div class="section-h"><h2>Status at a glance</h2><p>${EV ? `Last evidence run ${esc(ago(EV.generated_at))}: ${evSummary.pass} of ${evSummary.total} checks passing${evSummary.warn ? `, ${evSummary.warn} warning${evSummary.warn > 1 ? "s" : ""}` : ""}${evSummary.fail ? `, ${evSummary.fail} failing` : ""}.` : "No evidence bundle yet."}</p></div>
      <div class="badge-grid">${badges.map(b => `<div class="badge"><div class="linkrow"><span class="t">${esc(b.t)}</span>${reality(b.r)}</div><div class="d">${esc(b.d)}</div><div class="bar ${b.s.pct === 100 ? "ok" : b.s.pct >= 70 ? "warn" : "bad"}" data-pct="${b.s.pct}"><i></i></div><div class="small muted">${b.s.good} of ${b.s.controls} supporting controls have current evidence</div></div>`).join("")}</div></div>
      <div class="section"><div class="section-h"><h2>Safeguards you can check yourself</h2><p>Real controls with evidence collected from the live sites.</p></div>
      <div class="grid g3">${hl.map(c => { const s = ES.get(c.id); return `<div class="card tight"><div class="hl"><div class="ic">&#10003;</div><div><div class="linkrow"><strong>${esc(c.title)}</strong></div><div class="small muted mt">${esc(c.plain)}</div><div class="small mt"><span class="dot ${s.cls}"></span>${esc(s.label)} &middot; ${link("controls/" + c.id, "details")}</div></div></div></div>`; }).join("")}</div></div>
      <div class="section"><div class="section-h"><h2>The AI assistants, and what they cannot do</h2><p>Each system is inventoried with its permissions, oversight, and an off switch.</p></div>
      <div class="grid g2">${D.ai.filter(a => a.status === "production").map(a => `<div class="card tight"><h3>${esc(a.name)} ${reality(a.reality)}</h3><div class="small muted">${esc(a.plain)}</div><p class="small mb0 mt"><strong>Cannot:</strong></p><ul class="list small">${(a.runtime || []).filter(r => !r.allowed).slice(0, 3).map(r => `<li>${esc(r.action)}</li>`).join("")}</ul><div class="small">${link("ai/" + a.id, "Permissions, oversight, kill switch")}</div></div>`).join("")}</div></div>
      <div class="section two">
        <div class="card"><h3>Subprocessors</h3><p class="small muted">Companies that process data on Nimbus's behalf.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Vendor</th><th>Purpose</th><th>Assurance</th></tr></thead><tbody>${subs.map(v => `<tr class="row" data-open="vendors/${esc(v.id)}"><td>${esc(v.name)} ${reality(v.reality)}</td><td class="small">${esc(v.service)}</td><td class="small">${esc(v.soc2_report)}${v.iso27001 ? ", ISO 27001" : ""}</td></tr>`).join("")}</tbody></table></div></div>
        <div class="card"><h3>Rules Nimbus works under</h3><p class="small muted">Laws, standards, and contracts that shape the controls. Jurisdiction-specific items are listed for completeness, not emphasis.</p><ul class="list small">${Object.keys(DRV).map(k => `<li><strong>${esc(DRV[k].name)}</strong> ${reality(DRV[k].reality)}<div class="muted">${esc(DRV[k].plain)}</div></li>`).join("")}</ul></div>
      </div>
      <div class="section"><div class="card"><h3>Request the SOC 2 report or a security questionnaire</h3><p class="small">On a real trust center this button starts an NDA flow. Here it explains itself: Nimbus is simulated and there is no real report. What exists instead is the ${link("controls", "control mapper")}, which answers a questionnaire question from the control library, and the ${link("evidence", "evidence feed")}.</p><button type="button" class="btn small" id="req-report">Request a report</button><span id="req-note" class="small muted"></span></div></div>`;
  };

  views.overview = () => {
    const fnRows = Object.keys(FW.csf.functions).map(fn => { const b = COV.csf.byFn[fn]; return `<tr><td><strong>${esc(fn)}</strong> ${esc(FW.csf.functions[fn])}</td><td class="num">${D.controls.filter(c => c.function === fn).length}</td><td class="num">${b.got} / ${b.all}</td><td class="barcell"><div class="bar" data-pct="${pct(b.got, b.all)}"><i></i></div></td></tr>`; }).join("");
    const hist = D.evidence.history || [];
    return `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-overview">Program overview</h1><p class="lead">One data set behind every view: ${D.controls.length} controls, ${D.ai.length} AI systems, ${D.risks.risks.length} risks, ${D.vendors.length} vendors, ${D.policies.length} policies, ${D.exceptions.length} exceptions, and the evidence job that keeps them honest.</p></div>
      <div class="grid g4">
        <div class="kpi"><div class="n num">${health.pct}%</div><div class="l">Control health</div><div class="s">${health.good} of ${health.total} controls have current evidence or a current attestation</div><div class="stack"><i class="ok" data-pct="${pct(health.fresh + health.current, health.total)}"></i><i class="warn" data-pct="${pct(health.stale + health.overdue + health.pending, health.total)}"></i><i class="bad" data-pct="${pct(health.failing + health.none, health.total)}"></i></div><div class="legend"><span><span class="dot ok"></span>current</span><span><span class="dot warn"></span>stale, overdue or pending</span><span><span class="dot bad"></span>failing or none</span></div></div>
        <div class="kpi"><div class="n num">${health.automated}</div><div class="l">Controls with automated evidence</div><div class="s">${EV ? `Bundle from ${esc(ago(EV.generated_at))}: ${evSummary.pass} pass, ${evSummary.warn} warn, ${evSummary.fail} fail` : "No bundle yet"}</div>${sparkline(hist)}</div>
        <div class="kpi"><div class="n num">${aboveAppetite.length}</div><div class="l">Risks above appetite</div><div class="s">${aboveAppetite.map(r => esc(r.id)).join(", ") || "none"}; ${D.risks.risks.filter(r => r.decision_required).length} awaiting a board decision</div></div>
        <div class="kpi"><div class="n num">${openExceptions.length}</div><div class="l">Open exceptions</div><div class="s">Nearest expiry ${openExceptions.length ? esc(openExceptions.slice().sort((a, b) => a.expires.localeCompare(b.expires))[0].expires) : "n/a"}</div></div>
      </div>
      <div class="section two">
        <div class="card"><h3>Coverage by framework <span class="tech muted small">(distinct reference IDs touched by the crosswalk)</span></h3>
          ${["csf", "cis", "soc2", "airmf"].map(k => `<div class="mt"><div class="linkrow"><strong>${esc(FW[k].short)}</strong><span class="muted small">${COV[k].referenced} of ${COV[k].total} in the reference list${k === "cis" ? `, ${COV.cis.ig1} at IG1` : ""}</span></div><div class="bar" data-pct="${COV[k].pct}"><i></i></div><div class="small muted plain-only">${esc(FW[k].plain)}</div></div>`).join("")}
        </div>
        <div class="card"><h3>NIST CSF 2.0 functions</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>Function</th><th>Controls</th><th>Subcategories</th><th></th></tr></thead><tbody>${fnRows}</tbody></table></div></div>
      </div>
      <div class="section two">
        <div class="card"><h3>Company <span class="pill sim">Simulated</span></h3><dl class="kv"><dt>Name</dt><dd>${esc(D.company.legal_name)}</dd><dt>What it does</dt><dd>${esc(D.company.product)}</dd><dt>Size</dt><dd>${D.company.employees} employees, founded ${D.company.founded}</dd><dt>Headquarters</dt><dd>${esc(D.company.hq_state)}</dd><dt>Framework</dt><dd>${esc(D.company.adopted_framework)} <span class="muted small">(${esc(D.company.size_tier)})</span></dd><dt>Customers</dt><dd>${esc(D.company.customers)}</dd></dl></div>
        <div class="card"><h3>Real versus simulated</h3><table class="tbl"><tbody>
          <tr><td>${pill("real", "Real")}</td><td class="small">The AI assistants and their safeguards, the vendors with trust centers, the evidence job and its bundles, the build gates, the crosswalk logic, this site's own mapper and its limits.</td></tr>
          <tr><td>${pill("sim", "Simulated")}</td><td class="small">Company size and org, control owners, policies, most risk ratings, SOC 2 status, contract clauses, attestation records for manual controls.</td></tr></tbody></table>
          <p class="small muted mt">Every card carries its label. When in doubt, the label says simulated.</p></div>
      </div>`;
  };

  function sparkline(hist) {
    if (!hist || hist.length < 2) return `<div class="small muted mt">History starts with the first scheduled run.</div>`;
    const w = 220, hgt = 44, n = hist.length;
    const vals = hist.map(x => x.total ? x.pass / x.total : 0);
    const pts = vals.map((v, i) => [(i / (n - 1)) * (w - 4) + 2, hgt - 4 - v * (hgt - 8)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return `<svg class="chart" viewBox="0 0 ${w} ${hgt}" aria-label="Share of passing checks over the last ${n} runs"><path class="sparkfill" d="${d} L${(w - 2).toFixed(1)} ${hgt} L2 ${hgt} Z"></path><path class="spark" d="${d}"></path></svg><div class="small muted">Passing checks, last ${n} runs</div>`;
  }

  // Controls view with filters, crosswalk mode, and the mapper
  const CF = { fw: "all", fn: "all", driver: "all", ai: false, real: false, status: "all", q: "", mode: "controls" };
  views.controls = () => `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-controls">Controls and crosswalk</h1><p class="lead">One canonical control library, mapped to four frameworks and eight legal or contractual drivers. Answer a control once, and the crosswalk shows everywhere it counts.</p></div>
      ${mapperCard()}
      <div class="section"><div class="section-h"><h2>Library</h2><p>${D.controls.length} controls. Click a row for statement, evidence, and mappings.</p></div>
      <div class="filters">
        <div class="seg" role="group" aria-label="View mode"><button type="button" data-cmode="controls" aria-pressed="true">By control</button><button type="button" data-cmode="framework" aria-pressed="false">By framework</button></div>
        <select id="f-fw" aria-label="Framework"><option value="all">All frameworks</option><option value="csf">NIST CSF 2.0</option><option value="cis">CIS v8.1</option><option value="soc2">SOC 2</option><option value="airmf">NIST AI RMF</option></select>
        <select id="f-driver" aria-label="Driver"><option value="all">All drivers</option>${Object.keys(DRV).map(k => `<option value="${esc(k)}">${esc(DRV[k].short || DRV[k].name)}</option>`).join("")}</select>
        <select id="f-status" aria-label="Status"><option value="all">Any status</option><option value="operating">Operating</option><option value="partial">Partial</option><option value="planned">Planned</option></select>
        <label class="toggle"><input type="checkbox" id="f-ai"> AI controls</label>
        <label class="toggle"><input type="checkbox" id="f-real"> Real only</label>
        <input type="search" id="f-q" placeholder="Search controls" aria-label="Search controls">
      </div>
      <div class="fchips" id="f-fn"><button type="button" data-fn="all" aria-pressed="true">All functions</button>${Object.keys(FW.csf.functions).map(fn => `<button type="button" data-fn="${fn}" aria-pressed="false">${fn} ${esc(FW.csf.functions[fn])}</button>`).join("")}</div>
      <div id="controls-list" class="mt"></div></div>`;

  function filteredControls() {
    return D.controls.filter(c => {
      if (CF.fn !== "all" && c.function !== CF.fn) return false;
      if (CF.fw !== "all" && !(c.mappings[CF.fw] || []).length) return false;
      if (CF.driver !== "all" && !(c.drivers || []).includes(CF.driver)) return false;
      if (CF.status !== "all" && c.status !== CF.status) return false;
      if (CF.ai && !c.ai) return false;
      if (CF.real && c.reality !== "real") return false;
      if (CF.q) { const q = CF.q.toLowerCase(); if (!(c.id + " " + c.title + " " + c.statement + " " + c.plain).toLowerCase().includes(q)) return false; }
      return true;
    });
  }
  function renderControlsList() {
    const root = $("#controls-list"); if (!root) return;
    const list = filteredControls();
    if (CF.mode === "framework") {
      const key = CF.fw === "all" ? "csf" : CF.fw;
      const rows = Object.keys(FW[key].ids).map(id => {
        const cs = list.filter(c => (c.mappings[key] || []).some(m => (key === "cis" ? m.id : m) === id));
        if (!cs.length && (CF.q || CF.fn !== "all" || CF.driver !== "all" || CF.ai || CF.real)) return "";
        return `<tr><td class="mono small">${esc(id)}</td><td class="small">${esc(FW[key].ids[id])}</td><td>${cs.length ? cs.map(c => `<a href="#controls/${esc(c.id)}" class="chip">${esc(c.id)}</a>`).join("") : `<span class="muted small">no control yet</span>`}</td></tr>`;
      }).join("");
      root.innerHTML = `<p class="small muted">${esc(FW[key].name)}: ${COV[key].referenced} of ${COV[key].total} reference IDs are satisfied by at least one control. ${CF.fw === "all" ? "Choose a framework above to change the lens." : ""}</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Reference</th><th>Requirement</th><th>Controls</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      return;
    }
    root.innerHTML = `<p class="small muted">${list.length} of ${D.controls.length} controls shown.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>ID</th><th>Control</th><th>Evidence</th><th class="tech">Crosswalk</th></tr></thead><tbody>${list.map(c => { const s = ES.get(c.id); return `<tr class="row" data-open="controls/${esc(c.id)}" tabindex="0"><td class="mono small nowrap">${esc(c.id)}</td><td><div class="title">${esc(c.title)} ${c.ai ? pill("ai", "AI") : ""} ${reality(c.reality)}</div><div class="sub plain-only">${esc(c.plain)}</div><div class="sub tech">${esc(c.owner_role)} &middot; ${esc(c.frequency)} &middot; ${esc(c.status)}</div></td><td class="small"><span class="dot ${s.cls}"></span>${esc(s.label)}</td><td class="tech">${chips(c)}</td></tr>`; }).join("")}</tbody></table></div>`;
  }
  function bindControls(root) {
    $$("[data-cmode]", root).forEach(b => b.addEventListener("click", () => { CF.mode = b.getAttribute("data-cmode"); $$("[data-cmode]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderControlsList(); }));
    $("#f-fw", root).addEventListener("change", e => { CF.fw = e.target.value; renderControlsList(); });
    $("#f-driver", root).addEventListener("change", e => { CF.driver = e.target.value; renderControlsList(); });
    $("#f-status", root).addEventListener("change", e => { CF.status = e.target.value; renderControlsList(); });
    $("#f-ai", root).addEventListener("change", e => { CF.ai = e.target.checked; renderControlsList(); });
    $("#f-real", root).addEventListener("change", e => { CF.real = e.target.checked; renderControlsList(); });
    $("#f-q", root).addEventListener("input", e => { CF.q = e.target.value.trim(); renderControlsList(); });
    $$("#f-fn button", root).forEach(b => b.addEventListener("click", () => { CF.fn = b.getAttribute("data-fn"); $$("#f-fn button", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderControlsList(); }));
    renderControlsList();
    bindMapper(root);
  }

  // ---------- mapper ----------
  const EXAMPLES = ["Do you encrypt data in transit and at rest?", "How do you manage third-party and subprocessor risk?", "Is multi-factor authentication enforced for all staff?", "Describe your incident response and breach notification process.", "How do you govern the use of AI and prevent prompt injection?", "Do you test backups and how often?"];
  function mapperCard() {
    return `<div class="card mapper" id="mapper"><h3>Answer once: map a questionnaire question to controls <span class="pill ai">AI-assisted</span></h3>
      <p class="small">Paste one question from a customer security questionnaire, or one policy sentence. The site shortlists controls by keyword, then the model picks up to three from that shortlist and explains why. The model can only choose controls that exist; the server checks every answer. Nothing you type is stored.</p>
      <div class="examples">${EXAMPLES.map(e => `<button type="button" data-ex="${esc(e)}">${esc(e)}</button>`).join("")}</div>
      <textarea class="q" id="map-q" maxlength="600" placeholder="For example: Do you rotate API keys and service account credentials?" aria-label="Question"></textarea>
      <div class="row"><button type="button" class="btn primary small" id="map-go">Map to controls</button><span class="small muted" id="map-status">Up to 600 characters. 20 requests per 5 minutes.</span></div>
      <div id="map-out" aria-live="polite"></div></div>`;
  }
  const INDEX = buildIndex(D.controls, D.frameworks);
  function bindMapper(root) {
    const q = $("#map-q", root), out = $("#map-out", root), st = $("#map-status", root), go = $("#map-go", root);
    $$("[data-ex]", root).forEach(b => b.addEventListener("click", () => { q.value = b.getAttribute("data-ex"); q.focus(); }));
    async function run() {
      const text = q.value.trim(); if (!text) { st.textContent = "Type a question first."; q.focus(); return; }
      go.disabled = true; st.textContent = "Mapping";
      let res = null;
      if (HEALTH && !HEALTH.offline && /^https?:/.test(location.protocol)) {
        try {
          const r = await fetch("/api/map", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: text }) });
          if (r.status === 429) { st.textContent = "Fair-use limit reached; please try again in a few minutes."; go.disabled = false; return; }
          if (r.ok) res = await r.json(); else if (r.status === 503) { const j = await r.json().catch(() => ({})); st.textContent = j.message || "The model provider is busy; try again shortly."; }
        } catch (e) { res = null; }
      }
      if (!res) { const short = rank(INDEX, text, 8); res = { method: "keyword (in-page)", model: null, proposals: short.slice(0, 3).map(s => ({ id: s.id, title: s.title, confidence: s.score > 6 ? "medium" : "low", rationale: "Keyword match on: " + s.matched.slice(0, 6).join(", ") + "." })), shortlist: short.map(s => s.id), note: "No backend reached, so these are keyword matches computed in your browser." }; }
      go.disabled = false; st.textContent = "";
      const label = res.method === "ai" ? `AI-proposed by ${esc(res.model || "the model")}, analyst confirms` : `Keyword-proposed (${esc(res.method)}), analyst confirms`;
      out.innerHTML = `<div class="mt"><div class="linkrow">${pill(res.method === "ai" ? "ai" : "", label)} ${res.truncated ? pill("warn", "Question truncated to 600 characters") : ""}</div>${res.note && res.method !== "ai" ? `<p class="small muted">${esc(res.note)}</p>` : ""}
        ${res.proposals.length ? res.proposals.map(p => { const c = C.get(p.id); return `<label class="prop"><input type="checkbox" aria-label="Confirm ${esc(p.id)}"><div><div><strong>${esc(p.id)}</strong> ${esc(c ? c.title : p.title)} ${pill(p.confidence === "high" ? "ok" : p.confidence === "medium" ? "info" : "", p.confidence + " confidence")} ${c ? reality(c.reality) : ""}</div><div class="small muted">${esc(p.rationale)}</div><div class="small">${c ? link("controls/" + c.id, "Open control") : ""}${c && ES.get(c.id) ? ` &middot; <span class="dot ${ES.get(c.id).cls}"></span>${esc(ES.get(c.id).label)}` : ""}</div></div></label>`; }).join("") : `<p class="small">No proposal. Try naming the safeguard directly.</p>`}
        <p class="small muted tech">Shortlist considered: ${(res.shortlist || []).map(esc).join(", ") || "none"}. Confirmations are kept only in this page; a real program would write them to the evidence record with the analyst's name.</p></div>`;
    }
    go.addEventListener("click", run);
    q.addEventListener("keydown", e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); });
  }

  views.ai = () => `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-ai">AI systems and agents</h1><p class="lead">Every AI system Nimbus runs, what it may do at runtime, who watches it, and how it is switched off. This inventory is the NIST AI RMF record that Texas HB 149 treats as an affirmative defense; the EU AI Act column uses the dates as amended in 2026.</p></div>
      <div class="notice"><strong>Why runtime permissions, not just policies.</strong> A policy says what an AI system should do. The runtime table says what it can do: each action has a code guard or a human approver, and the model never sets a security-relevant state on its own (${ctrlLink("NC-PR-18")}).</div>
      <div class="grid mt">${D.ai.map(a => `<div class="card" id="ai-${esc(a.id)}"><h3>${esc(a.id)} ${esc(a.name)}</h3>${aiCard(a, false)}</div>`).join("")}</div>
      <div class="section two">
        <div class="card"><h3>Model vendor due diligence</h3>${(() => { const g = D.vendors.find(v => v.id === "V-01"); return g ? `<div class="linkrow">${reality(g.reality)} ${pill("ok", g.soc2_report)} ${g.iso27001 ? pill("ok", "ISO 27001") : ""}</div><p class="small">${esc(g.plain)}</p><dl class="kv"><dt>Data sent</dt><dd>${(g.data_access || []).map(esc).join("; ")}</dd><dt>Breach notice</dt><dd>${g.contract && g.contract.breach_notice_hours ? g.contract.breach_notice_hours + " hours" : esc((g.contract && g.contract.note) || "not stated")}</dd><dt>Trust center</dt><dd><a href="${esc(g.trust_center_url)}" target="_blank" rel="noopener">${esc(g.trust_center_url)}</a></dd><dt>Concentration</dt><dd>${esc(g.concentration || "")}</dd></dl><p class="small">${link("vendors/" + g.id, "Full vendor record")}</p>` : ""; })()}</div>
        <div class="card"><h3>AI incident escalation path</h3><p class="small">${esc(C.get("NC-RS-04").plain)}</p><ol class="list small walk"><li>Disable the system (kill switch, under 15 minutes).</li><li>Notify the AI owner and the accountable executive within one hour.</li><li>Assess legal duties: Texas breach notice windows, GDPR 72 hours, customer contracts; HB 149 allows a 60-day cure after Attorney General notice.</li><li>Communicate to affected customers through approved channels.</li><li>Post-incident review within two weeks; add a gate for the failure.</li></ol><p class="small">${ctrlLink("NC-RS-04")} &middot; ${ctrlLink("NC-PR-19")}</p></div>
      </div>`;

  views.evidence = () => {
    if (!EV) return `<div class="hero"><h1 id="h-evidence">Evidence</h1></div><div class="notice">No evidence bundle has been generated yet. Run <code>npm run evidence</code>.</div>`;
    const rows = EV.checks.map(k => `<tr><td><span class="dot ${k.result === "pass" ? "ok" : k.result === "warn" ? "warn" : "bad"}"></span>${esc(k.result)}</td><td class="mono small">${esc(k.id)}</td><td class="small">${esc(k.observed)}<div class="tech muted">expected: ${esc(k.expected)}</div></td><td>${(k.control_ids || []).map(c => `<a class="chip" href="#controls/${esc(c)}">${esc(c)}</a>`).join("")}</td><td class="small">${k.source_url ? `<a href="${esc(k.source_url)}" target="_blank" rel="noopener">${esc(k.source_url.replace(/^https?:\/\//, "").slice(0, 40))}</a>` : ""}</td></tr>`).join("");
    const auto = D.controls.filter(c => c.automation);
    const manual = D.controls.filter(c => !c.automation).sort((a, b) => (ES.get(b.id).ageDays || 0) - (ES.get(a.id).ageDays || 0));
    return `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-evidence">Evidence</h1><p class="lead">A scheduled job checks the live sites and the repository every day and writes a bundle keyed by control. Freshness is a property of each control, not of an audit date.</p></div>
      <div class="grid g4">
        <div class="kpi"><div class="n num">${evSummary.pass}<span class="muted">/${evSummary.total}</span></div><div class="l">Checks passing</div><div class="s">${evSummary.warn} warning${evSummary.warn === 1 ? "" : "s"}, ${evSummary.fail} failing</div></div>
        <div class="kpi"><div class="n">${esc(ago(EV.generated_at))}</div><div class="l">Last run</div><div class="s">${esc(fmtDate(EV.generated_at))} ${esc(EV.generated_at.slice(11, 16))} UTC<span class="tech"> &middot; run ${esc(EV.run_id)}</span></div></div>
        <div class="kpi"><div class="n num">${auto.filter(c => ES.get(c.id).state === "fresh").length}<span class="muted">/${auto.length}</span></div><div class="l">Automated controls fresh</div><div class="s">${auto.filter(c => ES.get(c.id).state === "failing").length} failing, ${auto.filter(c => ES.get(c.id).state === "stale").length} stale</div></div>
        <div class="kpi"><div class="n num">${drift ? drift.changed.length : 0}</div><div class="l">Drift since previous run</div><div class="s">${drift ? (drift.changed.length ? drift.changed.map(x => esc(x.id + ": " + x.from + " to " + x.to)).join("; ") : "no result changed since " + esc(fmtDate(drift.since))) : "first run"}</div></div>
      </div>
      ${EV.scope === "local-only" ? `<div class="notice warn mt"><strong>Local-only run.</strong> This bundle was generated without network access, so the live-site checks (transport, headers, disclosure file on the sister site) are not in it yet. They appear after the first run of <code>npm run evidence</code> from a machine with internet, and daily after that.</div>` : ""}
      <div class="section"><div class="section-h"><h2>Latest bundle</h2><p>Targets: ${(EV.targets || []).map(t => `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.label)}</a>`).join(", ")}.<span class="tech"> Source commit ${esc((EV.source_commit || "n/a").slice(0, 10))}.</span></p></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Result</th><th>Check</th><th>Observed</th><th>Controls</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="section two">
        <div class="card"><h3>Manual controls by age</h3><p class="small muted">Attestations for a simulated company. Overdue items surface in the board brief.</p><div class="tblwrap"><table class="tbl"><thead><tr><th>Control</th><th>Last evidence</th><th>Limit</th></tr></thead><tbody>${manual.map(c => { const s = ES.get(c.id); return `<tr class="row" data-open="controls/${esc(c.id)}"><td class="small"><span class="dot ${s.cls}"></span>${esc(c.id)} ${esc(c.title)}</td><td class="small num">${esc(fmtDate(c.last_evidence))} (${s.ageDays == null ? "n/a" : s.ageDays + "d"})</td><td class="small num">${c.freshness_days}d</td></tr>`; }).join("")}</tbody></table></div></div>
        <div class="card"><h3>Before and after: the same control, two ways</h3>
          <table class="tbl"><thead><tr><th>Annual audit style</th><th>Continuous style (this site)</th></tr></thead><tbody>
          <tr><td class="small">A screenshot of the TLS settings pasted into a spreadsheet in March.</td><td class="small">The job fetches the live site every morning and records the HSTS and CSP headers it saw (${ctrlLink("NC-PR-06")}).</td></tr>
          <tr><td class="small">Evidence is as old as the last audit; nobody knows if it drifted.</td><td class="small">Each control has a freshness limit; stale evidence shows as stale, and drift lists what changed since yesterday.</td></tr>
          <tr><td class="small">The auditor asks; someone scrambles.</td><td class="small">The auditor opens the control; the evidence and its source URL are already there.</td></tr>
          </tbody></table>
          <div class="notice mt small"><strong>Honest limits.</strong> This job reads public surfaces and the repository. A real program would add cloud configuration, the identity provider, device management, and ticketing data. Those integrations are named on the Tested page, not faked.</div></div>
      </div>
      ${D.evidence.history && D.evidence.history.length ? `<div class="section"><div class="section-h"><h2>History</h2><p>${D.evidence.history.length} run${D.evidence.history.length > 1 ? "s" : ""} kept in the repository.</p></div><div class="tblwrap"><table class="tbl"><thead><tr><th>Date</th><th>Pass</th><th>Warn</th><th>Fail</th></tr></thead><tbody>${D.evidence.history.slice().reverse().map(h => `<tr><td class="mono small">${esc(h.date)}</td><td class="num">${h.pass}</td><td class="num">${h.warn}</td><td class="num">${h.fail}</td></tr>`).join("")}</tbody></table></div></div>` : ""}`;
  };

  // ---------- risks and the quantified scenario ----------
  views.risks = () => {
    const rows = risksSorted.map(r => { const res = score(r.residual), inh = score(r.inherent); return `<tr class="row" data-open="risks/${esc(r.id)}" tabindex="0"><td class="mono small nowrap">${esc(r.id)}</td><td><div class="title">${esc(r.title)} ${reality(r.reality)}${r.decision_required ? " " + pill("warn", "Decision") : ""}</div><div class="sub plain-only">${esc(r.plain)}</div><div class="sub tech">${esc(r.category)} &middot; ${esc(r.owner_role)} &middot; KRI: ${esc(r.kri)}</div></td><td class="num">${inh}</td><td class="num"><strong>${res}</strong> ${res > APP ? pill("bad", "above") : ""}</td><td class="small">${esc(r.treatment)}</td><td class="small">${esc(r.trend)}</td></tr>`; }).join("");
    return `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-risks">Risk register and one quantified scenario</h1><p class="lead">${esc(D.risks.appetite.plain)}</p></div>
      <div class="two">
        <div class="card"><h3>Heat map <span class="seg" role="group" aria-label="Rating"><button type="button" data-heat="residual" aria-pressed="true">Residual</button><button type="button" data-heat="inherent" aria-pressed="false">Inherent</button></span></h3><div id="heat"></div><p class="small muted mt">Likelihood across, impact down, both 1 to 5. Anything scoring above ${APP} is outside appetite.</p></div>
        <div class="card"><h3>Risk appetite statement</h3><p class="small">${esc(D.risks.appetite.statement)}</p><p class="small muted tech">Scale: ${esc(D.risks.appetite.scale)}.</p><p class="small"><strong>${aboveAppetite.length} risk${aboveAppetite.length === 1 ? "" : "s"} above appetite:</strong> ${aboveAppetite.map(r => riskLink(r.id)).join("; ") || "none"}.</p></div>
      </div>
      <div class="section"><div class="tblwrap"><table class="tbl"><thead><tr><th>ID</th><th>Risk</th><th>Inherent</th><th>Residual</th><th>Treatment</th><th>Trend</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="section" id="scenario"><div class="section-h"><h2>Loss scenario: ${esc(D.scenario.title)}</h2><p>FAIR-informed, not FAIR certified. Every number is an assumption for a simulated company; the method and the control levers are the point.</p></div>
        <div class="explain plain-only">${esc(D.scenario.plain)}</div>
        <p class="small muted tech">${esc(D.scenario.assumptions_note)}</p>
        <div class="two">
          <div class="card"><h3>Inputs</h3><p class="small muted">How often it happens (events per year) and what one event costs (US dollars). Minimum, most likely, maximum.</p>
            <div class="tag">Frequency</div><div class="inputs mt"><label>min<input type="number" step="0.01" id="f-min" value="${D.scenario.frequency.min}"></label><label>most likely<input type="number" step="0.01" id="f-mode" value="${D.scenario.frequency.mode}"></label><label>max<input type="number" step="0.01" id="f-max" value="${D.scenario.frequency.max}"></label></div>
            <div class="tag mt">Loss per event</div><div class="inputs mt"><label>min<input type="number" step="1000" id="m-min" value="${D.scenario.magnitude.min}"></label><label>most likely<input type="number" step="1000" id="m-mode" value="${D.scenario.magnitude.mode}"></label><label>max<input type="number" step="1000" id="m-max" value="${D.scenario.magnitude.max}"></label></div>
            <div class="tag mt">Controls (toggle to see what moves the number)</div>
            <div class="mt">${D.scenario.controls.map(k => `<label class="toggle mt"><input type="checkbox" data-ctl="${esc(k.id)}" ${k.default_on ? "checked" : ""}> ${esc(k.label)} <span class="muted tech">x${k.factor} on ${esc(k.effect)}</span></label>`).join(" ")}
            <label class="toggle mt"><input type="checkbox" id="legal" ${D.scenario.legal.default_on ? "checked" : ""}> ${esc(D.scenario.legal.label)} <span class="muted tech">x${D.scenario.legal.factor} on the tail</span></label></div>
            <p class="small muted mt">${esc(D.scenario.legal.note)}</p>
          </div>
          <div class="card"><h3>Results <span class="small muted">10,000 simulated years</span></h3><div id="sim-out"></div></div>
        </div></div>`;
  };
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function tri(u, a, m, b) { if (b <= a) return a; const f = (m - a) / (b - a); return u < f ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); }
  function poisson(rnd, lam) { if (lam <= 0) return 0; if (lam > 30) { return Math.max(0, Math.round(lam + Math.sqrt(lam) * (rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() + rnd() - 6))); } const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
  function simulate(cfg, trials = 10000, seed = 42) {
    const rnd = mulberry32(seed); const losses = new Array(trials);
    for (let i = 0; i < trials; i++) {
      const lam = tri(rnd(), cfg.f.min, cfg.f.mode, cfg.f.max) * cfg.fFactor;
      const n = poisson(rnd, lam); let total = 0;
      for (let j = 0; j < n; j++) {
        let loss = tri(rnd(), cfg.m.min, cfg.m.mode, cfg.m.max) * cfg.mFactor;
        if (cfg.tailFactor < 1 && loss > cfg.m.mode * cfg.mFactor) loss = cfg.m.mode * cfg.mFactor + (loss - cfg.m.mode * cfg.mFactor) * cfg.tailFactor;
        total += loss;
      }
      losses[i] = total;
    }
    losses.sort((a, b) => a - b);
    const q = p => losses[Math.min(trials - 1, Math.floor(p * trials))];
    const mean = losses.reduce((a, b) => a + b, 0) / trials;
    const nonzero = losses.filter(l => l > 0);
    const medianGivenLoss = nonzero.length ? nonzero[Math.floor(nonzero.length / 2)] : 0;
    return { losses, mean, median: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: losses[trials - 1], pAny: nonzero.length / trials, medianGivenLoss, pAbove: t => losses.filter(l => l > t).length / trials };
  }
  function readScenario(root) {
    const num = id => Number($("#" + id, root).value);
    const f = { min: num("f-min"), mode: num("f-mode"), max: num("f-max") }, m = { min: num("m-min"), mode: num("m-mode"), max: num("m-max") };
    const fix = o => { const a = Math.max(0, Math.min(o.min, o.mode, o.max)), b = Math.max(o.min, o.mode, o.max); return { min: a, mode: Math.min(Math.max(o.mode, a), b), max: b }; };
    let fFactor = 1, mFactor = 1;
    for (const k of D.scenario.controls) { const on = $(`[data-ctl="${k.id}"]`, root).checked; if (on) { if (k.effect === "frequency") fFactor *= k.factor; else mFactor *= k.factor; } }
    const tailFactor = $("#legal", root).checked ? D.scenario.legal.factor : 1;
    return { f: fix(f), m: fix(m), fFactor, mFactor, tailFactor };
  }
  function lec(inh, res, appetite) {
    const w = 520, h = 240, pl = 48, pr = 12, pt = 12, pb = 34;
    const xmax = Math.max(inh.p95 * 1.05, appetite * 1.2, 1);
    const X = v => pl + (Math.min(v, xmax) / xmax) * (w - pl - pr), Y = p => pt + (1 - p) * (h - pt - pb);
    const curve = s => { const pts = []; for (let i = 0; i <= 60; i++) { const t = xmax * i / 60; pts.push([X(t), Y(s.pAbove(t))]); } return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "); };
    const ticks = [0, .25, .5, .75, 1].map(p => `<line class="grid" x1="${pl}" x2="${w - pr}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}"></line><text x="${pl - 6}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="end">${Math.round(p * 100)}%</text>`).join("");
    const xt = [0, .25, .5, .75, 1].map((f, i) => `<text x="${X(xmax * f).toFixed(1)}" y="${h - pb + 16}" text-anchor="${i === 0 ? "start" : i === 4 ? "end" : "middle"}">${money(xmax * f).replace(/,000$/, "k")}</text>`).join("");
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Loss exceedance curve"><line class="axis" x1="${pl}" x2="${pl}" y1="${pt}" y2="${h - pb}"></line><line class="axis" x1="${pl}" x2="${w - pr}" y1="${h - pb}" y2="${h - pb}"></line>${ticks}${xt}<path class="inh" d="${curve(inh)}"></path><path class="res" d="${curve(res)}"></path><line class="app" x1="${X(appetite).toFixed(1)}" x2="${X(appetite).toFixed(1)}" y1="${pt}" y2="${h - pb}"></line><text x="${(X(appetite) + 4).toFixed(1)}" y="${pt + 12}">appetite ${money(appetite)}</text><text x="${((pl + w - pr) / 2).toFixed(1)}" y="${h - 3}" text-anchor="middle">annual loss (USD)</text></svg><div class="legend"><span><span class="dot warn"></span>inherent (no safeguards)</span><span><span class="dot" data-accent></span>residual (selected safeguards)</span><span><span class="dot bad"></span>appetite line</span><span class="tech">Vertical axis: chance that a year's loss exceeds the amount on the horizontal axis.</span></div>`;
  }
  function runScenario(root) {
    const cfg = readScenario(root);
    const inh = simulate({ ...cfg, fFactor: 1, mFactor: 1, tailFactor: 1 });
    const res = simulate(cfg);
    const appetite = D.scenario.appetite_annual_loss;
    const sle = cfg.m.mode * cfg.mFactor, aro = cfg.f.mode * cfg.fFactor;
    $("#sim-out", root).innerHTML = `
      <div class="results">
        <div class="kpi tight"><div class="n num">${money(res.mean)}</div><div class="l">Expected annual loss</div><div class="s">with no safeguards: ${money(inh.mean)}</div></div>
        <div class="kpi tight"><div class="n num">${Math.round(res.pAny * 100)}%</div><div class="l">Chance of a breach this year</div><div class="s">with no safeguards: ${Math.round(inh.pAny * 100)}%</div></div>
        <div class="kpi tight"><div class="n num">${money(res.medianGivenLoss)}</div><div class="l">Typical cost when it happens</div><div class="s">with no safeguards: ${money(inh.medianGivenLoss)}</div></div>
        <div class="kpi tight"><div class="n num">${Math.round(res.pAbove(appetite) * 100)}%</div><div class="l">Chance of exceeding appetite</div><div class="s">with no safeguards: ${Math.round(inh.pAbove(appetite) * 100)}%</div></div>
      </div>
      <p class="small muted tech">Tail: 1-in-20-year loss ${money(res.p95)}, 1-in-100-year loss ${money(res.p99)}, worst simulated year ${money(res.max)} (no safeguards: ${money(inh.p95)}, ${money(inh.p99)}, ${money(inh.max)}).</p>
      ${lec(inh, res, appetite)}
      <p class="small tech mt"><strong>Security+ arithmetic.</strong> SLE (single loss expectancy) ${money(sle)} x ARO (annual rate of occurrence) ${aro.toFixed(2)} = ALE ${money(sle * aro)}. The simulation gives ${money(res.mean)} because it samples ranges instead of point estimates.</p>
      <p class="small plain-only mt">Read it like this: with the selected safeguards on, there is about a ${Math.round(res.pAny * 100)}% chance of a breach in a given year, the expected cost averaged over many years is ${money(res.mean)}, and there is a ${Math.round(res.pAbove(appetite) * 100)}% chance of blowing past the ${money(appetite)} the board said it can live with. Switch a safeguard off to see how much it was worth.</p>`;
    applyBars(root);
  }
  function bindRisks(root) {
    let heat = "residual";
    const drawHeat = () => {
      const cells = [];
      cells.push(`<div class="lab"></div>`); for (let l = 1; l <= 5; l++) cells.push(`<div class="lab">L${l}</div>`);
      for (let i = 5; i >= 1; i--) { cells.push(`<div class="lab">I${i}</div>`); for (let l = 1; l <= 5; l++) { const rs = D.risks.risks.filter(r => r[heat].likelihood === l && r[heat].impact === i); const s = l * i; const cls = s >= 20 ? "h5" : s >= 12 ? "h4" : s >= 8 ? "h3" : s >= 4 ? "h2" : "h1"; cells.push(`<div class="cell ${cls} ${rs.length ? "" : "empty"}" title="score ${s}">${rs.map(r => `<a href="#risks/${esc(r.id)}">${esc(r.id.replace("R-", ""))}</a>`).join(" ") || s}</div>`); } }
      $("#heat", root).innerHTML = `<div class="heat">${cells.join("")}</div>`;
    };
    $$("[data-heat]", root).forEach(b => b.addEventListener("click", () => { heat = b.getAttribute("data-heat"); $$("[data-heat]", root).forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawHeat(); }));
    drawHeat();
    $$("#scenario input", root).forEach(i => i.addEventListener("change", () => runScenario(root)));
    runScenario(root);
  }

  views.vendors = () => {
    const rows = D.vendors.slice().sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name)).map(v => { const a = days(v.last_reviewed); const k = v.contract || {}; return `<tr class="row" data-open="vendors/${esc(v.id)}" tabindex="0"><td><div class="title">${esc(v.name)} ${reality(v.reality)}</div><div class="sub">${esc(v.service)}</div></td><td class="num">${v.tier}${v.critical ? " <span class='pill bad'>critical</span>" : ""}</td><td class="small">${(v.data_access || []).slice(0, 2).map(esc).join("; ")}</td><td class="small">${esc(v.soc2_report)}${v.iso27001 ? "; ISO 27001" : ""}</td><td class="small">${k.breach_notice_hours ? k.breach_notice_hours + "h" : `<span class="pill warn">not stated</span>`}</td><td class="small num"><span class="dot ${a <= v.review_cadence_days ? "ok" : "warn"}"></span>${a}d</td></tr>`; }).join("");
    const conc = D.vendors.filter(v => v.concentration);
    return `
      <div class="hero"><div class="tag">Control Room</div><h1 id="h-vendors">Third-party risk</h1><p class="lead">Every service provider with tier, data access, assurance report, contract terms, and review age. Three are real companies with public trust centers; the rest are simulated.</p></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>Vendor</th><th>Tier</th><th>Data access</th><th>Assurance</th><th>Breach notice</th><th>Reviewed</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="section two">
        <div class="card"><h3>Concentration risk</h3><p class="small muted">Where one vendor's failure takes down more than one thing.</p><ul class="list small">${conc.map(v => `<li><strong>${esc(v.name)}</strong>: ${esc(v.concentration)}</li>`).join("")}</ul><p class="small">${riskLink("R-06")}</p></div>
        <div class="card"><h3>How vendors are managed</h3><ul class="list small"><li>${ctrlLink("NC-GV-09")}</li><li>${ctrlLink("NC-GV-10")}</li><li>${ctrlLink("NC-DE-03")}</li><li>${ctrlLink("NC-PR-20")}</li></ul><p class="small muted">Contract gaps become exceptions with an expiry: ${D.exceptions.filter(e => e.control_id === "NC-GV-10").map(e => esc(e.id)).join(", ") || "none"}.</p></div>
      </div>`;
  };

  views.board = () => {
    const top = risksSorted.slice(0, 5);
    const dec = D.risks.risks.filter(r => r.decision_required);
    const overdue = D.controls.filter(c => ["overdue", "stale", "failing"].includes(ES.get(c.id).state));
    const reg = [
      { t: "SOC 2 Type II", v: "Report held for the current period (simulated)", s: driverStatus("soc2_report") },
      { t: "Texas SB 2610 safe harbor", v: `${esc(D.company.size_tier)}. Evidence current: ${driverStatus("sb2610").current ? "yes" : "no, " + (driverStatus("sb2610").controls - driverStatus("sb2610").good) + " control(s) to refresh"}`, s: driverStatus("sb2610") },
      { t: "Texas HB 149 (AI)", v: `${D.ai.filter(a => a.traiga && a.traiga.status === "aligned").length} of ${D.ai.length} AI systems aligned to NIST AI RMF; ${D.ai.filter(a => a.traiga && a.traiga.status !== "aligned").map(a => esc(a.id)).join(", ") || "no"} gap`, s: driverStatus("traiga") },
      { t: "PCI DSS SAQ A", v: "Processor holds card data; self-assessment on file (simulated)", s: driverStatus("pci_saq_a") },
      { t: "GDPR", v: "Processor terms and 72-hour notice path in place (simulated)", s: driverStatus("gdpr") },
      { t: "HIPAA BAA (Enterprise)", v: "BAA overlay available; controls mapped (simulated)", s: driverStatus("hipaa_baa") }
    ];
    return `
      <div class="hero noprint"><div class="tag">Control Room</div><h1 id="h-board">Board brief</h1><p class="lead">Two pages generated from the same data as every other view, written in board language. <button type="button" class="btn small" id="print">Print or save as PDF</button></p></div>
      <div class="paper">
        <div class="tag">Page 1 of 2 &middot; Cybersecurity and AI risk brief &middot; prepared for the board of ${esc(D.company.legal_name)} (simulated)</div>
        <h2>Where we stand</h2>
        <p>${esc(D.risks.appetite.statement)}</p>
        <div class="cards-mini">
          <div class="mini"><div class="t">Control health</div><div class="v">${health.pct}% of ${health.total} controls have current evidence; ${health.automated} are checked automatically every day.</div></div>
          <div class="mini"><div class="t">Risks outside appetite</div><div class="v">${aboveAppetite.length}: ${aboveAppetite.map(r => esc(r.title)).join("; ") || "none"}.</div></div>
          <div class="mini"><div class="t">Evidence</div><div class="v">${EV ? `Last run ${esc(fmtDate(EV.generated_at))}: ${evSummary.pass} of ${evSummary.total} checks passing.` : "No run yet."}</div></div>
        </div>
        <h2 class="mt">Top residual risks</h2>
        <div class="tblwrap"><table class="tbl"><thead><tr><th>#</th><th>Risk</th><th>Owner</th><th>Residual</th><th>Trend</th></tr></thead><tbody>${top.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.title)}<div class="small muted">${esc(r.treatment_note)}</div></td><td class="small">${esc(r.owner_role)}</td><td class="num">${score(r.residual)}${score(r.residual) > APP ? " (above appetite)" : ""}</td><td class="small">${esc(r.trend)}</td></tr>`).join("")}</tbody></table></div>
        <h2 class="mt">Regulatory and contractual status</h2>
        <div class="cards-mini">${reg.map(x => `<div class="mini"><div class="t">${x.t}</div><div class="v">${x.v}</div><div class="bar ${x.s.pct === 100 ? "ok" : x.s.pct >= 70 ? "warn" : "bad"}" data-pct="${x.s.pct}"><i></i></div></div>`).join("")}</div>
        <div class="foot">Simulated company. Real controls and evidence where marked on the site. Prepared from the Trust Center data set, version ${esc(D.site.version)}.</div>
      </div>
      <div class="paper">
        <div class="tag">Page 2 of 2 &middot; Decisions and exceptions</div>
        <h2>Decisions we need from the board</h2>
        ${dec.length ? `<ol class="list">${dec.map(r => `<li><strong>${esc(r.title)}.</strong> ${esc(r.treatment_note)} <span class="muted small">(${esc(r.id)}, owner ${esc(r.owner_role)})</span></li>`).join("")}</ol>` : "<p>None this period.</p>"}
        <h2 class="mt">Open exceptions</h2>
        <div class="tblwrap"><table class="tbl"><thead><tr><th>Exception</th><th>Control</th><th>Accepted by</th><th>Expires</th></tr></thead><tbody>${openExceptions.map(e => `<tr><td>${esc(e.title)}<div class="small muted">${esc(e.compensating)}</div></td><td class="small">${esc(e.control_id)}</td><td class="small">${esc(e.risk_accepted_by_role)}</td><td class="small num">${esc(e.expires)}</td></tr>`).join("")}</tbody></table></div>
        <h2 class="mt">Evidence that needs attention</h2>
        ${overdue.length ? `<ul class="list">${overdue.map(c => `<li><strong>${esc(c.id)} ${esc(c.title)}</strong>: ${esc(ES.get(c.id).label)} (owner ${esc(c.owner_role)})</li>`).join("")}</ul>` : "<p>All controls have current evidence.</p>"}
        <h2 class="mt">What changed since the last run</h2>
        <p>${drift ? (drift.changed.length ? drift.changed.map(x => esc(x.id + " moved from " + x.from + " to " + x.to)).join("; ") + "." : "No check changed result since " + esc(fmtDate(drift.since)) + ".") : "This is the first evidence run."}</p>
        <h2 class="mt">What would make this program real</h2>
        <p>Connect the evidence job to the cloud provider's configuration API, the identity provider (MFA and access reviews), device management, and the ticketing system, and record analyst confirmations from the control mapper. Each integration turns a simulated attestation above into a measured check.</p>
        <div class="foot">Simulated company. Prepared from the Trust Center data set, version ${esc(D.site.version)}.</div>
      </div>`;
  };

  views.tested = () => {
    const F = D.findings || [];
    const RES = D.results || {};
    const sev = s => ({ critical: "bad", high: "bad", medium: "warn", low: "info" }[s] || "");
    return `
      <div class="hero"><div class="tag">Tested</div><h1 id="h-tested">How this site was tested, and what is real</h1><p class="lead">Built AI-assisted; every behavior specified, tested, and explainable. The same discipline as the sister demos: a findings register with a gate per finding, published evaluation numbers, and a plain statement of limits.</p></div>
      <div class="grid g4">
        <div class="kpi"><div class="n num">${F.length}</div><div class="l">Findings recorded</div><div class="s">${F.filter(f => f.status === "fixed").length} fixed, ${F.filter(f => f.status !== "fixed").length} open or accepted</div></div>
        <div class="kpi"><div class="n num">${RES.gates ? RES.gates.total : "n/a"}</div><div class="l">Gate checks in npm test</div><div class="s">${RES.gates ? esc(RES.gates.summary) : "run npm test"}</div></div>
        <div class="kpi"><div class="n num">${RES.mapper && RES.mapper.keyword ? Math.round(RES.mapper.keyword.top3 * 100) + "%" : "n/a"}</div><div class="l">Mapper top-3 accuracy (keyword path)</div><div class="s">${RES.mapper && RES.mapper.keyword ? `${RES.mapper.keyword.n} gold questions, top-1 ${Math.round(RES.mapper.keyword.top1 * 100)}%, in-sample` : ""}</div></div>
        <div class="kpi"><div class="n num">${RES.mapper && RES.mapper.ai ? Math.round(RES.mapper.ai.top3 * 100) + "%" : "not yet measured"}</div><div class="l">Mapper top-3 accuracy (model path)</div><div class="s">${RES.mapper && RES.mapper.ai ? `${RES.mapper.ai.n} questions against the live endpoint` : "needs a live key: npm run eval:live"}</div></div>
      </div>
      <div class="section"><div class="section-h"><h2>Findings register</h2><p>Found during build, adversarial testing, and review. Mapped to the OWASP Top 10 for LLM Applications (2025) where an AI feature is involved.</p></div>
      <div class="tblwrap"><table class="tbl"><thead><tr><th>ID</th><th>Finding</th><th>Severity</th><th>Fix and gate</th><th class="tech">OWASP LLM</th></tr></thead><tbody>${F.map(f => `<tr><td class="mono small nowrap">${esc(f.id)}</td><td><div class="title">${esc(f.title)}</div><div class="sub">${esc(f.detail)}</div></td><td>${pill(sev(f.severity), f.severity)} ${pill(f.status === "fixed" ? "ok" : "warn", f.status)}</td><td class="small">${esc(f.fix)}${f.gate ? `<div class="muted tech">gate: ${esc(f.gate)}</div>` : ""}</td><td class="tech small">${esc(f.owasp || "")}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="section two">
        <div class="card"><h3>What the gates check</h3><ul class="list small">
          <li><strong>Static gate.</strong> No em or en dashes; attribution exactly once; no city name in the page; every JSON record valid and every cross-reference resolvable; expired exceptions fail; AI inventory fields complete; CSP hashes match the built scripts; deterministic rebuild; version stamps consistent; secret patterns absent; security.txt valid.</li>
          <li><strong>Endpoint gate.</strong> The real mapper handler over HTTP with the model mocked: POST only, input cap, fair-use limiter keyed on the platform IP with spoofed forwarding headers sharing one bucket, unknown control IDs from the model dropped, prose and extra fields rejected, keyword fallback on provider failure, no provider text in errors, health probe shape.</li>
          <li><strong>UI gate.</strong> The built page in a DOM: every view renders, filters and deep links work, the drawer opens from a hash, the scenario is deterministic for a seed, reader mode toggles, the in-page mapper fallback returns valid IDs.</li>
          <li><strong>Eval.</strong> Gold-set accuracy for the mapper's keyword path on every test run; the model path measured against the live endpoint on demand.</li></ul></div>
        <div class="card"><h3>Real versus simulated, in full</h3><table class="tbl"><tbody>
          <tr><td>${pill("real", "Real")}</td><td class="small">The three Nimbus assistants and this site's control mapper, with their caps, limiter, disclosure rules, kill switch procedure, and no-transcript design. The 24-finding register on the assistants and this register. Google, Vercel, and GitHub as vendors with public trust centers. The evidence job, its bundles, and every check result. The build, the gates, the crosswalk logic, the CSP, the security.txt.</td></tr>
          <tr><td>${pill("sim", "Simulated")}</td><td class="small">Nimbus as a company: size, roles, policies, SOC 2 status, PCI attestation, four of seven vendors and all contract clauses, attestation dates for manual controls, the risk ratings, the scenario inputs. The city on file is not shown on this site by design.</td></tr>
          <tr><td>${pill("warn", "Limits")}</td><td class="small">Single maintainer: review is the author with AI assistance plus the gates. The limiter is per warm serverless instance. The mapper's keyword path is measured in-sample. No integration with cloud APIs, an identity provider, device management, or ticketing; those are named, not faked.</td></tr></tbody></table></div>
      </div>
      <div class="section two">
        <div class="card"><h3>Policies (simulated, version-controlled)</h3><div class="tblwrap"><table class="tbl"><tbody>${D.policies.map(p => `<tr class="row" data-open="tested/${esc(p.id)}"><td class="mono small">${esc(p.id)}</td><td class="small">${esc(p.title)} <span class="muted">v${esc(p.version)}</span></td><td class="small num"><span class="dot ${days(p.last_reviewed) <= p.review_days ? "ok" : "warn"}"></span>${esc(fmtDate(p.last_reviewed))}</td></tr>`).join("")}</tbody></table></div></div>
        <div class="card"><h3>About the builder</h3><p class="small">${esc(D.site.credentials.security_plus)}${D.site.credentials.security_plus_url ? ` (<a href="${esc(D.site.credentials.security_plus_url)}" target="_blank" rel="noopener">verify</a>)` : ""}. ${esc(D.site.credentials.ai_literacy)}.</p><p class="small">Built AI-assisted, which is how this work is done now. Every control mapping, every check, and every number on this site was specified, tested, and can be walked through under questioning. Sister demos: ${D.site.sister_sites.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(", ")}.</p><p class="small muted">Version ${esc(D.site.version)}. No cookies, no accounts, no transcript storage. Vercel Web Analytics counts visits without cookies.</p></div>
      </div>`;
  };

  views.glossary = () => `
      <div class="hero"><div class="tag">Reference</div><h1 id="h-glossary">Glossary</h1><p class="lead">Plain definitions first, technical detail second. Switch the reader mode in the header to hide or show the technical lines everywhere on the site.</p></div>
      <div class="filters"><input type="search" id="g-q" placeholder="Search terms" aria-label="Search glossary"></div>
      <div id="g-list" class="grid g2">${glossaryItems(D.glossary)}</div>`;
  const glossaryItems = terms => terms.map(t => `<div class="card tight"><h3>${esc(t.term)}</h3><div class="small">${esc(t.plain)}</div><div class="small muted tech mt">${esc(t.more)}</div></div>`).join("");

  // ---------- router ----------
  const binders = { controls: bindControls, risks: bindRisks, trust: root => { const b = $("#req-report", root); if (b) b.addEventListener("click", () => { $("#req-note", root).textContent = " Simulated: there is no real report to send. The control mapper and the evidence feed are the substitutes."; }); }, board: root => { const b = $("#print", root); if (b) b.addEventListener("click", () => window.print()); }, glossary: root => { const q = $("#g-q", root); q.addEventListener("input", () => { const v = q.value.trim().toLowerCase(); $("#g-list", root).innerHTML = glossaryItems(D.glossary.filter(t => !v || (t.term + " " + t.plain + " " + t.more).toLowerCase().includes(v))); }); } };
  const rendered = {};
  function show(view, param) {
    if (!views[view]) view = "trust";
    $$("main .view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    $$("nav.tabs a").forEach(a => { if (a.getAttribute("data-view") === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const root = $("#view-" + view);
    if (!rendered[view]) { root.innerHTML = views[view](); rendered[view] = true; if (binders[view]) binders[view](root); applyBars(root); }
    document.title = (view === "trust" ? "" : ({ overview: "Overview", controls: "Controls", ai: "AI systems", evidence: "Evidence", risks: "Risks", vendors: "Vendors", board: "Board brief", tested: "Tested", glossary: "Glossary" }[view] || "") + " | ") + D.site.name;
    if (param) {
      if (view === "risks" && param === "scenario") { closeDrawer(true); const s = $("#scenario"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      const detail = { controls: controlDetail, risks: riskDetail, vendors: vendorDetail, ai: aiDetail, tested: policyDetail }[view];
      if (detail) openDrawer(detail(param)); else if (view === "ai") { const el = $("#ai-" + param); if (el) el.scrollIntoView(); }
    } else if (drawer.classList.contains("open")) closeDrawer(true);
    if (!param) window.scrollTo({ top: 0 });
  }
  function route() { const h = location.hash.replace(/^#/, ""); const [view, param] = h.split("/"); show(view || "trust", param ? decodeURIComponent(param) : ""); }
  window.addEventListener("hashchange", route);
  document.addEventListener("click", e => { const row = e.target.closest("[data-open]"); if (row && !e.target.closest("a")) { location.hash = "#" + row.getAttribute("data-open"); } });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches && e.target.matches("[data-open]")) location.hash = "#" + e.target.getAttribute("data-open"); });
  route();
  window.__NTC__ = { data: D, health, coverage: COV, evState: ES, simulate, rank: q => rank(INDEX, q, 8), aboveAppetite, openExceptions };
})();
