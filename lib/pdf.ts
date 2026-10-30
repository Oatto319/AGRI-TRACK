import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { areaTotalsFor, cfgOf, bkkDate, dueDaysFor, fiscalRange, thaiDate, type AreaReport, type BurnReport, type Report, type Settings } from "./data";
import { aggregate, aggregateArea, aggregateBurn, monthsBetween, sumValues } from "./summary";

/**
 * สร้างรายงาน PDF "รายงานสรุป ประจำปีงบประมาณ" (เปรียบเทียบย้อนหลัง 3 ปีงบประมาณ) (สรุปในหน้า A4 หน้าเดียว)
 * หัวรายงาน → การ์ด KPI → กราฟปุ๋ยอินทรีย์ 3 ปี + กราฟพื้นที่ไถกลบรายเดือน 3 ปี (เคียงข้างกัน) → ตารางสรุปเปรียบเทียบ 3 ปี + YoY
 * → การประชาสัมพันธ์เรื่องการหยุดเผา (จำนวนครั้งของปีงบประมาณนี้ เทียบ 3 ปี + จำนวนอำเภอที่จัดกิจกรรม)
 * ใช้เฉพาะรายงานที่ "ส่งแล้ว" เหมือนหน้า Dashboard และไฟล์ Excel
 */

// ---------- ข้อมูลรายปีงบประมาณ ----------
// หมวดสำหรับกราฟเปรียบเทียบ (รวมปุ๋ยพืชสดทุกชนิดเป็นหมวดเดียว)
const CATS = [
  { label: "ปุ๋ยคอก", keys: ["manure"] },
  { label: "ปุ๋ยหมัก", keys: ["compost"] },
  { label: "ปุ๋ยพืชสด", keys: ["crotalaria", "cowpea", "jackbean", "mungbean", "othergm"] },
  { label: "วัตถุดิบน้ำหมัก", keys: ["biomass"] },
] as const;

export interface YearStat {
  fy: number; from: string; to: string;
  sent: number; districts: number; total: number; target: number; pct: number; reached: number;
  cats: number[]; quarters: number[];
  area: { accum: number; total: number; target: number; pct: number; ofTarget: number; straw: number; value: number; bales: number; baleValue: number; reachedD: number; sentD: number; assigned: boolean };
  areaMonthly: number[]; topArea: { name: string; accum: number } | null;
  burn: { activities: number; sentD: number; noActivity: string[] };
  late: number; submitted: number; onTimePct: number | null;
  lagging: { name: string; pct: number }[]; notSent: string[]; lateByDistrict: { name: string; n: number }[]; areaLow: { name: string; pct: number }[];
}

export function yearStat(reports: Report[], area: AreaReport[], settings: Settings, fy: number, burn: BurnReport[] = []): YearStat {
  const { from, to } = fiscalRange(fy);
  const cfg = cfgOf(settings, fy), agg = aggregate(reports, from, to, dueDaysFor(settings, "fert", to).length, cfg);
  const ar = aggregateArea(area, to, areaTotalsFor(settings, to), cfg.area);
  const rows = agg.rows;
  const brg = fiscalRange(fy, "burn"), bAgg = aggregateBurn(burn, brg.from, brg.to, dueDaysFor(settings, "burn", brg.to).length, cfg);
  const bs = (k: string) => (bAgg.sums as Record<string, number>)[k] ?? 0; // ช่องหยุดเผาจังหวัดเพิ่ม/ลบเองได้ ช่องที่ไม่มีนับเป็น 0
  const total = rows.reduce((a, r) => a + r.total, 0), target = rows.reduce((a, r) => a + r.target, 0);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const subA = area.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const late = rows.reduce((a, r) => a + r.late, 0) + ar.sums.late;
  const submitted = sub.length + subA.length;
  const byMonth = new Map<string, number>();
  sub.forEach(r => byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + sumValues(r.values, cfg.fertFields)));
  const months = monthsBetween(from, to);
  const quarters = [0, 1, 2, 3].map(q => months.slice(q * 2, q * 2 + 2).reduce((a, m) => a + (byMonth.get(m) ?? 0), 0));
  const pctOf = (r: (typeof rows)[number]) => (r.target ? (r.total / r.target) * 100 : 0);
  return {
    fy, from, to, sent: rows.filter(r => r.any).length, districts: rows.length, total, target, pct: target ? (total / target) * 100 : 0,
    reached: rows.filter(r => r.target > 0 && r.total >= r.target).length,
    cats: CATS.map(c => rows.reduce((a, r) => a + c.keys.reduce((s, k) => s + (r.sums[k as keyof typeof r.sums] ?? 0), 0), 0)), quarters,
    area: { accum: ar.sums.accum, total: ar.sums.total, target: ar.sums.target, pct: ar.pct, ofTarget: ar.ofTarget, straw: ar.sums.straw, value: ar.sums.value, bales: ar.sums.bales, baleValue: ar.sums.baleValue,
      reachedD: ar.rows.filter(r => r.target > 0 && r.accum >= r.target).length, sentD: ar.rows.filter(r => r.any).length, assigned: ar.sums.assigned },
    areaMonthly: ar.months.map(m => ar.rows.reduce((x, r) => x + (r.byMonth[m] ?? 0), 0)),
    topArea: [...ar.rows].sort((x, y) => y.accum - x.accum).filter(r => r.accum > 0).map(r => ({ name: r.name, accum: r.accum }))[0] ?? null,
    burn: { activities: bs("activities"), sentD: bAgg.rows.filter(r => r.any).length,
      noActivity: bAgg.rows.filter(r => ((r.sums as Record<string, number>).activities ?? 0) <= 0).map(r => r.name) },
    late, submitted, onTimePct: submitted ? ((submitted - late) / submitted) * 100 : null,
    lagging: [...rows].filter(r => r.target > 0 && r.total < r.target).sort((a, b) => pctOf(a) - pctOf(b)).slice(0, 3).map(r => ({ name: r.name, pct: pctOf(r) })),
    notSent: rows.filter(r => !r.any).map(r => r.name),
    lateByDistrict: [...rows.map(r => ({ name: r.name, n: r.late })), ...ar.rows.map(r => ({ name: r.name, n: r.late }))]
      .reduce<{ name: string; n: number }[]>((acc, x) => { const e = acc.find(y => y.name === x.name); if (e) e.n += x.n; else acc.push({ ...x }); return acc; }, [])
      .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3),
    areaLow: ar.rows.filter(r => r.target > 0 && r.accum < r.target).sort((a, b) => a.ofTarget - b.ofTarget).slice(0, 3).map(r => ({ name: r.name, pct: r.ofTarget })),
  };
}


const listTh = (xs: string[], max = 4) => `${xs.slice(0, max).join(" · ")}${xs.length > max ? ` และอีก ${xs.length - max} อำเภอ` : ""}`;

// ---------- ตัวช่วยจัดรูปแบบ ----------
const n1 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const yoy = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const sgn = (v: number | null, d = 1) => (v === null ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);

const C = {
  ink: "#0f172a", mute: "#64748b", soft: "#94a3b8", line: "#e2e8f0", rule: "#eef2f7", bg: "#f8fafc", dark: "#064e3b", green: "#059669", mint: "#10b981",
  blue: "#3b82f6", orange: "#f59e0b", purple: "#8b5cf6", red: "#e11d48", gray: "#94a3b8", recBg: "#f0fdf4", recLine: "#bbf7d0",
};
type Tone = "good" | "warn" | "bad" | "none";
const TONE: Record<Tone, { bg: string; fg: string }> = { good: { bg: "#dcfce7", fg: "#15803d" }, warn: { bg: "#fef3c7", fg: "#b45309" }, bad: { bg: "#ffe4e6", fg: "#be123c" }, none: { bg: "#f1f5f9", fg: "#64748b" } };
const W = 595.28, H = 841.89, M = 34, CW = W - 2 * M;

// ---------- ตัวสร้างเอกสาร ----------
export async function buildPdf(reports: Report[], area: AreaReport[], settings: Settings, fy: number, burn: BurnReport[] = []): Promise<Buffer> {
  const cfg = cfgOf(settings, fy), K = cfg.area;
  const years = [fy - 2, fy - 1, fy].map(y => yearStat(reports, area, settings, y, burn));
  const [a, b, c] = years;
  const fdir = path.join(process.cwd(), "assets", "fonts");
  const reg = fs.readFileSync(path.join(fdir, "Sarabun-Regular.ttf")), bold = fs.readFileSync(path.join(fdir, "Sarabun-Bold.ttf"));
  const doc = new PDFDocument({ size: "A4", margin: 0, font: reg as unknown as string, bufferPages: true, info: { Title: `AGRI-TRACK รายงานสรุป ประจำปีงบประมาณ ${c.fy}`, Author: "สำนักงานเกษตรจังหวัดศรีสะเกษ", Subject: "สรุปผลปุ๋ยอินทรีย์และไถกลบฟางข้าว" } });
  doc.registerFont("R", reg); doc.registerFont("B", bold);
  const chunks: Buffer[] = [];
  doc.on("data", (d: Buffer) => chunks.push(d));
  const done = new Promise<Buffer>(res => doc.on("end", () => res(Buffer.concat(chunks))));

  // ----- primitives -----
  const text = (s: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: string; w?: number; align?: "left" | "right" | "center" } = {}) => {
    doc.font(o.bold ? "B" : "R").fontSize(o.size ?? 9).fillColor(o.color ?? C.ink);
    if (o.w !== undefined) doc.text(s, x, y, { width: o.w, align: o.align ?? "left", lineBreak: false });
    else doc.text(s, x, y, { lineBreak: false });
  };
  const width = (s: string, size: number, bold = false) => doc.font(bold ? "B" : "R").fontSize(size).widthOfString(s);
  // ตัดบรรทัดภาษาไทยด้วย Intl.Segmenter (pdfkit ไม่รู้จักขอบเขตคำไทย) · w1 = ความกว้างบรรทัดแรก
  const seg = new Intl.Segmenter("th", { granularity: "word" });
  const wrap = (s: string, w: number, size: number, w1 = w) => {
    const lines: string[] = []; let cur = "";
    for (const { segment } of seg.segment(s)) {
      if (cur && width(cur + segment, size) > (lines.length ? w : w1) && segment.trim()) { lines.push(cur.trimEnd()); cur = segment.trimStart(); } else cur += segment;
    }
    if (cur.trim()) lines.push(cur.trimEnd());
    return lines;
  };
  const card = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; top?: string; r?: number } = {}) => {
    doc.save().roundedRect(x, y, w, h, o.r ?? 9).fillAndStroke(o.fill ?? "#ffffff", o.stroke ?? C.line).restore();
    if (o.top) doc.save().roundedRect(x, y, w, h, o.r ?? 9).clip().rect(x, y, w, 3.2).fill(o.top).restore();
  };
  const tri = (x: number, y: number, up: boolean, color: string, s = 3) => {
    doc.save().fillColor(color);
    if (up) doc.polygon([x, y + s], [x + s * 2, y + s], [x + s, y]); else doc.polygon([x, y], [x + s * 2, y], [x + s, y + s]);
    doc.fill().restore();
  };
  // ป้าย YoY แบบเม็ดยา (เขียว = ดีขึ้น · แดง = ลดลง · เทา = ไม่มีปีก่อนให้เทียบ)
  const pill = (label: string, x: number, y: number, v: number | null, h = 13) => {
    const good = v === null ? null : v >= 0, col = good === null ? C.mute : good ? C.green : C.red, bg = good === null ? "#f1f5f9" : good ? "#ecfdf5" : "#fff1f2";
    const w = width(label, 7.4, true) + (v === null ? 14 : 24);
    doc.save().roundedRect(x, y, w, h, h / 2).fill(bg).restore();
    if (v !== null) tri(x + 7, y + h / 2 - 2.2, v >= 0, col, 2.6);
    text(label, x + (v === null ? 7 : 15), y + h / 2 - 5.4, { size: 7.4, bold: true, color: col });
    return w;
  };
  const sectionTitle = (s: string, x: number, y: number) => { doc.save().roundedRect(x, y + 1, 3, 12, 1.5).fill(C.green).restore(); text(s, x + 10, y, { size: 10.5, bold: true }); };
  const niceMax = (v: number) => {
    if (v <= 0) return { max: 4, step: 1 };
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { max: Math.ceil(v / s) * s, step: s };
  };
  const yearColor = [C.gray, C.mint, C.dark];
  // วงแหวนสัดส่วน (เริ่มที่ 12 นาฬิกา วนตามเข็ม)
  const ring = (cx: number, cy: number, r: number, frac: number | null, color: string, lw = 6) => {
    doc.save().lineWidth(lw).strokeColor("#e5e7eb").circle(cx, cy, r).stroke().restore();
    if (frac === null || frac <= 0) return;
    doc.save().lineWidth(lw).lineCap("round").strokeColor(color);
    if (frac >= 0.999) doc.circle(cx, cy, r).stroke();
    else { const a0 = -Math.PI / 2, a1 = a0 + 2 * Math.PI * frac; doc.path(`M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`).stroke(); }
    doc.restore();
  };
  const leaf = (cx: number, cy: number, s: number, fill: string, vein: string) => {
    doc.save().fillColor(fill).path(`M ${cx - s} ${cy + s} C ${cx - s} ${cy - s * 0.2} ${cx - s * 0.2} ${cy - s} ${cx + s} ${cy - s} C ${cx + s} ${cy + s * 0.2} ${cx + s * 0.2} ${cy + s} ${cx - s} ${cy + s} Z`).fill().restore();
    doc.save().moveTo(cx - s * 0.75, cy + s * 0.75).lineTo(cx + s * 0.35, cy - s * 0.35).lineWidth(0.9).strokeColor(vein).stroke().restore();
  };

  // ================= หัวรายงาน (ไล่สีเขียว) =================
  const hh = 68;
  const hg = doc.linearGradient(M, M, M + CW, M + hh); hg.stop(0, "#064e3b").stop(1, "#10b981");
  doc.save().roundedRect(M, M, CW, hh, 13).fill(hg).restore();
  doc.save().roundedRect(M, M, CW, hh, 13).clip().fillOpacity(0.08).fillColor("#ffffff").circle(W - M - 20, M - 6, 62).fill().circle(W - M - 120, M + hh + 22, 44).fill().restore();
  const ig = doc.linearGradient(M + 14, M + 10, M + 60, M + 56); ig.stop(0, "#34d399").stop(1, "#059669");
  doc.save().roundedRect(M + 14, M + 10, 48, 48, 11).fill(ig).restore();
  leaf(M + 38, M + 27, 9, "#ffffff", "#059669");
  text("AGRI-TRACK", M + 14, M + 43, { size: 6.4, bold: true, color: "#ffffff", w: 48, align: "center" });
  text(`รายงานสรุป ประจำปีงบประมาณ ${c.fy}`, M + 76, M + 8, { size: 17, bold: true, color: "#ffffff" });
  text(`ปุ๋ยอินทรีย์ · ไถกลบฟางข้าว · ฟางก้อน  |  ปีงบประมาณ ${a.fy} – ${c.fy}`, M + 76, M + 33, { size: 8.6, color: "#d1fae5" });
  text("สำนักงานเกษตรจังหวัดศรีสะเกษ", M + 76, M + 45, { size: 8.6, color: "#d1fae5" });
  const p1 = `ออกรายงาน ${thaiDate(bkkDate())}`, p2 = `${c.districts} อำเภอ`, pw1 = width(p1, 8.4, true) + 26, pw2 = width(p2, 8.4, true) + 26;
  doc.save().fillOpacity(0.2).fillColor("#ffffff").roundedRect(W - M - 14 - pw1, M + 12, pw1, 18, 9).fill().roundedRect(W - M - 14 - pw2, M + 38, pw2, 18, 9).fill().restore();
  text(p1, W - M - 14 - pw1, M + 16.5, { size: 8.4, bold: true, color: "#ffffff", w: pw1, align: "center" });
  text(p2, W - M - 14 - pw2, M + 42.5, { size: 8.4, bold: true, color: "#ffffff", w: pw2, align: "center" });

  // ================= การ์ด KPI (ไอคอน + กราฟแท่งเล็ก 3 ปี) =================
  const kw = (CW - 30) / 4, ky = M + hh + 10, kh = 64;
  const kpis = [
    { top: C.green, tint: "#d1fae5", label: `ปุ๋ยอินทรีย์รวม ปี ${c.fy}`, value: n1(c.total), unit: "ตัน", vals: years.map(y => y.total), icon: "leaf" },
    { top: C.blue, tint: "#dbeafe", label: `พื้นที่ไถกลบสะสม ปี ${c.fy}`, value: n1(c.area.accum), unit: "ไร่", vals: years.map(y => y.area.accum), icon: "grid" },
    { top: C.orange, tint: "#fef3c7", label: `ฟางก้อน ปี ${c.fy}`, value: n0(c.area.bales), unit: "ก้อน", vals: years.map(y => y.area.bales), icon: "bale" },
    { top: C.purple, tint: "#ede9fe", label: `มูลค่าฟางก้อน ปี ${c.fy}`, value: n0(c.area.baleValue), unit: "บาท", vals: years.map(y => y.area.baleValue), icon: "baht" },
  ];
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 10), inner = kw - 20, v = yoy(k.vals[2], k.vals[1]);
    card(x, ky, kw, kh, { top: k.top });
    text(k.label, x + 10, ky + 9, { size: 7.6, color: C.mute, w: inner - 20 });
    const icx = x + kw - 19, icy = ky + 17;
    doc.save().circle(icx, icy, 9).fill(k.tint).restore();
    if (k.icon === "leaf") leaf(icx, icy, 4.4, k.top, k.tint);
    else if (k.icon === "grid") { doc.save().roundedRect(icx - 5, icy - 4.5, 10, 9, 1.6).lineWidth(1).strokeColor(k.top).stroke().moveTo(icx - 5, icy - 1).lineTo(icx + 5, icy - 1).moveTo(icx, icy - 4.5).lineTo(icx, icy + 4.5).stroke().restore(); }
    else if (k.icon === "bale") { doc.save().roundedRect(icx - 5.5, icy - 4, 5, 8, 1.4).fill(k.top).roundedRect(icx + 0.5, icy - 4, 5, 8, 1.4).fill(k.top).restore(); }
    else text("฿", icx - 9, icy - 6, { size: 10, bold: true, color: k.top, w: 18, align: "center" });
    let vs = 15.5; while (vs > 9.5 && width(k.value, vs, true) + 4 + width(k.unit, 8) > inner) vs -= 0.5; // ตัวเลขยาวให้ย่อ ไม่ให้ล้นการ์ด
    text(k.value, x + 10, ky + 24, { size: vs, bold: true });
    text(k.unit, x + 10 + width(k.value, vs, true) + 3, ky + 24 + vs * 0.38, { size: 8, color: C.mute });
    pill(v === null ? "- YoY" : `${sgn(v)} YoY`, x + 10, ky + kh - 19, v);
    const mx = Math.max(...k.vals, 1);
    k.vals.forEach((val, j) => { const h2 = Math.max(3, (val / mx) * 15); doc.save().roundedRect(x + kw - 35 + j * 8, ky + kh - 7 - h2, 6, h2, 1.5).fill(yearColor[j]).restore(); });
  });

  // ================= วงแหวนสถานะ 3 ใบ =================
  const ty0 = ky + kh + 6, rw = (CW - 20) / 3, rh0 = 60;
  const onTime = c.onTimePct;
  const rings: { color: string; frac: number | null; center: string; title: string; chip: string; tone: Tone; l1: string; l2: string }[] = [
    { color: C.green, frac: c.target > 0 ? c.pct / 100 : null, center: c.target > 0 ? `${c.pct.toFixed(1)}%` : "-", title: "ปุ๋ยอินทรีย์เทียบเป้า", chip: c.target <= 0 ? "ยังไม่ตั้งเป้า" : c.pct >= 100 ? "บรรลุเป้าหมาย" : c.pct >= 75 ? "ใกล้ถึงเป้า" : "ควรเร่งรัด", tone: c.target <= 0 ? "none" : c.pct >= 100 ? "good" : c.pct >= 75 ? "warn" : "bad",
      l1: `บรรลุเป้า ${c.reached}/${c.districts} อำเภอ`, l2: `ผลิต ${n0(c.total)} / เป้า ${n0(c.target)} ตัน` },
    { color: C.blue, frac: c.area.target > 0 ? c.area.ofTarget / 100 : null, center: c.area.target > 0 ? `${Math.round(c.area.ofTarget)}%` : "-", title: `ไถกลบเทียบเป้า ${K.targetPct}%`, chip: c.area.target <= 0 ? "ยังไม่ตั้งเป้า" : c.area.ofTarget >= 100 ? "บรรลุเป้าหมาย" : c.area.ofTarget >= 75 ? "ใกล้ถึงเป้า" : "ควรเร่งรัด", tone: c.area.target <= 0 ? "none" : c.area.ofTarget >= 100 ? "good" : c.area.ofTarget >= 75 ? "warn" : "bad",
      l1: `บรรลุเป้า ${c.area.reachedD}/${c.districts} อำเภอ`, l2: `ไถกลบ ${c.area.pct.toFixed(1)}% ของพื้นที่ปลูก` },
    { color: C.purple, frac: onTime === null ? null : onTime / 100, center: onTime === null ? "-" : `${onTime.toFixed(1)}%`, title: "การส่งรายงานตรงเวลา", chip: onTime === null ? "ยังไม่มีข้อมูล" : onTime >= 90 ? "ตรงเวลาดี" : "ควรเร่งรัด", tone: onTime === null ? "none" : onTime >= 90 ? "good" : "warn",
      l1: `ส่งแล้ว ${c.sent}/${c.districts} อำเภอ`, l2: `ส่งช้า ${c.late} จาก ${c.submitted} ฉบับ` },
  ];
  rings.forEach((r, i) => {
    const x = M + i * (rw + 10);
    card(x, ty0, rw, rh0);
    ring(x + 35, ty0 + rh0 / 2, 21, r.frac, r.color, 5);
    text(r.center, x + 35 - 20, ty0 + rh0 / 2 - 4.6, { size: r.center.length > 5 ? 8 : 9, bold: true, w: 40, align: "center" });
    text(r.title, x + 68, ty0 + 8, { size: 9.4, bold: true });
    const t = TONE[r.tone], cw2 = width(r.chip, 7.4, true) + 20;
    doc.save().roundedRect(x + 68, ty0 + 22, cw2, 12, 6).fill(t.bg).circle(x + 74, ty0 + 28, 2).fill(t.fg).restore();
    text(r.chip, x + 81, ty0 + 24, { size: 7.4, bold: true, color: t.fg });
    text(r.l1, x + 68, ty0 + 38, { size: 7.5, color: C.mute });
    text(r.l2, x + 68, ty0 + 48, { size: 7.5, color: C.mute });
  });

  // ================= กราฟ =================
  const gy = ty0 + rh0 + 6, gh = 136, gw = (CW - 10) / 2;
  const frame = (cx: number, title: string, unit: string) => {
    card(cx, gy, gw, gh);
    sectionTitle(title, cx + 12, gy + 10);
    text(`หน่วย: ${unit}`, cx, gy + 12, { size: 7.8, color: C.mute, w: gw - 12, align: "right" });
    let lx = cx + 12;
    years.forEach((y, i) => { doc.save().roundedRect(lx, gy + 30, 9, 9, 2.5).fill(yearColor[i]).restore(); text(`ปี ${y.fy}`, lx + 13, gy + 29.5, { size: 7.8, color: C.mute }); lx += 13 + width(`ปี ${y.fy}`, 7.8) + 12; });
  };
  const px = (cx: number) => cx + 40, py = gy + 46, pw = gw - 40 - 14, ph = gh - 46 - 26;
  const grid = (cx: number, max: number, step: number) => {
    for (let v = 0; v <= max + 1e-9; v += step) {
      const yy = py + ph - (v / max) * ph;
      doc.save().moveTo(px(cx), yy).lineTo(px(cx) + pw, yy).lineWidth(0.5).strokeColor(C.line).stroke().restore();
      text(n0(v), cx + 4, yy - 3.8, { size: 6.8, color: C.soft, w: 30, align: "right" });
    }
  };
  // ซ้าย: แท่งกลุ่มตามชนิดปุ๋ย
  frame(M, "ปุ๋ยอินทรีย์แยกตามชนิด เทียบ 3 ปี", "ตัน");
  const bm = niceMax(Math.max(...years.flatMap(y => y.cats), 0));
  grid(M, bm.max, bm.step);
  const gW = pw / CATS.length, bw = Math.min(13, gW / 4.2), cluster = bw * 3 + 4;
  CATS.forEach((cat, ci) => {
    const gx = px(M) + gW * ci + (gW - cluster) / 2;
    years.forEach((y, si) => {
      const v = y.cats[ci], bh = bm.max > 0 ? (v / bm.max) * ph : 0, x = gx + si * (bw + 2), top = py + ph - Math.max(bh, 2.5);
      doc.save().roundedRect(x, top, bw, Math.max(bh, 2.5), Math.min(2.4, bw / 2)).fill(yearColor[si]).restore();
      if (si === 2) text(n0(v), x - 14 + bw / 2, top - 10.5, { size: 7.8, bold: true, color: C.dark, w: 28, align: "center" });
    });
    wrap(cat.label, gW - 2, 7.8).slice(0, 2).forEach((ln, i) => text(ln, px(M) + gW * ci, py + ph + 6 + i * 9.5, { size: 7.8, bold: true, color: "#334155", w: gW, align: "center" }));
  });
  // ขวา: เส้น + พื้นที่ใต้เส้นของปีล่าสุด + ป้ายค่าสูงสุด
  const rx0 = M + gw + 10;
  frame(rx0, "พื้นที่ไถกลบรายเดือน เทียบ 3 ปี", "ไร่");
  const sm = ["พ.ย.", "ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย."];
  const series = years.map(y => sm.map((_, i) => y.areaMonthly[i] ?? 0));
  const lm = niceMax(Math.max(...series.flat(), 0));
  grid(rx0, lm.max, lm.step);
  const xs = sm.map((_, i) => px(rx0) + (pw / (sm.length - 1)) * i);
  sm.forEach((m, i) => text(m, xs[i] - 16, py + ph + 7, { size: 7.8, bold: true, color: "#334155", w: 32, align: "center" }));
  const ptsOf = (vs: number[]) => vs.map((v, i) => [xs[i], py + ph - (lm.max > 0 ? (v / lm.max) * ph : 0)] as const);
  const lastPts = ptsOf(series[2]);
  doc.save().fillOpacity(0.1).fillColor(C.dark).moveTo(lastPts[0][0], py + ph); lastPts.forEach(([x, y]) => doc.lineTo(x, y)); doc.lineTo(lastPts[lastPts.length - 1][0], py + ph).closePath().fill().restore();
  series.forEach((vs, si) => {
    const pts = ptsOf(vs);
    doc.save().lineWidth(si === 2 ? 2.1 : 1.6).lineJoin("round").strokeColor(yearColor[si]); if (si === 0) doc.dash(3, { space: 2.5 });
    pts.forEach(([x, y], i) => (i ? doc.lineTo(x, y) : doc.moveTo(x, y))); doc.stroke().restore();
    pts.forEach(([x, y]) => doc.save().circle(x, y, si === 2 ? 2.8 : 2.3).lineWidth(1.3).fillAndStroke("#ffffff", yearColor[si]).restore());
  });
  const peak = series[2].reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
  if (series[2][peak] > 0) text(`สูงสุด ${n0(series[2][peak])}`, lastPts[peak][0] - 40, Math.max(py - 4, lastPts[peak][1] - 14), { size: 7.8, bold: true, color: C.dark, w: 80, align: "center" });

  // ================= ตารางสรุปเปรียบเทียบ =================
  type Row = { g?: string; color?: string; tint?: string; l?: string; v?: (y: YearStat) => number; f?: (v: number) => string };
  const rowsDef: Row[] = [
    { g: "ปุ๋ยอินทรีย์และวัสดุอินทรีย์", color: C.green, tint: "#e3f3ec" },
    { l: "ปุ๋ยอินทรีย์รวม (ตัน)", v: y => y.total, f: n1 },
    { l: "ร้อยละบรรลุเป้าหมายปุ๋ย (%)", v: y => y.pct, f: v => v.toFixed(1) + "%" },
    { g: "ไถกลบฟางข้าว", color: C.blue, tint: "#e4ecfb" },
    { l: "พื้นที่ไถกลบสะสม (ไร่)", v: y => y.area.accum, f: n1 },
    { l: `ร้อยละของเป้าหมาย ${K.targetPct}% ของพื้นที่ปลูก (%)`, v: y => y.area.ofTarget, f: v => v.toFixed(1) + "%" },
    { l: "ปริมาณฟางข้าว (ตัน)", v: y => y.area.straw, f: n1 },
    { g: "ฟางก้อน", color: C.orange, tint: "#fdf1d8" },
    { l: "ฟางก้อน (ก้อน)", v: y => y.area.bales, f: n0 },
    { l: "มูลค่าฟางก้อน (บาท)", v: y => y.area.baleValue, f: n0 },
  ];
  const rowH = 14.3, gH = 14.4, tby = gy + gh + 6;
  const nRows = rowsDef.filter(r => r.l).length, nG = rowsDef.length - nRows, th = 56 + nRows * rowH + nG * gH + 6;
  card(M, tby, CW, th);
  sectionTitle("ตารางสรุปเปรียบเทียบย้อนหลัง 3 ปีงบประมาณ", M + 12, tby + 10);
  text("ตัวชี้วัดสำคัญ (Key Metrics)", M, tby + 12, { size: 7.8, color: C.mute, w: CW - 14, align: "right" });
  const yr = [M + 282, M + 352, M + 422], yoyR = M + CW - 12, hy = tby + 30, bodyTop = hy + 20;
  // แถบไฮไลต์คอลัมน์ปีล่าสุด
  doc.save().fillOpacity(0.55).fillColor("#d9ece3").rect(yr[2] - 62, hy + 8, 76, th - 38).fill().restore();
  doc.save().roundedRect(M + 8, hy, CW - 16, 17, 6).fill("#f1f5f9").restore();
  doc.save().roundedRect(yr[2] - 62, hy, 76, 17, 6).fill(C.dark).restore();
  text("ตัวชี้วัด", M + 16, hy + 3, { size: 7.8, bold: true, color: C.mute });
  years.forEach((y, i) => text(`ปี ${y.fy}`, yr[i] - 62, hy + 3, { size: 7.8, bold: true, color: i === 2 ? "#ffffff" : C.mute, w: 76 - (i === 2 ? 8 : 14), align: "right" }));
  text("% YoY", yoyR - 60, hy + 3, { size: 7.8, bold: true, color: C.mute, w: 60, align: "center" });
  let ry0 = bodyTop;
  rowsDef.forEach(r => {
    if (r.g) {
      doc.save().rect(M + 8, ry0 - 1, CW - 16, gH - 1).fillOpacity(0.9).fill(r.tint!).restore();
      doc.save().rect(M + 8, ry0 - 1, 3, gH - 1).fill(r.color!).restore();
      text(r.g, M + 18, ry0 + 1.2, { size: 8.2, bold: true, color: r.color === C.orange ? "#b45309" : r.color });
      ry0 += gH; return;
    }
    text(r.l!, M + 16, ry0 + 1.5, { size: 8 });
    years.forEach((y, j) => text(r.f!(r.v!(y)), yr[j] - 62, ry0 + 1.5, { size: 8, w: 76 - (j === 2 ? 8 : 14), align: "right", bold: j === 2, color: j === 2 ? C.ink : "#334155" }));
    const ch2 = yoy(r.v!(c), r.v!(b)), lbl = ch2 === null ? "-" : sgn(ch2, 2), pwd = width(lbl, 7.4, true) + (ch2 === null ? 14 : 24);
    pill(lbl, yoyR - 30 - pwd / 2, ry0 - 0.5, ch2, 12.5);
    ry0 += rowH;
  });

  // ================= การประชาสัมพันธ์เรื่องการหยุดเผา =================
  const ry = tby + th + 6, rh = 92, B = c.burn, burnCol = "#c2410c";
  card(M, ry, CW, rh, { top: burnCol });
  sectionTitle(`การประชาสัมพันธ์เรื่องการหยุดเผา ปีงบประมาณ ${c.fy}`, M + 12, ry + 10);
  text("หน่วย: ครั้ง", M, ry + 12, { size: 7.8, color: C.mute, w: CW - 14, align: "right" });
  // ซ้าย: จำนวนครั้งของปีงบประมาณนี้ + YoY
  text("จัดกิจกรรมเรียนรู้/ประชาสัมพันธ์แล้ว", M + 14, ry + 30, { size: 7.8, color: C.mute });
  const bv = n0(B.activities);
  text(bv, M + 14, ry + 40, { size: 24, bold: true, color: burnCol });
  text("ครั้ง", M + 14 + width(bv, 24, true) + 4, ry + 40 + 24 * 0.42, { size: 9, color: C.mute });
  const bch = yoy(B.activities, b.burn.activities);
  pill(bch === null ? "- YoY" : `${sgn(bch)} YoY`, M + 14, ry + rh - 21, bch);
  // กลาง: แท่งเปรียบเทียบ 3 ปี
  const bx0 = M + 190, bBase = ry + rh - 22, bMaxH = 34, bMax = Math.max(...years.map(y => y.burn.activities), 1);
  doc.save().moveTo(bx0 - 6, bBase).lineTo(bx0 + 3 * 40, bBase).lineWidth(0.5).strokeColor(C.line).stroke().restore();
  years.forEach((y, i) => {
    const v = y.burn.activities, h2 = v > 0 ? Math.max(3, (v / bMax) * bMaxH) : 2.5, x = bx0 + i * 40;
    doc.save().roundedRect(x, bBase - h2, 22, h2, 2.4).fill(i === 2 ? burnCol : i === 1 ? "#fdba74" : C.gray).restore();
    text(n0(v), x - 9, bBase - h2 - 10.5, { size: 7.8, bold: true, color: i === 2 ? burnCol : "#334155", w: 40, align: "center" });
    text(`ปี ${y.fy}`, x - 9, bBase + 4, { size: 7.4, bold: i === 2, color: i === 2 ? C.ink : C.mute, w: 40, align: "center" });
  });
  // ขวา: อำเภอที่จัดกิจกรรม / ที่ยังไม่มี
  const rx1 = M + 340, rw1 = CW - 340 - 14;
  doc.save().moveTo(rx1 - 12, ry + 30).lineTo(rx1 - 12, ry + rh - 12).lineWidth(0.5).strokeColor(C.line).stroke().restore();
  if (B.activities > 0) {
    text(`อำเภอที่จัดกิจกรรมแล้ว ${B.sentD}/${c.districts} อำเภอ`, rx1, ry + 30, { size: 8.4, bold: true });
    if (B.noActivity.length) {
      text("อำเภอที่ยังไม่มีกิจกรรม:", rx1, ry + 44, { size: 7.8, bold: true, color: C.mute });
      wrap(listTh(B.noActivity, 6), rw1, 7.8).slice(0, 3).forEach((ln, i) => text(ln, rx1, ry + 55 + i * 10, { size: 7.8, color: "#334155" }));
    } else text("ทุกอำเภอจัดกิจกรรมแล้ว", rx1, ry + 44, { size: 7.8, color: C.green, bold: true });
  } else {
    text("ยังไม่มีการบันทึกกิจกรรมหยุดเผา", rx1, ry + 30, { size: 8.4, bold: true });
    text("ในปีงบประมาณนี้", rx1, ry + 42, { size: 7.8, color: C.mute });
  }

  doc.end();
  return done;
}