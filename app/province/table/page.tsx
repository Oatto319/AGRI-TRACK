"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AREA_TARGET_PCT, FIELDS, thaiDate, thaiDateTime, thaiMonth } from "@/lib/data";
import { aggregateArea, fmt } from "@/lib/summary";
import { FilterBar, useProvince } from "@/components/Province";

const f2 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

export default function ProvinceTable() {
  const { reports, area, error, from, to, valid, agg, settings } = useProvince();
  const a = useMemo(() => (area && valid ? aggregateArea(area, to, settings.areaTotals) : null), [area, to, settings.areaTotals, valid]);
  const rows = agg?.rows ?? [];
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total), target = sum(r => r.target), sent = rows.filter(r => r.any).length;

  return (
    <div className="db">
      <div className="db-head">
        <div><h1>ตารางข้อมูลรายละเอียด</h1>
          <p className="sub" style={{ margin: 0 }}>{valid ? `${thaiMonth(from)} – ${thaiMonth(to)}` : ""} · <Link href="/province">← กลับหน้า Dashboard</Link></p></div>
        <FilterBar download />
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {!reports && !error && <p>กำลังโหลด…</p>}
      {reports && !valid && <p className="err">เลือกช่วงเดือนให้ถูกต้อง</p>}
      {agg && (
        <section className="db-card" style={{ padding: 0, overflow: "hidden" }}>
          <h2 style={{ padding: "1rem 1.2rem", margin: 0, background: "#f6f8fc", borderBottom: "1px solid var(--line)" }}>รายงานสรุปรายอำเภอ (ส่งแล้ว {sent} จาก {rows.length} อำเภอ)</h2>
          <div className="tw2" style={{ border: 0, borderRadius: 0 }}><table className="dt"><thead><tr>
            <th>ที่</th><th>อำเภอ</th><th>เกษตรตำบล</th><th>เป้าหมาย (ตัน)</th>
            {FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>รวม (ตัน)</th><th>% เป้าหมาย</th><th>เดือนที่ส่งครบ</th><th>ส่งช้า (ครั้ง)</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.name}><td>{i + 1}</td><td>{r.name}</td><td>{r.tambon}</td><td>{fmt(r.target)}</td>
                {FIELDS.map(f => <td key={f.key}>{fmt(r.sums[f.key])}</td>)}<td><b style={{ color: "var(--paddy)" }}>{fmt(r.total)}</b></td>
                <td>{r.target ? Math.round((r.total / r.target) * 100) : 0}%</td>
                <td><span className={`pill ${r.sent === agg.months.length ? "ok" : r.sent ? "warn" : "no"}`}>{r.sent}/{agg.months.length}</span></td><td>{r.late ? <span className="pill no">{r.late}</span> : "–"}</td></tr>))}</tbody>
            <tfoot><tr><td></td><td>รวม</td><td>{fmt(sum(r => r.tambon))}</td><td>{fmt(target)}</td>
              {FIELDS.map(f => <td key={f.key}>{fmt(sum(r => r.sums[f.key]))}</td>)}<td>{fmt(total)}</td>
              <td>{target ? Math.round((total / target) * 100) : 0}%</td><td></td><td>{sum(r => r.late)}</td></tr></tfoot>
          </table></div></section>)}

      {reports && valid && (() => {
        const log = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
        return (
          <section className="db-card" style={{ marginTop: "1rem" }}>
            <h2>บันทึกการส่งรายงาน ({log.length} รายการ · ส่งช้า {log.filter(r => r.late).length})</h2>
            <div className="tw2"><table className="dt plain"><thead><tr><th>อำเภอ</th><th>เดือน</th><th>รอบ</th><th>กำหนดส่ง</th><th>ส่งเมื่อ</th><th>สถานะ</th></tr></thead><tbody>
              {log.map(r => (<tr key={`${r.district}${r.month}${r.round}`}><td>{r.district}</td><td>{thaiMonth(r.month)}</td><td>{r.round}</td>
                <td>{r.dueDate ? thaiDate(r.dueDate) : "–"}</td><td>{r.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
                <td>{r.submittedAt ? <span className={`pill ${r.late ? "no" : "ok"}`}>{r.late ? "ส่งช้า" : "ตรงเวลา"}</span> : "ไม่มีบันทึกวันที่ส่ง"}</td></tr>))}
              {!log.length && <tr><td colSpan={6} style={{ textAlign: "center" }}>ยังไม่มีรายงานที่ส่งในช่วงนี้</td></tr>}
            </tbody></table></div></section>);
      })()}
      {a && (
        <section className="db-card" style={{ padding: 0, overflow: "hidden", marginTop: "1rem" }}>
          <h2 style={{ padding: "1rem 1.2rem", margin: 0, background: "#f6f8fc", borderBottom: "1px solid var(--line)" }}>พื้นที่และฟางข้าวรายอำเภอ · ฤดูกาล {thaiMonth(a.season.start)} – {thaiMonth(a.season.end)} (ส่งแล้ว {a.rows.filter(r => r.any).length} จาก {a.rows.length} อำเภอ)</h2>
          <div className="tw2" style={{ border: 0, borderRadius: 0 }}><table className="dt"><thead><tr>
            <th>ที่</th><th>อำเภอ</th><th>พื้นที่ปลูกพืชทั้งหมด (ไร่)</th><th>เป้าหมายร้อยละ {AREA_TARGET_PCT} (ไร่)</th><th>พื้นที่สะสมทั้งหมด (ไร่)</th><th>คิดเป็น (%)</th><th>ปริมาณฟางข้าว (ตัน)</th><th>มูลค่า (บาท)</th><th>รายงานล่าสุด</th><th>ส่งช้า (ครั้ง)</th></tr></thead>
            <tbody>{a.rows.map((r, i) => (
              <tr key={r.name}><td>{i + 1}</td><td>{r.name}</td><td>{f2(r.total)}</td><td>{f2(r.target)}</td><td>{f2(r.accum)}</td>
                <td><span className={`pill ${!r.any ? "no" : r.pct >= AREA_TARGET_PCT ? "ok" : "warn"}`}>{r.any ? `${f2(r.pct)}%` : "ยังไม่ส่ง"}</span></td>
                <td>{f2(r.straw)}</td><td>{f2(r.value)}</td><td>{r.lastMonth ? thaiMonth(r.lastMonth) : "–"}</td>
                <td>{r.late ? <span className="pill no">{r.late}</span> : "–"}</td></tr>))}</tbody>
            <tfoot><tr><td></td><td>รวม</td><td>{f2(a.sums.total)}</td><td>{f2(a.sums.target)}</td><td>{f2(a.sums.accum)}</td><td>{f2(a.pct)}%</td><td>{f2(a.sums.straw)}</td><td>{f2(a.sums.value)}</td><td></td><td>{a.sums.late}</td></tr></tfoot>
          </table></div>
          <p className="hint" style={{ padding: "0 1.2rem 1rem" }}>พื้นที่ปลูกพืชทั้งหมดจังหวัดเป็นผู้กำหนด (หน้า 3) · พื้นที่สะสม = ผลรวมที่อำเภอรายงานรายเดือนตั้งแต่ พ.ย. ถึง {thaiMonth(a.months[a.months.length - 1])} · ฟางข้าว = ไร่ × 500 กก. ÷ 1,000 · มูลค่า = ไร่ × 725 บาท · เขียว = ถึงเป้าร้อยละ {AREA_TARGET_PCT} ของพื้นที่แล้ว · เหลือง = ยังไม่ถึงเป้า · แดง = ยังไม่ส่ง</p>
        </section>)}
    </div>
  );
}
