"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AREA_FIELDS, AREA_TARGET_PCT, DEFAULT_SETTINGS, FIELDS, areaTotalsFor, currentMonth, dueDateOf, dueDaysFor, isAreaMonth, strawTons, strawValue, thaiDate, thaiDateTime, thaiMonth, type AreaReport, type Report, type Settings, type Topic } from "@/lib/data";
import { aggregate, aggregateArea, fmt, sumValues } from "@/lib/summary";
import { COLORS, Donut, Kpi, RankRows, Trend } from "@/components/Charts";
import { useDistrict } from "@/components/District";
import MonthPicker from "@/components/MonthPicker";
import { I, PageHead, StatusPill } from "@/components/Entry";
import { AreaCombo, AreaHBars, cumulate } from "@/components/ProvinceCharts";

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
  // จำนวนรอบ/วันกำหนดส่งแยกตามหัวข้อและปีงบประมาณของเดือนนั้น
  const nR = (t: Topic, m: string) => dueDaysFor(settings, t, m).length;
  const dueOf = (t: Topic, m: string, rd: number) => dueDateOf(m, dueDaysFor(settings, t, m)[rd - 1] ?? 31);
  const tabsN = cm ? Math.max(nR("fert", cm), nR("area", cm)) : 1;
  const d = useMemo(() => {
    if (!reports || !valid) return null;
    const rounds = dueDaysFor(settings, "fert", to).length;
    const agg = aggregate(reports, from, to, rounds), me = agg.rows.find(r => r.name === district)!;
    const ranked = [...agg.rows].sort((a, b) => b.total - a.total), sentRows = agg.rows.filter(r => r.any);
    const mine = reports.filter(r => r.district === district);
    const arAll = aggregateArea(area, to, areaTotalsFor(settings, to)), ar = arAll.rows.find(r => r.name === district)!;
    return { agg, me, ar, arRows: arAll.rows, season: arAll.season, arMonths: arAll.months, ranked, rounds, rank: ranked.findIndex(r => r.name === district) + 1, avg: sentRows.length ? sentRows.reduce((a, r) => a + r.total, 0) / sentRows.length : 0,
      rec: (m: string, rd: number) => mine.find(r => r.month === m && r.round === rd),
      mstat: (m: string) => { const g = me.got[m] ?? 0; return g >= dueDaysFor(settings, "fert", m).length ? "ok" : g > 0 || mine.some(r => r.month === m) ? "warn" : "no"; },
      mlate: (m: string) => mine.some(r => r.month === m && r.late),
      pct: me.target ? Math.round((me.total / me.target) * 100) : 0 };
  }, [reports, valid, from, to, district, settings, area]);
  return (
    <div className="db">
      <PageHead title={`สวัสดี อำเภอ${district}`} sub="เริ่มจากการ์ด “งานที่ต้องกรอก” ด้านล่าง กดปุ่มในการ์ดเพื่อไปกรอกได้ทันที" />
      {loadError && <p className="ux-toast bad" role="alert">{loadError}</p>}
      {!reports && <p className="ux-empty">กำลังโหลด…</p>}
      {d && <>
        <section aria-label="งานที่ต้องกรอก">
          <div className="ux-mfilter" style={{ marginBottom: ".9rem" }}>
            <div><span className="ux-lbl">งานที่ต้องกรอกของเดือน</span><MonthPicker id="cm" value={cm} onChange={setCm} /></div>
            {tabsN > 1 && <div className="ux-tabs" role="group" aria-label="รอบรายงาน">{Array.from({ length: tabsN }, (_, i) => i).map(i => (
              <button key={i} type="button" className="ux-tab" aria-pressed={Math.min(cr, tabsN) === i + 1} onClick={() => setCr(i + 1)}>
                <b>รอบที่ {i + 1} {d.rec(cm, i + 1)?.status === "submitted" && <span className="ok">✓</span>}</b><small>ส่งภายใน {thaiDate(dueOf(nR("fert", cm) > i ? "fert" : "area", cm, i + 1))}</small></button>))}</div>}
          </div>
          <div className="ux-tasks">
            {(() => {
              const rd = Math.min(cr, nR("fert", cm)), r = d.rec(cm, rd), st = r?.status ?? "none", due = dueOf("fert", cm, rd);
              const items = [...FIELDS.map(f => ({ label: f.label, val: r?.values[f.key] })), ...([["name", "ชื่อผู้รายงาน"], ["position", "ตำแหน่ง"], ["phone", "โทรศัพท์"]] as const).map(([k, l]) => ({ label: l, val: r?.reporter[k] || undefined }))];
              const done = items.filter(i => i.val !== undefined).length, miss = items.filter(i => i.val === undefined);
              return (
                <article className="ux-task" style={{ ["--tc" as string]: "#1d5f73" }}>
                  <header><i>{I.leaf}</i><div><h2>รายงานปุ๋ยอินทรีย์</h2><p>เดือน{thaiMonth(cm)}{nR("fert", cm) > 1 ? ` · รอบที่ ${rd}` : ""} · ส่งภายใน {thaiDate(due)}</p></div></header>
                  <div className="st"><StatusPill status={st === "none" ? undefined : st} late={r?.late} />กรอกแล้ว {done} จาก {items.length} ช่อง{r?.submittedAt && <> · ส่งเมื่อ {thaiDateTime(r.submittedAt)}</>}</div>
                  <div className="pg" aria-hidden="true"><i style={{ width: `${(done / items.length) * 100}%` }} /></div>
                  <p className="miss">{miss.length ? <>ยังไม่ได้กรอก: <b>{miss.slice(0, 4).map(m => m.label).join(", ")}{miss.length > 4 ? ` และอีก ${miss.length - 4} ช่อง` : ""}</b></> : "กรอกครบทุกช่องแล้ว"}</p>
                  <Link className={`ux-btn ${st === "submitted" ? "line" : ""}`} href={`/district/report?month=${cm}&round=${rd}`}>{st === "submitted" ? "ดู / แก้ไขรายงาน" : done ? "กรอกต่อ" : "เริ่มกรอกรายงานปุ๋ย"}</Link>
                </article>);
            })()}
            {(() => {
              if (!isAreaMonth(cm)) return (
                <article className="ux-task" style={{ ["--tc" as string]: "#94a3b8" }}>
                  <header><i>{I.sprout}</i><div><h2>พื้นที่ไถกลบฟางข้าว</h2><p>เดือน{thaiMonth(cm)}</p></div></header>
                  <p className="miss">เดือนนี้ไม่ต้องกรอก · รายงานพื้นที่เฉพาะเดือนพฤศจิกายนถึงมิถุนายน</p>
                </article>);
              const rd = Math.min(cr, nR("area", cm)), ar = area.find(x => x.month === cm && x.round === rd), st = ar?.status ?? "none", due = dueOf("area", cm, rd);
              const v = ar?.values.area, href = `/district/area?month=${cm}&round=${rd}`;
              return (
                <article className="ux-task" style={{ ["--tc" as string]: "#b08a2c" }}>
                  <header><i>{I.sprout}</i><div><h2>พื้นที่ไถกลบฟางข้าว</h2><p>เดือน{thaiMonth(cm)}{nR("area", cm) > 1 ? ` · รอบที่ ${rd}` : ""} · ส่งภายใน {thaiDate(due)}</p></div></header>
                  <div className="st"><StatusPill status={st === "none" ? undefined : st} late={ar?.late} />{v !== undefined ? <>กรอกแล้ว {f2(v)} ไร่</> : "ยังไม่ได้กรอกพื้นที่"}{ar?.submittedAt && <> · ส่งเมื่อ {thaiDateTime(ar.submittedAt)}</>}</div>
                  <div className="pg" aria-hidden="true"><i style={{ width: v !== undefined ? "100%" : "0%" }} /></div>
                  <p className="miss">{v !== undefined ? "กรอกพื้นที่แล้ว ส่วนฟางข้าวและมูลค่าระบบคำนวณให้" : <>ยังไม่ได้กรอก: <b>{AREA_FIELDS[0].label}</b></>}</p>
                  <Link className={`ux-btn gold ${st === "submitted" ? "line" : ""}`} href={href}>{st === "submitted" ? "ดู / แก้ไขข้อมูล" : v !== undefined ? "กรอกต่อ" : "เริ่มกรอกพื้นที่"}</Link>
                </article>);
            })()}
          </div>
        </section>

        <div className="ux-ph" style={{ marginTop: "1.6rem", marginBottom: ".8rem" }}>
          <div><h2 className="db-sec" style={{ margin: 0 }}>ผลงานของอำเภอ</h2><p className="ux-note">ปุ๋ยอินทรีย์และวัสดุอินทรีย์ · {valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""}</p></div>
          <div className="ux-mfilter">
            <div><span className="ux-lbl">ตั้งแต่เดือน</span><MonthPicker id="f" value={from} onChange={setFrom} /></div>
            <div><span className="ux-lbl">ถึงเดือน</span><MonthPicker id="t" value={to} onChange={setTo} /></div>
          </div>
        </div>
        {!valid && <p className="ux-toast bad">เลือกช่วงเดือนให้ถูกต้อง (เดือนเริ่มต้องไม่เกินเดือนสิ้นสุด)</p>}
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
              return <Link key={m} href={`/district/report?month=${m}`} className={`db-chip ${s}`}>{thaiMonth(m)}{nR("fert", m) > 1 && s === "warn" ? ` (${g}/${nR("fert", m)})` : ""}{d.mlate(m) ? " · ส่งช้า" : ""}</Link>; })}</div>
            <p className="hint">ต้องส่ง {d.rounds} ครั้ง/เดือน · เขียว = ส่งครบ · เหลือง = ส่งบางรอบ/ร่าง · แดง = ยังไม่ส่ง · กดเพื่อกรอกหรือแก้ไข</p></section>
        </div>
        <h2 className="db-sec">พื้นที่และฟางข้าว · ฤดูกาล {thaiMonth(d.season.start)} – {thaiMonth(d.season.end)}</h2>
        <div className="db-kpis">
          <Kpi label="พื้นที่ปลูกพืชทั้งหมด" value={f2(d.ar.total)} unit="ไร่" tone="blue" note={d.ar.assigned ? "จังหวัดเป็นผู้กำหนด" : "จังหวัดยังไม่ได้กำหนด · ใช้พื้นที่สะสมแทน"} />
          <Kpi label={`เป้าหมายร้อยละ ${AREA_TARGET_PCT} ของพื้นที่`} value={f2(d.ar.target)} unit="ไร่" tone="amber" />
          <Kpi label="พื้นที่สะสมทั้งหมด" value={f2(d.ar.accum)} unit="ไร่" color="#059669" tone="emerald" pct={d.ar.pct} note={`คิดเป็น ${f2(d.ar.pct)}% ของพื้นที่ทั้งหมด · ${f2(d.ar.ofTarget)}% ของเป้าหมาย`} />
          <Kpi label="ปริมาณฟางข้าว" value={f2(d.ar.straw)} unit="ตัน" tone="emerald" note="ไร่สะสม × 500 กก. ÷ 1,000" />
          <Kpi label="คิดเป็นมูลค่า" value={f2(d.ar.value)} unit="บาท" tone="blue" note={d.ar.late ? `ส่งช้า ${d.ar.late} ครั้ง` : "ไร่สะสม × 725 บาท"} />
        </div>
        <div className="db-grid">
          <section className="db-card"><h2>พื้นที่ไถกลบรายเดือนและพื้นที่สะสม</h2>
            <AreaCombo data={cumulate(d.arMonths, d.arMonths.map(m => d.ar.byMonth[m] ?? 0))} target={d.ar.target} />
            <p className="pv-lg"><span><i style={{ background: "#1f7a85" }} />พื้นที่รายเดือน (ไร่)</span><span><i className="ln" style={{ background: "#c09a3a" }} />พื้นที่สะสม (ไร่)</span><span><i className="ds" />เป้าหมายร้อยละ {AREA_TARGET_PCT}</span></p></section>
          <section className="db-card"><h2>เทียบพื้นที่สะสมกับอำเภออื่น (10 อันดับแรก)</h2>
            {(() => { const rk = [...d.arRows].sort((a, b) => b.accum - a.accum), top = rk.slice(0, 10), pos = rk.findIndex(r => r.name === district);
              const shown = pos >= 10 ? [...top.slice(0, 9), rk[pos]] : top;
              return <><AreaHBars rows={shown.filter(r => r.accum > 0 || r.name === district)} highlight={district} />
                <p className="hint">{pos >= 10 ? `อำเภอ${district} อยู่อันดับ ${pos + 1} · ` : ""}เส้นขีด = เป้าหมายร้อยละ {AREA_TARGET_PCT} ของแต่ละอำเภอ · เขียวน้ำเงิน = ถึงเป้าแล้ว · ทอง = ยังไม่ถึงเป้า</p></>; })()}</section>
        </div>
        <section className="db-card"><h2>รายละเอียดรายเดือน · ปุ๋ยอินทรีย์และวัสดุอินทรีย์</h2>
          <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th>{FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>รวม (ตัน)</th><th></th></tr></thead>
            <tbody>{[...d.agg.months].reverse().flatMap(m => Array.from({ length: nR("fert", m) }, (_, i) => i + 1).map(rd => { const r = d.rec(m, rd); const due = r?.dueDate ?? dueOf("fert", m, rd); return (
              <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                {FIELDS.map(f => <td key={f.key}>{r ? fmt(r.values[f.key] ?? 0) : "–"}</td>)}<td><b>{r ? fmt(sumValues(r.values)) : "–"}</b></td>
                <td><Link className="btn alt" href={`/district/report?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
        <section className="db-card" style={{ marginTop: "1rem" }}><h2>รายละเอียดรายเดือน · พื้นที่และฟางข้าว</h2>
          <div className="tw2"><table className="dt plain"><thead><tr><th>เดือน</th><th>รอบ</th><th>สถานะ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th><th>พื้นที่เดือนนี้ (ไร่)</th><th>ฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th></th></tr></thead>
            <tbody>{[...d.arMonths].reverse().flatMap(m => Array.from({ length: nR("area", m) }, (_, i) => i + 1).map(rd => { const r = area.find(x => x.month === m && x.round === rd); const due = r?.dueDate ?? dueOf("area", m, rd); return (
              <tr key={`${m}-${rd}`}><td style={{ textAlign: "left" }}>{thaiMonth(m)}</td><td>{rd}</td>
                <td><span className={`pill ${r ? (r.status === "submitted" ? (r.late ? "no" : "ok") : "warn") : "no"}`}>{r ? (r.status === "submitted" ? (r.late ? "ส่งช้า" : "ส่งแล้ว") : "ร่าง") : "ยังไม่ส่ง"}</span></td>
                <td>{thaiDate(due)}</td><td>{r?.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                <td>{r ? f2(r.values.area ?? 0) : "–"}</td><td>{r ? f2(strawTons(r.values.area ?? 0)) : "–"}</td><td>{r ? f2(strawValue(r.values.area ?? 0)) : "–"}</td>
                <td><Link className="btn alt" href={`/district/area?month=${m}&round=${rd}`}>{r ? "แก้ไข" : "กรอก"}</Link></td></tr>); }))}</tbody></table></div></section>
      </>}
    </div>
  );
}
