import { DEFAULT_LABELS } from "./config";
import { DISTRICTS, MAX_ROUNDS, TOPICS } from "./constants";

export function validateDueDays(d: unknown): string | null {
  if (!Array.isArray(d) || d.length < 1 || d.length > MAX_ROUNDS) return `จำนวนครั้งต่อเดือนต้องอยู่ระหว่าง 1–${MAX_ROUNDS}`;
  if (!d.every(x => Number.isInteger(x) && x >= 1 && x <= 31)) return "วันที่กำหนดส่งต้องเป็นเลข 1–31";
  if (!d.every((x, i) => i === 0 || x > d[i - 1])) return "วันที่กำหนดส่งของแต่ละรอบต้องเรียงจากน้อยไปมาก และไม่ซ้ำกัน";
  return null;
}

export function validateSchedules(x: unknown): string | null {
  if (!Array.isArray(x) || x.length > 100) return "ข้อมูลรายการที่ต้องรายงานไม่ถูกต้อง";
  const seen = new Set<string>();
  for (const it of x) {
    if (typeof it !== "object" || it === null || Array.isArray(it)) return "ข้อมูลรายการที่ต้องรายงานไม่ถูกต้อง";
    const { id, topic, fy, dueDays } = it as Record<string, unknown>;
    if (typeof id !== "string" || !id) return "ข้อมูลรายการที่ต้องรายงานไม่ถูกต้อง";
    if (!TOPICS.some(t => t.key === topic)) return "ไม่พบหัวข้อที่ต้องการรายงาน";
    if (typeof fy !== "number" || !Number.isInteger(fy) || fy < 2500 || fy > 2700) return "ปีงบประมาณไม่ถูกต้อง";
    const e = validateDueDays(dueDays);
    if (e) return e;
    const k = `${topic}-${fy}`;
    if (seen.has(k)) return "มีหัวข้อและปีงบประมาณซ้ำกันในรายการ";
    seen.add(k);
  }
  return null;
}

export function validateAreaSets(x: unknown): string | null {
  if (!Array.isArray(x) || x.length > 50) return "ข้อมูลพื้นที่ปลูกพืชไม่ถูกต้อง";
  const seen = new Set<number>();
  for (const it of x) {
    if (typeof it !== "object" || it === null || Array.isArray(it)) return "ข้อมูลพื้นที่ปลูกพืชไม่ถูกต้อง";
    const { id, fy, totals } = it as Record<string, unknown>;
    if (typeof id !== "string" || !id) return "ข้อมูลพื้นที่ปลูกพืชไม่ถูกต้อง";
    if (typeof fy !== "number" || !Number.isInteger(fy) || fy < 2500 || fy > 2700) return "ปีงบประมาณไม่ถูกต้อง";
    const e = validateAreaTotals(totals);
    if (e) return e;
    if (seen.has(fy)) return "มีปีงบประมาณซ้ำกันในรายการพื้นที่ปลูกพืช";
    seen.add(fy);
  }
  return null;
}

export function validateTambonSets(x: unknown): string | null {
  const bad = "ข้อมูลเกษตรตำบลไม่ถูกต้อง";
  if (!Array.isArray(x) || x.length > 50) return bad;
  const seen = new Set<number>();
  for (const it of x) {
    if (typeof it !== "object" || it === null || Array.isArray(it)) return bad;
    const { id, fy, perTambon, tambon } = it as Record<string, unknown>;
    if (typeof id !== "string" || !id) return bad;
    if (typeof fy !== "number" || !Number.isInteger(fy) || fy < 2500 || fy > 2700) return "ปีงบประมาณไม่ถูกต้อง";
    if (typeof perTambon !== "number" || !Number.isFinite(perTambon) || perTambon < 0 || perTambon > 1e6) return "ตัวคูณเป้าหมายต่อเกษตรตำบลต้องเป็นตัวเลขที่ไม่ติดลบ";
    if (typeof tambon !== "object" || tambon === null || Array.isArray(tambon)) return bad;
    for (const [k, v] of Object.entries(tambon)) {
      if (!DISTRICTS.some(d => d.name === k)) return `ไม่พบอำเภอ ${k}`;
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 1000) return `จำนวนเกษตรตำบลของอำเภอ${k}ต้องเป็นจำนวนเต็มที่ไม่ติดลบ`;
    }
    if (seen.has(fy)) return "มีปีงบประมาณซ้ำกันในรายการเกษตรตำบล";
    seen.add(fy);
  }
  return null;
}

export function validateAreaTotals(t: unknown): string | null {
  if (typeof t !== "object" || t === null || Array.isArray(t)) return "ข้อมูลพื้นที่ไม่ถูกต้อง";
  for (const [k, v] of Object.entries(t)) {
    if (!DISTRICTS.some(d => d.name === k)) return `ไม่พบอำเภอ ${k}`;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `พื้นที่ของอำเภอ${k}ต้องเป็นตัวเลขที่ไม่ติดลบ`;
  }
  return null;
}

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;

const isRec = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

const okText = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;

const okNum = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;

function validateYearCfg(c: Record<string, unknown>): string | null {
  if (!okNum(c.targetPerTambon, 0, 1e6)) return "เป้าหมายต่อเกษตรตำบลต้องเป็นตัวเลขที่ไม่ติดลบ";
  if (!Array.isArray(c.fertFields) || c.fertFields.length < 1 || c.fertFields.length > 30) return "ต้องมีช่องปุ๋ยอย่างน้อย 1 ช่อง (ไม่เกิน 30 ช่อง)";
  const fk = new Set<string>();
  for (const f of c.fertFields) {
    if (!isRec(f) || !KEY_RE.test(String(f.key))) return "รหัสช่องปุ๋ยไม่ถูกต้อง";
    if (!okText(f.label, 80)) return "ชื่อช่องปุ๋ยต้องไม่ว่าง (ไม่เกิน 80 ตัวอักษร)";
    if (!okText(f.group, 60)) return `กรุณาระบุกลุ่มของ “${String(f.label)}” (ไม่เกิน 60 ตัวอักษร)`;
    if (fk.has(String(f.key))) return "รหัสช่องปุ๋ยซ้ำกัน";
    fk.add(String(f.key));
  }
  if (!Array.isArray(c.burnFields) || c.burnFields.length < 1 || c.burnFields.length > 20) return "ต้องมีช่องรายงานการหยุดเผาอย่างน้อย 1 ช่อง (ไม่เกิน 20 ช่อง)";
  const bk = new Set<string>();
  for (const f of c.burnFields) {
    if (!isRec(f) || !KEY_RE.test(String(f.key))) return "รหัสช่องหยุดเผาไม่ถูกต้อง";
    if (!okText(f.label, 120)) return "ชื่อช่องหยุดเผาต้องไม่ว่าง (ไม่เกิน 120 ตัวอักษร)";
    if (!okText(f.unit, 30)) return `กรุณาระบุหน่วยของ “${String(f.label)}”`;
    if (bk.has(String(f.key))) return "รหัสช่องหยุดเผาซ้ำกัน";
    bk.add(String(f.key));
  }
  if (!isRec(c.area)) return "ข้อมูลตัวคูณไถกลบฟางข้าวไม่ถูกต้อง";
  if (!okNum(c.area.targetPct, 0, 100)) return "เป้าหมายร้อยละต้องอยู่ระหว่าง 0–100";
  for (const [k, name] of [["strawKgPerRai", "น้ำหนักฟางข้าวต่อไร่"], ["strawValuePerRai", "มูลค่าต่อไร่"], ["balesPerRai", "จำนวนฟางก้อนต่อไร่"], ["balePrice", "ราคาฟางก้อน"]] as const)
    if (!okNum(c.area[k], 0, 1e7)) return `${name}ต้องเป็นตัวเลขที่ไม่ติดลบ`;
  if (!isRec(c.topics)) return "ข้อมูลชื่อหัวข้อไม่ถูกต้อง";
  for (const [k, v] of Object.entries(c.topics)) if (!TOPICS.some(t => t.key === k) || !okText(v, 100)) return "ชื่อหัวข้อที่ต้องรายงานไม่ถูกต้อง (ไม่เกิน 100 ตัวอักษร)";
  if (!isRec(c.labels)) return "ข้อมูลหัวข้อตารางไม่ถูกต้อง";
  for (const [k, v] of Object.entries(c.labels)) if (!(k in DEFAULT_LABELS) || typeof v !== "string" || v.length > 150) return "หัวข้อตารางไม่ถูกต้อง (ไม่เกิน 150 ตัวอักษร)";
  return null;
}

export function validateConfig(c: unknown): string | null {
  if (!isRec(c)) return "ข้อมูลการตั้งค่าไม่ถูกต้อง";
  if (!Array.isArray(c.fiscalYears) || c.fiscalYears.length > 30) return "รายการปีงบประมาณไม่ถูกต้อง";
  const fys = new Set<number>();
  for (const d of c.fiscalYears) {
    if (!isRec(d) || !Number.isInteger(d.fy) || (d.fy as number) < 2500 || (d.fy as number) > 2700) return "ปีงบประมาณต้องเป็นปี พ.ศ. 2500–2700";
    if (!Number.isInteger(d.startMonth) || (d.startMonth as number) < 1 || (d.startMonth as number) > 12 || !Number.isInteger(d.endMonth) || (d.endMonth as number) < 1 || (d.endMonth as number) > 12) return `ปีงบประมาณ ${String(d.fy)}: เดือนเริ่ม/เดือนสิ้นสุดต้องเป็นเดือน 1–12`;
    if (d.topics !== undefined) {
      if (!isRec(d.topics)) return `ปีงบประมาณ ${String(d.fy)}: ช่วงเดือนแยกตามหัวข้อไม่ถูกต้อง`;
      for (const [k, v] of Object.entries(d.topics)) {
        if (!TOPICS.some(t => t.key === k)) return `ปีงบประมาณ ${String(d.fy)}: ไม่พบหัวข้อ ${k}`;
        if (!isRec(v) || !Number.isInteger(v.startMonth) || (v.startMonth as number) < 1 || (v.startMonth as number) > 12 || !Number.isInteger(v.endMonth) || (v.endMonth as number) < 1 || (v.endMonth as number) > 12) return `ปีงบประมาณ ${String(d.fy)}: เดือนเริ่ม/สิ้นสุดของหัวข้อต้องเป็นเดือน 1–12`;
      }
    }
    if (fys.has(d.fy as number)) return "มีปีงบประมาณซ้ำกัน";
    fys.add(d.fy as number);
  }
  const err = validateYearCfg(c);
  if (err) return err;
  if (c.byYear !== undefined) {
    if (!isRec(c.byYear) || Object.keys(c.byYear).length > 30) return "ข้อมูลการตั้งค่ารายปีไม่ถูกต้อง";
    for (const [k, v] of Object.entries(c.byYear)) {
      const y = Number(k);
      if (!/^\d{4}$/.test(k) || y < 2500 || y > 2700) return "ปีงบประมาณในการตั้งค่ารายปีไม่ถูกต้อง";
      if (!isRec(v)) return `การตั้งค่าปีงบประมาณ ${k} ไม่ถูกต้อง`;
      const e = validateYearCfg(v);
      if (e) return `ปีงบประมาณ ${k}: ${e}`;
    }
  }
  return null;
}
/** เหมือน lb แต่ถ้าจังหวัดยังไม่ได้แก้ข้อความนี้ ให้ใช้ข้อความ fallback (ใช้กับ Excel เพื่อคงหัวคอลัมน์เดิม) */

// ---------- ตรวจข้อมูลที่อำเภอกรอก (ใช้ร่วมกันใน /api/reports /api/area /api/burn) ----------
export const MAX_AMOUNT = 1_000_000_000; // เพดานค่าตัวเลขต่อช่อง กันค่าใหญ่ผิดปกติทำให้ผลรวมล้นเป็น Infinity/NaN
export const REPORTER_MAX = { name: 120, position: 120, phone: 20 } as const;

/**
 * แปลงค่าตัวเลขจากฟอร์ม — รับเฉพาะเลขฐานสิบธรรมดา ("12", "3.5", ".5") หรือ number ที่จำกัด
 * ไม่รับ "0x10", "1e308", "Infinity", ช่องว่างล้วน และไม่เกิน MAX_AMOUNT · ไม่ผ่านคืน null
 */
export function parseAmount(v: unknown, integer = false): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^(\d{1,12}|\d{0,12}\.\d{1,6})$/.test(v.trim()) ? Number(v.trim()) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return null;
  if (integer && !Number.isInteger(n)) return null;
  return n;
}
