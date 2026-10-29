import { NextResponse, connection } from "next/server";
import { db } from "@/lib/mongo";

// ตรวจสุขภาพระบบ (ไม่ต้องล็อกอิน ไม่เปิดเผยข้อมูลภายใน) — ใช้กับ load balancer / uptime monitor
// 200 = แอปและฐานข้อมูลพร้อมใช้งาน · 503 = เชื่อมต่อฐานข้อมูลไม่ได้
export async function GET() {
  await connection(); // ต้องตรวจจริงทุกครั้ง ห้ามถูก prerender ตอน build
  const started = Date.now();
  try {
    await (await db()).command({ ping: 1 });
    return NextResponse.json({ status: "ok", db: "up", ms: Date.now() - started, time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[health] ฐานข้อมูลไม่พร้อม:", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "error", db: "down", time: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
