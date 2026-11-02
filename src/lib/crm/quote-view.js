import { getUser } from "@/lib/cms/users";
import { CONTACT } from "@/lib/site";
import { defaultContent } from "@/lib/crm/quote-content";

/**
 * The content block a quotation is shown with — on the customer's page and in
 * its PDF alike, so the two can never disagree.
 *
 * Older quotations predate the content block; defaults fill it so nothing
 * renders as an empty document.
 *
 * The named human is resolved at render rather than stored, so it follows a
 * transfer: when a lead moves to another salesperson, the customer's copy
 * shows whoever is answerable NOW. Falls back to the company number if the
 * owner has no mobile recorded — never to nothing.
 */
export async function customerContent(quotation) {
  const content = { ...defaultContent(quotation), ...(quotation.content ?? {}) };
  const owner = quotation.ownerId ? await getUser(quotation.ownerId) : null;
  if (owner) {
    content.owner = { name: owner.name, phone: owner.phone ?? CONTACT.phone ?? null };
  }
  return content;
}
