"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/crm/schema";
import { AlertIcon, CheckIcon } from "@/components/icons";

/**
 * A hotel's details and its rate card.
 *
 * The rate card is the point: what we pay and what we sell at, per room per
 * night, by room type, meal plan and season. The server refuses a second
 * price for the same night (lib/cms/hotels.js) and a sell price below cost,
 * and this screen shows its reason in plain words.
 */

const input = "w-full rounded-xl border border-paper-line-strong bg-card px-3 py-2 text-[13px] text-paper-text";
const labelCls = "flex flex-col gap-1 text-[12px] font-semibold text-paper-text-muted";

const blankRate = () => ({
  id: null,
  roomType: "",
  mealPlan: "CP",
  season: "",
  validFrom: "",
  validTo: "",
  cost: "",
  sell: "",
  extraBedCost: "",
  extraBedSell: "",
  notes: "",
});

const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

function Message({ message }) {
  if (!message) return null;
  return (
    <span className={`flex items-center gap-1.5 text-[12.5px] ${message.ok ? "text-good" : "text-danger"}`}>
      {message.ok ? <CheckIcon size={12} /> : <AlertIcon size={13} />} {message.text}
    </span>
  );
}

async function send(url, method, body) {
  try {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    return response.ok ? { data } : { error: data.message ?? "That didn't save. Try again.", clashId: data.clashId };
  } catch {
    return { error: "No connection. Nothing was saved." };
  }
}

export default function HotelEditor({ hotel, rates, canWrite, categories, mealPlans }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: hotel?.name ?? "",
    destination: hotel?.destination ?? "",
    city: hotel?.city ?? "",
    category: hotel?.category ?? "hotel",
    stars: hotel?.stars ? String(hotel.stars) : "",
    contactPerson: hotel?.contactPerson ?? "",
    phone: hotel?.phone ?? "",
    email: hotel?.email ?? "",
    website: hotel?.website ?? "",
    address: hotel?.address ?? "",
    notes: hotel?.notes ?? "",
    active: hotel?.active ?? true,
  });
  const [rate, setRate] = useState(blankRate());
  const [busy, setBusy] = useState(false);
  const [hotelMessage, setHotelMessage] = useState(null);
  const [rateMessage, setRateMessage] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const setR = (key) => (e) => setRate((r) => ({ ...r, [key]: e.target.value }));
  const planLabel = (value) => mealPlans.find((m) => m.value === value)?.label ?? value;

  async function saveHotel(event) {
    event.preventDefault();
    setBusy(true);
    setHotelMessage(null);
    const body = { ...form, stars: form.stars ? Number(form.stars) : null };
    const result = hotel ? await send("/api/admin/hotels", "PATCH", { id: hotel.id, ...body }) : await send("/api/admin/hotels", "POST", body);
    setBusy(false);
    if (result.error) {
      setHotelMessage({ ok: false, text: result.error });
      return;
    }
    if (!hotel) {
      // Straight on to its rates.
      router.push(`/admin/hotels/${result.data.hotel.id}`);
      return;
    }
    setHotelMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function saveRate(event) {
    event.preventDefault();
    setBusy(true);
    setRateMessage(null);
    const num = (v) => (v === "" || v === null ? null : Number(v));
    const body = {
      hotelId: hotel.id,
      roomType: rate.roomType,
      mealPlan: rate.mealPlan,
      season: rate.season,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      cost: num(rate.cost) ?? 0,
      sell: num(rate.sell) ?? 0,
      extraBedCost: num(rate.extraBedCost),
      extraBedSell: num(rate.extraBedSell),
      notes: rate.notes,
    };
    const result = rate.id
      ? await send("/api/admin/hotels/rates", "PATCH", { ...body, rateId: rate.id })
      : await send("/api/admin/hotels/rates", "POST", body);
    setBusy(false);
    if (result.error) {
      setRateMessage({ ok: false, text: result.error });
      return;
    }
    setRateMessage({ ok: true, text: rate.id ? "Rate updated." : "Rate added." });
    setRate(blankRate());
    router.refresh();
  }

  async function deleteRate(r) {
    if (!window.confirm(`Remove the ${r.roomType} ${r.mealPlan} rate for ${fmtDate(r.validFrom)} – ${fmtDate(r.validTo)}?`)) return;
    setBusy(true);
    const result = await send("/api/admin/hotels/rates", "DELETE", { hotelId: hotel.id, rateId: r.id });
    setBusy(false);
    setRateMessage(result.error ? { ok: false, text: result.error } : { ok: true, text: "Rate removed." });
    router.refresh();
  }

  const edit = (r) =>
    setRate({
      id: r.id,
      roomType: r.roomType,
      mealPlan: r.mealPlan,
      season: r.season ?? "",
      validFrom: r.validFrom,
      validTo: r.validTo,
      cost: String(r.cost),
      sell: String(r.sell),
      extraBedCost: r.extraBedCost == null ? "" : String(r.extraBedCost),
      extraBedSell: r.extraBedSell == null ? "" : String(r.extraBedSell),
      notes: r.notes ?? "",
    });

  const margin = Number(rate.sell) && Number(rate.cost) ? Math.round(((rate.sell - rate.cost) / rate.sell) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={saveHotel} className="flex flex-col gap-3 rounded-2xl border border-paper-line bg-card p-4">
        <fieldset disabled={!canWrite} className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>
            Name
            <input required value={form.name} onChange={set("name")} className={input} />
          </label>
          <label className={labelCls}>
            Destination <span className="font-normal text-paper-text-faint">as trips name it: Kashmir, Spiti, Kerala…</span>
            <input required value={form.destination} onChange={set("destination")} className={input} />
          </label>
          <label className={labelCls}>
            Town
            <input value={form.city} onChange={set("city")} className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelCls}>
              Type
              <select value={form.category} onChange={set("category")} className={input}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelCls}>
              Stars
              <select value={form.stars} onChange={set("stars")} className={input}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={labelCls}>
            Contact person
            <input value={form.contactPerson} onChange={set("contactPerson")} className={input} />
          </label>
          <label className={labelCls}>
            Phone
            <input type="tel" value={form.phone} onChange={set("phone")} className={input} />
          </label>
          <label className={labelCls}>
            Email
            <input type="email" value={form.email} onChange={set("email")} className={input} />
          </label>
          <label className={labelCls}>
            Website
            <input type="url" value={form.website} onChange={set("website")} className={input} />
          </label>
          <label className={`${labelCls} sm:col-span-2`}>
            Address
            <input value={form.address} onChange={set("address")} className={input} />
          </label>
          <label className={`${labelCls} sm:col-span-2`}>
            Notes <span className="font-normal text-paper-text-faint">check-in times, payment terms, what to watch for</span>
            <textarea rows={2} value={form.notes} onChange={set("notes")} className={input} />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-paper-text">
            <input type="checkbox" checked={form.active} onChange={set("active")} /> We still book this hotel
          </label>
        </fieldset>
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-[12.5px] font-bold text-ink-text disabled:opacity-60">
              {hotel ? "Save" : "Add hotel, then its rates"}
            </button>
            <Message message={hotelMessage} />
          </div>
        ) : null}
      </form>

      {hotel ? (
        <section>
          <h2 className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper-text-faint">Rate card · per room per night</h2>
          {rates.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-paper-text-muted">No rates yet. Add what the hotel quoted you, season by season.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-2xl border border-paper-line bg-card">
              <table className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-paper-text-faint">
                    <th className="px-3.5 py-2 font-normal">Room · plan</th>
                    <th className="px-3.5 py-2 font-normal">Dates</th>
                    <th className="px-3.5 py-2 text-right font-normal">Cost</th>
                    <th className="px-3.5 py-2 text-right font-normal">Sell</th>
                    <th className="px-3.5 py-2 text-right font-normal">Margin</th>
                    <th className="px-3.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.id} className="border-t border-paper-line align-top">
                      <td className="px-3.5 py-2 text-paper-text">
                        <strong>{r.roomType}</strong> · {planLabel(r.mealPlan)}
                        {r.season ? <span className="block text-[11px] text-paper-text-faint">{r.season}</span> : null}
                      </td>
                      <td className="px-3.5 py-2 font-mono text-[11px] text-paper-text-muted">
                        {fmtDate(r.validFrom)} – {fmtDate(r.validTo)}
                      </td>
                      <td className="px-3.5 py-2 text-right font-mono text-[11.5px] text-paper-text-muted">{money(r.cost)}</td>
                      <td className="px-3.5 py-2 text-right font-mono text-[11.5px] text-paper-text">{money(r.sell)}</td>
                      <td className="px-3.5 py-2 text-right font-mono text-[11.5px] text-paper-text-muted">
                        {r.sell ? `${Math.round(((r.sell - r.cost) / r.sell) * 100)}%` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-2 text-right">
                        {canWrite ? (
                          <>
                            <button type="button" onClick={() => edit(r)} className="text-[12px] font-bold text-accent-deep">
                              Edit
                            </button>
                            <button type="button" onClick={() => deleteRate(r)} disabled={busy} className="ml-3 text-[12px] font-bold text-paper-text-faint hover:text-danger">
                              Remove
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canWrite ? (
            <form onSubmit={saveRate} className="mt-3 flex flex-col gap-3 rounded-2xl border border-paper-line bg-card p-4">
              <p className="text-[13px] font-bold text-paper-text">{rate.id ? "Change this rate" : "Add a rate"}</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className={labelCls}>
                  Room type
                  <input required value={rate.roomType} onChange={setR("roomType")} placeholder="Deluxe" className={input} />
                </label>
                <label className={labelCls}>
                  Meal plan
                  <select value={rate.mealPlan} onChange={setR("mealPlan")} className={input}>
                    {mealPlans.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelCls}>
                  From
                  <input type="date" required value={rate.validFrom} onChange={setR("validFrom")} className={input} />
                </label>
                <label className={labelCls}>
                  To (last night)
                  <input type="date" required value={rate.validTo} onChange={setR("validTo")} className={input} />
                </label>
                <label className={labelCls}>
                  We pay ₹
                  <input type="number" min="0" required inputMode="numeric" value={rate.cost} onChange={setR("cost")} className={input} />
                </label>
                <label className={labelCls}>
                  We sell at ₹
                  <input type="number" min="0" required inputMode="numeric" value={rate.sell} onChange={setR("sell")} className={input} />
                  {margin !== null ? <span className="font-normal text-paper-text-faint">{margin}% margin</span> : null}
                </label>
                <label className={labelCls}>
                  Extra bed: pay ₹
                  <input type="number" min="0" inputMode="numeric" value={rate.extraBedCost} onChange={setR("extraBedCost")} className={input} />
                </label>
                <label className={labelCls}>
                  Extra bed: sell ₹
                  <input type="number" min="0" inputMode="numeric" value={rate.extraBedSell} onChange={setR("extraBedSell")} className={input} />
                </label>
                <label className={`${labelCls} sm:col-span-2`}>
                  Season name <span className="font-normal text-paper-text-faint">Peak, Shoulder, Diwali…</span>
                  <input value={rate.season} onChange={setR("season")} className={input} />
                </label>
                <label className={`${labelCls} sm:col-span-2`}>
                  Notes
                  <input value={rate.notes} onChange={setR("notes")} className={input} />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-2 text-[12.5px] font-bold text-ink-text disabled:opacity-60">
                  {rate.id ? "Save rate" : "Add rate"}
                </button>
                {rate.id ? (
                  <button type="button" onClick={() => setRate(blankRate())} className="text-[12.5px] font-semibold text-paper-text-muted">
                    Cancel
                  </button>
                ) : null}
                <Message message={rateMessage} />
              </div>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
