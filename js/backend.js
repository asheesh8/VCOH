/* Vermont Comforts of Home — editor backend.
   Talks to Supabase over plain HTTPS (no SDK): passcode sign-in, reading and
   saving the live content row, and uploading photos. When Supabase is not
   configured (js/supabase-config.js left blank) the editor still opens with
   the passcode, but changes can only be exported as data/content.json. */
(function () {
  "use strict";

  var CFG = window.VCOH_SUPABASE || {};
  var URL_ = String(CFG.url || "").replace(/\/+$/, "");
  var KEY = CFG.anonKey || "";
  var EMAIL = CFG.editorEmail || "";
  var BUCKET = CFG.bucket || "site-media";
  var SESSION_KEY = "vcoh:session";
  var LOCAL_KEY = "vcoh:unlocked";
  var ROW = "live";

  /* SHA-256 of the passcode — only used when Supabase is not set up yet. In
     that mode nothing can be published anyway, so this just keeps the editor
     out of casual view. With Supabase, the passcode is the editor account's
     real password and is checked by Supabase. */
  var LOCAL_HASH = "2733cbadb79261b6d5310dd7a7ebcc01f3278ac1bf5a2aa977bf978d8c0cec8e";

  var configured = !!(URL_ && KEY && EMAIL);

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function headers(token, extra) {
    var h = { apikey: KEY, Authorization: "Bearer " + (token || KEY) };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function errorFrom(r) {
    return r.text().then(function (t) {
      var msg = t;
      try { var j = JSON.parse(t); msg = j.error_description || j.msg || j.message || j.error || t; } catch (e) {}
      var err = new Error(msg || ("HTTP " + r.status));
      err.status = r.status;
      throw err;
    });
  }

  function json(r) { return r.ok ? r.json() : errorFrom(r); }

  function keep(tok) {
    var s = {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: Date.now() + (tok.expires_in || 3600) * 1000,
      email: (tok.user && tok.user.email) || EMAIL
    };
    writeSession(s);
    return s;
  }

  function token(grant, body) {
    return fetch(URL_ + "/auth/v1/token?grant_type=" + grant, {
      method: "POST",
      headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    }).then(json).then(keep);
  }

  function sha256(text) {
    var data = new TextEncoder().encode(text);
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return ("0" + b.toString(16)).slice(-2);
      }).join("");
    });
  }

  /* A valid access token, refreshing it when it is close to expiring. */
  function session() {
    if (!configured) {
      var ok = false;
      try { ok = sessionStorage.getItem(LOCAL_KEY) === "1"; } catch (e) {}
      return Promise.resolve(ok ? { local: true } : null);
    }
    var s = readSession();
    if (!s || !s.refresh_token) return Promise.resolve(null);
    if (s.expires_at - Date.now() > 60 * 1000) return Promise.resolve(s);
    return token("refresh_token", { refresh_token: s.refresh_token }).catch(function () {
      writeSession(null);
      return null;
    });
  }

  function signIn(passcode) {
    if (!configured) {
      return sha256(passcode).then(function (h) {
        if (h !== LOCAL_HASH) throw new Error("That passcode is not right.");
        try { sessionStorage.setItem(LOCAL_KEY, "1"); } catch (e) {}
        return { local: true };
      });
    }
    return token("password", { email: EMAIL, password: passcode }).catch(function (e) {
      if (e.status === 400) throw new Error("That passcode is not right.");
      throw e;
    });
  }

  function signOut() {
    var s = readSession();
    writeSession(null);
    try { sessionStorage.removeItem(LOCAL_KEY); } catch (e) {}
    if (configured && s && s.access_token) {
      fetch(URL_ + "/auth/v1/logout", { method: "POST", headers: headers(s.access_token) }).catch(function () {});
    }
  }

  function authed() {
    return session().then(function (s) {
      if (!s || s.local) {
        var e = new Error("Your sign-in has expired. Please sign in again.");
        e.status = 401;
        throw e;
      }
      return s;
    });
  }

  /* Published content, or null when nothing has been saved to Supabase yet. */
  function loadLive() {
    if (!configured) return Promise.resolve(null);
    return fetch(URL_ + "/rest/v1/site_content?id=eq." + ROW + "&select=data,updated_at,updated_by", {
      headers: headers(null, { Accept: "application/json" }),
      cache: "no-store"
    }).then(json).then(function (rows) {
      return rows && rows[0] ? rows[0] : null;
    });
  }

  function saveLive(doc) {
    return authed().then(function (s) {
      return fetch(URL_ + "/rest/v1/site_content?on_conflict=id", {
        method: "POST",
        headers: headers(s.access_token, {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        }),
        body: JSON.stringify({ id: ROW, data: doc, updated_by: s.email || EMAIL })
      }).then(json).then(function (rows) { return rows && rows[0]; });
    });
  }

  function upload(file) {
    return authed().then(function (s) {
      var ext = (String(file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      var base = String(file.name || "photo").replace(/\.[^.]+$/, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
      var path = "uploads/" + Date.now().toString(36) + "-" + base + "." + ext;
      return fetch(URL_ + "/storage/v1/object/" + BUCKET + "/" + path, {
        method: "POST",
        headers: headers(s.access_token, {
          "Content-Type": file.type || "application/octet-stream",
          "Cache-Control": "31536000",
          "x-upsert": "false"
        }),
        body: file
      }).then(function (r) {
        if (!r.ok) return errorFrom(r);
        return URL_ + "/storage/v1/object/public/" + BUCKET + "/" + path;
      });
    });
  }

  window.VCOHBackend = {
    configured: configured,
    email: EMAIL,
    session: session,
    signIn: signIn,
    signOut: signOut,
    loadLive: loadLive,
    saveLive: saveLive,
    upload: upload
  };
})();
