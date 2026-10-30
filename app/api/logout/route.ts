import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";
import { forbidden, sameOrigin } from "@/lib/auth";
import { deleteSession } from "@/lib/users";

// ออกจากระบบ: ลบ session ในฐานข้อมูลด้วย token เดิมจึงใช้ไม่ได้อีก (ไม่ใช่แค่ลบ cookie ฝั่งเบราว์เซอร์)
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return forbidden("คำขอไม่ถูกต้อง"); // กันเว็บอื่นสั่งให้ผู้ใช้ออกจากระบบโดยไม่รู้ตัว
  try { const t = readSession(req); if (t) await deleteSession(t.sid); } catch (e) { console.error("[logout]", e); }
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
