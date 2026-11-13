"use client";
import { useState } from "react";
import type { FieldDef } from "@/lib/data";
import { I } from "@/components/Entry";
import { EditActions, Tip, newKey, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 2: ช่องปุ๋ย — จัดแบบเดียวกับแท็บปีงบประมาณ: เห็นรายการก่อน กด "แก้ไข" ที่ช่อง/กลุ่มเดียวแล้วค่อยเห็นปุ่มย้าย/ลบ
type Editing = { kind: "field"; key: string } | { kind: "group"; i: number } | null;

export default function FertFieldsTab({ view, set }: TabProps) {
  const confirm = useConfirm();
  const [ed, setEd] = useState<Editing>(null);
  const groups = Array.from(new Set(view.fertFields.map(f => f.group)));
  const total = view.fertFields.length;
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
  const addToGroup = (g: string) => { const key = newKey("f"); set(c => {
    let last = -1; c.fertFields.forEach((f, i) => { if (f.group === g) last = i; });
    c.fertFields.splice(last + 1, 0, { key, label: "", group: g });
  }); setEd({ kind: "field", key }); };
  // ย้ายช่องไปกลุ่มอื่น: ไปต่อท้ายกลุ่มปลายทาง
  const changeGroup = (key: string, to: string) => set(c => {
    const f = c.fertFields.find(x => x.key === key); if (!f) return;
    c.fertFields = c.fertFields.filter(x => x.key !== key);
    let last = -1; c.fertFields.forEach((x, i) => { if (x.group === to) last = i; });
    c.fertFields.splice(last + 1, 0, { ...f, group: to });
  });
  const delField = async (f: FieldDef) => { if (await confirm(`ลบช่อง “${f.label || "ยังไม่มีชื่อ"}” ออกจากแบบฟอร์มและตาราง?\n\n(ข้อมูลที่อำเภอเคยกรอกไว้ยังอยู่ในฐานข้อมูล ไม่หาย)`)) { set(c => { c.fertFields = c.fertFields.filter(x => x.key !== f.key); }); setEd(null); } };
  return (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดว่าอำเภอต้องกรอกปุ๋ย/วัสดุอะไรบ้างในแต่ละเดือน แบ่งเป็นกลุ่ม (เช่น ปุ๋ยอินทรีย์ ปุ๋ยพืชสด วัสดุอินทรีย์) · กด “แก้ไข” ที่ช่องหรือกลุ่มเพื่อเปลี่ยนชื่อ ย้ายลำดับ หรือลบ · ลบช่องคือซ่อนจากหน้าจอ ข้อมูลเก่ายังอยู่</Tip>
      <div className="fy-head">
        <h3 className="cf-h3">ช่องปุ๋ยที่ตั้งไว้ ({total} ช่อง · {groups.length} กลุ่ม)</h3>
        <button type="button" className="ux-btn" disabled={total >= 30} onClick={() => { set(c => { c.fertFields.push({ key: newKey("f"), label: "", group: `กลุ่มใหม่ ${groups.length + 1}` }); }); setEd({ kind: "group", i: groups.length }); }}>{I.plus}เพิ่มกลุ่มใหม่</button>
      </div>
      <div className="cf-cols">
        <div>
          {groups.map((g, gi) => {
            const items = view.fertFields.filter(f => f.group === g), editingG = ed?.kind === "group" && ed.i === gi;
            return (
              <section key={gi} className={`cf-group${editingG ? " editing" : ""}`}>
                <header>
                  {editingG
                    ? <input aria-label="ชื่อกลุ่ม" className="cf-gname" value={g} maxLength={60} placeholder="ชื่อกลุ่ม" autoFocus onChange={e => renameGroup(g, e.target.value)} />
                    : <b className="cf-gtitle">{g || "(ยังไม่มีชื่อกลุ่ม)"}</b>}
                  <span className="cf-count">{items.length} ช่อง</span>
                  {!editingG && <button type="button" className="ux-btn line sm" onClick={() => setEd({ kind: "group", i: gi })}>แก้ไขกลุ่ม</button>}
                </header>
                {editingG && <EditActions noun="กลุ่ม" upOff={gi === 0} downOff={gi === groups.length - 1} onUp={() => { moveGroup(g, -1); setEd({ kind: "group", i: gi - 1 }); }} onDown={() => { moveGroup(g, 1); setEd({ kind: "group", i: gi + 1 }); }} onDone={() => setEd(null)} />}
                {items.map((f, i) => {
                  const on = ed?.kind === "field" && ed.key === f.key;
                  return on ? (
                    <div key={f.key} className="cf-item-edit">
                      <div className="cf-item">
                        <span className="cf-no">{i + 1}</span>
                        <input aria-label="ชื่อช่อง" autoFocus className={f.label.trim() ? "" : "bad"} placeholder="พิมพ์ชื่อช่อง เช่น ปุ๋ยคอก" value={f.label} maxLength={80} onChange={e => set(c => { const t = c.fertFields.find(x => x.key === f.key); if (t) t.label = e.target.value; })} onKeyDown={e => e.key === "Enter" && setEd(null)} />
                      </div>
                      {groups.length > 1 && <label className="cf-move">อยู่ในกลุ่ม
                        <select className="ux-select" value={g} onChange={e => changeGroup(f.key, e.target.value)}>{groups.map(n => <option key={n} value={n}>{n || "(ยังไม่มีชื่อกลุ่ม)"}</option>)}</select></label>}
                      <EditActions upOff={i === 0} downOff={i === items.length - 1} delOff={total <= 1} onUp={() => moveField(f.key, -1)} onDown={() => moveField(f.key, 1)} onDelete={() => delField(f)} onDone={() => setEd(null)} />
                    </div>
                  ) : (
                    <div key={f.key} className="cf-item cf-row-ro">
                      <span className="cf-no">{i + 1}</span>
                      <span className={`cf-name${f.label.trim() ? "" : " bad"}`}>{f.label || "(ยังไม่มีชื่อ)"}</span>
                      <button type="button" className="ux-btn line sm" onClick={() => setEd({ kind: "field", key: f.key })}>แก้ไข</button>
                    </div>);
                })}
                <button type="button" className="ux-btn line sm" disabled={total >= 30} onClick={() => addToGroup(g)}>{I.plus}เพิ่มช่องในกลุ่มนี้</button>
              </section>);
          })}
          <div className="cf-box" style={{ marginTop: "1.2rem" }}>
            <label className="ux-lbl" htmlFor="tpt">เป้าหมายปุ๋ยต่อเกษตรตำบล 1 ราย</label>
            <div className="ux-num-in filled" style={{ maxWidth: 260 }}><input id="tpt" type="number" min={0} step="any" value={view.targetPerTambon} onChange={e => set(c => { c.targetPerTambon = Number(e.target.value); })} /><span>ตัน</span></div>
            <p className="ux-note">เป้าหมายของอำเภอ = จำนวนเกษตรตำบล × ค่านี้ · ใช้กับปีที่ยังไม่ได้ระบุจำนวนเกษตรตำบลและตัวคูณรายปีไว้ที่แท็บ “การรายงาน” ข้อ 3 (ถ้าระบุไว้ ระบบจะใช้ค่านั้นแทน)</p>
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
