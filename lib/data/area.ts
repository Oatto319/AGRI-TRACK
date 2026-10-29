import { DEFAULT_AREA_CONST } from "./constants";
import { fiscalRange, fiscalYearOf, isTopicMonth } from "./fiscal";
import type { AreaConst } from "./types";

// พื้นที่ปลูกพืชทั้งหมดที่ใช้คำนวณ: ถ้าจังหวัดกำหนดไว้ (>0) ใช้ค่านั้น · ถ้ายังไม่กำหนด ใช้พื้นที่สะสมทั้งหมดแทน เพื่อให้เป้าหมายและร้อยละแสดงผลได้
export const effectiveTotal = (set: number | undefined, accum: number) => (set && set > 0 ? set : accum);

export const areaTarget = (total: number, k: AreaConst = DEFAULT_AREA_CONST) => (total * k.targetPct) / 100;

export const areaPct = (accum: number, total: number) => (total > 0 ? Math.min(100, (accum / total) * 100) : 0); // สะสม ÷ พื้นที่ปลูกทั้งหมด × 100 (ไม่เกิน 100%)

export const strawTons = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => (rai * k.strawKgPerRai) / 1000; // (ไร่ × 500) ÷ 1000 = ตัน

export const strawValue = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => rai * k.strawValuePerRai; // ไร่ × 725 บาท

export const strawBales = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => rai * k.balesPerRai; // ฟางก้อน (ก้อน) = ไร่ × 25

export const baleValue = (rai: number, k: AreaConst = DEFAULT_AREA_CONST) => strawBales(rai, k) * k.balePrice; // ราคาฟางก้อน (บาท) = จำนวนก้อน × 35

// ฤดูกาลไถกลบ = ช่วงเดือนของปีงบประมาณที่จังหวัดตั้งไว้ (ค่าเริ่มต้น พ.ย. – มิ.ย.) · เดือนที่อยู่นอกช่วงก่อนเริ่มปี (เช่น ก.ค.–ต.ค.) ให้ถือเป็นฤดูกาลที่เพิ่งจบ
export const isAreaMonth = (ym: string) => isTopicMonth("area", ym);

export const areaSeasonOf = (ym: string) => {
  const fy = fiscalYearOf(ym), r = fiscalRange(fy, "area");
  const x = ym < r.from ? fiscalRange(fy - 1, "area") : r;
  return { start: x.from, end: x.to };
};

export const nearestAreaMonth = (ym: string) => (isAreaMonth(ym) ? ym : areaSeasonOf(ym).end);
