import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";

// บอกว่าผู้ใช้ที่ล็อกอินอยู่เป็นใคร (role / อำเภอ) จาก session ฝั่งเซิร์ฟเวอร์ — หน้าเว็บใช้แทนค่าใน localStorage
export async function GET(req: NextRequest) {
  const a = requireSession(req);
  if ("res" in a) return a.res;
  return NextResponse.json(a.session, { headers: { "Cache-Control": "no-store" } });
}
