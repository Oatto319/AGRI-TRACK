import { NextRequest, NextResponse } from "next/server";
import { validateAreaTotals, validateDueDays } from "@/lib/data";
import { readSettings, writeSettings } from "@/lib/store";

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });

export async function GET() { return NextResponse.json(await readSettings()); }

// ส่งมาเฉพาะ dueDays (รอบรายงาน) หรือเฉพาะ areaTotals (พื้นที่ปลูกพืชทั้งหมดรายอำเภอ) หรือทั้งสองอย่างก็ได้ — ค่าที่ไม่ได้ส่งมาคงเดิม
// หมายเหตุ: ยังไม่มีการตรวจสิทธิ์ (ระบบล็อกอินเป็นตัวอย่าง) — ควรจำกัดให้เฉพาะเจ้าหน้าที่จังหวัดก่อนใช้งานจริง
export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return bad("ข้อมูลไม่ถูกต้อง");
  const cur = await readSettings();
  let { dueDays, areaTotals } = cur;
  if ("dueDays" in body) {
    const error = validateDueDays(body.dueDays);
    if (error) return bad(error);
    dueDays = body.dueDays as number[];
  }
  if ("areaTotals" in body) {
    const error = validateAreaTotals(body.areaTotals);
    if (error) return bad(error);
    areaTotals = body.areaTotals as Record<string, number>;
  }
  if (!("dueDays" in body) && !("areaTotals" in body)) return bad("ไม่พบข้อมูลที่ต้องการบันทึก");
  const next = { dueDays, areaTotals };
  await writeSettings(next);
  return NextResponse.json(next);
}
