import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, DISTRICTS, type AreaReport, type BurnReport, type Report } from "@/lib/data";
import { buildPdf, yearStat } from "@/lib/pdf";

const who = { name: "x", position: "", phone: "" };
const fert = (district: string, month: string, manure: number): Report => ({ district, month, round: 1, values: { manure }, reporter: who, status: "submitted", updatedAt: "x" });
const burn = (district: string, month: string, v: Partial<Record<"activities" | "villages" | "participants" | "media", number>>, status: "submitted" | "draft" = "submitted"): BurnReport => ({ district, month, round: 1, values: v, reporter: who, status, updatedAt: "x" });
const area = (district: string, month: string, rai: number, status: "submitted" | "draft" = "submitted"): AreaReport => ({ district, month, round: 1, values: { area: rai }, reporter: who, status, updatedAt: "x" });

describe("yearStat (ตัวเลขในรายงาน PDF)", () => {
  it("รวมเฉพาะรายงานที่ส่งแล้วในปีงบประมาณนั้น และแยกหมวดปุ๋ย", () => {
    const s = yearStat([fert("ขุนหาญ", "2026-11", 40), fert("ขุนหาญ", "2025-11", 999)], [area("ขุนหาญ", "2026-11", 1000), area("ขุนหาญ", "2026-12", 500, "draft")], DEFAULT_SETTINGS, 2570);
    expect(s.total).toBe(40);
    expect(s.cats[0]).toBe(40);                       // หมวดปุ๋ยคอก
    expect(s.area).toMatchObject({ accum: 1000, bales: 25000, baleValue: 875000, straw: 500 });
    expect(s.notSent).toHaveLength(DISTRICTS.length - 1);
  });
});

describe("buildPdf", () => {
  const isPdf = (b: Buffer) => b.subarray(0, 5).toString() === "%PDF-" && b.length > 5000;
  it("ไม่มีข้อมูลเลยก็สร้างได้ (1 หน้า)", async () => {
    const buf = await buildPdf([], [], DEFAULT_SETTINGS, 2569);
    expect(isPdf(buf)).toBe(true);
    expect((buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
  });
  it("มีข้อมูลหลายปีก็สร้างได้ และตัวเลขยาวมากไม่ทำให้ล้ม", async () => {
    const reports = DISTRICTS.flatMap(d => ["2024-11", "2025-12", "2026-11"].map(m => fert(d.name, m, 123456.7)));
    const areas = DISTRICTS.flatMap(d => ["2024-11", "2025-12", "2026-11"].map(m => area(d.name, m, 987654321)));
    expect(isPdf(await buildPdf(reports, areas, DEFAULT_SETTINGS, 2569))).toBe(true);
  });
});

describe("ข้อมูลหยุดเผาในรายงาน (ใช้เฉพาะจำนวนกิจกรรมเรียนรู้/ประชาสัมพันธ์)", () => {
  const B = [
    burn("ขุนหาญ", "2026-11", { activities: 3, villages: 5, participants: 120, media: 10 }),
    burn("ขุนหาญ", "2026-12", { activities: 2, villages: 3, participants: 80, media: 6 }),
    burn("พยุห์", "2026-11", { activities: 1, participants: 30 }),
    burn("ราษีไศล", "2026-11", { activities: 9, villages: 9, participants: 999, media: 99 }, "draft"),   // ร่าง ไม่นับ
    burn("ขุนหาญ", "2025-11", { activities: 4, villages: 4, participants: 100, media: 8 }),            // ปีก่อน
  ];
  const cur = yearStat([], [], DEFAULT_SETTINGS, 2570, B), prev = yearStat([], [], DEFAULT_SETTINGS, 2569, B);
  it("สะสมเฉพาะรายงานที่ส่งแล้วในปีงบประมาณนั้น", () => {
    expect(cur.burn).toMatchObject({ activities: 6, sentD: 2 });
    expect(prev.burn.activities).toBe(4);
    expect(cur.burn.noActivity).toHaveLength(DISTRICTS.length - 2);
    expect(cur.burn.noActivity).not.toContain("ขุนหาญ");
  });
  it("ไม่มีหมายเหตุ/ข้อเสนอแนะ แต่มีหัวข้อประชาสัมพันธ์เรื่องการหยุดเผาใน PDF", async () => {
    const buf = await buildPdf([fert("ขุนหาญ", "2026-11", 5)], [], DEFAULT_SETTINGS, 2570, B);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const src = (await import("node:fs")).readFileSync("lib/pdf.ts", "utf8");
    expect(src).not.toMatch(/หมายเหตุ:|ข้อเสนอแนะ \(Recommendations\)|export function recommendations/);
    expect(src).toContain("การประชาสัมพันธ์เรื่องการหยุดเผา ปีงบประมาณ");
  });
  it("ไม่ทำให้ PDF ล้ม และยังเป็นหน้าเดียว (ทั้งมีและไม่มีข้อมูลหยุดเผา)", async () => {
    const reports = DISTRICTS.slice(0, 4).map(d => fert(d.name, "2026-11", 5));
    const buf = await buildPdf(reports, [], DEFAULT_SETTINGS, 2570, B);
    expect((buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    const empty = await buildPdf(reports, [], DEFAULT_SETTINGS, 2570, []);
    expect((empty.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
  });
});