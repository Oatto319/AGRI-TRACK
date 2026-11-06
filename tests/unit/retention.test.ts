import { describe, expect, it } from "vitest";
import { budgetYearMonths, budgetYearOfDate, budgetYearOfMonth, computeStatus, daysBetween, isExpiredFy, nextRolloverDate, oldestKeptFy, windowStartMonth, type Counts, type ExportRecord } from "@/lib/retention";

const c = (reports: number, area = 0, burn = 0): Counts => ({ reports, area, burn });
const rec = (fy: number, format: "xlsx" | "json", counts: Counts, at = "2026-11-05T01:00:00.000Z"): ExportRecord => ({ fy, format, at, by: "province", counts });

describe("ปีงบประมาณและกรอบ 5 ปี", () => {
  it("ปีงบประมาณนับ ต.ค.–ก.ย.", () => {
    expect(budgetYearOfMonth("2026-09")).toBe(2569);
    expect(budgetYearOfMonth("2026-10")).toBe(2570);
    expect(budgetYearOfDate("2027-09-30")).toBe(2570);
    expect(budgetYearMonths(2565)).toEqual({ from: "2021-10", to: "2022-09" });
  });
  it("เก็บปีปัจจุบัน + ย้อนหลัง 4 ปี", () => {
    expect(oldestKeptFy(2570)).toBe(2566);
    expect(isExpiredFy(2566, 2570)).toBe(false);
    expect(isExpiredFy(2565, 2570)).toBe(true);
    expect(windowStartMonth(2570)).toBe("2022-10");
    expect(nextRolloverDate(2570)).toBe("2027-10-01");
    expect(daysBetween("2027-08-02", "2027-10-01")).toBe(60);
  });
});

describe("computeStatus", () => {
  it("ข้อมูลอยู่ในกรอบและยังไม่ใกล้ขึ้นปีใหม่ = ok", () => {
    const s = computeStatus("2027-03-01", new Map([[2566, c(10)], [2570, c(5)]]), []);
    expect(s.level).toBe("ok");
    expect(s.expiring).toBeNull();
  });
  it("ภายใน 60 วันก่อนขึ้นปีใหม่ และปีเก่าสุดยังไม่ export = warn", () => {
    const s = computeStatus("2027-08-15", new Map([[2566, c(10)], [2570, c(5)]]), []);
    expect(s).toMatchObject({ level: "warn", expiring: 2566, currentFy: 2570 });
    expect(s.message).toContain("2566");
  });
  it("export Excel แล้ว (จำนวนตรงกัน) = ไม่เตือน", () => {
    const s = computeStatus("2027-08-15", new Map([[2566, c(10)]]), [rec(2566, "xlsx", c(10))]);
    expect(s.level).toBe("ok");
  });
  it("ปีที่หลุดกรอบและยังไม่ export = locked", () => {
    const s = computeStatus("2026-11-05", new Map([[2565, c(3, 1)], [2570, c(5)]]), []);
    expect(s).toMatchObject({ level: "locked", blocking: [2565] });
  });
  it("export แล้วปลดล็อก แต่ถ้าข้อมูลเปลี่ยนหลัง export ต้อง export ใหม่", () => {
    const logs = [rec(2565, "xlsx", c(3, 1))];
    expect(computeStatus("2026-11-05", new Map([[2565, c(3, 1)]]), logs).level).toBe("ok");
    expect(computeStatus("2026-11-05", new Map([[2565, c(4, 1)]]), logs).level).toBe("locked");
  });
  it("ลบได้ต่อเมื่อมีทั้ง Excel และ JSON", () => {
    const only = computeStatus("2026-11-05", new Map([[2565, c(3)]]), [rec(2565, "xlsx", c(3))]);
    expect(only.items[0]).toMatchObject({ exported: true, purgeReady: false });
    const both = computeStatus("2026-11-05", new Map([[2565, c(3)]]), [rec(2565, "xlsx", c(3)), rec(2565, "json", c(3))]);
    expect(both.items[0].purgeReady).toBe(true);
  });
  it("ปีที่ไม่มีข้อมูลไม่ทำให้ล็อก", () => {
    expect(computeStatus("2026-11-05", new Map([[2564, c(0)]]), []).level).toBe("ok");
  });
});
