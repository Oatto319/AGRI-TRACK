import type { CSSProperties } from "react";
import { fmt } from "@/lib/summary";

export const COLORS = ["#2f7d4f", "#6aa84f", "#e3a72f", "#3b8e8c", "#8a5a2b", "#b97d10", "#7a5ea8", "#c0504d"];

const TONES = { emerald: "#059669", amber: "#d97706", rose: "#e11d48", blue: "#39d776" };
export function Kpi({ label, value, unit, color, pct, tone, note }: { label: string; value: string; unit?: string; color?: string; pct?: number; tone?: keyof typeof TONES; note?: string }) {
  const style = { ...(color ? { "--c": color } : {}), ...(tone ? { "--vc": TONES[tone] } : {}) } as CSSProperties;
  return (
    <div className="db-kpi" style={style}>
      <small>{label}</small><b>{value}{unit && <span> {unit}</span>}</b>
      {pct !== undefined && <div className="db-bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>}
      {note && <em>{note}</em>}
    </div>);
}

export function Donut({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0), R = 52, L = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="db-donut">
      <svg viewBox="0 0 140 140" width="170" height="170" role="img" aria-label="สัดส่วนตามชนิด">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#f2f5f0" strokeWidth="22" />
        {total > 0 && parts.map(p => { const len = (p.value / total) * L, el = (
          <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="22"
            strokeDasharray={`${len} ${L - len}`} strokeDashoffset={-off} transform="rotate(-90 70 70)" />); off += len; return el; })}
        <text x="70" y="68" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1d261b">{fmt(total)}</text>
        <text x="70" y="86" textAnchor="middle" fontSize="10" fill="#687360">ตัน</text>
      </svg>
      <ul className="db-leg">{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{p.label}
        <span>{total ? Math.round((p.value / total) * 100) : 0}%</span></li>)}</ul>
    </div>);
}

export function RankRows({ rows, highlight }: { rows: { name: string; value: number }[]; highlight?: string }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="db-rank">{rows.map(r => (
      <span key={r.name} style={{ display: "contents", fontWeight: r.name === highlight ? 700 : 400 }}>
        <span>{r.name}</span>
        <div className="t"><i style={{ width: `${(r.value / max) * 100}%`, ...(r.name === highlight ? { background: "linear-gradient(90deg,#10b981,#059669)" } : {}) }} /></div>
        <em>{fmt(r.value)}</em></span>))}</div>);
}

export function Trend({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="db-trend">{data.map(d => (
      <div key={d.label}><b>{d.value ? fmt(d.value) : "–"}</b><i style={{ height: `${(d.value / max) * 78}%` }} /><span>{d.label.replace(" ", "\u00A0")}</span></div>))}</div>);
}
