"use client";
import { startTransition, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, DISTRICTS, FIELDS, MAX_ROUNDS, TARGET_PER_TAMBON, bkkDate, currentMonth, dueDateOf, thaiDate, thaiDateTime, thaiMonth, type Report, type Reporter, type Settings } from "@/lib/data";
import { fmt, sumValues } from "@/lib/summary";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";

const toStr = (v: Report["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };

export default function DistrictReport() {
  const { district } = useDistrict();
  const info = DISTRICTS.find(d => d.name === district)!;
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(""); // วันที่ปัจจุบัน (เวลาไทย) อ่านหลัง mount เท่านั้น
  const [round, setRound] = useState(1);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [all, setAll] = useState<Report[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const rounds = settings.dueDays.length, rd = Math.min(round, rounds);
  const rec = all.find(x => x.month === month && x.round === rd);
  const status = rec?.status ?? "none";
  const due = month ? dueDateOf(month, settings.dueDays[rd - 1] ?? 31) : "";
  const overdue = !!due && !!today && today > due && status !== "submitted";

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("month"), r = Number(sp.get("round") ?? 1);
    startTransition(() => {
      setToday(bkkDate());
      setMonth(q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : currentMonth());
      setRound(Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS ? r : 1);
    });
  }, []);
  useEffect(() => {
    Promise.all([load<Report[]>(`/api/reports?district=${encodeURIComponent(district)}`), load<Settings>("/api/settings")])
      .then(([reports, st]) => { setAll(reports); setSettings(st); })
      .catch(() => setMsg({ t: "ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง", bad: true }));
  }, [district]);
  useEffect(() => {
    const last = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    startTransition(() => {
      setVals(rec ? toStr(rec.values) : {});
      setRep(rec?.reporter ?? last?.reporter ?? { name: "", position: "", phone: "" });
    });
  }, [rec, all]);

  const live = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
  async function save(s: "draft" | "submitted") {
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, round: rd, values: vals, reporter: rep, status: s }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error : "บันทึกไม่สำเร็จ";
        setMsg({ t: error, bad: true });
        return;
      }
      const saved = data as Report;
      setAll(p => [...p.filter(x => !(x.month === month && x.round === rd)), saved]);
      const where = `เดือน${thaiMonth(month)}${rounds > 1 ? ` รอบที่ ${rd}` : ""}`;
      if (s === "draft") setMsg({ t: "บันทึกร่างแล้ว" });
      else setMsg({ t: `ส่งรายงาน${where}แล้ว เมื่อ ${saved.submittedAt ? thaiDateTime(saved.submittedAt) : ""}${saved.late ? ` · ส่งช้า (กำหนดส่ง ${saved.dueDate ? thaiDate(saved.dueDate) : ""})` : " · ส่งตรงเวลา"}`, bad: !!saved.late });
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (<>
    <h1>กรอกรายงานรายเดือน</h1>
    <p className="sub">แบบสำรวจการส่งเสริมการผลิตและใช้ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · อำเภอ{district} · เกษตรตำบล {info.tambon} ราย · เป้าหมาย {fmt(info.tambon * TARGET_PER_TAMBON)} ตัน · ต้องรายงาน {rounds} ครั้ง/เดือน</p>
    <section className="sheet">
      <div className="field"><label htmlFor="m">เดือนที่รายงาน</label>
        <MonthPicker id="m" value={month} onChange={setMonth} />
        <p className="hint">{month ? thaiMonth(month) : "กำลังเตรียมเดือนรายงาน"} · สถานะ: {status === "submitted" ? "ส่งแล้ว (แก้ไขแล้วส่งซ้ำได้)" : status === "draft" ? "ร่าง" : "ยังไม่บันทึก"}</p></div>
      {rounds > 1 && month && (
        <div className="field"><span id="rl" className="lbl">รอบที่รายงาน</span>
          <div className="rseg" role="group" aria-labelledby="rl">{settings.dueDays.map((d, i) => {
            const r = all.find(x => x.month === month && x.round === i + 1);
            return <button key={i} type="button" aria-pressed={rd === i + 1} onClick={() => setRound(i + 1)}>รอบที่ {i + 1} · ภายใน {thaiDate(dueDateOf(month, d))}{r?.status === "submitted" ? " ✓" : ""}</button>;
          })}</div></div>)}
      {rec?.status === "submitted" ? (
        <p className={`msg${rec.late ? " bad" : ""}`} role="status">
          {rec.submittedAt ? `ส่งรายงานแล้วเมื่อ ${thaiDateTime(rec.submittedAt)}` : "ส่งรายงานแล้ว (ไม่มีบันทึกวันที่ส่ง)"}
          {rec.dueDate && ` · กำหนดส่ง ${thaiDate(rec.dueDate)}`} <span className={`pill ${rec.late ? "no" : "ok"}`}>{rec.late ? "ส่งช้า" : "ส่งตรงเวลา"}</span></p>
      ) : month && (
        <p className={`msg${overdue ? " bad" : ""}`} role="status">
          กำหนดส่งภายใน {thaiDate(due)}{overdue ? " · เลยกำหนดส่งแล้ว ถ้าส่งตอนนี้ระบบจะบันทึกว่า \"ส่งช้า\" พร้อมวันที่ส่ง" : ""}</p>)}
      {Array.from(new Set(FIELDS.map(f => f.group))).map(g => (
        <fieldset className="grp" key={g}><legend>{g}</legend>
          <div className="two">{FIELDS.filter(f => f.group === g).map(f => (
            <div className="field" key={f.key}><label htmlFor={f.key}>{f.label}</label>
              <div className="inp"><input id={f.key} type="number" inputMode="decimal" min={0} step="any" value={vals[f.key] ?? ""}
                onChange={e => setVals({ ...vals, [f.key]: e.target.value })} /><span>ตัน</span></div></div>))}</div></fieldset>))}
      <p className="hint">รวม{rounds > 1 ? "รอบนี้" : "เดือนนี้"} {fmt(sumValues(live))} ตัน · ถ้าไม่มีให้ใส่ 0{rounds > 1 ? " · กรอกเฉพาะปริมาณของรอบนี้ ระบบรวมทุกรอบเป็นยอดของเดือน" : ""}</p>
      <fieldset className="grp"><legend>ผู้รายงาน</legend><div className="two">
        {([["name", "ชื่อ-สกุล"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => (
          <div className="field" key={k}><label htmlFor={`r${k}`}>{l}</label>
            <input id={`r${k}`} type="text" value={rep[k]} onChange={e => setRep({ ...rep, [k]: e.target.value })} /></div>))}</div></fieldset>
      {msg && <p className={`msg${msg.bad ? " bad" : ""}`} role="status">{msg.t}</p>}
      <div className="actions">
        {status !== "submitted" && <button className="btn alt" disabled={busy || !month} onClick={() => save("draft")}>บันทึกร่าง</button>}
        <button className="btn go" disabled={busy || !month} onClick={() => save("submitted")}>{status === "submitted" ? "ส่งซ้ำ (แก้ไข)" : "ส่งรายงาน"}</button>
      </div>
    </section>
    <h2 style={{ margin: "1.5rem 0 .5rem" }}>ประวัติการรายงาน</h2>
    <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน / รอบ</th><th>รวม (ตัน)</th><th>สถานะ</th><th>ส่งเมื่อ</th></tr></thead><tbody>
      {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
        <tr key={`${r.month}-${r.round}`}><td style={{ textAlign: "left" }}><button className="btn alt" onClick={() => { setMonth(r.month); setRound(r.round); }}>{thaiMonth(r.month)} · รอบ {r.round}</button></td>
          <td>{fmt(sumValues(r.values))}</td>
          <td><span className={`pill ${r.status === "submitted" ? (r.late ? "no" : "ok") : "warn"}`}>{r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง"}</span></td>
          <td>{r.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td></tr>))}
      {!all.length && <tr><td colSpan={4} style={{ textAlign: "center" }}>ยังไม่มีรายงาน</td></tr>}
    </tbody></table></div>
  </>);
}
