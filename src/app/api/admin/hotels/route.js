import { authorise } from "@/lib/cms/auth";
import { listHotels, priceStay, saveHotel } from "@/lib/cms/hotels";
import { userCan } from "@/lib/crm/schema";

export const dynamic = "force-dynamic";

/**
 * The hotel directory. Reading is open to anyone who builds quotations as
 * well as catalogue editors (sales price stays from it); changing it is
 * catalogue.write.
 *
 *   GET ?q=&destination=                    the directory
 *   GET ?price=<hotelId>&checkIn=&nights=   a stay, night by night
 */
export async function GET(request) {
  const { user, denied } = await authorise(null);
  if (denied) return denied;
  if (!userCan(user, "catalogue.read") && !userCan(user, "quotations.read")) {
    return Response.json({ message: "Your account does not have access to that." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const priceFor = params.get("price");
  if (priceFor) {
    const checkIn = params.get("checkIn") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) return Response.json({ message: "Pick a check-in date." }, { status: 400 });
    const stay = await priceStay(priceFor, { checkIn, nights: Number(params.get("nights")) || 1 });
    if (!stay) return Response.json({ message: "That hotel no longer exists." }, { status: 404 });
    return Response.json(stay);
  }

  const hotels = await listHotels({
    search: (params.get("q") ?? "").slice(0, 80),
    destination: params.get("destination") || null,
  });
  return Response.json({ hotels });
}

export async function POST(request) {
  const { denied } = await authorise("catalogue.write");
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const result = await saveHotel(body);
  if (result.error) return Response.json({ message: result.error, clashId: result.clashId ?? null }, { status: result.clashId ? 409 : 400 });
  return Response.json({ hotel: result.hotel }, { status: 201 });
}

export async function PATCH(request) {
  const { denied } = await authorise("catalogue.write");
  if (denied) return denied;
  const { id, ...body } = await request.json().catch(() => ({}));
  if (typeof id !== "string" || !id) return Response.json({ message: "Which hotel?" }, { status: 400 });
  const result = await saveHotel(body, id);
  if (result.error) return Response.json({ message: result.error, clashId: result.clashId ?? null }, { status: result.clashId ? 409 : 400 });
  return Response.json({ hotel: result.hotel });
}
