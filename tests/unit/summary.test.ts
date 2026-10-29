import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, applyFiscalPeriods, type AreaReport, type BurnReport, type Report } from "@/lib/data";
import { aggregate, aggregateArea, aggregateBurn, monthsBetween, submissionByMonth, sumValues } from "@/lib/summary";

beforeEach(() => applyFiscalPeriods([]));
const who = { name: "x", position: "", phone: "" };
const rep = (district: string, month: string, values: Record<string, number>, o: Partial<Report> = {}): Report =>
  ({ district, month, round: 1, values, reporter: who, status: "submitted", updatedAt: "2026-01-01T00:00:00Z", ...o });
const area = (district: string, month: string, rai: number, o: Partial<AreaReport> = {}): AreaReport =>
  ({ district, month, round: 1, values: { area: rai }, reporter: who, status: "submitted", updatedAt: "2026-01-01T00:00:00Z", ...o });
const row = <T extends { name: string }>(rows: T[], name: string) => rows.find(r => r.name === name)!;
const KT = "กันทรลักษ์"; // เกษตรตำบล 12 ราย × 140 = 1,680 ตัน

describe("monthsBetween / sumValues", () => {
  it("ข้ามปีได้ และช่วงกลับด้านได้ว่าง", () => {
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(monthsBetween("2027-02", "2026-11")).toEqual([]);
  });
  it("sumValues นับเฉพาะช่องที่ยังอยู่ในการตั้งค่า", () => {
    expect(sumValues({ manure: 2, compost: 3 })).toBe(5);
    expect(sumValues({ ช่องที่ถูกลบ: 99 })).toBe(0);
  });
});

describe("aggregate (ปุ๋ยอินทรีย์)", () => {
  it("รวมเฉพาะรายงานที่ส่งแล้ว ในช่วงเดือน และคิดเป้าจากเกษตรตำบล", () => {
    const reports = [
      rep(KT, "2026-11", { manure: 10, compost: 5 }),
      rep(KT, "2026-12", { manure: 100 }, { status: "draft" }),            // ร่าง ไม่นับ
      rep(KT, "2026-10", { manure: 777 }),                                   // นอกช่วง ไม่นับ
      rep("ขุนหาญ", "2026-11", { manure: 1 }),
    ];
    const r = row(aggregate(reports, "2026-11", "2027-06").rows, KT);
    expect(r.total).toBe(15);
    expect(r.sums.manure).toBe(10);
    expect(r.target).toBe(12 * DEFAULT_CONFIG.targetPerTambon);
    expect(r.any).toBe(1);
  });
  it("นับรอบที่ส่งและเดือนที่ส่งครบ", () => {
    const one = [rep(KT, "2026-11", { manure: 1 })];
    const both = [...one, rep(KT, "2026-11", { manure: 2 }, { round: 2 })];
    expect(row(aggregate(one, "2026-11", "2026-11", 2).rows, KT)).toMatchObject({ sent: 0, got: { "2026-11": 1 } });
    expect(row(aggregate(both, "2026-11", "2026-11", 2).rows, KT)).toMatchObject({ sent: 1, total: 3 });
  });
  it("นับจำนวนครั้งที่ส่งช้า และให้ byMonth เป็น null เมื่อไม่มีข้อมูล", () => {
    const a = aggregate([rep(KT, "2026-11", { manure: 1 }, { late: true })], "2026-11", "2026-12");
    expect(row(a.rows, KT).late).toBe(1);
    expect(row(a.rows, KT).byMonth).toEqual({ "2026-11": 1, "2026-12": null });
  });
  it("ตัดเดือนที่หัวข้อปุ๋ยไม่ต้องรายงานตามช่วงที่จังหวัดตั้ง", () => {
    applyFiscalPeriods([{ fy: 2570, startMonth: 11, endMonth: 6, topics: { fert: { startMonth: 11, endMonth: 5 } } }]);
    expect(aggregate([], "2026-11", "2027-06").months).not.toContain("2027-06");
  });
});

describe("aggregateArea (พื้นที่และฟางข้าว)", () => {
  const totals = { [KT]: 1000 };
  it("สะสมตั้งแต่ต้นฤดูกาลถึงเดือนที่เลือก แล้วคำนวณฟาง/มูลค่า/ฟางก้อน", () => {
    const reports = [area(KT, "2026-11", 100), area(KT, "2026-12", 200, { round: 2 }), area(KT, "2026-10", 999)];
    const r = row(aggregateArea(reports, "2026-12", totals).rows, KT);
    expect(r).toMatchObject({ accum: 300, total: 1000, target: 350, pct: 30, straw: 150, value: 217500, bales: 7500, baleValue: 262500 });
    expect(r.ofTarget).toBeCloseTo(85.714, 2);
  });
  it("ยังไม่ตั้งพื้นที่ปลูก = ใช้พื้นที่สะสมแทน (ร้อยละ 100, assigned=false)", () => {
    const r = row(aggregateArea([area(KT, "2026-11", 80)], "2026-11", {}).rows, KT);
    expect(r).toMatchObject({ total: 80, pct: 100, assigned: false });
  });
  it("เริ่มนับใหม่ทุกฤดูกาล และเดือน ก.ค.–ต.ค. ใช้ฤดูกาลที่เพิ่งจบ", () => {
    const reports = [area(KT, "2026-11", 100)];
    expect(row(aggregateArea(reports, "2027-11", totals).rows, KT).accum).toBe(0);
    expect(row(aggregateArea(reports, "2027-08", totals).rows, KT).accum).toBe(100);
  });
  it("ไม่นับร่าง", () => {
    expect(row(aggregateArea([area(KT, "2026-11", 100, { status: "draft" })], "2026-11", totals).rows, KT).accum).toBe(0);
  });
});

describe("aggregateBurn (หยุดเผา)", () => {
  it("รวมตามช่องและนับเดือนที่ส่งครบ", () => {
    const b = (district: string, month: string, values: Record<string, number>): BurnReport => ({ district, month, round: 1, values, reporter: who, status: "submitted", updatedAt: "x" });
    const r = aggregateBurn([b(KT, "2026-11", { activities: 2, participants: 40 }), b(KT, "2026-12", { activities: 3 })], "2026-11", "2026-12");
    expect(row(r.rows, KT)).toMatchObject({ sent: 2, sums: { activities: 5, participants: 40 } });
    expect(r.sums.activities).toBe(5);
  });
});

describe("submissionByMonth (ประวัติการส่ง)", () => {
  const sub = (district: string, round: number, late: boolean) => ({ district, month: "2026-11", round, status: "submitted" as const, late, dueDate: round === 1 ? "2026-11-10" : "2026-11-25" });
  it("แยกสถานะ ตรงเวลา/ช้า/ขาดส่ง/ยังไม่ถึงกำหนด", () => {
    const r = submissionByMonth([sub(KT, 1, false)], "2026-11", [10, 25], "2026-11-15");
    expect(row(r.rows, KT)).toMatchObject({ state: "waiting" });          // รอบ 2 ยังไม่ถึง 25
    expect(row(r.rows, "ขุนหาญ")).toMatchObject({ state: "missing" });    // รอบ 1 เลยกำหนด 10 แล้วไม่ส่ง
    expect(r.counts.missing).toBe(21);
  });
  it("ส่งช้าได้สถานะ late และส่งครบตรงเวลาได้ ontime", () => {
    const r = submissionByMonth([sub(KT, 1, false), sub(KT, 2, true), sub("ขุนหาญ", 1, false), sub("ขุนหาญ", 2, false)], "2026-11", [10, 25], "2026-12-01");
    expect(row(r.rows, KT).state).toBe("late");
    expect(row(r.rows, "ขุนหาญ").state).toBe("ontime");
  });
  it("รายงานร่างไม่นับว่าส่ง แต่แสดงว่ามีร่าง", () => {
    const r = submissionByMonth([{ district: KT, month: "2026-11", round: 1, status: "draft" }], "2026-11", [10], "2026-11-05");
    expect(row(r.rows, KT).cells[0]).toMatchObject({ state: "waiting", draft: true });
  });
});
