import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG, DEFAULT_SETTINGS, DISTRICTS, applyFiscalPeriods, areaPct, areaSeasonOf, areaTarget, baleValue, bkkDate, cfgOf, dueDateOf, dueDaysFor,
  effectiveTotal, fiscalRange, fiscalYearOf, isAreaMonth, lb, strawBales, strawTons, strawValue, tambonOf, thaiDate, thaiMonth, topicOff,
  validateAreaTotals, validateConfig, validateDueDays, validateSchedules, type Settings,
} from "@/lib/data";

beforeEach(() => applyFiscalPeriods([])); // ช่วงเดือนปีงบประมาณเป็นค่าสถานะระดับโมดูล ต้องล้างทุกเทสต์

describe("วันที่และเวลาไทย", () => {
  it("กำหนดส่งวันที่ 31 ปรับเป็นวันสุดท้ายของเดือนที่สั้นกว่า", () => {
    expect(dueDateOf("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateOf("2028-02", 31)).toBe("2028-02-29"); // ปีอธิกสุรทิน
    expect(dueDateOf("2026-04", 31)).toBe("2026-04-30");
    expect(dueDateOf("2026-05", 15)).toBe("2026-05-15");
  });
  it("bkkDate คิดตามเวลาไทย (UTC+7) ข้ามวันได้", () => {
    expect(bkkDate("2026-01-31T18:00:00Z")).toBe("2026-02-01");
    expect(bkkDate("2026-01-31T16:59:00Z")).toBe("2026-01-31");
  });
  it("แสดงเดือนและวันที่เป็น พ.ศ.", () => {
    expect(thaiMonth("2026-11")).toBe("พฤศจิกายน 2569");
    expect(thaiDate("2026-11-05")).toBe("5 พ.ย. 2569");
  });
});

describe("ปีงบประมาณและฤดูกาลไถกลบ", () => {
  it("ค่าเริ่มต้น พ.ย.–มิ.ย.: ปี 2570 = พ.ย. 2569 – มิ.ย. 2570", () => {
    expect(fiscalRange(2570)).toEqual({ from: "2026-11", to: "2027-06" });
    expect(fiscalYearOf("2026-11")).toBe(2570);
    expect(fiscalYearOf("2027-06")).toBe(2570);
    expect(fiscalYearOf("2027-07")).toBe(2571); // ก.ค.–ต.ค. นับเป็นปีถัดไป
    expect(fiscalYearOf("2026-10")).toBe(2570);
  });
  it("จังหวัดกำหนดช่วงเดือนเองได้ (ข้ามปี)", () => {
    applyFiscalPeriods([{ fy: 2570, startMonth: 10, endMonth: 9 }]);
    expect(fiscalRange(2570)).toEqual({ from: "2026-10", to: "2027-09" });
    expect(fiscalYearOf("2026-10")).toBe(2570);
  });
  it("ช่วงเดือนแยกตามหัวข้อ: ปุ๋ยจบ พ.ค. แต่ไถกลบถึง มิ.ย.", () => {
    applyFiscalPeriods([{ fy: 2570, startMonth: 11, endMonth: 6, topics: { fert: { startMonth: 11, endMonth: 5 } } }]);
    expect(topicOff("fert", "2027-06")).toBe(true);
    expect(topicOff("fert", "2027-05")).toBe(false);
    expect(isAreaMonth("2027-06")).toBe(true);
    expect(isAreaMonth("2026-09")).toBe(false);
  });
  it("เดือนนอกฤดูกาลให้ถือเป็นฤดูกาลที่เพิ่งจบ", () => {
    expect(areaSeasonOf("2026-09")).toEqual({ start: "2025-11", end: "2026-06" });
    expect(areaSeasonOf("2027-01")).toEqual({ start: "2026-11", end: "2027-06" });
  });
});

describe("สูตรไถกลบฟางข้าว", () => {
  it("คำนวณตามค่าคงที่ 35% / 500 กก. / 725 บาท / 25 ก้อน / 35 บาท", () => {
    expect(areaTarget(1000)).toBe(350);
    expect(strawTons(1000)).toBe(500);
    expect(strawValue(1000)).toBe(725000);
    expect(strawBales(1000)).toBe(25000);
    expect(baleValue(1000)).toBe(875000);
  });
  it("ร้อยละไม่เกิน 100 และหารศูนย์ได้ 0", () => {
    expect(areaPct(50, 200)).toBe(25);
    expect(areaPct(300, 200)).toBe(100);
    expect(areaPct(10, 0)).toBe(0);
  });
  it("ยังไม่ตั้งพื้นที่ปลูกทั้งหมด ใช้พื้นที่สะสมแทน", () => {
    expect(effectiveTotal(undefined, 120)).toBe(120);
    expect(effectiveTotal(0, 120)).toBe(120);
    expect(effectiveTotal(500, 120)).toBe(500);
  });
});

describe("การตั้งค่า", () => {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    schedules: [{ id: "a", topic: "fert", fy: 2570, dueDays: [10, 25] }],
    tambonSets: [{ id: "t", fy: 2570, perTambon: 100, tambon: { กันทรลักษ์: 20 } }],
    config: { ...DEFAULT_CONFIG, byYear: { "2570": { ...DEFAULT_CONFIG, targetPerTambon: 200 } } },
  };
  it("dueDaysFor เลือกตามหัวข้อและปีงบประมาณ ไม่มีใช้ค่าเริ่มต้น", () => {
    expect(dueDaysFor(settings, "fert", "2027-01")).toEqual([10, 25]);
    expect(dueDaysFor(settings, "area", "2027-01")).toEqual([31]);
    expect(dueDaysFor(settings, "fert")).toEqual([31]);
  });
  it("เกษตรตำบลและตัวคูณรายปีใช้แทนค่าเริ่มต้นเฉพาะปีนั้น", () => {
    const c = cfgOf(settings, 2570);
    expect(c.targetPerTambon).toBe(100); // tambonSets ชนะ byYear
    expect(tambonOf(c, DISTRICTS[0])).toBe(20);
    expect(tambonOf(c, DISTRICTS[1])).toBe(DISTRICTS[1].tambon); // อำเภออื่นใช้ค่าเริ่มต้น
    expect(cfgOf(settings, 2569).targetPerTambon).toBe(DEFAULT_CONFIG.targetPerTambon);
  });
  it("lb แทนค่าตัวแปรในหัวตาราง", () => {
    expect(lb(DEFAULT_CONFIG, "a.target", { pct: 35 })).toBe("เป้าหมายร้อยละ 35 (ไร่)");
    expect(lb({ ...DEFAULT_CONFIG, labels: { "t.total": "รวมสุทธิ" } }, "t.total")).toBe("รวมสุทธิ");
  });
});

describe("ตรวจความถูกต้องของข้อมูลตั้งค่า", () => {
  it("dueDays", () => {
    expect(validateDueDays([31])).toBeNull();
    expect(validateDueDays([10, 25])).toBeNull();
    expect(validateDueDays([])).not.toBeNull();
    expect(validateDueDays([5, 5])).not.toBeNull();
    expect(validateDueDays([32])).not.toBeNull();
    expect(validateDueDays([1, 2, 3, 4, 5])).not.toBeNull();
  });
  it("พื้นที่ปลูกรายอำเภอ", () => {
    expect(validateAreaTotals({ กันทรลักษ์: 100 })).toBeNull();
    expect(validateAreaTotals({ อำเภอปลอม: 100 })).not.toBeNull();
    expect(validateAreaTotals({ กันทรลักษ์: -1 })).not.toBeNull();
  });
  it("รายการที่ต้องรายงานห้ามซ้ำหัวข้อ+ปี", () => {
    const one = { id: "a", topic: "fert", fy: 2570, dueDays: [31] };
    expect(validateSchedules([one])).toBeNull();
    expect(validateSchedules([one, { ...one, id: "b" }])).not.toBeNull();
  });
  it("config", () => {
    expect(validateConfig(DEFAULT_CONFIG)).toBeNull();
    const f = DEFAULT_CONFIG.fertFields[0];
    expect(validateConfig({ ...DEFAULT_CONFIG, fertFields: [f, { ...f }] })).not.toBeNull(); // รหัสช่องซ้ำ
    expect(validateConfig({ ...DEFAULT_CONFIG, targetPerTambon: -5 })).not.toBeNull();
    expect(validateConfig({ ...DEFAULT_CONFIG, fertFields: [{ key: "1bad", label: "x", group: "g" }] })).not.toBeNull();
  });
});
