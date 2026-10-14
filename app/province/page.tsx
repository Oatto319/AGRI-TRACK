"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AREA_TARGET_PCT, FIELDS, thaiMonth } from "@/lib/data";
import { aggregateArea, fmt } from "@/lib/summary";
import { BarChart, Icons, PV_COLORS, PlainDonut, Ring, Sparkline } from "@/components/ProvinceCharts";
import { FilterBar, useProvince } from "@/components/Province";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// ป้ายเดือนบนกราฟ: ถ้าช่วงที่เลือกข้ามปี ให้ต่อท้ายด้วย พ.ศ. 2 หลัก
const monthLabel = (ym: string, multiYear: boolean) => {
  const [y, m] = ym.split("-").map(Number);
  return multiYear ? `${SHORT[m - 1]} ${(y + 543) % 100}` : SHORT[m - 1];
};

export default function ProvinceDashboard() {
  const { reports, area, error, from, to, valid, agg, settings } = useProvince();

  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total);
  const target = sum(r => r.target);
  const sent = rows.filter(r => r.any).length;
  const late = sum(r => r.late);
  const pct = target ? Math.min(100, Math.round((total / target) * 100)) : 0;

  const ar = useMemo(() => (area && valid ? aggregateArea(area, to, settings.areaTotals) : null), [area, to, settings.areaTotals, valid]);
  const areaRingPct = ar ? Math.min(100, ar.pct) : 0;

  const multiYear = valid && from.slice(0, 4) !== to.slice(0, 4);
  const monthly = (agg?.months ?? []).map(m => ({ label: monthLabel(m, multiYear), value: sum(r => r.byMonth[m] ?? 0) }));
  const top10 = [...rows].filter(r => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 10);
  const yearTxt = valid ? (multiYear ? `${Number(from.slice(0, 4)) + 543}–${Number(to.slice(0, 4)) + 543}` : `${Number(to.slice(0, 4)) + 543}`) : "";
  const rounds = agg?.rounds ?? 1;

  const areaRows = ar ? [
    { icon: Icons.field, color: "#1f7a85", label: "พื้นที่ปลูกพืชทั้งหมด", value: `${f2(ar.sums.total)} ไร่`, bar: ar.sums.total > 0 ? 100 : 0, sub: ar.sums.total > 0 ? "จังหวัดเป็นผู้กำหนด" : "ยังไม่ได้กำหนด · ตั้งค่าได้ที่หน้า 3" },
    { icon: Icons.target, color: "#c09a3a", label: `เป้าหมายร้อยละ ${AREA_TARGET_PCT}`, value: `${f2(ar.sums.target)} ไร่`, bar: ar.sums.total > 0 ? AREA_TARGET_PCT : 0 },
    { icon: Icons.check, color: "#2f8f5b", label: "พื้นที่สะสมทั้งหมด", value: `${f2(ar.sums.accum)} ไร่`, bar: Math.min(100, ar.pct), sub: `คิดเป็น ${f2(ar.pct)}% ของพื้นที่ปลูกพืชทั้งหมด` },
    { icon: Icons.straw, color: "#b36a3c", label: "ปริมาณฟางข้าว", value: `${f2(ar.sums.straw)} ตัน`, sub: `คิดเป็นมูลค่า ${f2(ar.sums.value)} บาท` },
  ] : [];

  return (
    <div className="pv">
      <div className="pv-head">
        <h1>แดชบอร์ดข้อมูลจังหวัด</h1>
        <FilterBar />
      </div>

      {error && <p className="msg bad" role="alert">{error}</p>}
      {!reports && !area && !error && <p className="pv-load">กำลังโหลดข้อมูล...</p>}
      {((reports && !valid) || (area && !valid)) && <p className="msg bad" role="alert">เลือกช่วงเดือนให้ถูกต้อง</p>}

      {agg && (
        <>
          {/* การ์ดตัวเลขสำคัญ 4 ใบ */}
          <section className="pv-kpis" aria-label="ตัวเลขสำคัญ">
            <div className="pv-kpi navy">
              <small>ปุ๋ยอินทรีย์ทั้งหมด</small>
              <b>{fmt(total)} <span>ตัน</span></b>
              <em>เป้าหมาย {fmt(target)} ตัน</em>
            </div>
            <div className="pv-kpi teal">
              <small>อำเภอที่ส่งรายงานแล้ว</small>
              <b>{sent} <span>/ {rows.length} อำเภอ</span></b>
              <em>{late ? `ส่งช้า ${late} ครั้ง` : "ไม่มีรายการส่งช้า"}</em>
            </div>
            <div className="pv-kpi green">
              <div><small>บรรลุเป้าหมายปุ๋ย</small><em>{target > total ? `ขาดอีก ${fmt(target - total)} ตัน` : "บรรลุเป้าหมายแล้ว"}</em></div>
              <Ring pct={pct} label={`บรรลุเป้าหมายปุ๋ย ${pct} เปอร์เซ็นต์`} />
            </div>
            <div className="pv-kpi gold">
              <div><small>พื้นที่สะสมต่อพื้นที่ทั้งหมด</small><em>{ar ? `${f2(ar.sums.accum)} ไร่` : "–"}</em></div>
              <Ring pct={areaRingPct} label={`พื้นที่สะสม ${Math.round(areaRingPct)} เปอร์เซ็นต์`} />
            </div>
          </section>

          {/* 10 อันดับ + โดนัท + กราฟแท่ง */}
          <div className="pv-main">
            <section className="pv-card pv-rank">
              <h2>10 อันดับอำเภอผลผลิตสูงสุด</h2>
              <p className="pv-note">ใช้ข้อมูลปุ๋ยอินทรีย์สะสมในช่วงที่เลือก</p>
              {top10.length === 0 ? <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p> : (
                <ol>{top10.map((r, i) => (
                  <li key={r.name}><span className="n">{i + 1}.</span><span className="nm">{r.name}</span><b>{fmt(r.total)} ตัน</b></li>))}
                </ol>)}
              <div className="pv-spark-wrap">
                <Sparkline values={monthly.map(m => m.value)} />
                <small>ยอดรวม {yearTxt}</small>
              </div>
            </section>

            <div className="pv-col">
              <section className="pv-card">
                <h2>สัดส่วนตามชนิด</h2>
                <PlainDonut parts={FIELDS.map((f, i) => ({ label: f.label, value: sum(r => r.sums[f.key]), color: PV_COLORS[i] }))} />
              </section>
              <section className="pv-card">
                <h2>ผลผลิตรายเดือน</h2>
                <BarChart data={monthly} unit="ตัน" />
              </section>
            </div>
          </div>

          {/* พื้นที่และฟางข้าว + สถานะการส่งข้อมูล */}
          <div className="pv-bottom">
            <section className="pv-card">
              <h2>พื้นที่และฟางข้าว</h2>
              {ar && <p className="pv-note">ฤดูกาล {thaiMonth(ar.season.start)} – {thaiMonth(ar.season.end)} · สะสมถึง {thaiMonth(ar.months[ar.months.length - 1])}</p>}
              <ul className="pv-area">{areaRows.map(a => (
                <li key={a.label}>
                  <span className="ic" style={{ background: a.color }}>{a.icon}</span>
                  <div className="tx">
                    <div className="ln"><span>{a.label}</span><b>{a.value}</b></div>
                    {a.bar !== undefined && <div className="tk" aria-hidden="true"><i style={{ width: `${a.bar}%`, background: a.color }} /></div>}
                    {a.sub && <small>{a.sub}</small>}
                  </div>
                </li>))}
              </ul>
            </section>

            <section className="pv-card">
              <h2>สถานะการส่งข้อมูล</h2>
              <ul className="pv-chips">{rows.map(r => {
                const g = r.got[to] ?? 0, st = g >= rounds ? "ok" : g > 0 ? "part" : "no";
                const txt = st === "ok" ? "ส่งครบ" : st === "part" ? `ส่งแล้ว ${g}/${rounds} รอบ` : "ยังไม่ส่ง";
                return <li key={r.name} className={st} title={`${r.name}: ${txt}`}>{r.name}{st === "part" ? ` (${g}/${rounds})` : ""}</li>;
              })}</ul>
              <p className="pv-key"><i className="ok" />ส่งครบ <i className="part" />ส่งบางรอบ <i className="no" />ยังไม่ส่ง</p>
            </section>
          </div>

          <div className="pv-foot">
            <Link className="pv-go" href="/province/table">ดูตารางข้อมูลรายละเอียดทั้งหมด (หน้าที่ 2) {Icons.arrow}</Link>
          </div>
        </>
      )}
    </div>
  );
}
