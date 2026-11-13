"use client";
import { useState } from "react";
import { TOPICS, fiscalRangeFor, periodMonths, thaiMonth, topicLabelOf, FY_START_MONTH, FY_END_MONTH, type Topic, type TopicPeriods } from "@/lib/data";
import { I } from "@/components/Entry";
import { MONTH_NAMES, type TabProps } from "./shared";
import { useConfirm } from "@/components/ConfirmDialog";

type Form = { mode: "add" | "edit"; old: number; fy: string; s: number; e: number; t: TopicPeriods };

// แท็บ 1: ปีงบประมาณและช่วงเดือนที่ดำเนินการ (ใช้ร่วมกันทุกปี)
// ออกแบบใหม่: เห็นรายการปีที่ตั้งไว้ก่อน → กดปุ่มเดียวเพื่อเพิ่ม/แก้ไขในฟอร์มสั้น ๆ → ช่วงเดือนแยกหัวข้ออยู่ในส่วนขั้นสูงที่พับไว้
export default function FiscalYearsTab({ draft, setG, scope, setScope, curFy }: TabProps) {
  const confirm = useConfirm();
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const knownYears = [...draft.fiscalYears].sort((a, b) => b.fy - a.fy);
  const nextYear = (knownYears.length ? knownYears[0].fy : curFy) + 1; // curFy = 0 ตอนยังไม่รู้เดือนปัจจุบัน

  const rangeText = (y: number, sm: number, em: number) => { const r = fiscalRangeFor(y, sm, em); return `${thaiMonth(r.from)} – ${thaiMonth(r.to)} · ${periodMonths(sm, em)} เดือน`; };
  const topicText = (d: { topics?: TopicPeriods }) => TOPICS.filter(t => d.topics?.[t.key as Topic]).map(t => { const o = d.topics![t.key as Topic]!; return `${topicLabelOf(draft, t.key as Topic)}: ${MONTH_NAMES[o.startMonth - 1]} – ${MONTH_NAMES[o.endMonth - 1]}`; });
  const monthOpts = MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>);

  const openAdd = () => { setErr(""); setForm({ mode: "add", old: 0, fy: nextYear > 1 ? String(nextYear) : "", s: FY_START_MONTH, e: FY_END_MONTH, t: {} }); };
  const openEdit = (d: (typeof knownYears)[number]) => { setErr(""); setForm({ mode: "edit", old: d.fy, fy: String(d.fy), s: d.startMonth, e: d.endMonth, t: d.topics ?? {} }); };
  const setT = (key: Topic, v: { startMonth: number; endMonth: number } | null) => setForm(f => { if (!f) return f; const t = { ...f.t }; if (v) t[key] = v; else delete t[key]; return { ...f, t }; });

  function submit() {
    if (!form) return;
    const y = Number(form.fy);
    if (!Number.isInteger(y) || y < 2500 || y > 2700) return setErr("กรอกปีงบประมาณเป็น พ.ศ. 4 หลัก เช่น 2571");
    if ((form.mode === "add" || y !== form.old) && knownYears.some(d => d.fy === y)) return setErr(`มีปีงบประมาณ ${y} อยู่ในรายการแล้ว · กด “แก้ไข” ที่ปีนั้นเพื่อเปลี่ยนช่วงเดือน`);
    const item = { fy: y, startMonth: form.s, endMonth: form.e, ...(Object.keys(form.t).length ? { topics: form.t } : {}) };
    if (form.mode === "add") setG(d => { d.fiscalYears = [...d.fiscalYears, item].sort((a, b) => b.fy - a.fy); });
    else {
      setG(d => {
        d.fiscalYears = d.fiscalYears.map(x => x.fy === form.old ? item : x).sort((a, b) => b.fy - a.fy);
        if (y !== form.old && d.byYear?.[String(form.old)]) { d.byYear[String(y)] = d.byYear[String(form.old)]; delete d.byYear[String(form.old)]; } // ย้ายการตั้งค่ารายปีตามปีที่เปลี่ยน
      });
      if (scope === String(form.old)) setScope(String(y));
    }
    setForm(null); setErr("");
  }

  const y = form ? Number(form.fy) : 0, validY = y >= 2500 && y <= 2700;
  return (
    <>
      <p className="fy-intro">กำหนดว่าแต่ละปีงบประมาณให้อำเภอรายงานตั้งแต่เดือนไหนถึงเดือนไหน · ปีที่ไม่ได้เพิ่มไว้ในรายการ ระบบใช้ช่วงเริ่มต้น <b>{MONTH_NAMES[FY_START_MONTH - 1]} – {MONTH_NAMES[FY_END_MONTH - 1]}</b></p>

      <div className="fy-head">
        <h3 className="cf-h3">ปีงบประมาณที่ตั้งไว้ ({knownYears.length})</h3>
        {!form && <button type="button" className="ux-btn" onClick={openAdd}>{I.plus}เพิ่มปีงบประมาณ</button>}
      </div>

      {form && (
        <section className="fy-form" aria-label={form.mode === "add" ? "เพิ่มปีงบประมาณ" : `แก้ไขปีงบประมาณ ${form.old}`}>
          <h3>{form.mode === "add" ? "เพิ่มปีงบประมาณ" : `แก้ไขปีงบประมาณ ${form.old}`}</h3>
          <div className="fy-grid">
            <div><label className="ux-lbl" htmlFor="fy-y">ปีงบประมาณ (พ.ศ.)</label>
              <div className="ux-num-in"><input id="fy-y" type="number" inputMode="numeric" placeholder="เช่น 2571" value={form.fy} autoFocus onChange={e => setForm({ ...form, fy: e.target.value })} onKeyDown={e => e.key === "Enter" && submit()} /></div></div>
            <div><label className="ux-lbl" htmlFor="fy-s">เดือนเริ่มรายงาน</label>
              <select id="fy-s" className="ux-select" value={form.s} onChange={e => setForm({ ...form, s: Number(e.target.value) })}>{monthOpts}</select></div>
            <div><label className="ux-lbl" htmlFor="fy-e">เดือนสิ้นสุด</label>
              <select id="fy-e" className="ux-select" value={form.e} onChange={e => setForm({ ...form, e: Number(e.target.value) })}>{monthOpts}</select></div>
          </div>
          {validY && <p className="fy-preview">ปีงบประมาณ {y} รายงานช่วง <b>{rangeText(y, form.s, form.e)}</b></p>}

          <details className="fy-adv" open={Object.keys(form.t).length > 0}>
            <summary>ตั้งช่วงเดือนแยกตามหัวข้อ <span>(ไม่บังคับ · ใช้เมื่อบางหัวข้อรายงานไม่ตรงกับช่วงรวม)</span></summary>
            <div className="fy-topics">
              {TOPICS.map(t => { const k = t.key as Topic, o = form.t[k], name = topicLabelOf(draft, k); return (
                <div key={k} className="fy-topic">
                  <span className="fy-topic-n">{name}</span>
                  <select aria-label={`ช่วงเดือนของ ${name}`} className="ux-select" value={o ? "custom" : "same"} onChange={e => setT(k, e.target.value === "custom" ? { startMonth: form.s, endMonth: form.e } : null)}>
                    <option value="same">ใช้ช่วงรวมของปี</option><option value="custom">กำหนดช่วงเอง</option>
                  </select>
                  {o && <div className="fy-topic-m">
                    <select aria-label={`เดือนเริ่มของ ${name}`} className="ux-select" value={o.startMonth} onChange={e => setT(k, { ...o, startMonth: Number(e.target.value) })}>{monthOpts}</select>
                    <span>ถึง</span>
                    <select aria-label={`เดือนสิ้นสุดของ ${name}`} className="ux-select" value={o.endMonth} onChange={e => setT(k, { ...o, endMonth: Number(e.target.value) })}>{monthOpts}</select>
                  </div>}
                </div>); })}
            </div>
          </details>

          {err && <p className="ux-toast bad" role="alert">{err}</p>}
          <div className="fy-form-act">
            <button type="button" className="ux-btn" onClick={submit}>{form.mode === "add" ? "เพิ่มปีงบประมาณ" : "ตกลง"}</button>
            <button type="button" className="ux-btn line" onClick={() => { setForm(null); setErr(""); }}>ยกเลิก</button>
          </div>
        </section>
      )}

      {knownYears.length === 0 ? (
        <div className="fy-empty">
          <b>ยังไม่ได้เพิ่มปีงบประมาณ</b>
          <span>ทุกปีใช้ช่วงเริ่มต้น {MONTH_NAMES[FY_START_MONTH - 1]} – {MONTH_NAMES[FY_END_MONTH - 1]} อยู่แล้ว เพิ่มเฉพาะปีที่ต้องการช่วงเดือนต่างออกไป</span>
        </div>
      ) : (
        <ul className="fy-list">
          {knownYears.map(d => (
            <li key={d.fy} className={`fy-row${form?.mode === "edit" && form.old === d.fy ? " on" : ""}`}>
              <div className="fy-main"><b>ปีงบประมาณ {d.fy}</b>{d.fy === curFy && <span className="fy-badge">ปีปัจจุบัน</span>}</div>
              <div className="fy-range">{rangeText(d.fy, d.startMonth, d.endMonth)}</div>
              <div className="fy-extra">{topicText(d).join(" · ") || "ทุกหัวข้อใช้ช่วงเดียวกัน"}</div>
              <div className="fy-act">
                <button type="button" className="ux-btn line sm" onClick={() => openEdit(d)}>แก้ไข</button>
                <button type="button" className="fy-del" aria-label={`ลบปีงบประมาณ ${d.fy}`} onClick={async () => { if (await confirm(`ลบปีงบประมาณ ${d.fy} ออกจากรายการ?\n(ข้อมูลที่รายงานไว้ยังอยู่ในฐานข้อมูล · ช่วงเดือนของปีนี้จะกลับเป็นค่าเริ่มต้น ${MONTH_NAMES[FY_START_MONTH - 1]} – ${MONTH_NAMES[FY_END_MONTH - 1]})`)) setG(x => { x.fiscalYears = x.fiscalYears.filter(z => z.fy !== d.fy); }); }}>ลบ</button>
              </div>
            </li>))}
        </ul>)}
    </>
  );
}
