"use client";
import { I } from "@/components/Entry";
import { Tip, UNITS, newKey, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 3: ช่องรายงานการหยุดเผา
export default function BurnFieldsTab({ view, set }: TabProps) {
  const confirm = useConfirm();
  return (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดช่องตัวเลขที่อำเภอรายงานเรื่องการสร้างการเรียนรู้/ประชาสัมพันธ์การหยุดเผา เช่น จำนวนกิจกรรม จำนวนหมู่บ้าน · ตั้งชื่อและหน่วยเองได้ (ตัวเลขเป็นจำนวนเต็ม)</Tip>
      <datalist id="units">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
      <div className="cf-cols">
        <div>
          <section className="cf-group">
            {view.burnFields.map((f, i) => (
              <div key={f.key} className="cf-item">
                <span className="cf-no">{i + 1}</span>
                <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง" value={f.label} maxLength={120} onChange={e => set(c => { c.burnFields[i].label = e.target.value; })} />
                <input aria-label="หน่วย" list="units" className={`cf-unit${f.unit.trim() ? "" : " bad"}`} placeholder="หน่วย" value={f.unit} maxLength={30} onChange={e => set(c => { c.burnFields[i].unit = e.target.value; })} />
                <button type="button" className="cf-ic" disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => set(c => { [c.burnFields[i - 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i - 1]]; })}>↑</button>
                <button type="button" className="cf-ic" disabled={i === view.burnFields.length - 1} aria-label="เลื่อนลง" onClick={() => set(c => { [c.burnFields[i + 1], c.burnFields[i]] = [c.burnFields[i], c.burnFields[i + 1]]; })}>↓</button>
                <button type="button" className="cf-ic del" disabled={view.burnFields.length <= 1} aria-label="ลบช่อง" onClick={async () => { if (await confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}”?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) set(c => { c.burnFields = c.burnFields.filter(x => x.key !== f.key); }); }}>ลบ</button>
              </div>))}
            <button type="button" className="ux-btn line sm" disabled={view.burnFields.length >= 20} onClick={() => set(c => { c.burnFields.push({ key: newKey("b"), label: "", unit: "ครั้ง" }); })}>{I.plus}เพิ่มช่อง</button>
          </section>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {view.burnFields.map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>{f.unit || "?"}</em></span></div>)}
        </aside>
      </div>
    </>
  );
}
