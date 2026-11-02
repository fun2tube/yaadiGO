import SiteNav from "@/components/site-nav";
import { buildFor } from "@/components/builder/page-shell";
import Editable from "@/components/cms/editable";
import Reveal from "@/components/reveal";
import SiteFooter from "@/components/site-footer";
import TripBuilderForm from "@/components/trip-builder-form";
import { WhatsAppIcon, ChevronIcon } from "@/components/icons";
import {
  ORG_LEGAL_NAME,
  CONTACT,
  CORPORATE_URL,
  REGISTRATION,
  formattedAddress,
} from "@/lib/site";

export const metadata = {
  title: "Contact YaadiGo — Trip Planning & Corporate Travel",
  description:
    // No response-time promise here. The 4-hour nudge and 8-hour escalation in
    // lib/crm/sla.js are an internal routing rule, not a published commitment,
    // and a meta description is a bad place to invent one.
    "Reach the YaadiGo travel desk about a group tour, a customized trip or a corporate travel account. Call, WhatsApp or email our Kalkaji, New Delhi office.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  // A page built in the admin wins over the one below. Nothing published means
  // exactly the page in git — see components/builder/page-shell.jsx.
  const built = await buildFor("/contact");
  if (built) return built;

  const address = formattedAddress();

  return (
    <>
      <Reveal />
      <SiteNav />
      <main className="pt-[84px]">
        <section className="bg-paper-dim">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-16">
            <Editable id="contact.eyebrow" as="span" className="text-xs font-bold uppercase tracking-[0.13em] text-accent-deep">
              Contact
            </Editable>
            <Editable id="contact.heading" as="h1" className="mt-2 max-w-2xl font-display text-[32px] font-medium leading-[1.2] text-paper-text sm:text-[40px]">
              Tell us what you&apos;re planning. A person replies.
            </Editable>
            <Editable id="contact.leisure-trips-group-departures-and" as="p" multiline className="mt-3 max-w-xl text-[15px] leading-relaxed text-paper-text-muted">
              Leisure trips, group departures and corporate accounts all come
              through the same desk — say which one it is and it lands with
              the right person.
            </Editable>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-8">
              <div>
                <Editable id="contact.direct-lines" as="h2" className="font-display text-[20px] font-medium text-paper-text">
              Direct lines
            </Editable>
                <dl className="mt-4 flex flex-col gap-4">
                  {CONTACT.phone && (
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                        Phone
                      </dt>
                      <dd className="mt-0.5 text-[15px] text-paper-text">
                        <a href={`tel:${CONTACT.phoneHref ?? CONTACT.phone}`}>{CONTACT.phone}</a>
                      </dd>
                    </div>
                  )}
                  {CONTACT.email && (
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                        Email
                      </dt>
                      <dd className="mt-0.5 text-[15px] text-paper-text">
                        <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                      For Corporate
                    </dt>
                    <dd className="mt-0.5 text-[15px] text-paper-text">
                      <a href={`mailto:${CONTACT.corporateEmail}`}>{CONTACT.corporateEmail}</a>
                    </dd>
                  </div>
                  {address && (
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                        Registered office
                      </dt>
                      <dd className="mt-0.5 text-[15px] leading-relaxed text-paper-text">
                        {ORG_LEGAL_NAME}
                        {address.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {(REGISTRATION.cin || REGISTRATION.gstin) && (
                    <div>
                      <dt className="text-[12px] font-semibold uppercase tracking-wide text-paper-text-faint">
                        Registration
                      </dt>
                      <dd className="mt-0.5 text-[13.5px] leading-relaxed text-paper-text-muted">
                        {REGISTRATION.cin && <span className="block">CIN {REGISTRATION.cin}</span>}
                        {REGISTRATION.gstin && <span className="block">GSTIN {REGISTRATION.gstin}</span>}
                      </dd>
                    </div>
                  )}
                </dl>

                {CONTACT.whatsapp && (
                  <a
                    href={`https://wa.me/${CONTACT.whatsapp}`}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-paper-line-strong px-5 py-2.5 text-[13.5px] font-semibold text-paper-text"
                  >
                    <WhatsAppIcon size={16} /> Message us on WhatsApp
                  </a>
                )}
              </div>

              <div className="rounded-2xl border border-paper-line bg-paper-dim p-6">
                <Editable id="contact.setting-up-a-corporate" as="h2" className="font-display text-[18px] font-medium text-paper-text">
              Setting up a corporate account?
            </Editable>
                <Editable id="contact.billing-terms-the-proposal-form" as="p" multiline className="mt-2 text-[13.5px] leading-relaxed text-paper-text-muted">
                  Billing terms, the proposal form and a discovery call all
                  live on our For Corporate page — no minimum monthly
                  booking volume to qualify.
            </Editable>
                <a
                  href={CORPORATE_URL}
                  className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent-deep"
                >
                  Go to For Corporate <ChevronIcon size={14} />
                </a>
              </div>

              <div>
                <Editable id="contact.when-we-reply" as="h2" className="font-display text-[18px] font-medium text-paper-text">
              When we reply
            </Editable>
                <Editable id="contact.enquiries-sent-during-business-hours" as="p" multiline className="mt-2 text-[13.5px] leading-relaxed text-paper-text-muted">
                  Enquiries sent during business hours get a first response the
                  same day. Corporate booking requests turn around within 24
                  hours, with 24×7 cover for genuine travel emergencies on
                  live bookings.
            </Editable>
              </div>
            </div>

            <TripBuilderForm source="contact-page" heading="Send us a message" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
