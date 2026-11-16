/* Vercel serverless function: the site editor's backend.
 *
 * Saves edits by committing them to the GitHub repo; Vercel then redeploys the
 * site (about a minute). The passcode and the GitHub token stay on the server.
 *
 *   POST /api/editor?action=login    { passcode }            → { token, expires }
 *   GET  /api/editor?action=content  (Authorization: Bearer) → { data, sha, updated }
 *   POST /api/editor?action=save     { data, sha }           → { ok, commit }
 *   POST /api/editor?action=upload   { name, type, base64 }  → { path }
 *   GET  /api/editor?action=status                           → { ready }
 *
 * Environment variables (Vercel → Settings → Environment Variables):
 *   EDITOR_PASSCODE   the passcode staff type to sign in
 *   GITHUB_TOKEN      fine-grained token with Contents: read & write on the repo
 *   GITHUB_REPO       optional, default "asheesh8/VCOH"
 *   GITHUB_BRANCH     optional, default "main"
 */

const crypto = require("crypto");

const REPO = () => process.env.GITHUB_REPO || "asheesh8/VCOH";
const BRANCH = () => process.env.GITHUB_BRANCH || "main";
const CONTENT_PATH = "data/content.json";
const UPLOAD_DIR = "assets/uploads";
const SESSION_HOURS = 12;
const MAX_UPLOAD = 3 * 1024 * 1024; /* Vercel caps request bodies at ~4.5 MB */
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function ready() {
  return !!(process.env.EDITOR_PASSCODE && process.env.GITHUB_TOKEN);
}

/* Signing key for sessions. Changing the passcode or token signs everyone out. */
function key() {
  return crypto.createHash("sha256")
    .update("vcoh-editor\n" + process.env.EDITOR_PASSCODE + "\n" + process.env.GITHUB_TOKEN)
    .digest();
}

function sign(exp) {
  return crypto.createHmac("sha256", key()).update(String(exp)).digest("base64url");
}

function issue() {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  return { token: exp + "." + sign(exp), expires: exp };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verify(req) {
  const h = String(req.headers.authorization || "");
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [exp, sig] = t.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

function passcodeOk(given) {
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(String(process.env.EDITOR_PASSCODE)).digest();
  return crypto.timingSafeEqual(a, b);
}

async function gh(path, opts) {
  const r = await fetch("https://api.github.com/repos/" + REPO() + path, Object.assign({}, opts, {
    headers: Object.assign({
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vcoh-site-editor"
    }, opts && opts.headers)
  }));
  const text = await r.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text }; }
  return { status: r.status, ok: r.ok, body };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch (e) { return {}; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const action = String((req.query && req.query.action) || new URL(req.url, "http://x").searchParams.get("action") || "");

  if (action === "status") return res.status(200).json({ ready: ready() });
  if (!ready()) return res.status(503).json({ ok: false, error: "not_configured" });

  if (action === "login") {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const body = await readBody(req);
    if (!passcodeOk(body.passcode)) {
      await sleep(800); /* slow down guessing */
      return res.status(401).json({ ok: false, error: "wrong_passcode" });
    }
    return res.status(200).json(Object.assign({ ok: true }, issue()));
  }

  if (!verify(req)) return res.status(401).json({ ok: false, error: "signed_out" });

  if (action === "content") {
    const r = await gh("/contents/" + CONTENT_PATH + "?ref=" + encodeURIComponent(BRANCH()));
    if (r.status === 404) return res.status(200).json({ ok: true, data: null, sha: null });
    if (!r.ok) return res.status(502).json({ ok: false, error: "github_" + r.status, message: r.body && r.body.message });
    let data = null;
    try { data = JSON.parse(Buffer.from(r.body.content, "base64").toString("utf8")); } catch (e) {}
    return res.status(200).json({ ok: true, data, sha: r.body.sha });
  }

  if (action === "save") {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const body = await readBody(req);
    const data = body.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ ok: false, error: "bad_content" });
    }
    data.version = data.version || 1;
    data.updated = new Date().toISOString();
    const text = JSON.stringify(data, null, 2) + "\n";
    if (text.length > 3.5 * 1024 * 1024) return res.status(413).json({ ok: false, error: "too_large" });

    /* Use the sha the editor loaded, so two people saving at once can't
       silently overwrite each other. */
    let sha = body.sha || null;
    if (!sha) {
      const cur = await gh("/contents/" + CONTENT_PATH + "?ref=" + encodeURIComponent(BRANCH()));
      if (cur.ok) sha = cur.body.sha;
    }
    const r = await gh("/contents/" + CONTENT_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Site editor: update content",
        content: Buffer.from(text, "utf8").toString("base64"),
        branch: BRANCH(),
        sha: sha || undefined
      })
    });
    if (r.status === 409 || r.status === 422) {
      return res.status(409).json({ ok: false, error: "conflict", message: "Someone else saved changes in the meantime." });
    }
    if (!r.ok) return res.status(502).json({ ok: false, error: "github_" + r.status, message: r.body && r.body.message });
    return res.status(200).json({ ok: true, sha: r.body.content && r.body.content.sha, commit: r.body.commit && r.body.commit.sha, updated: data.updated });
  }

  if (action === "upload") {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });
    const body = await readBody(req);
    const ext = IMAGE_TYPES[body.type];
    if (!ext) return res.status(400).json({ ok: false, error: "not_an_image" });
    const bytes = Buffer.from(String(body.base64 || ""), "base64");
    if (!bytes.length) return res.status(400).json({ ok: false, error: "empty" });
    if (bytes.length > MAX_UPLOAD) return res.status(413).json({ ok: false, error: "too_large" });
    const base = String(body.name || "photo").replace(/\.[^.]+$/, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
    const path = UPLOAD_DIR + "/" + Date.now().toString(36) + "-" + base + "." + ext;
    const r = await gh("/contents/" + path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Site editor: add photo " + path, content: bytes.toString("base64"), branch: BRANCH() })
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: "github_" + r.status, message: r.body && r.body.message });
    return res.status(200).json({ ok: true, path });
  }

  return res.status(404).json({ ok: false, error: "unknown_action" });
};
