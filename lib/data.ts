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
  values: Partial<Record<FieldKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
}

const TH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const thaiMonth = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${TH[m - 1]} ${y + 543}`; };
export const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
