import type { CSSProperties } from "react";

/** กรอบเทาเลื่อนไหวระหว่างโหลดข้อมูล (แทนข้อความ "กำลังโหลด…") — ผู้ใช้ที่ปิดแอนิเมชันในเครื่องจะเห็นกรอบนิ่ง */
export const Sk = ({ w, h, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) =>
  <span className="sk" aria-hidden="true" style={{ width: w, height: h, borderRadius: r, ...style }} />;

/** variant: "page" = แถวตัวเลข + การ์ด · "card" = การ์ดเดียว · "list" = รายการ */
export default function Skeleton({ variant = "page", rows = 4 }: { variant?: "page" | "card" | "list"; rows?: number }) {
  const card = (n: number, key?: number) => (
    <div className="sk-card" key={key}>
      <Sk w="38%" h={18} />
      {Array.from({ length: n }, (_, i) => <Sk key={i} h={14} w={`${92 - ((i * 13) % 40)}%`} />)}
    </div>);
  return (
    <div className="sk-wrap" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลดข้อมูล</span>
      {variant === "page" && <>
        <div className="sk-kpis">{[0, 1, 2, 3].map(i => <div className="sk-card" key={i}><Sk w="55%" h={14} /><Sk w="70%" h={32} /><Sk w="40%" h={12} /></div>)}</div>
        {card(rows)}
      </>}
      {variant === "card" && card(rows)}
      {variant === "list" && <div className="sk-card">{Array.from({ length: rows }, (_, i) => <div className="sk-row" key={i}><Sk w={36} h={36} r={99} /><div><Sk w="45%" h={14} /><Sk w="70%" h={12} /></div></div>)}</div>}
    </div>);
}
