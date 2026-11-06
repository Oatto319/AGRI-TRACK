// กติกาเก็บข้อมูลย้อนหลัง 5 ปีงบประมาณ (ฟังก์ชันล้วน ไม่แตะฐานข้อมูล — ทดสอบได้ตรง ๆ)
// ปีงบประมาณที่นี่ใช้ปฏิทินราชการ ต.ค.–ก.ย. (เหมือนตัวเลือกปีงบประมาณในหน้าจังหวัด) แยกจากช่วงเดือนรายงานที่จังหวัดตั้งเอง (เช่น พ.ย.–มิ.ย.)
// กรอบเก็บข้อมูล = ปีงบประมาณปัจจุบัน + ย้อนหลังอีก 4 ปี · ข้อมูลของปีที่หลุดกรอบต้อง export ก่อน ระบบจึงยอมให้ใช้งานต่อ

export const RETENTION_YEARS = 5;
export const WARN_DAYS = 60; // เริ่มเตือนจังหวัดก่อนขึ้นปีงบประมาณใหม่ (1 ต.ค.) กี่วัน

export const budgetYearOfMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y + 543 + (m >= 10 ? 1 : 0); };
export const budgetYearOfDate = (ymd: string) => budgetYearOfMonth(ymd.slice(0, 7));
/** ปีงบประมาณ fy (พ.ศ.) = 1 ต.ค. ของ ค.ศ. fy-544 ถึง 30 ก.ย. ของ ค.ศ. fy-543 */
export const budgetYearMonths = (fy: number) => ({ from: `${fy - 544}-10`, to: `${fy - 543}-09` });
/** ปีงบประมาณเก่าสุดที่ยังอยู่ในกรอบ ณ ปีงบประมาณปัจจุบัน */
export const oldestKeptFy = (currentFy: number) => currentFy - (RETENTION_YEARS - 1);
/** ปีงบประมาณ fy หลุดกรอบแล้วหรือยัง */
export const isExpiredFy = (fy: number, currentFy: number) => fy < oldestKeptFy(currentFy);
/** เดือนแรกของปีงบประมาณเก่าสุดที่ยังเก็บ — เดือนที่น้อยกว่านี้คือข้อมูลที่หลุดกรอบ */
export const windowStartMonth = (currentFy: number) => budgetYearMonths(oldestKeptFy(currentFy)).from;
/** วันที่ปีงบประมาณใหม่เริ่ม (1 ต.ค. ถัดไป) */
export const nextRolloverDate = (currentFy: number) => `${currentFy - 543}-10-01`;
export const daysBetween = (fromYmd: string, toYmd: string) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86400e3);

export type Counts = { reports: number; area: number; burn: number };
export const totalOf = (c: Counts) => c.reports + c.area + c.burn;
const sameCounts = (a: Counts, b: Counts) => a.reports === b.reports && a.area === b.area && a.burn === b.burn;

export type ExportFormat = "xlsx" | "json";
export interface ExportRecord { fy: number; format: ExportFormat; at: string; by: string; counts: Counts; bytes?: number; sha256?: string; dataSha256?: string }

export type Level = "ok" | "warn" | "locked";
export interface FyItem {
  fy: number; counts: Counts; total: number; expired: boolean;
  snapshotSha256?: string;
  xlsxAt?: string; jsonAt?: string; // เวลา export ล่าสุดที่จำนวนรายการยังตรงกับข้อมูลปัจจุบัน (ถ้าข้อมูลเปลี่ยนหลัง export ถือว่ายังไม่ได้ export)
  exported: boolean;   // มีไฟล์ Excel ที่ตรงกับข้อมูลปัจจุบัน → ปลดล็อกได้
  purgeReady: boolean; // มีทั้ง Excel และ JSON ที่ตรงกับข้อมูลปัจจุบัน → ลบข้อมูลเก่าได้
}
export interface RetentionStatus {
  level: Level; today: string; currentFy: number; oldestKeptFy: number; rolloverDate: string; daysToRollover: number;
  items: FyItem[];      // ทุกปีงบประมาณที่มีข้อมูล (เก่า → ใหม่)
  blocking: number[];   // ปีที่หลุดกรอบและยังไม่ได้ export (ทำให้ล็อก)
  expiring: number | null; // ปีที่จะหลุดกรอบเมื่อขึ้นปีงบประมาณใหม่ และอยู่ในช่วงเตือน แต่ยังไม่ได้ export
  message: string;
}

const latest = (logs: ExportRecord[], fy: number, format: ExportFormat, counts: Counts, snapshotSha256?: string) =>
  logs.filter(l => l.fy === fy && l.format === format && sameCounts(l.counts, counts) && !!snapshotSha256 && l.dataSha256 === snapshotSha256).map(l => l.at).sort().pop();

export function computeStatus(today: string, counts: Map<number, Counts>, logs: ExportRecord[], snapshots: Map<number, string>): RetentionStatus {
  const currentFy = budgetYearOfDate(today), rolloverDate = nextRolloverDate(currentFy), daysToRollover = daysBetween(today, rolloverDate);
  const items: FyItem[] = [...counts.entries()].filter(([, c]) => totalOf(c) > 0).sort((a, b) => a[0] - b[0]).map(([fy, c]) => {
    const snapshotSha256 = snapshots.get(fy);
    const xlsxAt = latest(logs, fy, "xlsx", c, snapshotSha256), jsonAt = latest(logs, fy, "json", c, snapshotSha256);
    return { fy, counts: c, total: totalOf(c), expired: isExpiredFy(fy, currentFy), ...(snapshotSha256 ? { snapshotSha256 } : {}), ...(xlsxAt ? { xlsxAt } : {}), ...(jsonAt ? { jsonAt } : {}), exported: !!xlsxAt, purgeReady: !!xlsxAt && !!jsonAt };
  });
  const blocking = items.filter(i => i.expired && !i.exported).map(i => i.fy);
  const oldest = oldestKeptFy(currentFy), next = items.find(i => i.fy === oldest);
  const expiring = blocking.length === 0 && next && !next.exported && daysToRollover <= WARN_DAYS ? next.fy : null;
  const level: Level = blocking.length ? "locked" : expiring !== null ? "warn" : "ok";
  const message = level === "locked"
    ? `ข้อมูลปีงบประมาณ ${blocking.join(", ")} หลุดกรอบการเก็บ ${RETENTION_YEARS} ปีแล้ว ต้อง export ก่อนจึงจะใช้งานต่อได้`
    : level === "warn"
      ? `อีก ${daysToRollover} วัน (${rolloverDate}) จะขึ้นปีงบประมาณ ${currentFy + 1} ข้อมูลปีงบประมาณ ${expiring} จะหลุดกรอบการเก็บ ${RETENTION_YEARS} ปี กรุณา export ไว้ล่วงหน้า`
      : "ข้อมูลอยู่ในกรอบการเก็บตามกำหนด";
  return { level, today, currentFy, oldestKeptFy: oldest, rolloverDate, daysToRollover, items, blocking, expiring, message };
}
