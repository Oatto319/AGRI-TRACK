"use client";
import { useState } from "react";
import { strawBales, baleValue, strawTons, strawValue, areaTarget, type AppConfig } from "@/lib/data";
import { f2 } from "@/components/Entry";
import { Tip, type TabProps } from "./shared";

// แท็บ 4: ตัวคูณไถกลบฟางข้าว/ฟางก้อน พร้อมช่องลองคำนวณ
export default function AreaConstTab({ view, set }: TabProps) {
  const [ex, setEx] = useState({ rai: "1000", total: "10000" });
  const K = view.area;
  const rai = Number(ex.rai) || 0, tot = Number(ex.total) || 0;
  const numIn = (k: keyof AppConfig["area"], label: string, unit: string, help: string) => (
    <div className="cf-box" key={k}><label className="ux-lbl" htmlFor={`k-${k}`}>{label}</label>
      <div className="ux-num-in filled"><input id={`k-${k}`} type="number" min={0} step="any" value={K[k]} onChange={e => set(c => { c.area[k] = Number(e.target.value); })} /><span>{unit}</span></div>
      <p className="ux-note">{help}</p></div>);
  return (
    <>
      <Tip title="ใช้ทำอะไร">ตัวเลขที่ระบบใช้คำนวณเป้าหมายพื้นที่ ปริมาณฟางข้าว มูลค่า และฟางก้อน จากไร่ที่อำเภอรายงาน · เปลี่ยนแล้วตัวเลขทุกหน้าคำนวณใหม่ทันที (รวมข้อมูลเก่า)</Tip>
      <div className="cf-cols">
        <div className="ux-two" style={{ alignContent: "start" }}>
          {numIn("targetPct", "เป้าหมายพื้นที่ไถกลบ", "%", "ร้อยละของพื้นที่ปลูกพืชทั้งหมดของอำเภอ")}
          {numIn("strawKgPerRai", "ฟางข้าวต่อไร่", "กก./ไร่", "ใช้คำนวณปริมาณฟางข้าว (ตัน)")}
          {numIn("strawValuePerRai", "มูลค่าไถกลบฟางข้าวต่อไร่", "บาท/ไร่", "ใช้คำนวณมูลค่า (บาท)")}
          {numIn("balesPerRai", "ฟางก้อนต่อไร่", "ก้อน/ไร่", "ใช้คำนวณจำนวนฟางก้อน")}
          {numIn("balePrice", "ราคาฟางก้อน", "บาท/ก้อน", "ใช้คำนวณราคาฟางก้อน (บาท)")}
        </div>
        <aside className="cf-prev" aria-label="ลองคำนวณ">
          <div className="cf-prev-t">ลองคำนวณดู</div>
          <label className="ux-lbl" htmlFor="ex-rai">ถ้าไถกลบสะสม (ไร่)</label>
          <div className="ux-num-in filled"><input id="ex-rai" type="number" min={0} value={ex.rai} onChange={e => setEx({ ...ex, rai: e.target.value })} /><span>ไร่</span></div>
          <div className="cf-prev-f"><span>ฟางข้าว</span><b>{f2(strawTons(rai, K))} ตัน</b></div>
          <div className="cf-prev-f"><span>มูลค่า</span><b>{f2(strawValue(rai, K))} บาท</b></div>
          <div className="cf-prev-f"><span>ฟางก้อน</span><b>{f2(strawBales(rai, K))} ก้อน</b></div>
          <div className="cf-prev-f"><span>ราคาฟางก้อน</span><b>{f2(baleValue(rai, K))} บาท</b></div>
          <label className="ux-lbl" htmlFor="ex-tot" style={{ marginTop: ".8rem" }}>ถ้าพื้นที่ปลูกพืชทั้งหมด (ไร่)</label>
          <div className="ux-num-in filled"><input id="ex-tot" type="number" min={0} value={ex.total} onChange={e => setEx({ ...ex, total: e.target.value })} /><span>ไร่</span></div>
          <div className="cf-prev-f"><span>เป้าหมาย {K.targetPct}%</span><b>{f2(areaTarget(tot, K))} ไร่</b></div>
        </aside>
      </div>
    </>
  );
}
