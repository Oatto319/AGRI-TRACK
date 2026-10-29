"use client";
import { TREND_TEXT, type Trend } from "@/lib/trend";

const W = 640, H = 270, L = 58, R = 16, T = 16, B = 40;
const nice = (v: number) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
const f0 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const f1 = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 1 });

/** กราฟแนวโน้มสะสม: เส้นเขียว = ยอดจริง · เส้นประทอง = ควรได้ตามแผน (เท่ากันทุกเดือน) · เส้นประส้ม = คาดการณ์จากค่าเฉลี่ยเดือนล่าสุด */
export default function TrendChart({ trend, unit, labelOf, title }: { trend: Trend; unit: string; labelOf: (ym: string) => string; title: string }) {
  const { points, target } = trend, n = points.length;
  const max = nice(Math.max(target, trend.projectedEnd, trend.total, 1) * 1.05);
  const x = (i: number) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1)), y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = (xs: { i: number; v: number }[]) => xs.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const actual = points.flatMap((p, i) => (p.actual === null ? [] : [{ i, v: p.actual }]));
  const proj = points.flatMap((p, i) => (p.projected === null ? [] : [{ i, v: p.projected }]));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max);
  const step = Math.ceil(n / 8);
  const pct = target > 0 ? (trend.projectedEnd / target) * 100 : 0;
  const tone = trend.status === "behind" ? "bad" : trend.status === "no-data" || trend.status === "no-target" ? "" : "ok";
  return (
    <div className="tc">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${TREND_TEXT[trend.status]} สะสม ${f1(trend.total)} ${unit} จากเป้า ${f1(target)} ${unit}`} className="tc-svg">
        {ticks.map(t => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e4e9dd" /><text x={L - 8} y={y(t) + 4} textAnchor="end" className="tc-ax">{f0(t)}</text></g>)}
        {points.map((p, i) => i % step === 0 || i === n - 1 ? <text key={p.month} x={x(i)} y={H - 16} textAnchor="middle" className="tc-ax">{labelOf(p.month)}</text> : null)}
        {target > 0 && <><line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="#b36a3c" strokeWidth="1.5" /><text x={W - R} y={y(target) - 6} textAnchor="end" className="tc-tg">เป้าหมาย {f0(target)} {unit}</text></>}
        {target > 0 && <path d={path(points.map((p, i) => ({ i, v: p.pace })))} fill="none" stroke="#c09a3a" strokeWidth="2" strokeDasharray="7 5" />}
        {proj.length > 1 && <path d={path(proj)} fill="none" stroke="#d9772b" strokeWidth="2.5" strokeDasharray="2 5" strokeLinecap="round" />}
        {actual.length > 0 && <path d={path(actual)} fill="none" stroke="#297b48" strokeWidth="3" strokeLinejoin="round" />}
        {actual.map(p => <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="4" fill="#fff" stroke="#297b48" strokeWidth="2.5"><title>{`${labelOf(points[p.i].month)}: สะสม ${f1(p.v)} ${unit}`}</title></circle>)}
      </svg>
      <p className="pv-lg tc-lg"><span><i style={{ background: "#297b48" }} />ยอดสะสมจริง</span><span><i className="ds" style={{ background: "#c09a3a" }} />ควรได้ตามแผน</span><span><i className="ds" style={{ background: "#d9772b" }} />คาดการณ์</span></p>
      <p className={`tc-sum ${tone}`} role="status">
        <b>{TREND_TEXT[trend.status]}</b>
        {trend.status !== "no-data" && <> · สะสม {f1(trend.total)} {unit}{target > 0 && <> · ตามแผนควรได้ {f1(trend.expectedNow)} ({trend.gap >= 0 ? "นำ" : "ตามหลัง"} {f1(Math.abs(trend.gap))})</>}
          {target > 0 && trend.status !== "reached" && trend.monthsLeft > 0 && <> · ถ้าทำได้เดือนละ ~{f1(trend.avgMonthly)} {unit} คาดว่าสิ้นสุดช่วงรายงานจะได้ {f1(trend.projectedEnd)} {unit} ({f0(pct)}% ของเป้า)</>}</>}
      </p>
    </div>);
}
