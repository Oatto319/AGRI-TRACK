"use client";
import { startTransition, useEffect, useState } from "react";
import { AREA_TARGET_PCT, DISTRICTS, MAX_ROUNDS, currentMonth, dueDateOf, thaiDate, thaiMonth, type Settings } from "@/lib/data";
import { useProvince } from "@/components/Province";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const even = (k: number) => Array.from({ length: k }, (_, i) => String(Math.round((31 / k) * (i + 1))));

export default function ProvinceSettings() {
  const { settings, setSettings } = useProvince();
  const [days, setDays] = useState<string[]>(settings.dueDays.map(String));
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Record<string, string>>({});
  const [amsg, setAmsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [abusy, setAbusy] = useState(false);
  const [cur, setCur] = useState(""); // อ่านเดือนปัจจุบันหลัง mount เท่านั้น (ห้ามเรียก new Date() ตอน render)
  useEffect(() => { startTransition(() => setCur(currentMonth())); }, []);
  useEffect(() => {
    startTransition(() => {
      setDays(settings.dueDays.map(String));
      setTotals(Object.fromEntries(DISTRICTS.map(d => [d.name, settings.areaTotals[d.name] ? String(settings.areaTotals[d.name]) : ""])));
    });
  }, [settings]);
  const n = days.length;

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDays: days.map(Number) }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        setMsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return;
      }
      setSettings(data as Settings);
      setMsg({ t: "บันทึกการตั้งค่าแล้ว มีผลกับการส่งรายงานครั้งต่อไป (รายงานที่ส่งไปแล้วคงสถานะเดิม)" });
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setBusy(false);
    }
  }

  const num = (name: string) => Number(totals[name]) || 0;
  const sumTotal = DISTRICTS.reduce((a, d) => a + num(d.name), 0);

  async function saveAreas() {
    setAbusy(true); setAmsg(null);
    const areaTotals: Record<string, number> = {};
    for (const d of DISTRICTS) {
      const t = totals[d.name] ?? "";
      if (t === "") continue;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) { setAmsg({ t: `พื้นที่ของอำเภอ${d.name}ต้องเป็นตัวเลขที่ไม่ติดลบ`, bad: true }); setAbusy(false); return; }
      areaTotals[d.name] = n;
    }
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ areaTotals }) });
      const data: unknown = await res.json();
      if (!res.ok) {
        setAmsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return;
      }
      setSettings(data as Settings);
      setAmsg({ t: "บันทึกพื้นที่ปลูกพืชทั้งหมดแล้ว Dashboard และไฟล์ Excel จะคำนวณเป้าหมายและร้อยละใหม่ทันที" });
    } catch {
      setAmsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setAbusy(false);
    }
  }

  return (
    <div className="db" style={{ maxWidth: 820 }}>
      <div className="db-head"><div><h1>ตั้งค่าการรายงาน</h1>
        <p className="sub" style={{ margin: 0 }}>กำหนดจำนวนครั้งที่อำเภอต้องรายงานต่อเดือน วันกำหนดส่งของแต่ละรอบ และพื้นที่ปลูกพืชทั้งหมดของแต่ละอำเภอ</p></div></div>
      <section className="db-card">
        <h2>จำนวนครั้งที่ต้องรายงานต่อเดือน</h2>
        <div className="rseg" role="group" aria-label="จำนวนครั้งต่อเดือน" style={{ margin: ".5rem 0 1.2rem" }}>
          {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map(k => (
            <button key={k} type="button" aria-pressed={n === k} onClick={() => setDays(even(k))}>{k} ครั้ง/เดือน</button>))}
        </div>
        <h2>วันกำหนดส่งของแต่ละรอบ</h2>
        <div style={{ display: "grid", gap: ".7rem", margin: ".7rem 0" }}>
          {days.map((d, i) => (
            <div key={i} className="set-row">
              <b>รอบที่ {i + 1}</b>
              <label htmlFor={`d${i}`}>ส่งภายในวันที่</label>
              <input id={`d${i}`} type="number" min={1} max={31} value={d} style={{ width: 90 }} onChange={e => setDays(days.map((x, j) => (j === i ? e.target.value : x)))} />
              <span className="hint" style={{ margin: 0 }}>{cur && <>ตัวอย่าง {thaiMonth(cur)}: ภายใน {d && Number(d) >= 1 && Number(d) <= 31 ? thaiDate(dueDateOf(cur, Number(d))) : "–"}</>}</span>
            </div>))}
        </div>
        <p className="hint">วันที่ 31 หมายถึงสิ้นเดือน (เดือนที่สั้นกว่าจะใช้วันสุดท้ายของเดือน) · วันที่ของแต่ละรอบต้องเรียงจากน้อยไปมาก</p>
        <p className="hint">ถ้าอำเภอส่งหลังวันกำหนด (เวลาประเทศไทย) ระบบจะแสดงว่า &quot;ส่งช้า&quot; พร้อมวันและเวลาที่ส่ง โดยนับจากการส่งครั้งแรก · แต่ละรอบให้กรอกเฉพาะปริมาณของรอบนั้น ระบบรวมทุกรอบเป็นยอดของเดือน</p>
        {msg && <p className={`msg${msg.bad ? " bad" : ""}`} role="status">{msg.t}</p>}
        <div className="actions"><button className="btn go" disabled={busy} onClick={save}>บันทึกการตั้งค่า</button></div>
      </section>
      <section className="db-card" style={{ marginTop: "1rem" }}>
        <h2>พื้นที่ปลูกพืชทั้งหมดรายอำเภอ (จังหวัดเป็นผู้กำหนด)</h2>
        <p className="hint">อำเภอไม่ต้องกรอกค่านี้ · ระบบใช้คำนวณเป้าหมายร้อยละ {AREA_TARGET_PCT} ของพื้นที่ และร้อยละของพื้นที่สะสม · เว้นว่างไว้ = ยังไม่กำหนด</p>
        <div className="two" style={{ marginTop: ".8rem" }}>
          {DISTRICTS.map(d => (
            <div className="field" key={d.name}>
              <label htmlFor={`a-${d.name}`}>{d.name}</label>
              <div className="inp"><input id={`a-${d.name}`} type="number" inputMode="decimal" min={0} step="any" value={totals[d.name] ?? ""}
                onChange={e => setTotals({ ...totals, [d.name]: e.target.value })} /><span>ไร่</span></div>
              <p className="hint">เป้าหมายร้อยละ {AREA_TARGET_PCT} = {f2((num(d.name) * AREA_TARGET_PCT) / 100)} ไร่</p>
            </div>))}
        </div>
        <p className="hint"><b>รวมทั้งจังหวัด {f2(sumTotal)} ไร่</b> · เป้าหมายร้อยละ {AREA_TARGET_PCT} = {f2((sumTotal * AREA_TARGET_PCT) / 100)} ไร่</p>
        {amsg && <p className={`msg${amsg.bad ? " bad" : ""}`} role="status">{amsg.t}</p>}
        <div className="actions"><button className="btn go" disabled={abusy} onClick={saveAreas}>บันทึกพื้นที่ปลูกพืชทั้งหมด</button></div>
      </section>
    </div>
  );
}
