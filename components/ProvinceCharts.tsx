import { fmt } from "@/lib/summary";

// สีของแต่ละชนิดในกราฟโดนัท (เรียงตาม FIELDS)
export const PV_COLORS = ["#17324d", "#1f7a85", "#c09a3a", "#6f9fc4", "#8a9a4b", "#2f5f8f", "#b36a3c", "#7d8a99"];

/** วงแหวนเปอร์เซ็นต์ในการ์ด KPI (พื้นหลังสี) */
export function Ring({ pct, label }: { pct: number; label: string }) {
  const R = 28, L = 2 * Math.PI * R, p = Math.max(0, Math.min(100, pct));
  return (
    <svg className="pv-ring" viewBox="0 0 72 72" role="img" aria-label={label}>
      <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="7" />
      <circle cx="36" cy="36" r={R} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * L} ${L}`} transform="rotate(-90 36 36)" />
      <text x="36" y="41" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">{Math.round(pct)}%</text>
    </svg>);
}

/** โดนัทสัดส่วนตามชนิด + คำอธิบายสี (ไม่มีตัวเลขกลางวง ตามแบบ) */
export function PlainDonut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0), R = 52, L = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="pv-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="สัดส่วนตามชนิด">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef2f6" strokeWidth="26" />
        {total > 0 && parts.map(p => {
          const len = (p.value / total) * L;
          const el = (
            <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="26"
              strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)">
              <title>{`${p.label} ${fmt(p.value)} ตัน (${Math.round((p.value / total) * 100)}%)`}</title>
            </circle>);
          off += len;
          return el;
        })}
      </svg>
      <ul className="pv-leg">{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{p.label}</li>)}</ul>
    </div>);
}

const niceStep = (max: number) => {
  if (max <= 0) return 1;
  const raw = max / 5, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

/** กราฟแท่งรายเดือน มีเส้นกริดและแกนตัวเลขด้านซ้าย */
export function BarChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const W = 600, H = 230, L = 46, R = 8, T = 10, B = 28;
  const step = niceStep(Math.max(0, ...data.map(d => d.value))), top = step * 5;
  const iw = W - L - R, ih = H - T - B, band = iw / Math.max(1, data.length), bw = Math.min(34, band * 0.6);
  const every = data.length > 18 ? 2 : 1;
  return (
    <svg className="pv-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ผลผลิตรายเดือน">
      {Array.from({ length: 6 }, (_, i) => {
        const y = T + ih - (i / 5) * ih;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="#e6ebf1" strokeWidth="1" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{(i * step).toLocaleString("th-TH")}</text>
          </g>);
      })}
      {data.map((d, i) => {
        const h = (d.value / top) * ih, x = L + band * i + (band - bw) / 2;
        return (
          <g key={d.label + i}>
            {d.value > 0 && <path d={`M${x} ${T + ih}V${T + ih - h + 3}Q${x} ${T + ih - h} ${x + 3} ${T + ih - h}H${x + bw - 3}Q${x + bw} ${T + ih - h} ${x + bw} ${T + ih - h + 3}V${T + ih}Z`} fill="#1d5a78">
              <title>{`${d.label}: ${fmt(d.value)} ${unit}`}</title></path>}
            {i % every === 0 && <text x={L + band * i + band / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text>}
          </g>);
      })}
    </svg>);
}

/** เส้นแนวโน้มเล็ก ๆ ใต้รายการอันดับ */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="pv-spark-empty" aria-hidden="true" />;
  const W = 200, H = 52, max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - (v / max) * (H - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  return (
    <svg className="pv-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="#1f7a85" opacity=".14" />
      <path d={line} fill="none" stroke="#1f7a85" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>);
}

const ico = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
export const Icons = {
  field: <svg {...ico}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></svg>,
  target: <svg {...ico}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>,
  check: <svg {...ico}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></svg>,
  straw: <svg {...ico}><path d="M12 21V8M12 8c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4zM12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4z" /></svg>,
  arrow: <svg {...ico} width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};
