import { DISTRICTS, FIELDS, TARGET_PER_TAMBON, type FieldKey, type Report } from "./data";

export const fmt = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 1 });
export const sumValues = (v: Report["values"]) => FIELDS.reduce((a, f) => a + (v[f.key] ?? 0), 0);

export function monthsBetween(from: string, to: string) {
  const out: string[] = []; let [y, m] = from.split("-").map(Number); const [ey, em] = to.split("-").map(Number);
  while ((y < ey || (y === ey && m <= em)) && out.length < 36) { out.push(`${y}-${String(m).padStart(2, "0")}`); if (++m > 12) { m = 1; y++; } }
  return out;
}

// รวมเฉพาะรายงานที่ "ส่งแล้ว" ในช่วงเดือนที่เลือก — ใช้ทั้งหน้าจอและไฟล์ Excel
export function aggregate(reports: Report[], from: string, to: string) {
  const months = monthsBetween(from, to);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const rows = DISTRICTS.map(d => {
    const mine = sub.filter(r => r.district === d.name);
    const sums = Object.fromEntries(FIELDS.map(f => [f.key, mine.reduce((a, r) => a + (r.values[f.key] ?? 0), 0)])) as Record<FieldKey, number>;
    const byMonth: Record<string, number | null> = {};
    months.forEach(m => { const r = mine.find(x => x.month === m); byMonth[m] = r ? sumValues(r.values) : null; });
    return { name: d.name, tambon: d.tambon, target: d.tambon * TARGET_PER_TAMBON, sums, total: Object.values(sums).reduce((a, b) => a + b, 0), byMonth, sent: mine.length };
  });
  return { months, rows };
}
