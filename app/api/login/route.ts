import { NextRequest, NextResponse } from "next/server";
import { verifyLogin } from "@/lib/users";

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 }); }
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof b.username !== "string" || typeof b.password !== "string" || !b.username || !b.password) {
    return NextResponse.json({ error: "กรอกชื่อผู้ใช้และรหัสผ่านให้ครบ" }, { status: 400 });
  }
  const session = await verifyLogin(b.username, b.password);
  if (!session) return NextResponse.json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  return NextResponse.json(session); // { role, district? } — อำเภอมาจากบัญชี ไม่ต้องเลือกเอง
}
