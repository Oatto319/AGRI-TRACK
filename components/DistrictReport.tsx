"use client";
import { startTransition, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, DISTRICTS, FIELDS, MAX_ROUNDS, TARGET_PER_TAMBON, bkkDate, currentMonth, dueDateOf, thaiDate, thaiDateTime, thaiMonth, type Report, type Reporter, type Settings } from "@/lib/data";
import { fmt, sumValues } from "@/lib/summary";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";
import { DueBanner, I, NumField, PageHead, RoundTabs, Step, StatusPill, TextField } from "@/components/Entry";

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

  const GROUP: Record<string, { icon: React.ReactNode; c: string; l: string }> = {
    "ปุ๋ยอินทรีย์": { icon: I.leaf, c: "#2f8a5b", l: "#eef8f2" },
    "ปุ๋ยพืชสด": { icon: I.sprout, c: "#1f7a85", l: "#eaf5f7" },
    "วัสดุอินทรีย์": { icon: I.box, c: "#b08a2c", l: "#fbf5e3" },
  };
  const groups = Array.from(new Set(FIELDS.map(f => f.group)));
  const filled = FIELDS.filter(f => vals[f.key] !== undefined && vals[f.key] !== "").length;
  const phoneOk = /^[0-9\- ]{9,12}$/.test(rep.phone);
  const checks = [
    { ok: filled === FIELDS.length, t: filled === FIELDS.length ? "กรอกปริมาณครบทุกช่อง" : `ปริมาณ: เหลืออีก ${FIELDS.length - filled} ช่อง (ไม่มีให้ใส่ 0)` },
    { ok: !!rep.name.trim(), t: "ชื่อ-สกุลผู้รายงาน" },
    { ok: !!rep.position.trim(), t: "ตำแหน่ง" },
    { ok: phoneOk, t: "เบอร์โทร (ตัวเลข 9–12 หลัก)" },
  ];
  const ready = checks.every(c => c.ok);

  return (<>
    <PageHead title="กรอกรายงานปุ๋ยอินทรีย์รายเดือน" sub={`อำเภอ${district} · กรอกปริมาณที่ผลิตหรือส่งเสริมในเดือนที่เลือก ทำตามขั้นตอน 1 → 3 แล้วกด “ส่งรายงาน”`}
      chips={[{ label: "เกษตรตำบล", value: `${info.tambon} ราย` }, { label: "เป้าหมาย", value: `${fmt(info.tambon * TARGET_PER_TAMBON)} ตัน` }, { label: "ต้องรายงาน", value: `${rounds} ครั้ง/เดือน` }]} />
    <div className="ux-split">
      <div className="ux-stack">
        <Step n={1} title="เลือกเดือนที่รายงาน" hint="ระบบเลือกเดือนปัจจุบันให้แล้ว เปลี่ยนได้ถ้าต้องการกรอกย้อนหลัง" done={!!month}>
          <label className="ux-lbl" htmlFor="m">เดือนที่รายงาน</label>
          <MonthPicker id="m" value={month} onChange={setMonth} />
          <RoundTabs dueDays={settings.dueDays} month={month} rd={rd} done={r => all.find(x => x.month === month && x.round === r)?.status === "submitted"} onPick={setRound} />
          <DueBanner rec={rec} due={due} overdue={overdue} noun="รายงาน" />
        </Step>

        <Step n={2} title="กรอกปริมาณ (หน่วย: ตัน)" hint={`ต้องกรอกครบทุกช่อง ถ้าเดือนนี้ไม่มีให้ใส่ 0${rounds > 1 ? " · กรอกเฉพาะปริมาณของรอบนี้" : ""}`} done={filled === FIELDS.length}>
          {groups.map(g => { const gf = FIELDS.filter(f => f.group === g), sum = gf.reduce((a, f) => a + (Number(vals[f.key]) || 0), 0), st = GROUP[g];
            return (
              <div className="ux-grp" key={g} style={{ ["--gc" as string]: st?.c, ["--gc-l" as string]: st?.l }}>
                <header><i>{st?.icon}</i><b>{g}</b><span>รวม {fmt(sum)} ตัน</span></header>
                <div className="ux-grid">{gf.map(f => <NumField key={f.key} id={f.key} label={f.label} unit="ตัน" value={vals[f.key] ?? ""} onChange={v => setVals({ ...vals, [f.key]: v })} />)}</div>
              </div>); })}
        </Step>

        <Step n={3} title="ผู้รายงาน" hint="ระบบจำข้อมูลจากครั้งก่อนให้อัตโนมัติ" done={!!rep.name.trim() && !!rep.position.trim() && phoneOk}>
          <div className="ux-two">
            <TextField id="rname" label="ชื่อ-สกุล" value={rep.name} onChange={v => setRep({ ...rep, name: v })} />
            <TextField id="rposition" label="ตำแหน่ง" value={rep.position} onChange={v => setRep({ ...rep, position: v })} />
            <TextField id="rphone" label="โทรศัพท์" value={rep.phone} onChange={v => setRep({ ...rep, phone: v })} placeholder="เช่น 045-123456" />
          </div>
        </Step>
      </div>

      <aside className="ux-side" aria-label="สรุปและส่งรายงาน">
        <div className="ux-sum">
          <small>รวม{rounds > 1 ? "รอบนี้" : "เดือนนี้"}</small>
          <div className="big">{fmt(sumValues(live))} <span>ตัน</span></div>
          <div className="pg" aria-hidden="true"><i style={{ width: `${(filled / FIELDS.length) * 100}%` }} /></div>
          <small>กรอกแล้ว {filled} จาก {FIELDS.length} ช่อง</small>
          <div className="row"><span>เดือน</span><b>{month ? thaiMonth(month) : "–"}{rounds > 1 ? ` · รอบ ${rd}` : ""}</b></div>
          <div className="row"><span>สถานะ</span><b>{status === "submitted" ? "ส่งแล้ว" : status === "draft" ? "ร่าง" : "ยังไม่ได้กรอก"}</b></div>
        </div>
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
            <b>{fmt(sumValues(r.values))} ตัน</b><StatusPill status={r.status} late={r.late} /></button></li>))}
        {!all.length && <li className="ux-empty">ยังไม่มีรายงาน · เริ่มกรอกด้านบนได้เลย</li>}
      </ul>
    </section>
  </>);
}
