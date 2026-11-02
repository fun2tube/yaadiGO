import LegalDoc from "@/components/legal-doc";
import { ORG_LEGAL_NAME, CONTACT } from "@/lib/site";

// NOTE: these terms describe how the site already says the business works
// (free draft itinerary, no payment until approval, fixed departures, GST
// invoicing, prepaid corporate wallet). Have a lawyer review them, and make
// sure the cancellation windows below match what the booking confirmations
// actually say.
//
// SIGN-OFF NEEDED on the wallet section, which makes commitments finance and
// legal have to stand behind:
//   - balance does not expire
//   - refund to original source on closure, within 30 working days
//   - cancellation refunds return to the wallet by default
// These are the reasonable defaults for a prepaid wallet, not a policy anyone
// has confirmed. Change them here if the real policy differs.

export const metadata = {
  title: "Terms & Booking Conditions",
  description:
    "The terms on which YaadiGo Networks Pvt Ltd quotes, books and operates group tours, customized trips and corporate travel.",
  alternates: { canonical: "/terms" },
};

const replyTo = CONTACT.email ?? CONTACT.corporateEmail;

const sections = [
  {
    heading: "Who you are contracting with",
    paragraphs: [
      `${ORG_LEGAL_NAME} arranges travel. For most of what we sell we act as an agent between you and the airline, hotel, transport operator or activity provider who actually delivers the service. Their own terms apply alongside these, and we will tell you the material ones before you pay.`,
    ],
  },
  {
    heading: "Quotes and itineraries",
    paragraphs: [
      "A draft itinerary is free and carries no obligation on either side. Prices quoted in a draft are indicative and hold only for as long as the underlying fares and room rates hold — typically a few days, and we will say so on the quote.",
      "A booking exists only once you have confirmed it in writing and we have confirmed back that the components are held.",
    ],
  },
  {
    heading: "Payment",
    list: [
      "Leisure bookings: a deposit confirms the booking, with the balance due before departure on the date stated on your confirmation. Some components — flights, and hotels in peak season — need payment in full at the time of booking, and we will flag those individually.",
      "Corporate bookings: corporate accounts run on a prepaid wallet. You recharge the wallet, and every confirmed booking draws down against that balance. We do not offer a credit facility, and no booking is confirmed against an insufficient balance.",
      "Every invoice is issued against your GSTIN where one is supplied at the time of booking, not afterwards.",
    ],
  },
  {
    heading: "The corporate wallet",
    paragraphs: [
      "A recharge adds to your wallet balance and is held against future bookings. It is not a payment for any particular service until a booking is confirmed, and it does not expire.",
      "Each confirmed booking is deducted from the balance at the amount shown on the booking confirmation. Cancellations return whatever the supplier refunds to the wallet, less the cancellation charges set out below, unless you ask us in writing to refund it to source instead.",
      "You can see the running balance, every deduction and every recharge on your account statement. We will alert you before the balance runs low; if it is exhausted, new bookings pause until it is topped up — nothing is booked on credit.",
      "Unused balance remains your money. On account closure we refund it to the original payment source, less any supplier payments already committed on your behalf, within 30 working days.",
    ],
  },
  {
    heading: "What a quoted price includes",
    paragraphs: [
      "Only what the itinerary lists under inclusions. Anything under exclusions is at your own cost. Where an activity depends on weather, a permit, or a seasonal opening, the itinerary says so and the price does not assume it will happen.",
    ],
  },
  {
    heading: "Changes by you",
    paragraphs: [
      "Tell us as early as you can. What a change costs depends entirely on the supplier's own rules — some hotel rates are fully flexible until 48 hours before, most discounted airfares are not refundable at all. We will quote the exact cost of a change before making it, and we do not add our own fee on top of the supplier's.",
    ],
  },
  {
    heading: "Cancellation by you",
    paragraphs: [
      "Cancellation charges are whatever the suppliers apply, plus any non-recoverable payments already made on your behalf. The specific schedule for your trip is stated on your booking confirmation — read it before you pay the balance, because it is the one that governs.",
      "Refunds are paid to the original payment method once the suppliers have released the funds to us, which for airlines can take several weeks.",
    ],
  },
  {
    heading: "Changes or cancellation by us",
    paragraphs: [
      "Fixed-departure group tours run on a minimum group size. If a departure does not reach it, we will tell you at least 14 days before and offer either a transfer to another departure or a full refund.",
      "We may also reroute or substitute part of an itinerary where weather, a road closure, a permit refusal or an official advisory makes the planned version unsafe or impossible. We will keep the value and character of the trip as close to what you booked as conditions allow.",
    ],
  },
  {
    heading: "Your responsibilities",
    list: [
      "Travel documents: valid ID, passport and visas are yours to hold and yours to check. We will tell you what is needed and can process a visa application, but we cannot guarantee any government's decision.",
      "Accuracy: names must be given exactly as they appear on the ID being travelled on. Airlines charge for corrections, and some do not allow them at all.",
      "Fitness: some itineraries involve altitude, long drives or walking on uneven ground. Where that is true the itinerary says so; tell us about a medical condition that it might affect.",
      "Conduct: an operator may remove a traveller whose behaviour endangers or seriously disrupts others, without refund.",
    ],
  },
  {
    heading: "Travel insurance",
    paragraphs: [
      "We strongly recommend it and can arrange it through our partners. Uninsured cancellation, medical and baggage costs stay with you.",
    ],
  },
  {
    heading: "Liability",
    paragraphs: [
      "We are responsible for arranging your booking with reasonable care and skill. We are not liable for the acts or omissions of suppliers beyond our control, nor for events outside anyone's control — weather, natural events, strikes, civil unrest, epidemics, or government action.",
      "Nothing in these terms limits liability for death or personal injury caused by our negligence, or for fraud, and nothing here affects rights you have under the Consumer Protection Act, 2019.",
    ],
  },
  {
    heading: "Complaints",
    paragraphs: [
      "On trip, tell your point of contact or the local operator immediately — nearly everything is fixable in the moment and almost nothing is fixable a month later.",
      replyTo
        ? `Afterwards, write to us at ${replyTo} within 28 days of returning and we will respond within 14 days.`
        : "Afterwards, write to us at our registered office within 28 days of returning and we will respond within 14 days.",
    ],
  },
  {
    heading: "Governing law",
    paragraphs: [
      "These terms are governed by the laws of India, and the courts at our registered office have jurisdiction.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Terms & Booking Conditions"
      intro="These are the terms on which we quote, book and operate trips. Where a supplier's own conditions are stricter than ours — an airline's fare rules, a hotel's cancellation window — those are the ones that bite, and we will point them out before you pay."
      sections={sections}
    />
  );
}
