/* Vercel serverless function: contact form → email via Resend.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   CONTACT_DELIVERY_ENABLED  "true" to send. Anything else returns 503 and the
 *                             form tells the visitor to call instead.
 *   RESEND_API_KEY            Resend API key.
 *   CONTACT_FROM              Sender on a domain verified in Resend,
 *                             e.g. "VCOH Website <website@vtcomfortsofhome.org>".
 *   CONTACT_TO                Optional, comma-separated. Defaults to the intake list below.
 *   CONTACT_ALLOWED_ORIGINS   Optional, comma-separated extra origins.
 */

const DEFAULT_TO = [
  "VCOH.Intake@uvs-vt.org",
  "John.hooley@uvs-vt.org",
  "Desireah.Ladieu@uvs-vt.org",
  "Mary.Mougey@uvs-vt.org"
];

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

  /* Honeypot: real visitors never see or fill the "company" field. */
  if (clean(body.company, 200)) return res.status(200).json({ ok: true });

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

  if (process.env.CONTACT_DELIVERY_ENABLED !== "true" || !process.env.RESEND_API_KEY || !process.env.CONTACT_FROM) {
    return res.status(503).json({ ok: false, error: "delivery_off" });
  }

  const to = String(process.env.CONTACT_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  const recipients = to.length ? to : DEFAULT_TO;

  const rows = [
    ["Name", name],
    ["Email", email || "—"],
    ["Phone", phone || "—"],
    ["Site language", lang === "ne" ? "Nepali" : "English"]
  ];
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#303030">' +
    '<h2 style="color:#35520a;margin:0 0 12px">New message from vtcomfortsofhome.org</h2>' +
    '<table style="border-collapse:collapse">' +
    rows.map(([k, v]) => '<tr><td style="padding:4px 14px 4px 0;color:#6f6a5e">' + k + "</td><td style=\"padding:4px 0\"><strong>" + esc(v) + "</strong></td></tr>").join("") +
    "</table>" +
    '<p style="margin:16px 0 6px;color:#6f6a5e">Message</p>' +
    '<div style="white-space:pre-wrap;border-left:3px solid #517e02;padding:8px 12px;background:#f7f4ec">' + esc(message) + "</div>" +
    "</div>";
  const text = rows.map(([k, v]) => k + ": " + v).join("\n") + "\n\nMessage:\n" + message;

  const payload = {
    from: process.env.CONTACT_FROM,
    to: recipients,
    subject: "Website message from " + name,
    html,
    text
  };
  if (email) payload.reply_to = email;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      console.error("resend_failed", r.status, await r.text());
      return res.status(502).json({ ok: false, error: "send_failed" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("resend_error", e && e.message);
    return res.status(502).json({ ok: false, error: "send_failed" });
  }
};
