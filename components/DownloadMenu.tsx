"use client";
import { useEffect, useRef, useState } from "react";

/** เมนู "ดาวน์โหลด" เมนูเดียว: Excel (ช่วงเดือนที่เลือก) และ PDF (สรุปเปรียบเทียบ 3 ปีงบประมาณ) */
export default function DownloadMenu({ from, to, fy, className = "ux-btn gold", excel = true, pdf: withPdf = true }: { from: string; to: string; fy: number; className?: string; excel?: boolean; pdf?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { // ปิดเมนูเมื่อกดนอกเมนูหรือกด Esc
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const pdf = async () => {
    setBusy(true); setErr(null); setOpen(false);
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
    <div className="ux-dl" ref={box}>
      <button type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-busy={busy} disabled={busy} onClick={() => setOpen(o => !o)}>
        {busy ? "กำลังสร้าง PDF…" : "ดาวน์โหลด"}<span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="ux-dl-menu" role="menu">
          {excel && <a role="menuitem" href={`/api/export?from=${from}&to=${to}`} download onClick={() => setOpen(false)}>
            <b>ไฟล์ Excel</b><small>ตารางทุกหัวข้อ ตามช่วงเดือนที่เลือก</small>
          </a>}
          {withPdf && <button type="button" role="menuitem" onClick={pdf}>
            <b>ไฟล์ PDF</b><small>สรุปเปรียบเทียบย้อนหลัง 3 ปีงบประมาณ</small>
          </button>}
        </div>)}
      {err && <span role="alert" className="ux-dl-err">{err}</span>}
    </div>);
}
