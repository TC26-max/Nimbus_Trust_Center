// backend/lib/rank.mjs: keyword ranking over the control library (BM25 with a small synonym map).
// Runs identically in Node (the /api/map shortlist) and in the page (the no-key fallback); build.mjs
// inlines this file into the page, so it must stay dependency-free and browser-safe (no Node imports).
// The model never sees the whole library: it chooses only among the top candidates this ranker returns,
// and the server validates every returned ID against that shortlist (control NC-PR-18, NC-PR-21).

const STOP = new Set(("a an the and or of to in on for with by is are be as at from that this it its we our your you " +
  "do does have has how what which who when where can will must should any all not no if then than into via per " +
  "their there they them these those over under about after before between within without such each more most " +
  "also been being was were would could may might shall use used using please describe explain provide list").split(" "));

// Canonical concept tokens. Each key maps a surface form (after light stemming) to a concept added to the token bag.
const SYN = {
  encrypt: "encrypt", encrypted: "encrypt", encryption: "encrypt", tls: "encrypt", https: "encrypt", ssl: "encrypt", cipher: "encrypt", aes: "encrypt", hsts: "encrypt",
  vendor: "vendor", supplier: "vendor", third: "vendor", subprocessor: "vendor", provider: "vendor", outsourc: "vendor", contract: "vendor", contractor: "vendor", saas: "vendor",
  backup: "backup", restore: "backup", recover: "backup", recovery: "backup", continuity: "backup", disaster: "backup", rto: "backup", rpo: "backup", resilien: "backup",
  incident: "incident", breach: "incident", notify: "incident", notification: "incident", respond: "incident", response: "incident", escalat: "incident", tabletop: "incident",
  mfa: "mfa", multifactor: "mfa", multi: "mfa", factor: "mfa", "2fa": "mfa", authenticat: "mfa", authenticator: "mfa", passkey: "mfa", phishing: "mfa", sso: "mfa", password: "mfa",
  log: "log", logging: "log", logs: "log", siem: "log", audit: "log", monitor: "log", monitoring: "log", alert: "log", alerting: "log", detect: "log",
  patch: "vuln", patching: "vuln", vulnerabil: "vuln", vulnerability: "vuln", cve: "vuln", dependency: "vuln", dependencies: "vuln", scan: "vuln", scanning: "vuln", remediat: "vuln", outdated: "vuln",
  train: "training", training: "training", awareness: "training", educat: "training", social: "training", engineering: "training",
  ai: "ai", llm: "ai", model: "ai", models: "ai", assistant: "ai", chatbot: "ai", chat: "ai", agent: "ai", agents: "ai", genai: "ai", generative: "ai", copilot: "ai", machine: "ai",
  policy: "policy", policies: "policy", standard: "policy", procedure: "policy", document: "policy", documented: "policy", written: "policy", approve: "policy", approved: "policy",
  access: "access", privilege: "access", privileged: "access", least: "access", role: "access", rbac: "access", permission: "access", entitlement: "access", provision: "access", deprovision: "access", offboard: "access", onboard: "access", joiner: "access", leaver: "access", terminat: "access", review: "review",
  inventory: "asset", asset: "asset", assets: "asset", cmdb: "asset", catalog: "asset",
  data: "data", classif: "data", classification: "data", retention: "data", retain: "data", dispose: "data", disposal: "data", delete: "data", deletion: "data", pii: "data", personal: "data", privacy: "data", minimiz: "data", transcript: "data",
  pentest: "pentest", penetration: "pentest", redteam: "pentest", adversarial: "pentest", test: "pentest", tested: "pentest", testing: "pentest", assess: "pentest", assessment: "pentest",
  kill: "killswitch", disable: "killswitch", switch: "killswitch", shutdown: "killswitch", deactivat: "killswitch", turn: "killswitch",
  key: "secret", keys: "secret", secret: "secret", secrets: "secret", credential: "secret", credentials: "secret", token: "secret", api: "secret", rotate: "secret", rotation: "secret", vault: "secret", service: "secret", account: "secret",
  rate: "ratelimit", limit: "ratelimit", limiting: "ratelimit", abuse: "ratelimit", dos: "ratelimit", ddos: "ratelimit", flood: "ratelimit", quota: "ratelimit", cost: "ratelimit", spend: "ratelimit",
  csp: "header", header: "header", headers: "header", clickjack: "header", frame: "header", nosniff: "header", browser: "header",
  exception: "exception", deviation: "exception", waiver: "exception", exemption: "exception", compensating: "exception",
  risk: "risk", register: "risk", appetite: "risk", tolerance: "risk", kri: "risk", likelihood: "risk", impact: "risk", threat: "risk",
  board: "governance", executive: "governance", leadership: "governance", charter: "governance", accountable: "governance", accountability: "governance", ciso: "governance", officer: "governance", owner: "governance", ownership: "governance", governance: "governance", oversight: "oversight", human: "oversight",
  disclosure: "disclosure", disclose: "disclosure", researcher: "disclosure", bounty: "disclosure", report: "disclosure", reporting: "disclosure",
  prompt: "injection", injection: "injection", jailbreak: "injection", untrusted: "injection", manipulat: "injection", output: "injection", validation: "injection", validate: "injection",
  status: "comms", customer: "comms", customers: "comms", communicat: "comms", communication: "comms", transparen: "comms", transparency: "comms",
  shadow: "shadow", unapproved: "shadow", unsanctioned: "shadow", sanction: "shadow",
  change: "change", changes: "change", deploy: "change", deployment: "change", release: "change", pipeline: "change", cicd: "change", ci: "change", build: "change", code: "change", develop: "change", development: "change", sdlc: "change", regression: "change", version: "change",
  malware: "endpoint", antivirus: "endpoint", edr: "endpoint", laptop: "endpoint", device: "endpoint", devices: "endpoint", endpoint: "endpoint", workstation: "endpoint", mdm: "endpoint",
  law: "legal", legal: "legal", regulat: "legal", regulation: "legal", regulatory: "legal", compliance: "legal", texas: "legal", gdpr: "legal", hipaa: "legal", pci: "legal", soc: "legal", iso: "legal", nist: "legal", framework: "legal", safe: "legal", harbor: "legal", traiga: "legal", statute: "legal",
  continuous: "continuous", daily: "continuous", automated: "continuous", automat: "continuous", evidence: "continuous", freshness: "continuous", drift: "continuous",
  lesson: "improve", lessons: "improve", improve: "improve", improvement: "improve", postmortem: "improve", root: "improve", cause: "improve", finding: "improve", findings: "improve",
  rest: "atrest", stored: "atrest", storage: "atrest", database: "atrest", disk: "atrest",
  transit: "transit", network: "transit", transmission: "transit", transmit: "transit"
};

function stem(w) {
  if (w.length <= 3) return w;
  return w.replace(/ies$/, "y").replace(/(ing|ed|es|s)$/, "");
}

export function tokenize(text) {
  const raw = String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  const out = [];
  for (const w of raw) {
    if (STOP.has(w)) continue;
    const s = stem(w);
    out.push(s);
    const syn = SYN[w] || SYN[s] || SYN[s.slice(0, 8)];
    if (syn && syn !== s) out.push(syn);
  }
  return out;
}

function bag(tokens) {
  const m = {};
  for (const t of tokens) m[t] = (m[t] || 0) + 1;
  return m;
}

// The text a control is indexed under: title (twice), statement, plain wording, notes, and the titles of
// its framework mappings, so vocabulary like "encrypt sensitive data in transit" helps recall.
export function docText(c, frameworks) {
  const titles = [];
  const fw = frameworks && frameworks.frameworks ? frameworks.frameworks : {};
  const m = c.mappings || {};
  for (const id of (m.csf || [])) titles.push(fw.csf && fw.csf.ids[id] || "");
  for (const x of (m.cis || [])) titles.push(fw.cis && fw.cis.ids[x.id] || "");
  for (const id of (m.soc2 || [])) titles.push(fw.soc2 && fw.soc2.ids[id] || "");
  for (const id of (m.airmf || [])) titles.push(fw.airmf && fw.airmf.ids[id] || "");
  return [c.title, c.title, c.statement, c.plain, c.notes || "", titles.join(" ")].join(" ");
}

// Build the index from the control library (or from a compact list that already carries a text field).
export function buildIndex(controls, frameworks) {
  const docs = controls.map(c => {
    const tokens = tokenize(c.text || docText(c, frameworks));
    return { id: c.id, title: c.title, tf: bag(tokens), len: tokens.length };
  });
  const df = {};
  for (const d of docs) for (const t of Object.keys(d.tf)) df[t] = (df[t] || 0) + 1;
  const avgLen = docs.reduce((a, d) => a + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen, N: docs.length };
}

// BM25 ranking. Returns [{ id, title, score, matched }] sorted by score, top k.
export function rank(index, query, k = 8) {
  const q = tokenize(query);
  if (!q.length) return [];
  const qb = bag(q);
  const k1 = 1.2, b = 0.75;
  const out = [];
  for (const d of index.docs) {
    let score = 0; const matched = [];
    for (const t of Object.keys(qb)) {
      const tf = d.tf[t]; if (!tf) continue;
      const n = index.df[t] || 0;
      const idf = Math.log(1 + (index.N - n + 0.5) / (n + 0.5));
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * d.len / index.avgLen));
      score += idf * norm * Math.min(2, qb[t]);
      matched.push(t);
    }
    if (score > 0) out.push({ id: d.id, title: d.title, score: Math.round(score * 1000) / 1000, matched });
  }
  out.sort((a, b2) => b2.score - a.score || a.id.localeCompare(b2.id));
  return out.slice(0, k);
}
