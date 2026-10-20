import { DEFAULT_CONFIG, DEFAULT_AREA_CONST, DISTRICTS, areaPct, areaSeasonOf, areaTarget, baleValue, effectiveTotal, strawBales, strawTons, strawValue, type AppConfig, type AreaConst, type FieldDef, type AreaReport, type BurnKey, type BurnReport, type FieldKey, type Report } from "./data";

export const fmt = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 1 });
// รวมเฉพาะช่องที่ยังอยู่ในการตั้งค่า (ช่องที่จังหวัดลบออกแล้วไม่นับ)
export const sumValues = (v: Report["values"], fields: FieldDef[] = DEFAULT_CONFIG.fertFields) => fields.reduce((a, f) => a + (v[f.key] ?? 0), 0);

export function monthsBetween(from: string, to: string) {
  const out: string[] = []; let [y, m] = from.split("-").map(Number); const [ey, em] = to.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 36) { out.push(`${y}-${String(m).padStart(2, "0")}`); if (++m > 12) { m = 1; y++; } }
  return out;
}

// รวมเฉพาะรายงานที่ "ส่งแล้ว" ในช่วงเดือนที่เลือก (รวมทุกรอบของเดือน) — ใช้ทั้งหน้าจอและไฟล์ Excel
// rounds = จำนวนครั้งต่อเดือนที่จังหวัดกำหนด: got[m] = จำนวนรอบที่ส่งแล้ว, sent = จำนวนเดือนที่ส่งครบทุกรอบ
export function aggregate(reports: Report[], from: string, to: string, rounds = 1, cfg: AppConfig = DEFAULT_CONFIG) {
  const FIELDS = cfg.fertFields;
  const months = monthsBetween(from, to);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const rows = DISTRICTS.map(d => {
    const mine = sub.filter(r => r.district === d.name);
    const sums = Object.fromEntries(FIELDS.map(f => [f.key, mine.reduce((a, r) => a + (r.values[f.key] ?? 0), 0)])) as Record<FieldKey, number>;
    const byMonth: Record<string, number | null> = {}, got: Record<string, number> = {};
    months.forEach(m => {
      const rs = mine.filter(x => x.month === m);
      byMonth[m] = rs.length ? rs.reduce((a, r) => a + sumValues(r.values, FIELDS), 0) : null;
      got[m] = new Set(rs.filter(r => r.round <= rounds).map(r => r.round)).size;
    });
    return { name: d.name, tambon: d.tambon, target: d.tambon * cfg.targetPerTambon, sums, total: Object.values(sums).reduce((a, b) => a + b, 0),
      byMonth, got, sent: months.filter(m => got[m] >= rounds).length, any: mine.length, late: mine.filter(r => r.late).length };
  });
  return { months, rows, rounds };
}

// สรุปข้อมูลพื้นที่และฟางข้าวของ "ฤดูกาล" (พ.ย.–มิ.ย.) ที่เดือน `to` อยู่ (เฉพาะรายงานที่ส่งแล้ว)
// พื้นที่สะสม = ผลรวมไร่รายเดือนทุกรอบตั้งแต่ พ.ย. จนถึงเดือน `to` (ไม่เกิน มิ.ย.) · พื้นที่ปลูกทั้งหมดมาจากที่จังหวัดกำหนด
// ฟางข้าว = (ไร่สะสม × 500) ÷ 1000 ตัน · มูลค่า = ไร่สะสม × 725 บาท
// ฟางก้อน = ไร่สะสม × 25 ก้อน · ราคาฟางก้อน = จำนวนก้อน × 35 บาท
export function aggregateArea(reports: AreaReport[], to: string, totals: Record<string, number> = {}, k: AreaConst = DEFAULT_AREA_CONST) {
  const season = areaSeasonOf(to), last = to < season.end ? to : season.end;
  const months = monthsBetween(season.start, last);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= season.start && r.month <= last);
  const rows = DISTRICTS.map(d => {
    const mine = sub.filter(r => r.district === d.name).sort((a, b) => a.month.localeCompare(b.month) || a.round - b.round);
    const accum = mine.reduce((a, r) => a + (r.values.area ?? 0), 0), assigned = (totals[d.name] ?? 0) > 0, total = effectiveTotal(totals[d.name], accum), target = areaTarget(total, k);
    const byMonth: Record<string, number> = Object.fromEntries(months.map(m => [m, mine.filter(r => r.month === m).reduce((a, r) => a + (r.values.area ?? 0), 0)]));
    return { name: d.name, total, assigned, target, accum, pct: areaPct(accum, total), ofTarget: target > 0 ? (accum / target) * 100 : 0,
      straw: strawTons(accum, k), value: strawValue(accum, k), bales: strawBales(accum, k), baleValue: baleValue(accum, k), byMonth,
      any: mine.length, late: mine.filter(r => r.late).length, lastMonth: mine[mine.length - 1]?.month };
  });
  const s = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const sums = { total: s(r => r.total), assigned: rows.every(r => r.assigned), target: s(r => r.target), accum: s(r => r.accum), straw: s(r => r.straw), value: s(r => r.value), bales: s(r => r.bales), baleValue: s(r => r.baleValue), late: s(r => r.late) };
  return { rows, sums, season, months, pct: areaPct(sums.accum, sums.total), ofTarget: sums.target > 0 ? (sums.accum / sums.target) * 100 : 0 };
}

// สรุปงานสร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา ช่วงเดือน from–to (เฉพาะรายงานที่ส่งแล้ว รวมทุกรอบ)
// got[m] = จำนวนรอบที่ส่งแล้วของเดือน · sent = จำนวนเดือนที่ส่งครบทุกรอบ
export function aggregateBurn(reports: BurnReport[], from: string, to: string, rounds = 1, cfg: AppConfig = DEFAULT_CONFIG) {
  const BURN_FIELDS = cfg.burnFields;
  const months = monthsBetween(from, to);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const rows = DISTRICTS.map(d => {
    const mine = sub.filter(r => r.district === d.name);
    const sums = Object.fromEntries(BURN_FIELDS.map(f => [f.key, mine.reduce((a, r) => a + (r.values[f.key] ?? 0), 0)])) as Record<BurnKey, number>;
    const got: Record<string, number> = {};
    months.forEach(m => { got[m] = new Set(mine.filter(x => x.month === m && x.round <= rounds).map(x => x.round)).size; });
    return { name: d.name, sums, got, sent: months.filter(m => got[m] >= rounds).length, any: mine.length, late: mine.filter(r => r.late).length };
  });
  const sums = Object.fromEntries(BURN_FIELDS.map(f => [f.key, rows.reduce((a, r) => a + r.sums[f.key], 0)])) as Record<BurnKey, number>;
  return { months, rows, sums, rounds, late: rows.reduce((a, r) => a + r.late, 0) };
}
