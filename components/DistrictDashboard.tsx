"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AREA_FIELDS, AREA_TARGET_PCT, DEFAULT_SETTINGS, FIELDS, currentMonth, dueDateOf, isAreaMonth, strawTons, strawValue, thaiDate, thaiDateTime, thaiMonth, type AreaReport, type Report, type Settings } from "@/lib/data";
import { aggregate, aggregateArea, fmt, sumValues } from "@/lib/summary";
import { COLORS, Donut, Kpi, RankRows, Trend } from "@/components/Charts";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function DistrictDashboard() {
  const { district } = useDistrict();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [cm, setCm] = useState(""); // เดือนที่ใช้ตรวจรายการที่ต้องกรอก
  const [area, setArea] = useState<AreaReport[]>([]);
  const [cr, setCr] = useState(1); // รอบที่ใช้ตรวจรายการที่ต้องกรอก
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    const get = async <T,>(url: string) => { const r = await fetch(url); if (!r.ok) throw new Error("โหลดรายงานไม่สำเร็จ"); return (await r.json()) as T; };
    Promise.all([get<Report[]>("/api/reports"), get<Settings>("/api/settings"), get<AreaReport[]>(`/api/area?district=${encodeURIComponent(district)}`)])
      .then(([all, st, ar]) => {
      setSettings(st); setArea(ar);
      const current = currentMonth();
      setCm(current);
      setReports(all);
      const ms = all.filter(r => r.district === district && r.status === "submitted").map(r => r.month).sort();
      setFrom(ms[0] ?? current); setTo(ms.length && ms[ms.length - 1] > current ? ms[ms.length - 1] : current);
    })
      .catch(() => setLoadError("ไม่สามารถโหลดรายงานได้ กรุณาลองใหม่อีกครั้ง"));
  }, [district]);
  const valid = !!from && !!to && from <= to;
  const d = useMemo(() => {
    if (!reports || !valid) return null;
    const rounds = settings.dueDays.length;
    const agg = aggregate(reports, from, to, rounds), me = agg.rows.find(r => r.name === district)!;
    const ranked = [...agg.rows].sort((a, b) => b.total - a.total), sentRows = agg.rows.filter(r => r.any);
    const mine = reports.filter(r => r.district === district);
    const arAll = aggregateArea(area, to, settings.areaTotals), ar = arAll.rows.find(r => r.name === district)!;
    return { agg, me, ar, season: arAll.season, arMonths: arAll.months, ranked, rounds, rank: ranked.findIndex(r => r.name === district) + 1, avg: sentRows.length ? sentRows.reduce((a, r) => a + r.total, 0) / sentRows.length : 0,
      rec: (m: string, rd: number) => mine.find(r => r.month === m && r.round === rd),
      mstat: (m: string) => { const g = me.got[m] ?? 0; return g >= rounds ? "ok" : g > 0 || mine.some(r => r.month === m) ? "warn" : "no"; },
      mlate: (m: string) => mine.some(r => r.month === m && r.late),
      pct: me.target ? Math.round((me.total / me.target) * 100) : 0 };
  }, [reports, valid, from, to, district, settings, area]);
  return (
    <div className="db">
      <div className="db-head">
        <div><h1>สวัสดี อำเภอ{district} 👋</h1>
          <p className="sub" style={{ margin: 0 }}>ผลการดำเนินงานปุ๋ยอินทรีย์และวัสดุอินทรีย์ · {valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""}</p></div>
        <div className="db-filter">
          <div className="field"><label htmlFor="f">ตั้งแต่เดือน</label><MonthPicker id="f" value={from} onChange={setFrom} /></div>
          <div className="field"><label htmlFor="t">ถึงเดือน</label><MonthPicker id="t" value={to} onChange={setTo} /></div>
          <Link className="btn go" href="/district/report">＋ กรอกรายงาน</Link>
        </div>
      </div>
      {loadError && <p className="err" role="alert">{loadError}</p>}
      {!reports && <p>กำลังโหลด…</p>}
      {reports && !valid && <p className="err">เลือกช่วงเดือนให้ถูกต้อง</p>}
      {d && <>
        {(() => {
          const rd = Math.min(cr, d.rounds), r = d.rec(cm, rd), st = r?.status ?? "none", due = dueDateOf(cm, settings.dueDays[rd - 1] ?? 31);
          const vitems = FIELDS.map(f => ({ key: f.key, label: f.label, group: f.group, val: r?.values[f.key] }));
          const ritems = ([["name", "ชื่อ-สกุลผู้รายงาน"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => ({ key: k, label: l, val: r?.reporter[k] || undefined }));
          const all = [...vitems, ...ritems], done = all.filter(i => i.val !== undefined).length, pend = all.length - done;
          const Item = ({ label, val, unit }: { label: string; val?: number | string; unit?: boolean }) => (
            <Link href={`/district/report?month=${cm}&round=${rd}`} className={`db-item ${val !== undefined ? "ok" : "no"}`}>
              <i>{val !== undefined ? "✓" : "!"}</i><span>{label}</span><em>{val !== undefined ? `${typeof val === "number" ? fmt(val) : val}${unit ? " ตัน" : ""}` : "ยังไม่ได้กรอก"}</em></Link>);
          return (
            <section className="db-card db-todo" style={{ marginBottom: "1rem" }}>
              <div className="db-head" style={{ marginBottom: ".6rem" }}>
                <div><h2>สิ่งที่ต้องกรอก · เดือน{thaiMonth(cm)}{d.rounds > 1 ? ` · รอบที่ ${rd}` : ""}</h2>
                  <p className="hint" style={{ margin: 0 }}>{st === "submitted" ? "ส่งรายงานแล้ว" : st === "draft" ? "บันทึกร่างไว้ ยังไม่ได้ส่ง" : "ยังไม่ได้เริ่มกรอก"} · กรอกแล้ว {done} จาก {all.length} รายการ · {pend ? `ค้างอีก ${pend} รายการ` : "ครบทุกรายการ"}</p>
                  <p className="hint late-note" style={{ margin: ".2rem 0 0" }}>กำหนดส่งภายใน {thaiDate(due)}{r?.submittedAt && <> · ส่งเมื่อ {thaiDateTime(r.submittedAt)} <span className={`pill ${r.late ? "no" : "ok"}`}>{r.late ? "ส่งช้า" : "ตรงเวลา"}</span></>}</p></div>
                <div className="db-filter"><div className="field"><label htmlFor="cm">เดือน</label><MonthPicker id="cm" value={cm} onChange={setCm} /></div>
                  <Link className="btn go" href={`/district/report?month=${cm}&round=${rd}`}>{pend ? "กรอกต่อ" : "ดู/แก้ไข"}</Link></div>
              </div>
              {d.rounds > 1 && <div className="rseg" role="group" aria-label="รอบรายงาน" style={{ marginBottom: ".8rem" }}>{settings.dueDays.map((dd, i) => (
                <button key={i} type="button" aria-pressed={rd === i + 1} onClick={() => setCr(i + 1)}>รอบที่ {i + 1} · ภายใน {thaiDate(dueDateOf(cm, dd))}{d.rec(cm, i + 1)?.status === "submitted" ? " ✓" : ""}</button>))}</div>}
              <div className="db-bar" style={{ marginBottom: "1rem" }}><i style={{ width: `${(done / all.length) * 100}%`, ["--c" as string]: pend ? "#e3a72f" : "#2f7d4f" }} /></div>
              {Array.from(new Set(FIELDS.map(f => f.group))).map(g => (
                <div key={g}><h3 className="db-sub">{g}</h3><div className="db-items">{vitems.filter(i => i.group === g).map(i => <Item key={i.key} label={i.label} val={i.val} unit />)}</div></div>))}
              <h3 className="db-sub">ผู้รายงาน</h3><div className="db-items">{ritems.map(i => <Item key={i.key} label={i.label} val={i.val} />)}</div>
              <p className="hint">ช่องที่ไม่มีผลผลิตให้กรอก 0 · ต้องกรอกครบทุกช่องและระบุผู้รายงานก่อนกดส่ง</p>
            </section>);
        })()}
        {(() => {
          if (!isAreaMonth(cm)) return (
            <section className="db-card" style={{ marginBottom: "1rem" }}>
              <h2>ข้อมูลพื้นที่และฟางข้าว</h2>
              <p className="hint" style={{ margin: 0 }}>เดือน{thaiMonth(cm)}ไม่อยู่ในช่วงรายงานพื้นที่ (รายงานเฉพาะเดือนพฤศจิกายน–มิถุนายน) จึงไม่ต้องกรอกในเดือนนี้</p>
            </section>);
          const rd = Math.min(cr, d.rounds), ar = area.find(x => x.month === cm && x.round === rd), st = ar?.status ?? "none";
          const done = AREA_FIELDS.filter(f => ar?.values[f.key] !== undefined).length, href = `/district/area?month=${cm}&round=${rd}`;
          return (
            <section className="db-card" style={{ marginBottom: "1rem" }}>
              <div className="db-head" style={{ marginBottom: ".6rem" }}>
                <div><h2>ข้อมูลพื้นที่และฟางข้าว · เดือน{thaiMonth(cm)}{d.rounds > 1 ? ` · รอบที่ ${rd}` : ""}</h2>
                  <p className="hint late-note" style={{ margin: 0 }}>{st === "submitted" ? "ส่งแล้ว" : st === "draft" ? "บันทึกร่างไว้ ยังไม่ได้ส่ง" : "ยังไม่ได้เริ่มกรอก"} · กรอกแล้ว {done} จาก {AREA_FIELDS.length} รายการ
                    {ar?.submittedAt && <> · ส่งเมื่อ {thaiDateTime(ar.submittedAt)} <span className={`pill ${ar.late ? "no" : "ok"}`}>{ar.late ? "ส่งช้า" : "ตรงเวลา"}</span></>}</p></div>
                <Link className="btn go" href={href}>{st === "submitted" ? "ดู/แก้ไข" : done ? "กรอกต่อ" : "กรอก"}</Link>
              </div>
              <div className="db-items">{AREA_FIELDS.map(f => { const v = ar?.values[f.key]; return (
                <Link key={f.key} href={href} className={`db-item ${v !== undefined ? "ok" : "no"}`}><i>{v !== undefined ? "✓" : "!"}</i><span>{f.label}</span><em>{v !== undefined ? `${f2(v)} ${f.unit}` : "ยังไม่ได้กรอก"}</em></Link>); })}</div>
            </section>);
        })()}
        <div className="db-kpis">
          <Kpi label="ผลผลิตรวมของอำเภอ" value={fmt(d.me.total)} unit="ตัน" tone="emerald" note={`เฉลี่ย ${fmt(d.me.sent ? d.me.total / d.me.sent : 0)} ตัน/เดือนที่ส่ง`} />
          <Kpi label={`เทียบเป้าหมาย ${fmt(d.me.target)} ตัน`} value={`${d.pct}%`} color="#f59e0b" tone="amber" pct={d.pct} note={d.me.target > d.me.total ? `ยังขาดอีก ${fmt(d.me.target - d.me.total)} ตัน` : "บรรลุเป้าหมายแล้ว"} />
          <Kpi label="เดือนที่ส่งรายงานแล้ว" value={`${d.me.sent} / ${d.agg.months.length}`} unit="เดือน" color="#2563eb" pct={(d.me.sent / d.agg.months.length) * 100}
            tone={d.me.sent < d.agg.months.length ? "rose" : "emerald"} note={`${d.me.sent < d.agg.months.length ? `ค้างส่ง ${d.agg.months.length - d.me.sent} เดือน` : "ส่งครบทุกเดือน"}${d.me.late ? ` · ส่งช้า ${d.me.late} ครั้ง` : ""}`} />
          <Kpi label="อันดับในจังหวัด" value={d.me.sent ? `ที่ ${d.rank}` : "–"} unit="จาก 22" tone="blue" note={`เฉลี่ยจังหวัด ${fmt(d.avg)} ตัน/อำเภอ`} />
        </div>
        <div className="db-grid">
          <section className="db-card"><h2>ผลผลิตรายเดือน (ตัน)</h2>
            <Trend data={d.agg.months.map(m => ({ label: thaiMonth(m), value: d.me.byMonth[m] ?? 0 }))} /></section>
          <section className="db-card"><h2>สัดส่วนตามชนิด</h2>
            <Donut parts={FIELDS.map((f, i) => ({ label: f.label, value: d.me.sums[f.key], color: COLORS[i] }))} /></section>
        </div>
        <div className="db-grid">
          <section className="db-card"><h2>เทียบกับอำเภออื่น (10 อันดับแรก)</h2>
            <RankRows rows={d.ranked.slice(0, 10).map(r => ({ name: r.name, value: r.total }))} highlight={district} />
            {d.rank > 10 && <p className="hint">อำเภอ{district} อยู่อันดับ {d.rank} ({fmt(d.me.total)} ตัน)</p>}</section>
          <section className="db-card"><h2>สถานะการส่งรายงานรายเดือน</h2>
            <div className="db-chips">{d.agg.months.map(m => { const s = d.mstat(m), g = d.me.got[m] ?? 0;
              return <Link key={m} href={`/district/report?month=${m}`} className={`db-chip ${s}`}>{thaiMonth(m)}{d.rounds > 1 && s === "warn" ? ` (${g}/${d.rounds})` : ""}{d.mlate(m) ? " · ส่งช้า" : ""}</Link>; })}</div>
            <p className="hint">ต้องส่ง {d.rounds} ครั้ง/เดือน · เขียว = ส่งครบ · เหลือง = ส่งบางรอบ/ร่าง · แดง = ยังไม่ส่ง · กดเพื่อกรอกหรือแก้ไข</p></section>
        </div>
        <h2 className="db-sec">พื้นที่และฟางข้าว · ฤดูกาล {thaiMonth(d.season.start)} – {thaiMonth(d.season.end)}</h2>
        <div className="db-kpis">
          <Kpi label="พื้นที่ปลูกพืชทั้งหมด" value={f2(d.ar.total)} unit="ไร่" tone="blue" note={d.ar.total > 0 ? "จังหวัดเป็นผู้กำหนด" : "จังหวัดยังไม่ได้กำหนด"} />
          <Kpi label={`เป้าหมายร้อยละ ${AREA_TARGET_PCT} ของพื้นที่`} value={f2(d.ar.target)} unit="ไร่" tone="amber" />
          <Kpi label="พื้นที่สะสมทั้งหมด" value={f2(d.ar.accum)} unit="ไร่" color="#059669" tone="emerald" pct={d.ar.pct} note={`คิดเป็น ${f2(d.ar.pct)}% ของพื้นที่ทั้งหมด · ${f2(d.ar.ofTarget)}% ของเป้าหมาย`} />
          <Kpi label="ปริมาณฟางข้าว" value={f2(d.ar.straw)} unit="ตัน" tone="emerald" note="ไร่สะสม × 500 กก. ÷ 1,000" />
          <Kpi label="คิดเป็นมูลค่า" value={f2(d.ar.value)} unit="บาท" tone="blue" note={d.ar.late ? `ส่งช้า ${d.ar.late} ครั้ง` : "ไร่สะสม × 725 บาท"} />
        </div>
        <section className="db-card"><h2>รายละเอียดรายเดือน · ปุ๋ยอินทรีย์และวัสดุอินทรีย์</h2>
          <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th>{FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>รวม (ตัน)</th><th></th></tr></thead>
            <tbody>{[...d.agg.months].reverse().flatMap(m => Array.from({ length: d.rounds }, (_, i) => i + 1).map(rd => { const r = d.rec(m, rd); const due = r?.dueDate ?? dueDateOf(m, settings.dueDays[rd - 1]); return (
              <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                {FIELDS.map(f => <td key={f.key}>{r ? fmt(r.values[f.key] ?? 0) : "–"}</td>)}<td><b>{r ? fmt(sumValues(r.values)) : "–"}</b></td>
                <td><Link className="btn alt" href={`/district/report?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
        <section className="db-card" style={{ marginTop: "1rem" }}><h2>รายละเอียดรายเดือน · พื้นที่และฟางข้าว</h2>
          <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th><th>พื้นที่เดือนนี้ (ไร่)</th><th>ฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th></th></tr></thead>
            <tbody>{[...d.arMonths].reverse().flatMap(m => Array.from({ length: d.rounds }, (_, i) => i + 1).map(rd => { const r = area.find(x => x.month === m && x.round === rd); const due = r?.dueDate ?? dueDateOf(m, settings.dueDays[rd - 1]); return (
              <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                <td>{r ? f2(r.values.area ?? 0) : "–"}</td><td>{r ? f2(strawTons(r.values.area ?? 0)) : "–"}</td><td>{r ? f2(strawValue(r.values.area ?? 0)) : "–"}</td>
                <td><Link className="btn alt" href={`/district/area?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
      </>}
    </div>
  );
}
