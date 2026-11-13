import type { ReactNode } from "react";
import { I } from "@/components/Entry";
import type { AppConfig, AreaConst, YearConfig } from "@/lib/data";

export type TabKey = "fy" | "fert" | "burn" | "area" | "text";
export const TABS: { key: TabKey; label: string; icon: keyof typeof I }[] = [
  { key: "fy", label: "ปีงบประมาณ", icon: "check" }, { key: "fert", label: "ช่องปุ๋ย", icon: "leaf" }, { key: "burn", label: "ช่องหยุดเผา", icon: "alert" },
  { key: "area", label: "ไถกลบฟางข้าว", icon: "sprout" }, { key: "text", label: "ขั้นสูง · ชื่อหัวข้อตาราง", icon: "info" },
];
export const SLICES: Record<TabKey, (c: AppConfig) => unknown> = {
  fy: c => c.fiscalYears, fert: c => [c.fertFields, c.targetPerTambon], burn: c => c.burnFields, area: c => c.area, text: c => [c.labels, c.topics],
};
export const newKey = (p: string) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
export const clone = (c: AppConfig): AppConfig => JSON.parse(JSON.stringify(c));
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// ค่าที่ใช้จริงของ scope: "base" = ค่ามาตรฐาน · ตัวเลข = ปีงบประมาณนั้น (ถ้าไม่ได้ตั้งเอง ใช้ค่ามาตรฐาน)
export const effOf = (c: AppConfig, scope: string): AppConfig => (scope === "base" ? c : { ...c, ...(c.byYear?.[scope] ?? {}) });
export const yearPart = (c: YearConfig): YearConfig => ({ targetPerTambon: c.targetPerTambon, fertFields: c.fertFields, burnFields: c.burnFields, area: c.area, topics: c.topics, labels: c.labels });
// ชื่อและหน่วยของค่าไถกลบฟางข้าวแต่ละตัว (ใช้ทั้งในแท็บ ตารางเปรียบเทียบรายปี และรายการที่แก้ไขหลังบันทึก)
export const AREA_FIELDS: { key: keyof AreaConst; label: string; unit: string }[] = [
  { key: "targetPct", label: "เป้าหมายพื้นที่ไถกลบ", unit: "%" }, { key: "strawKgPerRai", label: "ฟางข้าวต่อไร่", unit: "กก./ไร่" },
  { key: "strawValuePerRai", label: "มูลค่าไถกลบฟางข้าวต่อไร่", unit: "บาท/ไร่" }, { key: "balesPerRai", label: "ฟางก้อนต่อไร่", unit: "ก้อน/ไร่" },
  { key: "balePrice", label: "ราคาฟางก้อน", unit: "บาท/ก้อน" },
];
/** รายการค่าไถกลบฟางข้าวที่เปลี่ยนระหว่างค่าที่บันทึกไว้เดิม (a) กับฉบับร่าง (b) แยกตามปีงบประมาณ · "base" = ค่ามาตรฐาน */
export const areaChanges = (a: AppConfig, b: AppConfig) => {
  const scopes = ["base", ...Array.from(new Set([...Object.keys(a.byYear ?? {}), ...Object.keys(b.byYear ?? {})])).sort().reverse()];
  return scopes.flatMap(sc => AREA_FIELDS.flatMap(f => {
    const from = effOf(a, sc).area[f.key], to = effOf(b, sc).area[f.key];
    return from === to ? [] : [{ scope: sc, label: f.label, unit: f.unit, from, to }];
  }));
};
export const MONTH_NAMES = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
export const UNITS = ["ครั้ง", "หมู่บ้าน", "คน", "ราย", "ชิ้น", "แห่ง", "ตำบล", "ไร่", "ตัน"];

export type Msg = { t: string; bad?: boolean } | null;
/** ค่าและฟังก์ชันที่หน้าตั้งค่าส่งให้แต่ละแท็บ: draft = ฉบับร่างทั้งหมด · view = ค่าของปีงบประมาณที่กำลังแก้ · set/setG = แก้ค่าของปีนั้น/ค่าที่ใช้ร่วมทุกปี */
export interface TabProps {
  draft: AppConfig; saved: AppConfig; view: AppConfig; scope: string; curFy: number;
  set: (f: (c: YearConfig) => void) => void;
  setG: (f: (d: AppConfig) => void) => void;
  setScope: (s: string) => void; setMsg: (m: Msg) => void;
}

export function Tip({ title, children }: { title: string; children: ReactNode }) {
  return <div className="cf-tip"><span className="cf-tip-i">{I.info}</span><div><b>{title}</b><div>{children}</div></div></div>;
}


/** ปุ่มจัดการรายการ (ย้ายขึ้น/ลง/ลบ) — แสดงเฉพาะตอนเปิดแก้ไขรายการนั้น เพื่อไม่ให้แถวรายการรก */
export function EditActions({ onUp, onDown, onDelete, onDone, upOff, downOff, delOff, noun = "ช่อง" }: { onUp: () => void; onDown: () => void; onDelete?: () => void; onDone: () => void; upOff?: boolean; downOff?: boolean; delOff?: boolean; noun?: string }) {
  return (
    <div className="cf-edit-act">
      <button type="button" className="ux-btn sm" onClick={onDone}>เสร็จ</button>
      <button type="button" className="ux-btn line sm" disabled={upOff} onClick={onUp}>↑ ย้ายขึ้น</button>
      <button type="button" className="ux-btn line sm" disabled={downOff} onClick={onDown}>↓ ย้ายลง</button>
      {onDelete && <button type="button" className="ux-btn line sm danger" disabled={delOff} onClick={onDelete}>ลบ{noun}</button>}
    </div>);
}
