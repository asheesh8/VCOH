/* Vermont Comforts of Home — editor backend.
   Talks to the Vercel function api/editor.js, which checks the passcode and
   saves edits by committing them to the GitHub repo (the site then redeploys
   in about a minute). When that function is not available — running from a
   plain local server, or before its environment variables are set — the
   editor still opens with the passcode, but changes can only be exported as
   data/content.json. */
(function () {
  "use strict";

  var API = "/api/editor";
  var SESSION_KEY = "vcoh:session";
  var LOCAL_KEY = "vcoh:unlocked";

  /* SHA-256 of the passcode — only used when the server is not available. In
     that mode nothing can be published, so this just keeps the editor out of
     casual view. Online, the passcode is checked by the server. */
  var LOCAL_HASH = "2733cbadb79261b6d5310dd7a7ebcc01f3278ac1bf5a2aa977bf978d8c0cec8e";

  var B = {
    configured: false, /* true once the server says it is set up */
    session: session,
    signIn: signIn,
    signOut: signOut,
    loadLive: loadLive,
    saveLive: saveLive,
    upload: upload,
    ready: null
  };

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function fail(status, msg) {
    var e = new Error(msg);
    e.status = status;
    return e;
  }

  var MESSAGES = {
    wrong_passcode: "That passcode is not right.",
    signed_out: "Your sign-in has expired. Please sign in again.",
    conflict: "Someone else published changes while you were editing. Reload the editor to get their changes, then make yours again.",
    too_large: "That is too large. Photos must be under 3 MB.",
    not_an_image: "Please choose a JPG, PNG, WebP or GIF photo.",
    not_configured: "Online saving is not set up yet."
  };

  function call(action, opts) {
    opts = opts || {};
    var s = readSession();
    var headers = { Accept: "application/json" };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (s && s.token) headers.Authorization = "Bearer " + s.token;
    return fetch(API + "?action=" + action, {
      method: opts.body ? "POST" : "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) {
          if (r.status === 401 && action !== "login") writeSession(null);
          var code = j && j.error;
          throw fail(r.status, MESSAGES[code] || (j && j.message) || ("The server answered " + r.status + "."));
        }
        return j || {};
      });
    });
  }

  /* Is the server-side editor available? Resolves once, cached. */
  function probe() {
    if (B.ready) return B.ready;
    B.ready = fetch(API + "?action=status", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { ready: false }; })
      .catch(function () { return { ready: false }; })
      .then(function (j) {
        B.configured = !!(j && j.ready);
        return B.configured;
      });
    return B.ready;
  }

  function sha256(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  function session() {
    return probe().then(function (online) {
      if (!online) {
        var ok = false;
        try { ok = sessionStorage.getItem(LOCAL_KEY) === "1"; } catch (e) {}
        return ok ? { local: true } : null;
      }
      var s = readSession();
      if (!s || !s.token || s.expires < Date.now() + 60 * 1000) { writeSession(null); return null; }
      return s;
    });
  }

  function signIn(passcode) {
    return probe().then(function (online) {
      if (!online) {
        return sha256(passcode).then(function (h) {
          if (h !== LOCAL_HASH) throw fail(401, MESSAGES.wrong_passcode);
          try { sessionStorage.setItem(LOCAL_KEY, "1"); } catch (e) {}
          return { local: true };
        });
      }
      return call("login", { body: { passcode: passcode } }).then(function (j) {
        var s = { token: j.token, expires: j.expires };
        writeSession(s);
        return s;
      });
    });
  }

  function signOut() {
    writeSession(null);
    try { sessionStorage.removeItem(LOCAL_KEY); } catch (e) {}
  }

  var lastSha = null;

  /* The newest saved content, read straight from GitHub so it is current
     even while a deploy is still running. */
  function loadLive() {
    return probe().then(function (online) {
      if (!online) return null;
      return call("content").then(function (j) {
        lastSha = j.sha || null;
        return j.data ? { data: j.data, updated_at: j.data.updated } : null;
      });
    });
  }

  function saveLive(doc) {
    return call("save", { body: { data: doc, sha: lastSha } }).then(function (j) {
      lastSha = j.sha || lastSha;
      return { updated_at: j.updated };
    });
  }

  function upload(file) {
    if (file.size > 3 * 1024 * 1024) {
      return Promise.reject(fail(413, "That photo is " + (file.size / 1024 / 1024).toFixed(1) + " MB. Please use one under 3 MB."));
    }
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(",")[1] || ""); };
      fr.onerror = function () { reject(fail(0, "Could not read that file.")); };
      fr.readAsDataURL(file);
    }).then(function (b64) {
      return call("upload", { body: { name: file.name, type: file.type, base64: b64 } });
    }).then(function (j) { return j.path; });
  }

  window.VCOHBackend = B;
})();
