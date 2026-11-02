import { WhatsAppIcon, ChatIcon } from "./icons";
import { quickEnquiryHref, whatsappLink } from "@/lib/site";

/**
 * Floating quick-enquiry button.
 *
 * Desktop only: on phones the same action already lives in the bottom bar,
 * and stacking a floating bubble on top of a tab bar is how you end up
 * covering your own CTA.
 */
export default function WhatsAppFab({
  message = "Hi YaadiGo — I'd like help planning a trip.",
}) {
  const href = quickEnquiryHref(message);
  const isWhatsApp = Boolean(whatsappLink(message));

  return (
    <a
      href={href}
      {...(isWhatsApp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="no-print group fixed bottom-6 right-6 z-40 hidden items-center gap-2.5 rounded-full bg-[#25D366] py-3.5 pl-4 pr-5 text-[14px] font-bold text-white shadow-xl shadow-[#25D366]/30 transition-transform hover:scale-105 md:flex"
      aria-label={isWhatsApp ? "Chat with us on WhatsApp" : "Send a quick enquiry"}
    >
      {isWhatsApp ? <WhatsAppIcon size={20} /> : <ChatIcon size={20} />}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-[140px] group-hover:opacity-100">
        {isWhatsApp ? "Chat with us" : "Quick enquiry"}
      </span>
    </a>
  );
}
