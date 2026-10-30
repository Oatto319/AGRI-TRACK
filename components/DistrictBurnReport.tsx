"use client";
import { startTransition, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, MAX_ROUNDS, bkkDate, cfgOfMonth, currentMonth, dueDateOf, dueDaysFor, fiscalRange, fiscalYearOf, thaiDate, thaiDateTime, thaiMonth, type BurnKey, type BurnReport, type Reporter, type Settings } from "@/lib/data";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";
import { DueBanner, I, NumField, PageHead, ReadField, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";

const toStr = (v: BurnReport["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
const f0 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default function DistrictBurnReport() {
  const { district } = useDistrict();
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(""); // อ่านวันที่หลัง mount เท่านั้น
  const [round, setRound] = useState(1);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const BURN_FIELDS = cfgOfMonth(settings, month).burnFields;
  // ตัวเลขสรุปด้านข้าง: ใช้ช่อง "จำนวนกิจกรรม" ถ้ายังมี ไม่เช่นนั้นใช้ช่องแรกที่จังหวัดตั้งไว้ · ช่อง "ผู้เข้าร่วม" แสดงเฉพาะเมื่อจังหวัดยังไม่ลบออก
  const first = BURN_FIELDS.find(f => f.key === "activities") ?? BURN_FIELDS[0], partField = BURN_FIELDS.find(f => f.key === "participants");
  const [all, setAll] = useState<BurnReport[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const dueDays = dueDaysFor(settings, "burn", month), rounds = dueDays.length, rd = Math.min(round, rounds);
  const rec = all.find(x => x.month === month && x.round === rd);
  const status = rec?.status ?? "none";
  const due = month ? dueDateOf(month, dueDays[rd - 1] ?? 31) : "";
  const overdue = !!due && !!today && today > due && status !== "submitted";
  const num = (k: string) => (vals[k] === undefined || vals[k] === "" ? 0 : Number(vals[k]) || 0);

  // สะสมตั้งแต่ต้นช่วงรายงานของปีงบประมาณถึงเดือนที่เลือก (ไม่เกินสิ้นช่วง) = รายงานที่ส่งแล้ว (ไม่นับรอบนี้) + ค่าที่กำลังกรอก
  // เดือนนอกช่วงไม่ถูกนับในสรุปรายปี จึงไม่รวมค่าที่กำลังกรอกด้วย (ตรงกับข้อความเตือนในหน้า)
  const fy = month ? fiscalYearOf(month) : 0, fr = fy ? fiscalRange(fy, "burn") : null;
  const outsideWarn = !!fr && (month < fr.from || month > fr.to); // เดือนนอกช่วงปีงบประมาณ: เตือนว่าไม่นับในสรุป
  const upTo = fr && month > fr.to ? fr.to : month;
  const accum = (k: BurnKey) => (fr ? all.filter(x => x.status === "submitted" && x.month >= fr.from && x.month <= upTo && !(x.month === month && x.round === rd)).reduce((a, x) => a + (x.values[k] ?? 0), 0) : 0) + (outsideWarn ? 0 : num(k));

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("month"), r = Number(sp.get("round") ?? 1);
    startTransition(() => {
      setToday(bkkDate());
      setMonth(q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : currentMonth());
      setRound(Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS ? r : 1);
    });
  }, []);
  useEffect(() => {
    Promise.all([load<BurnReport[]>(`/api/burn?district=${encodeURIComponent(district)}`), load<Settings>("/api/settings")])
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
      const response = await fetch("/api/burn", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, round: rd, values: vals, reporter: { name: rep.name }, status: s }) });
      const data: unknown = await response.json();
      if (!response.ok) {
        setMsg({ t: typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "บันทึกไม่สำเร็จ", bad: true });
        return;
      }
      const saved = data as BurnReport;
      setAll(p => [...p.filter(x => !(x.month === month && x.round === rd)), saved]);
      const where = `เดือน${thaiMonth(month)}${rounds > 1 ? ` รอบที่ ${rd}` : ""}`;
      if (s === "draft") setMsg({ t: "บันทึกร่างแล้ว" });
      else setMsg({ t: `ส่งข้อมูลการหยุดเผา${where}แล้ว เมื่อ ${saved.submittedAt ? thaiDateTime(saved.submittedAt) : ""}${saved.late ? ` · ส่งช้า (กำหนดส่ง ${saved.dueDate ? thaiDate(saved.dueDate) : ""})` : " · ส่งตรงเวลา"}`, bad: !!saved.late });
    } catch {
      setMsg({ t: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง", bad: true });
    } finally {
      setBusy(false);
    }
  }

  const filled = BURN_FIELDS.filter(f => vals[f.key] !== undefined && vals[f.key] !== "").length;
  const checks = [
    { ok: filled === BURN_FIELDS.length, t: filled === BURN_FIELDS.length ? "กรอกผลการดำเนินงานครบทุกช่องแล้ว" : `ผลการดำเนินงานเดือนนี้ (กรอกแล้ว ${filled}/${BURN_FIELDS.length} ช่อง · ไม่มีให้ใส่ 0)` },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
  ];
  const ready = checks.every(c => c.ok);

  return (<>
    <PageHead title="สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา" sub={`อำเภอ${district} · กรอกผลการจัดกิจกรรมเรียนรู้และการประชาสัมพันธ์รณรงค์หยุดเผาของเดือนนั้น ยอดสะสมของปีงบประมาณระบบรวมให้เอง`}
      chips={[{ label: "รายงานได้", value: "ทุกเดือน" }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }]} />
    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="เลือกเดือนที่รายงาน" hint="เลือกเดือนและรอบที่ต้องการรายงาน" done={!!month}>
          <label className="ux-lbl" htmlFor="m">เดือนที่รายงาน</label>
          <MonthPicker id="m" value={month} onChange={setMonth} />
          {outsideWarn && <div className="ux-banner warn" role="status"><span>{I.info}</span><div>เดือนนี้อยู่นอกช่วงดำเนินการของปีงบประมาณ {fiscalYearOf(month)} ({thaiMonth(fr!.from)} – {thaiMonth(fr!.to)}) · ยังบันทึกและส่งได้ แต่ข้อมูลจะ<b>ไม่ถูกนับรวม</b>ในตารางและสรุปรายปีงบประมาณ</div></div>}
          <RoundTabs dueDays={dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
          <DueBanner rec={rec} due={due} overdue={overdue} noun="ข้อมูล" />
        </Step>

        <Step n={2} title="กรอกผลการดำเนินงานเดือนนี้" hint="กรอกเป็นจำนวนเต็ม ถ้าเดือนนี้ไม่มีให้ใส่ 0" done={filled === BURN_FIELDS.length}>
          <div className="ux-two">
            {BURN_FIELDS.map(f => <NumField key={f.key} id={`b-${f.key}`} label={f.label} unit={f.unit} value={vals[f.key] ?? ""} onChange={v => setVals({ ...vals, [f.key]: v })} />)}
          </div>
        </Step>

        <Step n={3} title="ผู้รายงาน" hint="ระบบจำชื่อจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim()}>
          <div className="ux-two"><TextField id="rname" label="ชื่อ-สกุล" value={rep.name} onChange={v => setRep({ ...rep, name: v })} /></div>
        </Step>

        {fr && <section className="ux-card">
          <h2>สรุปสะสมปีงบประมาณ {fy}</h2>
          <p className="ux-note">{month < fr.from
            ? `คำนวณอัตโนมัติ · ดูเท่านั้น ไม่ต้องกรอก (ปีงบประมาณ ${fy} เริ่มนับตั้งแต่ ${thaiMonth(fr.from)} — เดือนที่เลือกอยู่ก่อนช่วงเริ่มต้น จึงยังเป็น 0 จนกว่าจะถึงช่วงรายงาน)`
            : `คำนวณอัตโนมัติ · ดูเท่านั้น ไม่ต้องกรอก (ตั้งแต่ ${thaiMonth(fr.from)} ถึง ${thaiMonth(month > fr.to ? fr.to : month)} นับรายงานที่ส่งแล้ว รวมค่าที่กำลังกรอก)`}</p>
          <div className="ux-two" style={{ marginTop: ".9rem" }}>
            {BURN_FIELDS.map(f => <ReadField key={f.key} id={`ba-${f.key}`} label={`${f.label} (สะสม)`} value={f0(accum(f.key))} unit={f.unit} />)}
          </div>
        </section>}
      </div>

      <aside className="ux-side" aria-label="สรุปและส่งข้อมูล">
        <div className="ux-sum">
          <small>{first.key === "activities" ? "กิจกรรม" : first.label}สะสมปีงบประมาณ {fy || ""}</small>
          <div className="big">{f0(accum(first.key))} <span>{first.unit}</span></div>
          {partField && <div className="row"><span>{partField.label} (สะสม)</span><b>{f0(accum(partField.key))} {partField.unit}</b></div>}
          <div className="row"><span>เดือนที่กรอก</span><b>{month ? thaiMonth(month) : "–"}{rounds > 1 ? ` · รอบ ${rd}` : ""}</b></div>
          <div className="row"><span>สถานะ</span><b>{status === "submitted" ? "ส่งแล้ว" : status === "draft" ? "ร่าง" : "ยังไม่ได้กรอก"}</b></div>
        </div>
        <div className="ux-card">
          <h2>ก่อนส่งต้องมีครบ</h2>
          <ul className="ux-todo">{checks.map(c => <li key={c.t} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : "!"}</i>{c.t}</li>)}</ul>
          {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="status">{msg.t}</p>}
          <div className="ux-actions" style={{ marginTop: ".9rem" }}>
            <button className="ux-btn gold" disabled={busy || !month || !ready} onClick={() => save("submitted")}>{I.send}{status === "submitted" ? "ส่งซ้ำ (แก้ไข)" : "ส่งข้อมูล"}</button>
            {status !== "submitted" && <button className="ux-btn line" disabled={busy || !month} onClick={() => save("draft")}>{I.save}บันทึกร่างไว้ก่อน</button>}
          </div>
        </div>
      </aside>
    </div>

    <section className="ux-card" style={{ marginTop: "1.2rem" }}>
      <h2>ประวัติการรายงาน</h2><p className="ux-note">กดที่รายการเพื่อเปิดดูหรือแก้ไข</p>
      <ul className="ux-hist" style={{ marginTop: ".8rem" }}>
        {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
          <li key={`${r.month}-${r.round}`}><button type="button" className={r.month === month && r.round === rd ? "cur" : ""} onClick={() => { setMonth(r.month); setRound(r.round); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span><b>{thaiMonth(r.month)}</b>{rounds > 1 && <> · รอบ {r.round}</>}<small>{partField ? `${partField.label} ${f0(r.values[partField.key] ?? 0)} ${partField.unit} · ` : ""}{r.submittedAt ? `ส่งเมื่อ ${thaiDateTime(r.submittedAt)}` : "ยังไม่ได้ส่ง"}</small></span>
            <b>{f0(r.values[first.key] ?? 0)} {first.unit}</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีข้อมูล · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </section>
  </>);
}
