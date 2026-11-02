import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Crawl policy.
 *
 * The effective permissions here are IDENTICAL to the single `User-Agent: *
 * Allow: /` rule this replaced — nothing that could reach a page before is
 * blocked now. What changed is that the policy is stated rather than implied.
 *
 * Why spell out each agent when `*` already covers them: the three groups
 * below are different business decisions that happen to share an answer today.
 * Search crawlers bring clicks. AI *search* crawlers (OAI-SearchBot,
 * PerplexityBot, ClaudeBot) fetch a page to answer a question and cite it, so
 * blocking them removes YaadiGo from the surface where trip planning is
 * actually moving. AI *training* crawlers (GPTBot, Google-Extended, CCBot)
 * send no traffic back, which is a genuine argument for refusing them — and a
 * call for the business, not for code. Listed separately so that decision is
 * one line to make, with no risk of catching a search crawler by accident.
 *
 * Deliberately NO `Disallow` for /admin or /q/[token]. Both already serve
 * `noindex`, and that is the stronger control: a crawler that is blocked from
 * fetching a URL never reads the `noindex` on it, so a quotation link shared
 * onward could still surface as a bare URL in results. Blocking and
 * de-indexing pull against each other; de-indexing wins.
 */

// Crawlers that put a link in front of a person.
const SEARCH_AGENTS = ["Googlebot", "Googlebot-Image", "Bingbot", "DuckDuckBot", "Applebot"];

// Crawlers that read a page to answer someone's question, and cite it.
const AI_SEARCH_AGENTS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-User", "Applebot-Extended"];

// Crawlers that collect text to train a model. No referral traffic.
// Flip `allow` to `disallow` here if the business decides against it.
const AI_TRAINING_AGENTS = ["GPTBot", "Google-Extended", "CCBot", "Bytespider", "meta-externalagent"];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: SEARCH_AGENTS, allow: "/" },
      { userAgent: AI_SEARCH_AGENTS, allow: "/" },
      { userAgent: AI_TRAINING_AGENTS, allow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
