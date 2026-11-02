// Group-tour inventory.
//
// Fixed departures are the product: a trip runs on set dates and you join the
// batch, so a "trip" is really a template plus a list of DEPARTURES, each with
// its own date, price and remaining seats. Price varies by batch (peak dates
// cost more), by room sharing, and by where you join from.
//
// Replace with real inventory/CMS content — the SHAPE is what matters. When
// the admin panel and database land, this module is the seam: everything else
// reads the derived fields below.

export const ADVANCE_DEFAULT = 5000;

/** Sharing options. `delta` is per person, added to the batch price. */
export const SHARING_STANDARD = [
  { id: "triple", label: "Triple sharing", detail: "Three to a room", delta: 0 },
  { id: "double", label: "Double sharing", detail: "Two to a room", delta: 3500 },
  { id: "single", label: "Single occupancy", detail: "A room to yourself", delta: 9500 },
];

export const rawTours = [
  {
    slug: "kashmir-valley-escape",
    title: "Kashmir Valley Escape",
    destination: "Srinagar · Gulmarg · Pahalgam",
    region: "India",
    theme: "Mountains",
    duration: "6N / 7D",
    heroNote: "Shikara stays, Gondola ride, and two full days in Pahalgam.",
    groupSize: "10–16 travellers",
    ageGroup: "18–45",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "srinagar", city: "Srinagar", detail: "Join at the airport", delta: 0 },
      { id: "delhi", city: "Delhi", detail: "Includes return flight", delta: 14500 },
    ],
    departures: [
      { id: "kve-1012", start: "2026-10-12", end: "2026-10-18", price: 28500, seatsLeft: 4 },
      { id: "kve-1026", start: "2026-10-26", end: "2026-11-01", price: 28500, seatsLeft: 9 },
      { id: "kve-1109", start: "2026-11-09", end: "2026-11-15", price: 27000, seatsLeft: 14 },
      { id: "kve-1221", start: "2026-12-21", end: "2026-12-27", price: 34500, seatsLeft: 2 },
      { id: "kve-0111", start: "2027-01-11", end: "2027-01-17", price: 31000, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Srinagar", detail: "Airport pickup, houseboat check-in, evening Shikara ride on Dal Lake." },
      { day: 2, title: "Srinagar sightseeing", detail: "Mughal Gardens — Nishat, Shalimar, Chashme Shahi." },
      { day: 3, title: "Gulmarg day trip", detail: "Gondola Phase 1 & 2 (weather permitting), free time on snow." },
      { day: 4, title: "Transfer to Pahalgam", detail: "Scenic drive via Awantipora ruins, check-in Pahalgam." },
      { day: 5, title: "Pahalgam exploration", detail: "Betaab Valley, Aru Valley, Chandanwari (own expense for local cabs)." },
      { day: 6, title: "Transfer to Srinagar", detail: "Local market time, evening at leisure." },
      { day: 7, title: "Departure", detail: "Airport drop." },
    ],
    inclusions: [
      "6 nights stay (1 houseboat + 5 hotel), breakfast & dinner daily",
      "All transfers and sightseeing by private AC vehicle",
      "Gondola Phase 1 ticket",
      "All applicable toll, parking, driver allowance",
    ],
    exclusions: [
      "Flights to/from Srinagar (unless joining from Delhi)",
      "Gondola Phase 2 and other optional activities",
      "Lunches, personal expenses, tips",
      "Travel insurance",
    ],
    faq: [
      { q: "Is this a fixed group or private tour?", a: "Fixed departure — you join a small group of 10–16 travellers on the dates listed." },
      { q: "What's the group size?", a: "Typically 10–16 travellers per departure, so it stays personal without private-tour pricing." },
      { q: "Can I extend my stay?", a: "Yes — tell us at booking and we'll quote extra nights at the same hotel rates where possible." },
    ],
  },
  {
    slug: "goa-beach-weekend",
    title: "Goa Beach Weekend",
    destination: "North Goa",
    region: "India",
    theme: "Beach",
    duration: "3N / 4D",
    heroNote: "Beach-facing stay, a sunset cruise, and one full day free to explore.",
    groupSize: "12–20 travellers",
    ageGroup: "18–40",
    advanceAmount: 3000,
    sharing: SHARING_STANDARD,
    pickups: [{ id: "goa", city: "Goa", detail: "Join at the airport or Madgaon", delta: 0 }],
    departures: [
      { id: "gbw-1024", start: "2026-10-24", end: "2026-10-27", price: 13900, seatsLeft: 9 },
      { id: "gbw-1114", start: "2026-11-14", end: "2026-11-17", price: 13900, seatsLeft: 15 },
      { id: "gbw-1228", start: "2026-12-28", end: "2026-12-31", price: 21500, seatsLeft: 3 },
      { id: "gbw-0123", start: "2027-01-23", end: "2027-01-26", price: 14500, seatsLeft: 18 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Goa", detail: "Airport pickup, check-in, evening at Baga Beach." },
      { day: 2, title: "North Goa sightseeing", detail: "Fort Aguada, Chapora, Anjuna flea market (seasonal)." },
      { day: 3, title: "Free day", detail: "Optional water sports at Calangute (extra), sunset river cruise included." },
      { day: 4, title: "Departure", detail: "Airport/station drop." },
    ],
    inclusions: [
      "3 nights stay, breakfast daily",
      "Airport pickup & drop, all sightseeing transfers",
      "Sunset river cruise ticket",
    ],
    exclusions: ["Flights/train to Goa", "Water sports", "Lunch & dinner", "Personal expenses"],
    faq: [
      { q: "Is alcohol included on the cruise?", a: "One welcome drink is included; the bar is pay-as-you-go." },
      { q: "Is this suitable for families?", a: "Yes — this departure regularly has family groups alongside friend groups." },
    ],
  },
  {
    slug: "himachal-monsoon-trail",
    title: "Himachal Monsoon Trail",
    destination: "Shimla · Kufri · Manali",
    region: "India",
    theme: "Mountains",
    duration: "5N / 6D",
    heroNote: "Shimla's Mall Road, Kufri's meadows, and Solang Valley in Manali.",
    groupSize: "10–18 travellers",
    ageGroup: "18–45",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "delhi", city: "Delhi", detail: "Overnight Volvo, included", delta: 0 },
      { id: "chandigarh", city: "Chandigarh", detail: "Join en route", delta: -1500 },
    ],
    departures: [
      { id: "hmt-1108", start: "2026-11-08", end: "2026-11-13", price: 21500, seatsLeft: 6 },
      { id: "hmt-1129", start: "2026-11-29", end: "2026-12-04", price: 20500, seatsLeft: 12 },
      { id: "hmt-1227", start: "2026-12-27", end: "2027-01-01", price: 26900, seatsLeft: 1 },
      { id: "hmt-0207", start: "2027-02-07", end: "2027-02-12", price: 22500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Shimla", detail: "Check-in, evening at Mall Road & Ridge." },
      { day: 2, title: "Kufri day trip", detail: "Kufri, Fagu Valley (optional horse ride at own cost)." },
      { day: 3, title: "Transfer to Manali", detail: "Scenic drive via Kullu, riverside check-in." },
      { day: 4, title: "Solang Valley", detail: "Cable car (optional), local market evening." },
      { day: 5, title: "Manali sightseeing", detail: "Hadimba Temple, Old Manali, Vashisht hot springs." },
      { day: 6, title: "Departure", detail: "Drop to Manali bus stand / Bhuntar airport." },
    ],
    inclusions: ["5 nights stay, breakfast & dinner", "All transfers by private AC vehicle", "One bonfire evening in Manali"],
    exclusions: ["Cable car & optional activities", "Lunches", "Travel insurance"],
    faq: [
      { q: "Is this trip okay in the monsoon?", a: "Yes — this route stays mostly clear; we reroute specific days if there's a landslide advisory." },
    ],
  },
  {
    slug: "kerala-backwaters-trail",
    title: "Kerala Backwaters Trail",
    destination: "Kochi · Alleppey · Munnar",
    region: "India",
    theme: "Relaxation",
    duration: "5N / 6D",
    heroNote: "An overnight houseboat on the backwaters, then two cool days in the tea hills.",
    groupSize: "10–16 travellers",
    ageGroup: "All ages",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [{ id: "kochi", city: "Kochi", detail: "Join at the airport", delta: 0 }],
    departures: [
      { id: "kbt-1103", start: "2026-11-03", end: "2026-11-08", price: 24900, seatsLeft: 7 },
      { id: "kbt-1201", start: "2026-12-01", end: "2026-12-06", price: 24900, seatsLeft: 11 },
      { id: "kbt-1226", start: "2026-12-26", end: "2026-12-31", price: 31500, seatsLeft: 2 },
      { id: "kbt-0119", start: "2027-01-19", end: "2027-01-24", price: 25500, seatsLeft: 14 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Kochi", detail: "Fort Kochi walking tour, Chinese fishing nets at sunset." },
      { day: 2, title: "Transfer to Alleppey", detail: "Check into the houseboat by noon, cruise through the backwaters." },
      { day: 3, title: "Alleppey to Munnar", detail: "Disembark after breakfast, scenic drive up into the tea estates." },
      { day: 4, title: "Munnar sightseeing", detail: "Tea Museum, Mattupetty Dam, Echo Point." },
      { day: 5, title: "Munnar exploration", detail: "Eravikulam National Park (seasonal), local spice market." },
      { day: 6, title: "Departure", detail: "Drive to Kochi airport (approx. 4 hours)." },
    ],
    inclusions: [
      "5 nights stay (1 houseboat + 4 hotel), breakfast daily, all meals on the houseboat",
      "All transfers by private AC vehicle",
      "Tea Museum entry",
    ],
    exclusions: ["Flights to/from Kochi", "Eravikulam National Park entry", "Lunches & dinners (except on houseboat)", "Tips"],
    faq: [
      { q: "Is the houseboat air-conditioned?", a: "Yes, the cabin is AC; the upper deck (where most people spend the day) is open-air." },
      { q: "Is this trip child-friendly?", a: "Yes, though the Munnar hikes are better suited to kids over 8." },
    ],
  },
  {
    slug: "rajasthan-heritage-circuit",
    title: "Rajasthan Heritage Circuit",
    destination: "Jaipur · Jodhpur · Udaipur",
    region: "India",
    theme: "Culture",
    duration: "7N / 8D",
    heroNote: "Three cities, three forts, heritage-property stays throughout.",
    groupSize: "10–16 travellers",
    ageGroup: "All ages",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "jaipur", city: "Jaipur", detail: "Join at the airport or Junction", delta: 0 },
      { id: "delhi", city: "Delhi", detail: "Includes train to Jaipur", delta: 2500 },
    ],
    departures: [
      { id: "rhc-1115", start: "2026-11-15", end: "2026-11-22", price: 32500, seatsLeft: 5 },
      { id: "rhc-1206", start: "2026-12-06", end: "2026-12-13", price: 32500, seatsLeft: 10 },
      { id: "rhc-1224", start: "2026-12-24", end: "2026-12-31", price: 41000, seatsLeft: 0 },
      { id: "rhc-0207", start: "2027-02-07", end: "2027-02-14", price: 33500, seatsLeft: 15 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Jaipur", detail: "Check-in, evening at Bapu Bazaar." },
      { day: 2, title: "Jaipur sightseeing", detail: "Amber Fort, City Palace, Hawa Mahal (photo stop)." },
      { day: 3, title: "Transfer to Jodhpur", detail: "5-hour drive, evening free in the Blue City." },
      { day: 4, title: "Jodhpur sightseeing", detail: "Mehrangarh Fort, Jaswant Thada." },
      { day: 5, title: "Transfer to Udaipur", detail: "4.5-hour drive via Ranakpur Jain temple." },
      { day: 6, title: "Udaipur sightseeing", detail: "City Palace, boat ride on Lake Pichola." },
      { day: 7, title: "Udaipur at leisure", detail: "Optional Sajjangarh (Monsoon Palace) sunset visit." },
      { day: 8, title: "Departure", detail: "Airport drop." },
    ],
    inclusions: [
      "7 nights stay (heritage-category hotels), breakfast & dinner daily",
      "All transfers and sightseeing by private AC vehicle",
      "Lake Pichola boat ride",
      "Ranakpur temple entry",
    ],
    exclusions: ["Flights to/from Jaipur or from Udaipur", "Fort entry tickets", "Lunches", "Personal expenses"],
    faq: [
      { q: "How long are the drives between cities?", a: "4.5 to 5 hours each, with a stop roughly halfway." },
      { q: "Are the hotels actual heritage properties?", a: "Yes — converted havelis or fort-adjacent properties in each city, not generic hotels branded 'heritage.'" },
    ],
  },
  {
    slug: "andaman-island-hopper",
    title: "Andaman Island Hopper",
    destination: "Port Blair · Havelock · Neil Island",
    region: "India",
    theme: "Beach",
    duration: "5N / 6D",
    heroNote: "Radhanagar Beach, a glass-bottom boat ride, and reef snorkeling included.",
    groupSize: "10–18 travellers",
    ageGroup: "18–50",
    advanceAmount: 7500,
    sharing: SHARING_STANDARD,
    pickups: [{ id: "portblair", city: "Port Blair", detail: "Join at the airport", delta: 0 }],
    departures: [
      { id: "aih-1120", start: "2026-11-20", end: "2026-11-25", price: 34900, seatsLeft: 8 },
      { id: "aih-1211", start: "2026-12-11", end: "2026-12-16", price: 34900, seatsLeft: 13 },
      { id: "aih-1227", start: "2026-12-27", end: "2027-01-01", price: 42500, seatsLeft: 2 },
      { id: "aih-0214", start: "2027-02-14", end: "2027-02-19", price: 35900, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Port Blair", detail: "Cellular Jail Light & Sound Show in the evening." },
      { day: 2, title: "Ferry to Havelock", detail: "Check-in, evening at Radhanagar Beach for sunset." },
      { day: 3, title: "Havelock activities", detail: "Glass-bottom boat ride and snorkeling at Elephant Beach." },
      { day: 4, title: "Ferry to Neil Island", detail: "Bharatpur and Laxmanpur beaches." },
      { day: 5, title: "Return to Port Blair", detail: "Ferry back, Corbyn's Cove in the evening." },
      { day: 6, title: "Departure", detail: "Airport drop." },
    ],
    inclusions: [
      "5 nights stay, breakfast daily",
      "All inter-island ferry tickets",
      "Glass-bottom boat ride, snorkeling gear at Elephant Beach",
      "Cellular Jail Light & Sound Show ticket",
    ],
    exclusions: ["Flights to/from Port Blair", "Scuba diving (available as a paid add-on)", "Lunches & dinners", "Personal expenses"],
    faq: [
      { q: "Is scuba diving included?", a: "No, but it can be added at Havelock for an extra cost — let us know at booking." },
      { q: "How rough is the ferry crossing?", a: "Generally calm; the Havelock–Neil crossing is the shortest and smoothest of the three." },
    ],
  },
  {
    slug: "ladakh-high-passes",
    title: "Ladakh High Passes",
    destination: "Leh · Nubra · Pangong",
    region: "India",
    theme: "Mountains",
    duration: "6N / 7D",
    heroNote: "Khardung La, a night in Nubra, and Pangong at first light — with two days built in to acclimatise properly.",
    groupSize: "10–16 travellers",
    ageGroup: "18–45",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "leh", city: "Leh", detail: "Join at the airport", delta: 0 },
      { id: "delhi", city: "Delhi", detail: "Includes return flight to Leh", delta: 18500 },
    ],
    // Ladakh is a summer road. The passes are shut in winter, so there are
    // no off-season batches — saying so is more useful than pretending.
    departures: [
      { id: "lhp-0523", start: "2027-05-23", end: "2027-05-29", price: 32500, seatsLeft: 14 },
      { id: "lhp-0613", start: "2027-06-13", end: "2027-06-19", price: 34500, seatsLeft: 11 },
      { id: "lhp-0711", start: "2027-07-11", end: "2027-07-17", price: 36900, seatsLeft: 6 },
      { id: "lhp-0815", start: "2027-08-15", end: "2027-08-21", price: 36900, seatsLeft: 3 },
      { id: "lhp-0912", start: "2027-09-12", end: "2027-09-18", price: 33500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Leh — do nothing", detail: "Airport pickup and rest. At 3,500m the only sensible plan for day one is no plan; altitude sickness on day three is almost always earned on day one." },
      { day: 2, title: "Leh and around", detail: "Shanti Stupa, Leh Palace and the old town bazaar, kept deliberately gentle while you acclimatise." },
      { day: 3, title: "Sham Valley", detail: "Magnetic Hill, the Indus–Zanskar confluence at Nimmu, and Alchi monastery's 11th-century murals." },
      { day: 4, title: "Over Khardung La to Nubra", detail: "One of the highest motorable passes, then down into the Nubra dunes. Double-humped camels at Hunder in the evening." },
      { day: 5, title: "Nubra to Pangong", detail: "The long way round via Shyok — a rough road and a genuinely big day in the car." },
      { day: 6, title: "Pangong to Leh", detail: "Early start for the lake before the light goes flat, then back over Chang La." },
      { day: 7, title: "Departure", detail: "Airport drop. Flights out of Leh are almost all before noon." },
    ],
    inclusions: [
      "6 nights stay (4 Leh hotel + 1 Nubra camp + 1 Pangong camp), breakfast & dinner daily",
      "All transfers in Innova/Xylo-class vehicles with Ladakhi drivers",
      "Inner Line Permits for Nubra and Pangong",
      "Oxygen cylinder in every vehicle",
    ],
    exclusions: ["Flights to/from Leh (unless joining from Delhi)", "Camel ride at Hunder", "Lunches", "Travel insurance"],
    faq: [
      { q: "How bad is the altitude, honestly?", a: "Leh is 3,500m and Pangong is 4,350m. Most people are fine with the two acclimatisation days we build in; a minority get headaches and nausea regardless. Every vehicle carries oxygen and we can descend quickly if needed." },
      { q: "Why no winter departures?", a: "Khardung La and Chang La close under snow, and Nubra and Pangong become unreachable by road. We would rather run nothing than sell you a trip that can't go where the itinerary says." },
      { q: "Is the Pangong camp heated?", a: "Tents have thick bedding and a heater, but it still drops close to freezing at night even in July. Bring a warm layer to sleep in." },
    ],
  },
  {
    slug: "spiti-valley-circuit",
    title: "Spiti Valley Circuit",
    destination: "Shimla · Kalpa · Kaza · Chandratal",
    region: "India",
    theme: "Mountains",
    duration: "8N / 9D",
    heroNote: "The full circuit — up the Sutlej from Shimla, across Spiti, out over Kunzum to Manali. Not a soft trip.",
    groupSize: "10–14 travellers",
    ageGroup: "21–45",
    advanceAmount: 7500,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "shimla", city: "Shimla", detail: "Join at the Mall Road taxi stand", delta: 0 },
      { id: "delhi", city: "Delhi", detail: "Overnight Volvo to Shimla, included", delta: 2500 },
    ],
    departures: [
      { id: "svc-0606", start: "2027-06-06", end: "2027-06-14", price: 29500, seatsLeft: 12 },
      { id: "svc-0704", start: "2027-07-04", end: "2027-07-12", price: 31500, seatsLeft: 8 },
      { id: "svc-0808", start: "2027-08-08", end: "2027-08-16", price: 31500, seatsLeft: 2 },
      { id: "svc-0905", start: "2027-09-05", end: "2027-09-13", price: 29500, seatsLeft: 14 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Shimla", detail: "Check-in and an evening on the Ridge. The circuit starts gently on purpose — you gain 3,000m over the next five days." },
      { day: 2, title: "Shimla to Kalpa", detail: "Up the Sutlej valley through Narkanda and Rampur. First sight of Kinner Kailash from Kalpa at sunset." },
      { day: 3, title: "Kalpa to Nako", detail: "Into the rain shadow — the green stops abruptly and the landscape turns to rock. Nako lake and the old monastery." },
      { day: 4, title: "Nako to Kaza", detail: "Tabo's thousand-year-old mud monastery, then Dhankar clinging to its ridge. Kaza by evening." },
      { day: 5, title: "Kaza and the high villages", detail: "Key Monastery, Kibber, and Langza's fossil fields. Komic and Hikkim if the group is up to it." },
      { day: 6, title: "Kaza to Chandratal", detail: "Over Kunzum La to the crescent lake. Camping at 4,250m with no phone signal and no electricity." },
      { day: 7, title: "Chandratal to Manali", detail: "Down through Batal and Gramphu — the roughest road of the trip — and out via Atal Tunnel." },
      { day: 8, title: "Manali", detail: "A soft day after the circuit. Old Manali, Vashisht, and a bonfire if the weather holds." },
      { day: 9, title: "Departure", detail: "Drop to Manali bus stand or Bhuntar airport." },
    ],
    inclusions: [
      "8 nights stay (6 hotel/guesthouse + 1 Chandratal camp + 1 Manali), breakfast & dinner daily",
      "All transfers by Tempo Traveller / Innova with Spiti-experienced drivers",
      "Inner Line Permits where required",
      "Monastery entries at Tabo, Dhankar and Key",
    ],
    exclusions: ["Travel to Shimla (unless joining from Delhi)", "Lunches", "Travel insurance", "Anything at Chandratal — there is nothing to buy"],
    faq: [
      { q: "How rough are the roads really?", a: "Between Batal and Gramphu there is no road in the sense you are used to — it is riverbed and loose rock, and it takes hours. If long rough drives are a problem for you, this is not your trip." },
      { q: "Is there phone signal?", a: "Only BSNL works reliably in Spiti, and Chandratal has nothing at all. Assume you are offline from Nako onwards." },
      { q: "Why does this only run in summer?", a: "Kunzum La is under snow from October to May, which closes the circuit. A winter Spiti trip exists but it is an out-and-back to Kaza, not this." },
    ],
  },
  {
    slug: "meghalaya-living-roots",
    title: "Meghalaya Living Roots",
    destination: "Shillong · Cherrapunji · Dawki",
    region: "India",
    theme: "Mountains",
    duration: "5N / 6D",
    heroNote: "The double-decker root bridge, Dawki's glass-clear water, and the waterfalls at their post-monsoon best.",
    groupSize: "10–16 travellers",
    ageGroup: "18–45",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [{ id: "guwahati", city: "Guwahati", detail: "Join at the airport or railway station", delta: 0 }],
    departures: [
      { id: "mlr-1025", start: "2026-10-25", end: "2026-10-30", price: 23500, seatsLeft: 10 },
      { id: "mlr-1122", start: "2026-11-22", end: "2026-11-27", price: 23500, seatsLeft: 15 },
      { id: "mlr-1227", start: "2026-12-27", end: "2027-01-01", price: 28900, seatsLeft: 4 },
      { id: "mlr-0214", start: "2027-02-14", end: "2027-02-19", price: 24500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Guwahati to Shillong", detail: "Three hours up through the Khasi hills, with a stop at Umiam Lake. Evening at Police Bazaar." },
      { day: 2, title: "Shillong to Cherrapunji", detail: "Elephant Falls and Shillong Peak on the way out, then Mawkdok viewpoint, Seven Sisters Falls and Nohkalikai." },
      { day: 3, title: "Nongriat and the double-decker", detail: "Roughly 3,500 steps down to the living root bridge and the same number back up. The hardest and best day of the trip." },
      { day: 4, title: "Dawki and Mawlynnong", detail: "The Umngot river at Dawki, where the boats look like they are floating on air when the water is low, then Mawlynnong village." },
      { day: 5, title: "Mawphlang and back to Shillong", detail: "The sacred grove at Mawphlang, where nothing may be taken out — not a leaf. Evening free in Shillong." },
      { day: 6, title: "Departure", detail: "Drive back to Guwahati for afternoon flights onward." },
    ],
    inclusions: [
      "5 nights stay (3 Shillong + 2 Cherrapunji), breakfast & dinner daily",
      "All transfers by private vehicle with a Khasi-speaking driver",
      "Dawki boat ride",
      "Mawphlang sacred grove guide",
    ],
    exclusions: ["Flights to/from Guwahati", "Lunches", "Entry tickets at viewpoints", "Travel insurance"],
    faq: [
      { q: "How fit do I need to be for Nongriat?", a: "It is 3,500 steps down and back — a genuine two-to-three-hour climb on the return in humid heat. There is no alternative route and no way to skip it and still see the bridge." },
      { q: "Is Dawki's water always that clear?", a: "No. It is glass-clear in winter and after the monsoon settles, and muddy brown during and just after heavy rain. We run this trip October to February for exactly that reason." },
    ],
  },
  {
    slug: "sikkim-darjeeling-trail",
    title: "Sikkim & Darjeeling Trail",
    destination: "Gangtok · Lachung · Darjeeling",
    region: "India",
    theme: "Mountains",
    duration: "6N / 7D",
    heroNote: "Yumthang valley, Tsomgo lake, and Kanchenjunga from Tiger Hill if the morning plays along.",
    groupSize: "10–16 travellers",
    ageGroup: "18–50",
    advanceAmount: ADVANCE_DEFAULT,
    sharing: SHARING_STANDARD,
    pickups: [{ id: "bagdogra", city: "Bagdogra", detail: "Join at the airport or NJP station", delta: 0 }],
    departures: [
      { id: "sdt-1018", start: "2026-10-18", end: "2026-10-24", price: 26500, seatsLeft: 9 },
      { id: "sdt-1115", start: "2026-11-15", end: "2026-11-21", price: 25500, seatsLeft: 13 },
      { id: "sdt-1226", start: "2026-12-26", end: "2027-01-01", price: 32500, seatsLeft: 2 },
      { id: "sdt-0321", start: "2027-03-21", end: "2027-03-27", price: 27500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Bagdogra to Gangtok", detail: "Four hours along the Teesta. Evening on MG Marg, which is closed to traffic and surprisingly pleasant for it." },
      { day: 2, title: "Tsomgo Lake and Baba Mandir", detail: "Up to 3,750m for the glacial lake. Permits are checked at Tsomgo, so passports/IDs travel with you." },
      { day: 3, title: "Gangtok to Lachung", detail: "North Sikkim proper — six hours of hairpins alongside waterfalls, with a night in a Lachung guesthouse." },
      { day: 4, title: "Yumthang Valley", detail: "The valley of flowers at 3,600m, then back down to Gangtok by evening. A long day, worth it." },
      { day: 5, title: "Gangtok to Darjeeling", detail: "Across into West Bengal. Evening at Chowrasta and the Mall." },
      { day: 6, title: "Tiger Hill and Darjeeling", detail: "A 4am start for sunrise on Kanchenjunga — clear maybe three mornings in five. Then Batasia Loop, the Himalayan Zoo and a tea estate." },
      { day: 7, title: "Departure", detail: "Down to Bagdogra, roughly three hours." },
    ],
    inclusions: [
      "6 nights stay (3 Gangtok + 1 Lachung + 2 Darjeeling), breakfast & dinner daily",
      "All transfers by private vehicle",
      "Sikkim Protected Area Permits for North Sikkim and Tsomgo",
      "Tea estate visit in Darjeeling",
    ],
    exclusions: ["Flights to/from Bagdogra", "Tsomgo cable car and Tiger Hill jeep", "Lunches", "Travel insurance"],
    faq: [
      { q: "Will I actually see Kanchenjunga?", a: "Maybe. Tiger Hill is clear roughly three mornings out of five between October and March, and less often otherwise. We will not pretend otherwise to sell the trip." },
      { q: "Do I need a permit?", a: "Yes, for North Sikkim and Tsomgo — we arrange both, but you must carry original photo ID and bring passport-size photos. Foreign nationals need a separate Inner Line Permit; tell us at booking." },
    ],
  },
  {
    slug: "vietnam-north-to-south",
    title: "Vietnam North to South",
    destination: "Hanoi · Ha Long · Hoi An · Ho Chi Minh City",
    region: "International",
    theme: "Culture",
    duration: "8N / 9D",
    heroNote: "An overnight cruise on Ha Long Bay, Hoi An's lantern quarter, and the Cu Chi tunnels — with internal flights included.",
    groupSize: "12–18 travellers",
    ageGroup: "18–45",
    advanceAmount: 25000,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "delhi", city: "Delhi", detail: "Return flights included", delta: 0 },
      { id: "mumbai", city: "Mumbai", detail: "Return flights included", delta: 3500 },
      { id: "hanoi", city: "Hanoi", detail: "Land only — arrange your own flights", delta: -28000 },
    ],
    departures: [
      { id: "vns-1114", start: "2026-11-14", end: "2026-11-22", price: 89500, seatsLeft: 11 },
      { id: "vns-1205", start: "2026-12-05", end: "2026-12-13", price: 89500, seatsLeft: 7 },
      { id: "vns-1226", start: "2026-12-26", end: "2027-01-03", price: 112000, seatsLeft: 3 },
      { id: "vns-0220", start: "2027-02-20", end: "2027-02-28", price: 92500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Hanoi", detail: "Transfer to the Old Quarter. Evening walk to Hoan Kiem lake and egg coffee at one of the places that has been doing it since the 1940s." },
      { day: 2, title: "Hanoi", detail: "The Temple of Literature, Ho Chi Minh's mausoleum from the outside, and the Train Street area — which opens and closes at the authorities' discretion." },
      { day: 3, title: "Ha Long Bay", detail: "Three hours to the coast, then aboard for an overnight cruise. Kayaking and a cave stop in the afternoon." },
      { day: 4, title: "Ha Long to Hanoi, fly to Da Nang", detail: "Back ashore after brunch, transfer to Hanoi airport, and an evening flight south." },
      { day: 5, title: "Hoi An", detail: "The old town on foot — tailors, the Japanese bridge, and the lanterns after dark. A cooking class in the afternoon for anyone who wants one." },
      { day: 6, title: "Hoi An free day", detail: "An Bang beach, a Marble Mountains run, or nothing at all. Most people pick up tailoring in the evening." },
      { day: 7, title: "Fly to Ho Chi Minh City", detail: "Morning flight, afternoon at the War Remnants Museum — heavy, and the most important hour of the trip." },
      { day: 8, title: "Cu Chi tunnels", detail: "Half a day at the tunnels, then Ben Thanh market and a last evening." },
      { day: 9, title: "Departure", detail: "Transfer to Tan Son Nhat for the flight home." },
    ],
    inclusions: [
      "8 nights stay (3-4★ hotels + 1 night Ha Long cruise), breakfast daily",
      "Return international flights from Delhi or Mumbai, and both internal flights",
      "Ha Long Bay cruise with all meals aboard",
      "All transfers and listed sightseeing with English-speaking local guides",
      "Vietnam e-visa processing",
    ],
    exclusions: ["Most lunches and dinners", "Cooking class and optional activities", "Travel insurance", "Tips for guides and drivers"],
    faq: [
      { q: "Is the visa included?", a: "We process the Vietnam e-visa and the fee is included. You supply a passport with at least six months' validity and a scan — approval is the Vietnamese government's decision, not ours." },
      { q: "Can I join in Hanoi and skip the flights?", a: "Yes — pick 'Hanoi' as your joining point and the fare drops by the flight component. You are then responsible for arriving before the day-one transfer." },
      { q: "How much spending money?", a: "Budget roughly ₹2,000–2,500 a day for meals and incidentals. Vietnam is inexpensive; the tailoring in Hoi An is what actually empties wallets." },
    ],
  },
  {
    slug: "bali-slow-islands",
    title: "Bali, Slow",
    destination: "Ubud · Nusa Penida · Uluwatu",
    region: "International",
    theme: "Relaxation",
    duration: "6N / 7D",
    heroNote: "Two bases, one island day, and a deliberately empty afternoon most days. A private driver throughout.",
    groupSize: "10–16 travellers",
    ageGroup: "18–45",
    advanceAmount: 25000,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "delhi", city: "Delhi", detail: "Return flights included", delta: 0 },
      { id: "mumbai", city: "Mumbai", detail: "Return flights included", delta: 2500 },
      { id: "denpasar", city: "Denpasar", detail: "Land only — arrange your own flights", delta: -32000 },
    ],
    departures: [
      { id: "bsi-1107", start: "2026-11-07", end: "2026-11-13", price: 84500, seatsLeft: 13 },
      { id: "bsi-1212", start: "2026-12-12", end: "2026-12-18", price: 86500, seatsLeft: 8 },
      { id: "bsi-1227", start: "2026-12-27", end: "2027-01-02", price: 108000, seatsLeft: 2 },
      { id: "bsi-0306", start: "2027-03-06", end: "2027-03-12", price: 85500, seatsLeft: 16 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Denpasar, transfer to Ubud", detail: "Ninety minutes inland. Nothing scheduled — the flight in is long and everyone lands wrecked." },
      { day: 2, title: "Ubud", detail: "Tegalalang rice terraces early, before the coaches, then the Monkey Forest and the Ubud art market. Afternoon free." },
      { day: 3, title: "Waterfalls and temples", detail: "Tibumana and Tukad Cepung falls, then Tirta Empul. Sarongs are required and provided at the temple." },
      { day: 4, title: "Nusa Penida", detail: "Fast boat across for Kelingking, Broken Beach and Angel's Billabong. A long day on rough island roads." },
      { day: 5, title: "Ubud to Uluwatu", detail: "South to the cliffs. Uluwatu temple at sunset with the Kecak fire dance." },
      { day: 6, title: "Beaches and free time", detail: "Padang Padang and Melasti, or a day doing nothing by the pool. Both are respectable choices." },
      { day: 7, title: "Departure", detail: "Transfer to Denpasar." },
    ],
    inclusions: [
      "6 nights stay (4 Ubud + 2 Uluwatu), breakfast daily",
      "Return international flights from Delhi or Mumbai",
      "Private vehicle and driver for all listed days",
      "Nusa Penida fast boat and island transport",
      "Uluwatu Kecak dance tickets",
    ],
    exclusions: ["Lunches and dinners", "Visa on arrival (IDR 500,000, paid at the airport)", "Water sports and spa", "Travel insurance"],
    faq: [
      { q: "Is Nusa Penida worth the long day?", a: "The Kelingking viewpoint is genuinely one of the best in Southeast Asia. The roads are bad and the boat can be choppy — if anyone in your group gets seasick badly, take the tablets before boarding, not after." },
      { q: "Do Indians need a visa in advance?", a: "No — visa on arrival is available for Indian passport holders and costs IDR 500,000 at Denpasar. Bring a card; the counter queue is faster than the ATM." },
    ],
  },
  {
    slug: "thailand-islands-and-city",
    title: "Thailand — Islands & City",
    destination: "Bangkok · Phuket · Krabi",
    region: "International",
    theme: "Beach",
    duration: "6N / 7D",
    heroNote: "Phi Phi by speedboat, a night market crawl in Bangkok, and two beach bases with the transfers already sorted.",
    groupSize: "12–20 travellers",
    ageGroup: "18–40",
    advanceAmount: 20000,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "delhi", city: "Delhi", detail: "Return flights included", delta: 0 },
      { id: "mumbai", city: "Mumbai", detail: "Return flights included", delta: 2000 },
      { id: "bangkok", city: "Bangkok", detail: "Land only — arrange your own flights", delta: -24000 },
    ],
    departures: [
      { id: "tic-1121", start: "2026-11-21", end: "2026-11-27", price: 68500, seatsLeft: 17 },
      { id: "tic-1219", start: "2026-12-19", end: "2026-12-25", price: 74500, seatsLeft: 6 },
      { id: "tic-0116", start: "2027-01-16", end: "2027-01-22", price: 69500, seatsLeft: 14 },
      { id: "tic-0213", start: "2027-02-13", end: "2027-02-19", price: 69500, seatsLeft: 18 },
    ],
    itinerary: [
      { day: 1, title: "Arrive Bangkok", detail: "Transfer to Sukhumvit. Evening at Asiatique or a rooftop, depending on how the group is feeling." },
      { day: 2, title: "Bangkok", detail: "The Grand Palace and Wat Pho in the morning while it is bearable, Chatuchak or MBK in the afternoon, Khao San at night." },
      { day: 3, title: "Fly to Phuket", detail: "Morning flight south. Afternoon at Patong, and Bangla Road in the evening for anyone who wants it." },
      { day: 4, title: "Phi Phi by speedboat", detail: "Maya Bay, Pileh Lagoon and Bamboo Island, with snorkelling stops. A full day on the water." },
      { day: 5, title: "Phuket to Krabi", detail: "Across by road and ferry to Ao Nang. Quieter than Patong by some distance, deliberately." },
      { day: 6, title: "Four Islands tour", detail: "Chicken Island, Tup, Poda and Phra Nang cave beach by longtail. Evening free in Ao Nang." },
      { day: 7, title: "Departure", detail: "Transfer to Krabi airport for the flight home." },
    ],
    inclusions: [
      "6 nights stay (2 Bangkok + 2 Phuket + 2 Krabi), breakfast daily",
      "Return international flights and the Bangkok–Phuket internal flight",
      "Phi Phi speedboat tour and Krabi Four Islands longtail tour, with lunch on both",
      "All airport and inter-city transfers",
    ],
    exclusions: ["Most meals", "Thailand visa fee where applicable", "National park entry fees on island tours (approx. THB 400/day)", "Travel insurance", "Anything on Bangla Road"],
    faq: [
      { q: "Is Maya Bay open?", a: "It reopened with strict limits — boats cannot anchor in the bay and there are daily caps and seasonal closures. We will tell you before departure if your date falls inside a closure and swap in an alternative stop." },
      { q: "Visa for Indian passport holders?", a: "Thailand's entry rules for Indian nationals have changed several times recently. We confirm the current requirement at booking and process what is needed; the fee is not included because it keeps moving." },
    ],
  },
  {
    slug: "bhutan-overland",
    title: "Bhutan Overland",
    destination: "Paro · Thimphu · Punakha",
    region: "International",
    theme: "Culture",
    duration: "6N / 7D",
    heroNote: "Tiger's Nest, the Punakha dzong at the river confluence, and the Dochula pass on a clear morning. Overland via Phuentsholing.",
    groupSize: "10–16 travellers",
    ageGroup: "18–55",
    advanceAmount: 20000,
    sharing: SHARING_STANDARD,
    pickups: [
      { id: "bagdogra", city: "Bagdogra", detail: "Join at the airport, drive to the border", delta: 0 },
      { id: "delhi", city: "Delhi", detail: "Includes return flights to Bagdogra", delta: 16500 },
    ],
    departures: [
      { id: "bto-1011", start: "2026-10-11", end: "2026-10-17", price: 58500, seatsLeft: 8 },
      { id: "bto-1108", start: "2026-11-08", end: "2026-11-14", price: 56500, seatsLeft: 12 },
      { id: "bto-0313", start: "2027-03-13", end: "2027-03-19", price: 57500, seatsLeft: 16 },
      { id: "bto-0410", start: "2027-04-10", end: "2027-04-16", price: 59500, seatsLeft: 14 },
    ],
    itinerary: [
      { day: 1, title: "Bagdogra to Phuentsholing", detail: "Four hours to the border town. Permit formalities are done here the following morning, so this is an early night." },
      { day: 2, title: "Phuentsholing to Thimphu", detail: "Permits at the immigration office, then six hours climbing into the country. Evening at the Thimphu weekend market if the day lines up." },
      { day: 3, title: "Thimphu", detail: "The Buddha Dordenma, the Memorial Chorten, the takin preserve, and the National Textile Museum." },
      { day: 4, title: "Thimphu to Punakha", detail: "Over Dochula pass — 108 chortens, and the eastern Himalaya laid out behind them on a clear morning. Punakha Dzong in the afternoon." },
      { day: 5, title: "Punakha to Paro", detail: "The suspension bridge and Chimi Lhakhang on the way out, then across to Paro." },
      { day: 6, title: "Tiger's Nest", detail: "The climb to Taktsang — four to six hours return, steep, and the reason most people come. Rinpung Dzong afterwards if legs permit." },
      { day: 7, title: "Departure", detail: "Back down to Phuentsholing and on to Bagdogra." },
    ],
    inclusions: [
      "6 nights stay in Bhutan-government-approved 3★ hotels, all meals",
      "Sustainable Development Fee for Indian nationals",
      "Bhutan entry permits and route permits",
      "Licensed Bhutanese guide throughout and all ground transport",
    ],
    exclusions: ["Travel to Bagdogra (unless joining from Delhi)", "Horse hire at Tiger's Nest", "Alcohol", "Travel insurance"],
    faq: [
      { q: "What is the SDF and is it included?", a: "Bhutan charges a Sustainable Development Fee per night. The Indian-national rate is included in your price. If you hold a non-Indian passport the rate is considerably higher — tell us at booking and we will requote." },
      { q: "How hard is the Tiger's Nest climb?", a: "It is a steep 900m ascent taking two to three hours up, at altitude. There is a cafeteria roughly halfway that is a perfectly respectable turnaround point. Horses go as far as the cafeteria but not to the monastery." },
      { q: "Why overland and not fly into Paro?", a: "Drukair into Paro roughly doubles the trip cost. Overland via Phuentsholing is how most Indian travellers actually do Bhutan, and the drive up is genuinely good." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Derived fields
//
// Computed once at module load so every consumer — cards, listings, sitemap,
// the concierge's tools — reads the same numbers, and so a batch selling out
// updates the card, the listing and the chat in one place.
// ---------------------------------------------------------------------------

/** "12 Oct 2026". Fixed locale so server and client render identically. */
export function formatDepartureDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "12–18 Oct 2026", collapsing the month when both ends share it. */
export function formatDepartureRange(departure) {
  const start = new Date(`${departure.start}T00:00:00Z`);
  const end = new Date(`${departure.end}T00:00:00Z`);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const day = (d) => d.getUTCDate();
  const monthYear = (d) =>
    d.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
  const month = (d) => d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

  return sameMonth
    ? `${day(start)}–${day(end)} ${monthYear(end)}`
    : `${day(start)} ${month(start)} – ${day(end)} ${monthYear(end)}`;
}

/** available | filling | soldout — drives the badge and whether it can be picked. */
export function departureStatus(departure) {
  if (departure.seatsLeft <= 0) return "soldout";
  if (departure.seatsLeft <= 3) return "filling";
  return "available";
}

export const groupTours = rawTours.map((tour) => {
  const bookable = tour.departures.filter((d) => d.seatsLeft > 0);
  const next = bookable[0] ?? tour.departures[0];
  const lowest = Math.min(...tour.departures.map((d) => d.price));

  return {
    ...tour,
    departures: tour.departures.map((d) => ({ ...d, status: departureStatus(d) })),
    // Back-compatible summary fields used by cards, listings and the sitemap.
    price: lowest,
    nextDeparture: formatDepartureDate(next.start),
    seatsLeft: next.seatsLeft,
    departureCount: bookable.length,
  };
});

export function getTourBySlug(slug) {
  return groupTours.find((t) => t.slug === slug);
}

export function getDeparture(tour, departureId) {
  return tour?.departures.find((d) => d.id === departureId);
}

/**
 * What a booking actually costs.
 *
 * One function so the trip page, the sticky bar and the enquiry payload can
 * never disagree about the number — the most embarrassing bug a booking flow
 * can have is showing three different totals.
 */
export function quoteBooking({ tour, departure, sharingId, pickupId, travellers }) {
  const sharing = tour.sharing.find((s) => s.id === sharingId) ?? tour.sharing[0];
  const pickup = tour.pickups.find((p) => p.id === pickupId) ?? tour.pickups[0];

  const perPerson = departure.price + sharing.delta + pickup.delta;
  const total = perPerson * travellers;
  const advance = tour.advanceAmount * travellers;

  return {
    sharing,
    pickup,
    perPerson,
    total,
    advance,
    balance: total - advance,
    travellers,
  };
}
