import type { AreaConst, BurnFieldDef, FieldDef } from "./types";

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

// จังหวัดกำหนด: dueDays[i] = วันที่ของเดือนที่ต้องส่งรอบที่ i+1 (จำนวนสมาชิก = จำนวนครั้งต่อเดือน)
// areaTotals[ชื่ออำเภอ] = พื้นที่ปลูกพืชทั้งหมด (ไร่) ที่จังหวัดเป็นผู้กำหนด
// รายการที่ต้องรายงาน: กำหนดต่อ "หัวข้อ × ปีงบประมาณ" ว่าต้องรายงานกี่ครั้งต่อเดือน และต้องส่งภายในวันที่เท่าไรของแต่ละรอบ
// dueDays (เดิม) ใช้เป็นค่าเริ่มต้นสำหรับปีงบประมาณ/หัวข้อที่ยังไม่ได้กำหนดรายการ
export const TOPICS = [
  { key: "fert", label: "ปุ๋ยอินทรีย์" },
  { key: "area", label: "ไถกลบฟางข้าว" },
  { key: "burn", label: "สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา" },
] as const;

// จำนวนเกษตรตำบลรายอำเภอ แยกตามปีงบประมาณ + ตัวคูณเป้าหมายการผลิตต่อเกษตรตำบล 1 ราย (ตัน)
// เป้าหมายการผลิตปุ๋ยอินทรีย์/วัสดุอินทรีย์ของอำเภอ = จำนวนเกษตรตำบล × perTambon (เช่น กันทรลักษ์ 12 ราย × 130 = 1,560 ตัน)
// ปีงบประมาณที่ยังไม่มีรายการ ใช้จำนวนเกษตรตำบลเริ่มต้นใน DISTRICTS และตัวคูณจากการตั้งค่า (config.targetPerTambon)
export const DEFAULT_PER_TAMBON = 130;

export const MAX_ROUNDS = 4;

// ---------- ปีงบประมาณ (ช่วงรายงาน พ.ย. – มิ.ย.) ----------
// ปีงบประมาณ พ.ศ. 2570 = พ.ย. 2569 – มิ.ย. 2570 (8 เดือน) · ค่าที่ใช้ทั้งหมดเป็น "YYYY-MM" (ค.ศ.) เหมือนส่วนอื่นของระบบ
// เดือน ก.ค. – ต.ค. (นอกช่วงรายงาน) นับเป็นของปีงบประมาณถัดไป เพื่อให้ตั้งค่ากำหนดส่ง/พื้นที่ปลูกของปีหน้าล่วงหน้าได้
export const FY_START_MONTH = 11, FY_END_MONTH = 6; // ช่วงเริ่มต้นของปีงบประมาณที่จังหวัดไม่ได้กำหนดเอง

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

export const AREA_LEGACY_KEYS = ["totalArea", "accumArea", "straw", "strawValue"] as const; // รูปแบบเก่า (อ่านได้แต่ไม่ใช้)

export const DEFAULT_AREA_CONST: AreaConst = { targetPct: AREA_TARGET_PCT, strawKgPerRai: STRAW_KG_PER_RAI, strawValuePerRai: STRAW_VALUE_PER_RAI, balesPerRai: BALES_PER_RAI, balePrice: BALE_PRICE };

export const BURN_FIELDS: BurnFieldDef[] = [
  { key: "activities", label: "จำนวนกิจกรรมเรียนรู้/ประชาสัมพันธ์ที่จัด", unit: "ครั้ง" },
  { key: "villages", label: "หมู่บ้าน/ชุมชนที่ดำเนินการ", unit: "หมู่บ้าน" },
  { key: "participants", label: "ผู้เข้าร่วมกิจกรรม", unit: "ราย" },
  { key: "media", label: "สื่อประชาสัมพันธ์ที่เผยแพร่ (ป้าย/โปสเตอร์/ออนไลน์/เสียงตามสาย)", unit: "ชิ้น" },
];
