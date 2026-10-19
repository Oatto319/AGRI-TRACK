import ExcelJS from "exceljs";
import { AREA_TARGET_PCT, BALES_PER_RAI, BURN_FIELDS, BALE_PRICE, FIELDS, rangeLabel, thaiDate, thaiDateTime, thaiMonth, thaiMonthShort, type AreaReport, type BurnReport, type Report } from "./data";
import { aggregate, aggregateArea, aggregateBurn } from "./summary";

type Agg = ReturnType<typeof aggregate>;

function buildSheet(workbook: ExcelJS.Workbook, name: string, a: Agg, subtitle: string, withMonths: boolean) {
  const nf = FIELDS.length, mc = withMonths ? a.months.length : 0;
  const head = ["ที่", "อำเภอ", "จำนวนเกษตรตำบล (ราย)", "เป้าหมายการผลิต (ตัน)", ...FIELDS.map(f => `${f.label} (ตัน)`), "รวม (ตัน)",
    ...(withMonths ? a.months.map(thaiMonth) : []), ...(withMonths ? ["รวม (ตัน)"] : [])];
  const group = ["", "", "", "", ...FIELDS.map(f => f.group), "", ...Array(mc).fill(withMonths ? "ระยะเวลาดำเนินการ" : ""), ...(withMonths ? [""] : [])];
  const body = a.rows.map((r, i) => [i + 1, r.name, r.tambon, r.target, ...FIELDS.map(f => r.sums[f.key]), r.total,
    ...(withMonths ? a.months.map(m => r.byMonth[m] ?? "") : []), ...(withMonths ? [r.total] : [])]);
  const sumCol = (c: number) => body.reduce((s, row) => s + (Number(row[c]) || 0), 0);
  const totalRow = ["", "รวม", ...head.slice(2).map((_, k) => sumCol(k + 2))];
  const aoa = [["แบบสำรวจการส่งเสริมการผลิตและใช้ปุ๋ยอินทรีย์และวัสดุอินทรีย์"], [`สำนักงานเกษตรจังหวัดศรีสะเกษ ${subtitle}`], [], group, head, ...body, totalRow];
  const worksheet = workbook.addWorksheet(name);
  worksheet.addRows(aoa);
  worksheet.mergeCells(1, 1, 1, head.length);
  worksheet.mergeCells(2, 1, 2, head.length);
  const g0 = 4; // รวมหัวกลุ่มที่ติดกัน
  let start = g0;
  for (let c = g0 + 1; c <= g0 + nf; c++) {
    if (c === g0 + nf || group[c] !== group[start]) {
      if (c - 1 > start) worksheet.mergeCells(4, start + 1, 4, c);
      start = c;
    }
  }
  if (mc > 1) worksheet.mergeCells(4, 6 + nf, 4, 5 + nf + mc);
  worksheet.columns = head.map((_, i) => ({ width: i === 1 ? 16 : i >= 4 && i < 4 + nf ? 14 : 13 }));
}

export async function buildWorkbook(reports: Report[], from: string, to: string, rounds = 1, area: AreaReport[] = [], areaTotals: Record<string, number> = {}, burn: BurnReport[] = [], burnRounds = 1): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const all = aggregate(reports, from, to, rounds);
  buildSheet(workbook, "สรุปสะสม", all, `${rangeLabel(from, to)} (${thaiMonth(from)} ถึง ${thaiMonth(to)})`, true);
  for (const m of all.months) {
    const one = aggregate(reports, m, m, rounds);
    buildSheet(workbook, thaiMonth(m), one, `ประจำเดือน ${thaiMonth(m)}`, false);
  }
  const log = reports.filter(r => r.status === "submitted" && r.month >= from && r.month <= to)
    .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const ws = workbook.addWorksheet("บันทึกการส่ง");
  ws.addRows([["อำเภอ", "เดือน", "รอบที่", "กำหนดส่ง", "วันที่ส่ง", "สถานะ", "ผู้รายงาน", "ตำแหน่ง", "โทรศัพท์"],
    ...log.map(r => [r.district, thaiMonth(r.month), r.round, r.dueDate ? thaiDate(r.dueDate) : "", r.submittedAt ? thaiDateTime(r.submittedAt) : "",
      !r.submittedAt ? "ไม่มีบันทึกวันที่ส่ง" : r.late ? "ส่งช้า" : "ตรงเวลา", r.reporter.name, r.reporter.position, r.reporter.phone])]);
  ws.columns = [16, 16, 8, 14, 22, 10, 20, 20, 14].map(width => ({ width }));
  const ar = aggregateArea(area, to, areaTotals), aw = workbook.addWorksheet("พื้นที่และฟางข้าว");
  aw.addRows([["ข้อมูลพื้นที่และฟางข้าว"], [`${rangeLabel(from, to)} · ฤดูกาล ${thaiMonth(ar.season.start)} ถึง ${thaiMonth(ar.season.end)} (สะสมถึง ${thaiMonth(ar.months[ar.months.length - 1])})`], [],
    ["ที่", "อำเภอ", "พื้นที่ปลูกพืชทั้งหมด (ไร่)", `เป้าหมายร้อยละ ${AREA_TARGET_PCT} ของพื้นที่ (ไร่)`, ...ar.months.map(m => `${thaiMonthShort(m)} (ไร่)`), "พื้นที่สะสมทั้งหมด (ไร่)", "คิดเป็นร้อยละของพื้นที่ทั้งหมด (%)", "ปริมาณฟางข้าว (ตัน)", "คิดเป็นมูลค่า (บาท)", "ฟางก้อน (ก้อน)", "ราคาฟางก้อน (บาท)", "ส่งช้า (ครั้ง)"],
    ...ar.rows.map((r, i) => [i + 1, r.name, r.total, r.target, ...ar.months.map(m => r.byMonth[m] ?? 0), r.accum, Number(r.pct.toFixed(2)), r.straw, r.value, r.bales, r.baleValue, r.late]),
    ["", "รวม", ar.sums.total, ar.sums.target, ...ar.months.map(m => ar.rows.reduce((x, r) => x + (r.byMonth[m] ?? 0), 0)), ar.sums.accum, Number(ar.pct.toFixed(2)), ar.sums.straw, ar.sums.value, ar.sums.bales, ar.sums.baleValue, ar.sums.late], [],
    ["หมายเหตุ: พื้นที่ปลูกพืชทั้งหมดจังหวัดเป็นผู้กำหนด · พื้นที่สะสม = ผลรวมพื้นที่ที่อำเภอรายงานรายเดือนช่วงพฤศจิกายน–มิถุนายนของฤดูกาล"],
    ["ฟางข้าว (ตัน) = (ไร่สะสม × 500 กก.) ÷ 1,000 · มูลค่า (บาท) = ไร่สะสม × 725 บาท"],
    [`ฟางก้อน (ก้อน) = ไร่สะสม × ${BALES_PER_RAI} ก้อน · ราคาฟางก้อน (บาท) = จำนวนก้อน × ${BALE_PRICE} บาท`]]);
  aw.columns = [6, 16, 22, 26, ...ar.months.map(() => 14), 22, 26, 20, 20, 18, 20, 12].map(width => ({ width }));
  const br = aggregateBurn(burn, from, to, burnRounds), bw = workbook.addWorksheet("การหยุดเผา");
  bw.addRows([["สร้างการเรียนรู้/ประชาสัมพันธ์เรื่องการหยุดเผา"], [`${rangeLabel(from, to)} (${thaiMonth(from)} ถึง ${thaiMonth(to)})`], [],
    ["ที่", "อำเภอ", ...BURN_FIELDS.map(f => `${f.label} (${f.unit})`), "เดือนที่ส่งครบ", "ส่งช้า (ครั้ง)"],
    ...br.rows.map((r, i) => [i + 1, r.name, ...BURN_FIELDS.map(f => r.sums[f.key]), `${r.sent}/${br.months.length}`, r.late]),
    ["", "รวม", ...BURN_FIELDS.map(f => br.sums[f.key]), "", br.late]]);
  bw.columns = [6, 16, ...BURN_FIELDS.map(() => 26), 16, 14].map(width => ({ width }));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
