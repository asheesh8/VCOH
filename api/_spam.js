/* Spam filter for the contact form (used by api/contact.js).
 *
 * The files in api/ that start with "_" are not routes on Vercel, so this is
 * only a helper. It scores a message; at SPAM_SCORE or more it is treated as
 * spam and quietly dropped (the visitor still sees "sent").
 *
 * Real inquiries to VCOH are about care for a person, becoming a home care
 * provider, or a question. They almost never contain links or sales talk, so
 * the filter leans on those two signals. Common words ("sales", "website",
 * one link) never block a message by themselves.
 */

const SPAM_SCORE = 4;

/* Phrases that only show up in sales, lead-gen, SEO, or scam pitches. 3 points each. */
const STRONG = [
  /\b(qualified|verified|targeted|b2b)\s+(prospects?|leads?|traffic|emails?|contacts?)\b/i,
  /\blead\s*(gen(eration)?|lists?|database)\b/i,
  /\b\d[\d,.]*\s*[km+]?\+?\s*(verified\s+)?(leads|prospects|subscribers|followers|backlinks)\b/i,
  /\bunlimited\s+(sends|leads|emails|access)\b/i,
  /\b(outbound|cold)\s+(channel|email|outreach|calling|campaigns?)\b/i,
  /\bbook\s+(a|your)\s+(free\s+)?(call|demo|meeting|consultation)\s+(at|here|via|using|on|through|:)|\bbook\s+a\s+(free\s+)?demo\b/i,
  /\b(search engine optimi[sz]ation|seo\s+(services?|agency|expert|audit|package|ranking|report))\b/i,
  /\b(first|top|1st)\s+page\s+(of|on)\s+google\b/i,
  /\b(rank|ranking)\s+(higher|#?1|on google|in google)\b/i,
  /\b(backlinks?|guest\s+posts?|link\s+building|domain\s+authority)\b/i,
  /\b(digital|online)\s+marketing\s+(agency|services?|team|experts?)\b/i,
  /\b(web(site)?\s+(design|redesign|development))\s+(services?|agency|company|team|package)\b/i,
  /\bwhat would your (sales|revenue|business)\b/i,
  /\b(grow|boost|increase|skyrocket|double|triple)\s+(your\s+)?(sales|revenue|leads|traffic|conversions|roi)\b/i,
  /\b(more|new)\s+(customers|clients)\s+(every|each|per)\s+(day|week|month)\b/i,
  /\b(messages?|emails?)\s+a\s+day\b/i,
  /\b(appointment setting|social media management|virtual assistant services?|merchant services|business (loan|funding)|working capital)\b/i,
  /\b(crypto(currency)?|bitcoin|forex|binary options|casino|viagra|cialis)\b/i,
  /\bunsubscribe\b|\breply\s+(with\s+)?["'](stop|remove)["']/i,
  /\b(insaneleads|elevenviral)\b/i
];

/* Words a real inquiry can use, but that pile up in pitches. 1 point each, capped. */
const WEAK = [
  /\bsales\b/i, /\bmarketing\b/i, /\bprospects?\b/i, /\bleads\b/i, /\bseo\b/i,
  /\bagency\b/i, /\btraffic\b/i, /\branking\b/i, /\bconversions?\b/i, /\broi\b/i,
  /\bfree (trial|audit|quote|demo)\b/i, /\bpricing\b/i, /\bchatgpt\b|\bgemini\b|\bclaude\b|\bai[- ]powered\b/i,
  /\bpartnership\b/i, /\bour (team|company|clients|platform|services)\b/i, /\bcheck it out\b/i
];

/* Sender addresses like leads@, seo@, marketing@ or a lead-gen domain. */
const SENDER = /(leads?|seo|marketing|growth|outreach|sales|promo|traffic|backlink|ranking)/i;

/* http(s)://…, www.…, or a bare domain such as example.io in the text. */
const URL_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(com|net|org|io|co|ai|biz|info|xyz|site|online|top|app|agency|marketing|digital|ly|me|us)\b(\/\S*)?/gi;

function countUrls(text) {
  const found = String(text).match(URL_RE) || [];
  /* The VCOH site itself or a partner may be mentioned by a real visitor. */
  return found.filter((u) => !/vtcomfortsofhome|uvs-vt|lincolnstreetinc/i.test(u)).length;
}

function spamCheck(f) {
  const name = String(f.name || "");
  const email = String(f.email || "");
  const message = String(f.message || "");
  const all = name + "\n" + message;
  const reasons = [];
  let score = 0;
  let sure = false; /* at least one signal a real inquiry wouldn't have */

  STRONG.forEach((re) => {
    if (re.test(all)) { score += 3; sure = true; reasons.push("phrase:" + re.source.slice(0, 40)); }
  });

  let weak = 0;
  WEAK.forEach((re) => { if (re.test(all)) weak += 1; });
  if (weak) { score += Math.min(weak, 4); reasons.push("words:" + weak); }

  const urls = countUrls(all);
  if (urls === 1) { score += 1; reasons.push("url:1"); }
  else if (urls >= 2) { score += 3 + Math.min(urls - 2, 3); sure = true; reasons.push("urls:" + urls); }

  if (countUrls(name) || /https?:|www\./i.test(name)) { score += 4; sure = true; reasons.push("url_in_name"); }

  if (email && SENDER.test(email)) { score += 2; reasons.push("sender"); }

  /* Mostly non-letters or one long run of capitals, typical of junk bots. */
  const letters = (message.match(/\p{L}/gu) || []).length;
  if (message.length > 40 && letters / message.length < 0.4) { score += 2; reasons.push("symbols"); }

  /* Weak words, one link and the sender address can add up, but never block
     on their own: a sales phrase or a pile of links has to be there too. */
  return { spam: sure && score >= SPAM_SCORE, score, reasons };
}

module.exports = { spamCheck, SPAM_SCORE };
