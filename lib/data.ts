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
export interface Settings { dueDays: number[] }
export const DEFAULT_SETTINGS: Settings = { dueDays: [31] };
export const MAX_ROUNDS = 4;
export function validateDueDays(d: unknown): string | null {
  if (!Array.isArray(d) || d.length < 1 || d.length > MAX_ROUNDS) return `จำนวนครั้งต่อเดือนต้องอยู่ระหว่าง 1–${MAX_ROUNDS}`;
  if (!d.every(x => Number.isInteger(x) && x >= 1 && x <= 31)) return "วันที่กำหนดส่งต้องเป็นเลข 1–31";
  if (!d.every((x, i) => i === 0 || x > d[i - 1])) return "วันที่กำหนดส่งของแต่ละรอบต้องเรียงจากน้อยไปมาก และไม่ซ้ำกัน";
  return null;
}

const TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const thaiMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH[m - 1]} ${y + 543}`; };
export const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };

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
