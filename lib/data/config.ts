import { BURN_FIELDS, DEFAULT_AREA_CONST, FIELDS, TARGET_PER_TAMBON, TOPICS } from "./constants";
import { applyFiscalPeriods, fiscalYearOf, normalizeFiscalYears } from "./fiscal";
import type { AppConfig, Settings, Topic } from "./types";

// หัวข้อตารางและข้อความที่แก้ไขได้ — {pct} จะถูกแทนด้วยร้อยละเป้าหมาย, {m} ด้วยชื่อเดือน
export const LABEL_DEFS: { key: string; text: string; group: string }[] = [
  { key: "tab.fert", text: "ปุ๋ยอินทรีย์", group: "ชื่อแท็บในหน้าตารางจังหวัด" },
  { key: "tab.area", text: "พื้นที่และฟางข้าว", group: "ชื่อแท็บในหน้าตารางจังหวัด" },
  { key: "tab.burn", text: "การเรียนรู้/ประชาสัมพันธ์หยุดเผา", group: "ชื่อแท็บในหน้าตารางจังหวัด" },
  { key: "tab.log", text: "บันทึกการส่งรายงาน", group: "ชื่อแท็บในหน้าตารางจังหวัด" },
  { key: "sec.fert", text: "ปุ๋ยอินทรีย์และวัสดุอินทรีย์", group: "ชื่อหัวข้อของแต่ละตาราง" },
  { key: "sec.area", text: "พื้นที่และฟางข้าว", group: "ชื่อหัวข้อของแต่ละตาราง" },
  { key: "sec.burn", text: "สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา", group: "ชื่อหัวข้อของแต่ละตาราง" },
  { key: "t.district", text: "อำเภอ", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.tambon", text: "เกษตรตำบล", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.target", text: "เป้าหมาย (ตัน)", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.total", text: "รวม (ตัน)", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.reach", text: "ถึงเป้าหมาย", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.sent", text: "เดือนที่ส่งครบ", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.late", text: "ส่งช้า", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "t.sumRow", text: "รวมทั้งจังหวัด", group: "ตารางปุ๋ยอินทรีย์" },
  { key: "a.field", text: "พื้นที่ไถกลบฟางข้าวในเดือนนี้", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.total", text: "พื้นที่ปลูกพืชทั้งหมด (ไร่)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.target", text: "เป้าหมายร้อยละ {pct} (ไร่)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.month", text: "{m} (ไร่)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.accum", text: "พื้นที่สะสม (ไร่)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.pct", text: "คิดเป็นของพื้นที่ปลูกทั้งหมด (100%)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.straw", text: "ฟางข้าว (ตัน)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.value", text: "มูลค่า (บาท)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.bales", text: "ฟางก้อน (ก้อน)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.baleValue", text: "ราคาฟางก้อน (บาท)", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "a.last", text: "รายงานล่าสุด", group: "ตารางพื้นที่และฟางข้าว" },
  { key: "b.sent", text: "เดือนที่ส่งครบ", group: "ตารางการหยุดเผา" },
  { key: "b.late", text: "ส่งช้า", group: "ตารางการหยุดเผา" },
  { key: "l.month", text: "เดือน", group: "ตารางบันทึกการส่ง" },
  { key: "l.round", text: "รอบ", group: "ตารางบันทึกการส่ง" },
  { key: "l.due", text: "กำหนดส่ง", group: "ตารางบันทึกการส่ง" },
  { key: "l.sentAt", text: "ส่งเมื่อ", group: "ตารางบันทึกการส่ง" },
  { key: "l.status", text: "สถานะ", group: "ตารางบันทึกการส่ง" },
];

export const DEFAULT_LABELS: Record<string, string> = Object.fromEntries(LABEL_DEFS.map(l => [l.key, l.text]));

export const DEFAULT_CONFIG: AppConfig = {
  fiscalYears: [], targetPerTambon: TARGET_PER_TAMBON, fertFields: FIELDS, burnFields: BURN_FIELDS,
  area: DEFAULT_AREA_CONST, topics: {}, labels: {},
};

export const DEFAULT_SETTINGS: Settings = { dueDays: [31], areaTotals: {}, schedules: [], areaSets: [], tambonSets: [], config: DEFAULT_CONFIG };

/** ค่าตั้งค่าที่ใช้งานจริงของปีงบประมาณ fy (พ.ศ.): ถ้าปีนั้นจังหวัดตั้งแยกไว้ ใช้ของปีนั้น ไม่เช่นนั้นใช้ค่าตั้งต้น · ไม่ระบุ fy = ค่าตั้งต้น */

export const cfgOf = (s: Settings | undefined | null, fy?: number): AppConfig => {
  const base: AppConfig = { ...DEFAULT_CONFIG, ...(s?.config ?? {}) };
  base.fiscalYears = normalizeFiscalYears(base.fiscalYears);
  applyFiscalPeriods(base.fiscalYears);
  const y = fy ? base.byYear?.[String(fy)] : undefined;
  const eff: AppConfig = y ? { ...base, ...y } : base;
  // รายการเกษตรตำบลของปีงบประมาณนั้น (ตั้งในหน้า "ตั้งค่า > การรายงาน") ใช้แทนจำนวนเริ่มต้นและตัวคูณเป้าหมายของปีนั้น
  const t = fy ? s?.tambonSets?.find(x => x.fy === fy) : undefined;
  return t ? { ...eff, targetPerTambon: t.perTambon, tambonByDistrict: t.tambon } : eff;
};
/** จำนวนเกษตรตำบลของอำเภอตามการตั้งค่าของปีงบประมาณ (ไม่ได้กำหนด = ใช้ค่าเริ่มต้นของอำเภอ) */

export const tambonOf = (cfg: AppConfig, d: { name: string; tambon: number }) => cfg.tambonByDistrict?.[d.name] ?? d.tambon;
/** ค่าตั้งค่าที่ใช้กับเดือน "YYYY-MM" (ตามปีงบประมาณของเดือนนั้น) */

export const cfgOfMonth = (s: Settings | undefined | null, ym: string) => { cfgOf(s); return cfgOf(s, ym ? fiscalYearOf(ym) : undefined); }; // เรียก cfgOf ก่อน เพื่อให้ช่วงเดือนล่าสุดถูกใช้หาปีงบประมาณ
/** ข้อความหัวข้อที่แก้ไขได้ · vars แทนค่า {pct} {m} */

export const lb = (cfg: AppConfig, key: string, vars?: Record<string, string | number>) => {
  let t = cfg.labels[key]?.trim() || DEFAULT_LABELS[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) t = t.split(`{${k}}`).join(String(v));
  return t;
};

export const topicLabelOf = (cfg: AppConfig, t: Topic) => cfg.topics[t]?.trim() || TOPICS.find(x => x.key === t)?.label || t;
/** ปีงบประมาณที่แสดงให้เลือก: ปีที่จังหวัดเพิ่ม + ปีที่มีข้อมูล/ปีปัจจุบัน (extra) — ล่าสุดอยู่บนสุด ไม่มีช่องว่างตกหล่น */

export const fiscalYearOptions = (cfg: AppConfig, extra: number[]) => Array.from(new Set([...cfg.fiscalYears.map(d => d.fy), ...extra.filter(Boolean)])).sort((a, b) => b - a);

export const lbx = (cfg: AppConfig, key: string, fallback: string, vars?: Record<string, string | number>) =>
  cfg.labels[key]?.trim() ? lb(cfg, key, vars) : fallback;
