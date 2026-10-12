import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_SETTINGS, DISTRICTS, FIELDS, validateDueDays, type Report, type Settings } from "./data";

// เก็บเป็นไฟล์ JSON (data/reports.json) — เหมาะกับเซิร์ฟเวอร์เดียว หากย้ายไปใช้ฐานข้อมูลให้แก้เฉพาะไฟล์นี้
const DIR = path.join(process.cwd(), "data");
const FILE = path.join(DIR, "reports.json"), SFILE = path.join(DIR, "settings.json");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function isReport(value: unknown): value is Report {
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
      FIELDS.some(field => field.key === key) &&
      typeof amount === "number" && Number.isFinite(amount) && amount >= 0);
}

export async function readAll(): Promise<Report[]> {
  let content: string;
  try {
    content = await fs.readFile(FILE, "utf8");
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") return [];
    throw error;
  }
  const reports: unknown = JSON.parse(content);
  if (!Array.isArray(reports) || !reports.every(isReport)) {
    throw new Error("Invalid report data in data/reports.json");
  }
  return reports.map(r => ({ ...r, round: r.round ?? 1 })); // รายงานเก่าที่ไม่มีรอบ ถือเป็นรอบที่ 1
}
let chain: Promise<unknown> = Promise.resolve();
// อ่าน-แก้-เขียนต่อกันทีละคำสั่ง fn รับรายงานเดิม (ถ้ามี) แล้วคืนรายงานใหม่ (โยน Error เพื่อปฏิเสธ)
export function update(district: string, month: string, round: number, fn: (old?: Report) => Report): Promise<Report> {
  const p = chain.then(async () => {
    const all = await readAll();
    const i = all.findIndex(x => x.district === district && x.month === month && x.round === round);
    const r = fn(i >= 0 ? all[i] : undefined);
    if (i >= 0) all[i] = r; else all.push(r);
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(all, null, 1));
    return r;
  });
  chain = p.catch(() => {});
  return p;
}

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
  return { dueDays: s.dueDays as number[] };
}
export async function writeSettings(s: Settings) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(SFILE, JSON.stringify(s, null, 1));
}
