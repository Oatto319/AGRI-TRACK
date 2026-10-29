"use client";
import { startTransition, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, MAX_ROUNDS, cfgOfMonth, lbx, baleValue, strawBales, areaPct, areaSeasonOf, areaTarget, effectiveTotal, bkkDate, areaTotalsFor, currentMonth, dueDateOf, dueDaysFor, isAreaMonth, nearestAreaMonth, fiscalRange, fiscalYearOf, fiscalYearOptions, cfgOf, strawTons, strawValue, thaiDate, thaiDateTime, thaiMonth, thaiMonthShort, type AreaReport, type Reporter, type Settings } from "@/lib/data";
import { useDistrict } from "@/components/District";
import { useConfirm } from "@/components/ConfirmDialog";
import { detectAnomalies } from "@/lib/anomaly";
import { monthsBetween } from "@/lib/summary";
import { DueBanner, I, NumField, PageHead, ReadField, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";

const toStr = (v: AreaReport["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };
const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function DistrictAreaReport() {
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
  useEffect(() => {
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
  async function save(s: "draft" | "submitted") {
    if (s === "submitted" && anomalies.length && !(await confirm({ title: "มีค่าที่อาจผิดปกติ", message: `${anomalies.map(a => "• " + a.message).join("\n")}\n\nตรวจแล้วถูกต้องและต้องการส่งต่อใช่หรือไม่?`, confirmLabel: "ถูกต้อง ส่งรายงาน", cancelLabel: "กลับไปตรวจ" }))) return;
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/area", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, round: rd, values: vals, reporter: { name: rep.name }, status: s }) });
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

  const hasArea = vals.area !== undefined && vals.area !== "";
  const checks = [
    { ok: hasArea, t: hasArea ? "กรอกพื้นที่เดือนนี้แล้ว" : "พื้นที่ไถกลบเดือนนี้ (ไม่มีให้ใส่ 0)" },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
  ];
  const ready = checks.every(c => c.ok) && inSeason;
  const ofTarget = target > 0 ? (accum / target) * 100 : 0;

  return (<>
    <PageHead title="กรอกพื้นที่ไถกลบฟางข้าว" sub={`อำเภอ${district} · กรอกเฉพาะจำนวนไร่ที่ไถกลบในเดือนนั้น ส่วนฟางข้าว มูลค่า และยอดสะสมระบบคำนวณให้เอง`}
      chips={[{ label: "รายงานเฉพาะเดือน", value: fr ? `${thaiMonthShort(fr.from)} – ${thaiMonthShort(fr.to)}` : "—" }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }]} />
    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="เลือกปีงบประมาณและเดือนที่รายงาน" hint={fr ? `เลือกปีงบประมาณก่อน ระบบจะแสดงเดือนที่ต้องส่ง (${thaiMonth(fr.from)} – ${thaiMonth(fr.to)})` : "เลือกปีงบประมาณก่อน ระบบจะแสดงเดือนที่ต้องส่ง"} done={!!month && inSeason}>
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
          {!inSeason && <div className="ux-banner bad" role="alert">{I.alert}<div>เดือน{thaiMonth(month)}อยู่นอกช่วงรายงานพื้นที่ กรุณาเลือกเดือนระหว่าง{fr ? `${thaiMonth(fr.from)} – ${thaiMonth(fr.to)}` : "ที่กำหนด"}</div></div>}
          <RoundTabs dueDays={dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
          {inSeason && <DueBanner rec={rec} due={due} overdue={overdue} noun="ข้อมูล" />}
        </Step>

        <Step n={2} title="กรอกพื้นที่ที่ไถกลบในเดือนนี้" hint="กรอกเฉพาะช่องแรก ช่องสีเทาคำนวณให้อัตโนมัติ" done={hasArea}>
          <div className="ux-two">
            <NumField id="area" label={lbx(cfg, "a.field", "พื้นที่ไถกลบฟางข้าวเดือนนี้")} unit="ไร่" value={vals.area ?? ""} disabled={!inSeason} onChange={v => setVals({ ...vals, area: v })} />
            <ReadField id="st" label="ปริมาณฟางข้าว" value={f2(strawTons(thisArea, K))} unit="ตัน" />
            <ReadField id="sv" label="คิดเป็นมูลค่า" value={f2(strawValue(thisArea, K))} unit="บาท" />
            <ReadField id="sb" label="ฟางก้อน" value={f2(strawBales(thisArea, K))} unit="ก้อน" />
            <ReadField id="sp" label="ราคาฟางก้อน" value={f2(baleValue(thisArea, K))} unit="บาท" />
          </div>
          <p className="ux-hint">ฟางข้าว (ตัน) = ไร่ × {K.strawKgPerRai} กก. ÷ 1,000 · มูลค่า = ไร่ × {K.strawValuePerRai} บาท · ฟางก้อน = ไร่ × {K.balesPerRai} ก้อน · ราคาฟางก้อน = ก้อน × {K.balePrice} บาท</p>
        </Step>

        <Step n={3} title="ผู้รายงาน" hint="ระบบจำชื่อจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim()}>
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
        <div className="ux-card">
          <h2>ก่อนส่งต้องมีครบ</h2>
          <ul className="ux-todo">{checks.map(c => <li key={c.t} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : "!"}</i>{c.t}</li>)}</ul>
          {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="status">{msg.t}</p>}
          <div className="ux-actions" style={{ marginTop: ".9rem" }}>
            <button className="ux-btn gold" disabled={busy || !month || !ready} onClick={() => save("submitted")}>{I.send}{status === "submitted" ? "ส่งซ้ำ (แก้ไข)" : "ส่งข้อมูล"}</button>
            {status !== "submitted" && <button className="ux-btn line" disabled={busy || !month || !inSeason} onClick={() => save("draft")}>{I.save}บันทึกร่างไว้ก่อน</button>}
          </div>
        </div>
      </aside>
    </div>

    <section className="ux-card" style={{ marginTop: "1.2rem" }}>
      <h2>ประวัติการรายงาน</h2><p className="ux-note">กดที่รายการเพื่อเปิดดูหรือแก้ไข</p>
      <ul className="ux-hist" style={{ marginTop: ".8rem" }}>
        {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
          <li key={`${r.month}-${r.round}`}><button type="button" className={r.month === month && r.round === rd ? "cur" : ""} onClick={() => { setMonth(r.month); setRound(r.round); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span><b>{thaiMonth(r.month)}</b>{rounds > 1 && <> · รอบ {r.round}</>}<small>ฟางข้าว {f2(strawTons(r.values.area ?? 0, K))} ตัน · {r.submittedAt ? `ส่งเมื่อ ${thaiDateTime(r.submittedAt)}` : "ยังไม่ได้ส่ง"}</small></span>
            <b>{f2(r.values.area ?? 0)} ไร่</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีข้อมูล · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </section>
  </>);
}
