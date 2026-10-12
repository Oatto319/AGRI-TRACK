"use client";
import { startTransition, useEffect, useState } from "react";
import { DISTRICTS, FIELDS, TARGET_PER_TAMBON, currentMonth, thaiMonth, type Report, type Reporter } from "@/lib/data";
import { fmt, sumValues } from "@/lib/summary";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";

const toStr = (v: Report["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));

export default function DistrictReport() {
  const { district } = useDistrict();
  const info = DISTRICTS.find(d => d.name === district)!;
  const [month, setMonth] = useState("");
  const [all, setAll] = useState<Report[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [status, setStatus] = useState<"none" | "draft" | "submitted">("none");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("month");
    startTransition(() => setMonth(q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : currentMonth()));
  }, []);
  useEffect(() => {
    fetch(`/api/reports?district=${encodeURIComponent(district)}`)
      .then(response => {
        if (!response.ok) throw new Error("โหลดรายงานไม่สำเร็จ");
        return response.json() as Promise<Report[]>;
      })
      .then(setAll)
      .catch(() => setMsg({ t: "ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง", bad: true }));
  }, [district]);
  useEffect(() => {
    const r = all.find(x => x.month === month);
    const last = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    startTransition(() => {
      setVals(r ? toStr(r.values) : {}); setStatus(r?.status ?? "none");
      setRep(r?.reporter ?? last?.reporter ?? { name: "", position: "", phone: "" });
    });
  }, [month, all]);

  const live = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
  async function save(s: "draft" | "submitted") {
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, values: vals, reporter: rep, status: s }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const error = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error : "บันทึกไม่สำเร็จ";
        setMsg({ t: error, bad: true });
        return;
      }
      const saved = data as Report;
      setAll(p => [...p.filter(x => x.month !== month), saved]);
      setMsg({ t: s === "submitted" ? `ส่งรายงานเดือน${thaiMonth(month)}แล้ว` : "บันทึกร่างแล้ว" });
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (<>
    <h1>กรอกรายงานรายเดือน</h1>
    <p className="sub">แบบสำรวจการส่งเสริมการผลิตและใช้ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · อำเภอ{district} · เกษตรตำบล {info.tambon} ราย · เป้าหมาย {fmt(info.tambon * TARGET_PER_TAMBON)} ตัน</p>
    <section className="sheet">
      <div className="field"><label htmlFor="m">เดือนที่รายงาน</label>
        <MonthPicker id="m" value={month} onChange={setMonth} />
        <p className="hint">{month ? thaiMonth(month) : "กำลังเตรียมเดือนรายงาน"} · สถานะ: {status === "submitted" ? "ส่งแล้ว (แก้ไขแล้วส่งซ้ำได้)" : status === "draft" ? "ร่าง" : "ยังไม่บันทึก"}</p></div>
      {Array.from(new Set(FIELDS.map(f => f.group))).map(g => (
        <fieldset className="grp" key={g}><legend>{g}</legend>
          <div className="two">{FIELDS.filter(f => f.group === g).map(f => (
            <div className="field" key={f.key}><label htmlFor={f.key}>{f.label}</label>
              <div className="inp"><input id={f.key} type="number" inputMode="decimal" min={0} step="any" value={vals[f.key] ?? ""}
                onChange={e => setVals({ ...vals, [f.key]: e.target.value })} /><span>ตัน</span></div></div>))}</div></fieldset>))}
      <p className="hint">รวมเดือนนี้ {fmt(sumValues(live))} ตัน · ถ้าไม่มีให้ใส่ 0</p>
      <fieldset className="grp"><legend>ผู้รายงาน</legend><div className="two">
        {([["name", "ชื่อ-สกุล"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => (
          <div className="field" key={k}><label htmlFor={`r${k}`}>{l}</label>
            <input id={`r${k}`} type="text" value={rep[k]} onChange={e => setRep({ ...rep, [k]: e.target.value })} /></div>))}</div></fieldset>
      {msg && <p className={`msg${msg.bad ? " bad" : ""}`} role="status">{msg.t}</p>}
      <div className="actions">
        <button className="btn alt" disabled={busy || !month} onClick={() => save("draft")}>บันทึกร่าง</button>
        <button className="btn go" disabled={busy || !month} onClick={() => save("submitted")}>ส่งรายงาน</button>
      </div>
    </section>
    <h2 style={{ margin: "1.5rem 0 .5rem" }}>ประวัติการรายงาน</h2>
    <div className="tw2"><table className="dt"><thead><tr><th>เดือน</th><th>รวม (ตัน)</th><th>สถานะ</th></tr></thead><tbody>
      {[...all].sort((a, b) => b.month.localeCompare(a.month)).map(r => (
        <tr key={r.month}><td style={{ textAlign: "left" }}><button className="btn alt" onClick={() => setMonth(r.month)}>{thaiMonth(r.month)}</button></td>
          <td>{fmt(sumValues(r.values))}</td><td>{r.status === "submitted" ? "ส่งแล้ว" : "ร่าง"}</td></tr>))}
      {!all.length && <tr><td colSpan={3} style={{ textAlign: "center" }}>ยังไม่มีรายงาน</td></tr>}
    </tbody></table></div>
  </>);
}
