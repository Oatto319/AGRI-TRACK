"use client";
import { startTransition, useEffect, useState } from "react";
import { AREA_TARGET_PCT, DISTRICTS, MAX_ROUNDS, currentMonth, dueDateOf, thaiDate, thaiMonth, type Settings } from "@/lib/data";
import { useProvince } from "@/components/Province";
import { I, PageHead, Step } from "@/components/Entry";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const even = (k: number) => Array.from({ length: k }, (_, i) => String(Math.round((31 / k) * (i + 1))));

export default function ProvinceSettings() {
  const [q, setQ] = useState("");
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

  const shown = DISTRICTS.filter(d => d.name.includes(q.trim()));
  const setCount = DISTRICTS.filter(d => num(d.name) > 0).length;
  const dayOk = days.every(d => d !== "" && Number(d) >= 1 && Number(d) <= 31);

  return (
    <div style={{ maxWidth: 980 }}>
      <PageHead title="ตั้งค่าการรายงาน" sub="ตั้งค่า 2 อย่างที่ใช้กับทุกอำเภอ: (1) รอบและวันกำหนดส่งรายงาน (2) พื้นที่ปลูกพืชทั้งหมดของแต่ละอำเภอ — แต่ละส่วนมีปุ่มบันทึกของตัวเอง" />
      <div className="ux-stack">
        <Step n={1} title="รอบและวันกำหนดส่งรายงาน" hint="อำเภอต้องส่งรายงานกี่ครั้งต่อเดือน และต้องส่งภายในวันที่เท่าไร">
          <span className="ux-lbl" id="rc">จำนวนครั้งที่ต้องรายงานต่อเดือน</span>
          <div className="ux-rounds" role="group" aria-labelledby="rc">
            {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map(k => (
              <button key={k} type="button" aria-pressed={n === k} onClick={() => setDays(even(k))}><b>{k}</b>ครั้ง/เดือน</button>))}
          </div>
          <span className="ux-lbl" style={{ marginTop: "1.2rem" }}>วันที่ต้องส่งของแต่ละรอบ</span>
          <div style={{ display: "grid", gap: ".6rem" }}>
            {days.map((d, i) => (
              <div key={i} className="ux-due">
                <b>รอบที่ {i + 1}</b>
                <label htmlFor={`d${i}`}>ส่งภายในวันที่</label>
                <input id={`d${i}`} type="number" min={1} max={31} value={d} onChange={e => setDays(days.map((x, j) => (j === i ? e.target.value : x)))} />
                <span className="ux-hint" style={{ margin: 0 }}>{cur && <>ตัวอย่าง {thaiMonth(cur)}: ภายใน {d && Number(d) >= 1 && Number(d) <= 31 ? thaiDate(dueDateOf(cur, Number(d))) : "–"}</>}</span>
              </div>))}
          </div>
          <div className="ux-banner">{I.info}<div>วันที่ 31 = สิ้นสุดเดือน · วันที่ของแต่ละรอบต้องเรียงจากน้อยไปมาก · ส่งหลังวันกำหนดระบบจะแสดงว่า “ส่งช้า” (นับจากการส่งครั้งแรก) · แต่ละรอบกรอกเฉพาะปริมาณของรอบนั้น ระบบรวมเป็นยอดเดือนให้</div></div>
          {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="status">{msg.t}</p>}
          <div style={{ marginTop: "1rem" }}><button className="ux-btn" disabled={busy || !dayOk} onClick={save}>{I.save}บันทึกรอบและวันกำหนดส่ง</button></div>
        </Step>

        <Step n={2} title="พื้นที่ปลูกพืชทั้งหมดรายอำเภอ" hint={`ใช้คำนวณเป้าหมายร้อยละ ${AREA_TARGET_PCT} และร้อยละของพื้นที่สะสม · อำเภอไม่ต้องกรอก · เว้นว่าง = ยังไม่กำหนด`} done={setCount === DISTRICTS.length}>
          <div className="ux-kpis" style={{ marginBottom: ".9rem" }}>
            <div className="ux-kpi"><i>{I.box}</i><div><small>รวมทั้งจังหวัด</small><b>{f2(sumTotal)} <span>ไร่</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#b08a2c" }}><i>{I.check}</i><div><small>เป้าหมายร้อยละ {AREA_TARGET_PCT}</small><b>{f2((sumTotal * AREA_TARGET_PCT) / 100)} <span>ไร่</span></b></div></div>
            <div className="ux-kpi" style={{ ["--kc" as string]: "#059669" }}><i>{I.send}</i><div><small>กำหนดแล้ว</small><b>{setCount} / {DISTRICTS.length} <span>อำเภอ</span></b></div></div>
          </div>
          <input className="ux-search" type="search" placeholder="ค้นหาชื่ออำเภอ" aria-label="ค้นหาอำเภอ" value={q} onChange={e => setQ(e.target.value)} />
          <div className="ux-areas" style={{ marginTop: ".9rem" }}>
            {shown.map(d => (
              <div className="ux-areacell" key={d.name}>
                <label htmlFor={`a-${d.name}`}>{d.name}<small>เป้า {f2((num(d.name) * AREA_TARGET_PCT) / 100)} ไร่</small></label>
                <div className={`ux-num-in${totals[d.name] ? " filled" : ""}`}>
                  <input id={`a-${d.name}`} type="number" inputMode="decimal" min={0} step="any" placeholder="ยังไม่กำหนด" value={totals[d.name] ?? ""} onChange={e => setTotals({ ...totals, [d.name]: e.target.value })} /><span>ไร่</span>
                </div>
              </div>))}
            {!shown.length && <p className="ux-empty">ไม่พบอำเภอที่ค้นหา</p>}
          </div>
          <div className="ux-sticky-save">
            <span>{amsg ? <span className={`ux-toast${amsg.bad ? " bad" : ""}`} role="status">{amsg.t}</span> : <span className="ux-note">กรอกเสร็จแล้วกดบันทึก ระบบจะคำนวณ Dashboard และ Excel ใหม่ทันที</span>}</span>
            <button className="ux-btn" disabled={abusy} onClick={saveAreas}>{I.save}บันทึกพื้นที่ปลูกพืชทั้งหมด</button>
          </div>
        </Step>
      </div>
    </div>
  );
}
