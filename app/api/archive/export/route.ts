import { NextRequest } from "next/server";
import { forbidden, requireSession } from "@/lib/auth";
import { fingerprint, fyInventory, logExport } from "@/lib/archive";
import { readAll, readAreaAll, readBurnAll, readSettings } from "@/lib/store";
import { buildWorkbook } from "@/lib/export";
import { areaTotalsFor, cfgOfMonth, dueDaysFor, fiscalRange, type Topic } from "@/lib/data";
import { budgetYearOfMonth, type Counts } from "@/lib/retention";

// GET /api/archive/export?fy=2565&format=xlsx|json → ไฟล์สำรองข้อมูลของปีงบประมาณ (ต.ค.–ก.ย.) · เฉพาะจังหวัด
// xlsx = ไฟล์อ่านง่าย (ช่วงเดือนรายงานของปีนั้นตามที่จังหวัดตั้งไว้) · json = ข้อมูลดิบครบทุกเดือนของปีงบประมาณ ใช้เก็บไว้กู้คืน
// บันทึกประวัติการ export (ใคร เมื่อไร จำนวนกี่รายการ) ก็ต่อเมื่อสร้างไฟล์สำเร็จ — ตัวบันทึกนี้คือสิ่งที่ปลดล็อกระบบ
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  if (auth.session.role !== "province") return forbidden("เฉพาะเจ้าหน้าที่จังหวัดเท่านั้นที่ export ข้อมูลสำรองได้");
  const q = req.nextUrl.searchParams, fy = Number(q.get("fy")), format = q.get("format") ?? "xlsx";
  if (!Number.isInteger(fy) || fy < 2500 || fy > 2700) return new Response("ปีงบประมาณไม่ถูกต้อง", { status: 400 });
  if (format !== "xlsx" && format !== "json") return new Response("รูปแบบไฟล์ไม่ถูกต้อง", { status: 400 });
  try {
    const [settings, inv] = await Promise.all([readSettings(), fyInventory()]);
    const counts: Counts = inv.counts.get(fy) ?? { reports: 0, area: 0, burn: 0 };
    if (counts.reports + counts.area + counts.burn === 0) return new Response("ไม่พบข้อมูลของปีงบประมาณนี้", { status: 404 });
    const [reports, area, burn] = await Promise.all([readAll(), readAreaAll(), readBurnAll()]);
    const inFy = <T extends { month: string }>(rows: T[]) => rows.filter(r => budgetYearOfMonth(r.month) === fy);
    let body: Buffer | string, type: string, name: string;
    if (format === "json") {
      body = JSON.stringify({ app: "agri-track", kind: "archive", fy, exportedAt: new Date().toISOString(), exportedBy: auth.session.username, counts, reports: inFy(reports), area: inFy(area), burn: inFy(burn) });
      type = "application/json; charset=utf-8"; name = `agri-track-archive-fy${fy}.json`;
    } else {
      // ช่วงรายงานของปีนี้ = ตั้งแต่เดือนเริ่มต้นสุดถึงเดือนสิ้นสุดท้ายสุดของช่วงรวมและช่วงรายหัวข้อ (ใช้ช่วงที่จังหวัดตั้งไว้ ปีที่ไม่ได้ตั้งใช้ค่าเริ่มต้น)
      const ranges = [fiscalRange(fy), ...(["fert", "area", "burn"] as Topic[]).map(t => fiscalRange(fy, t))];
      const from = ranges.map(r => r.from).sort()[0], to = ranges.map(r => r.to).sort().pop()!;
      body = await buildWorkbook(reports, from, to, dueDaysFor(settings, "fert", to).length, area, areaTotalsFor(settings, to), burn, dueDaysFor(settings, "burn", to).length, cfgOfMonth(settings, to));
      type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; name = `agri-track-archive-fy${fy}.xlsx`;
    }
    const dataSha256 = inv.snapshots.get(fy);
    if (!dataSha256) throw new Error(`Missing archive snapshot for fiscal year ${fy}`);
    await logExport({ fy, format, by: auth.session.username, counts, bytes: Buffer.byteLength(body), sha256: fingerprint(body), dataSha256 });
    return new Response(typeof body === "string" ? body : new Uint8Array(body), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[archive-export]", e);
    return new Response("สร้างไฟล์สำรองไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { status: 500 });
  }
}
