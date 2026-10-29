import { describe, expect, it } from "vitest";
import { buildTrend } from "@/lib/trend";

const months = ["2026-11", "2026-12", "2027-01", "2027-02"];
describe("buildTrend", () => {
  it("ไม่มีข้อมูล", () => {
    const t = buildTrend(months, {}, 100);
    expect(t).toMatchObject({ status: "no-data", lastIndex: -1, total: 0 });
    expect(t.points.every(p => p.actual === null && p.projected === null)).toBe(true);
  });
  it("สะสมจริงถึงเดือนล่าสุด และคาดการณ์ด้วยค่าเฉลี่ยเดือนล่าสุด", () => {
    const t = buildTrend(months, { "2026-11": 10, "2026-12": 30 }, 100, 2);
    expect(t.points.map(p => p.actual)).toEqual([10, 40, null, null]);
    expect(t.avgMonthly).toBe(20);
    expect(t.projectedEnd).toBe(80);                    // 40 + 20 × 2 เดือนที่เหลือ
    expect(t.points.map(p => p.projected)).toEqual([null, 40, 60, 80]);
    expect(t.status).toBe("behind");                    // 80 < 100
    expect(t.expectedNow).toBe(50);                     // ควรได้ 100 × 2/4
    expect(t.gap).toBe(-10);
  });
  it("เป็นไปตามแผนเมื่อคาดว่าจะถึงเป้า และบรรลุเป้าเมื่อยอดถึงแล้ว", () => {
    expect(buildTrend(months, { "2026-11": 30, "2026-12": 30 }, 100, 2).status).toBe("on-track");
    expect(buildTrend(months, { "2026-11": 60, "2026-12": 50 }, 100).status).toBe("reached");
  });
  it("ไม่ตั้งเป้า", () => { expect(buildTrend(months, { "2026-11": 5 }, 0).status).toBe("no-target"); });
  it("เดือนที่ไม่มีข้อมูลระหว่างทางนับเป็น 0 ในค่าเฉลี่ย", () => {
    const t = buildTrend(months, { "2026-11": 30, "2027-01": 30 }, 100, 3);
    expect(t.points.map(p => p.actual)).toEqual([30, 30, 60, null]);
    expect(t.avgMonthly).toBe(20);
  });
  it("เส้นเป้าไล่ตามสัดส่วนเดือนจนถึงเป้าเต็มที่เดือนสุดท้าย", () => {
    expect(buildTrend(months, {}, 100).points.map(p => p.pace)).toEqual([25, 50, 75, 100]);
  });
});
