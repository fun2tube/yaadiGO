import { Heading, Text, Buttons, Cards, Picture, Spacer } from "./blocks";
import { Hero, TripRail, ProofPanel, Banner } from "./sections";
import { Band, Columns } from "./containers";

/**
 * The Puck config: everything the builder is allowed to place, in the order it
 * appears in the picker.
 *
 * Deliberately short. A palette of forty blocks is how a page builder becomes
 * unusable — the editor spends longer choosing than writing, and half the
 * blocks are near-duplicates nobody can tell apart. Six blocks cover the
 * marketing site's actual shapes; more get added when a real page needs one,
 * not in anticipation.
 */
export const config = {
  components: {
    Hero,
    TripRail,
    ProofPanel,
    Banner,
    Heading,
    Text,
    Buttons,
    Cards,
    Picture,
    Spacer,
    Band,
    Columns,
  },

  // Site sections first, deliberately: those are what somebody rebuilding the
  // homepage actually reaches for, and burying them under six generic blocks
  // is how a builder ends up producing generic pages.
  categories: {
    sections: {
      title: "YaadiGo sections",
      components: ["Hero", "TripRail", "ProofPanel", "Banner"],
    },
    words: { title: "Words", components: ["Heading", "Text"] },
    actions: { title: "Actions", components: ["Buttons"] },
    layout: {
      title: "Layout",
      components: ["Band", "Columns", "Cards", "Picture", "Spacer"],
    },
  },
};

/**
 * What a page looks like before anyone has edited it.
 *
 * Empty, not a sample layout: a new page that arrives pre-filled with
 * placeholder blocks means the first job is always deleting someone else's
 * content.
 */
export const emptyPage = { content: [], root: {} };
