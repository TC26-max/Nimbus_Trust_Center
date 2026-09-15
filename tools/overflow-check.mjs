// tools/overflow-check.mjs: find elements wider than the viewport at phone width (dev helper).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import("playwright");
const html = fs.readFileSync(path.join(ROOT, "backend/index.html"), "utf8");
const server = http.createServer((req, res) => { if (req.url.startsWith("/api/health")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ ok: false, mapper: "keyword" })); return; } res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {});
const page = await browser.newPage({ viewport: { width: 400, height: 800 } });
for (const v of ["trust", "overview", "controls", "ai", "evidence", "risks", "vendors", "board", "tested", "glossary"]) {
  await page.goto(base + "/#" + v, { waitUntil: "networkidle" }); await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const W = document.documentElement.clientWidth; const out = [];
    for (const el of document.querySelectorAll("body *")) { const b = el.getBoundingClientRect(); if (b.right > W + 1 && b.width > 0) { const p = el.closest(".tblwrap"); if (p && el !== p) continue; if (el.closest("nav.tabs")) continue; out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : ""} right=${Math.round(b.right)} w=${Math.round(b.width)}`); } }
    return { scrollWidth: document.documentElement.scrollWidth, W, out: out.slice(0, 8) };
  });
  console.log(v, "scrollWidth", r.scrollWidth, "/", r.W, r.out.length ? "\n  " + r.out.join("\n  ") : "");
}
await browser.close(); server.close();
