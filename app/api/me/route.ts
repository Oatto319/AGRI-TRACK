import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// บอกว่าผู้ใช้ที่ล็อกอินอยู่เป็นใคร (role / อำเภอ / ต้องเปลี่ยนรหัสผ่านหรือไม่) จาก session ฝั่งเซิร์ฟเวอร์ — หน้าเว็บใช้แทนค่าใน localStorage
export async function GET(req: NextRequest) {
  const a = await requireSession(req, { allowMustChange: true });
  if ("res" in a) return a.res;
  const { role, district, username, mustChange } = a.session;
  return NextResponse.json({ role, ...(district ? { district } : {}), username, mustChange }, { headers: { "Cache-Control": "no-store" } });
}
