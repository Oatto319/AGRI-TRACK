"use client";
import { startTransition, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, DISTRICTS, MAX_ROUNDS, bkkDate, cfgOf, cfgOfMonth, currentMonth, fiscalYearOptions, dueDateOf, dueDaysFor, fiscalRange, fiscalYearOf, thaiDate, thaiDateTime, thaiMonth, tambonOf, type Report, type Reporter, type Settings } from "@/lib/data";
import { fmt, monthsBetween, sumValues } from "@/lib/summary";
import { useDistrict } from "@/components/District";
import { useConfirm } from "@/components/ConfirmDialog";
import { detectAnomalies } from "@/lib/anomaly";
import { DueBanner, I, NumField, PageHead, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";

const toStr = (v: Report["values"]) => Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n)]));
const load = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดไม่สำเร็จ"); return (await r.json()) as T; };

export default function DistrictReport() {
  const { district } = useDistrict();
  const confirm = useConfirm();
  const info = DISTRICTS.find(d => d.name === district)!;
  const [month, setMonth] = useState("");
  const [today, setToday] = useState(""); // วันที่ปัจจุบัน (เวลาไทย) อ่านหลัง mount เท่านั้น
  const [round, setRound] = useState(1);
  const urlMonth = useRef(false); // เปิดจากลิงก์ที่ระบุเดือน (?month=) ไม่ต้องย้ายเดือนให้อัตโนมัติ
  const [fyIn, setFyIn] = useState<number | null>(null); // ปีงบประมาณที่เลือก (null = ปีงบประมาณของเดือนที่เลือกอยู่)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const cfg = cfgOfMonth(settings, month), FIELDS = cfg.fertFields;
  const fyr = month ? fiscalRange(fiscalYearOf(month), "fert") : null, outsideWarn = !!fyr && (month < fyr.from || month > fyr.to); // เดือนนอกช่วงปีงบประมาณ: เตือนว่าไม่นับในสรุป // ช่องที่จังหวัดตั้งไว้ (เพิ่ม/ลบ/เปลี่ยนชื่อได้)
  const [all, setAll] = useState<Report[]>([]);
  const fy = fyIn ?? (month ? fiscalYearOf(month) : 0);
  const fyRange = fy ? fiscalRange(fy, "fert") : null;
  const monthOptions = fyRange ? Array.from(new Set([...monthsBetween(fyRange.from, fyRange.to), ...(month && fiscalYearOf(month) === fy ? [month] : [])])).sort() : [];
  const curFy = fiscalYearOf(currentMonth());
  const fyOptions = fiscalYearOptions(cfgOf(settings), [curFy, fy, ...all.map(x => fiscalYearOf(x.month))].filter(Boolean));
  const pickFy = (y: number) => {
    setFyIn(y);
    const r = fiscalRange(y, "fert"), ms = monthsBetween(r.from, r.to), now = currentMonth();
    setMonth(ms.includes(now) ? now : now > r.to ? (ms[ms.length - 1] ?? now) : (ms[0] ?? now)); // เดือนปัจจุบันถ้าอยู่ในปีนั้น ไม่เช่นนั้นเดือนใกล้ที่สุด
    setRound(1);
  };
  const [vals, setVals] = useState<Record<string, string>>({});
  const [rep, setRep] = useState<Reporter>({ name: "", position: "", phone: "" });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const dueDays = dueDaysFor(settings, "fert", month), rounds = dueDays.length, rd = Math.min(round, rounds);
  const rec = all.find(x => x.month === month && x.round === rd);
  const status = rec?.status ?? "none";
  const due = month ? dueDateOf(month, dueDays[rd - 1] ?? 31) : "";
  const overdue = !!due && !!today && today > due && status !== "submitted";

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search), q = sp.get("month"), r = Number(sp.get("round") ?? 1);
    startTransition(() => {
      setToday(bkkDate());
      urlMonth.current = !!q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q);
      setMonth(urlMonth.current ? q! : currentMonth());
      setRound(Number.isInteger(r) && r >= 1 && r <= MAX_ROUNDS ? r : 1);
    });
  }, []);
  useEffect(() => {
    Promise.all([load<Report[]>(`/api/reports?district=${encodeURIComponent(district)}`), load<Settings>("/api/settings")])
      .then(([reports, st]) => { setAll(reports); setSettings(st); })
      .catch(() => setMsg({ t: "ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง", bad: true }));
  }, [district]);
  // เดือนปัจจุบันอยู่นอกช่วงรายงานของปีงบประมาณ (เช่น ต.ค. ก่อนเริ่ม พ.ย.) → ย้ายไปเดือนที่รายงานได้ใกล้ที่สุดให้ก่อน (ทำครั้งเดียวหลังโหลดการตั้งค่า)
  const snapped = useRef(false);
  useEffect(() => {
    if (snapped.current || !month || settings === DEFAULT_SETTINGS) return;
    snapped.current = true;
    cfgOf(settings);
    const r = fiscalRange(fiscalYearOf(month), "fert");
    if (!urlMonth.current && (month < r.from || month > r.to)) startTransition(() => setMonth(month < r.from ? r.from : r.to));
  }, [month, settings]);
  useEffect(() => {
    const last = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    startTransition(() => {
      setVals(rec ? toStr(rec.values) : {});
      setRep(rec?.reporter ?? last?.reporter ?? { name: "", position: "", phone: "" });
    });
  }, [rec, all]);

  const live = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
  // ตรวจค่าที่อาจผิดปกติ เทียบกับรายงานที่ส่งแล้วก่อนหน้าของอำเภอนี้ (เป็นการเตือน ไม่ได้ห้ามส่ง)
  const earlier = all.filter(x => x.status === "submitted" && (x.month < month || (x.month === month && x.round < rd))).sort((a, b) => a.month.localeCompare(b.month) || a.round - b.round);
  const anomalies = detectAnomalies({
    values: live as Record<string, number>, history: earlier.map(x => x.values as Record<string, number>), fields: FIELDS, unit: "ตัน", target: tambonOf(cfg, info) * cfg.targetPerTambon,
    cumulativeBefore: earlier.filter(x => !!fyRange && x.month >= fyRange.from && x.month <= fyRange.to).reduce((a, x) => a + sumValues(x.values, FIELDS), 0),
  });
  async function save(s: "draft" | "submitted") {
    if (s === "submitted" && anomalies.length && !(await confirm({ title: "มีค่าที่อาจผิดปกติ", message: `ระบบพบค่าที่ต่างจากปกติ ${anomalies.length} รายการ:\n\n${anomalies.map(a => "• " + a.message).join("\n")}\n\nตรวจแล้วถูกต้องและต้องการส่งต่อใช่หรือไม่?`, confirmLabel: "ถูกต้อง ส่งรายงาน", cancelLabel: "กลับไปตรวจ" }))) return;
    setBusy(true); setMsg(null);
    try {
      const response = await fetch("/api/reports", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ district, month, round: rd, values: vals, reporter: { name: rep.name }, status: s }),
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

  const GROUP: Record<string, { icon: React.ReactNode; c: string; l: string }> = {
    "ปุ๋ยอินทรีย์": { icon: I.leaf, c: "#2f8a5b", l: "#eef8f2" },
    "ปุ๋ยพืชสด": { icon: I.sprout, c: "#297b48", l: "#f0f4ed" },
    "วัสดุอินทรีย์": { icon: I.box, c: "#b08a2c", l: "#fbf5e3" },
  };
  const EXTRA_GROUPS = [{ icon: I.box, c: "#7a5ea8", l: "#f3eefb" }, { icon: I.leaf, c: "#c2410c", l: "#fdf0e8" }, { icon: I.sprout, c: "#266a40", l: "#eef2eb" }]; // กลุ่มใหม่ที่จังหวัดเพิ่ม
  const groups = Array.from(new Set(FIELDS.map(f => f.group)));
  const filled = FIELDS.filter(f => vals[f.key] !== undefined && vals[f.key] !== "").length;
  const checks = [
    { ok: filled === FIELDS.length, t: filled === FIELDS.length ? "กรอกปริมาณครบทุกช่อง" : `ปริมาณ: เหลืออีก ${FIELDS.length - filled} ช่อง (ไม่มีให้ใส่ 0)` },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
  ];
  const ready = checks.every(c => c.ok);

  return (<>
    <PageHead title="กรอกรายงานปุ๋ยอินทรีย์รายเดือน" sub={`อำเภอ${district} · กรอกปริมาณที่ผลิตหรือส่งเสริมในเดือนที่เลือก ทำตามขั้นตอน 1 → 3 แล้วกด “ส่งรายงาน”`}
      chips={[{ label: "เกษตรตำบล", value: `${tambonOf(cfg, info)} ราย` }, { label: "เป้าหมาย", value: `${fmt(tambonOf(cfg, info) * cfg.targetPerTambon)} ตัน` }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }]} />
    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="เลือกเดือนที่รายงาน" hint="เลือกปีงบประมาณก่อน แล้วเลือกเดือนที่จังหวัดกำหนดให้รายงาน · ระบบเลือกเดือนปัจจุบันให้แล้ว เปลี่ยนได้ถ้าต้องการกรอกย้อนหลัง" done={!!month}>
          <div className="ux-formgrid">
            <div>
              <label className="ux-lbl" htmlFor="fy">ปีงบประมาณ</label>
              <select id="fy" className="ux-select" value={fy || ""} disabled={!fy} onChange={e => pickFy(Number(e.target.value))}>
                {fyOptions.map(y => <option key={y} value={y}>ปีงบประมาณ {y}{y === curFy ? " (ปัจจุบัน)" : ""}</option>)}
              </select>
              {fyRange && <small className="ux-hint">ช่วงที่รายงาน {thaiMonth(fyRange.from)} – {thaiMonth(fyRange.to)}</small>}
            </div>
            <div>
              <label className="ux-lbl" htmlFor="m">เดือนที่รายงาน</label>
              <select id="m" className="ux-select" value={month} disabled={!month} onChange={e => { setMonth(e.target.value); setRound(1); }}>
                {monthOptions.map(m => <option key={m} value={m}>{thaiMonth(m)}{m === currentMonth() ? " (เดือนนี้)" : ""}</option>)}
              </select>
            </div>
          </div>
          {outsideWarn && <div className="ux-banner warn" role="status"><span>{I.info}</span><div>เดือนนี้อยู่นอกช่วงดำเนินการของปีงบประมาณ {fiscalYearOf(month)} ({thaiMonth(fyr!.from)} – {thaiMonth(fyr!.to)}) · ยังบันทึกและส่งได้ แต่ข้อมูลจะ<b>ไม่ถูกนับรวม</b>ในตารางและสรุปรายปีงบประมาณ</div></div>}
          <RoundTabs dueDays={dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
          <DueBanner rec={rec} due={due} overdue={overdue} noun="รายงาน" />
        </Step>

        <Step n={2} title="กรอกปริมาณ (หน่วย: ตัน)" hint={`ต้องกรอกครบทุกช่อง ถ้าเดือนนี้ไม่มีให้ใส่ 0${rounds > 1 ? " · กรอกเฉพาะปริมาณของรอบนี้" : ""}`} done={filled === FIELDS.length}>
          {groups.map((g, gi) => { const gf = FIELDS.filter(f => f.group === g), sum = gf.reduce((a, f) => a + (Number(vals[f.key]) || 0), 0), st = GROUP[g] ?? EXTRA_GROUPS[gi % EXTRA_GROUPS.length];
            return (
              <div className="ux-grp" key={g} style={{ ["--gc" as string]: st?.c, ["--gc-l" as string]: st?.l }}>
                <header><i>{st?.icon}</i><b>{g}</b><span>รวม {fmt(sum)} ตัน</span></header>
                <div className="ux-grid">{gf.map(f => <NumField key={f.key} id={f.key} label={f.label} unit="ตัน" value={vals[f.key] ?? ""} onChange={v => setVals({ ...vals, [f.key]: v })} />)}</div>
              </div>); })}
        </Step>

        <Step n={3} title="ผู้รายงาน" hint="ระบบจำชื่อจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim()}>
          <div className="ux-two">
            <TextField id="rname" label="ชื่อ-สกุล" value={rep.name} onChange={v => setRep({ ...rep, name: v })} />
          </div>
        </Step>
      </div>

      <aside className="ux-side" aria-label="สรุปและส่งรายงาน">
        <div className="ux-sum">
          <small>รวม{rounds > 1 ? "รอบนี้" : "เดือนนี้"}</small>
          <div className="big">{fmt(sumValues(live, FIELDS))} <span>ตัน</span></div>
          <div className="pg" aria-hidden="true"><i style={{ width: `${(filled / FIELDS.length) * 100}%` }} /></div>
          <small>กรอกแล้ว {filled} จาก {FIELDS.length} ช่อง</small>
          <div className="row"><span>เดือน</span><b>{month ? thaiMonth(month) : "–"}{rounds > 1 ? ` · รอบ ${rd}` : ""}</b></div>
          <div className="row"><span>สถานะ</span><b>{status === "submitted" ? "ส่งแล้ว" : status === "draft" ? "ร่าง" : "ยังไม่ได้กรอก"}</b></div>
        </div>
        {anomalies.length > 0 && (
          <div className="ux-banner warn" role="status"><span>{I.info}</span><div><b>ตรวจสอบอีกครั้ง ({anomalies.length})</b>{anomalies.map(a => <p key={a.key} style={{ margin: ".3rem 0 0" }}>{a.message}</p>)}</div></div>)}
        <div className="ux-card">
          <h2>ก่อนส่งต้องมีครบ</h2>
          <ul className="ux-todo">{checks.map(c => <li key={c.t} className={c.ok ? "ok" : ""}><i>{c.ok ? "✓" : "!"}</i>{c.t}</li>)}</ul>
          {msg && <p className={`ux-toast${msg.bad ? " bad" : ""}`} style={{ marginTop: ".9rem" }} role="status">{msg.t}</p>}
          <div className="ux-actions" style={{ marginTop: ".9rem" }}>
            <button className="ux-btn gold" disabled={busy || !month || !ready} onClick={() => save("submitted")}>{I.send}{status === "submitted" ? "ส่งซ้ำ (แก้ไข)" : "ส่งรายงาน"}</button>
            {status !== "submitted" && <button className="ux-btn line" disabled={busy || !month} onClick={() => save("draft")}>{I.save}บันทึกร่างไว้ก่อน</button>}
          </div>
          {!ready && <p className="ux-hint">ยังกรอกไม่ครบ จึงส่งไม่ได้ · บันทึกร่างไว้แล้วกลับมากรอกต่อได้</p>}
        </div>
      </aside>
    </div>

    <section className="ux-card" style={{ marginTop: "1.2rem" }}>
      <h2>ประวัติการรายงาน</h2><p className="ux-note">กดที่รายการเพื่อเปิดดูหรือแก้ไข</p>
      <ul className="ux-hist" style={{ marginTop: ".8rem" }}>
        {[...all].sort((a, b) => b.month.localeCompare(a.month) || b.round - a.round).map(r => (
          <li key={`${r.month}-${r.round}`}><button type="button" className={r.month === month && r.round === rd ? "cur" : ""} onClick={() => { setMonth(r.month); setRound(r.round); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span><b>{thaiMonth(r.month)}</b>{rounds > 1 && <> · รอบ {r.round}</>}<small>{r.submittedAt ? `ส่งเมื่อ ${thaiDateTime(r.submittedAt)}` : "ยังไม่ได้ส่ง"}</small></span>
            <b>{fmt(sumValues(r.values, FIELDS))} ตัน</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีรายงาน · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </section>
  </>);
}