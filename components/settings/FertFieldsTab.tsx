"use client";
import type { FieldDef } from "@/lib/data";
import { I } from "@/components/Entry";
import { Tip, newKey, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 2: ช่องปุ๋ย (เพิ่ม/ลบ/เปลี่ยนชื่อ/จัดกลุ่ม) และเป้าหมายต่อเกษตรตำบล
export default function FertFieldsTab({ view, set }: TabProps) {
  const confirm = useConfirm();
  const groups = Array.from(new Set(view.fertFields.map(f => f.group)));
  const moveGroup = (g: string, d: number) => set(c => {
    const order = Array.from(new Set(c.fertFields.map(f => f.group))); const i = order.indexOf(g), j = i + d;
    if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]];
    c.fertFields = order.flatMap(n => c.fertFields.filter(f => f.group === n));
  });
  const moveField = (key: string, d: number) => set(c => {
    const i = c.fertFields.findIndex(f => f.key === key); const g = c.fertFields[i].group;
    let j = i + d; while (j >= 0 && j < c.fertFields.length && c.fertFields[j].group !== g) j += d;
    if (j < 0 || j >= c.fertFields.length) return; [c.fertFields[i], c.fertFields[j]] = [c.fertFields[j], c.fertFields[i]];
  });
  const renameGroup = (g: string, to: string) => set(c => { c.fertFields.forEach(f => { if (f.group === g) f.group = to; }); });
  const addToGroup = (g: string) => set(c => {
    let last = -1; c.fertFields.forEach((f, i) => { if (f.group === g) last = i; });
    c.fertFields.splice(last + 1, 0, { key: newKey("f"), label: "", group: g });
  });
  const delField = async (f: FieldDef) => { if (await confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}” ออกจากแบบฟอร์มและตาราง?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) set(c => { c.fertFields = c.fertFields.filter(x => x.key !== f.key); }); };
  return (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดว่าอำเภอต้องกรอกปุ๋ย/วัสดุอะไรบ้างในแต่ละเดือน แบ่งเป็นกลุ่ม (เช่น ปุ๋ยอินทรีย์ ปุ๋ยพืชสด วัสดุอินทรีย์) · พิมพ์ชื่อแก้ได้เลย · ลบช่องคือซ่อนจากหน้าจอ ข้อมูลเก่ายังอยู่</Tip>
      <div className="cf-cols">
        <div>
          {groups.map((g, gi) => (
            <section key={gi} className="cf-group">
              <header>
                <input aria-label="ชื่อกลุ่ม" className="cf-gname" value={g} maxLength={60} placeholder="ชื่อกลุ่ม" onChange={e => renameGroup(g, e.target.value)} />
                <span className="cf-count">{view.fertFields.filter(f => f.group === g).length} ช่อง</span>
                <button type="button" className="cf-ic" disabled={gi === 0} aria-label="เลื่อนกลุ่มขึ้น" onClick={() => moveGroup(g, -1)}>↑</button>
                <button type="button" className="cf-ic" disabled={gi === groups.length - 1} aria-label="เลื่อนกลุ่มลง" onClick={() => moveGroup(g, 1)}>↓</button>
              </header>
              {view.fertFields.filter(f => f.group === g).map((f, i) => (
                <div key={f.key} className="cf-item">
                  <span className="cf-no">{i + 1}</span>
                  <input aria-label="ชื่อช่อง" className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง เช่น ปุ๋ยคอก" value={f.label} maxLength={80} onChange={e => set(c => { const t = c.fertFields.find(x => x.key === f.key); if (t) t.label = e.target.value; })} />
                  <button type="button" className="cf-ic" aria-label="เลื่อนขึ้น" onClick={() => moveField(f.key, -1)}>↑</button>
                  <button type="button" className="cf-ic" aria-label="เลื่อนลง" onClick={() => moveField(f.key, 1)}>↓</button>
                  <button type="button" className="cf-ic del" aria-label="ลบช่อง" disabled={view.fertFields.length <= 1} onClick={() => delField(f)}>ลบ</button>
                </div>))}
              <button type="button" className="ux-btn line sm" disabled={view.fertFields.length >= 30} onClick={() => addToGroup(g)}>{I.plus}เพิ่มช่องในกลุ่มนี้</button>
            </section>))}
          <button type="button" className="ux-btn" disabled={view.fertFields.length >= 30} onClick={() => set(c => { c.fertFields.push({ key: newKey("f"), label: "", group: `กลุ่มใหม่ ${groups.length + 1}` }); })}>{I.plus}เพิ่มกลุ่มใหม่</button>
          <div className="cf-box" style={{ marginTop: "1.2rem" }}>
            <label className="ux-lbl" htmlFor="tpt">เป้าหมายปุ๋ยต่อเกษตรตำบล 1 ราย</label>
            <div className="ux-num-in filled" style={{ maxWidth: 260 }}><input id="tpt" type="number" min={0} step="any" value={view.targetPerTambon} onChange={e => set(c => { c.targetPerTambon = Number(e.target.value); })} /><span>ตัน</span></div>
            <p className="ux-note">เป้าหมายของอำเภอ = จำนวนเกษตรตำบล × ค่านี้ · ค่าตั้งต้นของปีที่ยังไม่มีรายการ · ถ้าตั้งจำนวนเกษตรตำบลและตัวคูณรายปีไว้ที่แท็บ “การรายงาน” ข้อ 3 ระบบจะใช้ค่านั้นแทน</p>
          </div>
        </div>
        <aside className="cf-prev" aria-label="ตัวอย่างแบบฟอร์ม">
          <div className="cf-prev-t">ตัวอย่างที่อำเภอจะเห็น</div>
          {groups.map((g, gi) => (<div key={gi}><div className="cf-prev-g">{g || "(ยังไม่มีชื่อกลุ่ม)"}</div>
            {view.fertFields.filter(f => f.group === g).map(f => <div key={f.key} className="cf-prev-f"><span>{f.label || "(ยังไม่มีชื่อ)"}</span><span className="cf-prev-box">0 <em>ตัน</em></span></div>)}</div>))}
        </aside>
      </div>
    </>
  );
}
