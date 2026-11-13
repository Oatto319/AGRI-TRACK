"use client";
import { fmt } from "@/lib/summary";

/** การ์ดเปรียบเทียบย้อนหลัง 3 ปีงบประมาณ: แท่ง 3 แท่ง (ปีล่าสุดเข้มสุด) + ข้อความเทียบปีก่อนเป็นภาษาไทย */
export default function ThreeYearCompare({ title, unit, data }: { title: string; unit: string; data: { label: string; value: number }[] }) {
  const W = 320, H = 170, L = 12, R = 12, T = 26, B = 28, n = data.length;
  const max = Math.max(...data.map(d => d.value), 1);
  const slot = (W - L - R) / n, bw = Math.min(54, slot * 0.58);
  const fills = ["#a7c4b8", "#34d399", "#047857"];
  const cur = data[n - 1]?.value ?? 0, prev = data[n - 2]?.value ?? 0;
  const change = prev > 0 ? ((cur - prev) / prev) * 100 : null;
  const note = change === null ? "ไม่มีข้อมูลปีก่อนเทียบ" : change > 0 ? `เพิ่มขึ้น ${change.toFixed(1)}% จากปีก่อน` : change < 0 ? `ลดลง ${Math.abs(change).toFixed(1)}% จากปีก่อน` : "เท่ากับปีก่อน";
  return (
    <section className="pv-card">
      <h2>{title}</h2>
      <p className="pv-note">หน่วย: {unit} · {note}</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${data.map(d => `${d.label} ${fmt(d.value)} ${unit}`).join(" · ")}`} style={{ width: "100%", height: "auto", display: "block" }}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#d5dcd0" strokeWidth="1" />
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, (d.value / max) * (H - B - T)) : 2.5, x = L + slot * i + (slot - bw) / 2, last = i === n - 1;
          return (
            <g key={d.label}>
              <rect x={x} y={H - B - h} width={bw} height={h} rx="4" fill={fills[Math.min(i + (3 - n), 2)]} />
              <text x={x + bw / 2} y={H - B - h - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill={last ? "#047857" : "#334155"}>{fmt(d.value)}</text>
              <text x={x + bw / 2} y={H - 9} textAnchor="middle" fontSize="12" fontWeight={last ? 700 : 400} fill={last ? "#0f172a" : "#64748b"}>{d.label}</text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}