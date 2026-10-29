import { describe, expect, it } from "vitest";
import { detectAnomalies, median, scanReports } from "@/lib/anomaly";

const fields = [{ key: "manure", label: "ปุ๋ยคอก" }, { key: "compost", label: "ปุ๋ยหมัก" }];
const hist = (...xs: number[]) => xs.map(manure => ({ manure }));

describe("detectAnomalies", () => {
  it("ค่าปกติไม่เตือน", () => {
    expect(detectAnomalies({ values: { manure: 22 }, history: hist(20, 25, 18), fields })).toEqual([]);
  });
  it("สูงกว่าค่าปกติ 3 เท่าขึ้นไปเตือน และ 10 เท่าถือว่าสูงมาก", () => {
    const w = detectAnomalies({ values: { manure: 80 }, history: hist(20, 25, 20), fields });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ key: "manure", kind: "spike", level: "warn", baseline: 20 });
    expect(detectAnomalies({ values: { manure: 500 }, history: hist(20, 25, 20), fields })[0].level).toBe("high");
  });
  it("ค่าเล็กมากไม่เตือนเกินเหตุ (ต่างไม่ถึง 10 หน่วย)", () => {
    expect(detectAnomalies({ values: { manure: 6 }, history: hist(1, 2, 1), fields })).toEqual([]);
  });
  it("ประวัติไม่พอ (น้อยกว่า 2 ครั้ง) ไม่เทียบกับค่าปกติ", () => {
    expect(detectAnomalies({ values: { manure: 900 }, history: hist(10), fields })).toEqual([]);
  });
  it("เป็น 0 หลังมีค่าติดกัน 3 ครั้งเตือน แต่ถ้าเคยเป็น 0 มาก่อนไม่เตือน", () => {
    expect(detectAnomalies({ values: { manure: 0 }, history: hist(5, 6, 7), fields })[0]).toMatchObject({ kind: "dropped" });
    expect(detectAnomalies({ values: { manure: 0 }, history: hist(5, 0, 7), fields })).toEqual([]);
  });
  it("ช่องเดียวเกินครึ่งของเป้าหมายทั้งปีเตือนแม้ไม่มีประวัติ", () => {
    const w = detectAnomalies({ values: { manure: 900 }, history: [], fields, target: 1680 });
    expect(w[0]).toMatchObject({ kind: "huge", level: "high" });
  });
  it("ยอดสะสมรวมเกินเป้า 1.5 เท่าเตือน", () => {
    const w = detectAnomalies({ values: { manure: 100, compost: 100 }, history: [], fields, target: 1000, cumulativeBefore: 1400 });
    expect(w.some(a => a.kind === "over-target")).toBe(true);
  });
  it("ข้ามช่องที่ไม่ได้กรอก ค่าติดลบ หรือไม่ใช่ตัวเลข", () => {
    expect(detectAnomalies({ values: { manure: -5, compost: NaN }, history: hist(1, 1, 1), fields })).toEqual([]);
  });
  it("median", () => { expect(median([3, 1, 2])).toBe(2); expect(median([1, 2, 3, 4])).toBe(2.5); expect(median([])).toBe(0); });
});

describe("scanReports", () => {
  const r = (month: string, manure: number, district = "กันทรลักษ์") => ({ district, month, round: 1, status: "submitted" as const, values: { manure } });
  it("เทียบแต่ละรายงานกับประวัติก่อนหน้าของอำเภอนั้น และรายงานเฉพาะที่อยู่ในช่วง", () => {
    const rows = [r("2026-11", 20), r("2026-12", 22), r("2027-01", 21), r("2027-02", 400), r("2027-02", 5000, "ขุนหาญ")];
    const hits = scanReports(rows, fields, "2027-02", "2027-02");
    expect(hits.map(h => h.district)).toEqual(["กันทรลักษ์"]); // ขุนหาญไม่มีประวัติ จึงไม่ถูกเทียบ
    expect(hits[0]).toMatchObject({ month: "2027-02", kind: "spike" });
    expect(scanReports(rows, fields, "2026-11", "2027-01")).toEqual([]);
  });
  it("ไม่นับร่าง", () => {
    expect(scanReports([r("2026-11", 20), r("2026-12", 22), r("2027-01", 21), { ...r("2027-02", 400), status: "draft" as never }], fields, "2027-02", "2027-02")).toEqual([]);
  });
});
