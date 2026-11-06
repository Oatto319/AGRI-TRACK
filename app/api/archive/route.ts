import { NextRequest, NextResponse, connection } from "next/server";
import { forbidden, requireSession } from "@/lib/auth";
import { ArchiveChangedError, getRetentionStatus, purgeFy, readExportLogs } from "@/lib/archive";
import { RETENTION_YEARS, WARN_DAYS } from "@/lib/retention";

const bad = (m: string, status = 400) => NextResponse.json({ error: m }, { status, headers: { "Cache-Control": "no-store" } });

// GET: สถานะการเก็บข้อมูล 5 ปี · จังหวัดเห็นรายละเอียดทั้งหมด · อำเภอเห็นเฉพาะระดับสถานะกับข้อความ (ใช้แสดงแบนเนอร์)
export async function GET(req: NextRequest) {
  await connection();
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  try {
    const s = await getRetentionStatus();
    if (auth.session.role !== "province") {
      const message = s.level === "locked" ? `ระบบหยุดรับรายงานชั่วคราว เพราะต้องสำรองข้อมูลปีงบประมาณ ${s.blocking.join(", ")} ก่อน กรุณาแจ้งเจ้าหน้าที่จังหวัด` : "";
      return NextResponse.json({ level: s.level === "locked" ? "locked" : "ok", message }, { headers: { "Cache-Control": "no-store" } });
    }
    const history = (await readExportLogs()).slice(-20).reverse();
    return NextResponse.json({ ...s, retentionYears: RETENTION_YEARS, warnDays: WARN_DAYS, history }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[archive]", e);
    return bad("อ่านสถานะการเก็บข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", 500);
  }
}

// POST { action: "purge", fy, confirm } : ลบข้อมูลปีงบประมาณที่หลุดกรอบแล้ว — ต้องมีไฟล์ Excel + JSON ที่ export ไว้และตรงกับข้อมูลปัจจุบัน และพิมพ์ปีงบประมาณยืนยัน
export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if ("res" in auth) return auth.res;
  if (auth.session.role !== "province") return forbidden("เฉพาะเจ้าหน้าที่จังหวัดเท่านั้นที่ลบข้อมูลเก่าได้");
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad("ข้อมูลไม่ถูกต้อง");
  const { action, fy, confirm } = body as Record<string, unknown>;
  if (action !== "purge") return bad("ไม่รู้จักคำสั่ง");
  if (typeof fy !== "number" || !Number.isInteger(fy)) return bad("ปีงบประมาณไม่ถูกต้อง");
  if (confirm !== String(fy)) return bad(`พิมพ์ ${fy} เพื่อยืนยันการลบ`);
  try {
    const s = await getRetentionStatus(), item = s.items.find(i => i.fy === fy);
    if (!item) return bad("ไม่พบข้อมูลของปีงบประมาณนี้", 404);
    if (!item.expired) return bad(`ปีงบประมาณ ${fy} ยังอยู่ในกรอบการเก็บ ${RETENTION_YEARS} ปี ลบไม่ได้`);
    if (!item.purgeReady) return bad("ต้อง export ทั้งไฟล์ Excel และ JSON ของปีนี้ให้ครบ (และข้อมูลต้องไม่เปลี่ยนหลัง export) ก่อนจึงจะลบได้");
    if (!item.snapshotSha256) return bad("ไม่พบข้อมูลยืนยันชุดสำรอง กรุณา export ใหม่ทั้ง Excel และ JSON");
    const { deleted } = await purgeFy(fy, auth.session.username, item.snapshotSha256);
    return NextResponse.json({ ok: true, fy, deleted }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ArchiveChangedError) return bad("ข้อมูลเปลี่ยนหลังสำรอง กรุณา export ทั้งไฟล์ Excel และ JSON ใหม่ก่อนลบ", 409);
    console.error("[archive-purge]", e);
    return bad("ลบข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง", 500);
  }
}
