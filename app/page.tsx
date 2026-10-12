"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
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
    <div className="lg">
      <section className="art weave">
        <h1>รายงานผลการดำเนินงานระดับอำเภอ</h1>
        <p>อำเภอกรอกปริมาณการผลิตปุ๋ยอินทรีย์และวัสดุอินทรีย์รายเดือน จังหวัดสรุปและดาวน์โหลดเป็น Excel จังหวัดศรีสะเกษ</p>
      </section>
      <form onSubmit={submit} noValidate>
        <h2 style={{ marginBottom: "1.25rem" }}>เข้าสู่ระบบ</h2>
        <div className="field"><label htmlFor="u">ชื่อผู้ใช้</label>
          <input id="u" type="text" value={user} onChange={e => setUser(e.target.value)} autoComplete="username" /></div>
        <div className="field"><label htmlFor="p">รหัสผ่าน</label>
          <input id="p" type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password" /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}</button>
        <p className="hint"><a href="#">ลืมรหัสผ่าน</a></p>
      </form>
    </div>
  );
}
