import "./globals.css";
import ConciergeProvider from "@/components/concierge/concierge-provider";
import PublicChrome from "@/components/public-chrome";
import AdminShell from "@/components/cms/admin-shell";
import { isAdmin } from "@/lib/cms/auth";
import { describeStorage } from "@/lib/cms/store";
import {
  SITE_URL,
  SITE_NAME,
  ORG_LEGAL_NAME,
  CONTACT,
  ADDRESS,
  socialProfiles,
  quickEnquiryHref,
} from "@/lib/site";

// Fonts are loaded via a standard Google Fonts <link> (fetched by the
// browser) rather than next/font/google, because next/font's build-time
// self-hosting needs to reach fonts.googleapis.com from the server during
// `next build`/`next dev`, which this sandbox's network policy blocks.
// Once this deploys somewhere with normal build-time internet access (e.g.
// Vercel), swap this for next/font/google — same family, self-hosted,
// no layout shift, no third-party request from the visitor's browser.

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) resolve on notched phones, which the bottom
  // bar and reel panels both depend on.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1917" },
  ],
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YaadiGo — Group Tours & Customized Trips, India and Abroad",
    template: "%s | YaadiGo",
  },
  // Under 160 so it is not cut off mid-sentence in results. Leisure-first,
  // like the homepage — corporate has its own site and its own metadata
  // (docs/design/homepage-content-strategy.md).
  description:
    "Join a small-group departure on a fixed date, or get a private trip designed around your dates and budget. Every itinerary written down before you pay.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "YaadiGo — Group Tours & Customized Trips, India and Abroad",
    description:
      "Small-group departures on fixed dates, or a private trip built around your dates and budget.",
  },
  twitter: {
    card: "summary_large_image",
    title: "YaadiGo — Group Tours & Customized Trips, India and Abroad",
    description:
      "Small-group departures on fixed dates, or a private trip built around your dates and budget.",
  },
};

// Built from lib/site.js so the structured data never advertises a phone
// number or address the site itself doesn't show — unset fields are omitted.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: SITE_NAME,
  legalName: ORG_LEGAL_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  image: `${SITE_URL}/opengraph-image`,
  ...(CONTACT.email ? { email: CONTACT.email } : {}),
  ...(CONTACT.phoneHref ?? CONTACT.phone
    ? { telephone: CONTACT.phoneHref ?? CONTACT.phone }
    : {}),
  ...(ADDRESS.street || ADDRESS.locality
    ? {
        address: {
          "@type": "PostalAddress",
          ...(ADDRESS.street ? { streetAddress: ADDRESS.street } : {}),
          ...(ADDRESS.locality ? { addressLocality: ADDRESS.locality } : {}),
          ...(ADDRESS.region ? { addressRegion: ADDRESS.region } : {}),
          ...(ADDRESS.postalCode ? { postalCode: ADDRESS.postalCode } : {}),
          addressCountry: ADDRESS.country,
        },
      }
    : {}),
  sameAs: socialProfiles(),
};

export default async function RootLayout({ children }) {
  // Gated on the server: a visitor never receives the admin bundle and
  // never learns the admin exists.
  const admin = await isAdmin();

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this
            rule targets the Pages Router's per-page _document.js; here it's
            in the App Router's ROOT layout, so it already applies site-wide */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500..900&family=JetBrains+Mono:wght@400;500;600&family=Public+Sans:wght@400..800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink font-body">
        {/* The concierge wraps the app so it survives navigation: the
            conversation is held in the provider, and the panel stays open
            while you move between pages. */}
        <ConciergeProvider>
          {children}
          {/* Customer-facing furniture: bottom tabs, WhatsApp, Yaadi.
              Excludes itself on /admin, where the CRM has its own tab bar and
              a customer enquiry button makes no sense. */}
          <PublicChrome
            whatsappHref={quickEnquiryHref(
              "Hi YaadiGo — I'd like help planning a trip."
            )}
          />
          {admin && <AdminShell storage={describeStorage()} />}
        </ConciergeProvider>
      </body>
    </html>
  );
}
