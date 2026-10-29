// แนวโน้มสะสมเทียบเป้าหมาย: เส้นจริง · เส้นเป้าตามสัดส่วนเดือน · เส้นคาดการณ์จากค่าเฉลี่ยรายเดือนล่าสุด
export interface TrendPoint { month: string; monthly: number | null; actual: number | null; pace: number; projected: number | null }
export type TrendStatus = "no-data" | "no-target" | "reached" | "on-track" | "behind";
export interface Trend {
  points: TrendPoint[]; target: number; total: number;
  lastIndex: number;        // ตำแหน่งเดือนล่าสุดที่มีข้อมูล (-1 = ยังไม่มี)
  avgMonthly: number;       // ค่าเฉลี่ยรายเดือนล่าสุดที่ใช้คาดการณ์
  projectedEnd: number;     // ยอดสะสมที่คาดว่าจะได้เมื่อสิ้นสุดช่วงรายงาน
  expectedNow: number;      // ยอดที่ควรได้ ณ เดือนล่าสุด หากทำเท่ากันทุกเดือน
  gap: number;              // ยอดจริง − ยอดที่ควรได้ (ติดลบ = ตามหลัง)
  status: TrendStatus;
  monthsLeft: number;
}

/**
 * months = เดือนทั้งหมดของช่วงรายงาน (เรียงจากเก่าไปใหม่) · monthly[m] = ยอดของเดือนนั้น (null/ไม่มี = ยังไม่มีข้อมูล)
 * recent = ใช้กี่เดือนล่าสุดหาค่าเฉลี่ยเพื่อคาดการณ์
 */
export function buildTrend(months: string[], monthly: Record<string, number | null | undefined>, target: number, recent = 3): Trend {
  const n = months.length;
  const vals = months.map(m => (typeof monthly[m] === "number" ? (monthly[m] as number) : null));
  let lastIndex = -1;
  vals.forEach((v, i) => { if (v !== null) lastIndex = i; });
  let run = 0;
  const actual = vals.map((v, i) => (i <= lastIndex ? (run += v ?? 0) : null));
  const total = lastIndex >= 0 ? (actual[lastIndex] as number) : 0;
  const win = lastIndex >= 0 ? vals.slice(Math.max(0, lastIndex - recent + 1), lastIndex + 1).map(v => v ?? 0) : [];
  const avgMonthly = win.length ? win.reduce((a, b) => a + b, 0) / win.length : 0;
  const monthsLeft = lastIndex >= 0 ? n - 1 - lastIndex : n;
  const projectedEnd = total + avgMonthly * monthsLeft;
  const points: TrendPoint[] = months.map((m, i) => ({
    month: m, monthly: vals[i], actual: actual[i],
    pace: n ? (target * (i + 1)) / n : 0,
    projected: lastIndex >= 0 && i >= lastIndex ? total + avgMonthly * (i - lastIndex) : null,
  }));
  const expectedNow = n && lastIndex >= 0 ? (target * (lastIndex + 1)) / n : 0;
  const status: TrendStatus = lastIndex < 0 ? "no-data" : target <= 0 ? "no-target" : total >= target ? "reached" : projectedEnd >= target ? "on-track" : "behind";
  return { points, target, total, lastIndex, avgMonthly, projectedEnd, expectedNow, gap: total - expectedNow, status, monthsLeft };
}

export const TREND_TEXT: Record<TrendStatus, string> = {
  "no-data": "ยังไม่มีข้อมูล", "no-target": "ยังไม่ได้ตั้งเป้าหมาย", reached: "บรรลุเป้าหมายแล้ว", "on-track": "เป็นไปตามแผน — คาดว่าจะถึงเป้า", behind: "ตามหลังแผน — ต้องเร่งดำเนินการ",
};
