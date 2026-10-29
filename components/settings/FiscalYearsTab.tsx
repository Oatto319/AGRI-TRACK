"use client";
import { useState } from "react";
import { TOPICS, fiscalRangeFor, periodMonths, thaiMonth, topicLabelOf, FY_START_MONTH, FY_END_MONTH, type Topic, type TopicPeriods } from "@/lib/data";
import { I } from "@/components/Entry";
import { MONTH_NAMES, Tip, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

// แท็บ 1: ปีงบประมาณและช่วงเดือนที่ดำเนินการ (ใช้ร่วมกันทุกปี)
export default function FiscalYearsTab({ draft, setG, setMsg, scope, setScope, curFy }: TabProps) {
  const confirm = useConfirm();
  const [fyIn, setFyIn] = useState("");
  const [newS, setNewS] = useState(FY_START_MONTH), [newE, setNewE] = useState(FY_END_MONTH); // เดือนเริ่ม/สิ้นสุดของปีที่จะเพิ่ม
  const [newT, setNewT] = useState<TopicPeriods>({}); // ช่วงเดือนเฉพาะหัวข้อของปีที่จะเพิ่ม (ไม่ระบุ = ใช้ช่วงรวมของปี)
  const [edit, setEdit] = useState<{ old: number; fy: string; s: number; e: number; t: TopicPeriods } | null>(null);
  const knownYears = [...draft.fiscalYears].sort((a, b) => b.fy - a.fy);
  const nextYear = (knownYears.length ? knownYears[0].fy : curFy) + 1; // curFy = 0 ตอนยังไม่รู้เดือนปัจจุบัน
  const monthSel = (id: string, label: string, v: number, on: (n: number) => void) => (
    <div><label className="ux-lbl" htmlFor={id}>{label}</label>
      <select id={id} className="ux-select" value={v} onChange={e => on(Number(e.target.value))}>{MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></div>);
  const rangeText = (y: number, sm: number, em: number) => { const r = fiscalRangeFor(y, sm, em); return `${thaiMonth(r.from)} – ${thaiMonth(r.to)} · ${periodMonths(sm, em)} เดือน`; };
  // ช่วงเดือนแยกตามหัวข้อ: เปิดใช้เฉพาะหัวข้อที่ช่วงเดือนไม่ตรงกับช่วงรวมของปี (เช่น ไถกลบถึง มิ.ย. แต่ปุ๋ยรายงานถึง พ.ค.)
  const topicRanges = (v: TopicPeriods, base: { s: number; e: number }, on: (n: TopicPeriods) => void, id: string) => (
    <div className="cf-box" style={{ display: "grid", gap: ".6rem" }}>
      <b>ช่วงเดือนแยกตามหัวข้อ (ไม่บังคับ)</b>
      <p className="ux-note" style={{ margin: 0 }}>หัวข้อที่ไม่ติ๊ก = ใช้ช่วงรวมของปีด้านบน · ติ๊กเฉพาะหัวข้อที่รายงานไม่ตรงกับช่วงรวม เช่น ปุ๋ยรายงานถึงพฤษภาคม แต่ไถกลบถึงมิถุนายน</p>
      {TOPICS.map(t => { const o = v[t.key as Topic], k = `${id}-${t.key}`; return (
        <div key={t.key} style={{ display: "grid", gap: ".4rem" }}>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontWeight: 600 }}>
            <input type="checkbox" checked={!!o} onChange={e => { const n = { ...v }; if (e.target.checked) n[t.key as Topic] = { startMonth: base.s, endMonth: base.e }; else delete n[t.key as Topic]; on(n); }} />
            {topicLabelOf(draft, t.key as Topic)}
            <span className="ux-note" style={{ margin: 0, fontWeight: 400 }}>{o ? "" : "ใช้ช่วงรวมของปี"}</span>
          </label>
          {o && <div className="cf-row">
            {monthSel(`${k}-s`, "เดือนเริ่ม", o.startMonth, n => on({ ...v, [t.key]: { ...o, startMonth: n } }))}<span style={{ alignSelf: "end", paddingBottom: ".6rem" }}>ถึง</span>{monthSel(`${k}-e`, "เดือนสิ้นสุด", o.endMonth, n => on({ ...v, [t.key]: { ...o, endMonth: n } }))}
          </div>}
        </div>); })}
    </div>);
  const topicText = (d: { topics?: TopicPeriods }) => TOPICS.filter(t => d.topics?.[t.key as Topic]).map(t => { const o = d.topics![t.key as Topic]!; return `${topicLabelOf(draft, t.key as Topic)}: ${MONTH_NAMES[o.startMonth - 1]} – ${MONTH_NAMES[o.endMonth - 1]}`; });
  function addYear(y: number) {
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "กรอกปีงบประมาณเป็น พ.ศ. 4 หลัก เช่น 2571", bad: true });
    if (knownYears.some(d => d.fy === y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว (กด “แก้ไข” ที่ปีนั้นเพื่อเปลี่ยนช่วงเดือน)`, bad: true });
    setG(d => { d.fiscalYears = [...d.fiscalYears, { fy: y, startMonth: newS, endMonth: newE, ...(Object.keys(newT).length ? { topics: newT } : {}) }].sort((a, b) => b.fy - a.fy); }); setFyIn(""); setNewT({});
  }
  function applyEdit() {
    if (!edit) return;
    const y = Number(edit.fy);
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setMsg({ t: "ปีงบประมาณต้องเป็น พ.ศ. 4 หลัก เช่น 2571", bad: true });
    if (y !== edit.old && knownYears.some(d => d.fy === y)) return setMsg({ t: `มีปีงบประมาณ ${y} อยู่แล้ว`, bad: true });
    setG(d => {
      d.fiscalYears = d.fiscalYears.map(x => x.fy === edit.old ? { fy: y, startMonth: edit.s, endMonth: edit.e, ...(Object.keys(edit.t).length ? { topics: edit.t } : {}) } : x).sort((a, b) => b.fy - a.fy);
      if (y !== edit.old && d.byYear?.[String(edit.old)]) { d.byYear[String(y)] = d.byYear[String(edit.old)]; delete d.byYear[String(edit.old)]; } // ย้ายการตั้งค่ารายปีตามปีที่เปลี่ยน
    });
    if (scope === String(edit.old)) setScope(String(y));
    setEdit(null);
  }
  return (
    <>
      <Tip title="ใช้ทำอะไร">กำหนดปีงบประมาณและ <b>ช่วงเดือนที่ดำเนินการ</b> (เดือนเริ่ม – เดือนสิ้นสุด) ของแต่ละปี เช่น พฤศจิกายน – มิถุนายน · แต่ละหัวข้อ (ปุ๋ยอินทรีย์ ไถกลบฟางข้าว หยุดเผา) กำหนดช่วงเดือนแยกกันได้ · ปีงบประมาณที่เพิ่มไว้แก้ไขหรือลบได้ภายหลัง · ปีที่ไม่ได้เพิ่มเองจะใช้ช่วงเริ่มต้น พ.ย. – มิ.ย. · กดบันทึกที่แถบด้านล่างเมื่อเสร็จ</Tip>
      <section className="cf-group" style={{ marginTop: "1rem" }}>
        <header><b>เพิ่มปีงบประมาณใหม่</b></header>
        <p className="ux-note" style={{ margin: 0 }}>ขั้นที่ 1 · เลือกช่วงเดือนที่ดำเนินการ</p>
        <div className="cf-row">
          {monthSel("fy-s", "เดือนเริ่ม", newS, setNewS)}<span style={{ alignSelf: "end", paddingBottom: ".6rem" }}>ถึง</span>{monthSel("fy-e", "เดือนสิ้นสุด", newE, setNewE)}
        </div>
        <p className="ux-note" style={{ margin: 0 }}>ช่วงรวมนี้ใช้กับทุกหัวข้อ · ถ้าหัวข้อใดรายงานไม่ตรงกัน ให้กำหนดช่วงเฉพาะหัวข้อด้านล่าง</p>
        {topicRanges(newT, { s: newS, e: newE }, setNewT, "nt")}
        <p className="ux-note" style={{ margin: 0 }}>ขั้นที่ 2 · ใส่ปีงบประมาณ (พ.ศ.)</p>
        <div className="cf-row">
          <div className="ux-num-in" style={{ width: 200 }}><input aria-label="ปีงบประมาณที่ต้องการเพิ่ม" type="number" inputMode="numeric" placeholder="เช่น 2571" value={fyIn} onChange={e => setFyIn(e.target.value)} onKeyDown={e => e.key === "Enter" && addYear(Number(fyIn))} /></div>
          <button type="button" className="ux-btn" onClick={() => addYear(Number(fyIn))}>{I.plus}เพิ่มปีนี้</button>
          {(knownYears.length > 0 || curFy > 0) && <button type="button" className="ux-btn line" onClick={() => addYear(nextYear)}>{I.plus}เพิ่มปีถัดไป ({nextYear})</button>}
        </div>
        {fyIn && Number(fyIn) >= 2500 && Number(fyIn) <= 2700 && <p className="ux-note" style={{ margin: 0 }}>ปีงบประมาณ {fyIn} = {rangeText(Number(fyIn), newS, newE)}</p>}
      </section>
      <h3 className="cf-h3">ปีงบประมาณที่เพิ่มไว้</h3>
      {knownYears.length === 0 ? <p className="ux-empty">ยังไม่ได้เพิ่มปีงบประมาณเอง</p> : (
        <div className="cf-chips">{knownYears.map(d => edit?.old === d.fy ? (
          <div key={d.fy} className="cf-year editing">
            <label className="ux-lbl" htmlFor="fy-ed">ปีงบประมาณ (พ.ศ.)</label>
            <div className="ux-num-in"><input id="fy-ed" type="number" inputMode="numeric" value={edit.fy} onChange={e => setEdit({ ...edit, fy: e.target.value })} /></div>
            {monthSel("fy-eds", "เดือนเริ่ม", edit.s, n => setEdit({ ...edit, s: n }))}
            {monthSel("fy-ede", "เดือนสิ้นสุด", edit.e, n => setEdit({ ...edit, e: n }))}
            {topicRanges(edit.t, { s: edit.s, e: edit.e }, t => setEdit({ ...edit, t }), "et")}
            {Number(edit.fy) >= 2500 && <span>{rangeText(Number(edit.fy), edit.s, edit.e)}</span>}
            <div className="cf-row"><button type="button" className="ux-btn sm" onClick={applyEdit}>ตกลง</button><button type="button" className="ux-btn line sm" onClick={() => setEdit(null)}>ยกเลิก</button></div>
          </div>
        ) : (
          <div key={d.fy} className="cf-year"><b>ปีงบประมาณ {d.fy}</b><span>{rangeText(d.fy, d.startMonth, d.endMonth)}</span>
            {topicText(d).map(x => <span key={x} className="ux-note" style={{ margin: 0 }}>{x}</span>)}
            <div className="cf-row">
              <button type="button" className="ux-btn line sm" onClick={() => setEdit({ old: d.fy, fy: String(d.fy), s: d.startMonth, e: d.endMonth, t: d.topics ?? {} })}>แก้ไข</button>
              <button type="button" className="cf-x" aria-label={`ลบปีงบประมาณ ${d.fy}`} onClick={async () => { if (await confirm(`ลบปีงบประมาณ ${d.fy} ออกจากรายการ?\n(ข้อมูลที่รายงานไว้ยังอยู่ในฐานข้อมูล · ช่วงเดือนของปีนี้จะกลับเป็นค่าเริ่มต้น พ.ย. – มิ.ย.)`)) setG(x => { x.fiscalYears = x.fiscalYears.filter(y => y.fy !== d.fy); }); }}>✕ ลบ</button>
            </div></div>))}</div>)}
    </>
  );
}
