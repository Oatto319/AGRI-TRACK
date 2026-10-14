"use client";
import type { ReactNode } from "react";
import { dueDateOf, thaiDate, thaiDateTime } from "@/lib/data";

export const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const ic = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
export const I = {
  info: <svg {...ic}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></svg>,
  check: <svg {...ic}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>,
  alert: <svg {...ic}><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18h.01" /></svg>,
  plus: <svg {...ic}><path d="M12 5v14M5 12h14" /></svg>,
  leaf: <svg {...ic}><path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15" /><path d="M5 19c3-5 6-8 10-10" /></svg>,
  sprout: <svg {...ic}><path d="M12 21V11" /><path d="M12 11c0-4 3-6 7-6 0 4-3 6-7 6z" /><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z" /></svg>,
  box: <svg {...ic}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></svg>,
  user: <svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  send: <svg {...ic}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>,
  save: <svg {...ic}><path d="M5 3h11l4 4v14H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></svg>,
};

export function PageHead({ title, sub, chips, children }: { title: string; sub?: ReactNode; chips?: { label: string; value: string }[]; children?: ReactNode }) {
  return (
    <div className="ux-ph">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
        {chips && <div className="ux-chips">{chips.map(c => <span key={c.label} className="ux-chip">{c.label} <b>{c.value}</b></span>)}</div>}
      </div>
      {children}
    </div>);
}

/** กล่องขั้นตอนที่มีหมายเลข — บอกชัดว่าต้องทำอะไรเป็นลำดับ */
export function Step({ n, title, hint, done, children }: { n: number; title: string; hint?: string; done?: boolean; children: ReactNode }) {
  return (
    <section className={`ux-step${done ? " done" : ""}`}>
      <header><span className="ux-num">{done ? "✓" : n}</span><div><h2>{title}</h2>{hint && <p>{hint}</p>}</div></header>
      <div>{children}</div>
    </section>);
}

export function NumField({ id, label, unit, value, onChange, disabled, hint }: { id: string; label: string; unit: string; value: string; onChange: (v: string) => void; disabled?: boolean; hint?: string }) {
  return (
    <div>
      <label className="ux-lbl" htmlFor={id}>{label}</label>
      <div className={`ux-num-in${value !== "" ? " filled" : ""}`}>
        <input id={id} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={value} disabled={disabled} onChange={e => onChange(e.target.value)} />
        <span>{unit}</span>
      </div>
      {hint && <p className="ux-hint">{hint}</p>}
    </div>);
}

export function ReadField({ id, label, value, unit }: { id: string; label: string; value: string; unit: string }) {
  return (
    <div>
      <label className="ux-lbl" htmlFor={id}>{label}</label>
      <div className="ux-num-in ux-ro"><input id={id} type="text" readOnly tabIndex={-1} value={value} /><span>{unit}</span></div>
    </div>);
}

export function TextField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="ux-lbl" htmlFor={id}>{label}</label>
      <div className="ux-text-in"><input id={id} type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></div>
    </div>);
}

/** เลือกรอบที่รายงาน (แสดงเมื่อมีมากกว่า 1 รอบ/เดือน) */
export function RoundTabs({ dueDays, month, rd, done, onPick }: { dueDays: number[]; month: string; rd: number; done: (round: number) => boolean; onPick: (r: number) => void }) {
  if (dueDays.length < 2 || !month) return null;
  return (
    <div style={{ marginTop: "1rem" }}>
      <span className="ux-lbl" id="rl">รอบที่จะรายงาน</span>
      <div className="ux-tabs" role="group" aria-labelledby="rl">{dueDays.map((d, i) => (
        <button key={i} type="button" className="ux-tab" aria-pressed={rd === i + 1} onClick={() => onPick(i + 1)}>
          <b>รอบที่ {i + 1} {done(i + 1) && <span className="ok">✓ ส่งแล้ว</span>}</b><small>ส่งภายใน {thaiDate(dueDateOf(month, d))}</small>
        </button>))}</div>
    </div>);
}

/** ข้อความสถานะ: ส่งแล้ว / กำหนดส่ง / เลยกำหนด */
export function DueBanner({ rec, due, overdue, noun }: { rec?: { status: string; submittedAt?: string; dueDate?: string; late?: boolean }; due: string; overdue: boolean; noun: string }) {
  if (rec?.status === "submitted") return (
    <div className={`ux-banner ${rec.late ? "warn" : "ok"}`} role="status">{rec.late ? I.alert : I.check}
      <div>{rec.submittedAt ? `ส่ง${noun}แล้วเมื่อ ${thaiDateTime(rec.submittedAt)}` : `ส่ง${noun}แล้ว`}{rec.dueDate && ` · กำหนดส่ง ${thaiDate(rec.dueDate)}`} · <b>{rec.late ? "ส่งช้า" : "ส่งตรงเวลา"}</b>
        <br />ต้องการแก้ไข? ปรับตัวเลขแล้วกด “ส่งซ้ำ” ได้เลย</div></div>);
  if (!due) return null;
  return (
    <div className={`ux-banner ${overdue ? "bad" : ""}`} role="status">{overdue ? I.alert : I.info}
      <div>กำหนดส่งภายใน <b>{thaiDate(due)}</b>{overdue ? " · เลยกำหนดแล้ว ถ้าส่งตอนนี้ระบบจะบันทึกว่า “ส่งช้า”" : ""}</div></div>);
}

export function StatusPill({ status, late }: { status?: string; late?: boolean }) {
  if (status === "submitted") return <span className={`ux-pill ${late ? "bad" : "ok"}`}>{late ? "ส่งช้า" : "ส่งแล้ว"}</span>;
  if (status === "draft") return <span className="ux-pill warn">ร่าง</span>;
  return <span className="ux-pill mute">ยังไม่ได้กรอก</span>;
}
