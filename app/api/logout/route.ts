import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { deleteSession } from "@/lib/users";

// ออกจากระบบ: ลบ session ในฐานข้อมูลด้วย token เดิมจึงใช้ไม่ได้อีก (ไม่ใช่แค่ลบ cookie ฝั่งเบราว์เซอร์)
export async function POST(req: NextRequest) {
  try { const t = readSession(req); if (t) await deleteSession(t.sid); } catch (e) { console.error("[logout]", e); }
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
