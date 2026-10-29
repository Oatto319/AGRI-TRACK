"use client";
import { useState } from "react";
import { SISAKET_MAP } from "@/lib/geo/sisaket";

export interface MapDatum { name: string; /** ร้อยละที่ใช้ลงสี (null = ไม่มีข้อมูล/ยังไม่ตั้งเป้า) */ value: number | null; /** ข้อความตอนชี้/แตะ เช่น "42% ของเป้า · 120 ตัน" */ detail: string }

// ระดับสี: <25 · <50 · <75 · <100 · ≥100 (% ของเป้าหมาย)
const STEPS = [25, 50, 75, 100];
const COLORS = ["#e3f1e7", "#b9dcc4", "#7cbf94", "#3f9e65", "#1f6b3f"];
const NONE = "#eceee8";
const level = (v: number) => STEPS.findIndex(s => v < s) === -1 ? 4 : STEPS.findIndex(s => v < s);
export const LEGEND = ["< 25%", "25–49%", "50–74%", "75–99%", "≥ 100%"];

/** แผนที่ระดับอำเภอของจังหวัดศรีสะเกษ (SVG ไม่พึ่งบริการภายนอก) ลงสีตามร้อยละเทียบเป้า · เลื่อนเมาส์/แตะ/กด Tab เพื่อดูตัวเลข */
export default function DistrictMap({ data, caption }: { data: MapDatum[]; caption: string }) {
  const [active, setActive] = useState<string | null>(null);
  const by = new Map(data.map(d => [d.name, d]));
  const cur = active ? by.get(active) : undefined;
  return (
    <figure className="dm">
      <svg viewBox={`0 0 ${SISAKET_MAP.width} ${SISAKET_MAP.height}`} role="group" aria-label={caption} className="dm-svg">
        {Object.entries(SISAKET_MAP.districts).map(([name, g]) => {
          const d = by.get(name), fill = d?.value == null ? NONE : COLORS[level(d.value)], on = active === name;
          return (
            <path key={name} d={g.d} fill={fill} stroke={on ? "#1d261b" : "#fff"} strokeWidth={on ? 4 : 2} strokeLinejoin="round" className="dm-p"
              tabIndex={0} role="button" aria-label={`${name}: ${d?.detail ?? "ไม่มีข้อมูล"}`}
              onMouseEnter={() => setActive(name)} onFocus={() => setActive(name)} onClick={() => setActive(name)} onMouseLeave={() => setActive(null)} onBlur={() => setActive(null)} />);
        })}
        <g aria-hidden="true" className="dm-lb">
          {Object.entries(SISAKET_MAP.districts).map(([name, g]) => { const d = by.get(name), dark = d?.value != null && level(d.value) >= 3; return <text key={name} x={g.cx} y={g.cy} textAnchor="middle" fill={dark ? "#fff" : "#1d261b"}>{name}</text>; })}
        </g>
      </svg>
      <div className="dm-info" aria-live="polite">{cur ? <><b>อำเภอ{cur.name}</b> · {cur.detail}</> : <span>เลื่อนเมาส์หรือแตะที่อำเภอเพื่อดูตัวเลข</span>}</div>
      <ul className="dm-lg" aria-label="คำอธิบายสี">
        {COLORS.map((c, i) => <li key={c}><i style={{ background: c }} />{LEGEND[i]}</li>)}
        <li><i style={{ background: NONE }} />ไม่มีข้อมูล/ไม่ได้ตั้งเป้า</li>
      </ul>
    </figure>);
}
