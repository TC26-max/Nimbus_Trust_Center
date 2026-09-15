// test/lib.mjs: shared harness for the gates. A tiny HTTP wrapper that gives Vercel-style handlers
// (req, res) with res.status().json(), a check counter, and the results file writer.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const R = p => path.join(ROOT, p);
export const DASH = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");
// The harness keeps its own reference to fetch so a gate can mock the global for the handler under test.
const nodeFetch = globalThis.fetch;

export function makeChecker(name) {
  let n = 0; const failures = [];
  const check = (cond, label) => { n++; if (cond) console.log(`  ok   ${label}`); else { failures.push(label); console.log(`  FAIL ${label}`); } };
  const done = () => {
    if (failures.length) { console.error(`${name}: ${failures.length} of ${n} checks failed\n` + failures.map(f => " - " + f).join("\n")); process.exit(1); }
    recordGate(name, n);
    console.log(`${name}: ${n} checks passed`);
  };
  return { check, done, count: () => n };
}

export function recordGate(name, count) {
  const p = R("eval/results.json");
  const res = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
  res.gates = res.gates || {};
  res.gates[name] = count;
  const names = ["static", "endpoint", "ui"];
  res.gates.total = names.reduce((a, k) => a + (res.gates[k] || 0), 0);
  res.gates.summary = names.filter(k => res.gates[k]).map(k => `${k} ${res.gates[k]}`).join(", ");
  fs.writeFileSync(p, JSON.stringify(res, null, 2) + "\n");
}

// Wrap a Vercel-style handler in a Node http server. Body is parsed as JSON into req.body like Vercel does.
export function serve(routes) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const handler = routes[url.pathname];
    if (!handler) { res.statusCode = 404; res.end("not found"); return; }
    let raw = ""; for await (const c of req) raw += c;
    if (raw && /application\/json/.test(req.headers["content-type"] || "")) { try { req.body = JSON.parse(raw); } catch (e) { req.body = raw; } } else if (raw) req.body = raw;
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
    try { await handler(req, res); } catch (e) { res.statusCode = 500; res.end("handler threw: " + e.message); }
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

export async function call(base, pathName, { method = "POST", body, headers = {} } = {}) {
  const r = await nodeFetch(base + pathName, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { json = null; }
  return { status: r.status, headers: r.headers, text, json };
}
