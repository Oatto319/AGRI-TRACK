import { areaTotalsFor, cfgOf, cfgOfMonth, dueDaysFor, fiscalRange, fiscalYearOf, type AreaReport, type BurnReport, type Report, type Settings } from "./data";
import { aggregate, aggregateArea, aggregateBurn } from "./summary";

// สรุปสำหรับหน้าสาธารณะ (ไม่ต้องล็อกอิน) — มีเฉพาะยอดรวมรายจังหวัด/รายอำเภอ
// ไม่มีชื่อผู้รายงาน เบอร์โทร สถานะส่งช้า/ยังไม่ส่ง หรือข้อมูลรายรอบ
const r1 = (v: number) => Math.round(v * 10) / 10;
const pctOf = (v: number, t: number) => (t > 0 ? r1((v / t) * 100) : 0);

export interface PublicSummary {
  fy: number; years: number[]; generatedAt: string;
  fert: { from: string; to: string; total: number; target: number; pct: number; months: string[]; monthly: Record<string, number | null>; parts: { label: string; value: number }[]; byDistrict: { name: string; total: number; target: number; pct: number }[] };
  area: { start: string; end: string; total: number; target: number; accum: number; pct: number; straw: number; value: number; months: string[]; monthly: Record<string, number | null>; byDistrict: { name: string; accum: number; target: number; pct: number; ofTarget: number }[] };
  burn: { from: string; to: string; items: { label: string; unit: string; value: number }[] };
}

export function latestFiscalYear(reports: { status: string; month: string }[], fallbackMonth: string): number {
  const ms = reports.filter(r => r.status === "submitted").map(r => r.month).sort();
  return fiscalYearOf(ms[ms.length - 1] ?? fallbackMonth);
}

export function buildPublicSummary(reports: Report[], area: AreaReport[], burn: BurnReport[], settings: Settings, fy: number, now = new Date()): PublicSummary {
  cfgOf(settings); // โหลดช่วงเดือนของปีงบประมาณที่จังหวัดตั้งไว้ก่อนคำนวณ
  const fr = fiscalRange(fy, "fert"), ar = fiscalRange(fy, "area"), br = fiscalRange(fy, "burn");
  const cfg = cfgOfMonth(settings, fr.to);

  const fert = aggregate(reports, fr.from, fr.to, dueDaysFor(settings, "fert", fr.to).length, cfg);
  const fertTotal = fert.rows.reduce((a, r) => a + r.total, 0), fertTarget = fert.rows.reduce((a, r) => a + r.target, 0);
  const fertMonthly: Record<string, number | null> = {};
  for (const m of fert.months) {
    const anyRow = fert.rows.some(r => r.byMonth[m] !== null);
    fertMonthly[m] = anyRow ? fert.rows.reduce((a, r) => a + (r.byMonth[m] ?? 0), 0) : null;
  }

  const acfg = cfgOfMonth(settings, ar.to);
  const ag = aggregateArea(area, ar.to, areaTotalsFor(settings, ar.to), acfg.area);
  const areaMonthly: Record<string, number | null> = {};
  for (const m of ag.months) { const v = ag.rows.reduce((a, r) => a + (r.byMonth[m] ?? 0), 0); areaMonthly[m] = v > 0 ? v : null; }

  const bcfg = cfgOfMonth(settings, br.to);
  const bg = aggregateBurn(burn, br.from, br.to, dueDaysFor(settings, "burn", br.to).length, bcfg);

  const years = Array.from(new Set([fy, ...reports.filter(r => r.status === "submitted").map(r => fiscalYearOf(r.month)), ...area.filter(r => r.status === "submitted").map(r => fiscalYearOf(r.month))])).sort((a, b) => b - a);
  return {
    fy, years, generatedAt: now.toISOString(),
    fert: { from: fr.from, to: fr.to, total: r1(fertTotal), target: r1(fertTarget), pct: pctOf(fertTotal, fertTarget), months: fert.months, monthly: fertMonthly,
      parts: cfg.fertFields.map(f => ({ label: f.label, value: r1(fert.rows.reduce((a, r) => a + (r.sums[f.key] ?? 0), 0)) })).filter(p => p.value > 0),
      byDistrict: fert.rows.map(r => ({ name: r.name, total: r1(r.total), target: r1(r.target), pct: pctOf(r.total, r.target) })) },
    area: { start: ag.season.start, end: ag.season.end, total: r1(ag.sums.total), target: r1(ag.sums.target), accum: r1(ag.sums.accum), pct: r1(ag.pct), straw: r1(ag.sums.straw), value: Math.round(ag.sums.value), months: ag.months, monthly: areaMonthly,
      byDistrict: ag.rows.map(r => ({ name: r.name, accum: r1(r.accum), target: r1(r.target), pct: r1(r.pct), ofTarget: r1(r.ofTarget) })) },
    burn: { from: br.from, to: br.to, items: bcfg.burnFields.map(f => ({ label: f.label, unit: f.unit, value: bg.sums[f.key] ?? 0 })) },
  };
}
