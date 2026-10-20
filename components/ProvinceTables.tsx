"use client";
import { lb, thaiDate, thaiDateTime, thaiMonth, thaiMonthShort, type AppConfig, type Report } from "@/lib/data";
import { fmt, type aggregate, type aggregateArea, type aggregateBurn } from "@/lib/summary";
import { f2 } from "@/components/Entry";

const f2fix = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Agg = ReturnType<typeof aggregate>;
type AreaAgg = ReturnType<typeof aggregateArea>;
type BurnAgg = ReturnType<typeof aggregateBurn>;

const Bar = ({ pct, color }: { pct: number; color?: string }) => (
  <div className="ux-bar"><i><u style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></i><span>{Math.round(pct)}%</span></div>);

export function KpiRow({ items }: { items: { icon: React.ReactNode; color: string; label: string; value: string; unit?: string }[] }) {
  return (
    <div className="ux-kpis">{items.map(k => (
      <div className="ux-kpi" key={k.label} style={{ ["--kc" as string]: k.color }}><i>{k.icon}</i>
        <div><small>{k.label}</small><b>{k.value}{k.unit && <span> {k.unit}</span>}</b></div></div>))}</div>);
}

/** ตารางปุ๋ยอินทรีย์รายอำเภอ */
export function FertTable({ agg, cfg }: { agg: Agg; cfg: AppConfig }) {
  const FIELDS = cfg.fertFields;
  const rows = agg.rows, sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const total = sum(r => r.total), target = sum(r => r.target), n = agg.months.length;
  return (
    <div className="ux-tw"><table className="ux-table"><thead><tr>
      <th className="sticky">{lb(cfg, "t.district")}</th><th>{lb(cfg, "t.tambon")}</th><th>{lb(cfg, "t.target")}</th>
      {FIELDS.map(f => <th key={f.key}>{f.label}</th>)}<th>{lb(cfg, "t.total")}</th><th>{lb(cfg, "t.reach")}</th><th>{lb(cfg, "t.sent")}</th><th>{lb(cfg, "t.late")}</th></tr></thead>
      <tbody>{rows.map(r => {
        const pct = r.target ? (r.total / r.target) * 100 : 0;
        return (
          <tr key={r.name}><td className="sticky">{r.name}</td><td>{r.tambon}</td><td>{fmt(r.target)}</td>
            {FIELDS.map(f => <td key={f.key}>{fmt(r.sums[f.key])}</td>)}
            <td><b>{fmt(r.total)}</b></td>
            <td><Bar pct={pct} color={pct >= 100 ? "var(--ok)" : "#c09a3a"} /></td>
            <td><span className={`ux-pill ${r.sent === n && n > 0 ? "ok" : r.sent ? "warn" : "bad"}`}>{r.sent}/{n}</span></td>
            <td>{r.late ? <span className="ux-pill bad">{r.late}</span> : "–"}</td></tr>);
      })}</tbody>
      <tfoot><tr><td className="sticky" style={{ background: "#eaf3f6" }}>{lb(cfg, "t.sumRow")}</td><td>{fmt(sum(r => r.tambon))}</td><td>{fmt(target)}</td>
        {FIELDS.map(f => <td key={f.key}>{fmt(sum(r => r.sums[f.key]))}</td>)}<td>{fmt(total)}</td>
        <td>{target ? Math.round((total / target) * 100) : 0}%</td><td></td><td>{sum(r => r.late)}</td></tr></tfoot></table></div>);
}

/** ตารางพื้นที่และฟางข้าวรายอำเภอ */
export function AreaTable({ a, cfg }: { a: AreaAgg; cfg: AppConfig }) {
  return (
    <div className="ux-tw"><table className="ux-table"><thead><tr>
      <th className="sticky">{lb(cfg, "t.district")}</th><th>{lb(cfg, "a.total")}</th><th>{lb(cfg, "a.target", { pct: cfg.area.targetPct })}</th>{a.months.map(m => <th key={m}>{lb(cfg, "a.month", { m: thaiMonthShort(m) })}</th>)}<th>{lb(cfg, "a.accum")}</th><th>{lb(cfg, "a.pct")}</th><th>{lb(cfg, "a.straw")}</th><th>{lb(cfg, "a.value")}</th><th>{lb(cfg, "a.bales")}</th><th>{lb(cfg, "a.baleValue")}</th><th>{lb(cfg, "a.last")}</th><th>{lb(cfg, "t.late")}</th></tr></thead>
      <tbody>{a.rows.map(r => (
        <tr key={r.name}><td className="sticky">{r.name}</td><td>{f2(r.total)}</td><td>{f2(r.target)}</td>{a.months.map(m => <td key={m}>{r.byMonth[m] ? f2fix(r.byMonth[m]) : "–"}</td>)}<td><b>{f2(r.accum)}</b></td>
          <td>{r.any ? (!r.assigned ? <span className="ux-pill warn">ยังไม่กำหนดพื้นที่ปลูก</span> : <Bar pct={r.pct} color={r.accum >= r.total ? "var(--ok)" : "#c09a3a"} />) : <span className="ux-pill bad">ยังไม่ส่ง</span>}</td>
          <td>{f2(r.straw)}</td><td>{f2(r.value)}</td><td>{f2(r.bales)}</td><td>{f2(r.baleValue)}</td><td>{r.lastMonth ? thaiMonth(r.lastMonth) : "–"}</td>
          <td>{r.late ? <span className="ux-pill bad">{r.late}</span> : "–"}</td></tr>))}</tbody>
      <tfoot><tr><td className="sticky" style={{ background: "#eaf3f6" }}>{lb(cfg, "t.sumRow")}</td><td>{f2(a.sums.total)}</td><td>{f2(a.sums.target)}</td>{a.months.map(m => <td key={m}>{f2fix(a.rows.reduce((x, r) => x + (r.byMonth[m] ?? 0), 0))}</td>)}<td>{f2(a.sums.accum)}</td><td>{f2(a.pct)}%</td><td>{f2(a.sums.straw)}</td><td>{f2(a.sums.value)}</td><td>{f2(a.sums.bales)}</td><td>{f2(a.sums.baleValue)}</td><td></td><td>{a.sums.late}</td></tr></tfoot></table></div>);
}

/** ตารางสร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผารายอำเภอ */
export function BurnTable({ b, cfg }: { b: BurnAgg; cfg: AppConfig }) {
  const n = b.months.length, BURN_FIELDS = cfg.burnFields;
  return (
    <div className="ux-tw"><table className="ux-table"><thead><tr>
      <th className="sticky">{lb(cfg, "t.district")}</th>{BURN_FIELDS.map(f => <th key={f.key}>{f.label} ({f.unit})</th>)}<th>{lb(cfg, "b.sent")}</th><th>{lb(cfg, "b.late")}</th></tr></thead>
      <tbody>{b.rows.map(r => (
        <tr key={r.name}><td className="sticky">{r.name}</td>{BURN_FIELDS.map(f => <td key={f.key}>{r.any ? f2(r.sums[f.key]) : "–"}</td>)}
          <td><span className={`ux-pill ${r.sent === n && n > 0 ? "ok" : r.sent ? "warn" : "bad"}`}>{r.sent}/{n}</span></td>
          <td>{r.late ? <span className="ux-pill bad">{r.late}</span> : "–"}</td></tr>))}</tbody>
      <tfoot><tr><td className="sticky" style={{ background: "#eaf3f6" }}>{lb(cfg, "t.sumRow")}</td>{BURN_FIELDS.map(f => <td key={f.key}>{f2(b.sums[f.key])}</td>)}<td></td><td>{b.late}</td></tr></tfoot></table></div>);
}

/** บันทึกการส่งรายงานปุ๋ย (ใครส่งเมื่อไร ตรงเวลาหรือไม่) */
export function SubmitLog({ reports, from, to, cfg }: { reports: Report[]; from: string; to: string; cfg: AppConfig }) {
  const log = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  return (
    <div className="ux-tw"><table className="ux-table"><thead><tr><th className="sticky">{lb(cfg, "t.district")}</th><th className="l">{lb(cfg, "l.month")}</th><th>{lb(cfg, "l.round")}</th><th>{lb(cfg, "l.due")}</th><th>{lb(cfg, "l.sentAt")}</th><th>{lb(cfg, "l.status")}</th></tr></thead>
      <tbody>{log.map(r => (
        <tr key={`${r.district}${r.month}${r.round}`}><td className="sticky">{r.district}</td><td className="l">{thaiMonth(r.month)}</td><td>{r.round}</td>
          <td>{r.dueDate ? thaiDate(r.dueDate) : "–"}</td><td>{r.submittedAt ? thaiDateTime(r.submittedAt) : "–"}</td>
          <td>{r.submittedAt ? <span className={`ux-pill ${r.late ? "bad" : "ok"}`}>{r.late ? "ส่งช้า" : "ตรงเวลา"}</span> : "ไม่มีบันทึก"}</td></tr>))}
        {!log.length && <tr><td colSpan={6} className="ux-empty">ยังไม่มีรายงานที่ส่งในช่วงนี้</td></tr>}</tbody></table></div>);
}
