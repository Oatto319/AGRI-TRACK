"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, MAX_ROUNDS, cfgOfMonth, lbx, baleValue, strawBales, areaPct, areaSeasonOf, areaTarget, effectiveTotal, bkkDate, areaTotalsFor, currentMonth, dueDateOf, dueDaysFor, isAreaMonth, nearestAreaMonth, fiscalRange, fiscalYearOf, fiscalYearOptions, cfgOf, strawTons, strawValue, thaiDateTime, thaiMonth, thaiMonthShort, type AreaReport, type Reporter, type Settings } from "@/lib/data";
import { useDistrict } from "@/components/District";
import { useConfirm } from "@/components/ConfirmDialog";
import { detectAnomalies } from "@/lib/anomaly";
import { monthsBetween } from "@/lib/summary";
import { DueBanner, I, NumField, ReadField, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";
import { PeriodBar, SubmitCard, SuccessCard, putReport, sigOf, useAutosave, type FormProps } from "@/components/ReportKit";

const toStr = (v: AreaReport["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function DistrictAreaReport({ onSwitch, onPeriod }: FormProps) {
  const { district } = useDistrict();
  const confirm = useConfirm();
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(""); // อ่านวันที่หลัง mount เท่านั้น
  const [round, setRound] = useState(1);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const cfg = cfgOfMonth(settings, month), K = cfg.area; // ตัวคูณที่จังหวัดตั้งไว้
  const [all, setAll] = useState<AreaReport[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<AreaReport | null>(null); // รายงานที่เพิ่งส่ง → แสดงหน้ายืนยัน
  const skipReset = useRef(false); // บันทึกร่างอัตโนมัติเสร็จแล้ว ไม่ต้องเขียนทับสิ่งที่กำลังพิมพ์

  const dueDays = dueDaysFor(settings, "area", month), rounds = dueDays.length, rd = Math.min(round, rounds);
  const rec = all.find(x => x.month === month && x.round === rd);
  const status = rec?.status ?? "none";
  const due = month ? dueDateOf(month, dueDays[rd - 1] ?? 31) : "";
  const overdue = !!due && !!today && today > due && status !== "submitted";
  const num = (k: string) => (vals[k] === undefined || vals[k] === "" ? 0 : Number(vals[k]) || 0);
  const inSeason = !month || isAreaMonth(month);
  const season = month ? areaSeasonOf(month) : null;
  // ปีงบประมาณที่เลือก + เดือนที่ต้องส่งทั้งหมดของปีนั้น (ตามช่วงเดือนที่จังหวัดตั้งไว้)
  const fy = month ? fiscalYearOf(month) : 0, fr = fy ? fiscalRange(fy, "area") : null;
  const curFy = today ? fiscalYearOf(today.slice(0, 7)) : 0;
  const fyOptions = fiscalYearOptions(cfgOf(settings), [...(curFy ? [curFy - 1, curFy, curFy + 1] : []), ...(fy ? [fy] : []), ...all.map(x => fiscalYearOf(x.month))]);
  const fyMonths = fr ? monthsBetween(fr.from, fr.to) : [];
  const pickFy = (y: number) => { const r = fiscalRange(y, "area"), cm = today ? today.slice(0, 7) : currentMonth(); setMonth(cm >= r.from && cm <= r.to ? cm : r.from); setRound(1); };
  const monthInfo = (m: string) => {
    const dd = dueDaysFor(settings, "area", m), n = dd.length, rs = all.filter(x => x.month === m);
    const sentRounds = Array.from({ length: n }, (_, i) => i + 1).filter(r => rs.some(x => x.round === r && x.status === "submitted"));
    const firstUnsent = Array.from({ length: n }, (_, i) => i + 1).find(r => !sentRounds.includes(r));
    const late = !!today && firstUnsent !== undefined && today > dueDateOf(m, dd[firstUnsent - 1] ?? 31);
    const draft = rs.some(x => x.status === "draft");
    const sent = sentRounds.length;
    return sent === n ? { cls: "ok", text: "ส่งครบแล้ว" } : late ? { cls: "bad", text: `เลยกำหนด${n > 1 ? ` (${sent}/${n})` : ""}` } : sent > 0 ? { cls: "warn", text: `ส่งแล้ว ${sent}/${n} รอบ` } : draft ? { cls: "warn", text: "มีร่างที่ยังไม่ส่ง" } : { cls: "", text: "ยังไม่ส่ง" };
  };
  const thisArea = num("area");
  // พื้นที่ปลูกทั้งหมดจังหวัดเป็นผู้กำหนด · สะสม = รายงานที่ส่งแล้วในฤดูกาล (ไม่นับรอบนี้) + ค่าที่กำลังกรอก
  const others = season ? all.filter(x => x.status === "submitted" && x.month >= season.start && x.month <= season.end && !(x.month === month && x.round === rd)).reduce((a, x) => a + (x.values.area ?? 0), 0) : 0;
  const accum = others + thisArea;
  const assigned = (areaTotalsFor(settings, month)[district] ?? 0) > 0, total = effectiveTotal(areaTotalsFor(settings, month)[district], accum), target = areaTarget(total, K), pct = areaPct(accum, total);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("month"), r = Number(sp.get("round") ?? 1);
    startTransition(() => {
      setToday(bkkDate());
      setMonth(nearestAreaMonth(q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q) ? q : currentMonth()));
      setRound(Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS ? r : 1);
    });
  }, []);
  useEffect(() => {
    Promise.all([load<AreaReport[]>(`/api/area?district=${encodeURIComponent(district)}`), load<Settings>("/api/settings")])
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

  const earlier = all.filter(x => x.status === "submitted" && (x.month < month || (x.month === month && x.round < rd))).sort((a, b) => a.month.localeCompare(b.month) || a.round - b.round);
  const anomalies = detectAnomalies({
    values: vals.area !== undefined && vals.area !== "" ? { area: Number(vals.area) } : {}, history: earlier.map(x => ({ area: x.values.area ?? 0 })), fields: [{ key: "area", label: "พื้นที่ไถกลบฟางข้าว" }], unit: "ไร่",
  });
  const body = (status: "draft" | "submitted") => ({ district, month, round: rd, values: vals, reporter: { name: rep.name }, status });
  async function submit() {
    if (anomalies.length && !(await confirm({ title: "มีค่าที่อาจผิดปกติ", message: `${anomalies.map(a => "• " + a.message).join("\n")}\n\nตรวจแล้วถูกต้องและต้องการส่งต่อใช่หรือไม่?`, confirmLabel: "ถูกต้อง ส่งรายงาน", cancelLabel: "กลับไปตรวจ" }))) return;
    setBusy(true); setMsg(null);
    const r = await putReport<AreaReport>("/api/area", body("submitted"));
    setBusy(false);
    if (!r.ok) { setMsg({ t: r.error, bad: true }); return; }
    setAll(p => [...p.filter(x => !(x.month === month && x.round === rd)), r.saved]);
    setSent(r.saved);
  }
  async function autoSave() {
    const r = await putReport<AreaReport>("/api/area", body("draft"));
    if (!r.ok) return false;
    skipReset.current = true;
    setAll(p => [...p.filter(x => !(x.month === r.saved.month && x.round === r.saved.round)), r.saved]);
    return true;
  }

  const hasArea = vals.area !== undefined && vals.area !== "";
  const checks = [
    { ok: hasArea, t: hasArea ? "กรอกพื้นที่เดือนนี้แล้ว" : "พื้นที่ไถกลบเดือนนี้ (ไม่มีให้ใส่ 0)" },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
  ];
  const ready = checks.every(c => c.ok) && inSeason;
  const ofTarget = target > 0 ? (accum / target) * 100 : 0;
  // มีข้อมูลที่ยังไม่ได้บันทึก (เทียบกับร่างที่บันทึกไว้ล่าสุด) → บันทึกร่างให้เอง · รายงานที่ส่งแล้วไม่ถูกเขียนทับเป็นร่าง
  const curSig = sigOf([vals.area], rep.name), recSig = sigOf([rec?.values.area], rec?.reporter.name ?? "");
  const dirty = hasArea && curSig !== recSig;
  const auto = useAutosave({ enabled: !!month && inSeason && status !== "submitted" && !busy, dirty, sig: `${month}|${rd}|${curSig}`, save: autoSave });

  if (sent) return <SuccessCard district={district} settings={settings} topic="area" month={month} round={rd} rounds={rounds} saved={sent} onNext={onSwitch} onReview={() => setSent(null)} />;

  return (<>
    <div className="ux-chips" style={{ marginTop: 0, marginBottom: "1rem" }}>
      {[{ label: "รายงานเฉพาะเดือน", value: fr ? `${thaiMonthShort(fr.from)} – ${thaiMonthShort(fr.to)}` : "—" }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }].map(c => <span key={c.label} className="ux-chip">{c.label} <b>{c.value}</b></span>)}
    </div>
    <PeriodBar label={month ? `เดือน${thaiMonth(month)}` : "กำลังโหลด…"} note={`ปีงบประมาณ ${fy || "–"}${month && today && today.slice(0, 7) === month ? " · เดือนปัจจุบัน" : ""}`} forceOpen={!inSeason}
      extra={<>
        {!inSeason && <div className="ux-banner bad" role="alert">{I.alert}<div>เดือน{thaiMonth(month)}อยู่นอกช่วงรายงานพื้นที่ กรุณาเลือกเดือนระหว่าง{fr ? `${thaiMonth(fr.from)} – ${thaiMonth(fr.to)}` : "ที่กำหนด"}</div></div>}
        <RoundTabs dueDays={dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
        {inSeason && <DueBanner rec={rec} due={due} overdue={overdue} noun="ข้อมูล" />}</>}>
      <label className="ux-lbl" htmlFor="fy">ปีงบประมาณ</label>
      <select id="fy" className="ux-select" value={fy || ""} onChange={e => pickFy(Number(e.target.value))}>
        {fyOptions.map(y => { const r = fiscalRange(y, "area"); return <option key={y} value={y}>ปีงบประมาณ {y} ({thaiMonth(r.from)} – {thaiMonth(r.to)})</option>; })}
      </select>
      {fr && <>
        <p className="ux-lbl" style={{ marginTop: "1rem" }}>เดือนที่ต้องส่ง ({fyMonths.length} เดือน) · กดเลือกเดือนที่จะรายงาน</p>
        <div className="fm-grid" role="group" aria-label="เดือนที่ต้องส่งในปีงบประมาณ">
          {fyMonths.map(m => { const info = monthInfo(m), sel = m === month, now = !!today && today.slice(0, 7) === m;
            return (
              <button key={m} type="button" aria-pressed={sel} className={`fm-m ${info.cls}${sel ? " sel" : ""}${now ? " now" : ""}`} onClick={() => { setMonth(m); setRound(1); }}>
                <b>{thaiMonth(m)}</b><small>{info.text}</small>{now && <em>เดือนนี้</em>}
              </button>); })}
        </div>
      </>}
    </PeriodBar>

    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="กรอกพื้นที่ที่ไถกลบในเดือนนี้" hint="กรอกเฉพาะช่องแรก ช่องสีเทาคำนวณให้อัตโนมัติ" done={hasArea}>
          <div className="ux-two">
            <NumField id="area" label={lbx(cfg, "a.field", "พื้นที่ไถกลบฟางข้าวเดือนนี้")} unit="ไร่" value={vals.area ?? ""} disabled={!inSeason} onChange={v => setVals({ ...vals, area: v })} />
            <ReadField id="st" label="ปริมาณฟางข้าว" value={f2(strawTons(thisArea, K))} unit="ตัน" />
            <ReadField id="sv" label="คิดเป็นมูลค่า" value={f2(strawValue(thisArea, K))} unit="บาท" />
            <ReadField id="sb" label="ฟางก้อน" value={f2(strawBales(thisArea, K))} unit="ก้อน" />
            <ReadField id="sp" label="ราคาฟางก้อน" value={f2(baleValue(thisArea, K))} unit="บาท" />
          </div>
          <p className="ux-hint">ฟางข้าว (ตัน) = ไร่ × {K.strawKgPerRai} กก. ÷ 1,000 · มูลค่า = ไร่ × {K.strawValuePerRai} บาท · ฟางก้อน = ไร่ × {K.balesPerRai} ก้อน · ราคาฟางก้อน = ก้อน × {K.balePrice} บาท</p>
        </Step>

        <Step n={2} title="ผู้รายงาน" hint="ระบบจำชื่อจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim()}>
          <div className="ux-two"><TextField id="rname" label="ชื่อ-สกุล" value={rep.name} onChange={v => setRep({ ...rep, name: v })} /></div>
        </Step>

        {season && <section className="ux-card">
          <h2>สรุปสะสมฤดูกาล {thaiMonth(season.start)} – {thaiMonth(season.end)}</h2>
          <p className="ux-note">คำนวณอัตโนมัติ · ดูเท่านั้น ไม่ต้องกรอก (นับรายงานที่ส่งแล้ว รวมค่าที่กำลังกรอก)</p>
          <div className="ux-two" style={{ marginTop: ".9rem" }}>
            <ReadField id="ta" label="พื้นที่ปลูกพืชทั้งหมด" value={f2(total)} unit="ไร่" />
            <ReadField id="tg" label={`เป้าหมายร้อยละ ${K.targetPct}`} value={f2(target)} unit="ไร่" />
            <ReadField id="ac" label="พื้นที่สะสมทั้งหมด" value={f2(accum)} unit="ไร่" />
            <ReadField id="pc" label="คิดเป็นร้อยละของพื้นที่ทั้งหมด" value={f2(pct)} unit="%" />
            <ReadField id="sa" label="ปริมาณฟางข้าวสะสม" value={f2(strawTons(accum, K))} unit="ตัน" />
            <ReadField id="va" label="คิดเป็นมูลค่าสะสม" value={f2(strawValue(accum, K))} unit="บาท" />
            <ReadField id="ba" label="ฟางก้อนสะสม" value={f2(strawBales(accum, K))} unit="ก้อน" />
            <ReadField id="bp" label="ราคาฟางก้อนสะสม" value={f2(baleValue(accum, K))} unit="บาท" />
          </div>
          <p className="ux-hint">{!assigned ? "จังหวัดยังไม่ได้กำหนดพื้นที่ปลูกพืชทั้งหมดของอำเภอนี้ จึงใช้พื้นที่สะสมเป็นฐานคำนวณไปก่อน" : `คิดเป็น ${f2(ofTarget)}% ของเป้าหมาย`}{assigned && accum > total ? " · พื้นที่สะสมมากกว่าพื้นที่ปลูกทั้งหมด โปรดตรวจสอบ" : ""}</p>
        </section>}
      </div>

      <aside className="ux-side" aria-label="สรุปและส่งข้อมูล">
        <div className="ux-sum">
          <small>พื้นที่สะสมตั้งแต่ พ.ย.</small>
          <div className="big">{f2(accum)} <span>ไร่</span></div>
          <div className="pg" aria-hidden="true"><i style={{ width: `${Math.min(100, ofTarget)}%` }} /></div>
          <small>{target > 0 ? `${f2(ofTarget)}% ของเป้าหมาย ${f2(target)} ไร่` : "ยังไม่มีเป้าหมาย"}</small>
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
            <span><b>{thaiMonth(r.month)}</b>{rounds > 1 && <> · รอบ {r.round}</>}<small>ฟางข้าว {f2(strawTons(r.values.area ?? 0, K))} ตัน · {r.submittedAt ? `ส่งเมื่อ ${thaiDateTime(r.submittedAt)}` : "ยังไม่ได้ส่ง"}</small></span>
            <b>{f2(r.values.area ?? 0)} ไร่</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีข้อมูล · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </details>
  </>);
}
