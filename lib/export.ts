import ExcelJS from "exceljs";
import { FIELDS, thaiMonth, type Report } from "./data";
import { aggregate } from "./summary";

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

export async function buildWorkbook(reports: Report[], from: string, to: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const all = aggregate(reports, from, to);
  buildSheet(workbook, "สรุปสะสม", all, `ตั้งแต่เดือน ${thaiMonth(from)} ถึง ${thaiMonth(to)}`, true);
  for (const m of all.months) {
    const one = aggregate(reports, m, m);
    buildSheet(workbook, thaiMonth(m), one, `ประจำเดือน ${thaiMonth(m)}`, false);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
