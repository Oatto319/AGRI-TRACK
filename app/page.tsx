"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISTRICTS } from "@/lib/data";

export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [district, setDistrict] = useState(DISTRICTS[0].name);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !pass) return setError("กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ");
    // TODO: เรียก API จริง ตัวอย่าง: ชื่อขึ้นต้น "prov" = จังหวัด
    if (user.startsWith("prov")) return router.push("/province");
    localStorage.setItem("district", district);
    router.push("/district");
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
        <div className="field"><label htmlFor="d">อำเภอ (สำหรับเจ้าหน้าที่อำเภอ)</label>
          <select id="d" value={district} onChange={e => setDistrict(e.target.value)}>{DISTRICTS.map(d => <option key={d.name}>{d.name}</option>)}</select></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" style={{ width: "100%" }}>เข้าสู่ระบบ</button>
        <p className="hint"><a href="#">ลืมรหัสผ่าน</a></p>
        <p className="hint">ตัวอย่าง: ชื่อผู้ใช้ขึ้นต้นด้วย prov เข้าหน้าจังหวัด ชื่ออื่นเข้าหน้าอำเภอที่เลือก (ยังไม่ใช่ระบบล็อกอินจริง)</p>
      </form>
    </div>
  );
}
