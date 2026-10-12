"use client";
import { useEffect, useRef, useState } from "react";
import { currentMonth, thaiMonth } from "@/lib/data";

const SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// ตัวเลือกเดือน/ปี (แสดง พ.ศ.) — value/onChange ใช้รูปแบบ "YYYY-MM" (ค.ศ.) เหมือน <input type="month">
export default function MonthPicker({ id, value, onChange, clearable }: { id?: string; value: string; onChange: (v: string) => void; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)) || 0);
  const [cur, setCur] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const toggle = () => {
    if (!open) {
      const current = currentMonth();
      setCur(current);
      setYear(Number((value || current).slice(0, 4)));
    }
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const [vy, vm] = value ? value.split("-").map(Number) : [0, 0];
  const [cy, cm] = cur ? cur.split("-").map(Number) : [0, 0];
  const pick = (m: number) => { onChange(`${year}-${String(m).padStart(2, "0")}`); setOpen(false); };

  return (
    <div className="mp" ref={ref}>
      <button id={id} type="button" className={`mp-btn${open ? " open" : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <span>{value ? thaiMonth(value) : "เลือกเดือน/ปี"}</span><small aria-hidden="true">▼</small>
      </button>
      {open && (
        <div className="mp-pop" role="dialog" aria-label="เลือกเดือนและปี">
          <div className="mp-year">
            <button type="button" aria-label="ปีก่อนหน้า" onClick={() => setYear(year - 1)}>‹</button>
            <b>พ.ศ. {year + 543} <small>({year})</small></b>
            <button type="button" aria-label="ปีถัดไป" onClick={() => setYear(year + 1)}>›</button>
          </div>
          <div className="mp-grid">{SHORT.map((s, i) => {
            const m = i + 1, sel = vy === year && vm === m, now = cy === year && cm === m;
            return <button type="button" key={s} aria-pressed={sel} className={sel ? "sel" : now ? "now" : ""} onClick={() => pick(m)}>{s}</button>;
          })}</div>
          <div className="mp-foot">
            {clearable ? <button type="button" onClick={() => { onChange(""); setOpen(false); }}>ล้างค่า</button> : <span />}
            <button type="button" className="today" onClick={() => {
              const current = currentMonth();
              setCur(current); setYear(Number(current.slice(0, 4))); onChange(current); setOpen(false);
            }}>เดือนนี้</button>
          </div>
        </div>)}
    </div>);
}
