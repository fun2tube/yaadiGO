import { describe, it, expect } from "vitest";
import { ROLES, MODULES, userCan, permissionsForRole } from "@/lib/crm/schema";

/**
 * Role separation.
 *
 * Tested rather than trusted because the thing being prevented is invisible
 * when it works: a salesperson who can raise a tax invoice for a price they
 * negotiated themselves leaves no trace until an audit. A permission string
 * mistyped in a refactor would silently re-open exactly that.
 */

const asUser = (role) => ({
  status: "active",
  role,
  permissions: permissionsForRole(role),
});

describe("the invoices module", () => {
  it("is its own module, separable on the team screen", () => {
    const invoices = MODULES.find((m) => m.key === "invoices");
    expect(invoices).toBeTruthy();
    // It must not share a permission with bookings, or granting one grants
    // the other and the separation is decorative.
    expect(invoices.write).toBe("invoices.write");
    expect(invoices.write).not.toBe("bookings.write");
  });
});

describe("who may raise a tax invoice", () => {
  it("accounts may", () => {
    expect(userCan(asUser("accounts"), "invoices.write")).toBe(true);
  });

  it("the super admin may", () => {
    expect(userCan(asUser("admin"), "invoices.write")).toBe(true);
  });

  it("sales may NOT — this is the whole point of the role", () => {
    const sales = asUser("sales");
    expect(userCan(sales, "invoices.write")).toBe(false);
    // And specifically: holding bookings.write must no longer be enough.
    expect(userCan(sales, "bookings.write")).toBe(true);
  });

  it("a manager may not, though they can see invoices", () => {
    const manager = asUser("manager");
    expect(userCan(manager, "invoices.write")).toBe(false);
    expect(userCan(manager, "invoices.read")).toBe(true);
  });

  it("operations may neither raise nor read", () => {
    const ops = asUser("ops");
    expect(userCan(ops, "invoices.write")).toBe(false);
    expect(userCan(ops, "invoices.read")).toBe(false);
  });
});

describe("what accounts may not do", () => {
  const accounts = asUser("accounts");

  it("cannot touch a lead or a quotation", () => {
    // Accounts records what happened; it does not decide it. The separation
    // only means something if the person raising the invoice could not also
    // have changed the price on it.
    for (const permission of [
      "leads.read",
      "leads.write",
      "quotations.read",
      "quotations.write",
    ]) {
      expect(userCan(accounts, permission)).toBe(false);
    }
  });

  it("can read a booking but not alter it", () => {
    expect(userCan(accounts, "bookings.read")).toBe(true);
    expect(userCan(accounts, "bookings.write")).toBe(false);
  });

  it("cannot manage the team or the website", () => {
    for (const permission of ["team.write", "content.write", "catalogue.write"]) {
      expect(userCan(accounts, permission)).toBe(false);
    }
  });
});

describe("the permission check itself", () => {
  it("refuses an account that is not active, whatever its role", () => {
    // Checked here rather than at each call site, so forgetting the status
    // check is not possible.
    for (const status of ["invited", "suspended", "pending"]) {
      expect(userCan({ status, role: "admin", permissions: ["*"] }, "invoices.write")).toBe(false);
    }
  });

  it("refuses nobody at all", () => {
    expect(userCan(null, "invoices.read")).toBe(false);
    expect(userCan(undefined, "invoices.read")).toBe(false);
  });

  it("gives every role a real permission set", () => {
    for (const role of Object.keys(ROLES)) {
      expect(permissionsForRole(role).length).toBeGreaterThan(0);
    }
    expect(permissionsForRole("nonsense")).toEqual([]);
  });
});
