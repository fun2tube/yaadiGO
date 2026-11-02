import LegalDoc from "@/components/legal-doc";
import { ORG_LEGAL_NAME, CONTACT } from "@/lib/site";

// NOTE: this is an honest description of what the site actually does with
// data, written against India's DPDP Act 2023 vocabulary. Have it reviewed by
// a lawyer before launch, and re-check it whenever the enquiry pipeline
// changes (see src/app/actions/enquiry.js).

export const metadata = {
  title: "Privacy Policy",
  description:
    "How YaadiGo Networks Pvt Ltd collects, uses, shares and retains personal data from this website and from travel bookings.",
  alternates: { canonical: "/privacy" },
};

const replyTo = CONTACT.email ?? CONTACT.corporateEmail;

const sections = [
  {
    heading: "What we collect",
    paragraphs: [
      "From this website, we only collect what you type into an enquiry form: your name, phone number, and — if you choose to give them — your email address, destination, travel dates, group size, budget band, interests, and any free-text note you add.",
      "If you go on to book a trip, we collect what the booking itself requires: traveller names as they appear on ID, dates of birth where an airline or hotel demands them, ID or passport details for ticketing and visa processing, and billing details including a GSTIN for corporate invoices.",
    ],
  },
  {
    heading: "Why we collect it",
    list: [
      "To respond to your enquiry and prepare an itinerary — this is the only reason website form data is collected.",
      "To make and hold the bookings you approve, which requires passing traveller details to airlines, hotels, transport operators and visa authorities.",
      "To issue invoices and meet tax and accounting obligations, including GST filings.",
      "To contact you about a trip you have booked, including changes, delays and on-trip support.",
    ],
  },
  {
    heading: "What we do not do",
    paragraphs: [
      "We do not sell personal data. We do not share your details with third parties for their own marketing. We do not add you to a marketing list because you filled in an enquiry form — marketing email only goes to people who separately ask for it.",
    ],
  },
  {
    heading: "Who we share it with",
    paragraphs: [
      "Only the parties needed to deliver what you booked: airlines, hotels, ground transport operators, insurers, visa processing partners, and our booking platform partners. Each receives the minimum needed for their part of the trip.",
      "We also use ordinary business infrastructure — web hosting, email, and a customer relationship system — which necessarily processes this data on our behalf under contract.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "Enquiries that never become bookings are kept for up to 24 months so we can pick up a conversation where it left off, and then deleted. Booking and invoice records are kept for as long as Indian tax and company law requires, which is currently eight years from the end of the relevant financial year.",
    ],
  },
  {
    heading: "Cookies and analytics",
    paragraphs: [
      "This website does not set advertising or tracking cookies. Fonts are loaded from Google Fonts, which means your browser makes a request to Google's servers to fetch them; no identifier is set by us in that request.",
    ],
  },
  {
    heading: "Your rights",
    paragraphs: [
      "Under India's Digital Personal Data Protection Act, 2023, you can ask us for a summary of the personal data we hold about you, ask us to correct or complete it, ask us to erase it where we are not required to keep it, and withdraw a consent you previously gave. You can also nominate someone to exercise these rights on your behalf.",
      "We will respond to any such request within 30 days. If you are not satisfied with the outcome, you may escalate to the Data Protection Board of India.",
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "Data is transmitted over encrypted connections and access is limited to the staff who need it to do their job. No system is perfect, and we will tell you and the relevant authority if a breach affects your data.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "When this policy changes materially, we will update the date at the top of this page. Continuing to use the site after that date means the updated policy applies.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      replyTo
        ? `Questions about this policy, or a request about your data, go to ${replyTo}, addressed to the Grievance Officer, ${ORG_LEGAL_NAME}.`
        : `Questions about this policy, or a request about your data, go to the Grievance Officer, ${ORG_LEGAL_NAME}, at our registered office.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      eyebrow="Legal"
      title="Privacy Policy"
      intro={`This policy explains what ${ORG_LEGAL_NAME} does with personal data collected through this website and through the trips we arrange. It is written to be read, not to be survived.`}
      sections={sections}
    />
  );
}
