import { DEFAULT_CONFIG, applyFiscalPeriods, normalizeFiscalYears, DEFAULT_SETTINGS, DISTRICTS, validateAreaTotals, validateConfig, validateDueDays, validateSchedules, validateAreaSets, validateTambonSets, type AppConfig, type AreaReport, type BurnReport, type Report, type Settings } from "./data";
import { db } from "./mongo";

// เก็บข้อมูลใน MongoDB — คอลเลกชัน reports, area_reports, settings (ดู lib/mongo.ts)
type Row = Record<string, unknown>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// ช่องตัวเลขเพิ่ม/ลดได้ตามการตั้งค่าของจังหวัด จึงไม่ตรวจชื่อคีย์ที่นี่ — คีย์ที่ถูกลบออกจากการตั้งค่าจะถูกข้ามตอนสรุปผล (ข้อมูลยังอยู่ในฐานข้อมูล)
function validReport(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.values) || !isRecord(value.reporter)) return false;
  return typeof value.district === "string" &&
    DISTRICTS.some(district => district.name === value.district) &&
    typeof value.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value.month) &&
    (value.status === "draft" || value.status === "submitted") &&
    typeof value.reporter.name === "string" &&
    typeof value.reporter.position === "string" &&
    typeof value.reporter.phone === "string" &&
    typeof value.updatedAt === "string" &&
    (value.round === undefined || (typeof value.round === "number" && Number.isInteger(value.round) && value.round >= 1)) &&
    (value.submittedAt === undefined || typeof value.submittedAt === "string") &&
    (value.dueDate === undefined || typeof value.dueDate === "string") &&
    (value.late === undefined || typeof value.late === "boolean") &&
    Object.values(value.values).every(amount =>
      typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

const isReport = (v: unknown): v is Report => validReport(v);
const isBurnReport = (v: unknown): v is BurnReport => validReport(v);
const isAreaReport = (v: unknown): v is AreaReport => validReport(v);

// แถวในฐานข้อมูล <-> รูปแบบ JSON ที่แอปใช้
const fromRow = (r: Row) => ({
  district: r.district, month: r.month, round: r.round, values: r.amounts, reporter: r.reporter, status: r.status, updatedAt: r.updated_at,
  ...(r.submitted_at != null ? { submittedAt: r.submitted_at } : {}),
  ...(r.due_date != null ? { dueDate: r.due_date } : {}),
  ...(r.late != null ? { late: r.late } : {}),
});
const toRow = (r: Report | AreaReport | BurnReport) => ({
  district: r.district, month: r.month, round: r.round ?? 1, status: r.status, reporter: r.reporter, amounts: r.values, updated_at: r.updatedAt,
  submitted_at: r.submittedAt ?? null, due_date: r.dueDate ?? null, late: r.late ?? null,
});

function parseReport(row: Row): Report {
  const v = fromRow(row);
  if (!isReport(v)) throw new Error(`Invalid report row in reports (${String(row.district)} ${String(row.month)} รอบ ${String(row.round)})`);
  return { ...v, round: v.round ?? 1 };
}
// รายงานพื้นที่รูปแบบเก่า (ก่อนเปลี่ยนมากรอกไร่รายเดือน) ไม่มีค่า "area" จึงนับเป็น 0 — ต้องกรอกใหม่
function parseArea(row: Row): AreaReport {
  const v = fromRow(row);
  if (!isAreaReport(v)) throw new Error(`Invalid report row in area_reports (${String(row.district)} ${String(row.month)} รอบ ${String(row.round)})`);
  return { ...v, round: v.round ?? 1, values: v.values.area === undefined ? {} : { area: v.values.area } };
}

function parseBurn(row: Row): BurnReport {
  const v = fromRow(row);
  if (!isBurnReport(v)) throw new Error(`Invalid report row in burn_reports (${String(row.district)} ${String(row.month)} รอบ ${String(row.round)})`);
  return { ...v, round: v.round ?? 1 };
}

type Table = "reports" | "area_reports" | "burn_reports";
const NO_ID = { projection: { _id: 0 } } as const; // ไม่ต้องการ _id ของ Mongo ในข้อมูลที่แอปใช้

export interface ReportFilter { district?: string; month?: string }
// กรองที่ฐานข้อมูล (ไม่ดึงทั้งคอลเลกชันมากรองในหน่วยความจำ) และเรียงตามอำเภอ/เดือน/รอบ
async function fetchAll(table: Table, f: ReportFilter = {}): Promise<Row[]> {
  const q: Record<string, string> = {};
  if (f.district) q.district = f.district;
  if (f.month) q.month = f.month;
  const rows = await (await db()).collection(table).find(q, NO_ID).sort({ district: 1, month: 1, round: 1 }).toArray();
  return rows as Row[];
}
// แถวที่ผิดรูปแบบ 1 แถวต้องไม่ทำให้ทั้งหน้าพัง — ข้ามแถวนั้นและบันทึก log ให้ผู้ดูแลตรวจสอบ
function parseAll<T>(rows: Row[], parse: (r: Row) => T): T[] {
  const out: T[] = [];
  for (const r of rows) { try { out.push(parse(r)); } catch (e) { console.error("[store] ข้ามแถวที่ข้อมูลไม่ถูกต้อง:", e instanceof Error ? e.message : e); } }
  return out;
}
export async function readAll(f?: ReportFilter): Promise<Report[]> { return parseAll(await fetchAll("reports", f), parseReport); }
export async function readAreaAll(f?: ReportFilter): Promise<AreaReport[]> { return parseAll(await fetchAll("area_reports", f), parseArea); }
export async function readBurnAll(f?: ReportFilter): Promise<BurnReport[]> { return parseAll(await fetchAll("burn_reports", f), parseBurn); }

/** มีผู้อื่นบันทึกรายงานเดียวกันตัดหน้าไป (ใช้ตอบ HTTP 409) */
export class ConflictError extends Error { constructor() { super("มีผู้อื่นบันทึกรายงานนี้พร้อมกัน กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง"); } }

// อ่านรายงานเดิม (ถ้ามี) -> fn คืนรายงานใหม่ (โยน Error เพื่อปฏิเสธ) -> เขียนกลับ ตามคีย์ อำเภอ+เดือน+รอบ
// ล็อกแบบ optimistic: แต่ละแถวมี version เพิ่มทีละ 1 — ถ้าระหว่างอ่านกับเขียนมีคนอื่นแก้ไปก่อน จะเขียนไม่สำเร็จและโยน ConflictError แทนที่จะเขียนทับเงียบ ๆ
// (แถวเก่าที่ยังไม่มี version ถือเป็น version 0)
async function mutate<T extends Report | AreaReport | BurnReport>(table: Table, parse: (r: Row) => T, district: string, month: string, round: number, fn: (old?: T) => T): Promise<T> {
  const col = (await db()).collection(table), key = { district, month, round };
  const data = await col.findOne(key, NO_ID);
  const r = fn(data ? parse(data as Row) : undefined);
  const version = typeof data?.version === "number" ? data.version : 0;
  const row = { ...toRow(r), version: version + 1 };
  if (data) {
    const res = await col.replaceOne(version ? { ...key, version } : { ...key, version: { $exists: false } }, row);
    if (res.matchedCount === 0) throw new ConflictError();
  } else {
    try { await col.insertOne(row); }
    catch (e) { if ((e as { code?: number }).code === 11000) throw new ConflictError(); throw e; }
  }
  return r;
}
export const update = (district: string, month: string, round: number, fn: (old?: Report) => Report) => mutate("reports", parseReport, district, month, round, fn);
export const updateArea = (district: string, month: string, round: number, fn: (old?: AreaReport) => AreaReport) => mutate("area_reports", parseArea, district, month, round, fn);

function parseSettings(s: unknown): Settings {
  if (!isRecord(s) || validateDueDays(s.dueDays)) throw new Error("Invalid settings in table settings");
  const areaTotals = s.areaTotals === undefined ? {} : s.areaTotals; // ข้อมูลเก่าไม่มี areaTotals
  if (validateAreaTotals(areaTotals)) throw new Error("Invalid areaTotals in table settings");
  const schedules = s.schedules === undefined ? [] : s.schedules; // ข้อมูลเก่าไม่มี schedules
  if (validateSchedules(schedules)) throw new Error("Invalid schedules in table settings");
  const areaSets = s.areaSets === undefined ? [] : s.areaSets; // ข้อมูลเก่าไม่มี areaSets
  if (validateAreaSets(areaSets)) throw new Error("Invalid areaSets in table settings");
  const tambonSets = s.tambonSets === undefined ? [] : s.tambonSets; // ข้อมูลเก่าไม่มี tambonSets
  if (validateTambonSets(tambonSets)) throw new Error("Invalid tambonSets in table settings");
  // ข้อมูลเก่าไม่มี config -> ใช้ค่าเริ่มต้น · ถ้ามีเพียงบางส่วนให้เติมส่วนที่ขาดด้วยค่าเริ่มต้น
  const config: AppConfig = { ...DEFAULT_CONFIG, ...(isRecord(s.config) ? (s.config as Partial<AppConfig>) : {}) };
  config.fiscalYears = normalizeFiscalYears(config.fiscalYears);
  if (validateConfig(config)) throw new Error("Invalid config in table settings");
  applyFiscalPeriods(config.fiscalYears); // ใช้ช่วงเดือนของแต่ละปีงบประมาณที่จังหวัดตั้งไว้ในทุกการคำนวณฝั่งเซิร์ฟเวอร์
  return { dueDays: s.dueDays as number[], areaTotals: areaTotals as Record<string, number>, schedules: schedules as Settings["schedules"], areaSets: areaSets as Settings["areaSets"], tambonSets: tambonSets as Settings["tambonSets"], config };
}
// การตั้งค่าเก็บเป็นเอกสารเดียว (_id = "main") ในคอลเลกชัน settings
export async function readSettings(): Promise<Settings> {
  const doc = await (await db()).collection<{ _id: string; data: unknown }>("settings").findOne({ _id: "main" });
  return doc ? parseSettings(doc.data) : DEFAULT_SETTINGS;
}
export async function writeSettings(s: Settings) {
  await (await db()).collection<{ _id: string; data: Settings; updated_at: string }>("settings")
    .replaceOne({ _id: "main" }, { data: s, updated_at: new Date().toISOString() }, { upsert: true }); // upsert ใช้ _id จาก filter
}
export const updateBurn = (district: string, month: string, round: number, fn: (old?: BurnReport) => BurnReport) => mutate("burn_reports", parseBurn, district, month, round, fn);
