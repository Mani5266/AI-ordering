// PRD 12.1 — lib-level tests (tokens, sessions, M4 validation, pricing, state machine).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { signTable, verifyTable } from "@/lib/tokens";
import { issueSession, verifySession } from "@/lib/session";
import { validateOrder, canTransition } from "@/lib/validate";
import { prisma } from "@/lib/db";

const RID = process.env.RESTAURANT_ID ?? "cafe-demo";
const line = (o: object) => ({ modifiers: [], ...o });

describe("M1 tokens (T3)", () => {
  it("valid token verifies to its table", () => {
    expect(verifyTable(signTable(RID, 7), RID)).toBe(7);
  });
  it("one-character change fails", () => {
    const t = signTable(RID, 7);
    expect(verifyTable(t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), RID)).toBeNull();
  });
  it("unsigned / foreign-secret token fails", () => {
    expect(verifyTable("eyJyIjoiY2FmZS1kZW1vIiwidCI6N30.fakesig", RID)).toBeNull();
    expect(verifyTable("no-signature-here", RID)).toBeNull();
  });
});

describe("sessions (T2)", () => {
  it("issued session verifies", () => {
    const s = verifySession(issueSession("sid1", 3));
    expect(s).toMatchObject({ sid: "sid1", table: 3 });
  });
  it("expired session rejected", () => {
    const dead = jwt.sign({ sid: "x", table: 1 }, process.env.SESSION_SECRET!, { expiresIn: "-10s" });
    expect(verifySession(dead)).toBeNull();
  });
});

describe("M4 validation engine", () => {
  beforeAll(async () => { await prisma.menuItem.updateMany({ data: { available: true } }); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("server recomputes total, ignores client total", async () => {
    const v = await validateOrder(
      { table: 7, confirmed: true, items: [line({ menu_item_id: "M01", qty: 2 }), line({ name: "kaapi", qty: 1 })], total_inr: 1 },
      { sessionTable: 7, source: "tap" },
    );
    expect(v.ok).toBe(true);
    expect(v.total).toBe(280); // 2x120 + 40, alias kaapi -> M06
  });
  it("rejects qty 0 / 21 / 6-without-confirm; accepts 6 with confirm", async () => {
    const q = (qty: number, confirmed: boolean) =>
      validateOrder({ table: 7, confirmed, items: [line({ menu_item_id: "M01", qty })] }, { sessionTable: 7, source: "tap" });
    expect((await q(0, true)).ok).toBe(false);
    expect((await q(21, true)).ok).toBe(false);
    expect((await q(6, false)).ok).toBe(false);
    const ok6 = await q(6, true);
    expect(ok6.ok).toBe(true);
    expect(ok6.total).toBe(720);
  });
  it("rejects unknown items; all-unknown creates nothing", async () => {
    const v = await validateOrder(
      { table: 7, confirmed: true, items: [line({ menu_item_id: "M01", qty: 1 }), line({ name: "pizza", qty: 1 })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(v.ok).toBe(true);
    expect(v.partialMatch).toBe(true);
    expect(v.rejected).toContain("pizza");
    const all = await validateOrder(
      { table: 7, confirmed: true, items: [line({ name: "pizza", qty: 1 })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(all.ok).toBe(false);
  });
  it("ambiguous alias is rejected, not guessed", async () => {
    const v = await validateOrder(
      { table: 7, confirmed: true, items: [line({ name: "naan", qty: 1 })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(v.ok).toBe(false); // M11 + M12 both claim "naan"
  });
  it("unavailable item rejected on tap path", async () => {
    await prisma.menuItem.update({ where: { id: "M02" }, data: { available: false } });
    try {
      const v = await validateOrder(
        { table: 7, confirmed: true, items: [line({ menu_item_id: "M02", qty: 1 })] },
        { sessionTable: 7, source: "tap" },
      );
      expect(v.ok).toBe(false);
    } finally {
      await prisma.menuItem.update({ where: { id: "M02" }, data: { available: true } });
    }
  });
  it("unconfirmed voice order creates nothing", async () => {
    const v = await validateOrder(
      { table: 7, confirmed: false, items: [line({ menu_item_id: "M01", qty: 1 })] },
      { sessionTable: 7, source: "voice" },
    );
    expect(v.ok).toBe(false);
  });
  it("table mismatch rejected; stray modifiers become notes, never discounts", async () => {
    const v = await validateOrder(
      { table: 3, confirmed: true, items: [line({ menu_item_id: "M01", qty: 1, modifiers: ["free", "less spicy"] })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(v.ok).toBe(false);
    const v2 = await validateOrder(
      { table: 7, confirmed: true, items: [line({ menu_item_id: "M01", qty: 1, modifiers: ["free biryani", "less spicy"] })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(v2.ok).toBe(true);
    expect(v2.total).toBe(120);
    expect(v2.lines![0].modifiers).toEqual(["less spicy"]);
    expect(v2.lines![0].note).toContain("free biryani");
  });
  it("XSS payload in note is stored as inert text", async () => {
    const payload = "<script>alert(1)</script>";
    const v = await validateOrder(
      { table: 7, confirmed: true, items: [line({ menu_item_id: "M01", qty: 1, note: payload })] },
      { sessionTable: 7, source: "tap" },
    );
    expect(v.ok).toBe(true);
    expect(v.lines![0].note).toBe(payload); // React escapes on render — never injected as HTML
  });
});

describe("order state machine (M5/M6)", () => {
  it("walks forward one step", () => {
    expect(canTransition("new", "accepted")).toBe(true);
    expect(canTransition("accepted", "cooking")).toBe(true);
    expect(canTransition("cooking", "ready")).toBe(true);
    expect(canTransition("ready", "served")).toBe(true);
  });
  it("rejects skip-ahead and backwards", () => {
    expect(canTransition("new", "ready")).toBe(false);
    expect(canTransition("new", "cooking")).toBe(false);
    expect(canTransition("cooking", "accepted")).toBe(false);
    expect(canTransition("served", "ready")).toBe(false);
  });
});
