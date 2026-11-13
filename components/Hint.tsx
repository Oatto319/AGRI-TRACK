"use client";
import { useId, useState, type ReactNode } from "react";

/** คำอธิบายสั้น ๆ สำหรับศัพท์ที่คนทั่วไปอาจไม่คุ้น: กดปุ่ม ? เพื่อเปิด/ปิด (ใช้ได้ทั้งเมาส์ คีย์บอร์ด และจอสัมผัส) */
export default function Hint({ term, children, light }: { term: string; children: ReactNode; light?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={`qh${light ? " light" : ""}`}>
      <button type="button" className="qh-b" aria-expanded={open} aria-controls={id} aria-label={`คำอธิบาย: ${term}`} onClick={() => setOpen(o => !o)} onKeyDown={e => e.key === "Escape" && setOpen(false)}>?</button>
      {open && <span id={id} role="note" className="qh-t"><b>{term}</b> {children}</span>}
    </span>);
}
