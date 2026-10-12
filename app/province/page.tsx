"use client";
import Link from "next/link";
import { FIELDS, thaiMonth } from "@/lib/data";
import { fmt } from "@/lib/summary";
import { COLORS, Donut, Kpi, RankRows, Trend } from "@/components/Charts";
import { FilterBar, useProvince } from "@/components/Province";

export default function ProvinceDashboard() {
  const { reports, error, from, to, valid, agg, settings } = useProvince();
  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total), target = sum(r => r.target), sent = rows.filter(r => r.any).length;
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;

  return (
    <div className="db">
      <div className="db-head">
        <div><h1>Dashboard ปุ๋ยอินทรีย์และวัสดุอินทรีย์</h1>
          <p className="sub" style={{ margin: 0 }}>สรุปจากรายงานที่อำเภอส่งแล้ว (ไม่รวมร่าง) · {valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""}</p></div>
        <FilterBar />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {!reports && !error && <p>กำลังโหลด…</p>}
      {reports && !valid && <p className="err">เลือกช่วงเดือนให้ถูกต้อง</p>}
      {agg && <>
        <div className="db-kpis">
          <Kpi label="อำเภอที่ส่งรายงานแล้ว" value={`${sent} / ${rows.length}`} unit="อำเภอ" color="#2563eb" pct={(sent / rows.length) * 100} tone="blue" note={`ส่งแล้ว ${Math.round((sent / rows.length) * 100)}% · ส่งช้า ${sum(r => r.late)} ครั้ง`} />
          <Kpi label="ผลรวมทั้งจังหวัด" value={fmt(total)} unit="ตัน" tone="emerald" note={`เฉลี่ย ${fmt(sent ? total / sent : 0)} ตัน/อำเภอที่ส่ง`} />
          <Kpi label={`เทียบเป้าหมาย ${fmt(target)} ตัน`} value={`${pct}%`} color="#f59e0b" tone="amber" pct={pct} note={target > total ? `ยังขาดอีก ${fmt(target - total)} ตัน` : "บรรลุเป้าหมายแล้ว"} />
          <Kpi label="อำเภอที่ยังไม่ส่ง" value={String(rows.length - sent)} unit="อำเภอ" tone="rose" note={rows.length - sent ? "รอดำเนินการ" : "ส่งครบทุกอำเภอ"} />
        </div>
        <div className="db-grid">
          <section className="db-card"><h2>10 อันดับอำเภอผลผลิตสูงสุด</h2>
            {total === 0 ? <p className="hint">ยังไม่มีข้อมูลในช่วงนี้</p>
              : <RankRows rows={[...rows].sort((a, b) => b.total - a.total).slice(0, 10).map(r => ({ name: r.name, value: r.total }))} />}</section>
          <section className="db-card"><h2>สัดส่วนตามชนิด</h2>
            <Donut parts={FIELDS.map((f, i) => ({ label: f.label, value: sum(r => r.sums[f.key]), color: COLORS[i] }))} /></section>
        </div>
        <div className="db-grid">
          <section className="db-card"><h2>ผลผลิตรายเดือน (ตัน)</h2>
            <Trend data={agg.months.map(m => ({ label: thaiMonth(m), value: sum(r => r.byMonth[m] ?? 0) }))} /></section>
          <section className="db-card"><h2>สถานะการส่งเดือน{thaiMonth(to)}</h2>
            <div className="db-chips">{rows.map(r => { const g = r.got[to] ?? 0; return (
              <span key={r.name} className={`db-chip ${g >= agg.rounds ? "ok" : g > 0 ? "warn" : "no"}`}>{r.name}{g > 0 && g < agg.rounds ? ` (${g}/${agg.rounds})` : ""}</span>); })}</div>
            <p className="hint">ต้องส่ง {settings.dueDays.length} ครั้ง/เดือน · เขียว = ส่งครบ · เหลือง = ส่งบางรอบ · แดง = ยังไม่ส่ง</p></section>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Link className="btn go" href="/province/table">ดูตารางข้อมูลรายละเอียดทั้งหมด (หน้าที่ 2) →</Link></div>
      </>}
    </div>
  );
}
