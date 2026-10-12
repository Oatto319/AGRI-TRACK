import { promises as fs } from "fs";
import path from "path";
import { DISTRICTS, FIELDS, type Report } from "./data";

// เก็บเป็นไฟล์ JSON (data/reports.json) — เหมาะกับเซิร์ฟเวอร์เดียว หากย้ายไปใช้ฐานข้อมูลให้แก้เฉพาะไฟล์นี้
const FILE = path.join(process.cwd(), "data", "reports.json");
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
  return reports;
}
let chain: Promise<unknown> = Promise.resolve();
export function upsert(r: Report): Promise<Report> {
  const p = chain.then(async () => {
    const all = await readAll();
    const i = all.findIndex(x => x.district === r.district && x.month === r.month);
    if (i >= 0) all[i] = r; else all.push(r);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(all, null, 1));
    return r;
  });
  chain = p.catch(() => {});
  return p;
}
