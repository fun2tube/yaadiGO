import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb } from "./test-db";

/**
 * Hotels and rate cards through the app's record store into real Postgres:
 * the directory's duplicate rule, one price per night, the money rules the
 * database enforces, and pricing a stay that crosses into a new season.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let hotels: typeof import("../lib/cms/hotels");

beforeAll(async () => {
  ctx = await createTestDb();
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  hotels = await import("../lib/cms/hotels");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

const deyzor = { name: "Hotel Deyzor", destination: "Spiti", city: "Kaza", category: "hotel", stars: 3 };
const rate = (over = {}) => ({
  roomType: "Deluxe",
  mealPlan: "MAP",
  season: "Peak",
  validFrom: "2026-06-01",
  validTo: "2026-06-30",
  cost: 4000,
  sell: 5200,
  ...over,
});

describe("the directory", () => {
  it("refuses the same hotel in the same place twice, in any case", async () => {
    expect((await hotels.saveHotel(deyzor)).hotel).toBeTruthy();
    const again = await hotels.saveHotel({ ...deyzor, name: "hotel deyzor " });
    expect(again.error).toMatch(/already in the directory/);
    // Same name elsewhere is a different property.
    expect((await hotels.saveHotel({ ...deyzor, city: "Tabo" })).hotel).toBeTruthy();
    // And the database agrees, should anything write around this file.
    await expect(
      ctx.client.query(`insert into hotels (id, name, destination, city) values ('x', 'HOTEL DEYZOR', 'Spiti', 'kaza')`)
    ).rejects.toThrow();
  });
});

describe("rate cards", () => {
  it("allows one price per night per room and meal plan", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    expect((await hotels.saveRate(hotel.id, rate())).rate).toMatchObject({ cost: 4000, sell: 5200 });

    const overlap = await hotels.saveRate(hotel.id, rate({ validFrom: "2026-06-30", validTo: "2026-07-15", season: "Late" }));
    expect(overlap.error).toMatch(/already has a price from 2026-06-01 to 2026-06-30/);

    // The next day is fine, and so is another plan on the same nights.
    expect((await hotels.saveRate(hotel.id, rate({ validFrom: "2026-07-01", validTo: "2026-07-15", season: "Late", cost: 3000, sell: 3900 }))).rate).toBeTruthy();
    expect((await hotels.saveRate(hotel.id, rate({ mealPlan: "CP", cost: 3500, sell: 4500 }))).rate).toBeTruthy();
  });

  it("refuses selling below cost, backwards dates and an unknown meal plan, and the database does too", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    expect((await hotels.saveRate(hotel.id, rate({ sell: 3999 }))).error).toMatch(/below what the room costs/);
    expect((await hotels.saveRate(hotel.id, rate({ validTo: "2026-05-01" }))).error).toMatch(/ends before it starts/);
    expect((await hotels.saveRate(hotel.id, rate({ mealPlan: "XX" as never }))).error).toBeTruthy();

    await expect(
      ctx.client.query(
        `insert into hotel_rates (id, hotel_id, room_type, meal_plan, valid_from, valid_to, cost_paise, sell_paise)
         values ('r', $1, 'Deluxe', 'MAP', '2026-06-01', '2026-06-30', 400000, 399900)`,
        [hotel.id]
      )
    ).rejects.toThrow();
  });

  it("stores money as exact paise", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    await hotels.saveRate(hotel.id, rate({ cost: 4321, sell: 5679 }));
    const row = (await ctx.client.query<{ cost_paise: string; sell_paise: string }>(`select cost_paise, sell_paise from hotel_rates`)).rows[0];
    expect([String(row.cost_paise), String(row.sell_paise)]).toEqual(["432100", "567900"]);
  });

  it("can move a rate's dates without tripping over itself", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    const { rate: saved } = await hotels.saveRate(hotel.id, rate());
    expect((await hotels.saveRate(hotel.id, rate({ validTo: "2026-07-05" }), saved.id)).rate.validTo).toBe("2026-07-05");
  });
});

describe("priceStay", () => {
  it("prices each night on its own season's rate and flags nights with none", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    await hotels.saveRate(hotel.id, rate()); // June: 4000 / 5200
    await hotels.saveRate(hotel.id, rate({ validFrom: "2026-07-01", validTo: "2026-07-15", season: "Late", cost: 3000, sell: 3900 }));
    await hotels.saveRate(hotel.id, rate({ roomType: "Standard", mealPlan: "CP", validFrom: "2026-06-01", validTo: "2026-06-30", cost: 2000, sell: 2600 }));

    // 29 June for 3 nights: two June nights and one July night.
    const stay = await hotels.priceStay(hotel.id, { checkIn: "2026-06-29", nights: 3 });
    const deluxe = stay!.options.find((o) => o.roomType === "Deluxe")!;
    expect(deluxe).toMatchObject({ complete: true, cost: 4000 * 2 + 3000, sell: 5200 * 2 + 3900, seasons: ["Peak", "Late"] });

    // Standard has no July price: incomplete, and says which night.
    const standard = stay!.options.find((o) => o.roomType === "Standard")!;
    expect(standard).toMatchObject({ complete: false, missingNights: ["2026-07-01"], sell: 2600 * 2 });

    // Complete options come first.
    expect(stay!.options[0].complete).toBe(true);
  });
});

describe("listHotels", () => {
  it("shows the cheapest current room and hides inactive hotels by default", async () => {
    const { hotel } = await hotels.saveHotel(deyzor);
    await hotels.saveRate(hotel.id, rate({ validFrom: "2099-01-01", validTo: "2099-12-31" }));
    await hotels.saveRate(hotel.id, rate({ mealPlan: "CP", validFrom: "2099-01-01", validTo: "2099-12-31", cost: 3000, sell: 3600 }));
    await hotels.saveHotel({ ...deyzor, name: "Closed Camp", active: false });

    const list = await hotels.listHotels();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Hotel Deyzor", currentRates: 2, fromSell: 3600 });
    expect(await hotels.listHotels({ includeInactive: true })).toHaveLength(2);
    expect(await hotels.listHotels({ search: "kaza" })).toHaveLength(1);
  });
});
