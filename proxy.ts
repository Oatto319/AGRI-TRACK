import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/session";

// ด่านแรกของหน้าเว็บ: ยังไม่ล็อกอิน (cookie ไม่ถูกต้อง/หมดอายุ) เข้า /district /province /change-password ไม่ได้ ให้กลับหน้าเข้าสู่ระบบ
// ที่นี่ตรวจเฉพาะลายเซ็นและวันหมดอายุ (เร็ว ไม่แตะฐานข้อมูล) · การตรวจว่า session ถูกเพิกถอนหรือบัญชีถูกปิดแล้วทำที่ API ทุกตัว (lib/auth.ts)
export function proxy(req: NextRequest) {
  let token = null;
  try { token = readSession(req); } catch { /* AUTH_SECRET ยังไม่ตั้ง → ถือว่าไม่ได้ล็อกอิน */ }
  const path = req.nextUrl.pathname;
  const home = new URL("/", req.url);
  if (!token) return NextResponse.redirect(home);
  if (path.startsWith("/province") && token.role !== "province") return NextResponse.redirect(new URL("/district", req.url));
  if (path.startsWith("/district") && token.role !== "district") return NextResponse.redirect(new URL("/province", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/district/:path*", "/province/:path*", "/change-password"] };
