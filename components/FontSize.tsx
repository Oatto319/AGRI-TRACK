"use client";
import { useEffect, useState } from "react";

// ปุ่มปรับขนาดตัวอักษร A− A+ สำหรับผู้สูงวัย — เก็บระดับไว้ในเครื่อง (localStorage) และตั้งเป็น data-fs บน <html>
// ระดับ 0–3 = 100% · 112.5% (ค่าเริ่มต้น) · 125% · 150% ของขนาดตัวอักษรพื้นฐาน (ดู ux.css ส่วน "ขนาดตัวอักษร")
const KEY = "agri-fs", MIN = 0, MAX = 3, DEF = 1;
const NAMES = ["เล็ก", "ปกติ", "ใหญ่", "ใหญ่มาก"];
const read = () => { try { const v = Number(localStorage.getItem(KEY)); return Number.isInteger(v) && v >= MIN && v <= MAX ? v : DEF; } catch { return DEF; } };

export default function FontSize({ light }: { light?: boolean }) {
  const [lv, setLv] = useState(DEF);
  useEffect(() => { const v = read(); document.documentElement.dataset.fs = String(v); queueMicrotask(() => setLv(v)); }, []);
  const set = (v: number) => {
    const n = Math.max(MIN, Math.min(MAX, v));
    setLv(n); document.documentElement.dataset.fs = String(n);
    try { localStorage.setItem(KEY, String(n)); } catch { /* ใช้ต่อได้แม้เก็บค่าไม่ได้ */ }
  };
  return (
    <div className={`fsz${light ? " light" : ""}`} role="group" aria-label="ขนาดตัวอักษร">
      <button type="button" className="fsz-s" aria-label="ลดขนาดตัวอักษร" disabled={lv <= MIN} onClick={() => set(lv - 1)}>A<span aria-hidden="true">−</span></button>
      <span className="sr-only" role="status">ขนาดตัวอักษร{NAMES[lv]}</span>
      <button type="button" className="fsz-l" aria-label="เพิ่มขนาดตัวอักษร" disabled={lv >= MAX} onClick={() => set(lv + 1)}>A<span aria-hidden="true">+</span></button>
    </div>);
}
