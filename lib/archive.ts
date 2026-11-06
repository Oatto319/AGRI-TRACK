import { createHash } from "node:crypto";
import { bkkDate } from "./data";
import { db } from "./mongo";
import { budgetYearOfMonth, computeStatus, totalOf, windowStartMonth, budgetYearOfDate, type Counts, type ExportRecord, type RetentionStatus } from "./retention";

// ชั้นฐานข้อมูลของระบบเก็บข้อมูล 5 ปี — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
const TABLES = ["reports", "area_reports", "burn_reports"] as const;
const KEY = { reports: "reports", area_reports: "area", burn_reports: "burn" } as const;

/** จำนวนรายการดิบต่อปีงบประมาณ + รายชื่อเดือนที่มีข้อมูลของแต่ละปี (ใช้ตอนลบ) */
export async function fyInventory() {
  const database = await db(), counts = new Map<number, Counts>(), months = new Map<number, Set<string>>();
  for (const t of TABLES) {
    const rows = await database.collection(t).find({}, { projection: { _id: 0, month: 1 } }).toArray();
    for (const r of rows as { month?: unknown }[]) {
      if (typeof r.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) continue;
      const fy = budgetYearOfMonth(r.month), c = counts.get(fy) ?? { reports: 0, area: 0, burn: 0 };
      c[KEY[t]]++; counts.set(fy, c);
      (months.get(fy) ?? months.set(fy, new Set()).get(fy)!).add(r.month);
    }
  }
  return { counts, months };
}

export async function readExportLogs(): Promise<ExportRecord[]> {
  const rows = await (await db()).collection("archive_log").find({ kind: "export" }, { projection: { _id: 0 } }).sort({ at: 1 }).toArray();
  return rows as unknown as ExportRecord[];
}

export async function getRetentionStatus(today = bkkDate()): Promise<RetentionStatus> {
  const [{ counts }, logs] = await Promise.all([fyInventory(), readExportLogs()]);
  return computeStatus(today, counts, logs);
}

export async function logExport(rec: Omit<ExportRecord, "at"> & { at?: string }) {
  await (await db()).collection("archive_log").insertOne({ kind: "export", ...rec, at: rec.at ?? new Date().toISOString() });
}
export const fingerprint = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

/**
 * ตรวจเร็วก่อนทุกครั้งที่บันทึกข้อมูล: มีข้อมูลเดือนที่หลุดกรอบอยู่หรือไม่ (ค้นเดือนที่น้อยกว่าต้นกรอบ 1 รายการต่อคอลเลกชัน)
 * ไม่มี = ไม่ล็อก ไม่ต้องคำนวณสถานะเต็ม · มี = คำนวณสถานะเต็มว่า export ครบแล้วหรือยัง
 */
export async function lockedStatus(today = bkkDate()): Promise<RetentionStatus | null> {
  const database = await db(), before = windowStartMonth(budgetYearOfDate(today));
  let any = false;
  for (const t of TABLES) if (await database.collection(t).findOne({ month: { $lt: before } }, { projection: { _id: 1 } })) { any = true; break; }
  if (!any) return null;
  const s = await getRetentionStatus(today);
  return s.level === "locked" ? s : null;
}

/** ลบข้อมูลของปีงบประมาณ fy ออกจากฐานข้อมูล (เรียกเมื่อผ่านการตรวจ purgeReady แล้วเท่านั้น) */
export async function purgeFy(fy: number, by: string) {
  const { counts, months } = await fyInventory(), database = await db(), list = [...(months.get(fy) ?? [])];
  const before = counts.get(fy) ?? { reports: 0, area: 0, burn: 0 };
  if (list.length === 0 || totalOf(before) === 0) return { deleted: before };
  for (const t of TABLES) await database.collection(t).deleteMany({ month: { $in: list } });
  await database.collection("archive_log").insertOne({ kind: "purge", fy, at: new Date().toISOString(), by, counts: before });
  return { deleted: before };
}
