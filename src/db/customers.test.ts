import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createTestDb } from "./test-db";

/**
 * Customers, through the app's own record store into real Postgres: the
 * matching rules, the race the unique keys exist for, the backfill in
 * migration 0007, and what a customer is worth.
 */

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let customers: typeof import("../lib/crm/customers");
let leads: typeof import("../lib/crm/leads");

beforeAll(async () => {
  ctx = await createTestDb();
  process.env.DATABASE_URL = "pglite://test";
  (globalThis as { __yaadigoDb?: unknown }).__yaadigoDb = ctx.db;
  customers = await import("../lib/crm/customers");
  leads = await import("../lib/crm/leads");
}, 60000);

beforeEach(async () => {
  await ctx.reset();
});

afterAll(async () => {
  await ctx.close();
});

const count = async (table: string) =>
  Number((await ctx.client.query<{ n: number }>(`select count(*)::int as n from ${table}`)).rows[0].n);

describe("customerForEnquiry", () => {
  it("recognises one person however the number is written, and only fills blanks", async () => {
    const first = await customers.customerForEnquiry({ name: "Asha Rao", phone: "+91 98765 43210", source: "planner" });
    const again = await customers.customerForEnquiry({
      name: "asha",
      phone: "09876543210",
      email: "Asha@Example.in ",
      source: "contact",
    });
    expect(again!.id).toBe(first!.id);
    // A later form's spelling does not overwrite the name; the blank email is filled.
    expect(again).toMatchObject({ name: "Asha Rao", email: "Asha@Example.in", emailKey: "asha@example.in", firstSource: "planner" });
    expect(await count("customers")).toBe(1);
  });

  it("matches by email when the first enquiry had no phone, then adds the phone", async () => {
    const byEmail = await customers.customerForEnquiry({ name: "Ravi", email: "ravi@example.in" });
    const withPhone = await customers.customerForEnquiry({ name: "Ravi", email: "RAVI@example.in", phone: "98111 22233" });
    expect(withPhone!.id).toBe(byEmail!.id);
    expect(withPhone!.phoneKey).toBe("9811122233");
  });

  it("does not hand a shared family email to a second phone", async () => {
    const dad = await customers.customerForEnquiry({ name: "Dad", phone: "9800000001", email: "family@example.in" });
    const son = await customers.customerForEnquiry({ name: "Son", phone: "9800000002", email: "family@example.in" });
    // Two numbers behind one inbox are two people. The son keeps the address
    // to read, but it stays Dad's key.
    expect(son!.id).not.toBe(dad!.id);
    expect(son).toMatchObject({ name: "Son", email: "family@example.in", emailKey: null });
    expect(await count("customers")).toBe(2);
    // Dad enquiring again by email alone still finds Dad.
    expect((await customers.customerForEnquiry({ name: "Dad", email: "FAMILY@example.in" }))!.id).toBe(dad!.id);
  });

  it("returns nobody for an enquiry with no usable phone or email", async () => {
    expect(await customers.customerForEnquiry({ name: "Anon", phone: "123", email: "not-an-email" })).toBeNull();
  });

  it("is refused by the database for a second customer on one phone, and for an unreachable one", async () => {
    await customers.customerForEnquiry({ name: "Asha", phone: "9876543210" });
    await expect(
      ctx.client.query(`insert into customers (id, name, phone_key) values ('dup', 'Copy', '9876543210')`)
    ).rejects.toThrow();
    await expect(ctx.client.query(`insert into customers (id, name) values ('ghost', 'No contact')`)).rejects.toThrow();
  });
});

describe("captureLead", () => {
  it("links every enquiry, and a repeat, to the same customer", async () => {
    const lead = await leads.captureLead({ name: "Meera", phone: "9822001122", source: "contact", destination: "Ladakh" });
    expect(lead.customerId).toBeTruthy();
    // Two years later, a new lead (the old one was closed) from the same person.
    await ctx.client.query(`update leads set status = 'won' where id = $1`, [lead.id]);
    const later = await leads.captureLead({ name: "Meera K", phone: "+91-98220-01122", source: "planner", destination: "Bali" });
    expect(later.id).not.toBe(lead.id);
    expect(later.customerId).toBe(lead.customerId);
  });
});

describe("the 0007 backfill", () => {
  it("makes one customer per person from existing leads and links them all", async () => {
    await ctx.client.query(`
      insert into leads (id, name, phone, email, source, received_at) values
        ('l1', 'Asha', '+91 98765 43210', 'asha@example.in', 'planner', '2026-01-01'),
        ('l2', 'Asha R', '09876543210', null, 'contact', '2026-03-01'),
        ('l3', 'Ravi', null, 'Ravi@Example.in', 'contact', '2026-02-01'),
        ('l4', 'Ravi', '', 'ravi@example.in ', 'trip', '2026-04-01'),
        ('l5', 'Dad', '9800000001', 'family@example.in', 'contact', '2026-01-05'),
        ('l6', 'Son', '9800000002', 'family@example.in', 'contact', '2026-01-06'),
        ('l7', 'Walk-in', null, null, 'desk', '2026-05-01')
    `);
    const sql = readFileSync(join(process.cwd(), "drizzle/0007_customers.sql"), "utf8");
    const backfill = sql.slice(sql.indexOf("-- BACKFILL"));
    for (const statement of backfill.split("--> statement-breakpoint")) {
      if (statement.trim()) await ctx.client.exec(statement);
    }

    const rows = (await ctx.client.query<{ name: string; phone_key: string | null; email_key: string | null; first_source: string }>(
      `select name, phone_key, email_key, first_source from customers order by name`
    )).rows;
    expect(rows).toEqual([
      // Named and sourced from their FIRST lead.
      { name: "Asha", phone_key: "9876543210", email_key: "asha@example.in", first_source: "planner" },
      // A shared email goes to neither phone.
      { name: "Dad", phone_key: "9800000001", email_key: null, first_source: "contact" },
      { name: "Ravi", phone_key: null, email_key: "ravi@example.in", first_source: "contact" },
      { name: "Son", phone_key: "9800000002", email_key: null, first_source: "contact" },
    ]);

    const links = (await ctx.client.query<{ id: string; name: string | null }>(
      `select l.id, c.name from leads l left join customers c on c.id = l.customer_id order by l.id`
    )).rows;
    expect(links).toEqual([
      { id: "l1", name: "Asha" },
      { id: "l2", name: "Asha" },
      { id: "l3", name: "Ravi" },
      { id: "l4", name: "Ravi" },
      { id: "l5", name: "Dad" },
      { id: "l6", name: "Son" },
      { id: "l7", name: null },
    ]);
  });
});

describe("what a customer is worth", () => {
  it("totals live bookings and payments, flags repeats, and scopes to the salesperson", async () => {
    const c = await customers.customerForEnquiry({ name: "Asha", phone: "9876543210" });
    await ctx.client.query(
      `insert into users (id, name, email, role, status) values ('u1', 'Rahul', 'rahul@example.in', 'sales', 'active'), ('u2', 'Neha', 'neha@example.in', 'sales', 'active')`
    );
    await ctx.client.query(
      `insert into leads (id, name, phone, source, customer_id, owner_id) values ('a', 'Asha', '9876543210', 'contact', $1, 'u1'), ('b', 'Asha', '9876543210', 'planner', $1, 'u1')`,
      [c!.id]
    );
    await ctx.client.query(`
      insert into bookings (id, reference, source, lead_id, status, name, trip_title, total_paise) values
        ('bk1', 'YG-1', 'quotation', 'a', 'paid', 'Asha', 'Ladakh', 6000000),
        ('bk2', 'YG-2', 'quotation', 'b', 'confirmed', 'Asha', 'Bali', 9000000),
        ('bk3', 'YG-3', 'quotation', 'b', 'cancelled', 'Asha', 'Goa', 2500000)
    `);
    await ctx.client.query(`
      insert into payments (id, booking_id, kind, amount_paise, method) values
        ('p1', 'bk1', 'advance', 6000000, 'upi'), ('p2', 'bk2', 'advance', 2000000, 'upi')
    `);

    const [row] = await customers.listCustomersWithStats();
    expect(row).toMatchObject({ enquiries: 2, bookings: 2, bookedValue: 150000, collected: 80000, repeat: true });

    expect(await customers.listCustomersWithStats({ ownerId: "u1" })).toHaveLength(1);
    expect(await customers.listCustomersWithStats({ ownerId: "u2" })).toHaveLength(0);
    expect(await customers.listCustomersWithStats({ search: "43210" })).toHaveLength(1);

    const dossier = await customers.getCustomerDossier(c!.id);
    expect(dossier!.totals).toEqual({ enquiries: 2, bookings: 2, bookedValue: 150000, collected: 80000, outstanding: 70000 });
  });
});

describe("updateCustomer", () => {
  it("refuses a phone that belongs to someone else, and dates a consent", async () => {
    const a = await customers.customerForEnquiry({ name: "Asha", phone: "9876543210" });
    const b = await customers.customerForEnquiry({ name: "Ravi", phone: "9811122233" });

    const clash = await customers.updateCustomer(b!.id, { phone: "+91 98765 43210" });
    expect(clash.error).toMatch(/Asha already has that phone number/);

    const ok = await customers.updateCustomer(a!.id, { city: "Pune", marketingConsent: true });
    expect(ok.customer).toMatchObject({ city: "Pune", marketingConsent: true });
    expect(ok.customer.consentAt).toBeTruthy();

    expect((await customers.updateCustomer(a!.id, { phone: "", email: "" })).error).toMatch(/phone number or an email/);
  });
});
