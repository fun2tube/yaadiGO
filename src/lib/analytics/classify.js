/**
 * How a visit is labelled — pure functions, decided once on arrival so every
 * report and every answer the agent gives groups traffic the same way.
 *
 * Channels, in the order they are tested:
 *
 *   paid      a click id (gclid, fbclid…) or utm_medium cpc/ppc/paid
 *   email     utm_medium email / newsletter
 *   ai        a referrer that is an AI assistant (ChatGPT, Perplexity…)
 *   organic   a search engine referrer
 *   social    a social network or messenger
 *   referral  any other site
 *   direct    no referrer at all, or our own site
 *
 * A UTM tag wins over the referrer for the SOURCE name, because the person
 * who tagged the link knows better than a referrer header which campaign it
 * was.
 */

const SEARCH = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)search\.yahoo\.com$/, "yahoo"],
  [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
  [/(^|\.)search\.brave\.com$/, "brave"],
];

const AI = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, "chatgpt"],
  [/(^|\.)perplexity\.ai$/, "perplexity"],
  [/^gemini\.google\.com$/, "gemini"],
  [/(^|\.)copilot\.microsoft\.com$/, "copilot"],
  [/(^|\.)claude\.ai$/, "claude"],
  [/(^|\.)you\.com$/, "you"],
];

const SOCIAL = [
  [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$|^m\.facebook\.com$/, "facebook"],
  [/(^|\.)instagram\.com$|^l\.instagram\.com$/, "instagram"],
  [/(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)twitter\.com$|^t\.co$|(^|\.)x\.com$/, "x"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)quora\.com$/, "quora"],
  [/(^|\.)threads\.net$/, "threads"],
  [/^t\.me$|(^|\.)telegram\.org$/, "telegram"],
];

const CLICK_IDS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid", "li_fat_id"];

function match(host, table) {
  for (const [pattern, name] of table) if (pattern.test(host)) return name;
  return null;
}

function hostOf(referrer) {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

const clip = (value, max = 120) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
};

/**
 * @param {object} input
 * @param {string|null} input.referrer   document.referrer
 * @param {URLSearchParams} input.params the landing URL's query string
 * @param {string} input.ownHost         our host, so internal referrers read as direct
 */
export function classifySource({ referrer, params, ownHost }) {
  const utm = {
    utmSource: clip(params.get("utm_source")),
    utmMedium: clip(params.get("utm_medium")),
    utmCampaign: clip(params.get("utm_campaign")),
    utmTerm: clip(params.get("utm_term")),
    utmContent: clip(params.get("utm_content")),
  };
  const medium = (utm.utmMedium ?? "").toLowerCase();
  const own = (ownHost ?? "").toLowerCase().replace(/^www\./, "");
  let host = hostOf(referrer);
  if (host && own && (host === own || host.endsWith(`.${own}`))) host = null;

  const tagged = utm.utmSource?.toLowerCase() ?? null;
  const result = (channel, source) => ({ channel, source: tagged ?? source, referrerHost: host, ...utm });

  const clickId = CLICK_IDS.find((key) => params.has(key));
  if (clickId || /^(cpc|ppc|paid|paidsocial|paid_social|display|cpm)$/.test(medium)) {
    const byClick = { gclid: "google", gbraid: "google", wbraid: "google", fbclid: "facebook", msclkid: "bing", ttclid: "tiktok", li_fat_id: "linkedin" };
    return result("paid", byClick[clickId] ?? match(host ?? "", SEARCH) ?? match(host ?? "", SOCIAL) ?? host ?? "paid");
  }
  if (/^(email|e-mail|newsletter)$/.test(medium)) return result("email", host ?? "email");

  if (host) {
    const ai = match(host, AI);
    if (ai) return result("ai", ai);
    const search = match(host, SEARCH);
    if (search) return result("organic", search);
    const social = match(host, SOCIAL);
    if (social) return result("social", social);
    return result("referral", host);
  }
  // No referrer, but a tag: someone shared a tagged link (a WhatsApp
  // broadcast, a printed QR code). Social if the tag says so, else referral.
  if (tagged) {
    // utm_source=whatsapp is a name, not a host, so test the names too.
    const socialName = SOCIAL.some(([, name]) => name === tagged) || match(tagged, SOCIAL);
    if (/^(social|whatsapp|instagram|facebook)$/.test(medium) || socialName) return result("social", tagged);
    return result("referral", tagged);
  }
  return result("direct", "direct");
}

/** Device, browser and OS from a user agent: coarse on purpose. */
export function parseUserAgent(ua = "") {
  const s = String(ua);
  const device = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)
    ? "tablet"
    : /Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(s)
      ? "mobile"
      : "desktop";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /Firefox\//.test(s)
          ? "Firefox"
          : /Chrome\/|CriOS\//.test(s)
            ? "Chrome"
            : /Safari\//.test(s)
              ? "Safari"
              : null;
  const os = /Windows/.test(s)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(s)
      ? "iOS"
      : /Android/.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/.test(s)
          ? "macOS"
          : /Linux/.test(s)
            ? "Linux"
            : null;
  return { device, browser, os };
}

/**
 * Crawlers, link unfurlers, uptime checkers and headless browsers. They are
 * not visitors, and counting them would make every report a lie. Our own PDF
 * renderer is headless Chrome too.
 */
export function isBot(ua = "") {
  if (!ua) return true;
  return /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|slack|discord|embedly|curl|wget|python|axios|node-fetch|go-http|java\/|httpclient|monitor|uptime|pingdom|gtmetrix|semrush|ahrefs|mj12|bytespider|petalbot|dataforseo/i.test(
    ua
  );
}

/**
 * The path as stored: no query string, no trailing slash, and every share
 * token replaced. A /q/<token> URL opens a customer's quotation, so the token
 * must never land in a table the whole team (and the agent) reads.
 */
export function normalisePath(raw) {
  let path = String(raw ?? "/").split(/[?#]/)[0] || "/";
  if (!path.startsWith("/")) path = `/${path}`;
  path = path
    .replace(/^\/q\/[^/]+/, "/q/:token")
    .replace(/^\/api\/q\/[^/]+/, "/api/q/:token")
    .replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/$/, "");
  return path.slice(0, 300);
}

/** Paths that are never visitor traffic. */
export function isTrackedPath(path) {
  return !/^\/(admin|api|pdf|_next)(\/|$)/.test(path);
}
