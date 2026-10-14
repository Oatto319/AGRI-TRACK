"use client";
import { startTransition, useEffect, useState } from "react";
import { AREA_FIELDS, AREA_TARGET_PCT, DEFAULT_SETTINGS, MAX_ROUNDS, areaPct, areaTarget, bkkDate, currentMonth, dueDateOf, thaiDate, thaiDateTime, thaiMonth, type AreaReport, type Reporter, type Settings } from "@/lib/data";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";

const toStr = (v: AreaReport["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function DistrictAreaReport() {
  const { district } = useDistrict();
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(""); // อ่านวันที่หลัง mount เท่านั้น
  const [round, setRound] = useState(1);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [all, setAll] = useState<AreaReport[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const rounds = settings.dueDays.length, rd = Math.min(round, rounds);
  const rec = all.find(x => x.month === month && x.round === rd);
  const status = rec?.status ?? "none";
  const due = month ? dueDateOf(month, settings.dueDays[rd - 1] ?? 31) : "";
  const overdue = !!due && !!today && today > due && status !== "submitted";
  const num = (k: string) => (vals[k] === undefined || vals[k] === "" ? 0 : Number(vals[k]) || 0);
  const total = num("totalArea"), accum = num("accumArea"), target = areaTarget(total), pct = areaPct(accum, total);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("month"), r = Number(sp.get("round") ?? 1);
    startTransition(() => {
      setToday(bkkDate());
      setMonth(q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : currentMonth());
      setRound(Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS ? r : 1);
    });
  }, []);
  useEffect(() => {
    Promise.all([load<AreaReport[]>(`/api/area?district=${encodeURIComponent(district)}`), load<Settings>("/api/settings")])
      .then(([reports, st]) => { setAll(reports); setSettings(st); })
      .catch(() => setMsg({ t: "ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง", bad: true }));
  }, [district]);
  useEffect(() => {
    const last = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    startTransition(() => {
      setVals(rec ? toStr(rec.values) : {});
      setRep(rec?.reporter ?? last?.reporter ?? { name: "", position: "", phone: "" });
    });
  }, [rec, all]);

  async function save(s: "draft" | "submitted") {
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/area", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, round: rd, values: vals, reporter: rep, status: s }) });
      const data: unknown = await response.json();
      if (!response.ok) {
        setMsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return;
      }
      const saved = data as AreaReport;
      setAll(p => [...p.filter(x => !(x.month === month && x.round === rd)), saved]);
      const where = `เดือน${thaiMonth(month)}${rounds > 1 ? ` รอบที่ ${rd}` : ""}`;
      if (s === "draft") setMsg({ t: "บันทึกร่างแล้ว" });
      else setMsg({ t: `ส่งข้อมูลพื้นที่และฟางข้าว${where}แล้ว เมื่อ ${saved.submittedAt ? thaiDateTime(saved.submittedAt) : ""}${saved.late ? ` · ส่งช้า (กำหนดส่ง ${saved.dueDate ? thaiDate(saved.dueDate) : ""})` : " · ส่งตรงเวลา"}`, bad: !!saved.late });
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setBusy(false);
    }
  }

  const input = (key: (typeof AREA_FIELDS)[number]["key"]) => {
    const fd = AREA_FIELDS.find(x => x.key === key)!;
    return (
      <div className="field" key={key}><label htmlFor={key}>{fd.label}</label>
        <div className="inp"><input id={key} type="number" inputMode="decimal" min={0} step="any" value={vals[key] ?? ""}
          onChange={e => setVals({ ...vals, [key]: e.target.value })} /><span>{fd.unit}</span></div></div>);
  };
  const computed = (id: string, label: string, value: string, unit: string) => (
    <div className="field"><label htmlFor={id}>{label}</label>
      <div className="inp"><input id={id} readOnly tabIndex={-1} value={value} /><span>{unit}</span></div></div>);

  return (<>
    <h1>ข้อมูลพื้นที่และฟางข้าว</h1>
    <p className="sub">อำเภอ{district} · ต้องรายงาน {rounds} ครั้ง/เดือน (รอบและกำหนดส่งเดียวกับรายงานปุ๋ยอินทรีย์) · ช่องสีเทาคำนวณให้อัตโนมัติ</p>
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
          {rec.submittedAt ? `ส่งข้อมูลแล้วเมื่อ ${thaiDateTime(rec.submittedAt)}` : "ส่งข้อมูลแล้ว (ไม่มีบันทึกวันที่ส่ง)"}
          {rec.dueDate && ` · กำหนดส่ง ${thaiDate(rec.dueDate)}`} <span className={`pill ${rec.late ? "no" : "ok"}`}>{rec.late ? "ส่งช้า" : "ส่งตรงเวลา"}</span></p>
      ) : month && (
        <p className={`msg${overdue ? " bad" : ""}`} role="status">
          กำหนดส่งภายใน {thaiDate(due)}{overdue ? " · เลยกำหนดส่งแล้ว ถ้าส่งตอนนี้ระบบจะบันทึกว่า \"ส่งช้า\" พร้อมวันที่ส่ง" : ""}</p>)}
      <fieldset className="grp"><legend>พื้นที่</legend><div className="two">
        {input("totalArea")}
        {computed("tg", `เป้าหมายร้อยละ ${AREA_TARGET_PCT} ของพื้นที่`, f2(target), "ไร่")}
        {input("accumArea")}
        {computed("pc", "คิดเป็นกี่เปอร์เซ็นต์ของพื้นที่ทั้งหมด", f2(pct), "%")}
      </div>
        <p className="hint">{target > 0 ? `คิดเป็น ${f2((accum / target) * 100)}% ของเป้าหมาย` : "กรอกพื้นที่ปลูกพืชทั้งหมดเพื่อคำนวณเป้าหมาย"}{accum > total && total > 0 ? " · พื้นที่สะสมมากกว่าพื้นที่ปลูกทั้งหมด โปรดตรวจสอบ" : ""}</p></fieldset>
      <fieldset className="grp"><legend>ฟางข้าว</legend><div className="two">{input("straw")}{input("strawValue")}</div></fieldset>
      <p className="hint">ถ้าไม่มีให้ใส่ 0 · ต้องกรอกครบทุกช่องและระบุผู้รายงานก่อนกดส่ง</p>
      <fieldset className="grp"><legend>ผู้รายงาน</legend><div className="two">
        {([["name", "ชื่อ-สกุล"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => (
          <div className="field" key={k}><label htmlFor={`r${k}`}>{l}</label>
            <input id={`r${k}`} type="text" value={rep[k]} onChange={e => setRep({ ...rep, [k]: e.target.value })} /></div>))}</div></fieldset>
      {msg && <p className={`msg${msg.bad ? " bad" : ""}`} role="status">{msg.t}</p>}
      <div className="actions">
        {status !== "submitted" && <button className="btn alt" disabled={busy || !month} onClick={() => save("draft")}>บันทึกร่าง</button>}
        <button className="btn go" disabled={busy || !month} onClick={() => save("submitted")}>{status === "submitted" ? "ส่งซ้ำ (แก้ไข)" : "ส่งข้อมูล"}</button>
      </div>
    </section>
    <h2 style={{ margin: "1.5rem 0 .5rem" }}>ประวัติการรายงาน</h2>
    <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน / รอบ</th><th>พื้นที่ทั้งหมด (ไร่)</th><th>สะสม (ไร่)</th><th>ฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th>สถานะ</th><th>ส่งเมื่อ</th></tr></thead><tbody>
      {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
        <tr key={`${r.month}-${r.round}`}><td style={{ textAlign: "left" }}><button className="btn alt" onClick={() => { setMonth(r.month); setRound(r.round); }}>{thaiMonth(r.month)} · รอบ {r.round}</button></td>
          <td>{f2(r.values.totalArea ?? 0)}</td><td>{f2(r.values.accumArea ?? 0)}</td><td>{f2(r.values.straw ?? 0)}</td><td>{f2(r.values.strawValue ?? 0)}</td>
          <td><span className={`pill ${r.status === "submitted" ? (r.late ? "no" : "ok") : "warn"}`}>{r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง"}</span></td>
          <td>{r.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td></tr>))}
      {!all.length && <tr><td colSpan={7} style={{ textAlign: "center" }}>ยังไม่มีข้อมูล</td></tr>}
    </tbody></table></div>
  </>);
}
