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
export const FIELDS = [
  { key: "manure", label: "ปุ๋ยคอก", group: "ปุ๋ยอินทรีย์" },
  { key: "compost", label: "ปุ๋ยหมัก", group: "ปุ๋ยอินทรีย์" },
  { key: "crotalaria", label: "ปอเทือง", group: "ปุ๋ยพืชสด" },
  { key: "cowpea", label: "ถั่วพุ่ม", group: "ปุ๋ยพืชสด" },
  { key: "jackbean", label: "ถั่วพร้า", group: "ปุ๋ยพืชสด" },
  { key: "mungbean", label: "ถั่วเขียว", group: "ปุ๋ยพืชสด" },
  { key: "othergm", label: "อื่นๆ", group: "ปุ๋ยพืชสด" },
  { key: "biomass", label: "วัตถุดิบผลิตน้ำหมักชีวภาพ", group: "วัสดุอินทรีย์" },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];

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
] as const;
export type Topic = (typeof TOPICS)[number]["key"];
export interface Schedule { id: string; topic: Topic; fy: number; dueDays: number[] } // fy = ปีงบประมาณ พ.ศ.
// พื้นที่ปลูกพืชทั้งหมดรายอำเภอ แยกตามปีงบประมาณ (areaTotals เดิมใช้เป็นค่าสำรองสำหรับปีที่ยังไม่มีรายการ)
export interface AreaSet { id: string; fy: number; totals: Record<string, number> }
export interface Settings { dueDays: number[]; areaTotals: Record<string, number>; schedules: Schedule[]; areaSets: AreaSet[] }
export const DEFAULT_SETTINGS: Settings = { dueDays: [31], areaTotals: {}, schedules: [], areaSets: [] };
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

// ---------- ปีงบประมาณ (1 ต.ค. – 30 ก.ย.) ----------
// ปีงบประมาณ พ.ศ. 2569 = ต.ค. 2568 – ก.ย. 2569 · ค่าที่ใช้ทั้งหมดเป็น "YYYY-MM" (ค.ศ.) เหมือนส่วนอื่นของระบบ
export const fiscalYearOf = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y + 543 + (m >= 10 ? 1 : 0); }; // คืนค่าเป็น พ.ศ.
export const fiscalRange = (fyBE: number) => ({ from: `${fyBE - 544}-10`, to: `${fyBE - 543}-09` });
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
export const thaiDate = (ymd: string) => { const [y, m, d] = ymd.slice(0, 10).split("-").map(Number); return `${d} ${TH_S[m - 1]} ${y + 543}`; };
export const thaiDateTime = (iso: string) => { const b = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString(); return `${thaiDate(b)} ${b.slice(11, 16)} น.`; };

// ---------- ข้อมูลพื้นที่และฟางข้าว (แบบฟอร์มแยกอีกหน้า ใช้รอบและกำหนดส่งชุดเดียวกับรายงานปุ๋ย) ----------
// อำเภอรายงานเฉพาะ "พื้นที่ไถกลบฟางข้าวในเดือนนั้น (ไร่)" ในเดือน พ.ย.–มิ.ย. เท่านั้น
// พื้นที่ปลูกพืชทั้งหมดจังหวัดเป็นผู้กำหนด (Settings.areaTotals) · ช่องอื่นคำนวณจากสองค่านี้
export const AREA_TARGET_PCT = 35; // เป้าหมาย = ร้อยละ 35 ของพื้นที่ปลูกพืชทั้งหมด
export const STRAW_KG_PER_RAI = 500; // ฟางข้าว 500 กก./ไร่ (0.5 ตัน)
export const STRAW_VALUE_PER_RAI = 725; // บาท/ไร่ (ธาตุอาหารหลัก 23 กก./ไร่)
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
export const areaTarget = (total: number) => (total * AREA_TARGET_PCT) / 100;
export const areaPct = (accum: number, total: number) => (total > 0 ? (accum / total) * 100 : 0); // สะสม ÷ พื้นที่ปลูกทั้งหมด × 100
export const strawTons = (rai: number) => (rai * STRAW_KG_PER_RAI) / 1000; // (ไร่ × 500) ÷ 1000 = ตัน
export const strawValue = (rai: number) => rai * STRAW_VALUE_PER_RAI; // ไร่ × 725 บาท
export const isAreaMonth = (ym: string) => { const m = Number(ym.slice(5, 7)); return m >= 11 || m <= 6; };
// ฤดูกาลของเดือนนั้น: พ.ย. ปีหนึ่ง – มิ.ย. ปีถัดไป (เดือน ก.ค.–ต.ค. ให้ถือเป็นฤดูกาลที่เพิ่งจบ)
export const areaSeasonOf = (ym: string) => {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), s = m >= 11 ? y : y - 1;
  return { start: `${s}-11`, end: `${s + 1}-06` };
};
export const nearestAreaMonth = (ym: string) => (isAreaMonth(ym) ? ym : areaSeasonOf(ym).end);
