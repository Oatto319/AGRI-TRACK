import { promises as fs } from "fs";
import path from "path";
import { AREA_FIELDS, AREA_LEGACY_KEYS, DEFAULT_SETTINGS, DISTRICTS, FIELDS, validateAreaTotals, validateDueDays, type AreaReport, type Report, type Settings } from "./data";

// เก็บเป็นไฟล์ JSON (data/reports.json) — เหมาะกับเซิร์ฟเวอร์เดียว หากย้ายไปใช้ฐานข้อมูลให้แก้เฉพาะไฟล์นี้
const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "reports.json"), SFILE = path.join(DIR, "settings.json"), AFILE = path.join(DIR, "area-reports.json");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function validReport(value: unknown, keys: readonly string[]): boolean {
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
    Object.entries(value.values).every(([key, amount]) =>
      keys.includes(key) &&
      typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

const isReport = (v: unknown): v is Report => validReport(v, FIELDS.map(f => f.key));
const isAreaReport = (v: unknown): v is AreaReport => validReport(v, [...AREA_FIELDS.map(f => f.key), ...AREA_LEGACY_KEYS]);

async function readList<T>(file: string, guard: (v: unknown) => v is T, label: string): Promise<T[]> {
  let content: string;
  try {
    content = await fs.readFile(file, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const list: unknown = JSON.parse(content);
  if (!Array.isArray(list) || !list.every(guard)) throw new Error(`Invalid report data in ${label}`);
  return list;
}
// รายงานเก่าที่ไม่มีรอบ ถือเป็นรอบที่ 1
export async function readAll(): Promise<Report[]> { return (await readList(FILE, isReport, "data/reports.json")).map(r => ({ ...r, round: r.round ?? 1 })); }
// รายงานพื้นที่รูปแบบเก่า (ก่อนเปลี่ยนมากรอกไร่รายเดือน) ไม่มีค่า "area" จึงนับเป็น 0 — ต้องกรอกใหม่
export async function readAreaAll(): Promise<AreaReport[]> {
  return (await readList(AFILE, isAreaReport, "data/area-reports.json")).map(r => ({ ...r, round: r.round ?? 1, values: r.values.area === undefined ? {} : { area: r.values.area } }));
}

let chain: Promise<unknown> = Promise.resolve();
// อ่าน-แก้-เขียนต่อกันทีละคำสั่ง fn รับรายงานเดิม (ถ้ามี) แล้วคืนรายงานใหม่ (โยน Error เพื่อปฏิเสธ)
function mutate<T extends { district: string; month: string; round: number }>(file: string, read: () => Promise<T[]>, district: string, month: string, round: number, fn: (old?: T) => T): Promise<T> {
  const p = chain.then(async () => {
    const all = await read();
    const i = all.findIndex(x => x.district === district && x.month === month && x.round === round);
    const r = fn(i >= 0 ? all[i] : undefined);
    if (i >= 0) all[i] = r; else all.push(r);
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(all, null, 1));
    return r;
  });
  chain = p.catch(() => {});
  return p;
}
export const update = (district: string, month: string, round: number, fn: (old?: Report) => Report) => mutate(FILE, readAll, district, month, round, fn);
export const updateArea = (district: string, month: string, round: number, fn: (old?: AreaReport) => AreaReport) => mutate(AFILE, readAreaAll, district, month, round, fn);

export async function readSettings(): Promise<Settings> {
  let content: string;
  try {
    content = await fs.readFile(SFILE, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return DEFAULT_SETTINGS;
    throw error;
  }
  const s: unknown = JSON.parse(content);
  if (!isRecord(s) || validateDueDays(s.dueDays)) throw new Error("Invalid settings in data/settings.json");
  const areaTotals = s.areaTotals === undefined ? {} : s.areaTotals; // ไฟล์เก่าไม่มี areaTotals
  if (validateAreaTotals(areaTotals)) throw new Error("Invalid areaTotals in data/settings.json");
  return { dueDays: s.dueDays as number[], areaTotals: areaTotals as Record<string, number> };
}
export async function writeSettings(s: Settings) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(SFILE, JSON.stringify(s, null, 1));
}
