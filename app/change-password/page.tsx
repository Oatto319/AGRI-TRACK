"use client";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// เปลี่ยนรหัสผ่านของตัวเอง · บัญชีที่เพิ่งสร้าง/ถูกรีเซ็ตต้องเปลี่ยนก่อนจึงใช้งานส่วนอื่นได้
export default function ChangePassword() {
  const router = useRouter();
  const [me, setMe] = useState<{ role: string; mustChange: boolean; username: string } | null>(null);
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  useEffect(() => {
    fetch("/api/me").then(r => (r.ok ? r.json() : null)).then(d => { if (d) startTransition(() => setMe(d)); else router.replace("/"); }).catch(() => router.replace("/"));
  }, [router]);
  const home = me?.role === "province" ? "/province" : "/district";

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (f.next !== f.again) return setError("รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      const r = await fetch("/api/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.current, next: f.next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      router.replace(home);
    } catch { setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }
  const type = show ? "text" : "password";
  return (
    <div className="lgx" style={{ gridTemplateColumns: "1fr" }}>
      <section className="lgx-form">
        <form className="lgx-card" onSubmit={submit} noValidate>
          <h2>{me?.mustChange ? "ตั้งรหัสผ่านใหม่ก่อนใช้งาน" : "เปลี่ยนรหัสผ่าน"}</h2>
          <p>{me?.mustChange ? "บัญชีนี้ใช้รหัสผ่านชั่วคราว กรุณาตั้งรหัสผ่านของตัวเองก่อนเริ่มใช้งาน" : `บัญชี ${me?.username ?? ""}`}</p>
          <div className="lgx-f"><label htmlFor="c">รหัสผ่านปัจจุบัน</label><div className="lgx-in"><input id="c" type={type} value={f.current} onChange={e => setF({ ...f, current: e.target.value })} autoComplete="current-password" /></div></div>
          <div className="lgx-f"><label htmlFor="n">รหัสผ่านใหม่</label><div className="lgx-in"><input id="n" type={type} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} autoComplete="new-password" /></div>
            <small className="ux-note">อย่างน้อย 8 ตัว มีทั้งตัวอักษรอังกฤษและตัวเลข</small></div>
          <div className="lgx-f"><label htmlFor="a">พิมพ์รหัสผ่านใหม่อีกครั้ง</label><div className="lgx-in"><input id="a" type={type} value={f.again} onChange={e => setF({ ...f, again: e.target.value })} autoComplete="new-password" /></div></div>
          <label style={{ display: "flex", gap: ".5rem", alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> แสดงรหัสผ่าน</label>
          {error && <p className="lgx-err" role="alert">{error}</p>}
          <button className="ux-btn block" disabled={busy || !f.current || !f.next}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
          {me && !me.mustChange && <p className="lgx-help"><a href={home}>ยกเลิก กลับหน้าหลัก</a></p>}
        </form>
      </section>
    </div>);
}
