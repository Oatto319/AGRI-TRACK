"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// แบนเนอร์เตือนการเก็บข้อมูล 5 ปี (ใส่ใน layout ของจังหวัดและอำเภอ)
// จังหวัด: เตือนล่วงหน้า (เหลือง) · เมื่อถึงกำหนดและยังไม่ export ระบบพาไปหน้า "สำรองข้อมูล" และใช้หน้าอื่นไม่ได้จนกว่าจะ export
// อำเภอ: เมื่อระบบถูกล็อกจะเห็นข้อความว่ารอจังหวัดสำรองข้อมูล (API ปฏิเสธการบันทึกด้วย 423 อยู่แล้ว แบนเนอร์เป็นเพียงคำอธิบาย)
export const RETENTION_REFRESH = "agri-retention-refresh";
export const ARCHIVE_PATH = "/province/archive";
interface S { level: "ok" | "warn" | "locked"; message: string }

export default function RetentionBanner({ role }: { role: "province" | "district" }) {
  const path = usePathname(), router = useRouter();
  const [s, setS] = useState<S | null>(null);
  const load = useCallback(() => {
    fetch("/api/archive").then(r => (r.ok ? r.json() : null)).then((d: S | null) => setS(d && typeof d.level === "string" ? { level: d.level, message: d.message ?? "" } : null)).catch(() => setS(null));
  }, []);
  useEffect(() => { load(); }, [load, path]);
  useEffect(() => { window.addEventListener(RETENTION_REFRESH, load); return () => window.removeEventListener(RETENTION_REFRESH, load); }, [load]);
  const locked = s?.level === "locked", onArchive = path === ARCHIVE_PATH;
  useEffect(() => { if (role === "province" && locked && !onArchive) router.replace(ARCHIVE_PATH); }, [role, locked, onArchive, router]);

  if (!s || s.level === "ok" || (role === "district" && !locked)) return null;
  return (
    <p className={`ux-toast${locked ? " bad" : ""}`} role={locked ? "alert" : "status"} style={{ marginBottom: ".9rem" }}>
      {locked ? "🔒 " : "⏰ "}{s.message}
      {role === "province" && !onArchive && <> <Link href={ARCHIVE_PATH}><b>ไปที่หน้าสำรองข้อมูล</b></Link></>}
    </p>
  );
}
