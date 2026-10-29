"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// หน้าแสดงเมื่อเกิดข้อผิดพลาดที่ไม่ได้ดักไว้ — รายงานเข้า Sentry (ถ้าตั้งค่าไว้) แล้วให้ผู้ใช้ลองใหม่ได้
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); }, [error]);
  return (
    <html lang="th"><body style={{ fontFamily: "sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f4f6ee" }}>
      <div style={{ maxWidth: 440, padding: "2rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.4rem" }}>ระบบขัดข้องชั่วคราว</h1>
        <p>ขออภัยในความไม่สะดวก ระบบบันทึกปัญหานี้ไว้แล้ว กรุณาลองใหม่อีกครั้ง{error.digest ? ` (รหัสอ้างอิง ${error.digest})` : ""}</p>
        <button onClick={reset} style={{ padding: ".7rem 1.4rem", borderRadius: 10, border: 0, background: "#1f4d2e", color: "#fff", fontSize: "1rem", cursor: "pointer" }}>ลองใหม่</button>
      </div>
    </body></html>);
}
