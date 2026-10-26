"use client";
import { startTransition, useEffect, useState } from "react";
import { PageHead } from "@/components/Entry";
import ReportingSettings from "@/components/SettingsReporting";
import ConfigSettings from "@/components/SettingsConfig";

// หน้าตั้งค่าเดียวของจังหวัด: รวม "ตั้งค่าการรายงาน" (รอบ/กำหนดส่ง/พื้นที่ปลูก) กับ "ตั้งค่าหัวข้อและรายการ" (ปีงบประมาณ/ช่องข้อมูล/ชื่อหัวตาราง)
// ทั้งสองส่วนถูก mount ค้างไว้ตลอด (ซ่อนด้วย hidden) เพื่อไม่ให้ค่าที่แก้ค้างอยู่หายตอนสลับแท็บ
type Part = "report" | "config";
const PARTS: { key: Part; label: string; hint: string }[] = [
  { key: "report", label: "การรายงาน", hint: "รอบ · วันกำหนดส่ง · พื้นที่ปลูกพืช" },
  { key: "config", label: "หัวข้อและรายการ", hint: "ปีงบประมาณ · ช่องข้อมูล · ชื่อหัวตาราง" },
];

export default function ProvinceSettingsPage() {
  const [part, setPart] = useState<Part>("report");
  // เปิดลิงก์ /province/settings#config (หรือลิงก์เดิม /province/config) แล้วไปที่ส่วนนั้นเลย — อ่าน hash หลัง mount เท่านั้น
  useEffect(() => { startTransition(() => { if (window.location.hash === "#config") setPart("config"); }); }, []);
  const choose = (p: Part) => { setPart(p); window.history.replaceState(null, "", p === "config" ? "#config" : window.location.pathname); };

  return (
    <div>
      <PageHead title="ตั้งค่า" sub="รวมการตั้งค่าทั้งหมดของจังหวัดไว้ที่เดียว · เลือกส่วนที่ต้องการแก้ไขด้านล่าง · เฉพาะเจ้าหน้าที่จังหวัด · ไม่ต้องแก้โค้ด" />
      <div className="ux-seg" role="group" aria-label="เลือกส่วนการตั้งค่า">
        {PARTS.map(p => (
          <button key={p.key} type="button" aria-pressed={part === p.key} onClick={() => choose(p.key)}>
            {p.label}<small style={{ display: "block", fontWeight: 400, opacity: .75 }}>{p.hint}</small>
          </button>))}
      </div>
      <div hidden={part !== "report"}><ReportingSettings /></div>
      <div hidden={part !== "config"}><ConfigSettings /></div>
    </div>
  );
}
