// backend/lib/security.mjs: client IP resolution for the fair-use limiter (Node only).
// Same rule as the Nimbus assistants (audit finding G-16 there): the limiter trusts only the header the
// platform sets on every request (x-real-ip on Vercel). x-forwarded-for is client-writable, so it is used
// only when TRUST_XFF=1, and then only its last hop. With no trusted header every caller shares one bucket,
// which fails closed: a rotating spoofed header can never rotate the limiter.
export function clientIp(req) {
  const real = req.headers["x-real-ip"];
  if (real) return String(real).trim();
  if (process.env.TRUST_XFF === "1") {
    const xff = String(req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return "shared";
}

// Fixed-window limiter per warm instance: N requests per window per IP, plus a daily cap per instance.
// Not a security boundary and not global (documented on the site); it bounds cost and blunts abuse.
export function makeLimiter({ windowMs, max, dayMax }) {
  const buckets = new Map();
  let day = { start: Date.now(), n: 0 };
  return function limited(req, now = Date.now()) {
    if (now - day.start > 24 * 60 * 60 * 1000) day = { start: now, n: 0 };
    if (++day.n > dayMax) return true;
    const ip = clientIp(req);
    const e = buckets.get(ip);
    if (!e || now - e.t > windowMs) {
      if (buckets.size > 5000) buckets.clear();
      buckets.set(ip, { t: now, n: 1 });
      return false;
    }
    return ++e.n > max;
  };
}

// Strip control characters (except newline and tab) and cap length. Input is data, never instructions.
export function cleanText(s, maxLen) {
  if (typeof s !== "string") return "";
  // control characters except tab and newline; built from code points so the source file stays plain ASCII
  const ctl = new RegExp("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]", "g");
  const out = s.replace(ctl, "").replace(/\s+/g, " ").trim();
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}
