import { monthsBetween } from "./summary";
import type { FieldDef } from "./data";

// ตรวจค่าที่กรอกว่า "อาจผิดปกติ" (เช่น พิมพ์เลข 0 เกิน) โดยเทียบกับประวัติของอำเภอเดียวกัน — เป็นการเตือนให้ตรวจซ้ำ ไม่ได้ห้ามส่ง
export type AnomalyKind = "spike" | "dropped" | "huge" | "over-target";
export interface Anomaly { key: string; label: string; kind: AnomalyKind; level: "warn" | "high"; message: string; value: number; baseline?: number }

export const RULES = {
  minHistory: 2,      // ต้องมีประวัติอย่างน้อยกี่ครั้งจึงเทียบกับ "ค่าปกติ" ได้
  recent: 6,          // ใช้ประวัติล่าสุดกี่ครั้งคำนวณค่าปกติ (มัธยฐาน)
  spikeRatio: 3,      // สูงกว่าค่าปกติกี่เท่าจึงเตือน
  highRatio: 10,      // สูงกว่ากี่เท่าถือว่าน่าสงสัยมาก
  minDiff: 10,        // ต้องต่างจากค่าปกติอย่างน้อยเท่านี้ (หน่วยเดียวกับช่อง) กันเตือนเกินเหตุตอนค่าเล็กมาก
  droppedStreak: 3,   // ที่ผ่านมามีค่า > 0 ติดกันกี่ครั้ง แล้วรอบนี้เป็น 0 จึงเตือน
  hugeOfTarget: 0.5,  // ค่าช่องเดียวเกินกี่ส่วนของเป้าหมายทั้งปีของอำเภอ
  overTarget: 1.5,    // ยอดสะสมรวมเกินกี่เท่าของเป้าหมาย
};

export const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const n1 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 1 });

export interface DetectInput {
  values: Record<string, number>;       // ค่าที่กรอกในรอบนี้ (เฉพาะช่องที่กรอกแล้ว)
  history: Record<string, number>[];    // ค่าของรอบก่อนหน้าที่ส่งแล้ว ของอำเภอเดียวกัน เรียงจากเก่าไปใหม่
  fields: Pick<FieldDef, "key" | "label">[];
  unit?: string;
  target?: number;                      // เป้าหมายทั้งปีของอำเภอ (ไม่ระบุ/0 = ไม่ตรวจข้อ "เกินเป้า")
  cumulativeBefore?: number;            // ยอดสะสมของปีก่อนรอบนี้ (รวมทุกช่อง)
}

export function detectAnomalies({ values, history, fields, unit = "", target = 0, cumulativeBefore = 0 }: DetectInput): Anomaly[] {
  const out: Anomaly[] = [], u = unit ? ` ${unit}` : "";
  for (const f of fields) {
    const v = values[f.key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    const past = history.map(h => h[f.key]).filter((x): x is number => typeof x === "number" && Number.isFinite(x)).slice(-RULES.recent);
    const base = { key: f.key, label: f.label, value: v };
    if (target > 0 && v > target * RULES.hugeOfTarget) {
      out.push({ ...base, kind: "huge", level: "high", message: `${f.label}: ${n1(v)}${u} เกินครึ่งหนึ่งของเป้าหมายทั้งปีของอำเภอ (${n1(target)}${u}) ในรอบเดียว — ตรวจว่าพิมพ์เลขเกินหรือไม่` });
      continue;
    }
    if (past.length >= RULES.minHistory) {
      const m = median(past);
      if (m > 0 && v >= m * RULES.spikeRatio && v - m >= RULES.minDiff) {
        out.push({ ...base, kind: "spike", level: v >= m * RULES.highRatio ? "high" : "warn", baseline: m,
          message: `${f.label}: ${n1(v)}${u} สูงกว่าปกติของอำเภอ (ประมาณ ${n1(m)}${u}) ราว ${n1(v / m)} เท่า — ตรวจว่าพิมพ์เลขเกินหรือเลื่อนจุดทศนิยมหรือไม่` });
        continue;
      }
      const last = past.slice(-RULES.droppedStreak);
      if (v === 0 && last.length === RULES.droppedStreak && last.every(x => x > 0)) {
        out.push({ ...base, kind: "dropped", level: "warn", baseline: m,
          message: `${f.label}: รอบนี้เป็น 0 แต่ ${RULES.droppedStreak} ครั้งก่อนหน้ามีค่าทุกครั้ง (ประมาณ ${n1(m)}${u}) — ถ้าไม่มีจริงให้ยืนยันได้` });
      }
    }
  }
  if (target > 0) {
    const total = cumulativeBefore + Object.values(values).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    if (total > target * RULES.overTarget) {
      out.push({ key: "__total", label: "ยอดสะสมรวม", kind: "over-target", level: "warn", value: total, baseline: target,
        message: `ยอดสะสมรวมของปี ${n1(total)}${u} เกินเป้าหมาย (${n1(target)}${u}) มากกว่า ${Math.round((RULES.overTarget - 1) * 100)}% — ตรวจตัวเลขอีกครั้ง` });
    }
  }
  return out;
}

export interface ScanHit extends Anomaly { district: string; month: string; round: number }
interface ScanRow { district: string; month: string; round: number; status: "draft" | "submitted"; values: Partial<Record<string, number>> }

/** สแกนรายงานที่ส่งแล้วของทุกอำเภอในช่วงเดือน from–to เทียบกับประวัติก่อนหน้าของอำเภอนั้น (ใช้แสดง "ค่าที่ควรตรวจสอบ" ฝั่งจังหวัด) */
export function scanReports(reports: ScanRow[], fields: Pick<FieldDef, "key" | "label">[], from: string, to: string, unit = ""): ScanHit[] {
  const by = new Map<string, ScanRow[]>();
  for (const r of reports) if (r.status === "submitted") by.set(r.district, [...(by.get(r.district) ?? []), r]);
  const hits: ScanHit[] = [], inRange = new Set(monthsBetween(from, to));
  for (const [district, rows] of by) {
    rows.sort((a, b) => a.month.localeCompare(b.month) || a.round - b.round);
    rows.forEach((r, i) => {
      if (!inRange.has(r.month)) return;
      const values = Object.fromEntries(Object.entries(r.values).filter(([, v]) => typeof v === "number")) as Record<string, number>;
      const history = rows.slice(0, i).map(x => Object.fromEntries(Object.entries(x.values).filter(([, v]) => typeof v === "number")) as Record<string, number>);
      for (const a of detectAnomalies({ values, history, fields, unit })) hits.push({ ...a, district, month: r.month, round: r.round });
    });
  }
  return hits.sort((a, b) => (a.level === b.level ? b.month.localeCompare(a.month) : a.level === "high" ? -1 : 1));
}
