"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, MAX_ROUNDS, bkkDate, cfgOfMonth, currentMonth, dueDateOf, dueDaysFor, fiscalRange, fiscalYearOf, thaiDateTime, thaiMonth, type BurnKey, type BurnReport, type Reporter, type Settings } from "@/lib/data";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";
import { DueBanner, I, NumField, ReadField, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";
import { PeriodBar, SubmitCard, SuccessCard, putReport, sigOf, useAutosave, type FormProps } from "@/components/ReportKit";

const toStr = (v: BurnReport["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
const f0 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 0 });

export default function DistrictBurnReport({ onSwitch, onPeriod }: FormProps) {
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
  const [sent, setSent] = useState<BurnReport | null>(null); // รายงานที่เพิ่งส่ง → แสดงหน้ายืนยัน
  const skipReset = useRef(false); // บันทึกร่างอัตโนมัติเสร็จแล้ว ไม่ต้องเขียนทับสิ่งที่กำลังพิมพ์

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
  useEffect(() => { if (month) onPeriod(month, rd); }, [month, rd, onPeriod]);
  useEffect(() => {
    if (skipReset.current) { skipReset.current = false; return; }
    const last = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    startTransition(() => {
      setVals(rec ? toStr(rec.values) : {});
      setRep(rec?.reporter ?? last?.reporter ?? { name: "", position: "", phone: "" });
    });
  }, [rec, all]);

  const body = (status: "draft" | "submitted") => ({ district, month, round: rd, values: vals, reporter: { name: rep.name }, status });
  async function submit() {
    setBusy(true); setMsg(null);
    const r = await putReport<BurnReport>("/api/burn", body("submitted"));
    setBusy(false);
    if (!r.ok) { setMsg({ t: r.error, bad: true }); return; }
    setAll(p => [...p.filter(x => !(x.month === month && x.round === rd)), r.saved]);
    setSent(r.saved);
  }
  async function autoSave() {
    const r = await putReport<BurnReport>("/api/burn", body("draft"));
    if (!r.ok) return false;
    skipReset.current = true;
    setAll(p => [...p.filter(x => !(x.month === r.saved.month && x.round === r.saved.round)), r.saved]);
    return true;
  }

  const filled = BURN_FIELDS.filter(f => vals[f.key] !== undefined && vals[f.key] !== "").length;
  const checks = [
    { ok: filled === BURN_FIELDS.length, t: filled === BURN_FIELDS.length ? "กรอกผลการดำเนินงานครบทุกช่องแล้ว" : `ผลการดำเนินงานเดือนนี้ (กรอกแล้ว ${filled}/${BURN_FIELDS.length} ช่อง · ไม่มีให้ใส่ 0)` },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
  ];
  const ready = checks.every(c => c.ok);
  // มีข้อมูลที่ยังไม่ได้บันทึก (เทียบกับร่างที่บันทึกไว้ล่าสุด) → บันทึกร่างให้เอง · รายงานที่ส่งแล้วไม่ถูกเขียนทับเป็นร่าง
  const curSig = sigOf(BURN_FIELDS.map(f => vals[f.key]), rep.name), recSig = sigOf(BURN_FIELDS.map(f => rec?.values[f.key]), rec?.reporter.name ?? "");
  const dirty = filled > 0 && curSig !== recSig;
  const auto = useAutosave({ enabled: !!month && status !== "submitted" && !busy, dirty, sig: `${month}|${rd}|${curSig}`, save: autoSave });

  if (sent) return <SuccessCard district={district} settings={settings} topic="burn" month={month} round={rd} rounds={rounds} saved={sent} onNext={onSwitch} onReview={() => setSent(null)} />;

  return (<>
    <div className="ux-chips" style={{ marginTop: 0, marginBottom: "1rem" }}>
      {[{ label: "รายงานได้", value: "ทุกเดือน" }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }].map(c => <span key={c.label} className="ux-chip">{c.label} <b>{c.value}</b></span>)}
    </div>
    <PeriodBar label={month ? `เดือน${thaiMonth(month)}` : "กำลังโหลด…"} note={`ปีงบประมาณ ${fy || "–"}${month && month === currentMonth() ? " · เดือนปัจจุบัน" : ""}`}
      extra={<>
        {outsideWarn && <div className="ux-banner warn" role="status"><span>{I.info}</span><div>เดือนนี้อยู่นอกช่วงดำเนินการของปีงบประมาณ {fiscalYearOf(month)} ({thaiMonth(fr!.from)} – {thaiMonth(fr!.to)}) · ยังบันทึกและส่งได้ แต่ข้อมูลจะ<b>ไม่ถูกนับรวม</b>ในตารางและสรุปรายปีงบประมาณ</div></div>}
        <RoundTabs dueDays={dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
        <DueBanner rec={rec} due={due} overdue={overdue} noun="ข้อมูล" /></>}>
      <label className="ux-lbl" htmlFor="m">เดือนที่รายงาน</label>
      <MonthPicker id="m" value={month} onChange={setMonth} />
    </PeriodBar>

    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="กรอกผลการดำเนินงานเดือนนี้" hint="กรอกเป็นจำนวนเต็ม ถ้าเดือนนี้ไม่มีให้ใส่ 0" done={filled === BURN_FIELDS.length}>
          <div className="ux-two">
            {BURN_FIELDS.map(f => <NumField key={f.key} id={`b-${f.key}`} label={f.label} unit={f.unit} value={vals[f.key] ?? ""} onChange={v => setVals({ ...vals, [f.key]: v })} />)}
          </div>
        </Step>

        <Step n={2} title="ผู้รายงาน" hint="ระบบจำชื่อจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim()}>
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
        <SubmitCard checks={checks} ready={ready} busy={busy} disabled={!month} submitted={status === "submitted"} msg={msg} auto={auto} dirty={dirty} onSubmit={() => void submit()} />
      </aside>
    </div>

    <details className="ux-card rk-hist">
      <summary>ประวัติการรายงาน ({all.length})</summary><p className="ux-note">กดที่รายการเพื่อเปิดดูหรือแก้ไข</p>
      <ul className="ux-hist" style={{ marginTop: ".8rem" }}>
        {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
          <li key={`${r.month}-${r.round}`}><button type="button" className={r.month === month && r.round === rd ? "cur" : ""} onClick={() => { setMonth(r.month); setRound(r.round); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span><b>{thaiMonth(r.month)}</b>{rounds > 1 && <> · รอบ {r.round}</>}<small>{partField ? `${partField.label} ${f0(r.values[partField.key] ?? 0)} ${partField.unit} · ` : ""}{r.submittedAt ? `ส่งเมื่อ ${thaiDateTime(r.submittedAt)}` : "ยังไม่ได้ส่ง"}</small></span>
            <b>{f0(r.values[first.key] ?? 0)} {first.unit}</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีข้อมูล · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </details>
  </>);
}
