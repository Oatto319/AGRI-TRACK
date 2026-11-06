import { createHash } from "node:crypto";
import type { ObjectId } from "mongodb";
import { bkkDate } from "./data";
import { db } from "./mongo";
import { budgetYearOfMonth, computeStatus, totalOf, windowStartMonth, budgetYearOfDate, type Counts, type ExportRecord, type RetentionStatus } from "./retention";

// ชั้นฐานข้อมูลของระบบเก็บข้อมูล 5 ปี — ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
const TABLES = ["reports", "area_reports", "burn_reports"] as const;
const KEY = { reports: "reports", area_reports: "area", burn_reports: "burn" } as const;
type ArchiveRow = { _id: ObjectId | string; [key: string]: unknown };

/** จำนวนรายการดิบต่อปีงบประมาณ + รายชื่อเดือนที่มีข้อมูลของแต่ละปี (ใช้ตอนลบ) */
export async function fyInventory() {
  const database = await db(), counts = new Map<number, Counts>();
  const rowsByFy = new Map<number, { reports: ArchiveRow[]; area: ArchiveRow[]; burn: ArchiveRow[] }>();
  for (const t of TABLES) {
    const rows = await database.collection<ArchiveRow>(t).find({}).toArray();
    for (const r of rows) {
      if (typeof r.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)) continue;
      const fy = budgetYearOfMonth(r.month), c = counts.get(fy) ?? { reports: 0, area: 0, burn: 0 };
      c[KEY[t]]++; counts.set(fy, c);
      const dataset = rowsByFy.get(fy) ?? { reports: [], area: [], burn: [] };
      dataset[KEY[t]].push(r);
      rowsByFy.set(fy, dataset);
    }
  }
  const snapshots = new Map([...rowsByFy].map(([fy, rows]) => {
    const canonical = (value: unknown): unknown => {
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (obj._bsontype === "ObjectId") return String(value);
        return Object.fromEntries(Object.keys(obj).sort().map(key => [key, canonical(obj[key])]));
      }
      return value;
    };
    const sortRows = (items: Record<string, unknown>[]) => items.map(canonical).sort((a, b) => {
      const left = JSON.stringify(a), right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const dataRows = (items: ArchiveRow[]) =>
      items.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_id")));
    const data = JSON.stringify({
      reports: sortRows(dataRows(rows.reports)),
      area: sortRows(dataRows(rows.area)),
      burn: sortRows(dataRows(rows.burn)),
    });
    return [fy, fingerprint(data)] as const;
  }));
  return { counts, snapshots, rowsByFy };
}

export async function readExportLogs(): Promise<ExportRecord[]> {
  const rows = await (await db()).collection("archive_log").find({ kind: "export" }, { projection: { _id: 0 } }).sort({ at: 1 }).toArray();
  return rows as unknown as ExportRecord[];
}

export async function getRetentionStatus(today = bkkDate()): Promise<RetentionStatus> {
  const [{ counts, snapshots }, logs] = await Promise.all([fyInventory(), readExportLogs()]);
  return computeStatus(today, counts, logs, snapshots);
}

export async function logExport(rec: Omit<ExportRecord, "at"> & { at?: string }) {
  await (await db()).collection("archive_log").insertOne({ kind: "export", ...rec, at: rec.at ?? new Date().toISOString() });
}
export const fingerprint = (buf: Buffer | string) => createHash("sha256").update(buf).digest("hex");

export class ArchiveChangedError extends Error {
  constructor() { super("ข้อมูลปีงบประมาณเปลี่ยนหลังสำรองข้อมูล"); }
}

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

/** ลบเฉพาะแถวใน snapshot ที่ตรวจแล้วและยังมี version เดิม */
export async function purgeFy(fy: number, by: string, expectedSnapshotSha256: string) {
  const { counts, snapshots, rowsByFy } = await fyInventory(), database = await db();
  const before = counts.get(fy) ?? { reports: 0, area: 0, burn: 0 };
  if (totalOf(before) === 0) return { deleted: before };
  if (snapshots.get(fy) !== expectedSnapshotSha256) throw new ArchiveChangedError();
  for (const t of TABLES) {
    const collection = database.collection<ArchiveRow>(t);
    for (const row of rowsByFy.get(fy)?.[KEY[t]] ?? []) {
      const filter = typeof row.version === "number"
        ? { _id: row._id, version: row.version }
        : { _id: row._id, version: { $exists: false } };
      const result = await collection.deleteOne(filter);
      if (result.deletedCount !== 1) throw new ArchiveChangedError();
    }
  }
  const remaining = await fyInventory();
  if (totalOf(remaining.counts.get(fy) ?? { reports: 0, area: 0, burn: 0 }) > 0) throw new ArchiveChangedError();
  await database.collection("archive_log").insertOne({ kind: "purge", fy, at: new Date().toISOString(), by, counts: before });
  return { deleted: before };
}
