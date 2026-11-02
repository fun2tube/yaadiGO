// Posts are authored newest-last here and sorted for display by
// sortedPosts(); `date` is an ISO date and feeds the Article schema.
//
// WHAT BELONGS HERE — decision queries, not destination guides.
//
// "Top 10 Places in Kerala" is written by everyone and ranks for nobody. The
// queries with actual buying intent behind them are comparisons and timing
// questions — "Ladakh in June or September", "Andaman or Maldives" — because
// somebody asking those has already decided to go and is choosing between two
// things we sell. They are also close to uncontested.
//
// Every post therefore has to do three things:
//   1. Commit to a recommendation. A page that lists both sides and shrugs is
//      the reason the reader is on their fifth tab.
//   2. Carry the failure case. A recommendation without its downside is an ad.
//      That is what the `note` block is for.
//   3. Answer the spoken form of the question in `faqs`, which emits FAQPage
//      schema — the markup that decides whether an assistant can quote us when
//      somebody asks this out loud.
//
// A `body` entry is a string (paragraph), { h }, { list } or { note }.

export const posts = [
  {
    slug: "gst-input-tax-credit-corporate-travel",
    date: "2026-09-08",
    title: "Why most Indian companies leave GST input tax credit on the table when booking travel",
    excerpt:
      "A practical look at where ITC actually gets lost in corporate travel invoicing, and what a finance team can check this quarter.",
    body: [
      "Most finance teams assume that once a vendor invoice says \"GST included,\" the input tax credit is automatically theirs to claim. In practice, a meaningful share of that credit gets lost — not through fraud, just through invoice formats that don't hold up against GSTR-2B matching, or bookings routed through an aggregator whose GSTIN doesn't line up with the paying entity.",
      "The two most common leak points we see: hotel invoices billed to the traveller's name instead of the company GSTIN, and flight bookings made through a personal account rather than the corporate travel desk's registered account. Both are fixable before the booking happens — much harder to fix after the trip is over and the invoice is already filed.",
      "This is part of why we send a quarterly ITC summary to the finance teams we work with, rather than just handing over a stack of PDFs at month-end and calling it done.",
    ],
  },
  {
    slug: "kashmir-vs-himachal-october",
    date: "2026-09-16",
    title: "Kashmir or Himachal in October — which one should you actually book?",
    excerpt:
      "Weather windows, crowd levels, and price differences, based on what our own group departures have seen this season.",
    body: [
      "Both destinations are genuinely good in October, and the honest answer depends on what you're optimizing for. Kashmir in early-to-mid October still has clear valley views and thinner crowds than the summer peak, but Gulmarg's Gondola Phase 2 is weather-dependent and can close on short notice once temperatures drop.",
      "Himachal — specifically the Shimla-Manali corridor — runs a more predictable October, with the monsoon fully cleared by the first week and snow still weeks away at Solang. Group departures in this window have run without a single reroute the last two seasons.",
      "If the priority is a guaranteed itinerary with no weather-driven changes, Himachal is the safer late-October pick. If the priority is Kashmir specifically and the group can tolerate a Plan B on Gondola Phase 2, early October still delivers.",
    ],
  },
  {
    slug: "planning-company-offsite-checklist",
    date: "2026-08-27",
    title: "A working checklist for planning a company offsite without three weeks of back-and-forth",
    excerpt:
      "What we ask for on day one, why fixed-price offsite packages save real time, and where teams usually get stuck.",
    body: [
      "The single biggest time sink in offsite planning is the open-ended brief — \"something fun for 30 people, budget flexible.\" It sounds like flexibility, but it means every vendor quote starts from zero, and every round of feedback resets the clock.",
      "What actually speeds things up: team size, a hard budget band per person, and a theme picked from a short list (relaxed/bonding, high-energy/adventure, or a working offsite with a few structured sessions). From there, a fixed-price package can be quoted same-day, because the vendor relationships and logistics are already in place — the same ones we use for Group Tours.",
      "Where teams still get stuck even with a good brief: date flexibility. A fixed departure format only works if the dates have some give — locking a specific weekend before checking venue availability is the most common reason a first-choice offsite falls through.",
    ],
  },

  // ---------------------------------------------------------------- Decision queries

  {
    slug: "ladakh-june-or-september",
    date: "2026-09-20",
    title: "Ladakh in June or September — the honest difference",
    excerpt:
      "Snow walls and long days, or empty roads and the clearest skies of the year. Both work. They are not the same trip.",
    body: [
      "This is the question we get more than any other, and most answers online dodge it by saying \"both are great.\" They are — but they produce genuinely different holidays, and picking the wrong one for your group is the difference between the trip you wanted and the trip you got.",

      { h: "June — the dramatic one" },
      "June is Ladakh at its most photogenic and its most crowded. The high passes have usually opened within the last few weeks, which means the road to Khardung La and Chang La can still be cut through standing walls of snow. Days are long. Nights are cold but survivable without serious gear.",
      "It is also peak season. Pangong and Nubra are busy, the better guesthouses book out months ahead, and prices sit at their highest.",
      {
        note:
          "June road conditions are the least predictable part of a Ladakh trip. Snowmelt means water crossings on the Manali–Leh highway that can be shin-deep by afternoon, and a pass that was open on Tuesday can shut on Thursday. Opening dates move by two to three weeks year to year — anyone quoting you an exact date in advance is guessing.",
      },

      { h: "September — the clear one" },
      "September is the quieter, sharper trip. Ladakh sits in the rain shadow so it never gets a real monsoon, but the tail end of the season elsewhere still leaves September skies noticeably clearer than June's. The crowds thin from the first week. The valleys turn gold.",
      "The trade is cold. Nights drop hard, especially at Pangong, and by late September you are watching the calendar — the Manali–Leh highway typically closes for the winter through October, and camps start shutting before the road does.",

      { h: "So which one" },
      "For most people, September.",
      "You get the same landscape with a fraction of the people, better light, more reliable roads and lower prices. The only reason to choose June over it is if you specifically want snow on the passes, or you are travelling with people — small children, older parents — who will genuinely struggle with cold nights.",
      { h: "What actually decides the trip, either month" },
      {
        list: [
          "Fly into Leh rather than driving in, and give the first 48 hours to doing nothing. Altitude sickness ruins more Ladakh trips than weather does.",
          "Budget a spare day. One closed pass should not collapse the itinerary.",
          "Book Pangong accommodation early in both months — it is the single tightest bottleneck in Ladakh.",
          "Carry more warm layers than you think you need in September, and more sun protection than you think you need in June.",
        ],
      },
      "Our Ladakh High Passes departures run across both windows, and the itinerary is written with the acclimatisation days and the spare day already in it — not added after somebody gets ill.",
    ],
    faqs: [
      {
        q: "Is Ladakh better in June or September?",
        a: "September, for most travellers. You get clearer skies, far fewer people, more reliable road conditions and lower prices than June. Choose June instead if you specifically want snow on the high passes, or if your group would struggle with September's cold nights.",
      },
      {
        q: "How cold is Ladakh in September?",
        a: "Comfortable in the day and genuinely cold at night, particularly at Pangong Lake where it can drop to around freezing. Days in Leh are mild enough for a single layer; nights need a proper jacket regardless of what the daytime felt like.",
      },
      {
        q: "When do the Ladakh passes open?",
        a: "Usually between late May and mid June, but the date moves by two to three weeks from year to year depending on snowfall. Nobody can tell you the exact date in advance — plan a spare day rather than a precise plan.",
      },
      {
        q: "Do I need to worry about altitude sickness in Ladakh?",
        a: "Yes, and it affects more trips than weather does. Leh sits at roughly 3,500m. Fly in rather than driving, spend the first two days doing very little, drink more water than feels necessary, and do not go straight to Pangong or Nubra on arrival.",
      },
    ],
  },

  {
    slug: "andaman-or-maldives-honeymoon",
    date: "2026-09-23",
    title: "Andaman or Maldives for a honeymoon — where the money actually goes",
    excerpt:
      "One is a resort you barely leave. The other is a place you explore. The price gap is real, and so is the reason for it.",
    body: [
      "These two get compared constantly because they photograph similarly and cost very differently. The photographs are misleading. They are not competing versions of the same holiday.",

      { h: "The Maldives is a resort, not a country you travel in" },
      "You fly to Malé, transfer to one island, and that island is your holiday. Some are extraordinary. But the model is deliberate: one resort, one beach, one set of restaurants, for the whole stay. Leaving is a seaplane, not a taxi.",
      "That is the appeal, if what you want is to do nothing beautifully. It is also the limitation.",

      { h: "The Andamans is a place you move through" },
      "Port Blair, Havelock, Neil — connected by ferry, with genuinely different days on each. Radhanagar is among the best beaches in Asia by any measure. There is scuba worth doing properly, and there is history at the Cellular Jail that most itineraries rush and shouldn't.",
      "It costs meaningfully less, it is domestic so there is no visa question, and there is simply more to do.",
      {
        note:
          "The Andamans' weak point is the ferries. Inter-island crossings can be rough, and they do get cancelled in bad weather — which compresses an itinerary that had no slack in it. Book the ferry legs with a buffer day, and if anyone in the pair gets seasick, take that seriously when picking the crossing times.",
      },

      { h: "Where the money actually goes" },
      {
        list: [
          "In the Maldives you are paying for exclusivity and the overwater villa — a private setting, and the transfer infrastructure to reach it.",
          "In the Andamans you are paying for travel and activities, not for isolation. The hotels are good rather than extraordinary.",
          "A Maldives week typically runs several times an Andamans week for the same number of nights.",
        ],
      },

      { h: "So which one" },
      "If the honeymoon you want is closing the door on the world for a week and doing genuinely nothing — Maldives, and do not try to economise your way into it, because a cheap Maldives trip is just an expensive Andamans trip with less to do.",
      "For everyone else, the Andamans. More happens, it costs far less, and the beach at Radhanagar is not a compromise on anything.",
    ],
    faqs: [
      {
        q: "Is Andaman cheaper than Maldives?",
        a: "Significantly, usually several times cheaper for a comparable number of nights. The Maldives premium buys a private resort island and the seaplane or speedboat transfer to reach it; the Andamans spends that money on activities and island-hopping instead.",
      },
      {
        q: "Which is better for a honeymoon, Andaman or Maldives?",
        a: "The Maldives if you want to do nothing in privacy for a week. The Andamans if you want beaches plus things to actually do — scuba, island-hopping and history — at a much lower cost.",
      },
      {
        q: "Do Indians need a visa for the Maldives?",
        a: "The Maldives has generally offered visa on arrival to Indian passport holders, but entry rules change — confirm the current requirement before booking. The Andamans is domestic Indian travel and needs no visa at all.",
      },
    ],
  },

  {
    slug: "kerala-honeymoon-backwaters-or-hills",
    date: "2026-09-26",
    title: "Kerala honeymoon: backwaters or hills? The mistake most itineraries make",
    excerpt:
      "The answer is usually both — but in a specific order, and with far less houseboat time than you have been sold.",
    body: [
      "Nearly every Kerala honeymoon itinerary offers the same three pieces — Munnar, Thekkady, Alleppey — and nearly every one of them gets the proportions wrong.",

      { h: "The houseboat is a one-night experience" },
      "A night on an Alleppey houseboat is genuinely lovely. The sunset, the stillness, dinner cooked on board. It is also, by the second day, a small space you cannot leave, moving slowly past scenery you have already seen.",
      "Two-night houseboat packages sell well because they sound generous. They are the most common regret we hear about a Kerala trip.",

      { h: "The hills need longer than they get" },
      "Munnar's tea country is the part people remember, and it is almost always given a single rushed night. The drives up are winding and slow — that is the real cost of Munnar, not the distance on the map.",
      {
        note:
          "The road to Munnar is several hours of continuous hairpins. If either of you gets motion sick, this is the single most important thing to plan around: travel it in the morning, sit in front, and do not schedule anything demanding for the evening you arrive.",
      },

      { h: "The order matters more than people think" },
      "Do the hills first and the backwaters last.",
      "Hills first means you do the tiring travel while you are fresh, and the winding roads on day two rather than day six. Backwaters last means the trip ends slow and flat and warm, which is the note you want to go home on. The reverse — backwaters first — front-loads the rest and then asks you to do five hours of hairpins at the end of your honeymoon.",

      { h: "A shape that works" },
      {
        list: [
          "Two nights Munnar — enough to see the estates properly rather than photograph them from the car.",
          "One night Thekkady, or skip it entirely if you are short on days. It is the most droppable stop.",
          "One night on the houseboat. One.",
          "Two or three nights somewhere on the coast to finish — Marari or Kovalam.",
        ],
      },
      "October to March is the window. It is worth being firm about that: Kerala in heavy monsoon is atmospheric if you like rain and disappointing if you were expecting beaches.",
    ],
    faqs: [
      {
        q: "How many nights should I spend on a Kerala houseboat?",
        a: "One. A single night on the backwaters is the experience; a second night is a small space you cannot leave, passing scenery you have already seen. Two-night houseboat packages are the most common regret we hear about Kerala trips.",
      },
      {
        q: "What is the best time to visit Kerala for a honeymoon?",
        a: "October to March. The weather is dry and comfortable, and the backwaters and beaches are at their best. Heavy monsoon months are atmospheric if you like rain but poor for a beach-focused trip.",
      },
      {
        q: "Should I visit Munnar or Alleppey first?",
        a: "Munnar first. The hills involve several hours of hairpin roads, and you want that behind you early while you are fresh. Ending on the backwaters and the coast lets the trip finish slow and flat rather than with a long, winding drive.",
      },
    ],
  },

  {
    slug: "spiti-or-ladakh-first-time",
    date: "2026-09-28",
    title: "Spiti or Ladakh, if you have only done one Himalayan trip",
    excerpt:
      "They look alike in photographs and are very different to travel. One of them is much more forgiving of a first attempt.",
    body: [
      "Both are high-altitude cold desert. Both have monasteries on cliffs and roads that feel improbable. If you have never done either, they are not equally good places to start.",

      { h: "Ladakh is the forgiving one" },
      "The decisive difference is that Ladakh has an airport. You can fly into Leh, spend two days acclimatising properly at 3,500m before going anywhere, and build the trip outward from a town with real hotels, real hospitals and reliable food.",
      "That single fact removes most of what goes wrong on a first Himalayan trip.",

      { h: "Spiti makes you earn it" },
      "There is no flying into Spiti. You come in over land — long days on roads that are genuinely hard, gaining altitude as you go, which is exactly the pattern that causes altitude sickness. Stays are simple, often homestays. Connectivity is patchy by design of the geography.",
      "The reward is a valley with a fraction of the visitors, and villages like Kibber and Langza that still feel unvisited in a way Ladakh's headline sights no longer do.",
      {
        note:
          "The overland approach is the whole risk. Driving in means ascending faster than your body would like, over several consecutive long days, far from medical help. It is manageable with the right itinerary and genuinely unpleasant without one — this is not a route to improvise.",
      },

      { h: "So which one" },
      "Ladakh first.",
      "Fly in, acclimatise properly, and find out how your body handles altitude somewhere with infrastructure around you. If you love it, Spiti is the natural second trip and it will feel like the reward it is.",
      "Go to Spiti first only if you have done high altitude before, you actively want the rougher version, and you have the days to do the approach slowly.",
      { h: "Practical differences" },
      {
        list: [
          "Getting there — Ladakh: fly to Leh in about ninety minutes from Delhi. Spiti: two to three days of driving, whichever way you come in.",
          "Stays — Ladakh has hotels across every budget. Spiti is homestays and simple guesthouses, and that is part of the point.",
          "Season — Ladakh's main window is roughly June to September. Spiti's road access is narrower still and the Kunzum side closes early.",
          "Days needed — Ladakh works in seven. Spiti really wants nine or ten, because the travel days are unavoidable.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is Spiti or Ladakh better for a first Himalayan trip?",
        a: "Ladakh. You can fly into Leh and acclimatise for two days before travelling anywhere, in a town with real hotels and medical facilities. Spiti can only be reached overland, which means gaining altitude fast over several long driving days — a harder first experience.",
      },
      {
        q: "How many days do I need for Spiti?",
        a: "Nine to ten. The overland approach takes two to three days in each direction and cannot be shortened safely, so a seven-day Spiti trip is mostly driving.",
      },
      {
        q: "Which is harder, Spiti or Ladakh?",
        a: "Spiti, clearly. Longer road journeys, simpler accommodation, patchier connectivity, and an overland ascent that makes altitude sickness more likely than flying into Leh does.",
      },
    ],
  },

  {
    slug: "vietnam-or-thailand-first-trip-abroad",
    date: "2026-09-29",
    title: "Vietnam or Thailand for a first trip abroad from India",
    excerpt:
      "Both are easy, cheap and close. The right one depends almost entirely on how many days you actually have.",
    body: [
      "For a lot of Indian travellers this is the first passport stamp, and the two get shortlisted together for good reason: short flights, low costs on the ground, and neither demands much planning experience.",

      { h: "Thailand is the easier first step" },
      "More direct flights from more Indian cities. Tourist infrastructure that has been absorbing first-time travellers for forty years. English widely spoken in the places you will be. Indian food available almost everywhere, which matters more to more people than they admit before they travel.",
      "Bangkok plus one island is a complete, satisfying week and needs almost no planning.",

      { h: "Vietnam rewards more days" },
      "Vietnam is cheaper on the ground and considerably more varied — the north around Hanoi and Ha Long is a different country from the Mekong Delta in the south. That variety is the appeal and also the catch: the country is long, and seeing both ends means internal flights or long overnight trains.",
      "In six days you will see one third of Vietnam and spend a lot of it in transit. In ten you will have a genuinely rich trip that Thailand cannot match for the money.",
      {
        note:
          "Visa rules for both countries have changed repeatedly for Indian passport holders in recent years, in both directions. Whatever you read — including here — confirm the current requirement before you book anything.",
      },

      { h: "So which one" },
      {
        list: [
          "Five to seven days — Thailand. Less transit, less planning, more actual holiday.",
          "Eight days or more — Vietnam. The variety pays off and the value is better.",
          "Travelling with parents or young children — Thailand, for the infrastructure and the food.",
          "Second trip abroad and you want something that feels less packaged — Vietnam.",
        ],
      },
      "Our Vietnam itinerary runs north to south precisely because that is the split people underestimate — it is built around the internal legs rather than pretending they are not there.",
    ],
    faqs: [
      {
        q: "Is Vietnam or Thailand better for a first international trip from India?",
        a: "Thailand if you have a week or less — more direct flights, easier infrastructure and far less internal travel. Vietnam if you have eight days or more, where the variety and the lower on-ground costs pay off properly.",
      },
      {
        q: "Is Vietnam cheaper than Thailand?",
        a: "On the ground, generally yes — food, stays and local transport cost less in Vietnam. The saving narrows once you add the internal flights needed to see both the north and the south.",
      },
      {
        q: "How many days do you need for Vietnam?",
        a: "At least eight, ideally ten. Vietnam is a long country, and seeing both the north around Hanoi and the south around Ho Chi Minh City means internal flights or overnight trains that a shorter trip cannot absorb.",
      },
    ],
  },
];

export function getPostBySlug(slug) {
  return posts.find((p) => p.slug === slug);
}

/** Posts newest first — what every listing should render. */
export function sortedPosts() {
  return [...posts].sort((a, b) => b.date.localeCompare(a.date));
}

/** "16 September 2026" — the form used across the blog. */
export function formatPostDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
