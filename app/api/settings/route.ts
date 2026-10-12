import { NextRequest, NextResponse } from "next/server";
import { validateDueDays } from "@/lib/data";
import { readSettings, writeSettings } from "@/lib/store";

const bad = (m: string) => NextResponse.json({ error: m }, { status: 400 });

export async function GET() { return NextResponse.json(await readSettings()); }

// หมายเหตุ: ยังไม่มีการตรวจสิทธิ์ (ระบบล็อกอินเป็นตัวอย่าง) — ควรจำกัดให้เฉพาะเจ้าหน้าที่จังหวัดก่อนใช้งานจริง
export async function PUT(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return bad("ข้อมูลไม่ถูกต้อง"); }
  const dueDays = typeof body === "object" && body !== null && "dueDays" in body ? body.dueDays : undefined;
  const error = validateDueDays(dueDays);
  if (error) return bad(error);
  await writeSettings({ dueDays: dueDays as number[] });
  return NextResponse.json({ dueDays });
}
