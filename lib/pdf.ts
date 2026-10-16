import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { DISTRICTS, FIELDS, areaTotalsFor, bkkDate, dueDaysFor, fiscalRange, thaiDate, thaiMonth, type AreaReport, type Report, type Settings } from "./data";
import { aggregate, aggregateArea, monthsBetween, sumValues } from "./summary";

/**
 * สร้างรายงาน PDF "สรุปผลและเปรียบเทียบย้อนหลัง 3 ปีงบประมาณ" (2 หน้า A4)
 * โครงสร้างตามไฟล์ต้นแบบ AGRI-TRACK Dashboard: หัวรายงาน → การ์ด KPI → กราฟเส้นเปรียบเทียบ 3 ปี → ตารางตัวชี้วัด+YoY
 * → ดัชนีผลผลิตรายไตรมาส → การ์ดความคืบหน้า/การส่งรายงาน → ข้อเสนอแนะ (สร้างอัตโนมัติจากข้อมูลจริง)
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
  late: number; submitted: number; onTimePct: number | null;
  lagging: { name: string; pct: number }[]; notSent: string[]; lateByDistrict: { name: string; n: number }[]; areaLow: { name: string; pct: number }[];
}

export function yearStat(reports: Report[], area: AreaReport[], settings: Settings, fy: number): YearStat {
  const { from, to } = fiscalRange(fy);
  const agg = aggregate(reports, from, to, dueDaysFor(settings, "fert", to).length);
  const ar = aggregateArea(area, to, areaTotalsFor(settings, to));
  const rows = agg.rows;
  const total = rows.reduce((a, r) => a + r.total, 0), target = rows.reduce((a, r) => a + r.target, 0);
  const sub = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const subA = area.filter(r => r.status === "submitted" && r.month >= from && r.month <= to);
  const late = rows.reduce((a, r) => a + r.late, 0) + ar.sums.late;
  const submitted = sub.length + subA.length;
  const byMonth = new Map<string, number>();
  sub.forEach(r => byMonth.set(r.month, (byMonth.get(r.month) ?? 0) + sumValues(r.values)));
  const months = monthsBetween(from, to);
  const quarters = [0, 1, 2, 3].map(q => months.slice(q * 3, q * 3 + 3).reduce((a, m) => a + (byMonth.get(m) ?? 0), 0));
  const pctOf = (r: (typeof rows)[number]) => (r.target ? (r.total / r.target) * 100 : 0);
  return {
    fy, from, to, sent: rows.filter(r => r.any).length, districts: rows.length, total, target, pct: target ? (total / target) * 100 : 0,
    reached: rows.filter(r => r.target > 0 && r.total >= r.target).length,
    cats: CATS.map(c => rows.reduce((a, r) => a + c.keys.reduce((s, k) => s + (r.sums[k as keyof typeof r.sums] ?? 0), 0), 0)), quarters,
    area: { accum: ar.sums.accum, total: ar.sums.total, target: ar.sums.target, pct: ar.pct, ofTarget: ar.ofTarget, straw: ar.sums.straw, value: ar.sums.value, bales: ar.sums.bales, baleValue: ar.sums.baleValue,
      reachedD: ar.rows.filter(r => r.target > 0 && r.accum >= r.target).length, sentD: ar.rows.filter(r => r.any).length, assigned: ar.sums.assigned },
    late, submitted, onTimePct: submitted ? ((submitted - late) / submitted) * 100 : null,
    lagging: [...rows].filter(r => r.target > 0 && r.total < r.target).sort((a, b) => pctOf(a) - pctOf(b)).slice(0, 3).map(r => ({ name: r.name, pct: pctOf(r) })),
    notSent: rows.filter(r => !r.any).map(r => r.name),
    lateByDistrict: [...rows.map(r => ({ name: r.name, n: r.late })), ...ar.rows.map(r => ({ name: r.name, n: r.late }))]
      .reduce<{ name: string; n: number }[]>((acc, x) => { const e = acc.find(y => y.name === x.name); if (e) e.n += x.n; else acc.push({ ...x }); return acc; }, [])
      .filter(x => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 3),
    areaLow: ar.rows.filter(r => r.target > 0 && r.accum < r.target).sort((a, b) => a.ofTarget - b.ofTarget).slice(0, 3).map(r => ({ name: r.name, pct: r.ofTarget })),
  };
}

// ---------- ตัวช่วยจัดรูปแบบ ----------
const n1 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });
const n2 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
const n0 = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 0 });
const yoy = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const sgn = (v: number | null, d = 1) => (v === null ? "–" : `${v > 0 ? "+" : ""}${v.toFixed(d)}%`);
const yy = (fy: number) => String(fy).slice(2);

const C = { ink: "#0f172a", mute: "#64748b", line: "#e2e8f0", bg: "#f8fafc", dark: "#064e3b", green: "#059669", mint: "#10b981", blue: "#3b82f6", orange: "#f59e0b", purple: "#8b5cf6", red: "#e11d48", gray: "#94a3b8" };
const W = 595.28, H = 841.89, M = 36, CW = W - 2 * M;

// ---------- ตัวสร้างเอกสาร ----------
export async function buildPdf(reports: Report[], area: AreaReport[], settings: Settings, fy: number): Promise<Buffer> {
  const years = [fy - 2, fy - 1, fy].map(y => yearStat(reports, area, settings, y));
  const [a, b, c] = years;
  const fdir = path.join(process.cwd(), "assets", "fonts");
  const reg = fs.readFileSync(path.join(fdir, "Sarabun-Regular.ttf")), bold = fs.readFileSync(path.join(fdir, "Sarabun-Bold.ttf"));
  const doc = new PDFDocument({ size: "A4", margin: 0, font: reg as unknown as string, bufferPages: true, info: { Title: `AGRI-TRACK รายงานเปรียบเทียบ 3 ปีงบประมาณ ${a.fy}-${c.fy}`, Author: "สำนักงานเกษตรจังหวัดศรีสะเกษ", Subject: "สรุปผลปุ๋ยอินทรีย์และไถกลบฟางข้าว" } });
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
  // ป้ายตัวเลขบนกราฟ: มีพื้นหลังขาว/ตามการ์ด เพื่อไม่ให้ซ้อนกับเส้น
  const tag = (s: string, cx: number, y: number, size = 8, color = C.dark) => {
    doc.font("B").fontSize(size); const w = doc.widthOfString(s) + 6;
    doc.save().roundedRect(cx - w / 2, y - 1, w, size + 3, 3).fillOpacity(0.85).fill("#ffffff").restore();
    text(s, cx - w / 2, y, { size, bold: true, color, w, align: "center" });
  };
  const width = (s: string, size: number, bold = false) => doc.font(bold ? "B" : "R").fontSize(size).widthOfString(s);
  // ตัดบรรทัดภาษาไทยด้วย Intl.Segmenter (ไม่พึ่งการตัดคำของ pdfkit ซึ่งไม่รู้จักขอบเขตคำไทย)
  const seg = new Intl.Segmenter("th", { granularity: "word" });
  const wrap = (s: string, w: number, size: number, bold = false) => {
    const lines: string[] = []; let cur = "";
    for (const { segment } of seg.segment(s)) {
      if (cur && width(cur + segment, size, bold) > w && segment.trim()) { lines.push(cur.trimEnd()); cur = segment.trimStart(); } else cur += segment;
    }
    if (cur.trim()) lines.push(cur.trimEnd());
    return lines;
  };
  const card = (x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; top?: string; r?: number } = {}) => {
    doc.save().roundedRect(x, y, w, h, o.r ?? 8).fillAndStroke(o.fill ?? "#ffffff", o.stroke ?? C.line).restore();
    if (o.top) doc.save().roundedRect(x, y, w, h, o.r ?? 8).clip().rect(x, y, w, 3).fill(o.top).restore();
  };
  const tri = (x: number, y: number, up: boolean, color: string, s = 4) => {
    doc.save().fillColor(color);
    if (up) doc.polygon([x, y + s], [x + s * 2, y + s], [x + s, y]); else doc.polygon([x, y], [x + s * 2, y], [x + s, y + s]);
    doc.fill().restore();
  };
  const badge = (label: string, x: number, y: number, v: number | null, goodWhenUp = true) => {
    const good = v === null ? null : goodWhenUp ? v >= 0 : v <= 0;
    const col = good === null ? C.mute : good ? C.green : C.red, bg = good === null ? "#f1f5f9" : good ? "#ecfdf5" : "#fff1f2";
    const tw = width(label, 7.5, true), w = tw + (v === null ? 12 : 22);
    doc.save().roundedRect(x, y, w, 15, 4).fill(bg).restore();
    if (v !== null) tri(x + 6, y + 5.5, v >= 0, col, 3.2);
    text(label, x + (v === null ? 6 : 15), y + 2.5, { size: 7.5, bold: true, color: col });
    return w;
  };
  const sectionTitle = (s: string, x: number, y: number, right?: string, w?: number) => {
    doc.save().rect(x, y + 3, 3, 11).fill(C.green).restore();
    text(s, x + 9, y, { size: 10.5, bold: true });
    if (right && w) text(right, x, y + 2, { size: 8, color: C.mute, w, align: "right" });
  };
  const niceMax = (v: number) => {
    if (v <= 0) return { max: 4, step: 1 };
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    return { max: Math.ceil(v / s) * s, step: s };
  };
  const yearColor = [C.gray, C.mint, C.dark];

  const pageBg = () => doc.save().rect(0, 0, W, H).fill(C.bg).restore();
  const footer = (n: number) => {
    doc.save().moveTo(M, H - 40).lineTo(W - M, H - 40).lineWidth(0.5).strokeColor(C.line).stroke().restore();
    text("AGRI-TRACK Intelligence Hub • ระบบรายงานปุ๋ยอินทรีย์และวัสดุอินทรีย์ • สำนักงานเกษตรจังหวัดศรีสะเกษ", M, H - 32, { size: 7.5, color: C.mute });
    text(`หน้า ${n} จาก 2`, M, H - 32, { size: 7.5, color: C.mute, w: CW, align: "right" });
  };

  // ================= หน้า 1 =================
  pageBg();
  // หัวรายงาน
  doc.save().roundedRect(M, M, CW, 56, 10).fill(C.dark).restore();
  doc.save().roundedRect(M + 12, M + 12, 32, 32, 7).fill(C.mint).restore();
  text("AG", M + 12, M + 20, { size: 14, bold: true, color: "#fff", w: 32, align: "center" });
  text("AGRI-TRACK ANALYTICS DASHBOARD", M + 54, M + 10, { size: 14, bold: true, color: "#fff" });
  text(`รายงานสรุปผลและการเปรียบเทียบย้อนหลัง 3 ปีงบประมาณ (${a.fy} - ${c.fy})`, M + 54, M + 30, { size: 9, color: "#a7f3d0" });
  const pill = "LIVE DATA CONNECTED", pw = width(pill, 7.5, true) + 22;
  doc.save().roundedRect(W - M - 12 - pw, M + 10, pw, 15, 7.5).fill(C.mint).restore();
  doc.save().circle(W - M - 12 - pw + 8, M + 17.5, 2.2).fill("#fff").restore();
  text(pill, W - M - 12 - pw + 14, M + 12.5, { size: 7.5, bold: true, color: "#fff" });
  text(`อัปเดตล่าสุด: ${thaiDate(bkkDate())} | ${c.districts} อำเภอ`, M, M + 33, { size: 8.5, color: "#a7f3d0", w: CW - 12, align: "right" });

  // การ์ด KPI 4 ใบ
  const kw = (CW - 30) / 4, ky = 102;
  const cum = a.total > 0 ? ((c.total - a.total) / a.total) * 100 : null;
  const cagr = a.total > 0 && c.total > 0 ? (Math.pow(c.total / a.total, 1 / 2) - 1) * 100 : null;
  const kpis = [
    { top: C.green, label: `ปุ๋ยอินทรีย์รวม ปี ${c.fy}`, value: `${n1(c.total)}`, unit: "ตัน", b: `${sgn(yoy(c.total, b.total))} YoY`, v: yoy(c.total, b.total) },
    { top: C.blue, label: "เติบโตสะสม 3 ปี", value: sgn(cum), unit: "", b: `CAGR ${cagr === null ? "–" : cagr.toFixed(1) + "%"}`, v: cagr },
    { top: C.orange, label: `พื้นที่ไถกลบฟางข้าวสะสม ปี ${c.fy}`, value: n1(c.area.accum), unit: "ไร่", b: `${sgn(yoy(c.area.accum, b.area.accum))} YoY`, v: yoy(c.area.accum, b.area.accum) },
    { top: C.purple, label: `มูลค่าฟางข้าว ปี ${c.fy}`, value: n0(c.area.value), unit: "บาท", b: `${sgn(yoy(c.area.value, b.area.value))} YoY`, v: yoy(c.area.value, b.area.value) },
  ];
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 10);
    card(x, ky, kw, 66, { top: k.top });
    text(k.label, x + 10, ky + 11, { size: 7.5, color: C.mute, w: kw - 16 });
    text(k.value, x + 10, ky + 24, { size: 17, bold: true });
    if (k.unit) text(k.unit, x + 14 + width(k.value, 17, true), ky + 31, { size: 8.5, color: C.mute });
    badge(k.b, x + 10, ky + 47, k.v);
  });

  // กราฟเส้นเปรียบเทียบ 3 ปี ตามชนิด
  const cy = 180, ch = 262;
  card(M, cy, CW, ch);
  sectionTitle(`เปรียบเทียบเส้นแนวโน้มผลผลิตรายชนิดปุ๋ย (${a.fy} vs ${b.fy} vs ${c.fy})`, M + 14, cy + 12, "หน่วย: ตัน", CW - 28);
  {
    const px = M + 52, py = cy + 52, pw2 = CW - 52 - 30, ph = ch - 52 - 36;
    const mx = Math.max(...years.flatMap(y => y.cats), 0), { max, step } = niceMax(mx);
    // คำอธิบายสี
    let lx = W - M - 14;
    [...years].reverse().forEach((y, i) => { const t = `ปี ${y.fy}`, tw = width(t, 8); lx -= tw; text(t, lx, cy + 31, { size: 8, color: C.mute }); lx -= 20;
      doc.save().moveTo(lx, cy + 36).lineTo(lx + 16, cy + 36).lineWidth(i === 2 ? 1.5 : 2).strokeColor(yearColor[2 - i]); if (i === 2) doc.dash(3, { space: 2 }); doc.stroke().restore(); lx -= 10; });
    for (let v = 0; v <= max + 1e-9; v += step) {
      const yy2 = py + ph - (v / max) * ph;
      doc.save().moveTo(px, yy2).lineTo(px + pw2, yy2).lineWidth(0.5).strokeColor(C.line).stroke().restore();
      text(n1(v), M + 14, yy2 - 4, { size: 7.5, color: C.gray, w: 32, align: "right" });
    }
    const xs = CATS.map((_, i) => px + (pw2 / CATS.length) * (i + 0.5));
    CATS.forEach((cat, i) => text(cat.label, xs[i] - 50, py + ph + 10, { size: 8.5, bold: true, w: 100, align: "center" }));
    years.forEach((y, si) => {
      const pts = y.cats.map((v, i) => [xs[i], py + ph - (max > 0 ? (v / max) * ph : 0)] as const);
      doc.save().lineWidth(si === 2 ? 2 : 1.6).strokeColor(yearColor[si]); if (si === 0) doc.dash(3, { space: 2 });
      pts.forEach(([x, y2], i) => (i ? doc.lineTo(x, y2) : doc.moveTo(x, y2))); doc.stroke().restore();
      pts.forEach(([x, y2]) => doc.save().circle(x, y2, 2.6).fill(yearColor[si]).restore());
      if (si === 2) pts.forEach(([x, y2], i) => tag(n1(y.cats[i]), x, y2 - 15));
    });
  }

  // ตารางตัวชี้วัด 3 ปี + YoY
  const ty = 454, rowH = 25, rowsDef = [
    { l: "1. อำเภอที่ส่งรายงานปุ๋ยอินทรีย์ (อำเภอ)", v: (y: YearStat) => y.sent, f: n0 },
    { l: "2. ปุ๋ยอินทรีย์และวัสดุอินทรีย์รวม (ตัน)", v: (y: YearStat) => y.total, f: n1 },
    { l: "3. ร้อยละบรรลุเป้าหมายปุ๋ย (%)", v: (y: YearStat) => y.pct, f: (v: number) => v.toFixed(1) + "%" },
    { l: "4. พื้นที่ไถกลบฟางข้าวสะสม (ไร่)", v: (y: YearStat) => y.area.accum, f: n1 },
    { l: "5. มูลค่าฟางข้าว (บาท)", v: (y: YearStat) => y.area.value, f: n0 },
    { l: "6. ส่งรายงานตรงเวลา (%)", v: (y: YearStat) => y.onTimePct ?? 0, f: (v: number, y: YearStat) => (y.onTimePct === null ? "–" : v.toFixed(1) + "%") },
  ];
  const th = 54 + rowsDef.length * rowH + 6;
  card(M, ty, CW, th);
  sectionTitle("ตารางสรุปเปรียบเทียบตัวชี้วัดย้อนหลัง 3 ปีงบประมาณ (Data Grid)", M + 14, ty + 12, "เปรียบเทียบเชิงลึก", CW - 28);
  const colX = [M + 14, M + 238, M + 308, M + 378], colW = 62, hy = ty + 36;
  doc.save().roundedRect(M + 10, hy, CW - 20, 20, 5).fill("#f1f5f9").restore();
  text("ตัวชี้วัดสำคัญ (Key Metrics)", colX[0], hy + 4, { size: 8, bold: true, color: C.mute });
  years.forEach((y, i) => text(`ปี ${y.fy}`, colX[i + 1], hy + 4, { size: 8, bold: true, color: C.mute, w: colW, align: "right" }));
  text("% YoY", M + 440, hy + 4, { size: 8, bold: true, color: C.mute, w: CW - 440 - 14, align: "right" });
  rowsDef.forEach((r, i) => {
    const y0 = hy + 26 + i * rowH;
    if (i) doc.save().moveTo(M + 14, y0 - 3).lineTo(W - M - 14, y0 - 3).lineWidth(0.4).strokeColor(C.line).stroke().restore();
    text(r.l, colX[0], y0 + 3, { size: 8.5, bold: true });
    years.forEach((y, j) => text(r.f(r.v(y), y), colX[j + 1], y0 + 3, { size: 8.5, w: colW, align: "right", color: j === 2 ? C.ink : "#334155", bold: j === 2 }));
    const ch2 = yoy(r.v(c), r.v(b)), lbl = ch2 === null ? "–" : `${sgn(ch2, 2)}${ch2 < 0 ? " (ลดลง)" : ""}`;
    const bw = width(lbl, 7.5, true) + (ch2 === null ? 12 : 22);
    badge(lbl, W - M - 14 - bw, y0 + 1, ch2);
  });

  // หมายเหตุ
  const ny = ty + th + 10, nh = 92;
  card(M, ny, CW, nh, { fill: "#f0fdf4", stroke: "#bbf7d0" });
  text("หมายเหตุการคำนวณ", M + 14, ny + 10, { size: 9.5, bold: true, color: C.dark });
  const notes = [
    "ใช้เฉพาะรายงานที่อำเภอ \"ส่งแล้ว\" (ไม่รวมฉบับร่าง) · ปีงบประมาณ 1 ต.ค. – 30 ก.ย. เช่น ปี " + c.fy + " = " + thaiMonth(c.from) + " ถึง " + thaiMonth(c.to),
    "ร้อยละบรรลุเป้าหมายปุ๋ย = ปุ๋ยรวม ÷ เป้าหมาย (เกษตรตำบล × 140 ตัน) · พื้นที่ไถกลบนับเฉพาะฤดูกาล พ.ย. – มิ.ย. ภายในปีงบประมาณนั้น",
    "% YoY เทียบปี " + c.fy + " กับปี " + b.fy + " (แสดง \"–\" เมื่อปีก่อนหน้าไม่มีข้อมูล) · เติบโตสะสม 3 ปี เทียบปี " + c.fy + " กับปี " + a.fy + " · CAGR คำนวณจาก 2 ช่วงปี",
    "ฟางข้าว = ไร่ × 500 กก. ÷ 1,000 · มูลค่า = ไร่ × 725 บาท · ฟางก้อน = ไร่ × 25 ก้อน · ราคาฟางก้อน = ก้อน × 35 บาท",
  ];
  let nyy = ny + 26;
  notes.forEach(n => wrap(n, CW - 40, 8).forEach((ln, i) => { if (i === 0) doc.save().circle(M + 18, nyy + 5, 1.3).fill(C.green).restore(); text(ln, M + 26, nyy, { size: 8, color: "#334155" }); nyy += 11.5; }));
  footer(1);

  // ================= หน้า 2 =================
  doc.addPage(); pageBg();
  // ดัชนีผลผลิตรายไตรมาส
  const qy = M, qh = 230;
  card(M, qy, CW, qh);
  const qs = years.flatMap(y => y.quarters.map((v, i) => ({ v, label: `Q${i + 1}/${yy(y.fy)}` })));
  const bi = qs.findIndex(q => q.v > 0), base = bi >= 0 ? qs[bi].v : 0;
  sectionTitle(`แนวโน้มดัชนีผลผลิตรายไตรมาส (Quarterly Production Index ${a.fy} - ${c.fy})`, M + 14, qy + 12, base ? `Base ${qs[bi].label} = 100` : "ยังไม่มีข้อมูล", CW - 28);
  text("ไตรมาสตามปีงบประมาณ: Q1 = ต.ค.–ธ.ค. · Q2 = ม.ค.–มี.ค. · Q3 = เม.ย.–มิ.ย. · Q4 = ก.ค.–ก.ย.", M + 23, qy + 29, { size: 7.5, color: C.mute });
  {
    const px = M + 50, py = qy + 52, pw3 = CW - 50 - 34, ph = qh - 52 - 34;
    const idx = qs.map(q => (base ? (q.v / base) * 100 : 0));
    const hi0 = Math.max(100, ...idx), lo0 = Math.min(100, ...idx), step = hi0 - lo0 > 120 ? 50 : hi0 - lo0 > 60 ? 20 : 10;
    const lo = Math.max(0, Math.floor((lo0 - 5) / step) * step), hi = Math.ceil((hi0 + 5) / step) * step;
    const X = (i: number) => px + (pw3 / (qs.length - 1)) * i, Y = (v: number) => py + ph - ((v - lo) / (hi - lo)) * ph;
    for (let v = lo; v <= hi; v += step) {
      doc.save().moveTo(px, Y(v)).lineTo(px + pw3, Y(v)).lineWidth(v === 100 ? 0.8 : 0.5).strokeColor(v === 100 ? C.gray : C.line); if (v === 100) doc.dash(3, { space: 2 }); doc.stroke().restore();
      text(String(v), M + 14, Y(v) - 4, { size: 7.5, color: C.gray, w: 30, align: "right" });
    }
    if (base) {
      doc.save().fillOpacity(0.16).fillColor(C.mint); idx.forEach((v, i) => (i ? doc.lineTo(X(i), Y(v)) : doc.moveTo(X(i), Y(v)))); doc.lineTo(X(idx.length - 1), py + ph).lineTo(X(0), py + ph).closePath().fill().restore();
      doc.save().lineWidth(2).strokeColor(C.green).lineJoin("round"); idx.forEach((v, i) => (i ? doc.lineTo(X(i), Y(v)) : doc.moveTo(X(i), Y(v)))); doc.stroke().restore();
      idx.forEach((v, i) => { const last = i === idx.length - 1; doc.save().circle(X(i), Y(v), last ? 3.4 : 2.4).fill(last ? C.mint : C.dark).restore(); });
      idx.forEach((v, i) => { if (i % 2 === 1 || i === idx.length - 1) tag(v.toFixed(1), X(i), Y(v) - 15, 7.5); });
    } else text("ยังไม่มีรายงานปุ๋ยที่ส่งแล้วในช่วง 3 ปีงบประมาณนี้", px, py + ph / 2 - 6, { size: 9, color: C.mute, w: pw3, align: "center" });
    doc.save().moveTo(px, py + ph).lineTo(px + pw3, py + ph).lineWidth(0.8).strokeColor(C.gray).stroke().restore();
    qs.forEach((q, i) => text(q.label, X(i) - 20, py + ph + 8, { size: 7.5, color: i === qs.length - 1 ? C.dark : C.gray, bold: i === qs.length - 1, w: 40, align: "center" }));
  }

  // การ์ดคู่: ความคืบหน้าเทียบเป้าหมาย + การส่งรายงานและมูลค่า
  const my = qy + qh + 10, mh = 166, mw = (CW - 10) / 2;
  card(M, my, mw, mh);
  text("ความคืบหน้าเทียบเป้าหมาย (Target Progress)", M + 14, my + 12, { size: 10, bold: true });
  doc.save().moveTo(M + 14, my + 30).lineTo(M + mw - 14, my + 30).lineWidth(0.5).strokeColor(C.line).stroke().restore();
  const bars = [
    { l: `ปุ๋ยอินทรีย์รวม (${n1(c.total)} จาก ${n1(c.target)} ตัน)`, p: c.pct, t: "ของเป้า" },
    { l: `ไถกลบฟางข้าว (${n1(c.area.accum)} จาก ${n1(c.area.target)} ไร่)`, p: c.area.ofTarget, t: "ของเป้า" },
    { l: `เทียบพื้นที่ปลูกพืชทั้งหมด (${n1(c.area.total)} ไร่)`, p: c.area.pct, t: "ของพื้นที่" },
    { l: `อำเภอที่ถึงเป้าปุ๋ย (${c.reached} จาก ${c.districts} อำเภอ)`, p: c.districts ? (c.reached / c.districts) * 100 : 0, t: "ของอำเภอ" },
  ];
  bars.forEach((r, i) => {
    const y0 = my + 38 + i * 30, bw2 = mw - 28;
    text(r.l, M + 14, y0, { size: 8.5 });
    text(`${r.p.toFixed(0)}% ${r.t}`, M + 14, y0, { size: 8.5, bold: true, color: r.p >= 100 ? C.green : r.p >= 50 ? C.mint : C.orange, w: bw2, align: "right" });
    doc.save().roundedRect(M + 14, y0 + 14, bw2, 6, 3).fill("#e2e8f0").restore();
    if (r.p > 0) doc.save().roundedRect(M + 14, y0 + 14, Math.max(6, bw2 * Math.min(1, r.p / 100)), 6, 3).fill(r.p >= 100 ? C.green : r.p >= 50 ? C.mint : C.orange).restore();
  });

  const rx = M + mw + 10;
  card(rx, my, mw, mh);
  text("การส่งรายงานและมูลค่า (Reporting & Value)", rx + 14, my + 12, { size: 10, bold: true });
  doc.save().moveTo(rx + 14, my + 30).lineTo(rx + mw - 14, my + 30).lineWidth(0.5).strokeColor(C.line).stroke().restore();
  const topCat = c.total > 0 ? c.cats.map((v, i) => ({ v, l: CATS[i].label })).sort((x, y) => y.v - x.v)[0] : null;
  const bullets: [string, string][] = [
    ["อำเภอที่ส่งรายงานปุ๋ย:", `${c.sent} / ${c.districts} อำเภอ${c.sent < c.districts ? ` (ยังไม่ส่ง ${c.districts - c.sent})` : " (ส่งครบ)"}`],
    ["อำเภอที่ส่งรายงานไถกลบ:", `${c.area.sentD} / ${c.districts} อำเภอ (ถึงเป้า ${c.area.reachedD})`],
    ["ความตรงเวลา:", c.onTimePct === null ? "ยังไม่มีรายงานที่ส่งแล้ว" : `ตรงเวลา ${c.onTimePct.toFixed(1)}% · ส่งช้า ${c.late} ครั้ง จาก ${c.submitted} รายงาน`],
    ["ฟางข้าว:", `${n1(c.area.straw)} ตัน · มูลค่า ${n0(c.area.value)} บาท`],
    ["ฟางก้อน:", `${n0(c.area.bales)} ก้อน · ราคา ${n0(c.area.baleValue)} บาท`],
    ["ชนิดที่ผลิตมากที่สุด:", topCat ? `${topCat.l} (${((topCat.v / c.total) * 100).toFixed(1)}% ของทั้งหมด)` : "ยังไม่มีข้อมูล"],
  ];
  let by = my + 38;
  bullets.forEach(([k, v]) => {
    doc.save().circle(rx + 18, by + 5.5, 1.5).fill(C.green).restore();
    const kwid = width(k, 8.5, true);
    text(k, rx + 26, by, { size: 8.5, bold: true });
    const lines = wrap(v, mw - 26 - 14 - kwid - 4, 8.5);
    lines.forEach((ln, i) => { text(ln, rx + 26 + kwid + 4, by + i * 11, { size: 8.5, color: "#334155" }); });
    by += Math.max(1, lines.length) * 11 + 6;
  });

  // ข้อเสนอแนะเชิงยุทธศาสตร์ (สร้างจากข้อมูลจริงของปีล่าสุด)
  const recs: [string, string][] = [];
  if (c.lagging.length) recs.push(["เร่งรัดอำเภอที่ผลผลิตปุ๋ยต่ำกว่าเป้าหมาย:", `${c.lagging.map(l => `${l.name} (${l.pct.toFixed(0)}%)`).join(" · ")} — เสนอให้ติดตามและสนับสนุนการผลิตปุ๋ยอินทรีย์ในพื้นที่เหล่านี้ก่อน`]);
  else if (c.total > 0) recs.push(["รักษาระดับผลผลิตปุ๋ย:", "ทุกอำเภอที่มีเป้าหมายผลิตถึงเป้าแล้ว ควรถอดบทเรียนและขยายผลสู่การผลิตปุ๋ยพืชสดและวัตถุดิบน้ำหมักชีวภาพเพิ่มเติม"]);
  else recs.push(["เริ่มเก็บข้อมูลปุ๋ยอินทรีย์:", "ยังไม่มีรายงานที่ส่งแล้วในปีงบประมาณนี้ ควรกำชับให้อำเภอส่งรายงานตามรอบที่กำหนด"]);
  if (c.notSent.length) recs.push(["ติดตามการส่งรายงาน:", `ยังไม่มีรายงานปุ๋ยจาก ${c.notSent.length} อำเภอ${c.notSent.length <= 5 ? ` (${c.notSent.join(", ")})` : ` เช่น ${c.notSent.slice(0, 4).join(", ")} และอีก ${c.notSent.length - 4} อำเภอ`}`
    + (c.lateByDistrict.length ? ` · ส่งช้าบ่อย: ${c.lateByDistrict.map(l => `${l.name} (${l.n} ครั้ง)`).join(", ")}` : "")]);
  else if (c.lateByDistrict.length) recs.push(["ลดการส่งรายงานล่าช้า:", `อำเภอที่ส่งช้าบ่อย ได้แก่ ${c.lateByDistrict.map(l => `${l.name} (${l.n} ครั้ง)`).join(", ")} ควรแจ้งเตือนล่วงหน้าก่อนวันกำหนดส่ง`]);
  else recs.push(["การส่งรายงาน:", "ทุกอำเภอส่งรายงานปุ๋ยครบและไม่มีรายการส่งช้า ควรคงการแจ้งเตือนตามรอบเดิม"]);
  if (!c.area.assigned) recs.push(["กำหนดพื้นที่ปลูกพืชทั้งหมดรายอำเภอ:", "ยังกำหนดไม่ครบทุกอำเภอ ระบบจึงใช้พื้นที่สะสมแทน ทำให้เป้าหมายและร้อยละคลาดเคลื่อน (ตั้งค่าได้ที่หน้า 3 ตั้งค่าการรายงาน)"]);
  else if (c.areaLow.length) recs.push(["เร่งการไถกลบฟางข้าว:", `อำเภอที่ยังต่ำกว่าเป้าร้อยละ 35 ของพื้นที่ปลูก: ${c.areaLow.map(l => `${l.name} (${l.pct.toFixed(0)}% ของเป้า)`).join(" · ")} — สนับสนุนการไถกลบในช่วง พ.ย. – มิ.ย.`]);
  else recs.push(["ขยายผลการไถกลบฟางข้าว:", "ทุกอำเภอถึงเป้าแล้ว ควรเพิ่มการใช้ฟางก้อนและส่งเสริมการไถกลบเพื่อเพิ่มมูลค่าธาตุอาหาร"]);

  const ry = my + mh + 10;
  let rh = 38; const recLines = recs.map(([k, v]) => { const kw2 = width(k, 8.5, true), ls = wrap(v, CW - 56 - kw2 - 4, 8.5); rh += Math.max(1, ls.length) * 11 + 6; return { k, kw2, ls }; });
  card(M, ry, CW, rh, { fill: "#f0fdf4", stroke: "#bbf7d0" });
  text("ข้อเสนอแนะเชิงยุทธศาสตร์ (Strategic Recommendations)", M + 14, ry + 12, { size: 10.5, bold: true, color: C.dark });
  doc.save().moveTo(M + 14, ry + 30).lineTo(W - M - 14, ry + 30).lineWidth(0.5).strokeColor("#bbf7d0").stroke().restore();
  let yy3 = ry + 38;
  recLines.forEach((r, i) => {
    text(`${i + 1}.`, M + 14, yy3, { size: 8.5 });
    text(r.k, M + 28, yy3, { size: 8.5, bold: true, color: C.dark });
    r.ls.forEach((ln, j) => text(ln, M + 28 + r.kw2 + 4, yy3 + j * 11, { size: 8.5, color: "#334155" }));
    yy3 += Math.max(1, r.ls.length) * 11 + 6;
  });

  // ท้ายรายงาน
  const fy2 = ry + rh + 18;
  text("AGRI-TRACK Automation System", M, fy2, { size: 8, bold: true, color: C.mute });
  text(` | Report ID: AG-${c.fy}-${bkkDate().replace(/-/g, "")}`, M + width("AGRI-TRACK Automation System", 8, true), fy2, { size: 8, color: C.mute });
  text("สรุปจากข้อมูลในระบบ ณ วันที่ออกรายงาน เฉพาะรายงานที่อำเภอส่งแล้ว", M, fy2 + 11, { size: 8, color: C.mute });
  doc.save().moveTo(W - M - 170, fy2 + 4).lineTo(W - M, fy2 + 4).lineWidth(0.6).strokeColor(C.mute).stroke().restore();
  text("เจ้าหน้าที่ผู้รับผิดชอบ / ผู้อำนวยการ", W - M - 170, fy2 + 9, { size: 8, bold: true, color: C.mute, w: 170, align: "right" });
  footer(2);

  doc.end();
  return done;
}
