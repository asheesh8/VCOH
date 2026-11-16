/* Vercel serverless function: contact form → email.
 *
 * Validates the message, drops bots, then hands it to a Google Apps Script web
 * app (apps-script/contact.gs) that sends it from your Google account to the
 * intake team. The script URL and secret stay on the server.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   CONTACT_SCRIPT_URL      the Apps Script web app URL (ends in /exec). Without it
 *                           the form returns 503 and tells the visitor to call.
 *   CONTACT_SCRIPT_SECRET   the same value as SHARED_SECRET in the script.
 *   CONTACT_ALLOWED_ORIGINS optional, comma-separated extra origins.
 * Recipients are set in the Apps Script.
 */

const ORIGINS = [
  "https://www.vtcomfortsofhome.org",
  "https://vtcomfortsofhome.org",
  "https://www.vtcomfortsofhome.com",
  "https://vtcomfortsofhome.com",
  "https://vcoh.vercel.app"
];

const LIMITS = { name: 120, email: 200, phone: 40, message: 5000 };

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function clean(v, max) {
  return String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function allowedOrigin(origin) {
  if (!origin) return true; /* same-origin form posts may omit it */
  const extra = String(process.env.CONTACT_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ORIGINS.concat(extra).includes(origin)) return true;
  if (/^https:\/\/vcoh-[a-z0-9-]+\.vercel\.app$/.test(origin)) return true; /* preview deploys */
  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch (e) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  if (!allowedOrigin(req.headers.origin)) {
    return res.status(403).json({ ok: false, error: "origin_not_allowed" });
  }

  const body = await readBody(req);

  /* Spam checks: real visitors never see or fill the "company" field, and
     nobody types a message in under three seconds. Bots get a quiet "ok". */
  if (clean(body.company, 200)) return res.status(200).json({ ok: true });
  const started = Number(body.started || 0);
  if (started && Date.now() - started < 3000) return res.status(200).json({ ok: true });

  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const phone = clean(body.phone, LIMITS.phone);
  const message = clean(body.message, LIMITS.message);
  const lang = body.lang === "ne" ? "ne" : "en";

  if (!name || !message || (!email && !phone)) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "bad_email" });
  }

  if (!process.env.CONTACT_SCRIPT_URL || !process.env.CONTACT_SCRIPT_SECRET) {
    return res.status(503).json({ ok: false, error: "delivery_off" });
  }

  try {
    /* Apps Script answers with a redirect to the result; fetch follows it. */
    const r = await fetch(process.env.CONTACT_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ secret: process.env.CONTACT_SCRIPT_SECRET, name, email, phone, message, lang }),
      redirect: "follow"
    });
    const text = await r.text();
    let out = null;
    try { out = JSON.parse(text); } catch (e) {}
    if (!r.ok || !out || !out.ok) {
      console.error("script_failed", r.status, out ? out.error : text.slice(0, 200));
      return res.status(502).json({ ok: false, error: "send_failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("script_error", e && e.message);
    return res.status(502).json({ ok: false, error: "send_failed" });
  }
};
