"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ic = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !pass) return setError("กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ");
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: user, password: pass }) });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
      if (data.role === "province") { localStorage.removeItem("district"); return router.push("/province"); }
      localStorage.setItem("district", data.district); // อำเภอมาจากบัญชีผู้ใช้
      router.push("/district");
    } catch { setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }

  return (
    <div className="lgx">
      <section className="lgx-art">
        <div className="lgx-logo">
          <i><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22V9" /><path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5z" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /><path d="M12 17c0-3 2-5 5-5 0 3-2 5-5 5z" /></svg></i>
          <div><b>สำนักงานเกษตรจังหวัดศรีสะเกษ</b><small>AGRI-TRACK</small></div>
        </div>
        <div>
          <h1>รายงานผลการดำเนินงานระดับอำเภอ</h1>
          <p>กรอกปริมาณปุ๋ยอินทรีย์ วัสดุอินทรีย์ และพื้นที่ไถกลบฟางข้าวได้ง่าย ๆ ในที่เดียว</p>
        </div>
        <ul className="lgx-feat">
          <li><i><svg {...ic}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /></svg></i><div><b>เจ้าหน้าที่อำเภอ</b><span>กรอกรายงานรายเดือน ดูว่าต้องกรอกช่องไหนต่อ และติดตามผลงานของอำเภอ</span></div></li>
          <li><i><svg {...ic}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg></i><div><b>เจ้าหน้าที่จังหวัด</b><span>ดูภาพรวมทั้ง 22 อำเภอ ตั้งค่ารอบรายงาน และดาวน์โหลดเป็น Excel</span></div></li>
        </ul>
      </section>

      <section className="lgx-form">
        <form className="lgx-card" onSubmit={submit} noValidate>
          <h2>เข้าสู่ระบบ</h2>
          <p>ใช้ชื่อผู้ใช้และรหัสผ่านที่สำนักงานเกษตรจังหวัดมอบให้</p>
          <div className="lgx-f"><label htmlFor="u">ชื่อผู้ใช้</label>
            <div className="lgx-in"><svg {...ic}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
              <input id="u" type="text" value={user} onChange={e => setUser(e.target.value)} autoComplete="username" placeholder="เช่น ชื่ออำเภอหรือ province" /></div></div>
          <div className="lgx-f"><label htmlFor="p">รหัสผ่าน</label>
            <div className="lgx-in"><svg {...ic}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              <input id="p" type={show ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" />
              <button type="button" className="lgx-eye" aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} onClick={() => setShow(!show)}>
                <svg {...ic}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{show && <path d="M3 3l18 18" />}</svg></button></div></div>
          {error && <p className="lgx-err" role="alert">{error}</p>}
          <button className="ux-btn block" disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
          <p className="lgx-help">ลืมรหัสผ่าน หรือยังไม่มีบัญชี? ติดต่อสำนักงานเกษตรจังหวัดศรีสะเกษ</p>
        </form>
      </section>
    </div>
  );
}
