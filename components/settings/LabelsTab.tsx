"use client";
import { useState } from "react";
import { DEFAULT_LABELS, LABEL_DEFS, TOPICS } from "@/lib/data";
import { Tip, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 5: ชื่อหัวข้อและหัวตาราง
export default function LabelsTab({ view, set }: TabProps) {
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  const labelVal = (k: string) => view.labels[k] ?? DEFAULT_LABELS[k];
  const setLabel = (k: string, v: string) => set(c => { if (v.trim() && v !== DEFAULT_LABELS[k]) c.labels[k] = v; else delete c.labels[k]; });
  const matches = (t: string) => !q.trim() || t.toLowerCase().includes(q.trim().toLowerCase());
  const labelGroups = Array.from(new Set(LABEL_DEFS.map(l => l.group)));
  const edited = (k: string) => k in view.labels;
  return (
    <>
      <Tip title="ใช้ทำอะไร">แก้ข้อความหัวตารางและชื่อแท็บที่แสดงในหน้าตารางจังหวัดและไฟล์ Excel · พิมพ์ทับข้อความได้เลย · ข้อความที่แก้แล้วจะมีป้าย “แก้แล้ว” กด “คืนค่าเดิม” เพื่อย้อนกลับ · {"{pct}"} = ร้อยละเป้าหมาย, {"{m}"} = ชื่อเดือน (ไม่ต้องลบ)</Tip>
      <div className="ux-text-in" style={{ margin: "1rem 0" }}><input aria-label="ค้นหาหัวข้อ" placeholder="ค้นหาหัวข้อ เช่น เป้าหมาย" value={q} onChange={e => setQ(e.target.value)} /></div>
      {TOPICS.some(t => matches(t.label) || matches(view.topics[t.key] ?? "")) && (
        <section className="cf-group"><header><b>ชื่อหัวข้อที่ต้องรายงาน</b></header>
          {TOPICS.filter(t => matches(t.label) || matches(view.topics[t.key] ?? "")).map(t => (
            <div key={t.key} className="cf-item cf-lab">
              <input aria-label={`ชื่อหัวข้อ ${t.label}`} value={view.topics[t.key] ?? t.label} maxLength={100} onChange={e => set(c => { if (e.target.value.trim() && e.target.value !== t.label) c.topics[t.key] = e.target.value; else delete c.topics[t.key]; })} />
              {t.key in view.topics && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => set(c => { delete c.topics[t.key]; })}>คืนค่าเดิม</button></>}
            </div>))}
        </section>)}
      {labelGroups.map(g => {
        const items = LABEL_DEFS.filter(l => l.group === g && (matches(l.text) || matches(labelVal(l.key))));
        if (!items.length) return null;
        return (
          <section key={g} className="cf-group"><header><b>{g}</b></header>
            <div className="cf-strip" aria-label="ตัวอย่างหัวตาราง">{LABEL_DEFS.filter(l => l.group === g).map(l => <span key={l.key}>{labelVal(l.key).replace("{pct}", String(view.area.targetPct)).replace("{m}", "ต.ค.")}</span>)}</div>
            {items.map(l => (
              <div key={l.key} className="cf-item cf-lab">
                <input aria-label={`หัวข้อ ${l.text}`} value={labelVal(l.key)} maxLength={150} onChange={e => setLabel(l.key, e.target.value)} />
                {edited(l.key) && <><span className="cf-badge">แก้แล้ว</span><button type="button" className="cf-ic" onClick={() => setLabel(l.key, DEFAULT_LABELS[l.key])}>คืนค่าเดิม</button></>}
              </div>))}
          </section>);
      })}
      {Object.keys(view.labels).length + Object.keys(view.topics).length > 0 && <button type="button" className="ux-btn line sm" onClick={async () => { if (await confirm("ล้างข้อความที่แก้ไว้ทั้งหมดในแท็บนี้ กลับไปใช้ข้อความเดิม?")) set(c => { c.labels = {}; c.topics = {}; }); }}>คืนค่าข้อความเดิมทั้งหมด</button>}
    </>
  );
}
