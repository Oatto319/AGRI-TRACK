import { fmt } from "@/lib/summary";

// สีของแต่ละชนิดในกราฟโดนัท (เรียงตาม FIELDS)
export const PV_COLORS = ["#2f7d4f", "#c19a36", "#8a5a2b", "#5aa469", "#b36a3c", "#7a8f3a", "#3b8e8c", "#d9b45a"]; // โทนเกษตร: เขียวนาข้าว ทองรวงข้าว น้ำตาลดิน

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

const niceStep = (max: number) => {
  if (max <= 0) return 1;
  const raw = max / 5, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};

/** กราฟแท่งรายเดือน: ไล่สี มีตัวเลขบนแท่ง เน้นเดือนที่สูงสุดด้วยสีทอง และมีเส้นค่าเฉลี่ย */
export function BarChart({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const W = 600, H = 250, L = 46, R = 10, T = 22, B = 28;
  const maxV = Math.max(0, ...data.map(d => d.value));
  if (maxV <= 0) return <p className="pv-empty">ยังไม่มีข้อมูลในช่วงนี้</p>;
  const step = niceStep(maxV), top = step * 5;
  const iw = W - L - R, ih = H - T - B, band = iw / Math.max(1, data.length), bw = Math.min(38, band * 0.62);
  const every = data.length > 18 ? 2 : 1, peak = data.findIndex(d => d.value === maxV);
  const withData = data.filter(d => d.value > 0), avg = withData.reduce((a, d) => a + d.value, 0) / Math.max(1, withData.length);
  const yAvg = T + ih - (avg / top) * ih;
  return (
    <svg className="pv-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ผลผลิตรายเดือน">
      <defs>
        <linearGradient id="pvBarG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#36945a" /><stop offset="1" stopColor="#1b4a2e" /></linearGradient>
        <linearGradient id="pvBarP" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e3bd55" /><stop offset="1" stopColor="#b08a2c" /></linearGradient>
      </defs>
      {Array.from({ length: 6 }, (_, i) => {
        const y = T + ih - (i / 5) * ih;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="#f2f4f0" strokeWidth="1" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#a4b09c">{(i * step).toLocaleString("th-TH")}</text>
          </g>);
      })}
      {data.map((d, i) => {
        const h = (d.value / top) * ih, x = L + band * i + (band - bw) / 2, y = T + ih - h;
        return (
          <g key={d.label + i}>
            {d.value > 0 && <>
              <path d={`M${x} ${T + ih}V${y + 6}Q${x} ${y} ${x + 6} ${y}H${x + bw - 6}Q${x + bw} ${y} ${x + bw} ${y + 6}V${T + ih}Z`} fill={i === peak ? "url(#pvBarP)" : "url(#pvBarG)"}>
                <title>{`${d.label}: ${fmt(d.value)} ${unit}`}</title></path>
              {data.length <= 14 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={i === peak ? "#94701c" : "#56614f"}>{fmt(d.value)}</text>}
            </>}
            {i % every === 0 && <text x={L + band * i + band / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="#76826d">{d.label}</text>}
          </g>);
      })}
      {withData.length > 1 && <g>
        <line x1={L} x2={W - R} y1={yAvg} y2={yAvg} stroke="#b36a3c" strokeWidth="1.4" strokeDasharray="5 4" />
        <text x={W - R} y={yAvg - 4} textAnchor="end" fontSize="10.5" fill="#b36a3c">{`เฉลี่ย ${fmt(avg)}`}</text>
      </g>}
    </svg>);
}

/** โดนัทสัดส่วนตามชนิด: ตัวเลขรวมกลางวง + คำอธิบายสีพร้อมปริมาณและร้อยละ */
export function TypeDonut({ parts, unit }: { parts: { label: string; value: number; color: string }[]; unit: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0), R = 54, L = 2 * Math.PI * R, gap = total > 0 && parts.filter(p => p.value > 0).length > 1 ? 2 : 0;
  let off = 0;
  return (
    <div className="pv-td">
      <svg viewBox="0 0 150 150" role="img" aria-label="สัดส่วนตามชนิด">
        <circle cx="75" cy="75" r={R} fill="none" stroke="#f2f4f0" strokeWidth="20" />
        {total > 0 && parts.map(p => {
          const len = (p.value / total) * L, seg = Math.max(0, len - gap);
          const el = len > 0 && (
            <circle key={p.label} cx="75" cy="75" r={R} fill="none" stroke={p.color} strokeWidth="20"
              strokeDasharray={`${seg} ${L - seg}`} strokeDashoffset={-off} transform="rotate(-90 75 75)">
              <title>{`${p.label} ${fmt(p.value)} ${unit} (${Math.round((p.value / total) * 100)}%)`}</title>
            </circle>);
          off += len;
          return el;
        })}
        <text x="75" y="72" textAnchor="middle" fontSize="19" fontWeight="700" fill="#1b2418">{total > 0 ? fmt(total) : "–"}</text>
        <text x="75" y="90" textAnchor="middle" fontSize="11" fill="#a4b09c">{unit}รวม</text>
      </svg>
      <ul>{parts.map(p => (
        <li key={p.label} className={p.value > 0 ? "" : "zero"}>
          <i style={{ background: p.color }} /><span>{p.label}</span>
          <b>{fmt(p.value)}</b><em>{total > 0 ? `${Math.round((p.value / total) * 100)}%` : "0%"}</em>
        </li>))}
      </ul>
    </div>);
}

/** อันดับอำเภอ: เหรียญ 3 อันดับแรก แท่งสัดส่วน และร้อยละของเป้าหมายอำเภอ */
export function RankBoard({ rows }: { rows: { name: string; value: number; pct: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ol className="pv-rb">{rows.map((r, i) => (
      <li key={r.name} className={i < 3 ? `m${i + 1}` : ""}>
        <span className="no">{i + 1}</span>
        <div className="bd">
          <div className="ln"><span>{r.name}</span><b>{fmt(r.value)} <small>ตัน</small></b></div>
          <div className="tk"><i style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <small>{r.pct > 0 ? `${Math.round(r.pct)}% ของเป้าหมาย` : "ยังไม่มีเป้าหมาย"}</small>
        </div>
      </li>))}
    </ol>);
}

const SHORT_M = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const monthShort = (ym: string) => SHORT_M[Number(ym.slice(5, 7)) - 1];
const nf = (v: number) => v.toLocaleString("th-TH", { maximumFractionDigits: 2 });

/** แปลงพื้นที่รายเดือนเป็นอนุกรมพร้อมค่าสะสม (ใช้กับ AreaCombo) */
export function cumulate(months: string[], monthly: number[]) {
  const out: { label: string; month: number; cum: number }[] = [];
  let cum = 0;
  months.forEach((m, i) => { cum += monthly[i] ?? 0; out.push({ label: monthShort(m), month: monthly[i] ?? 0, cum }); });
  return out;
}

/** กราฟผสมพื้นที่ไถกลบ: แท่ง = พื้นที่รายเดือน (แกนซ้าย) · เส้น = พื้นที่สะสม (แกนขวา) · เส้นประ = เป้าหมาย */
export function AreaCombo({ data, target }: { data: { label: string; month: number; cum: number }[]; target: number }) {
  const W = 620, H = 250, L = 54, R = 62, T = 14, B = 28;
  const stepL = niceStep(Math.max(0, ...data.map(d => d.month))), topL = stepL * 5;
  const stepR = niceStep(Math.max(0, target, ...data.map(d => d.cum))), topR = stepR * 5;
  const iw = W - L - R, ih = H - T - B, band = iw / Math.max(1, data.length), bw = Math.min(36, band * 0.55);
  const cx = (i: number) => L + band * i + band / 2, cy = (v: number) => T + ih - (v / topR) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${cx(i).toFixed(1)} ${cy(d.cum).toFixed(1)}`).join("");
  return (
    <svg className="pv-bars" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="พื้นที่ไถกลบรายเดือนและพื้นที่สะสม">
      {Array.from({ length: 6 }, (_, i) => {
        const y = T + ih - (i / 5) * ih;
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="#ebefe8" strokeWidth="1" />
            <text x={L - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#76826d">{(i * stepL).toLocaleString("th-TH")}</text>
            <text x={W - R + 8} y={y + 4} fontSize="11" fill="#94701c">{(i * stepR).toLocaleString("th-TH")}</text>
          </g>);
      })}
      {data.map((d, i) => {
        const h = (d.month / topL) * ih, x = cx(i) - bw / 2;
        return (
          <g key={d.label + i}>
            {d.month > 0 && <rect x={x} y={T + ih - h} width={bw} height={h} rx="3" fill="#297b48"><title>{`${d.label}: ${nf(d.month)} ไร่`}</title></rect>}
            <text x={cx(i)} y={H - 9} textAnchor="middle" fontSize="11" fill="#76826d">{d.label}</text>
          </g>);
      })}
      {target > 0 && <g>
        <line x1={L} x2={W - R} y1={cy(target)} y2={cy(target)} stroke="#b36a3c" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={L + 4} y={cy(target) - 5} fontSize="11" fill="#b36a3c">{`เป้าหมาย ${nf(target)} ไร่`}</text>
      </g>}
      {data.length > 0 && <path d={line} fill="none" stroke="#c09a3a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => <circle key={i} cx={cx(i)} cy={cy(d.cum)} r="4" fill="#fff" stroke="#c09a3a" strokeWidth="2.5"><title>{`สะสมถึง ${d.label}: ${nf(d.cum)} ไร่`}</title></circle>)}
    </svg>);
}

/** แท่งแนวนอนเทียบอำเภอ: ความยาว = พื้นที่สะสม · เส้นขีด = เป้าหมายของอำเภอ · เขียวน้ำเงิน = ถึงเป้าแล้ว · ทอง = ยังไม่ถึง */
export function AreaHBars({ rows, highlight }: { rows: { name: string; accum: number; target: number }[]; highlight?: string }) {
  const max = Math.max(1, ...rows.map(r => Math.max(r.accum, r.target)));
  return (
    <ul className="pv-hb">{rows.map(r => {
      const ok = r.target > 0 && r.accum >= r.target;
      return (
        <li key={r.name} className={r.name === highlight ? "me" : ""}>
          <span className="nm">{r.name}</span>
          <div className="tk" title={`${r.name}: สะสม ${nf(r.accum)} ไร่ · เป้าหมาย ${nf(r.target)} ไร่`}>
            <i style={{ width: `${(r.accum / max) * 100}%`, background: ok ? "#297b48" : "#c09a3a" }} />
            {r.target > 0 && <u style={{ left: `${(r.target / max) * 100}%` }} />}
          </div>
          <b>{nf(r.accum)}</b>
        </li>);
    })}</ul>);
}

/** แถบสัดส่วนสถานะ: ถึงเป้า / ยังไม่ถึงเป้า / ยังไม่มีข้อมูล */
export function StatusBar({ parts }: { parts: { label: string; value: number; color: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div className="pv-sb">
      <div className="bar" role="img" aria-label={parts.map(p => `${p.label} ${p.value}`).join(" · ")}>
        {total > 0 && parts.filter(p => p.value > 0).map(p => <i key={p.label} style={{ flex: p.value, background: p.color }} title={`${p.label} ${p.value}`} />)}
      </div>
      <p className="pv-key">{parts.map(p => <span key={p.label}><i style={{ background: p.color }} />{p.label} <b>{p.value}</b></span>)}</p>
    </div>);
}

/** เส้นแนวโน้มเล็ก ๆ ใต้รายการอันดับ */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="pv-spark-empty" aria-hidden="true" />;
  const W = 200, H = 52, max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - (v / max) * (H - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  return (
    <svg className="pv-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line}L${W} ${H}L0 ${H}Z`} fill="#297b48" opacity=".14" />
      <path d={line} fill="none" stroke="#297b48" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
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
