import { AREA_FIELDS, TOPICS } from "./constants";

// ช่องที่อำเภอกรอกในแต่ละเดือน (หน่วย: ตัน) — ตรงกับคอลัมน์ในไฟล์ Excel
export interface FieldDef { key: string; label: string; group: string }

export type FieldKey = string; // คีย์ช่องปุ๋ยจังหวัดเพิ่ม/ลดได้เอง (ดู AppConfig)

export interface Reporter { name: string; position: string; phone: string }

export interface Report {
  district: string; month: string; // month = "YYYY-MM" (ค.ศ.)
  round: number; // รอบที่ในเดือนนั้น (1..จำนวนครั้งต่อเดือนที่จังหวัดกำหนด)
  values: Partial<Record<FieldKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean; // บันทึกตอนส่งครั้งแรก ไม่เปลี่ยนเมื่อแก้ไขแล้วส่งซ้ำ
}

export type Topic = (typeof TOPICS)[number]["key"];

export interface Schedule { id: string; topic: Topic; fy: number; dueDays: number[] } // fy = ปีงบประมาณ พ.ศ.

// พื้นที่ปลูกพืชทั้งหมดรายอำเภอ แยกตามปีงบประมาณ (areaTotals เดิมใช้เป็นค่าสำรองสำหรับปีที่ยังไม่มีรายการ)
export interface AreaSet { id: string; fy: number; totals: Record<string, number> }

export interface TambonSet { id: string; fy: number; perTambon: number; tambon: Record<string, number> }

export interface Settings { dueDays: number[]; areaTotals: Record<string, number>; schedules: Schedule[]; areaSets: AreaSet[]; tambonSets: TambonSet[]; config: AppConfig }

// ช่วงเดือนของแต่ละปีงบประมาณที่จังหวัดกำหนดเอง (เดือนเริ่ม/เดือนสิ้นสุด) · อัปเดตอัตโนมัติทุกครั้งที่อ่านการตั้งค่า (cfgOf / readSettings)
// ช่วงเดือนแยกตามหัวข้อ (ไม่บังคับ): ถ้าหัวข้อใดไม่ได้กำหนด ใช้ช่วงรวมของปี (startMonth–endMonth) เช่น ไถกลบ พ.ย.–มิ.ย. แต่ปุ๋ยรายงานถึง พ.ค.
export type TopicPeriods = Partial<Record<Topic, { startMonth: number; endMonth: number }>>;

export interface FiscalYearDef { fy: number; startMonth: number; endMonth: number; topics?: TopicPeriods }
/** แปลงข้อมูลเก่า (เลขปีล้วน) เป็นรูปแบบใหม่ที่มีเดือนเริ่ม-สิ้นสุด */

export type AreaKey = (typeof AREA_FIELDS)[number]["key"];

export interface AreaReport {
  district: string; month: string; round: number;
  values: Partial<Record<AreaKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean;
}

export interface AreaConst { targetPct: number; strawKgPerRai: number; strawValuePerRai: number; balesPerRai: number; balePrice: number }

// ---------- สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา (แบบฟอร์มแยกอีกหน้า ใช้รอบและกำหนดส่งตามหัวข้อ "burn" ที่จังหวัดตั้งค่า) ----------
// อำเภอรายงานผลการดำเนินงานของเดือนนั้น (นับเป็นจำนวนเต็ม) รายงานได้ทุกเดือน · ระบบรวมทุกรอบเป็นยอดของเดือน และสะสมตามช่วงเดือนที่เลือก
export interface BurnFieldDef { key: string; label: string; unit: string }

export type BurnKey = string; // คีย์ช่องหยุดเผาจังหวัดเพิ่ม/ลดได้เอง (ดู AppConfig)

export interface BurnReport {
  district: string; month: string; round: number;
  values: Partial<Record<BurnKey, number>>;
  reporter: Reporter; status: "draft" | "submitted"; updatedAt: string;
  submittedAt?: string; dueDate?: string; late?: boolean;
}

// ---------- ค่าที่จังหวัดแก้ไขเองได้ในหน้า "ตั้งค่า" ส่วน "หัวข้อและรายการ" (ไม่ต้องแก้โค้ด) ----------
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
  tambonByDistrict?: Record<string, number>; // (คำนวณตอนอ่าน ไม่ได้เก็บในฐานข้อมูล) จำนวนเกษตรตำบลรายอำเภอของปีงบประมาณที่ระบุ จาก Settings.tambonSets
}
