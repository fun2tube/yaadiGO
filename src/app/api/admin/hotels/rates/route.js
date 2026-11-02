import { authorise } from "@/lib/cms/auth";
import { removeRate, saveRate } from "@/lib/cms/hotels";

export const dynamic = "force-dynamic";

/** A hotel's rate card: add (POST), change (PATCH), remove (DELETE). */

async function body(request) {
  const data = await request.json().catch(() => ({}));
  return typeof data === "object" && data ? data : {};
}

const reply = (result, status = 200) =>
  result.error ? Response.json({ message: result.error }, { status: 400 }) : Response.json(result, { status });

export async function POST(request) {
  const { denied } = await authorise("catalogue.write");
  if (denied) return denied;
  const { hotelId, ...rate } = await body(request);
  if (typeof hotelId !== "string") return Response.json({ message: "Which hotel?" }, { status: 400 });
  return reply(await saveRate(hotelId, rate), 201);
}

export async function PATCH(request) {
  const { denied } = await authorise("catalogue.write");
  if (denied) return denied;
  const { hotelId, rateId, ...rate } = await body(request);
  if (typeof hotelId !== "string" || typeof rateId !== "string") return Response.json({ message: "Which rate?" }, { status: 400 });
  return reply(await saveRate(hotelId, rate, rateId));
}

export async function DELETE(request) {
  const { denied } = await authorise("catalogue.write");
  if (denied) return denied;
  const { hotelId, rateId } = await body(request);
  if (typeof hotelId !== "string" || typeof rateId !== "string") return Response.json({ message: "Which rate?" }, { status: 400 });
  return reply(await removeRate(hotelId, rateId));
}
