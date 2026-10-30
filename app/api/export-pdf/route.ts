import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { readAll, readAreaAll, readBurnAll, readSettings } from "@/lib/store";
import { buildPdf } from "@/lib/pdf";

// GET /api/export-pdf?fy=2569 → รายงาน PDF เปรียบเทียบย้อนหลัง 3 ปีงบประมาณ (fy-2, fy-1, fy) เป็นปี พ.ศ.
export async function GET(req: NextRequest) {
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  const fy = Number(req.nextUrl.searchParams.get("fy"));
  if (!Number.isInteger(fy) || fy < 2500 || fy > 2700) return new Response("ปีงบประมาณไม่ถูกต้อง", { status: 400 });
  try {
    const [reports, area, burn, settings] = await Promise.all([readAll(), readAreaAll(), readBurnAll(), readSettings()]);
    const buf = await buildPdf(reports, area, settings, fy, burn);
    return new Response(new Uint8Array(buf), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="agri-track-report-fy${fy}.pdf"`,
      "Cache-Control": "no-store",
    } });
  } catch (e) {
    console.error("[export-pdf]", e); // บันทึกสาเหตุจริงไว้ใน log ฝั่งเซิร์ฟเวอร์ (ผู้ใช้เห็นเฉพาะข้อความทั่วไป)
    return new Response("สร้างไฟล์ PDF ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", { status: 500 });
  }
}
