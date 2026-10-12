"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FIELDS, currentMonth, thaiMonth, type Report } from "@/lib/data";
import { aggregate, fmt, sumValues } from "@/lib/summary";
import { COLORS, Donut, Kpi, RankRows, Trend } from "@/components/Charts";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";

export default function DistrictDashboard() {
  const { district } = useDistrict();
  const [reports, setReports] = useState<Report[] | null>(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [cm, setCm] = useState(""); // เดือนที่ใช้ตรวจรายการที่ต้องกรอก
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    fetch("/api/reports")
      .then(response => {
        if (!response.ok) throw new Error("โหลดรายงานไม่สำเร็จ");
        return response.json() as Promise<Report[]>;
      })
      .then(all => {
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
    const agg = aggregate(reports, from, to), me = agg.rows.find(r => r.name === district)!;
    const ranked = [...agg.rows].sort((a, b) => b.total - a.total), sentRows = agg.rows.filter(r => r.sent);
    const mine = reports.filter(r => r.district === district);
    return { agg, me, ranked, rank: ranked.findIndex(r => r.name === district) + 1, avg: sentRows.length ? sentRows.reduce((a, r) => a + r.total, 0) / sentRows.length : 0,
      status: (m: string) => mine.find(r => r.month === m)?.status ?? "none", rep: (m: string) => mine.find(r => r.month === m),
      pct: me.target ? Math.round((me.total / me.target) * 100) : 0 };
  }, [reports, valid, from, to, district]);
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
          const r = d.rep(cm), st = r?.status ?? "none";
          const vitems = FIELDS.map(f => ({ key: f.key, label: f.label, group: f.group, val: r?.values[f.key] }));
          const ritems = ([["name", "ชื่อ-สกุลผู้รายงาน"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => ({ key: k, label: l, val: r?.reporter[k] || undefined }));
          const all = [...vitems, ...ritems], done = all.filter(i => i.val !== undefined).length, pend = all.length - done;
          const Item = ({ label, val, unit }: { label: string; val?: number | string; unit?: boolean }) => (
            <Link href={`/district/report?month=${cm}`} className={`db-item ${val !== undefined ? "ok" : "no"}`}>
              <i>{val !== undefined ? "✓" : "!"}</i><span>{label}</span><em>{val !== undefined ? `${typeof val === "number" ? fmt(val) : val}${unit ? " ตัน" : ""}` : "ยังไม่ได้กรอก"}</em></Link>);
          return (
            <section className="db-card db-todo" style={{ marginBottom: "1rem" }}>
              <div className="db-head" style={{ marginBottom: ".6rem" }}>
                <div><h2>สิ่งที่ต้องกรอก · เดือน{thaiMonth(cm)}</h2>
                  <p className="hint" style={{ margin: 0 }}>{st === "submitted" ? "ส่งรายงานแล้ว" : st === "draft" ? "บันทึกร่างไว้ ยังไม่ได้ส่ง" : "ยังไม่ได้เริ่มกรอก"} · กรอกแล้ว {done} จาก {all.length} รายการ · {pend ? `ค้างอีก ${pend} รายการ` : "ครบทุกรายการ"}</p></div>
                <div className="db-filter"><div className="field"><label htmlFor="cm">เดือน</label><MonthPicker id="cm" value={cm} onChange={setCm} /></div>
                  <Link className="btn go" href={`/district/report?month=${cm}`}>{pend ? "กรอกต่อ" : "ดู/แก้ไข"}</Link></div>
              </div>
              <div className="db-bar" style={{ marginBottom: "1rem" }}><i style={{ width: `${(done / all.length) * 100}%`, ["--c" as string]: pend ? "#e3a72f" : "#2f7d4f" }} /></div>
              {Array.from(new Set(FIELDS.map(f => f.group))).map(g => (
                <div key={g}><h3 className="db-sub">{g}</h3><div className="db-items">{vitems.filter(i => i.group === g).map(i => <Item key={i.key} label={i.label} val={i.val} unit />)}</div></div>))}
              <h3 className="db-sub">ผู้รายงาน</h3><div className="db-items">{ritems.map(i => <Item key={i.key} label={i.label} val={i.val} />)}</div>
              <p className="hint">ช่องที่ไม่มีผลผลิตให้กรอก 0 · ต้องกรอกครบทุกช่องและระบุผู้รายงานก่อนกดส่ง</p>
            </section>);
        })()}
        <div className="db-kpis">
          <Kpi label="ผลผลิตรวมของอำเภอ" value={fmt(d.me.total)} unit="ตัน" tone="emerald" note={`เฉลี่ย ${fmt(d.me.sent ? d.me.total / d.me.sent : 0)} ตัน/เดือนที่ส่ง`} />
          <Kpi label={`เทียบเป้าหมาย ${fmt(d.me.target)} ตัน`} value={`${d.pct}%`} color="#f59e0b" tone="amber" pct={d.pct} note={d.me.target > d.me.total ? `ยังขาดอีก ${fmt(d.me.target - d.me.total)} ตัน` : "บรรลุเป้าหมายแล้ว"} />
          <Kpi label="เดือนที่ส่งรายงานแล้ว" value={`${d.me.sent} / ${d.agg.months.length}`} unit="เดือน" color="#2563eb" pct={(d.me.sent / d.agg.months.length) * 100}
            tone={d.me.sent < d.agg.months.length ? "rose" : "emerald"} note={d.me.sent < d.agg.months.length ? `ค้างส่ง ${d.agg.months.length - d.me.sent} เดือน` : "ส่งครบทุกเดือน"} />
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
            <div className="db-chips">{d.agg.months.map(m => { const s = d.status(m);
              return <Link key={m} href={`/district/report?month=${m}`} className={`db-chip ${s === "submitted" ? "ok" : "no"}`}>{thaiMonth(m)}{s === "draft" ? " (ร่าง)" : ""}</Link>; })}</div>
            <p className="hint">เขียว = ส่งแล้ว · แดง = ยังไม่ส่ง/ร่าง · กดเพื่อกรอกหรือแก้ไข</p></section>
        </div>
        <section className="db-card"><h2>รายละเอียดรายเดือน</h2>
          <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>สถานะ</th>{FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>รวม (ตัน)</th><th></th></tr></thead>
            <tbody>{[...d.agg.months].reverse().map(m => { const r = d.rep(m); return (
              <tr key={m}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td><span className={`pill ${r ? (r.status === "submitted" ? "ok" : "warn") : "no"}`}>{r ? (r.status === "submitted" ? "ส่งแล้ว" : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                {FIELDS.map(f => <td key={f.key}>{r ? fmt(r.values[f.key] ?? 0) : "–"}</td>)}<td><b>{r ? fmt(sumValues(r.values)) : "–"}</b></td>
                <td><Link className="btn alt" href={`/district/report?month=${m}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); })}</tbody></table></div></section>
      </>}
    </div>
  );
}
