/**
 * Visitor analytics: the browser half (the server half is src/app/api/t).
 *
 * First-party and anonymous, by the owner's decision (docs/design/
 * ai-cofounder.md §7): two random ids, no recordings, no third parties.
 *
 *   visitor id   localStorage, so a returning browser counts as returning
 *   visit id     rotates after 30 minutes without activity; also written to a
 *                `yg_sid` cookie so the enquiry form's server action can tie
 *                a lead to the visit that produced it (lib/analytics/visit.js)
 *
 * Next runs this file before hydration and calls onRouterTransitionStart on
 * every client-side navigation. Everything is fire-and-forget and wrapped:
 * analytics must never break the page it is measuring.
 */

const ENDPOINT = "/api/t";
const VISIT_GAP_MS = 30 * 60 * 1000;
const SKIP = /^\/(admin|api|pdf)(\/|$)/;

let page = null; // { pid, path, visibleMs, visibleSince, maxScroll }

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: ids just last for this page.
  }
  return null;
}

let memoryVisitor = null;
let memoryVisit = null;

function visitor() {
  let id = store("yg_vid");
  const isNew = !id;
  if (!id) {
    id = memoryVisitor ?? uuid();
    memoryVisitor = id;
    store("yg_vid", id);
  }
  return { id, isNew };
}

/** The current visit, or a new one after 30 quiet minutes. */
function visit() {
  const now = Date.now();
  let current = null;
  try {
    current = JSON.parse(store("yg_visit") ?? "null");
  } catch {
    current = null;
  }
  current ??= memoryVisit;
  const fresh = !current || now - current.last > VISIT_GAP_MS;
  if (fresh) current = { id: uuid(), last: now };
  current.last = now;
  memoryVisit = current;
  store("yg_visit", JSON.stringify(current));
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `yg_sid=${current.id}; Path=/; Max-Age=${VISIT_GAP_MS / 1000}; SameSite=Lax${secure}`;
  return { id: current.id, fresh };
}

function send(body) {
  try {
    const data = JSON.stringify(body);
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, data))) {
      fetch(ENDPOINT, { method: "POST", body: data, keepalive: true }).catch(() => {});
    }
  } catch {
    // Never surface.
  }
}

function scrollPercent() {
  const doc = document.documentElement;
  const height = Math.max(doc.scrollHeight, 1);
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / height) * 100));
}

function visibleTime() {
  if (!page) return 0;
  return page.visibleMs + (page.visibleSince ? Date.now() - page.visibleSince : 0);
}

/** Report time and depth for the current page. Safe to call repeatedly. */
function flush() {
  if (!page) return;
  // Measured again here: a scroll then an immediate click can leave before
  // the scroll event is handled. At navigation start the old page is still
  // the one on screen, so this reads the right document.
  page.maxScroll = Math.max(page.maxScroll, scrollPercent());
  send({ t: "leave", sid: memoryVisit?.id, pid: page.pid, dur: visibleTime(), scroll: page.maxScroll });
}

function startPage(path, search, referrer) {
  flush();
  page = null;
  if (SKIP.test(path)) return;
  const v = visitor();
  const { id: sid } = visit();
  page = { pid: uuid(), path, visibleMs: 0, visibleSince: document.hidden ? null : Date.now(), maxScroll: 0 };
  let tz = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    tz = null;
  }
  send({
    t: "pv",
    vid: v.id,
    sid,
    pid: page.pid,
    path,
    search,
    ref: referrer || null,
    newVisitor: v.isNew,
    tz,
    lang: navigator.language ?? null,
  });
  // The first paint of a short page is already "fully scrolled".
  requestAnimationFrame(() => {
    if (page) page.maxScroll = Math.max(page.maxScroll, scrollPercent());
  });
}

function onScroll() {
  if (page) page.maxScroll = Math.max(page.maxScroll, scrollPercent());
}

function onVisibility() {
  if (!page) return;
  if (document.hidden) {
    page.visibleMs = visibleTime();
    page.visibleSince = null;
    flush();
  } else {
    // Back after a long break: that is a new visit to this page.
    const quiet = memoryVisit && Date.now() - memoryVisit.last > VISIT_GAP_MS;
    if (quiet) startPage(location.pathname, location.search, "");
    else page.visibleSince = Date.now();
  }
}

const EVENT_FOR = [
  [/^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\b|^whatsapp:/i, "whatsapp_clicked"],
  [/^tel:/i, "call_clicked"],
  [/^mailto:/i, "email_clicked"],
];

function onClick(event) {
  const link = event.target?.closest?.("a[href]");
  if (!link || !page) return;
  const href = link.getAttribute("href") ?? "";
  let name = EVENT_FOR.find(([pattern]) => pattern.test(href))?.[1] ?? null;
  const props = {};
  if (!name) {
    try {
      const url = new URL(href, location.href);
      if (/^https?:$/.test(url.protocol) && url.hostname !== location.hostname) {
        name = "outbound_clicked";
        props.host = url.hostname;
      }
    } catch {
      return;
    }
  }
  if (!name) return;
  // What the link said, so "which WhatsApp button" is answerable.
  const label = (link.getAttribute("aria-label") || link.textContent || "").trim().slice(0, 80);
  if (label) props.label = label;
  visit();
  send({ t: "ev", sid: memoryVisit?.id, name, path: location.pathname, props });
}

try {
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  document.addEventListener("click", onClick, { capture: true });
  startPage(location.pathname, location.search, document.referrer);
} catch {
  // Analytics must never break the page.
}

export function onRouterTransitionStart(url) {
  try {
    const next = new URL(url, location.href);
    // A filter or a #section on the same page is not a new page.
    if (page && next.pathname === page.path) return;
    if (!page && SKIP.test(next.pathname)) return;
    startPage(next.pathname, next.search, location.href);
  } catch {
    // Never break navigation.
  }
}
