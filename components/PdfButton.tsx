"use client";
import { useState } from "react";

/** ปุ่มดาวน์โหลดรายงาน PDF (เปรียบเทียบย้อนหลัง 3 ปีงบประมาณ สิ้นสุดที่ปีงบประมาณ fy) */
export default function PdfButton({ fy, className, label = "ดาวน์โหลด PDF" }: { fy: number; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/export-pdf?fy=${fy}`);
      if (!r.ok) throw new Error();
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `agri-track-report-fy${fy}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setErr("สร้างไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่"); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={className} onClick={run} disabled={busy || !fy} aria-busy={busy}>{busy ? "กำลังสร้าง PDF…" : `📄 ${label}`}</button>
      {err && <span role="alert" style={{ color: "#be123c", fontSize: ".85rem", alignSelf: "center" }}>{err}</span>}
    </>);
}
