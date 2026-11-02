import { Render } from "@measured/puck/rsc";
import { config } from "./config";

/**
 * Render a built page for a visitor.
 *
 * `@measured/puck/rsc` rather than the main entry: this is the server-only
 * renderer, so a built page is HTML on arrival — crawlable, fast, and with no
 * editor code in the visitor's bundle. Visitors never download Puck.
 *
 * `metadata` is how live data reaches a block. A block cannot fetch for itself
 * — it is a plain component rendered inside Puck's tree — so the page fetches
 * once and hands the result down. That is why the trip rail on a built page
 * shows the same real seat counts as the coded one, rather than whatever was
 * true when somebody last pressed Publish.
 */
export default function BuiltPage({ data, metadata }) {
  return <Render config={config} data={data} metadata={metadata} />;
}
