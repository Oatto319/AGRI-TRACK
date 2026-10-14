"use client";
import { useMemo } from "react";
import { AREA_TARGET_PCT, thaiMonth } from "@/lib/data";
import { aggregateArea } from "@/lib/summary";
import { Kpi } from "@/components/Charts";
import { FilterBar, useProvince } from "@/components/Province";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function ProvinceArea() {
  const { area, error, from, to, valid, settings } = useProvince();
  const a = useMemo(() => (area && valid ? aggregateArea(area, to, settings.areaTotals) : null), [area, to, settings.areaTotals, valid]);

  return (
    <div className="db">
      <div className="db-head">
        <div><h1>พื้นที่และฟางข้าว</h1>
          <p className="sub" style={{ margin: 0 }}>{valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""} · พื้นที่ใช้ค่าจากรายงานล่าสุดในช่วง ส่วนฟางข้าวและมูลค่ารวมทุกรายงานในช่วง</p></div>
        <FilterBar download />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {!area && !error && <p>กำลังโหลด…</p>}
      {area && !valid && <p className="err">เลือกช่วงเดือนให้ถูกต้อง</p>}
      {a && <>
        <div className="db-kpis">
          <Kpi label="พื้นที่ปลูกพืชทั้งหมด" value={f2(a.sums.total)} unit="ไร่" tone="blue" />
          <Kpi label={`เป้าหมายร้อยละ ${AREA_TARGET_PCT} ของพื้นที่`} value={f2(a.sums.target)} unit="ไร่" tone="amber" />
          <Kpi label="พื้นที่สะสมทั้งหมด" value={f2(a.sums.accum)} unit="ไร่" color="#059669" tone="emerald" pct={a.pct} note={`คิดเป็น ${f2(a.pct)}% ของพื้นที่ทั้งหมด · ${f2(a.ofTarget)}% ของเป้าหมาย`} />
          <Kpi label="ปริมาณฟางข้าว" value={f2(a.sums.straw)} unit="ตัน" tone="emerald" />
          <Kpi label="คิดเป็นมูลค่า" value={f2(a.sums.value)} unit="บาท" tone="blue" />
        </div>
        <section className="db-card" style={{ padding: 0, overflow: "hidden" }}>
          <h2 style={{ padding: "1rem 1.2rem", margin: 0, background: "#f6f8fc", borderBottom: "1px solid var(--line)" }}>รายอำเภอ (ส่งแล้ว {a.rows.filter(r => r.any).length} จาก {a.rows.length} อำเภอ)</h2>
          <div className="tw2" style={{ border: 0, borderRadius: 0 }}><table className="dt"><thead><tr>
            <th>ที่</th><th>อำเภอ</th><th>พื้นที่ปลูกพืชทั้งหมด (ไร่)</th><th>เป้าหมายร้อยละ {AREA_TARGET_PCT} (ไร่)</th><th>พื้นที่สะสมทั้งหมด (ไร่)</th><th>คิดเป็น (%)</th><th>ปริมาณฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th>ข้อมูลล่าสุด</th><th>ส่งช้า (ครั้ง)</th></tr></thead>
            <tbody>{a.rows.map((r, i) => (
              <tr key={r.name}><td>{i + 1}</td><td>{r.name}</td><td>{f2(r.total)}</td><td>{f2(r.target)}</td><td>{f2(r.accum)}</td>
                <td><span className={`pill ${!r.any ? "no" : r.pct >= AREA_TARGET_PCT ? "ok" : "warn"}`}>{r.any ? `${f2(r.pct)}%` : "ยังไม่ส่ง"}</span></td>
                <td>{f2(r.straw)}</td><td>{f2(r.value)}</td><td>{r.lastMonth ? thaiMonth(r.lastMonth) : "–"}</td>
                <td>{r.late ? <span className="pill no">{r.late}</span> : "–"}</td></tr>))}</tbody>
            <tfoot><tr><td></td><td>รวม</td><td>{f2(a.sums.total)}</td><td>{f2(a.sums.target)}</td><td>{f2(a.sums.accum)}</td><td>{f2(a.pct)}%</td><td>{f2(a.sums.straw)}</td><td>{f2(a.sums.value)}</td><td></td><td>{a.sums.late}</td></tr></tfoot>
          </table></div></section>
        <p className="hint">สีเขียว = พื้นที่สะสมถึงเป้าหมายร้อยละ {AREA_TARGET_PCT} ของพื้นที่แล้ว · เหลือง = ยังไม่ถึงเป้า · แดง = ยังไม่ส่ง</p>
      </>}
    </div>
  );
}
