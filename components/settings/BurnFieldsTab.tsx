"use client";
import { useState } from "react";
import { I } from "@/components/Entry";
import { EditActions, Tip, UNITS, newKey, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 3: ช่องรายงานการหยุดเผา — เห็นรายการก่อน กด "แก้ไข" ที่ช่องเดียวแล้วค่อยเห็นชื่อ หน่วย ปุ่มย้าย/ลบ
export default function BurnFieldsTab({ view, set }: TabProps) {
  const confirm = useConfirm();
  const [ed, setEd] = useState<string | null>(null);
  const list = view.burnFields;
  const swap = (i: number, j: number) => set(c => { [c.burnFields[i], c.burnFields[j]] = [c.burnFields[j], c.burnFields[i]]; });
  return (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดช่องตัวเลขที่อำเภอรายงานเรื่องการสร้างการเรียนรู้/ประชาสัมพันธ์การหยุดเผา เช่น จำนวนกิจกรรม จำนวนหมู่บ้าน · กด “แก้ไข” เพื่อเปลี่ยนชื่อ หน่วย ลำดับ หรือลบ (ตัวเลขเป็นจำนวนเต็ม)</Tip>
      <datalist id="units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
      <div className="fy-head">
        <h3 className="cf-h3">ช่องหยุดเผาที่ตั้งไว้ ({list.length} ช่อง)</h3>
        <button type="button" className="ux-btn" disabled={list.length >= 20} onClick={() => { const key = newKey("b"); set(c => { c.burnFields.push({ key, label: "", unit: "ครั้ง" }); }); setEd(key); }}>{I.plus}เพิ่มช่อง</button>
      </div>
      <div className="cf-cols">
        <div>
          <section className="cf-group">
            {list.map((f, i) => ed === f.key ? (
              <div key={f.key} className="cf-item-edit">
                <div className="cf-item">
                  <span className="cf-no">{i + 1}</span>
                  <input aria-label="ชื่อช่อง" autoFocus className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง" value={f.label} maxLength={120} onChange={e => set(c => { c.burnFields[i].label = e.target.value; })} />
                  <input aria-label="หน่วย" list="units" className={`cf-unit${f.unit.trim() ? "" : " bad"}`} placeholder="หน่วย" value={f.unit} maxLength={30} onChange={e => set(c => { c.burnFields[i].unit = e.target.value; })} />
                </div>
                <EditActions upOff={i === 0} downOff={i === list.length - 1} delOff={list.length <= 1} onUp={() => swap(i - 1, i)} onDown={() => swap(i, i + 1)} onDone={() => setEd(null)}
                  onDelete={async () => { if (await confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}”?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) { set(c => { c.burnFields = c.burnFields.filter(x => x.key !== f.key); }); setEd(null); } }} />
              </div>
            ) : (
              <div key={f.key} className="cf-item cf-row-ro">
                <span className="cf-no">{i + 1}</span>
                <span className={`cf-name${f.label.trim() ? "" : " bad"}`}>{f.label || "(ยังไม่มีชื่อ)"}</span>
                <span className="cf-unit-ro">{f.unit || "?"}</span>
                <button type="button" className="ux-btn line sm" onClick={() => setEd(f.key)}>แก้ไข</button>
              </div>))}
          </section>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {list.map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>{f.unit || "?"}</em></span></div>)}
        </aside>
      </div>
    </>
  );
}
