/**
 * Vermont Comforts of Home — contact form mailer (Google Apps Script).
 *
 * The website's Vercel function (api/contact.js) posts each form message here,
 * and this script emails it from your Google account to the intake team.
 *
 * Setup (script.google.com → New project → paste this file):
 *   1. Project Settings (gear) → Script Properties → Add property
 *        SHARED_SECRET = a long random string (the same value goes in Vercel
 *                        as CONTACT_SCRIPT_SECRET)
 *   2. Run → testSetup once, and allow the permissions it asks for.
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *      Copy the web app URL (ends in /exec) into Vercel as CONTACT_SCRIPT_URL.
 *
 * Quota: a personal Gmail account can email about 100 recipients a day
 * (4 per message here, so ~25 messages a day). Google Workspace: 1,500.
 */

var RECIPIENTS = [
  "VCOH.Intake@uvs-vt.org",
  "John.hooley@uvs-vt.org",
  "Desireah.Ladieu@uvs-vt.org",
  "Mary.Mougey@uvs-vt.org"
];
var SENDER_NAME = "VCOH Website";

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) {}

  var secret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  if (!secret || String(body.secret || "") !== secret) return reply({ ok: false, error: "forbidden" });

  var name = clip(body.name, 120);
  var email = clip(body.email, 200);
  var phone = clip(body.phone, 40);
  var message = clip(body.message, 5000);
  var lang = body.lang === "ne" ? "Nepali" : "English";
  if (!name || !message || (!email && !phone)) return reply({ ok: false, error: "missing_fields" });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) email = "";

  if (MailApp.getRemainingDailyQuota() < RECIPIENTS.length) {
    return reply({ ok: false, error: "quota" });
  }

  var rows = [["Name", name], ["Email", email || "—"], ["Phone", phone || "—"], ["Site language", lang]];
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#303030">' +
    '<h2 style="color:#35520a;margin:0 0 12px">New message from vtcomfortsofhome.org</h2>' +
    '<table style="border-collapse:collapse">' +
    rows.map(function (r) {
      return '<tr><td style="padding:4px 14px 4px 0;color:#6f6a5e">' + r[0] +
        '</td><td style="padding:4px 0"><strong>' + esc(r[1]) + "</strong></td></tr>";
    }).join("") +
    "</table>" +
    '<p style="margin:16px 0 6px;color:#6f6a5e">Message</p>' +
    '<div style="white-space:pre-wrap;border-left:3px solid #517e02;padding:8px 12px;background:#f7f4ec">' +
    esc(message) + "</div></div>";
  var text = rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") + "\n\nMessage:\n" + message;

  var mail = {
    to: RECIPIENTS.join(","),
    subject: "Website message from " + name,
    body: text,
    htmlBody: html,
    name: SENDER_NAME
  };
  if (email) mail.replyTo = email;
  MailApp.sendEmail(mail);
  return reply({ ok: true });
}

/* A browser visit to the URL just shows that the script is running. */
function doGet() {
  return reply({ ok: true, service: "vcoh-contact" });
}

/* Run once from the editor to grant permission and check the setup. */
function testSetup() {
  var secret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
  Logger.log(secret ? "SHARED_SECRET is set." : "SHARED_SECRET is missing — add it in Project Settings → Script Properties.");
  Logger.log("Emails left today: " + MailApp.getRemainingDailyQuota());
}

function clip(v, max) {
  return String(v == null ? "" : v).replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
