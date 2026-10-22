export const TARGET_PER_TAMBON = 140; // ตัน ต่อเกษตรตำบล 1 ราย (ตามสูตรในไฟล์ Excel)

// 22 อำเภอ พร้อมจำนวนเกษตรตำบล (จากไฟล์ Excel ปี 2569)
export const DISTRICTS = [
  { name: "กันทรลักษ์", tambon: 12 }, { name: "กันทรารมย์", tambon: 10 }, { name: "ขุขันธ์", tambon: 14 },
  { name: "ขุนหาญ", tambon: 5 }, { name: "น้ำเกลี้ยง", tambon: 3 }, { name: "โนนคูณ", tambon: 4 },
  { name: "บึงบูรพ์", tambon: 1 }, { name: "เบญจลักษ์", tambon: 5 }, { name: "ปรางค์กู่", tambon: 6 },
  { name: "พยุห์", tambon: 3 }, { name: "โพธิ์ศรีสุวรรณ", tambon: 4 }, { name: "ไพรบึง", tambon: 3 },
  { name: "ภูสิงห์", tambon: 5 }, { name: "เมืองจันทร์", tambon: 2 }, { name: "เมืองศรีสะเกษ", tambon: 12 },
  { name: "ยางชุมน้อย", tambon: 6 }, { name: "ราษีไศล", tambon: 7 }, { name: "วังหิน", tambon: 5 },
  { name: "ศรีรัตนะ", tambon: 5 }, { name: "ศิลาลาด", tambon: 2 }, { name: "ห้วยทับทัน", tambon: 4 },
  { name: "อุทุมพรพิสัย", tambon: 12 },
];

// ช่องที่อำเภอกรอกในแต่ละเดือน (หน่วย: ตัน) — ตรงกับคอลัมน์ในไฟล์ Excel
export interface FieldDef { key: string; label: string; group: string }
export const FIELDS: FieldDef[] = [
  { key: "manure", label: "ปุ๋ยคอก", group: "ปุ๋ยอินทรีย์" },
  { key: "compost", label: "ปุ๋ยหมัก", group: "ปุ๋ยอินทรีย์" },
  { key: "crotalaria", label: "ปอเทือง", group: "ปุ๋ยพืชสด" },
  { key: "cowpea", label: "ถั่วพุ่ม", group: "ปุ๋ยพืชสด" },
  { key: "jackbean", label: "ถั่วพร้า", group: "ปุ๋ยพืชสด" },
  { key: "mungbean", label: "ถั่วเขียว", group: "ปุ๋ยพืชสด" },
  { key: "othergm", label: "อื่นๆ", group: "ปุ๋ยพืชสด" },
  { key: "biomass", label: "วัตถุดิบผลิตน้ำหมักชีวภาพ", group: "วัสดุอินทรีย์" },
];
export type FieldKey = string; // คีย์ช่องปุ๋ยจังหวัดเพิ่ม/ลดได้เอง (ดู AppConfig)

export interface Reporter { name: string; position: string; phone: string }
export interface Report {
  district: string; month: string; // month = "YYYY-MM" (ค.ศ.)
  round: number; // รอบที่ในเดือนนั้น (1..จำนวนครั้งต่อเดือนที่จังหวัดกำหนด)
  values: Partial<Record<FieldKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean; // บันทึกตอนส่งครั้งแรก ไม่เปลี่ยนเมื่อแก้ไขแล้วส่งซ้ำ
}
// จังหวัดกำหนด: dueDays[i] = วันที่ของเดือนที่ต้องส่งรอบที่ i+1 (จำนวนสมาชิก = จำนวนครั้งต่อเดือน)
// areaTotals[ชื่ออำเภอ] = พื้นที่ปลูกพืชทั้งหมด (ไร่) ที่จังหวัดเป็นผู้กำหนด
// รายการที่ต้องรายงาน: กำหนดต่อ "หัวข้อ × ปีงบประมาณ" ว่าต้องรายงานกี่ครั้งต่อเดือน และต้องส่งภายในวันที่เท่าไรของแต่ละรอบ
// dueDays (เดิม) ใช้เป็นค่าเริ่มต้นสำหรับปีงบประมาณ/หัวข้อที่ยังไม่ได้กำหนดรายการ
export const TOPICS = [
  { key: "fert", label: "ปุ๋ยอินทรีย์" },
  { key: "area", label: "ไถกลบฟางข้าว" },
  { key: "burn", label: "สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา" },
] as const;
export type Topic = (typeof TOPICS)[number]["key"];
export interface Schedule { id: string; topic: Topic; fy: number; dueDays: number[] } // fy = ปีงบประมาณ พ.ศ.
// พื้นที่ปลูกพืชทั้งหมดรายอำเภอ แยกตามปีงบประมาณ (areaTotals เดิมใช้เป็นค่าสำรองสำหรับปีที่ยังไม่มีรายการ)
export interface AreaSet { id: string; fy: number; totals: Record<string, number> }
export interface Settings { dueDays: number[]; areaTotals: Record<string, number>; schedules: Schedule[]; areaSets: AreaSet[]; config: AppConfig }
export const MAX_ROUNDS = 4;
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

export function validateAreaTotals(t: unknown): string | null {
  if (typeof t !== "object" || t === null || Array.isArray(t)) return "ข้อมูลพื้นที่ไม่ถูกต้อง";
  for (const [k, v] of Object.entries(t)) {
    if (!DISTRICTS.some(d => d.name === k)) return `ไม่พบอำเภอ ${k}`;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return `พื้นที่ของอำเภอ${k}ต้องเป็นตัวเลขที่ไม่ติดลบ`;
  }
  return null;
}

const TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const thaiMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH[m - 1]} ${y + 543}`; };
export const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

// ---------- ปีงบประมาณ (ช่วงรายงาน พ.ย. – มิ.ย.) ----------
// ปีงบประมาณ พ.ศ. 2570 = พ.ย. 2569 – มิ.ย. 2570 (8 เดือน) · ค่าที่ใช้ทั้งหมดเป็น "YYYY-MM" (ค.ศ.) เหมือนส่วนอื่นของระบบ
// เดือน ก.ค. – ต.ค. (นอกช่วงรายงาน) นับเป็นของปีงบประมาณถัดไป เพื่อให้ตั้งค่ากำหนดส่ง/พื้นที่ปลูกของปีหน้าล่วงหน้าได้
export const FY_START_MONTH = 11, FY_END_MONTH = 6; // ช่วงเริ่มต้นของปีงบประมาณที่จังหวัดไม่ได้กำหนดเอง
// ช่วงเดือนของแต่ละปีงบประมาณที่จังหวัดกำหนดเอง (เดือนเริ่ม/เดือนสิ้นสุด) · อัปเดตอัตโนมัติทุกครั้งที่อ่านการตั้งค่า (cfgOf / readSettings)
let PERIODS: Record<number, { s: number; e: number }> = {};
export const applyFiscalPeriods = (list: { fy: number; startMonth: number; endMonth: number }[] | undefined) => {
  PERIODS = Object.fromEntries((list ?? []).map(d => [d.fy, { s: d.startMonth, e: d.endMonth }]));
};
const pad2 = (n: number) => String(n).padStart(2, "0");
// เดือนเริ่ม > เดือนสิ้นสุด = ข้ามปี (เช่น พ.ย. – มิ.ย.: เริ่มในปี ค.ศ. ก่อนหน้า) · เดือนเริ่ม <= เดือนสิ้นสุด = อยู่ในปีเดียว
export const fiscalRangeFor = (fyBE: number, sm: number, em: number) => {
  const endY = fyBE - 543, startY = sm > em ? endY - 1 : endY;
  return { from: `${startY}-${pad2(sm)}`, to: `${endY}-${pad2(em)}` };
};
export const fiscalRange = (fyBE: number) => { const { s: sm, e: em } = PERIODS[fyBE] ?? { s: FY_START_MONTH, e: FY_END_MONTH }; return fiscalRangeFor(fyBE, sm, em); };
export const fiscalYearOf = (ym: string) => {
  for (const k of Object.keys(PERIODS)) { const r = fiscalRange(Number(k)); if (ym >= r.from && ym <= r.to) return Number(k); }
  const [y, m] = ym.split("-").map(Number);
  return y + 543 + (m > FY_END_MONTH ? 1 : 0); // เดือนนอกช่วง: นับเป็นของปีงบประมาณถัดไป
};
export const periodMonths = (startMonth: number, endMonth: number) => ((endMonth - startMonth + 12) % 12) + 1;
export interface FiscalYearDef { fy: number; startMonth: number; endMonth: number }
/** แปลงข้อมูลเก่า (เลขปีล้วน) เป็นรูปแบบใหม่ที่มีเดือนเริ่ม-สิ้นสุด */
export const normalizeFiscalYears = (raw: unknown): FiscalYearDef[] =>
  (Array.isArray(raw) ? raw : []).map(x => typeof x === "number" ? { fy: x, startMonth: FY_START_MONTH, endMonth: FY_END_MONTH } : x as FiscalYearDef);
export const isFiscalRange = (from: string, to: string) => !!from && !!to && fiscalRange(fiscalYearOf(to)).from === from && fiscalRange(fiscalYearOf(to)).to === to;

// วันกำหนดส่งของหัวข้อ ณ เดือนนั้น: ใช้รายการของปีงบประมาณที่เดือนนั้นอยู่ ถ้าไม่มีใช้ค่าเริ่มต้น settings.dueDays
export const dueDaysFor = (s: Settings, topic: Topic, month?: string): number[] => {
  if (!month) return s.dueDays;
  const fy = fiscalYearOf(month);
  return (s.schedules ?? []).find(x => x.topic === topic && x.fy === fy)?.dueDays ?? s.dueDays;
};

// พื้นที่ปลูกพืชทั้งหมดรายอำเภอ ณ เดือนนั้น: ใช้รายการของปีงบประมาณที่เดือนนั้นอยู่ ถ้าไม่มีใช้ค่าสำรอง settings.areaTotals
export const areaTotalsFor = (s: Settings, month: string): Record<string, number> =>
  (month ? (s.areaSets ?? []).find(x => x.fy === fiscalYearOf(month))?.totals : undefined) ?? s.areaTotals;

const TH_S = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// วันที่ตามเวลาไทย (UTC+7) รูปแบบ YYYY-MM-DD
export const bkkDate = (d: Date | string = new Date()) => new Date(new Date(d).getTime() + 7 * 3600e3).toISOString().slice(0, 10);
// วันกำหนดส่ง: ถ้าเดือนนั้นมีวันน้อยกว่า (เช่น 31 ในเดือนกุมภาพันธ์) ใช้วันสุดท้ายของเดือน
export const dueDateOf = (month: string, day: number) => {
  const [y, m] = month.split("-").map(Number), last = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, "0")}`;
};
// เดือนแบบย่อ + ปี พ.ศ. 2 หลัก เช่น "ธ.ค. 68" (ใช้เป็นหัวคอลัมน์รายเดือน)
export const thaiMonthShort = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH_S[m - 1]} ${String(y + 543).slice(2)}`; };
// ป้ายช่วงเวลา: ถ้าเป็นปีงบประมาณเต็มปี แสดง "ปีงบประมาณ 2569" ไม่เช่นนั้นแสดงช่วงเดือน
export const rangeLabel = (from: string, to: string) => (isFiscalRange(from, to) ? `ปีงบประมาณ ${fiscalYearOf(to)}` : `${thaiMonth(from)} – ${thaiMonth(to)}`);
export const thaiDate = (ymd: string) => { const [y, m, d] = ymd.slice(0, 10).split("-").map(Number); return `${d} ${TH_S[m - 1]} ${y + 543}`; };
export const thaiDateTime = (iso: string) => { const b = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString(); return `${thaiDate(b)} ${b.slice(11, 16)} น.`; };

// ---------- ข้อมูลพื้นที่และฟางข้าว (แบบฟอร์มแยกอีกหน้า ใช้รอบและกำหนดส่งชุดเดียวกับรายงานปุ๋ย) ----------
// อำเภอรายงานเฉพาะ "พื้นที่ไถกลบฟางข้าวในเดือนนั้น (ไร่)" ในเดือน พ.ย.–มิ.ย. เท่านั้น
// พื้นที่ปลูกพืชทั้งหมดจังหวัดเป็นผู้กำหนด (Settings.areaTotals) · ช่องอื่นคำนวณจากสองค่านี้
export const AREA_TARGET_PCT = 35; // เป้าหมาย = ร้อยละ 35 ของพื้นที่ปลูกพืชทั้งหมด
export const STRAW_KG_PER_RAI = 500; // ฟางข้าว 500 กก./ไร่ (0.5 ตัน)
export const STRAW_VALUE_PER_RAI = 725; // บาท/ไร่ (ธาตุอาหารหลัก 23 กก./ไร่)
export const BALES_PER_RAI = 25; // ฟางก้อน 25 ก้อน/ไร่ (1 ไร่ = 25 ก้อน)
export const BALE_PRICE = 35; // ราคาฟางก้อน 35 บาท/ก้อน
export const AREA_FIELDS = [
  { key: "area", label: "พื้นที่ไถกลบฟางข้าวในเดือนนี้", unit: "ไร่" },
] as const;
export type AreaKey = (typeof AREA_FIELDS)[number]["key"];
export const AREA_LEGACY_KEYS = ["totalArea", "accumArea", "straw", "strawValue"] as const; // รูปแบบเก่า (อ่านได้แต่ไม่ใช้)
export interface AreaReport {
  district: string; month: string; round: number;
  values: Partial<Record<AreaKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean;
}
// พื้นที่ปลูกพืชทั้งหมดที่ใช้คำนวณ: ถ้าจังหวัดกำหนดไว้ (>0) ใช้ค่านั้น · ถ้ายังไม่กำหนด ใช้พื้นที่สะสมทั้งหมดแทน เพื่อให้เป้าหมายและร้อยละแสดงผลได้
export const effectiveTotal = (set: number | undefined, accum: number) => (set && set > 0 ? set : accum);
export interface AreaConst { targetPct: number; strawKgPerRai: number; strawValuePerRai: number; balesPerRai: number; balePrice: number }
export const DEFAULT_AREA_CONST: AreaConst = { targetPct: AREA_TARGET_PCT, strawKgPerRai: STRAW_KG_PER_RAI, strawValuePerRai: STRAW_VALUE_PER_RAI, balesPerRai: BALES_PER_RAI, balePrice: BALE_PRICE };
export const areaTarget = (total: number, k: AreaConst = DEFAULT_AREA_CONST) => (total * k.targetPct) / 100;
export const areaPct = (accum: number, total: number) => (total > 0 ? Math.min(100, (accum / total) * 100) : 0); // สะสม ÷ พื้นที่ปลูกทั้งหมด × 100 (ไม่เกิน 100%)
export const strawTons = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => (rai * k.strawKgPerRai) / 1000; // (ไร่ × 500) ÷ 1000 = ตัน
export const strawValue = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => rai * k.strawValuePerRai; // ไร่ × 725 บาท
export const strawBales = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => rai * k.balesPerRai; // ฟางก้อน (ก้อน) = ไร่ × 25
export const baleValue = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => strawBales(rai, k) * k.balePrice; // ราคาฟางก้อน (บาท) = จำนวนก้อน × 35
// ฤดูกาลไถกลบ = ช่วงเดือนของปีงบประมาณที่จังหวัดตั้งไว้ (ค่าเริ่มต้น พ.ย. – มิ.ย.) · เดือนที่อยู่นอกช่วงก่อนเริ่มปี (เช่น ก.ค.–ต.ค.) ให้ถือเป็นฤดูกาลที่เพิ่งจบ
export const isAreaMonth = (ym: string) => { const r = fiscalRange(fiscalYearOf(ym)); return ym >= r.from && ym <= r.to; };
export const areaSeasonOf = (ym: string) => {
  const fy = fiscalYearOf(ym), r = fiscalRange(fy);
  const x = ym < r.from ? fiscalRange(fy - 1) : r;
  return { start: x.from, end: x.to };
};
export const nearestAreaMonth = (ym: string) => (isAreaMonth(ym) ? ym : areaSeasonOf(ym).end);

// ---------- สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา (แบบฟอร์มแยกอีกหน้า ใช้รอบและกำหนดส่งตามหัวข้อ "burn" ที่จังหวัดตั้งค่า) ----------
// อำเภอรายงานผลการดำเนินงานของเดือนนั้น (นับเป็นจำนวนเต็ม) รายงานได้ทุกเดือน · ระบบรวมทุกรอบเป็นยอดของเดือน และสะสมตามช่วงเดือนที่เลือก
export interface BurnFieldDef { key: string; label: string; unit: string }
export const BURN_FIELDS: BurnFieldDef[] = [
  { key: "activities", label: "จำนวนกิจกรรมเรียนรู้/ประชาสัมพันธ์ที่จัด", unit: "ครั้ง" },
  { key: "villages", label: "หมู่บ้าน/ชุมชนที่ดำเนินการ", unit: "หมู่บ้าน" },
  { key: "participants", label: "ผู้เข้าร่วมกิจกรรม", unit: "ราย" },
  { key: "media", label: "สื่อประชาสัมพันธ์ที่เผยแพร่ (ป้าย/โปสเตอร์/ออนไลน์/เสียงตามสาย)", unit: "ชิ้น" },
];
export type BurnKey = string; // คีย์ช่องหยุดเผาจังหวัดเพิ่ม/ลดได้เอง (ดู AppConfig)
export interface BurnReport {
  district: string; month: string; round: number;
  values: Partial<Record<BurnKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean;
}

// ---------- ค่าที่จังหวัดแก้ไขเองได้ในหน้า "ตั้งค่าหัวข้อและรายการ" (ไม่ต้องแก้โค้ด) ----------
// เก็บใน Settings.config (MongoDB) · ถ้ายังไม่เคยตั้งค่า ใช้ค่าเริ่มต้นด้านล่างซึ่งตรงกับค่าเดิมของระบบทุกประการ
// หมายเหตุ: ลบช่องออกจากรายการ = ซ่อนจากแบบฟอร์ม/ตาราง/Excel ข้อมูลที่อำเภอเคยกรอกยังอยู่ในฐานข้อมูล
// ค่าตั้งต้นของแต่ละปีงบประมาณ — จังหวัดตั้งแยกรายปีได้ (ปีที่ไม่ได้ตั้งเอง ใช้ "ค่าตั้งต้น" ระดับบนสุด)
export interface YearConfig {
  targetPerTambon: number;            // เป้าหมายปุ๋ย (ตัน) ต่อเกษตรตำบล 1 ราย
  fertFields: FieldDef[];             // ช่องปุ๋ยอินทรีย์ / ปุ๋ยพืชสด / วัสดุอินทรีย์ (เพิ่ม ลบ เปลี่ยนชื่อ จัดกลุ่ม)
  burnFields: BurnFieldDef[];         // ช่องรายงานการหยุดเผา
  area: AreaConst;                    // ตัวคูณไถกลบฟางข้าว / ฟางก้อน
  topics: Partial<Record<Topic, string>>; // ชื่อหัวข้อที่ต้องรายงาน (แทนชื่อเริ่มต้นใน TOPICS)
  labels: Record<string, string>;     // หัวข้อตาราง/ข้อความที่แก้ไขได้ (คีย์ตาม LABEL_DEFS)
}
export interface AppConfig extends YearConfig {
  fiscalYears: FiscalYearDef[];       // ปีงบประมาณ (พ.ศ.) ที่จังหวัดเพิ่มเอง พร้อมเดือนเริ่ม–สิ้นสุดของแต่ละปี
  byYear?: Record<string, YearConfig>; // ค่าที่ตั้งแยกรายปีงบประมาณ (คีย์ = ปี พ.ศ. เช่น "2570")
}

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
export const DEFAULT_SETTINGS: Settings = { dueDays: [31], areaTotals: {}, schedules: [], areaSets: [], config: DEFAULT_CONFIG };

/** ค่าตั้งค่าที่ใช้งานจริงของปีงบประมาณ fy (พ.ศ.): ถ้าปีนั้นจังหวัดตั้งแยกไว้ ใช้ของปีนั้น ไม่เช่นนั้นใช้ค่าตั้งต้น · ไม่ระบุ fy = ค่าตั้งต้น */
export const cfgOf = (s: Settings | undefined | null, fy?: number): AppConfig => {
  const base: AppConfig = { ...DEFAULT_CONFIG, ...(s?.config ?? {}) };
  base.fiscalYears = normalizeFiscalYears(base.fiscalYears);
  applyFiscalPeriods(base.fiscalYears);
  const y = fy ? base.byYear?.[String(fy)] : undefined;
  return y ? { ...base, ...y } : base;
};
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
export const lbx = (cfg: AppConfig, key: string, fallback: string, vars?: Record<string, string | number>) =>
  cfg.labels[key]?.trim() ? lb(cfg, key, vars) : fallback;
